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
import type {
  HydratedOfflineHit,
  WorkerSearchResponse,
  WorkerStatusMessage,
} from '../../workers/visualSearch.worker';

export interface OfflineEngineStatus {
  ready: boolean;
  totalIndexed: number;
}

const PACK_DISPLAY_NAMES: Record<string, string> = {
  'fluent-emoji-flat': 'Fluent Emoji (Offline)',
  'fluent-color': 'Fluent 3D Color (Offline)',
  'streamline-color': 'Streamline Renkli (Offline)',
  'streamline-emojis': 'Streamline Sticker (Offline)',
  twemoji: 'Twemoji Renkli (Offline)',
  openmoji: 'OpenMoji El Çizimi (Offline)',
  'icon-park': 'IconPark Renkli (Offline)',
  'flat-color-icons': 'Flat Color (Offline)',
  meteocons: 'Meteocons Doğa (Offline)',
  'circle-flags': 'Dünya Bayrakları (Offline)',
  'vscode-icons': 'VSCode Geliştirici (Offline)',
  logos: 'Teknoloji Logosu (Offline)',
  devicon: 'Devicon (Offline)',
  'skill-icons': 'Skill Icons (Offline)',
  'simple-icons': 'Marka & Uygulama (Offline)',
  healthicons: 'HealthIcons Tıp (Offline)',
  'medical-icon': 'Medical Atlas (Offline)',
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
    hit.pack === 'streamline-color' ||
    hit.pack === 'meteocons'
  ) {
    return { category: '3d_color', mode: '3d' };
  }
  if (
    hit.pack === 'openmoji' ||
    hit.pack === 'twemoji' ||
    hit.pack === 'streamline-emojis' ||
    hit.pack === 'circle-flags'
  ) {
    return { category: 'hand_drawn', mode: 'illustration' };
  }
  if (hit.pack === 'healthicons' || hit.pack === 'medical-icon') {
    return { category: 'medical_academic', mode: 'illustration' };
  }
  if (
    hit.pack === 'logos' ||
    hit.pack === 'devicon' ||
    hit.pack === 'skill-icons' ||
    hit.pack === 'vscode-icons' ||
    hit.pack === 'simple-icons' ||
    hit.pack === 'carbon'
  ) {
    return {
      category: 'system_arch',
      mode: hit.pack === 'carbon' ? 'diagram' : 'illustration',
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
    if (this.worker || typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(
        new URL('../../workers/visualSearch.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (
        ev: MessageEvent<WorkerSearchResponse | WorkerStatusMessage>
      ) => {
        const data = ev.data;
        if (!data) return;

        if (data.type === 'STATUS') {
          this.status = { ready: data.ready, totalIndexed: data.totalIndexed };
          this.listeners.forEach((fn) => fn(this.status));
          return;
        }

        if (data.type === 'SEARCH_RESULT') {
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
    if (!this.worker) {
      return { results: [], expanded: null, elapsedMs: 0 };
    }

    const seqId = ++this.seqCounter;
    const activeOfflineDomain = mapDisciplineToOfflineDomain(discipline);

    const response = await new Promise<WorkerSearchResponse>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(seqId);
        reject(new Error('Offline search worker timeout'));
      }, 2500);

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

      this.worker!.postMessage({
        type: 'SEARCH',
        seqId,
        query,
        discipline,
        activeOfflineDomain,
        limit,
      });
    }).catch(() => null);

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
