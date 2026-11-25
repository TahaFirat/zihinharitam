import type {
  GalleryCategoryFilter,
  VisualSearchResult,
  VisualStyleMode,
} from '../../../types/mindmap';
import { EN_CONCEPT_INTENT_MAP } from '../taxonomyData.js';

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

const NOISY_LIVE_WORDS = new Set([
  'mouth', 'kissing', 'grinning', 'crying', 'weary', 'zany', 'winking',
  'pouting', 'angry', 'frowning', 'drooling', 'vomiting', 'zombie',
  'vampire', 'halloween', 'christmas', 'santa', 'pirate', 'casino',
  'poker', 'bikini', 'poo', 'poop', 'toilet', 'biking', 'juggling',
  'curling', 'mirror', 'confetti', 'disco', 'ballot', 'closet', 'buffalo',
  'singer', 'bouncing', 'rice', 'yarn',
]);

/**
 * Ultra-fast, zero-key Turkish -> English translation racing Google Translate public gtx endpoint
 * against MyMemory (`<180ms` typical!) so ANY rare Turkish concept immediately resolves cleanly!
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

  const sanitizeTrResult = (text: string): string | null => {
    const translated = (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!translated || translated === clean || translated.length > 44) return null;
    return translated;
  };

  const tryGoogleGtx = async (): Promise<string | null> => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=en&dt=t&q=${encodeURIComponent(
        clean
      )}`;
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const json = (await res.json()) as unknown[];
      const segments = Array.isArray(json?.[0]) ? (json[0] as unknown[][]) : [];
      const joined = segments.map((s) => String(s?.[0] || '')).join(' ');
      return sanitizeTrResult(joined);
    } catch {
      return null;
    }
  };

  const tryMyMemory = async (): Promise<string | null> => {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        clean
      )}&langpair=tr|en`;
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        responseData?: { translatedText?: string };
      };
      return sanitizeTrResult(json?.responseData?.translatedText || '');
    } catch {
      return null;
    }
  };

  try {
    const firstValid = await new Promise<string | null>((resolve) => {
      let pending = 2;
      let resolved = false;
      const settle = (val: string | null) => {
        if (resolved) return;
        if (val) {
          resolved = true;
          resolve(val);
          return;
        }
        pending--;
        if (pending <= 0) {
          resolved = true;
          resolve(null);
        }
      };
      void tryGoogleGtx().then(settle);
      void tryMyMemory().then(settle);
    });

    if (firstValid) {
      translationCache.set(clean, firstValid);
    }
    return firstValid;
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
export interface SearchIconifyLiveOptions {
  hasExactOfflineLexicon?: boolean;
  allWordsMatched?: boolean;
  hasExactPhraseMatch?: boolean;
  preTranslatedEn?: string | null;
  headEnTerms?: string[];
  blockedTokens?: string[];
}

export async function searchIconifyLive(
  rawQuery: string,
  enTerms: string[],
  branchColor: string,
  signal?: AbortSignal,
  options?: SearchIconifyLiveOptions
): Promise<VisualSearchResult[]> {
  const clean = rawQuery.trim();
  if (clean.length < 2) return [];

  const cacheKey = `v8::${clean.toLowerCase()}::${options?.preTranslatedEn || ''}::${enTerms.slice(0, 2).join(',')}::${branchColor}`;
  const cached = searchResponseCache.get(cacheKey);
  if (cached) return cached;

  // Build candidate English search terms; ALWAYS translate live when the full phrase wasn't matched locally!
  const candidateQueries: string[] = [];
  const pushQuery = (q?: string | null, front = false) => {
    const t = (q || '').trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
    if (t.length < 2) return;
    if (candidateQueries.includes(t)) return;
    if (front) candidateQueries.unshift(t);
    else candidateQueries.push(t);
  };

  for (const term of enTerms) {
    pushQuery(term);
    if (candidateQueries.length >= 3) break;
  }

  const normalizedClean = clean.toLowerCase();
  const isMultiWord = normalizedClean.includes(' ');
  const needsLiveTrTranslation =
    !options?.preTranslatedEn &&
    (!options?.hasExactOfflineLexicon ||
      options?.allWordsMatched === false ||
      (isMultiWord && !options?.hasExactPhraseMatch) ||
      candidateQueries.length === 0 ||
      candidateQueries[0] === normalizedClean);

  let liveTranslatedEn: string | null = options?.preTranslatedEn ?? null;
  if (needsLiveTrTranslation) {
    liveTranslatedEn = await Promise.race([
      translateTurkishToEnglishLive(clean, signal),
      new Promise<null>((r) => setTimeout(() => r(null), 1100)),
    ]);
  }
  if (liveTranslatedEn) {
    pushQuery(liveTranslatedEn, true);
  }

  // Extract Head Noun (LAST word of multi-word English phrase — e.g. `tablet case` -> `case`, `coffee maker` -> `maker`)
  // so 2+ word queries ALWAYS fetch crisp icons for the actual target object, NEVER just the first word!
  const headQueryCandidates: string[] = [];
  const activeMultiPhrase =
    (liveTranslatedEn && liveTranslatedEn.includes(' ') ? liveTranslatedEn : null) ||
    (candidateQueries[0] && candidateQueries[0].includes(' ') ? candidateQueries[0] : null);

  if (activeMultiPhrase) {
    const phraseParts = activeMultiPhrase.split(/\s+/).filter((w) => w.length >= 2);
    const lastPart = phraseParts[phraseParts.length - 1];
    if (lastPart && lastPart.length >= 3) {
      headQueryCandidates.push(lastPart);
    }
  }
  for (const ht of options?.headEnTerms ?? []) {
    const cleanHt = ht.replace(/-/g, ' ').trim().toLowerCase();
    if (cleanHt.length >= 2 && !headQueryCandidates.includes(cleanHt)) {
      headQueryCandidates.push(cleanHt);
    }
  }

  // Expand translated/English abstract nouns via `EN_CONCEPT_INTENT_MAP`
  const intentMap = EN_CONCEPT_INTENT_MAP as Record<string, string[]>;
  for (const q of [...candidateQueries, ...headQueryCandidates]) {
    const wordsOfQ = q.split(/\s+/);
    const lastWord = wordsOfQ[wordsOfQ.length - 1];
    const proxies = intentMap[q] || intentMap[lastWord] || intentMap[wordsOfQ[0]];
    if (proxies) {
      for (const px of proxies.slice(0, 2)) {
        pushQuery(px);
      }
    }
  }

  if (candidateQueries.length === 0) {
    pushQuery(normalizedClean);
  }

  const primaryQuery = candidateQueries[0];
  const headQuery = headQueryCandidates.find((h) => h !== primaryQuery) || '';
  const secondaryQuery =
    candidateQueries.find((q) => q !== primaryQuery && q !== headQuery) || '';

  const colorHex = branchColor.replace('#', '');
  const blockedSet = new Set(
    (options?.blockedTokens ?? []).map((b) => b.toLowerCase())
  );
  const primaryWords = primaryQuery.split(/[\s-_]+/).filter((w) => w.length >= 2);
  const headWordSet = new Set(
    [
      ...(primaryWords.length >= 2 ? [primaryWords[primaryWords.length - 1]] : []),
      ...headQueryCandidates.flatMap((h) => h.split(/\s+/)),
    ].filter((w) => w.length >= 2)
  );
  const modWordSet = new Set(
    primaryWords.length >= 2
      ? primaryWords.slice(0, -1).filter((w) => !headWordSet.has(w))
      : []
  );
  const isCompoundLive = headWordSet.size > 0 && modWordSet.size > 0;
  const allowNoisy = primaryWords.some((w) => NOISY_LIVE_WORDS.has(w));

  const COLORFUL_PREFIX_FILTER =
    'fluent-emoji,fluent-emoji-flat,streamline-plump-color,fluent-color,streamline-color,emojione,noto,fxemoji,streamline-emojis,marketeq,withicons-soft3d,withicons-sticker,flat-color-icons,icon-park,twemoji,meteocons,logos,devicon,skill-icons,healthicons';

  const fetchBatch = async (
    q: string,
    limit: number,
    prefixes?: string
  ): Promise<string[]> => {
    try {
      const prefixParam = prefixes ? `&prefixes=${encodeURIComponent(prefixes)}` : '';
      const url = `${ICONIFY_API}/search?query=${encodeURIComponent(q)}&limit=${limit}${prefixParam}`;
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const data = (await res.json()) as { icons?: string[] };
      return Array.isArray(data.icons) ? data.icons : [];
    } catch {
      return [];
    }
  };

  // Query FULL PHRASE (colorful + full 546K catalog) AND HEAD NOUN in parallel!
  const batches = await Promise.all([
    fetchBatch(primaryQuery, 32, COLORFUL_PREFIX_FILTER),
    fetchBatch(primaryQuery, 32),
    headQuery ? fetchBatch(headQuery, 24, COLORFUL_PREFIX_FILTER) : Promise.resolve([]),
    headQuery ? fetchBatch(headQuery, 20) : Promise.resolve([]),
    secondaryQuery ? fetchBatch(secondaryQuery, 20, COLORFUL_PREFIX_FILTER) : Promise.resolve([]),
  ]);

  if (signal?.aborted) return [];

  const allIconIds = Array.from(
    new Set([...batches[0], ...batches[1], ...batches[2], ...batches[4], ...batches[3]])
  );
  if (allIconIds.length === 0) return [];

  // Score with Compound-AND Intersection + Head-Noun Priority + Short-Name Specificity + Concept Deduplication
  const prefixCounts = new Map<string, number>();
  const conceptCounts = new Map<string, number>();
  const scored: VisualSearchResult[] = [];

  for (let i = 0; i < allIconIds.length; i++) {
    const fullId = allIconIds[i];
    const colonIdx = fullId.indexOf(':');
    if (colonIdx <= 0) continue;
    const prefix = fullId.slice(0, colonIdx);
    const name = fullId.slice(colonIdx + 1);
    if (!name || name.length < 2) continue;

    const cleanName = name
      .toLowerCase()
      .replace(/-(duotone|original|plain|light|dark|16|20|24|28|32|48)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    const nameWords = cleanName.split(/\s+/).filter(Boolean);

    if (nameWords.some((w) => blockedSet.has(w))) continue;
    if (!allowNoisy && nameWords.some((w) => NOISY_LIVE_WORDS.has(w))) continue;

    const cKey = cleanName
      .replace(/\b(outline|solid|fill|filled|flat|color|colour|alt|regular|bold|1|2|3|4|5)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if ((conceptCounts.get(cKey) ?? 0) >= 2) continue;

    // Max 5 icons per collection so results stay diverse & gamified
    const curCount = prefixCounts.get(prefix) ?? 0;
    if (curCount >= 5) continue;
    prefixCounts.set(prefix, curCount + 1);
    conceptCounts.set(cKey, (conceptCounts.get(cKey) ?? 0) + 1);

    const { category, mode, isColor } = classifyLivePrefix(prefix);
    const boost = SET_PRIORITY_BOOST[prefix] ?? (isColor ? 1.15 : 1.0);

    const isExactPhrase =
      cleanName === primaryQuery ||
      Boolean(liveTranslatedEn && cleanName === liveTranslatedEn.replace(/-/g, ' '));
    const isExactHead = Boolean(headQuery && cleanName === headQuery);
    const hasHeadHit = isCompoundLive && nameWords.some((w) => headWordSet.has(w));
    const hasModHit = isCompoundLive && nameWords.some((w) => modWordSet.has(w));

    const matchedWordCount = primaryWords.filter((pw) =>
      nameWords.includes(pw)
    ).length;
    const extraWords = Math.max(0, nameWords.length - Math.max(1, matchedWordCount));

    let rankScore: number;
    if ((isExactPhrase || (hasHeadHit && hasModHit)) && isColor) {
      // Exact compound/phrase colorful match -> STRICTLY #1!
      rankScore = Math.min(0.996, 0.972 + (boost - 1) * 0.08);
    } else if (isExactPhrase || (hasHeadHit && hasModHit)) {
      rankScore = 0.955;
    } else if (isExactHead && isColor) {
      rankScore = Math.min(0.96, 0.935 + (boost - 1) * 0.06);
    } else if (isExactHead) {
      rankScore = 0.91;
    } else if (isCompoundLive && hasHeadHit) {
      const base = Math.max(0.55, 0.88 - i * 0.004 - extraWords * 0.035);
      rankScore = Math.min(0.935, base * (isColor ? 1.08 : 0.98));
    } else if (isCompoundLive && hasModHit && !hasHeadHit) {
      // Modifier-only match (e.g. `tablet` alone for `tablet kılıfı`): sits cleanly below `case`/`cover`!
      rankScore = Math.max(0.45, 0.76 - i * 0.004 - extraWords * 0.03);
    } else {
      const base = Math.max(0.45, 0.85 - i * 0.005 - extraWords * 0.045);
      rankScore = Math.min(0.925, base * (isColor ? 1.08 : 0.96));
    }

    // Always specify explicit 128x128 pixel dimensions so SVGs never render at 1em/0px blank size inside <img>!
    const svgUrl = isColor
      ? `${ICONIFY_API}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg?width=128&height=128`
      : `${ICONIFY_API}/${encodeURIComponent(prefix)}/${encodeURIComponent(
          name
        )}.svg?width=128&height=128&color=%23${encodeURIComponent(colorHex)}`;

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
      // V8 Quality Tiering: Simple 1-color monochrome outline icons are FREE; ALL colorful/3D/illustrated sets are PRO!
      tier: isColor ? 'pro' : 'free',
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
