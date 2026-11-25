import type {
  DisciplineProfile,
  GalleryCategoryFilter,
  VisualSearchResult,
  VisualStyleMode,
} from '../../types/mindmap';
import {
  buildDuotoneVectorStickerDataUri,
  wrapMultiColorSvgAsStickerDataUri,
} from './PureVectorStickerizer';
import {
  mapDisciplineToOfflineDomain,
  type ExpandedSemanticQueryV3,
} from './SemanticTaxonomyTR';
import {
  OfflineBM25Engine,
  type FastIndexV7Payload,
} from './offlineSearchCore.js';
import type {
  HydratedOfflineHit,
  WorkerSearchResponse,
  WorkerStatusMessage,
} from '../../workers/visualSearch.worker';

interface MainThreadShardRec {
  v: string;
  b: string;
  m: 0 | 1;
}

export interface OfflineEngineStatus {
  ready: boolean;
  totalIndexed: number;
}

const PACK_DISPLAY_NAMES: Record<string, string> = {
  'fluent-emoji-flat': 'Fluent Emoji (Offline)',
  'fluent-color': 'Fluent 3D Color (Offline)',
  'streamline-plump-color': 'Streamline Plump (Offline)',
  'streamline-ultimate-color': 'Streamline Bilim & Müh. (Offline)',
  'streamline-color': 'Streamline Renkli (Offline)',
  'streamline-cyber-color': 'Streamline Siber & Ağ (Offline)',
  'streamline-kameleon-color': 'Streamline Kameleon (Offline)',
  'streamline-emojis': 'Streamline Sticker (Offline)',
  emojione: 'EmojiOne Renkli (Offline)',
  noto: 'Google Noto (Offline)',
  fxemoji: 'Mozilla FxEmoji (Offline)',
  marketeq: 'Marketeq Renkli (Offline)',
  twemoji: 'Twemoji Renkli (Offline)',
  'icon-park': 'IconPark Renkli (Offline)',
  'flat-color-icons': 'Flat Color (Offline)',
  meteocons: 'Meteocons Doğa (Offline)',
  'circle-flags': 'Dünya Bayrakları (Offline)',
  'vscode-icons': 'VSCode Geliştirici (Offline)',
  logos: 'Teknoloji Logosu (Offline)',
  devicon: 'Devicon (Offline)',
  'skill-icons': 'Skill Icons (Offline)',
  healthicons: 'HealthIcons Tıp (Offline)',
  'medical-icon': 'Medical Atlas (Offline)',
  covid: 'Klinik Viroloji (Offline)',
  'energy-icons': 'Enerji & Mühendislik (Offline)',
  ix: 'Siemens Endüstri (Offline)',
  temaki: 'Altyapı & Mimarlık (Offline)',
  gis: 'Harita & Geomatik (Offline)',
  iconoir: 'Iconoir Teknik (Offline)',
  'game-icons': 'Ansiklopedik Vektör (Offline)',
  mdi: 'Material Design (Offline)',
  lucide: 'Lucide Modern (Offline)',
  'fa6-solid': 'FontAwesome (Offline)',
  ph: 'Phosphor Duotone (Offline)',
  carbon: 'IBM Carbon Mimarisi (Offline)',
  tabler: 'Tabler Teknik (Offline)',
};

function mapHitToCategoryAndMode(hit: HydratedOfflineHit): {
  category: Exclude<GalleryCategoryFilter, 'all'>;
  mode: VisualStyleMode;
} {
  if (
    hit.pack === 'fluent-color' ||
    hit.pack === 'fluent-emoji-flat' ||
    hit.pack === 'streamline-plump-color' ||
    hit.pack === 'streamline-ultimate-color' ||
    hit.pack === 'streamline-color' ||
    hit.pack === 'streamline-cyber-color' ||
    hit.pack === 'streamline-kameleon-color' ||
    hit.pack === 'marketeq' ||
    hit.pack === 'meteocons'
  ) {
    return { category: '3d_color', mode: '3d' };
  }
  if (
    hit.pack === 'fxemoji' ||
    hit.pack === 'noto' ||
    hit.pack === 'emojione' ||
    hit.pack === 'twemoji' ||
    hit.pack === 'streamline-emojis' ||
    hit.pack === 'flat-color-icons' ||
    hit.pack === 'circle-flags'
  ) {
    return { category: 'hand_drawn', mode: 'illustration' };
  }
  if (hit.pack === 'healthicons' || hit.pack === 'medical-icon' || hit.pack === 'covid') {
    return { category: 'medical_academic', mode: 'illustration' };
  }
  if (
    hit.pack === 'logos' ||
    hit.pack === 'devicon' ||
    hit.pack === 'skill-icons' ||
    hit.pack === 'vscode-icons' ||
    hit.pack === 'simple-icons' ||
    hit.pack === 'carbon' ||
    hit.pack === 'energy-icons' ||
    hit.pack === 'ix'
  ) {
    return {
      category: 'system_arch',
      mode: hit.pack === 'carbon' || hit.pack === 'energy-icons' || hit.pack === 'ix' ? 'diagram' : 'illustration',
    };
  }
  if (hit.domain === 'medicine_bio' || hit.domain === 'science') {
    return { category: 'medical_academic', mode: 'illustration' };
  }
  if (hit.domain === 'system_cs' || hit.domain === 'electronics') {
    return {
      category: 'system_arch',
      mode: hit.isMultiColor ? 'illustration' : 'diagram',
    };
  }
  return {
    category: hit.isMultiColor ? 'hand_drawn' : 'diagram',
    mode: hit.isMultiColor ? 'illustration' : 'diagram',
  };
}

class OfflineVisualSearchManager {
  private worker: Worker | null = null;
  private seqCounter = 0;
  private pending = new Map<
    number,
    {
      resolve: (res: WorkerSearchResponse) => void;
      reject: (err: Error) => void;
    }
  >();
  private status: OfflineEngineStatus = { ready: false, totalIndexed: 0 };
  private listeners = new Set<(s: OfflineEngineStatus) => void>();

  private prewarmScheduled = false;
  private workerFailureCount = 0;
  private visibilityBound = false;

  // Bulletproof In-Process Main-Thread Fallback Engine (auto-activates if iOS/Android OS kills the Web Worker!)
  private fallbackEngine: OfflineBM25Engine | null = null;
  private fallbackInitPromise: Promise<OfflineBM25Engine | null> | null = null;
  private fallbackShards = new Map<number, Record<string, MainThreadShardRec>>();

  private buildAssetUrl(relPath: string): string {
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    return `${cleanBase}${cleanRel}`;
  }

  private resetDeadWorker(reason: string): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Ignore terminate error
      }
      this.worker = null;
    }
    for (const [id, waiter] of this.pending.entries()) {
      this.pending.delete(id);
      waiter.reject(new Error(reason));
    }
  }

  private async ensureFallbackEngine(): Promise<OfflineBM25Engine | null> {
    if (this.fallbackEngine) return this.fallbackEngine;
    if (this.fallbackInitPromise) return this.fallbackInitPromise;
    this.fallbackInitPromise = (async () => {
      try {
        const res = await fetch(this.buildAssetUrl('offline-packs/fast-index-v8.json'));
        if (!res.ok) return null;
        const json = (await res.json()) as FastIndexV7Payload;
        const eng = new OfflineBM25Engine();
        eng.loadFastIndexV7(json);
        this.fallbackEngine = eng;
        const total = json.totalIcons || json.rows.length;
        this.status = { ready: true, totalIndexed: total };
        this.listeners.forEach((fn) => fn(this.status));
        return eng;
      } catch {
        this.fallbackInitPromise = null;
        return null;
      }
    })();
    return this.fallbackInitPromise;
  }

  private async fetchFallbackShard(shardId: number): Promise<Record<string, MainThreadShardRec>> {
    const cached = this.fallbackShards.get(shardId);
    if (cached) return cached;
    try {
      const padded = String(shardId).padStart(2, '0');
      const res = await fetch(this.buildAssetUrl(`offline-packs/shards/shard-${padded}.json?v=8`));
      if (!res.ok) return {};
      const data = (await res.json()) as Record<string, MainThreadShardRec>;
      if (this.fallbackShards.size >= 20) {
        const oldest = this.fallbackShards.keys().next().value;
        if (oldest !== undefined) this.fallbackShards.delete(oldest);
      }
      this.fallbackShards.set(shardId, data);
      return data;
    } catch {
      return {};
    }
  }

  private async searchViaMainThreadFallback(
    query: string,
    discipline: DisciplineProfile,
    activeOfflineDomain: ReturnType<typeof mapDisciplineToOfflineDomain>,
    limit: number
  ): Promise<WorkerSearchResponse | null> {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const eng = await this.ensureFallbackEngine();
    if (!eng) return null;
    const { hits, expanded } = eng.search(query, {
      discipline,
      activeOfflineDomain,
      limit: Math.min(limit || 64, 96),
    });
    const neededShards = Array.from(new Set(hits.map((h) => h.shardId)));
    await Promise.all(neededShards.map((sid) => this.fetchFallbackShard(sid)));
    const hydrated: HydratedOfflineHit[] = [];
    for (const hit of hits) {
      const shardObj = this.fallbackShards.get(hit.shardId);
      const rec = shardObj?.[hit.id];
      if (!rec || !rec.b) continue;
      hydrated.push({
        ...hit,
        isMultiColor: rec.m === 1,
        viewBox: rec.v,
        svgBody: rec.b,
      });
    }
    const elapsedMs = Number(
      (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)).toFixed(2)
    );
    return {
      type: 'SEARCH_RESULT',
      seqId: 0,
      totalIndexed: this.status.totalIndexed,
      elapsedMs,
      expanded,
      hits: hydrated,
    };
  }

  public prewarm(): void {
    if (this.worker || this.prewarmScheduled || typeof window === 'undefined') return;
    this.prewarmScheduled = true;
    const trigger = () => {
      this.init();
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(trigger, { timeout: 450 });
    } else {
      window.setTimeout(trigger, 220);
    }
  }

  public init(): void {
    if (typeof document !== 'undefined' && !this.visibilityBound) {
      this.visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.worker && this.workerFailureCount < 2) {
          this.init();
        }
      });
    }
    if (this.worker || typeof Worker === 'undefined' || this.workerFailureCount >= 2) return;
    try {
      this.worker = new Worker(
        new URL('../../workers/visualSearch.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onerror = () => {
        this.workerFailureCount++;
        this.resetDeadWorker('Offline search worker crashed');
        void this.ensureFallbackEngine();
      };

      this.worker.onmessageerror = () => {
        this.workerFailureCount++;
        this.resetDeadWorker('Offline search worker message error');
        void this.ensureFallbackEngine();
      };

      this.worker.onmessage = (
        ev: MessageEvent<WorkerSearchResponse | WorkerStatusMessage>
      ) => {
        const data = ev.data;
        if (!data) return;

        if (data.type === 'STATUS') {
          this.workerFailureCount = 0;
          this.status = { ready: data.ready, totalIndexed: data.totalIndexed };
          this.listeners.forEach((fn) => fn(this.status));
          return;
        }

        if (data.type === 'SEARCH_RESULT') {
          this.workerFailureCount = 0;
          if (data.totalIndexed > 0 && !this.status.ready) {
            this.status = { ready: true, totalIndexed: data.totalIndexed };
            this.listeners.forEach((fn) => fn(this.status));
          }
          const waiter = this.pending.get(data.seqId);
          if (waiter) {
            this.pending.delete(data.seqId);
            waiter.resolve(data);
          }
        }
      };

      this.worker.postMessage({
        type: 'INIT',
        baseUrl: import.meta.env.BASE_URL || '/',
      });
    } catch {
      this.workerFailureCount++;
      this.worker = null;
    }
  }

  public getStatus(): OfflineEngineStatus {
    this.init();
    return this.status;
  }

  public subscribeStatus(cb: (s: OfflineEngineStatus) => void): () => void {
    this.init();
    this.listeners.add(cb);
    cb(this.status);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public async searchShards(
    query: string,
    discipline: DisciplineProfile,
    branchColor: string,
    limit = 84
  ): Promise<{
    results: VisualSearchResult[];
    expanded: ExpandedSemanticQueryV3 | null;
    elapsedMs: number;
  }> {
    this.init();
    const activeOfflineDomain = mapDisciplineToOfflineDomain(discipline);

    let response: WorkerSearchResponse | null = null;
    if (this.worker && this.workerFailureCount < 2) {
      const seqId = ++this.seqCounter;
      response = await new Promise<WorkerSearchResponse>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.pending.delete(seqId);
          this.workerFailureCount++;
          this.resetDeadWorker('Offline search worker timeout');
          reject(new Error('Offline search worker timeout'));
        }, 1800);

        this.pending.set(seqId, {
          resolve: (r) => {
            clearTimeout(timeout);
            resolve(r);
          },
          reject: (e) => {
            clearTimeout(timeout);
            reject(e);
          },
        });

        try {
          this.worker!.postMessage({
            type: 'SEARCH',
            seqId,
            query,
            discipline,
            activeOfflineDomain,
            limit,
          });
        } catch (err) {
          clearTimeout(timeout);
          this.pending.delete(seqId);
          this.workerFailureCount++;
          this.resetDeadWorker('Worker postMessage failed');
          reject(err instanceof Error ? err : new Error('Worker postMessage failed'));
        }
      }).catch(() => null);
    }

    // Automatic zero-interruption fallback: if Worker was killed/suspended by mobile OS, serve from main-thread BM25 engine immediately!
    if (!response) {
      response = await this.searchViaMainThreadFallback(
        query,
        discipline,
        activeOfflineDomain,
        limit
      );
    }

    if (!response) {
      return { results: [], expanded: null, elapsedMs: 0 };
    }

    const results: VisualSearchResult[] = response.hits.map((hit) => {
      const previewUri = hit.isMultiColor
        ? wrapMultiColorSvgAsStickerDataUri(hit.viewBox, hit.svgBody)
        : buildDuotoneVectorStickerDataUri(hit.viewBox, hit.svgBody, branchColor);

      const { category, mode } = mapHitToCategoryAndMode(hit);
      const displayTitle = hit.name.replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        id: `off_${hit.id.replace(':', '_')}`,
        title: displayTitle,
        previewUrl: previewUri,
        rawUrl: previewUri,
        mode,
        category,
        source: 'library',
        needsDieCut: false,
        aspectRatio: 1,
        score: hit.normalizedScore,
        providerName: PACK_DISPLAY_NAMES[hit.pack] ?? `${hit.pack} (Offline)`,
        isDuotoneColorizable: !hit.isMultiColor,
        rawSvgMarkup: hit.svgBody,
        rawViewBox: hit.viewBox,
        iconifyId: hit.id,
        shardId: hit.shardId,
        isVectorSvg: true,
        tier: hit.tier ?? 'pro',
      };
    });

    return {
      results,
      expanded: response.expanded,
      elapsedMs: response.elapsedMs,
    };
  }
}

export const OfflineVisualSearchClient = new OfflineVisualSearchManager();
