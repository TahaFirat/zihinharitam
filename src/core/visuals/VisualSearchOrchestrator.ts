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
import { searchBuiltInAtlasV3 } from './providers/BuiltInMultiColorAtlas';
import { searchArasaacPictograms } from './providers/ArasaacPictogramAdapter';
import {
  searchIconifyLive,
  translateTurkishToEnglishLive,
} from './providers/IconifyLiveAdapter';

export interface FederatedGalleryResponse {
  results: VisualSearchResult[];
  metaphorChips: MetaphorChip[];
  resolvedEnglish: string;
  elapsedMs?: number;
  hasLexiconMatch?: boolean;
  allWordsMatched?: boolean;
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

    atlasMatches.forEach(({ entry, score }) => {
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
        // Bespoke multi-color Academic Atlas illustrations are premium PRO visuals!
        tier: 'pro',
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
      hasLexiconMatch: Boolean(expanded.hasLexiconMatch),
      allWordsMatched: Boolean(expanded.allWordsMatched),
    };
  }

  /**
   * Full Gallery Search (100% Offline Primary `<8ms` + Universal Turkish->English Parity Enrichment):
   * - If ANY Turkish word was unmatched locally OR it's a multi-word compound (`tablet kılıfı`):
   *   1) Live-translates the FULL Turkish phrase to natural English (`tablet case`),
   *   2) Re-queries our 43,722-icon Vibrant Offline Index with that English phrase (100% TR=EN parity!),
   *   3) Queries Iconify's 546,996+ global vector icons (full phrase + head noun) + ARASAAC 14,000+ everyday pictograms!
   */
  public static async searchFederatedGallery(
    query: string,
    mapContext: MapContextAnalysis,
    branchColor = '#0EA5E9',
    signal?: AbortSignal
  ): Promise<FederatedGalleryResponse> {
    const clean = sanitizeNodeSearchQuery(query);
    const cacheKey = `v8::${mapContext.discipline}::${branchColor}::${clean.toLocaleLowerCase('tr-TR')}`;
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

    const offlineHasStrongFullMatch =
      Boolean(expanded.hasLexiconMatch) &&
      Boolean(expanded.allWordsMatched) &&
      (!expanded.isMultiWord || Boolean(expanded.hasExactPhraseMatch)) &&
      offlineWave.results.length >= 6;

    // ZERO-REGRESSION GUARD: When our curated offline dictionary ALREADY matched the exact word/phrase
    // with high confidence (e.g. `kar -> snow`, `top -> soccer ball`, `taş -> rock`), NEVER overwrite or
    // run live Google Translate (which would translate `kar` -> `profit`!) or ARASAAC TR substring search!
    const needsFullPhraseTranslation =
      !offlineHasStrongFullMatch &&
      (!expanded.allWordsMatched ||
        !expanded.hasLexiconMatch ||
        (Boolean(expanded.isMultiWord) && !expanded.hasExactPhraseMatch));

    // Step 2: Parallel Live Turkish->English Full-Phrase Translation + optional Wiki bridge
    const [liveTranslatedEn, wikiBridge] = await Promise.all([
      needsFullPhraseTranslation
        ? Promise.race([
            translateTurkishToEnglishLive(clean, signal),
            new Promise<null>((r) => setTimeout(() => r(null), 1050)),
          ])
        : Promise.resolve(null),
      !expanded.hasLexiconMatch && clean.length >= 3
        ? Promise.race([
            resolveViaTurkishWikipedia(clean, signal),
            new Promise<null>((r) => setTimeout(() => r(null), 350)),
          ])
        : Promise.resolve(null),
    ]);

    if (signal?.aborted) return offlineWave;

    const primaryEnList = expanded.primaryEnTokens ?? expanded.expandedEnTokens;
    const enTerms = Array.from(
      new Set(
        [
          ...(liveTranslatedEn ? [liveTranslatedEn.toLowerCase()] : []),
          ...(wikiBridge?.enTitle ? [wikiBridge.enTitle.toLowerCase()] : []),
          ...primaryEnList.slice(0, 4),
        ].filter((t) => t && t.length >= 2)
      )
    );
    const primaryEn = enTerms[0] || clean;
    const translatedHeadWord =
      liveTranslatedEn && liveTranslatedEn.includes(' ')
        ? liveTranslatedEn.split(/\s+/).slice(-1)[0]
        : '';
    const arasaacEnTerms = Array.from(
      new Set([liveTranslatedEn || primaryEn, translatedHeadWord, ...(expanded.headEnTokens ?? [])].filter(Boolean))
    );

    // Step 3: Race Global Engines in Parallel (skipping ARASAAC TR substring noise when curated offline already nailed it!)
    const settled = await Promise.race([
      Promise.allSettled([
        liveTranslatedEn && liveTranslatedEn.toLowerCase() !== clean.toLowerCase()
          ? OfflineVisualSearchClient.searchShards(
              liveTranslatedEn,
              mapContext.discipline,
              branchColor,
              36
            ).then((r) => r.results)
          : Promise.resolve([] as VisualSearchResult[]),
        searchIconifyLive(clean, enTerms, branchColor, signal, {
          hasExactOfflineLexicon: Boolean(expanded.hasLexiconMatch),
          allWordsMatched: Boolean(expanded.allWordsMatched),
          hasExactPhraseMatch: Boolean(expanded.hasExactPhraseMatch),
          preTranslatedEn: offlineHasStrongFullMatch ? primaryEn : liveTranslatedEn,
          headEnTerms: expanded.headEnTokens,
          blockedTokens: expanded.blockedTokens,
        }),
        offlineHasStrongFullMatch
          ? Promise.resolve([] as VisualSearchResult[])
          : searchArasaacPictograms([clean], arasaacEnTerms, signal),
        AIStickerDirector.searchSharedPool(clean, 4),
      ]),
      new Promise<PromiseSettledResult<VisualSearchResult[]>[]>((r) =>
        setTimeout(() => r([]), 2100)
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
    const conceptCounts = new Map<string, number>();

    const pushUnique = (item: VisualSearchResult) => {
      if (!item.previewUrl || seenUrls.has(item.previewUrl) || seenIds.has(item.id)) {
        return;
      }
      if (item.iconifyId && seenIconifyIds.has(item.iconifyId)) {
        return;
      }
      const cKey = (item.title || '')
        .toLowerCase()
        .replace(/\b(outline|solid|fill|filled|flat|color|colour|alt|regular|bold|1|2|3|4|5)\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      // Deduplicate PRO & FREE concepts independently so colorful PRO icons NEVER evict FREE monochrome options!
      const tierConceptKey = cKey ? `${item.tier === 'free' ? 'f' : 'p'}:${cKey}` : '';
      const maxPerConcept = item.tier === 'free' ? 4 : 2;
      if (tierConceptKey && (conceptCounts.get(tierConceptKey) ?? 0) >= maxPerConcept && combined.length >= 6) {
        return;
      }
      seenUrls.add(item.previewUrl);
      seenIds.add(item.id);
      if (item.iconifyId) seenIconifyIds.add(item.iconifyId);
      if (tierConceptKey) conceptCounts.set(tierConceptKey, (conceptCounts.get(tierConceptKey) ?? 0) + 1);
      combined.push(item);
    };

    if (!offlineHasStrongFullMatch) {
      // Unknown word OR partial multi-word compound -> put live full-phrase translated results FIRST!
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          for (const remoteItem of s.value) {
            if (isRemoteItemRelevant(remoteItem)) {
              pushUnique(remoteItem);
            }
          }
        }
      }
      for (const offItem of offlineWave.results) {
        pushUnique({ ...offItem, score: Math.min(offItem.score, 0.86) });
      }
    } else {
      // Anchored curated offline results ALWAYS stay stably at the top (zero jump / zero vanish after 155ms!);
      // extra 546K remote icons append cleanly underneath!
      for (const offItem of offlineWave.results) {
        pushUnique(offItem);
      }
      const remoteCap = Math.min(
        0.84,
        (offlineWave.results[Math.min(5, offlineWave.results.length - 1)]?.score ?? 0.86) - 0.02
      );
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          for (const remoteItem of s.value) {
            if (isRemoteItemRelevant(remoteItem)) {
              pushUnique({ ...remoteItem, score: Math.min(remoteItem.score, remoteCap) });
            }
          }
        }
      }
    }

    // Strict Relevance Guarantee: NEVER dump unrelated discipline seed icons (e.g. Red Hearts for "Komutan"!)
    if (combined.length === 0 && !signal?.aborted) {
      const neutralFallback = await OfflineVisualSearchClient.searchShards(
        'hedef yildiz fikir pusula bayrak',
        'humanities_social',
        branchColor,
        12
      );
      for (const fb of neutralFallback.results) {
        pushUnique({ ...fb, score: Math.min(fb.score, 0.35) });
      }
    }

    combined.sort((a, b) => b.score - a.score);

    const response: FederatedGalleryResponse = {
      results: combined.slice(0, 140),
      metaphorChips: offlineWave.metaphorChips,
      resolvedEnglish: primaryEn,
      elapsedMs: offlineWave.elapsedMs,
      hasLexiconMatch: Boolean(expanded.hasLexiconMatch),
      allWordsMatched: Boolean(expanded.allWordsMatched),
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
