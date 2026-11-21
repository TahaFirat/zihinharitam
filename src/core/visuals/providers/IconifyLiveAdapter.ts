import type {
  GalleryCategoryFilter,
  VisualSearchResult,
  VisualStyleMode,
} from '../../../types/mindmap';

const ICONIFY_API = 'https://api.iconify.design';

const LIVE_COLORFUL_SETS = new Set([
  'fluent-emoji-flat',
  'fluent-color',
  'noto',
  'twemoji',
  'streamline-color',
  'streamline-emojis',
  'streamline-plump-color',
  'streamline-freehand-color',
  'streamline-flex-color',
  'streamline-ultimate-color',
  'streamline-kameleon-color',
  'streamline-stickies-color',
  'withicons-soft3d',
  'withicons-sticker',
  'withicons-pastel',
  'withicons-clay',
  'withicons-kawaii',
  'withicons-glass',
  'withicons-suite',
  'openmoji',
  'emojione',
  'fxemoji',
  'icon-park',
  'flat-color-icons',
  'meteocons',
  'circle-flags',
  'flag',
  'flagpack',
  'vscode-icons',
  'logos',
  'devicon',
  'skill-icons',
  'marketeq',
  'iconito',
  'thesvg-color',
  'token-branded',
]);

const SET_PRIORITY_BOOST: Record<string, number> = {
  'withicons-soft3d': 1.38,
  'withicons-sticker': 1.35,
  'fluent-emoji-flat': 1.34,
  'fluent-color': 1.32,
  'streamline-color': 1.30,
  'streamline-emojis': 1.29,
  noto: 1.27,
  twemoji: 1.25,
  'icon-park': 1.23,
  openmoji: 1.22,
  emojione: 1.20,
  'flat-color-icons': 1.20,
  meteocons: 1.22,
  'circle-flags': 1.20,
  'vscode-icons': 1.18,
  logos: 1.16,
  devicon: 1.16,
  'skill-icons': 1.16,
  'thesvg-color': 1.15,
  healthicons: 1.18,
  'game-icons': 1.14,
  mdi: 1.10,
  'material-symbols': 1.10,
  solar: 1.12,
  lucide: 1.12,
  hugeicons: 1.10,
  mingcute: 1.09,
  ph: 1.09,
  tabler: 1.08,
  'fa6-solid': 1.07,
  'fa7-solid': 1.08,
  'simple-icons': 1.08,
};

const translationCache = new Map<string, string>();
const searchResponseCache = new Map<string, VisualSearchResult[]>();

/**
 * Fast, free, no-key Turkish -> English translation fallback (MyMemory API)
 * so ANY Turkish word not in the 3,900+ offline dictionary still finds exact
 * icons across Iconify's 546,996+ global vector icon database!
 */
export async function translateTurkishToEnglishLive(
  rawQuery: string,
  signal?: AbortSignal
): Promise<string | null> {
  const clean = rawQuery.trim().toLowerCase();
  if (!clean || clean.length < 2) return null;
  if (translationCache.has(clean)) {
    return translationCache.get(clean) || null;
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      clean
    )}&langpair=tr|en`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = (json?.responseData?.translatedText || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!translated || translated === clean || translated.length > 48) {
      return null;
    }
    translationCache.set(clean, translated);
    return translated;
  } catch {
    return null;
  }
}

function classifyLivePrefix(prefix: string): {
  category: Exclude<GalleryCategoryFilter, 'all'>;
  mode: VisualStyleMode;
  isColor: boolean;
} {
  const isColor = LIVE_COLORFUL_SETS.has(prefix) || prefix.includes('-color') || prefix.startsWith('withicons-');
  if (
    prefix === 'withicons-soft3d' ||
    prefix === 'fluent-color' ||
    prefix === 'fluent-emoji-flat' ||
    prefix === 'streamline-color' ||
    prefix === 'meteocons' ||
    prefix.includes('-color')
  ) {
    return { category: '3d_color', mode: '3d', isColor: true };
  }
  if (
    prefix === 'noto' ||
    prefix === 'twemoji' ||
    prefix === 'openmoji' ||
    prefix === 'emojione' ||
    prefix === 'streamline-emojis' ||
    prefix === 'withicons-sticker' ||
    prefix === 'circle-flags'
  ) {
    return { category: 'hand_drawn', mode: 'illustration', isColor: true };
  }
  if (prefix === 'healthicons' || prefix === 'medical-icon') {
    return { category: 'medical_academic', mode: 'illustration', isColor };
  }
  if (
    prefix === 'logos' ||
    prefix === 'devicon' ||
    prefix === 'skill-icons' ||
    prefix === 'vscode-icons' ||
    prefix === 'simple-icons' ||
    prefix === 'thesvg-color'
  ) {
    return { category: 'system_arch', mode: 'illustration', isColor };
  }
  return {
    category: isColor ? 'hand_drawn' : 'diagram',
    mode: isColor ? 'illustration' : 'diagram',
    isColor,
  };
}

/**
 * Queries Iconify's FULL 546,996+ open vector icon registry (`api.iconify.design/search`).
 * Automatically translates unknown Turkish words to English, prioritizes colorful/3D sets,
 * and tints monochrome icons to match the active branch color.
 */
export async function searchIconifyLive(
  rawQuery: string,
  enTerms: string[],
  branchColor: string,
  signal?: AbortSignal
): Promise<VisualSearchResult[]> {
  const clean = rawQuery.trim();
  if (clean.length < 2) return [];

  const cacheKey = `${clean.toLowerCase()}::${enTerms.slice(0, 2).join(',')}::${branchColor}`;
  const cached = searchResponseCache.get(cacheKey);
  if (cached) return cached;

  // Build candidate English search terms; if query looks Turkish & not already translated, translate live!
  const candidateQueries: string[] = [];
  for (const term of enTerms) {
    const t = term.trim().toLowerCase();
    if (t.length >= 2 && !candidateQueries.includes(t)) {
      candidateQueries.push(t);
    }
    if (candidateQueries.length >= 2) break;
  }

  const normalizedClean = clean.toLowerCase();
  const needsLiveTrTranslation =
    candidateQueries.length === 0 ||
    (candidateQueries.length === 1 && candidateQueries[0] === normalizedClean);

  if (needsLiveTrTranslation) {
    const liveEn = await Promise.race([
      translateTurkishToEnglishLive(clean, signal),
      new Promise<null>((r) => setTimeout(() => r(null), 550)),
    ]);
    if (liveEn && !candidateQueries.includes(liveEn)) {
      candidateQueries.unshift(liveEn);
    }
  }

  if (candidateQueries.length === 0) {
    candidateQueries.push(normalizedClean);
  }

  const primaryQuery = candidateQueries[0];
  const secondaryQuery = candidateQueries[1];
  const colorHex = branchColor.replace('#', '');

  const fetchBatch = async (q: string, limit: number): Promise<string[]> => {
    try {
      const url = `${ICONIFY_API}/search?query=${encodeURIComponent(q)}&limit=${limit}`;
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const data = (await res.json()) as { icons?: string[] };
      return Array.isArray(data.icons) ? data.icons : [];
    } catch {
      return [];
    }
  };

  const batches = await Promise.all([
    fetchBatch(primaryQuery, 48),
    secondaryQuery && secondaryQuery !== primaryQuery
      ? fetchBatch(secondaryQuery, 32)
      : Promise.resolve([]),
  ]);

  if (signal?.aborted) return [];

  const allIconIds = Array.from(new Set([...batches[0], ...batches[1]]));
  if (allIconIds.length === 0) return [];

  // Score & diversify across collections so users get rich colorful + 3D + vector variety
  const prefixCounts = new Map<string, number>();
  const scored: VisualSearchResult[] = [];

  for (let i = 0; i < allIconIds.length; i++) {
    const fullId = allIconIds[i];
    const colonIdx = fullId.indexOf(':');
    if (colonIdx <= 0) continue;
    const prefix = fullId.slice(0, colonIdx);
    const name = fullId.slice(colonIdx + 1);
    if (!name || name.length < 2) continue;

    // Max 5 icons per collection so results stay diverse
    const curCount = prefixCounts.get(prefix) ?? 0;
    if (curCount >= 5) continue;
    prefixCounts.set(prefix, curCount + 1);

    const { category, mode, isColor } = classifyLivePrefix(prefix);
    const boost = SET_PRIORITY_BOOST[prefix] ?? (isColor ? 1.15 : 1.0);
    const rankScore = Math.max(0.45, 0.92 - i * 0.006) * boost;

    const svgUrl = isColor
      ? `${ICONIFY_API}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`
      : `${ICONIFY_API}/${encodeURIComponent(prefix)}/${encodeURIComponent(
          name
        )}.svg?color=%23${encodeURIComponent(colorHex)}`;

    const displayTitle = name
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    scored.push({
      id: `live_ic_${prefix}_${name}`,
      title: displayTitle,
      previewUrl: svgUrl,
      rawUrl: svgUrl,
      mode,
      category,
      source: 'library',
      needsDieCut: false,
      aspectRatio: 1,
      score: rankScore,
      providerName: isColor
        ? `Iconify 540K+ (${prefix})`
        : `Iconify Vektör (${prefix})`,
      isVectorSvg: true,
      iconifyId: fullId,
      // Give generous free icons from live search too (every colorful/general non-3D icon or first hits free!)
      tier:
        prefix === 'withicons-soft3d' ||
        prefix === 'fluent-color' ||
        prefix === 'streamline-color'
          ? 'pro'
          : 'free',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 44);
  if (top.length > 0) {
    if (searchResponseCache.size > 120) {
      const oldest = searchResponseCache.keys().next().value;
      if (oldest) searchResponseCache.delete(oldest);
    }
    searchResponseCache.set(cacheKey, top);
  }
  return top;
}
