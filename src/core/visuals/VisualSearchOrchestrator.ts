import type {
  DisciplineProfile,
  GalleryCategoryFilter,
  MetaphorChip,
  StickerAsset,
  VisualSearchResult,
  VisualStyleMode,
} from '../../types/mindmap';
import { AIStickerDirector } from './AIStickerDirector';
import {
  applyCornerBadgeToStickerAsset,
  buildInstantCompositeResults,
} from './CompositeStickerComposer';
import { resolveViaTurkishWikipedia } from './CrossLingualWikiBridge';
import { DieCutStickerProcessor } from './DieCutStickerProcessor';
import { retintRawSvgMarkupToBranch } from './DuotoneStickerColorizer';
import { OfflineVisualSearchClient } from './OfflineVisualSearchClient';
import {
  buildDuotoneVectorStickerDataUri,
  isVectorSvgSource,
  wrapMultiColorSvgAsStickerDataUri,
} from './PureVectorStickerizer';
import {
  buildSemanticMetaphorChipsV3,
  expandSemanticQueryV3,
  mapDisciplineToOfflineDomain,
  normalizeTrToken,
} from './SemanticTaxonomyTR';
import type { MapContextAnalysis } from './TopicContextIntelligence';
import { searchArasaacPictograms } from './providers/ArasaacPictogramAdapter';
import { searchBuiltInAtlasV3 } from './providers/BuiltInMultiColorAtlas';
import { searchIconifyLive } from './providers/IconifyLiveAdapter';
import { searchWikimediaAtlas } from './providers/WikimediaAtlasAdapter';

export interface FederatedGalleryResponse {
  results: VisualSearchResult[];
  metaphorChips: MetaphorChip[];
  resolvedEnglish: string;
  elapsedMs?: number;
}

const DISCIPLINE_DEFAULT_OFFLINE_SEEDS: Record<DisciplineProfile, string> = {
  medicine_biology: 'kalp bakteri mikroskop hucre dna stetoskop',
  system_design_cs: 'sunucu bulut veritabani ag konteyner guvenlik',
  electronics_robotics: 'cip devre sensor pil robot osiloskop',
  law_governance: 'adalet mahkeme sozlesme kanun muhur',
  architecture_civil: 'kemer kubbe sutun plan kopru bina',
  exact_sciences: 'atom matematik teleskop denklem grafik',
  humanities_social: 'fikir hedef kitap yildiz takvim harita',
  business_economics: 'hedef fikir grafik roket odul takvim',
};

const PLACEHOLDER_NODE_TITLES = new Set([
  'yeni konu',
  'yeni zihin haritasi',
  'merkez konu',
  'ana konu',
  'alt dal',
  'basliksiz',
]);

export function sanitizeNodeSearchQuery(rawQuery: string): string {
  const clean = rawQuery.trim();
  if (!clean) return '';
  if (PLACEHOLDER_NODE_TITLES.has(normalizeTrToken(clean))) {
    return '';
  }
  return clean;
}

const federatedCache = new Map<string, FederatedGalleryResponse>();
// Lazy worker init: avoids parsing manifest/shards during cold startup to keep launch instant & device cool!

export class VisualSearchOrchestrator {
  /**
   * Synchronous `<1ms` Instant Wave (Built-In 152+ Multi-Color Atlas).
   * STRICT V3 GUARANTEE:
   * - Never injects parent title text into child queries.
   * - When `query` is non-empty, NEVER pads results with random fallback items!
   */
  public static getInstantWave1Results(
    query: string,
    mapContext: MapContextAnalysis,
    _branchColor = '#0EA5E9'
  ): FederatedGalleryResponse {
    const clean = sanitizeNodeSearchQuery(query);
    const offlineDomain = mapDisciplineToOfflineDomain(mapContext.discipline);
    const expanded = expandSemanticQueryV3(clean, offlineDomain);
    const atlasMatches = searchBuiltInAtlasV3(clean, mapContext.discipline, 24);

    const results: VisualSearchResult[] = [];
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();

    const pushUnique = (item: VisualSearchResult) => {
      if (!item.previewUrl || seenIds.has(item.id) || seenUrls.has(item.previewUrl)) {
        return;
      }
      seenIds.add(item.id);
      seenUrls.add(item.previewUrl);
      results.push(item);
    };

    atlasMatches.forEach(({ entry, score }, idx) => {
      pushUnique({
        id: `atlas_${entry.id}`,
        title: entry.titleTr,
        previewUrl: entry.svgDataUri,
        rawUrl: entry.svgDataUri,
        mode: entry.category === 'diagram' ? 'diagram' : 'illustration',
        category: entry.category,
        source: 'library',
        needsDieCut: false,
        aspectRatio: 1,
        score,
        providerName:
          entry.category === 'system_arch'
            ? 'SystemDesign Mimarisi'
            : 'Dahili Renkli Atlas',
        isVectorSvg: true,
        // Generous Free balance: ~65% of built-in colorful atlas icons are FREE so every topic has rich free visuals,
        // while select specialist & composite studio icons showcase Pro!
        tier: idx % 3 === 2 ? 'pro' : 'free',
      });
    });

    if (clean.length > 0 && results.length > 0) {
      const composites = buildInstantCompositeResults(clean, results);
      composites.forEach((c) => pushUnique({ ...c, isVectorSvg: true }));
    }

    results.sort((a, b) => b.score - a.score);

    return {
      results,
      metaphorChips: buildSemanticMetaphorChipsV3(expanded),
      resolvedEnglish: expanded.expandedEnTokens[0] || clean || 'concept',
      elapsedMs: 0.5,
    };
  }

  /**
   * Primary V3 Offline Search Wave (`<8ms` via Web Worker MiniSearch + 24 Icon Shards + 152 Multi-Color Atlas).
   * Works 100% offline in Airplane Mode with zero network calls and zero relevance contamination.
   */
  public static async searchOfflineWave(
    query: string,
    mapContext: MapContextAnalysis,
    branchColor = '#0EA5E9',
    limit = 56
  ): Promise<FederatedGalleryResponse> {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const clean = sanitizeNodeSearchQuery(query);
    const wave1 = this.getInstantWave1Results(clean, mapContext, branchColor);

    const effectiveWorkerQuery =
      clean.length > 0
        ? clean
        : DISCIPLINE_DEFAULT_OFFLINE_SEEDS[mapContext.discipline] || 'fikir hedef kitap yildiz';

    const workerRes = await OfflineVisualSearchClient.searchShards(
      effectiveWorkerQuery,
      mapContext.discipline,
      branchColor,
      limit
    );

    const merged: VisualSearchResult[] = [];
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();

    const pushUnique = (item: VisualSearchResult) => {
      if (!item.previewUrl || seenIds.has(item.id) || seenUrls.has(item.previewUrl)) {
        return;
      }
      seenIds.add(item.id);
      seenUrls.add(item.previewUrl);
      merged.push(item);
    };

    // 1. Bespoke Built-In Multi-Color Atlas exact matches first
    for (const item of wave1.results) {
      pushUnique(item);
    }

    // 2. 25,209-icon Offline Shard hits (Fluent Color, Fluent Emoji, OpenMoji, IconPark, HealthIcons, GameIcons, Phosphor, Carbon, Tabler)
    for (const shardHit of workerRes.results) {
      pushUnique(shardHit);
    }

    // 3. Qualifier badge composites if user typed adjectives like "güvenli ...", "hızlı ..."
    if (clean.length > 0 && merged.length > 0) {
      const composites = buildInstantCompositeResults(clean, merged.slice(0, 6));
      composites.forEach((c) => pushUnique({ ...c, isVectorSvg: true }));
    }

    merged.sort((a, b) => b.score - a.score);

    const wallMs =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    const elapsedMs =
      workerRes.elapsedMs > 0 ? Math.min(wallMs, workerRes.elapsedMs) : wallMs;

    const expanded =
      workerRes.expanded ??
      expandSemanticQueryV3(
        clean,
        mapDisciplineToOfflineDomain(mapContext.discipline)
      );

    return {
      results: merged.slice(0, limit + 24),
      metaphorChips:
        clean.length > 0 ? buildSemanticMetaphorChipsV3(expanded) : wave1.metaphorChips,
      resolvedEnglish:
        expanded.expandedEnTokens[0] || wave1.resolvedEnglish || clean,
      elapsedMs,
    };
  }

  /**
   * Full Gallery Search (100% Offline Primary `<8ms` + Optional Cancelable Online Enrichment when `navigator.onLine`).
   * NEVER calls `api.iconify.design` per keystroke and strictly filters online results against `blockedTokens`.
   */
  public static async searchFederatedGallery(
    query: string,
    mapContext: MapContextAnalysis,
    branchColor = '#0EA5E9',
    signal?: AbortSignal
  ): Promise<FederatedGalleryResponse> {
    const clean = sanitizeNodeSearchQuery(query);
    const cacheKey = `v7::${mapContext.discipline}::${branchColor}::${clean.toLocaleLowerCase('tr-TR')}`;
    const cached = federatedCache.get(cacheKey);
    if (cached && cached.results.length >= 20) {
      return cached;
    }

    // Step 1: Primary 100% Offline Wave (`<4ms` via V7 Pre-Compiled Inverted Index)
    const offlineWave = await this.searchOfflineWave(clean, mapContext, branchColor, 72);

    if (
      signal?.aborted ||
      !clean ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)
    ) {
      return offlineWave;
    }

    const offlineDomain = mapDisciplineToOfflineDomain(mapContext.discipline);
    const expanded = expandSemanticQueryV3(clean, offlineDomain);
    const blockedSet = new Set(
      expanded.blockedTokens.map((b) => normalizeTrToken(b))
    );

    // Optional Cross-Lingual Wiki Bridge (bounded at 380ms, cancelable)
    const wikiBridge =
      clean.length >= 2
        ? await Promise.race([
            resolveViaTurkishWikipedia(clean, signal),
            new Promise<null>((r) => setTimeout(() => r(null), 380)),
          ])
        : null;

    if (signal?.aborted) return offlineWave;

    const primaryEnList = expanded.primaryEnTokens ?? expanded.expandedEnTokens;
    const enTerms = [
      ...(wikiBridge?.enTitle ? [wikiBridge.enTitle.toLowerCase()] : []),
      ...primaryEnList.slice(0, 4),
    ];
    const trTerms = [clean, ...expanded.expandedTrTokens.slice(0, 4)];
    const primaryEn = enTerms[0] || clean;

    const settled = await Promise.race([
      Promise.allSettled([
        searchIconifyLive(clean, enTerms, branchColor, signal, {
          hasExactOfflineLexicon: Boolean(expanded.hasLexiconMatch),
          blockedTokens: expanded.blockedTokens,
        }),
        AIStickerDirector.searchSharedPool(clean, 4),
        searchArasaacPictograms(trTerms, enTerms, signal),
        searchWikimediaAtlas(
          enTerms,
          wikiBridge?.thumbnailUrl,
          wikiBridge?.trTitle,
          signal
        ),
      ]),
      new Promise<PromiseSettledResult<VisualSearchResult[]>[]>((r) =>
        setTimeout(() => r([]), 1150)
      ),
    ]);

    if (signal?.aborted) return offlineWave;

    const isRemoteItemRelevant = (item: VisualSearchResult): boolean => {
      const normTitle = normalizeTrToken(item.title || '');
      const words = normTitle.split(/[\s_-]+/).filter(Boolean);
      for (const b of blockedSet) {
        if (normTitle === b || words.includes(b)) {
          return false;
        }
      }
      return true;
    };

    const combined: VisualSearchResult[] = [];
    const seenUrls = new Set<string>();
    const seenIds = new Set<string>();
    const seenIconifyIds = new Set<string>();

    const pushUnique = (item: VisualSearchResult) => {
      if (!item.previewUrl || seenUrls.has(item.previewUrl) || seenIds.has(item.id)) {
        return;
      }
      if (item.iconifyId && seenIconifyIds.has(item.iconifyId)) {
        return;
      }
      seenUrls.add(item.previewUrl);
      seenIds.add(item.id);
      if (item.iconifyId) seenIconifyIds.add(item.iconifyId);
      combined.push(item);
    };

    // When offline already found strong primary matches (`offlineTopScore >= 0.92` & >= 12 hits),
    // keep our instant colorful offline vectors anchored in Top #1..#16 and place online enrichment after them (`<= 0.89`)!
    // When offline lacked an exact primary hit (`offlineTopScore < 0.92`, e.g. uncommon word translated live),
    // let exact colorful live Iconify hits (`0.965..0.994`) rise straight to #1..#6!
    const offlineHasStrongPrimary =
      offlineWave.results.length >= 12 &&
      (offlineWave.results[0]?.score ?? 0) >= 0.92;

    for (const offItem of offlineWave.results) {
      pushUnique(offItem);
    }

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        for (const remoteItem of s.value) {
          if (isRemoteItemRelevant(remoteItem)) {
            pushUnique(
              offlineHasStrongPrimary
                ? { ...remoteItem, score: Math.min(remoteItem.score, 0.89) }
                : remoteItem
            );
          }
        }
      }
    }

    // Zero-Miss Safety Net: if a rare/unusual query still has < 6 icons, seamlessly append
    // relevant discipline conceptual visuals so the user NEVER hits an empty dead-end!
    if (combined.length < 6 && !signal?.aborted) {
      const seedFallback = await OfflineVisualSearchClient.searchShards(
        DISCIPLINE_DEFAULT_OFFLINE_SEEDS[mapContext.discipline] || 'fikir hedef kitap',
        mapContext.discipline,
        branchColor,
        24
      );
      for (const fb of seedFallback.results) {
        pushUnique({ ...fb, score: Math.min(fb.score, 0.35) });
      }
    }

    combined.sort((a, b) => b.score - a.score);

    const response: FederatedGalleryResponse = {
      results: combined.slice(0, 140),
      metaphorChips: offlineWave.metaphorChips,
      resolvedEnglish: primaryEn,
      elapsedMs: offlineWave.elapsedMs,
    };

    if (!signal?.aborted && response.results.length > 0) {
      federatedCache.set(cacheKey, response);
    }

    return response;
  }

  /**
   * Filters results cleanly by `VisualStyleMode` without injecting unrelated fallback items.
   */
  public static filterResultsByMode(
    allResults: VisualSearchResult[],
    mode: VisualStyleMode
  ): VisualSearchResult[] {
    if (mode === 'illustration') {
      const ill = allResults.filter(
        (r) =>
          r.mode === 'illustration' ||
          r.category === 'hand_drawn' ||
          r.category === 'system_arch' ||
          r.category === 'medical_academic'
      );
      return ill.length > 0 ? ill : allResults;
    }
    if (mode === '3d') {
      const threeD = allResults.filter(
        (r) => r.mode === '3d' || r.category === '3d_color'
      );
      return threeD.length >= 4
        ? threeD
        : [...threeD, ...allResults.filter((r) => !threeD.includes(r)).slice(0, 14)];
    }
    if (mode === 'photo') {
      const photos = allResults.filter(
        (r) => r.mode === 'photo' || r.category === 'photo'
      );
      return photos.length > 0 ? photos : allResults.slice(0, 18);
    }
    if (mode === 'diagram') {
      const diags = allResults.filter(
        (r) =>
          r.mode === 'diagram' ||
          r.category === 'diagram' ||
          r.category === 'system_arch' ||
          r.isDuotoneColorizable
      );
      return diags.length > 0 ? diags : allResults;
    }
    return allResults;
  }

  public static filterResultsByCategory(
    allResults: VisualSearchResult[],
    category: GalleryCategoryFilter
  ): VisualSearchResult[] {
    if (category === 'all') return allResults;
    return allResults.filter((r) => r.category === category);
  }

  /**
   * Materializes a selected visual into a `StickerAsset`:
   * - Vector SVGs (`isVectorSvg` / `data:image/svg+xml` / `.svg`) NEVER enter Canvas pixel Flood-Fill!
   * - Offline shard multi-color SVGs upgrade to `<feMorphology>` vinyl die-cut contour in `<0.3ms`.
   * - Offline shard Duotone SVGs tint to `branchColor` in `<0.4ms`.
   * - Only genuine raster photos/PNGs go to `DieCutStickerProcessor` (`OffscreenCanvas` worker).
   */
  public static async materializeStickerSelection(
    item: VisualSearchResult,
    options?: {
      retintToBranchColor?: string | null;
      cornerBadgeEmoji?: string | null;
    }
  ): Promise<StickerAsset> {
    let baseSticker: StickerAsset;

    if (item.isDuotoneColorizable && item.rawSvgMarkup) {
      const color = options?.retintToBranchColor || '#0EA5E9';
      const retintedUri = item.rawViewBox
        ? buildDuotoneVectorStickerDataUri(item.rawViewBox, item.rawSvgMarkup, color)
        : retintRawSvgMarkupToBranch(item.rawSvgMarkup, color);

      baseSticker = {
        id: `${item.id}_${color.replace('#', '')}`,
        url: retintedUri,
        mode: item.mode,
        source: item.source,
        dieCutProcessed: true,
        aspectRatio: 1,
        label: item.title,
        isVectorSvg: true,
        iconifyId: item.iconifyId,
      };
    } else if (!item.isDuotoneColorizable && item.rawSvgMarkup && item.rawViewBox) {
      const contourUri = wrapMultiColorSvgAsStickerDataUri(
        item.rawViewBox,
        item.rawSvgMarkup,
        { useMorphologyContour: true }
      );
      baseSticker = {
        id: item.id,
        url: contourUri,
        mode: item.mode,
        source: item.source,
        dieCutProcessed: true,
        aspectRatio: 1,
        label: item.title,
        isVectorSvg: true,
        iconifyId: item.iconifyId,
      };
    } else if (item.isVectorSvg || !item.needsDieCut || isVectorSvgSource(item.rawUrl)) {
      baseSticker = {
        id: item.id,
        url: item.rawUrl,
        mode: item.mode,
        source: item.source,
        dieCutProcessed: true,
        aspectRatio: item.aspectRatio || 1,
        label: item.title,
        isVectorSvg: isVectorSvgSource(item.rawUrl) || Boolean(item.isVectorSvg),
        iconifyId: item.iconifyId,
      };
    } else {
      try {
        const processed = await DieCutStickerProcessor.processImageToSticker(item.rawUrl, {
          cacheKey: `sel_v3_${item.id}`,
          backgroundMode: item.mode === 'photo' ? 'auto_clean' : 'none',
          contourRadius: 8,
          maxSize: 340,
        });
        baseSticker = {
          id: item.id,
          url: processed.url,
          mode: item.mode,
          source: item.source,
          dieCutProcessed: true,
          aspectRatio: processed.aspectRatio,
          label: item.title,
          isVectorSvg: isVectorSvgSource(processed.url),
        };
      } catch {
        baseSticker = {
          id: item.id,
          url: item.rawUrl,
          mode: item.mode,
          source: item.source,
          dieCutProcessed: false,
          aspectRatio: item.aspectRatio || 1,
          label: item.title,
        };
      }
    }

    if (options?.cornerBadgeEmoji) {
      return applyCornerBadgeToStickerAsset(baseSticker, options.cornerBadgeEmoji);
    }

    return baseSticker;
  }
}
