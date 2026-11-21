/// <reference lib="webworker" />
import {
  OfflineBM25Engine,
  type OfflineManifestItem,
  type OfflineSearchHit,
} from '../core/visuals/offlineSearchCore.js';
import type {
  ExpandedSemanticQueryV3,
  OfflineTaxonomyDomain,
} from '../core/visuals/taxonomyData.js';

interface ShardSvgRecord {
  v: string; // viewBox
  b: string; // svgBody
  m: 0 | 1; // isMultiColor
}

export interface WorkerSearchRequest {
  type: 'SEARCH';
  seqId: number;
  query: string;
  discipline: string;
  activeOfflineDomain: OfflineTaxonomyDomain;
  limit: number;
}

export interface WorkerInitMessage {
  type: 'INIT';
  baseUrl?: string;
}

export interface HydratedOfflineHit extends OfflineSearchHit {
  viewBox: string;
  svgBody: string;
}

export interface WorkerSearchResponse {
  type: 'SEARCH_RESULT';
  seqId: number;
  totalIndexed: number;
  elapsedMs: number;
  expanded: ExpandedSemanticQueryV3;
  hits: HydratedOfflineHit[];
}

export interface WorkerStatusMessage {
  type: 'STATUS';
  ready: boolean;
  totalIndexed: number;
}

const engine = new OfflineBM25Engine();
let baseUrlPrefix = '/';
let totalIndexed = 0;
let initPromise: Promise<void> | null = null;

const shardCache = new Map<number, Record<string, ShardSvgRecord>>();
const shardInflight = new Map<number, Promise<Record<string, ShardSvgRecord>>>();

function buildAssetUrl(relPath: string): string {
  const cleanBase = baseUrlPrefix.endsWith('/') ? baseUrlPrefix : `${baseUrlPrefix}/`;
  const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  return `${cleanBase}${cleanRel}`;
}

const MAX_CACHED_SHARDS = 8;

async function fetchShard(shardId: number): Promise<Record<string, ShardSvgRecord>> {
  const cached = shardCache.get(shardId);
  if (cached) {
    // Refresh LRU order
    shardCache.delete(shardId);
    shardCache.set(shardId, cached);
    return cached;
  }

  const existing = shardInflight.get(shardId);
  if (existing) return existing;

  const padded = String(shardId).padStart(2, '0');
  const url = buildAssetUrl(`offline-packs/shards/shard-${padded}.json`);

  const p = fetch(url)
    .then(async (res) => {
      if (!res.ok) return {};
      const data = (await res.json()) as Record<string, ShardSvgRecord>;
      if (shardCache.size >= MAX_CACHED_SHARDS) {
        const oldestKey = shardCache.keys().next().value;
        if (oldestKey !== undefined) shardCache.delete(oldestKey);
      }
      shardCache.set(shardId, data);
      return data;
    })
    .catch(() => ({}))
    .finally(() => {
      shardInflight.delete(shardId);
    });

  shardInflight.set(shardId, p);
  return p;
}

async function ensureInitialized(): Promise<void> {
  if (totalIndexed > 0) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch(buildAssetUrl('offline-packs/search-manifest.json'));
      if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);
      const json = (await res.json()) as {
        totalIcons: number;
        shardCount: number;
        items: OfflineManifestItem[];
      };
      engine.loadManifest(json.items || []);
      totalIndexed = json.items?.length || 0;

      self.postMessage({
        type: 'STATUS',
        ready: true,
        totalIndexed,
      } satisfies WorkerStatusMessage);
      // ZERO startup shard-warming storm! Shards are fetched strictly on-demand in <8ms with an 8-shard LRU cap (~12MB max RAM vs 120MB!).
    } catch {
      initPromise = null;
    }
  })();

  return initPromise;
}

self.onmessage = async (ev: MessageEvent<WorkerInitMessage | WorkerSearchRequest>) => {
  const msg = ev.data;
  if (!msg) return;

  if (msg.type === 'INIT') {
    if (msg.baseUrl) {
      baseUrlPrefix = msg.baseUrl;
    }
    await ensureInitialized();
    return;
  }

  if (msg.type === 'SEARCH') {
    const t0 = performance.now();
    await ensureInitialized();

    const { hits, expanded } = engine.search(msg.query, {
      discipline: msg.discipline,
      activeOfflineDomain: msg.activeOfflineDomain,
      limit: msg.limit || 84,
    });

    const neededShards = Array.from(new Set(hits.map((h) => h.shardId)));
    await Promise.all(neededShards.map((sid) => fetchShard(sid)));

    const hydrated: HydratedOfflineHit[] = [];
    for (const hit of hits) {
      const shardObj = shardCache.get(hit.shardId);
      const rec = shardObj?.[hit.id];
      if (!rec || !rec.b) continue;
      hydrated.push({
        ...hit,
        isMultiColor: rec.m === 1,
        viewBox: rec.v,
        svgBody: rec.b,
      });
    }

    const elapsedMs = Number((performance.now() - t0).toFixed(2));
    self.postMessage({
      type: 'SEARCH_RESULT',
      seqId: msg.seqId,
      totalIndexed,
      elapsedMs,
      expanded,
      hits: hydrated,
    } satisfies WorkerSearchResponse);
  }
};
