import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type {
  CollaboratorPresence,
  CrossLink,
  MindMapDocument,
  MindNode,
} from '../../types/mindmap';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseClient: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const STUDENT_NAMES = [
  { name: 'Sen', initials: 'SN', color: '#0EA5E9' },
  { name: 'Elif K.', initials: 'EK', color: '#8B5CF6' },
  { name: 'Mert A.', initials: 'MA', color: '#10B981' },
  { name: 'Zeynep D.', initials: 'ZD', color: '#F43F5E' },
  { name: 'Kerem T.', initials: 'KT', color: '#F59E0B' },
];

function getOrCreateLocalIdentity(): {
  id: string;
  name: string;
  initials: string;
  color: string;
} {
  try {
    const raw = sessionStorage.getItem('gzh_collab_identity');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage error
  }
  const idx = Math.floor(Math.random() * (STUDENT_NAMES.length - 1)) + 1;
  const pick = STUDENT_NAMES[idx];
  const identity = {
    id: `peer_${Math.random().toString(36).slice(2, 10)}`,
    name: pick.name,
    initials: pick.initials,
    color: pick.color,
  };
  try {
    sessionStorage.setItem('gzh_collab_identity', JSON.stringify(identity));
  } catch {
    // Ignore storage error
  }
  return identity;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class RealtimeCollabSession {
  private ydoc: Y.Doc;
  private yNodes: Y.Map<string>;
  private yMeta: Y.Map<string>;
  private idbProvider: IndexeddbPersistence | null = null;
  private broadcast: BroadcastChannel | null = null;
  private supaChannel: RealtimeChannel | null = null;
  private peers = new Map<string, CollaboratorPresence>();
  private cleanupTimer: number | null = null;
  private lastCursorSentAt = 0;
  private isApplyingRemote = false;
  public readonly localIdentity = getOrCreateLocalIdentity();

  constructor(
    private readonly mapId: string,
    private readonly onRemoteDocumentChange: (
      nodes: Record<string, MindNode>,
      title?: string,
      crossLinks?: CrossLink[]
    ) => void,
    private readonly onPresenceChange: (peers: CollaboratorPresence[]) => void
  ) {
    this.ydoc = new Y.Doc();
    this.yNodes = this.ydoc.getMap<string>('nodes');
    this.yMeta = this.ydoc.getMap<string>('meta');

    this.initPersistenceAndChannels();
  }

  private initPersistenceAndChannels(): void {
    try {
      this.idbProvider = new IndexeddbPersistence(`gzh-yjs-v2b-${this.mapId}`, this.ydoc);
    } catch {
      // Fallback gracefully if IndexedDB restricted
    }

    // Observe Yjs CRDT changes coming from remote tabs/devices
    this.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') {
        this.emitCurrentYState();
        return;
      }
      const encoded = uint8ToBase64(update);
      this.broadcast?.postMessage({
        type: 'yjs-update',
        senderId: this.localIdentity.id,
        payload: encoded,
      });
      if (this.supaChannel) {
        void this.supaChannel.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: { senderId: this.localIdentity.id, payload: encoded },
        });
      }
    });

    // Multi-tab / multi-window instant collaboration via BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcast = new BroadcastChannel(`gzh-room-${this.mapId}`);
      this.broadcast.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.senderId === this.localIdentity.id) return;
        if (msg.type === 'yjs-update' && typeof msg.payload === 'string') {
          this.applyEncodedUpdate(msg.payload);
        } else if (msg.type === 'cursor' && msg.presence) {
          this.upsertPeer(msg.presence as CollaboratorPresence);
        } else if (msg.type === 'hello') {
          // Reply with full Yjs state so newly joined tab syncs immediately
          const full = uint8ToBase64(Y.encodeStateAsUpdate(this.ydoc));
          this.broadcast?.postMessage({
            type: 'yjs-update',
            senderId: this.localIdentity.id,
            payload: full,
          });
        }
      };
      this.broadcast.postMessage({
        type: 'hello',
        senderId: this.localIdentity.id,
      });
    }

    // Supabase Realtime cloud sync when credentials exist
    if (supabaseClient) {
      this.supaChannel = supabaseClient.channel(`mindmap:${this.mapId}`, {
        config: { broadcast: { self: false } },
      });

      this.supaChannel
        .on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
          if (payload?.senderId !== this.localIdentity.id && payload?.payload) {
            this.applyEncodedUpdate(payload.payload);
          }
        })
        .on('broadcast', { event: 'cursor' }, ({ payload }) => {
          if (payload?.presence && payload.presence.id !== this.localIdentity.id) {
            this.upsertPeer(payload.presence as CollaboratorPresence);
          }
        })
        .subscribe();
    }

    this.cleanupTimer = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, peer] of this.peers.entries()) {
        if (now - peer.lastSeen > 12000) {
          this.peers.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.notifyPresence();
      }
    }, 4000);
  }

  private applyEncodedUpdate(base64Payload: string): void {
    try {
      this.isApplyingRemote = true;
      const bytes = base64ToUint8(base64Payload);
      Y.applyUpdate(this.ydoc, bytes, 'remote');
    } finally {
      this.isApplyingRemote = false;
    }
  }

  private emitCurrentYState(): void {
    const nextNodes: Record<string, MindNode> = {};
    this.yNodes.forEach((jsonStr, nodeId) => {
      try {
        nextNodes[nodeId] = JSON.parse(jsonStr) as MindNode;
      } catch {
        // Ignore malformed node entry
      }
    });
    if (Object.keys(nextNodes).length > 0) {
      const title = this.yMeta.get('title');
      const rawLinks = this.yMeta.get('crossLinks');
      let parsedLinks: CrossLink[] | undefined;
      if (rawLinks) {
        try {
          parsedLinks = JSON.parse(rawLinks) as CrossLink[];
        } catch {
          parsedLinks = undefined;
        }
      }
      this.onRemoteDocumentChange(nextNodes, title, parsedLinks);
    }
  }

  public syncLocalDocument(doc: MindMapDocument): void {
    if (this.isApplyingRemote) return;

    this.ydoc.transact(() => {
      this.yMeta.set('title', doc.title);
      this.yMeta.set('crossLinks', JSON.stringify(doc.crossLinks ?? []));
      const currentKeys = new Set<string>();
      this.yNodes.forEach((_v, key) => currentKeys.add(key));

      for (const [id, node] of Object.entries(doc.nodes)) {
        const serialized = JSON.stringify(node);
        if (this.yNodes.get(id) !== serialized) {
          this.yNodes.set(id, serialized);
        }
        currentKeys.delete(id);
      }

      for (const deletedKey of currentKeys) {
        this.yNodes.delete(deletedKey);
      }
    }, 'local');

    // Optional cloud backup to Supabase `mindmaps` table
    if (supabaseClient) {
      void supabaseClient
        .from('mindmaps')
        .upsert(
          {
            id: doc.id,
            title: doc.title,
            department: doc.department,
            root_node_id: doc.rootNodeId,
            nodes: doc.nodes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .then(() => undefined, () => undefined);
    }
  }

  public broadcastCursor(worldX: number, worldY: number, activeNodeId?: string | null): void {
    const now = Date.now();
    if (now - this.lastCursorSentAt < 45) return;
    this.lastCursorSentAt = now;

    const presence: CollaboratorPresence = {
      id: this.localIdentity.id,
      name: this.localIdentity.name,
      color: this.localIdentity.color,
      avatarInitials: this.localIdentity.initials,
      worldX: Math.round(worldX),
      worldY: Math.round(worldY),
      activeNodeId,
      lastSeen: now,
    };

    this.broadcast?.postMessage({
      type: 'cursor',
      senderId: this.localIdentity.id,
      presence,
    });

    if (this.supaChannel) {
      void this.supaChannel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: { presence },
      });
    }
  }

  private upsertPeer(peer: CollaboratorPresence): void {
    this.peers.set(peer.id, { ...peer, lastSeen: Date.now() });
    this.notifyPresence();
  }

  private notifyPresence(): void {
    const list: CollaboratorPresence[] = [
      {
        id: this.localIdentity.id,
        name: 'Sen',
        color: '#0EA5E9',
        avatarInitials: 'SN',
        worldX: 0,
        worldY: 0,
        lastSeen: Date.now(),
        isLocal: true,
      },
      ...Array.from(this.peers.values()),
    ];
    this.onPresenceChange(list);
  }

  public getInitialPresence(): CollaboratorPresence[] {
    return [
      {
        id: this.localIdentity.id,
        name: 'Sen',
        color: '#0EA5E9',
        avatarInitials: 'SN',
        worldX: 0,
        worldY: 0,
        lastSeen: Date.now(),
        isLocal: true,
      },
    ];
  }

  public destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
    }
    this.broadcast?.close();
    if (this.supaChannel && supabaseClient) {
      void supabaseClient.removeChannel(this.supaChannel);
    }
    void this.idbProvider?.destroy();
    this.ydoc.destroy();
  }
}
