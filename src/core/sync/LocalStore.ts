import Dexie, { type Table } from 'dexie';
import type {
  AcademicDepartment,
  MindMapDocument,
  VisualStyleMode,
} from '../../types/mindmap';
import { globalStickerMemoryCache } from '../visuals/StickerMemoryCache';

export interface StoredStickerBlob {
  key: string;
  blob: Blob;
  aspectRatio: number;
  createdAt: number;
}

export interface SharedPoolStickerRecord {
  id: string;
  conceptTr: string;
  conceptEn: string;
  department: AcademicDepartment;
  mode: VisualStyleMode;
  dataUrl: string;
  embedding: number[];
  createdAt: number;
}

export interface WikiCrossLingualRecord {
  trKey: string;
  trTitle: string;
  enTitle: string;
  categories: string[];
  thumbnailUrl?: string;
  updatedAt: number;
}

export interface CachedSvgBodyRecord {
  iconId: string;
  svgMarkup: string;
  updatedAt: number;
}

export interface MapRecoverySnapshot {
  id: string;
  mapId: string;
  title: string;
  nodeCount: number;
  savedAt: number;
  serializedDoc: string;
}

export interface AppMetaRecord {
  key: string;
  value: string;
  updatedAt: number;
}

export interface ZihinBackupBundle {
  format: 'zihinharitam-backup-v4';
  exportedAt: number;
  maps: MindMapDocument[];
}

class MindMapDatabase extends Dexie {
  public maps!: Table<MindMapDocument, string>;
  public stickerBlobs!: Table<StoredStickerBlob, string>;
  public sharedStickers!: Table<SharedPoolStickerRecord, string>;
  public wikiCache!: Table<WikiCrossLingualRecord, string>;
  public svgCache!: Table<CachedSvgBodyRecord, string>;
  public recoverySnapshots!: Table<MapRecoverySnapshot, string>;
  public appMeta!: Table<AppMetaRecord, string>;

  constructor() {
    super('GorselZihinHaritasiDB');
    this.version(1).stores({
      maps: 'id, updatedAt, department, title',
      stickerBlobs: 'key, createdAt',
      sharedStickers: 'id, conceptTr, conceptEn, department, mode, createdAt',
    });
    this.version(2).stores({
      maps: 'id, updatedAt, department, title',
      stickerBlobs: 'key, createdAt',
      sharedStickers: 'id, conceptTr, conceptEn, department, mode, createdAt',
      wikiCache: 'trKey, updatedAt',
      svgCache: 'iconId, updatedAt',
    });
    this.version(3).stores({
      maps: 'id, updatedAt, department, title',
      stickerBlobs: 'key, createdAt',
      sharedStickers: 'id, conceptTr, conceptEn, department, mode, createdAt',
      wikiCache: 'trKey, updatedAt',
      svgCache: 'iconId, updatedAt',
    });
    // V4 Commercial Schema: Folder/Pin/Soft-Trash metadata + 5-Point Atomic Crash Recovery Snapshots
    this.version(4)
      .stores({
        maps: 'id, updatedAt, department, title, folder, deletedAt',
        stickerBlobs: 'key, createdAt',
        sharedStickers: 'id, conceptTr, conceptEn, department, mode, createdAt',
        wikiCache: 'trKey, updatedAt',
        svgCache: 'iconId, updatedAt',
        recoverySnapshots: 'id, mapId, savedAt',
        appMeta: 'key, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('maps')
          .toCollection()
          .modify((mapDoc: MindMapDocument) => {
            if (!mapDoc.folder) {
              mapDoc.folder =
                mapDoc.department === 'sistem_tasarimi' ||
                mapDoc.department === 'muhendislik'
                  ? 'engineering'
                  : 'study_exam';
            }
            if (mapDoc.isPinned === undefined) {
              mapDoc.isPinned = false;
            }
            if (mapDoc.deletedAt === undefined) {
              mapDoc.deletedAt = null;
            }
          });
      });
  }
}

export const db = new MindMapDatabase();

const lastSnapshotTimeByMap = new Map<string, number>();

async function recordAtomicRecoverySnapshot(doc: MindMapDocument): Promise<void> {
  const now = Date.now();
  const prevAt = lastSnapshotTimeByMap.get(doc.id) ?? 0;
  // Create a new recovery checkpoint at most every 25 seconds per map
  if (now - prevAt < 25_000) return;
  lastSnapshotTimeByMap.set(doc.id, now);

  try {
    const serializedDoc = JSON.stringify(doc);
    // Validate JSON round-trip integrity before writing recovery point
    JSON.parse(serializedDoc);

    const snap: MapRecoverySnapshot = {
      id: `snap_${doc.id}_${now}`,
      mapId: doc.id,
      title: doc.title,
      nodeCount: Object.keys(doc.nodes || {}).length,
      savedAt: now,
      serializedDoc,
    };

    await db.recoverySnapshots.put(snap);

    // Keep strictly the latest 5 recovery snapshots per map
    const allForMap = await db.recoverySnapshots
      .where('mapId')
      .equals(doc.id)
      .sortBy('savedAt');

    if (allForMap.length > 5) {
      const toDelete = allForMap.slice(0, allForMap.length - 5).map((s) => s.id);
      await db.recoverySnapshots.bulkDelete(toDelete);
    }
  } catch {
    // Non-fatal if IndexedDB quota is tight
  }
}

export const LocalStore = {
  async saveMap(
    doc: MindMapDocument,
    options?: { preserveUpdatedAt?: boolean; forceSnapshot?: boolean }
  ): Promise<void> {
    if (!doc || !doc.id || !doc.nodes || !doc.rootNodeId) return;

    const toSave: MindMapDocument = {
      ...doc,
      folder:
        doc.folder ??
        (doc.department === 'sistem_tasarimi' || doc.department === 'muhendislik'
          ? 'engineering'
          : 'study_exam'),
      isPinned: Boolean(doc.isPinned),
      deletedAt: doc.deletedAt ?? null,
      updatedAt: options?.preserveUpdatedAt ? doc.updatedAt : Date.now(),
    };

    await db.transaction('rw', db.maps, async () => {
      await db.maps.put(toSave);
    });

    if (options?.forceSnapshot) {
      lastSnapshotTimeByMap.delete(doc.id);
    }
    void recordAtomicRecoverySnapshot(toSave);
  },

  async getMap(id: string): Promise<MindMapDocument | undefined> {
    return db.maps.get(id);
  },

  async listMaps(): Promise<MindMapDocument[]> {
    return db.maps.orderBy('updatedAt').reverse().toArray();
  },

  async moveToTrash(id: string): Promise<void> {
    const existing = await db.maps.get(id);
    if (!existing) return;
    await db.maps.put({
      ...existing,
      deletedAt: Date.now(),
      isPinned: false,
    });
  },

  async restoreFromTrash(id: string): Promise<void> {
    const existing = await db.maps.get(id);
    if (!existing) return;
    await db.maps.put({
      ...existing,
      deletedAt: null,
      updatedAt: Date.now(),
    });
  },

  async deleteMapPermanently(id: string): Promise<void> {
    await db.transaction('rw', db.maps, db.recoverySnapshots, async () => {
      await db.maps.delete(id);
      const snaps = await db.recoverySnapshots.where('mapId').equals(id).primaryKeys();
      if (snaps.length > 0) {
        await db.recoverySnapshots.bulkDelete(snaps);
      }
    });
  },

  async deleteMap(id: string): Promise<void> {
    await this.deleteMapPermanently(id);
  },

  async purgeExpiredTrash(retentionDays = 30): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const all = await db.maps.toArray();
    const expiredIds = all
      .filter((m) => typeof m.deletedAt === 'number' && m.deletedAt < cutoff)
      .map((m) => m.id);
    for (const id of expiredIds) {
      await this.deleteMapPermanently(id);
    }
    return expiredIds.length;
  },

  async getRecoverySnapshots(mapId: string): Promise<MapRecoverySnapshot[]> {
    const list = await db.recoverySnapshots.where('mapId').equals(mapId).sortBy('savedAt');
    return list.reverse();
  },

  async exportWorkspaceBackupBundle(): Promise<ZihinBackupBundle> {
    const maps = await this.listMaps();
    return {
      format: 'zihinharitam-backup-v4',
      exportedAt: Date.now(),
      maps: maps.filter((m) => !m.deletedAt),
    };
  },

  parseZihinImportPayload(rawJson: string): MindMapDocument[] {
    const parsed = JSON.parse(rawJson) as
      | ZihinBackupBundle
      | MindMapDocument
      | MindMapDocument[];

    if (
      parsed &&
      typeof parsed === 'object' &&
      'format' in parsed &&
      Array.isArray(parsed.maps)
    ) {
      return parsed.maps.filter((m) => m && m.nodes && m.rootNodeId);
    }

    if (Array.isArray(parsed)) {
      return parsed.filter((m) => m && m.nodes && m.rootNodeId);
    }

    if (parsed && typeof parsed === 'object' && 'nodes' in parsed && 'rootNodeId' in parsed) {
      return [parsed as MindMapDocument];
    }

    return [];
  },

  async getCachedStickerUrl(
    key: string
  ): Promise<{ url: string; aspectRatio: number } | null> {
    const existingMemUrl = globalStickerMemoryCache.get(key);
    const record = await db.stickerBlobs.get(key);
    if (!record) return null;

    if (existingMemUrl) {
      return { url: existingMemUrl, aspectRatio: record.aspectRatio };
    }

    const url = URL.createObjectURL(record.blob);
    globalStickerMemoryCache.set(key, url);
    return { url, aspectRatio: record.aspectRatio };
  },

  async putCachedStickerBlob(
    key: string,
    blob: Blob,
    aspectRatio: number
  ): Promise<string> {
    await db.stickerBlobs.put({
      key,
      blob,
      aspectRatio,
      createdAt: Date.now(),
    });
    const url = URL.createObjectURL(blob);
    globalStickerMemoryCache.set(key, url);
    return url;
  },

  async saveSharedSticker(record: SharedPoolStickerRecord): Promise<void> {
    await db.sharedStickers.put(record);
  },

  async getAllSharedStickers(): Promise<SharedPoolStickerRecord[]> {
    return db.sharedStickers.toArray();
  },

  async getWikiRecord(trKey: string): Promise<WikiCrossLingualRecord | undefined> {
    return db.wikiCache.get(trKey);
  },

  async putWikiRecord(record: WikiCrossLingualRecord): Promise<void> {
    await db.wikiCache.put(record);
  },

  async getSvgMarkup(iconId: string): Promise<string | undefined> {
    const rec = await db.svgCache.get(iconId);
    return rec?.svgMarkup;
  },

  async putSvgMarkupsBatch(items: Array<{ iconId: string; svgMarkup: string }>): Promise<void> {
    const now = Date.now();
    await db.svgCache.bulkPut(
      items.map((i) => ({ iconId: i.iconId, svgMarkup: i.svgMarkup, updatedAt: now }))
    );
  },

  revokeAllObjectUrls(): void {
    globalStickerMemoryCache.clearAll();
  },
};
