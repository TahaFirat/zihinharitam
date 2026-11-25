import type {
  GalleryCategoryFilter,
  VisualSearchResult,
  VisualStyleMode,
} from '../../../types/mindmap';
import { EN_CONCEPT_INTENT_MAP } from '../taxonomyData.js';

const ICONIFY_API = 'https://api.iconify.design';

// Strictly verified commercial-safe & attributed icon collections ONLY (MIT, Apache-2.0, ISC, CC-BY 4.0/3.0 — zero NC / SA / unverified packs!)
const LIVE_COLORFUL_SETS = new Set([
  'fluent-emoji',
  'fluent-emoji-flat',
  'fluent-color',
  'noto',
  'twemoji',
  'streamline-color',
  'streamline-emojis',
  'streamline-plump-color',
  'emojione',
  'fxemoji',
  'icon-park',
  'flat-color-icons',
  'meteocons',
  'circle-flags',
  'vscode-icons',
  'logos',
  'devicon',
  'skill-icons',
  'marketeq',
]);

const LIVE_MONO_SAFE_SETS = new Set([
  'healthicons',
  'medical-icon',
  'game-icons',
  'mdi',
  'lucide',
  'ph',
  'tabler',
  'carbon',
  'fa6-solid',
]);

const ALLOWED_LIVE_SETS = new Set([...LIVE_COLORFUL_SETS, ...LIVE_MONO_SAFE_SETS]);

// Brand / product logo packs are NEVER locked behind a paid PRO paywall (strictly FREE educational reference tier)
const TRADEMARK_REFERENCE_SETS = new Set([
  'logos',
  'devicon',
  'skill-icons',
  'vscode-icons',
]);

const SET_PRIORITY_BOOST: Record<string, number> = {
  'fluent-emoji': 1.36,
  'fluent-emoji-flat': 1.35,
  'streamline-plump-color': 1.34,
  'fluent-color': 1.32,
  'streamline-color': 1.30,
  'streamline-emojis': 1.29,
  noto: 1.27,
  twemoji: 1.25,
  fxemoji: 1.24,
  'icon-park': 1.23,
  emojione: 1.21,
  'flat-color-icons': 1.20,
  marketeq: 1.22,
  meteocons: 1.22,
  'circle-flags': 1.20,
  'vscode-icons': 1.16,
  logos: 1.15,
  devicon: 1.15,
  'skill-icons': 1.15,
  healthicons: 1.18,
  'medical-icon': 1.17,
  'game-icons': 1.14,
  ph: 1.12,
  lucide: 1.12,
  mdi: 1.10,
  carbon: 1.10,
  tabler: 1.08,
  'fa6-solid': 1.07,
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
 * Zero-key Turkish -> English translation via official public MyMemory REST endpoint
 * (used only when a rare Turkish phrase is absent from the offline dictionary & Wikipedia bridge).
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

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      clean
    )}&langpair=tr|en`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = sanitizeTrResult(json?.responseData?.translatedText || '');
    if (translated) {
      translationCache.set(clean, translated);
    }
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
  const isColor = LIVE_COLORFUL_SETS.has(prefix);
  if (
    prefix === 'fluent-emoji' ||
    prefix === 'fluent-color' ||
    prefix === 'fluent-emoji-flat' ||
    prefix === 'streamline-plump-color' ||
    prefix === 'streamline-color' ||
    prefix === 'meteocons' ||
    prefix === 'marketeq'
  ) {
    return { category: '3d_color', mode: '3d', isColor: true };
  }
  if (
    prefix === 'noto' ||
    prefix === 'twemoji' ||
    prefix === 'fxemoji' ||
    prefix === 'emojione' ||
    prefix === 'streamline-emojis' ||
    prefix === 'flat-color-icons' ||
    prefix === 'circle-flags'
  ) {
    return { category: 'hand_drawn', mode: 'illustration', isColor: true };
  }
  if (prefix === 'healthicons' || prefix === 'medical-icon') {
    return { category: 'medical_academic', mode: 'illustration', isColor };
  }
  if (TRADEMARK_REFERENCE_SETS.has(prefix)) {
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

  const COLORFUL_PREFIX_FILTER = Array.from(LIVE_COLORFUL_SETS).join(',');
  const MONO_SAFE_PREFIX_FILTER = Array.from(LIVE_MONO_SAFE_SETS).join(',');

  const fetchBatch = async (
    q: string,
    limit: number,
    prefixes: string
  ): Promise<string[]> => {
    try {
      const url = `${ICONIFY_API}/search?query=${encodeURIComponent(q)}&limit=${limit}&prefixes=${encodeURIComponent(prefixes)}`;
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const data = (await res.json()) as { icons?: string[] };
      return Array.isArray(data.icons) ? data.icons : [];
    } catch {
      return [];
    }
  };

  // Query verified commercial-safe colorful + monochrome catalogs in parallel!
  const batches = await Promise.all([
    fetchBatch(primaryQuery, 32, COLORFUL_PREFIX_FILTER),
    fetchBatch(primaryQuery, 28, MONO_SAFE_PREFIX_FILTER),
    headQuery ? fetchBatch(headQuery, 24, COLORFUL_PREFIX_FILTER) : Promise.resolve([]),
    headQuery ? fetchBatch(headQuery, 18, MONO_SAFE_PREFIX_FILTER) : Promise.resolve([]),
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
    // Hard license gate: reject any non-whitelisted collection
    if (!ALLOWED_LIVE_SETS.has(prefix)) continue;

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
        ? `Iconify (${prefix})`
        : `Iconify Vektör (${prefix})`,
      isVectorSvg: true,
      iconifyId: fullId,
      // Monochrome outline sets, starter flat packs & third-party trademark logos are ALWAYS FREE (never paywalled behind PRO!)
      tier:
        !isColor ||
        TRADEMARK_REFERENCE_SETS.has(prefix) ||
        prefix === 'fxemoji' ||
        prefix === 'flat-color-icons'
          ? 'free'
          : 'pro',
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
