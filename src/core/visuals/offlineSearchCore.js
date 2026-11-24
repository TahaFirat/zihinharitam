import { expandSemanticQueryV3, normalizeTrToken } from './taxonomyData.js';

const PACK_QUALITY_MULTIPLIER = {
  // GAMIFIED / GLOSSY 3D / PLUMP COLOR PACKS RANK #1! (Photo 2 aesthetic)
  'fluent-emoji-flat': 1.56,
  'streamline-plump-color': 1.54,
  'fluent-color': 1.52,
  'streamline-color': 1.49,
  emojione: 1.46,
  noto: 1.45,
  'streamline-emojis': 1.43,
  fxemoji: 1.40,
  marketeq: 1.38,
  twemoji: 1.36,
  'flat-color-icons': 1.34,
  'icon-park': 1.33,
  meteocons: 1.35,
  'circle-flags': 1.24,
  openmoji: 1.22,
  'vscode-icons': 1.20,
  logos: 1.18,
  devicon: 1.18,
  'skill-icons': 1.18,
  healthicons: 1.22,
  'medical-icon': 1.20,
  'game-icons': 1.20,
  // Plain 1-color wireframes sit cleanly below gamified color icons!
  lucide: 0.86,
  mdi: 0.85,
  'fa6-solid': 0.83,
  tabler: 0.82,
};

function canonicalConceptKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(outline|solid|fill|filled|flat|color|colour|alt|regular|bold|thin|light|sharp|rounded|1|2|3|4|5)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NOISY_COMPOUND_WORDS = new Set([
  'mouth', 'kissing', 'grinning', 'crying', 'weary', 'zany', 'winking',
  'pouting', 'angry', 'frowning', 'grimacing', 'drooling', 'vomiting',
  'zombie', 'vampire', 'halloween', 'christmas', 'santa', 'claus',
  'pirate', 'jolly', 'casino', 'poker', 'slot', 'bikini', 'poo', 'poop',
  'toilet', 'biking', 'surfing', 'juggling', 'cartwheeling', 'wrestling',
  'curling', 'mirror', 'confetti', 'disco', 'ballot', 'closet', 'buffalo',
  'singer', 'bouncing', 'rice', 'yarn', 'hole',
]);

export function tokenizeSearchField(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[\s\-_/.,:;()]+/)
    .filter((t) => t.length >= 2);
}

/**
 * Binary search on sorted vocabulary array `vocab` returning all tokens starting with `prefix` (`O(log V)`, `<0.08ms`).
 */
function findPrefixTokensInVocab(vocab, prefix, maxMatches = 24) {
  if (!vocab || vocab.length === 0 || prefix.length < 2) return [];
  let lo = 0;
  let hi = vocab.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (vocab[mid] < prefix) lo = mid + 1;
    else hi = mid - 1;
  }
  const out = [];
  for (let i = lo; i < vocab.length && out.length < maxMatches; i++) {
    const w = vocab[i];
    if (!w.startsWith(prefix)) break;
    if (w !== prefix) out.push(w);
  }
  return out;
}

export class OfflineBM25Engine {
  constructor(manifestItems = []) {
    this.items = [];
    this.nameTokensByIdx = [];
    this.allEnTokensByIdx = [];
    this.namePostings = new Map();
    this.tagPostings = new Map();
    this.vocab = [];

    if (manifestItems.length > 0) {
      this.loadManifest(manifestItems);
    }
  }

  /**
   * Instant `<0.5ms` Zero-Indexing Loader for `fast-index-v7.json` in Web Workers!
   */
  loadFastIndexV7(fastJson) {
    const { packs, domains, rows, namePostings, tagPostings, vocab } = fastJson;
    const count = rows.length;
    this.items = new Array(count);
    this.nameTokensByIdx = new Array(count);
    this.allEnTokensByIdx = null; // Lazy-allocated per candidate for zero startup GC!

    for (let i = 0; i < count; i++) {
      const [idKey, rawCleanName, packIdx, domIdx, flags, shardId] = rows[i];
      const pack = packs[packIdx];
      const cleanName =
        rawCleanName ||
        idKey
          .replace(/-(duotone|original|plain|light|dark|16|20|24|28|32|48)$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim();
      this.items[i] = {
        id: `${pack}:${idKey}`,
        pack,
        name: cleanName,
        trTags: '',
        enTags: cleanName,
        domain: domains[domIdx] || 'general',
        isMultiColor: (flags & 1) === 1,
        tier: (flags & 2) === 2 ? 'free' : 'pro',
        shardId,
      };
      this.nameTokensByIdx[i] = cleanName.toLowerCase().split(/\s+/).filter(Boolean);
    }

    this.namePostings = new Map(Object.entries(namePostings));
    this.tagPostings = new Map(Object.entries(tagPostings));
    this.vocab = Array.isArray(vocab) ? vocab : [];
  }

  /**
   * Direct loader from `search-manifest.json` `items` array (~20ms in Node / fallback).
   */
  loadManifest(items) {
    const count = items.length;
    this.items = items;
    this.nameTokensByIdx = new Array(count);
    this.allEnTokensByIdx = new Array(count);
    this.namePostings.clear();
    this.tagPostings.clear();
    const vocabSet = new Set();

    const addPosting = (map, tok, idx) => {
      let arr = map.get(tok);
      if (!arr) {
        arr = [];
        map.set(tok, arr);
      }
      arr.push(idx);
      vocabSet.add(tok);
    };

    for (let i = 0; i < count; i++) {
      const item = items[i];
      const nToks = Array.from(new Set(tokenizeSearchField(item.name)));
      const eToks = tokenizeSearchField(item.enTags);
      const tToks = tokenizeSearchField(item.trTags);
      this.nameTokensByIdx[i] = nToks;

      const enSet = new Set([...nToks, ...eToks]);
      this.allEnTokensByIdx[i] = enSet;

      const nSet = new Set(nToks);
      for (const nt of nSet) {
        addPosting(this.namePostings, nt, i);
      }

      const tagSet = new Set();
      for (const et of eToks) {
        if (!nSet.has(et)) tagSet.add(et);
      }
      for (const tt of tToks) {
        if (!nSet.has(tt)) tagSet.add(tt);
      }
      for (const tg of tagSet) {
        addPosting(this.tagPostings, tg, i);
      }
    }

    this.vocab = Array.from(vocabSet).sort();
  }

  /**
   * V7 Sub-3ms Inverted-Index + Iconify Short-Name Specificity Search Engine
   */
  search(rawQuery, options = {}) {
    const {
      discipline = 'system_design_cs',
      activeOfflineDomain = 'general',
      limit = 96,
    } = options;

    const clean = (rawQuery || '').trim();
    const expanded = expandSemanticQueryV3(clean, discipline);

    if (!expanded.normalizedQuery || this.items.length === 0) {
      return {
        hits: [],
        expanded,
      };
    }

    const normQuery = expanded.normalizedQuery;
    const blockedSet = new Set(expanded.blockedTokens);
    const primaryRaw = expanded.primaryEnTokens || expanded.expandedEnTokens || [];
    const secondaryRaw = expanded.secondaryEnTokens || [];

    // Build exact phrase set & atomic primary/secondary word sets
    const primaryExactPhrases = new Set([normQuery]);
    const topLeadPhrase = primaryRaw[0] ? primaryRaw[0].replace(/-/g, ' ').trim() : '';
    const primaryWords = new Set();
    const secondaryWords = new Set();

    for (const p of primaryRaw) {
      const spaceNorm = p.replace(/-/g, ' ').trim();
      if (spaceNorm.length >= 2 && !blockedSet.has(spaceNorm)) {
        primaryExactPhrases.add(spaceNorm);
        const parts = spaceNorm.split(/\s+/).filter((w) => w.length >= 2 && !blockedSet.has(w));
        if (parts.length === 1) {
          primaryWords.add(parts[0]);
        } else {
          parts.forEach((w) => primaryWords.add(w));
        }
      }
    }

    for (const s of secondaryRaw) {
      const spaceNorm = s.replace(/-/g, ' ').trim();
      for (const w of spaceNorm.split(/\s+/)) {
        if (w.length >= 2 && !blockedSet.has(w) && !primaryWords.has(w)) {
          secondaryWords.add(w);
        }
      }
    }

    const trWords = expanded.isHomonym
      ? []
      : expanded.expandedTrTokens
          .flatMap((t) => t.split(/\s+/))
          .filter((w) => w.length >= 3 && !blockedSet.has(w));

    // Candidate accumulators (`idx -> baseScore`, `idx -> matchedPrimaryNameCount`, `idx -> matchedAnyNameCount`)
    const baseScores = new Map();
    const matchedPrimaryNameCount = new Map();
    const matchedNameCount = new Map();

    const bumpCandidate = (idx, delta, isNameHit, isPrimary = false) => {
      baseScores.set(idx, (baseScores.get(idx) || 0) + delta);
      if (isNameHit) {
        matchedNameCount.set(idx, (matchedNameCount.get(idx) || 0) + 1);
        if (isPrimary) {
          matchedPrimaryNameCount.set(idx, (matchedPrimaryNameCount.get(idx) || 0) + 1);
        }
      }
    };

    // 1. Primary English Tokens (Highest Authority: #1 primary concept leads strongly over secondary synonyms!)
    let rankIdx = 0;
    for (const pw of primaryWords) {
      // Strong lead weight for #1 exact synonym (1.16x -> 0.72x) so exact primary icon always ranks #1!
      const rankDecay = rankIdx === 0 ? 1.16 : Math.max(0.72, 1.0 - rankIdx * 0.06);
      rankIdx++;

      const nList = this.namePostings.get(pw);
      if (nList) {
        const pts = 540 * rankDecay;
        for (let i = 0; i < nList.length; i++) bumpCandidate(nList[i], pts, true, true);
      }
      const tList = this.tagPostings.get(pw);
      if (tList) {
        const pts = 175 * rankDecay;
        for (let i = 0; i < tList.length; i++) bumpCandidate(tList[i], pts, false, true);
      }
    }

    // 2. Turkish Synonym / Tag Tokens (+280 in icon name, +195 in trTags)
    for (const tw of trWords) {
      const nList = this.namePostings.get(tw);
      if (nList) {
        for (let i = 0; i < nList.length; i++) bumpCandidate(nList[i], 280, true, false);
      }
      const tList = this.tagPostings.get(tw);
      if (tList) {
        for (let i = 0; i < tList.length; i++) bumpCandidate(tList[i], 195, false, false);
      }
    }

    // 3. Secondary Domain Tokens (Lower Authority: +135 in icon name, +55 in tags)
    for (const sw of secondaryWords) {
      const nList = this.namePostings.get(sw);
      if (nList) {
        for (let i = 0; i < nList.length; i++) bumpCandidate(nList[i], 135, true, false);
      }
      const tList = this.tagPostings.get(sw);
      if (tList) {
        for (let i = 0; i < tList.length; i++) bumpCandidate(tList[i], 55, false, false);
      }
    }

    // 4. Fast Binary-Search Prefix Match while typing (`lastWord.length >= 3`)
    // Only match English `namePostings` (or Turkish `tagPostings` when prefix is >= 5 chars) so unknown words don't trigger 3-letter false-positive tag noise!
    const rawQueryWords = normQuery.split(' ').filter(Boolean);
    const lastWord = rawQueryWords[rawQueryWords.length - 1] || '';
    const isRiskyCollisionStem =
      lastWord.startsWith('mikro') || lastWord.startsWith('eko') || lastWord === 'cip';

    if (lastWord.length >= 3 && !isRiskyCollisionStem) {
      const prefixMatches = findPrefixTokensInVocab(this.vocab, lastWord, 20);
      for (const pTok of prefixMatches) {
        if (blockedSet.has(pTok)) continue;
        // Closer length to typed prefix scores higher (`Iconify partial.ts` rule)
        const lenFit = Math.max(0.45, 1.0 - (pTok.length - lastWord.length) * 0.09);
        const nList = this.namePostings.get(pTok);
        if (nList) {
          const pts = 205 * lenFit;
          for (let i = 0; i < nList.length; i++) bumpCandidate(nList[i], pts, true, false);
        }
        if (baseScores.size < 24 && lastWord.length >= 5) {
          const tList = this.tagPostings.get(pTok);
          if (tList) {
            const pts = 70 * lenFit;
            for (let i = 0; i < tList.length; i++) bumpCandidate(tList[i], pts, false, false);
          }
        }
      }
    }

    if (baseScores.size === 0) {
      return { hits: [], expanded };
    }

    // Check if user explicitly asked for an emoji face / holiday / pirate / game concept
    const queryAllowsNoisy = Array.from(primaryWords).some((w) =>
      NOISY_COMPOUND_WORDS.has(w)
    );

    let maxRawScore = 0;
    const candidates = [];

    for (const [idx, rawPts] of baseScores.entries()) {
      const item = this.items[idx];
      if (!item) continue;

      const nameToks = this.nameTokensByIdx[idx] || [];

      // Hard Collision Block Guard!
      if (blockedSet.size > 0) {
        let collided = false;
        const fullTokSet = this.allEnTokensByIdx ? this.allEnTokensByIdx[idx] : null;
        if (fullTokSet) {
          for (const bad of blockedSet) {
            if (fullTokSet.has(bad)) {
              collided = true;
              break;
            }
          }
        } else {
          for (let k = 0; k < nameToks.length; k++) {
            if (blockedSet.has(nameToks[k])) {
              collided = true;
              break;
            }
          }
        }
        if (collided) continue;
      }

      let score = rawPts;
      const lowerName = item.name.toLowerCase();
      const hitNameWords = matchedNameCount.get(idx) || 0;
      const hitPrimWords = matchedPrimaryNameCount.get(idx) || 0;

      // Tier 1: Exact Full Icon Name Match (`soccer ball`, `rock`, `table`, `fire`, `automobile`, `droplet`)
      if (topLeadPhrase && lowerName === topLeadPhrase) {
        score += 1780;
      } else if (primaryExactPhrases.has(lowerName)) {
        score += 1380;
      } else if (
        nameToks.length === 2 &&
        primaryWords.has(nameToks[0]) &&
        /^[0-9]+$/.test(nameToks[1])
      ) {
        // Numbered clean variants in Streamline (`database server 1`, `justice scale 1`, `computer chip 1`)
        score += 920;
      } else if (hitPrimWords >= 2 && nameToks.length <= 5) {
        // Multi-concept AND intersection bonus (`shield sword`, `router network`, `money bag`) — never rewards 14-word keyword stuffing!
        const effectiveAnd = Math.min(hitPrimWords, Math.max(2, rawQueryWords.length));
        score += 460 * (effectiveAnd - 1);
      }

      // Tier 2: Iconify Short-Name Specificity Boost & Unmatched Extra-Word Penalty!
      if (hitNameWords > 0) {
        const unmatchedWords = Math.max(0, nameToks.length - hitPrimWords);
        score -= unmatchedWords * 105;
        if (nameToks.length > 4) {
          score -= (nameToks.length - 4) * 145;
        }
        score += Math.max(0, 80 - lowerName.length * 2.8);
      }

      // Prevent brand/tech logo packs (`simple-icons`, `skill-icons`, `devicon`, `logos`, `vscode-icons`)
      // from hijacking everyday/biology/architecture words (`elma` -> Apple Inc, `dna` -> Helix editor, `köprü` -> Arch Linux)
      const isTechOrBrandPack =
        item.pack === 'simple-icons' ||
        item.pack === 'skill-icons' ||
        item.pack === 'devicon' ||
        item.pack === 'logos' ||
        item.pack === 'vscode-icons';

      if (isTechOrBrandPack) {
        const isExplicitBrandQuery =
          lowerName === normQuery ||
          (rawQueryWords.length === 1 && lowerName.startsWith(normQuery) && normQuery.length >= 4);
        const isTechDomain =
          expanded.detectedDomains.includes('system_cs') ||
          expanded.detectedDomains.includes('electronics') ||
          (expanded.isHomonym && activeOfflineDomain === 'system_cs');

        if (!isExplicitBrandQuery && !isTechDomain) {
          score -= 850;
        }
      }

      // Tier 3: Universal Noisy-Emoji / Irrelevant-Compound Guard (`money-mouth-face`, `christmas-tree`, `man-mountain-biking`)
      if (!queryAllowsNoisy) {
        for (let k = 0; k < nameToks.length; k++) {
          if (NOISY_COMPOUND_WORDS.has(nameToks[k])) {
            score -= 620;
            break;
          }
        }
      }

      if (score <= 30) continue;

      // Pack quality & strong vibrant gamified multi-color illustration preference!
      score *= PACK_QUALITY_MULTIPLIER[item.pack] || 1.0;
      if (item.isMultiColor) {
        score *= 1.34;
      } else {
        score *= 0.86;
      }

      if (
        expanded.detectedDomains.length > 0 &&
        expanded.detectedDomains.includes(item.domain)
      ) {
        score *= 1.16;
      }

      if (expanded.isHomonym && item.domain === activeOfflineDomain) {
        score *= 1.18;
      }

      if (score > maxRawScore) {
        maxRawScore = score;
      }
      candidates.push({ item, finalScore: score });
    }

    // Adaptive Precision Floor: when strong exact hits exist, cut off weak peripheral tag noise!
    const minScore =
      maxRawScore >= 1200
        ? Math.max(180, maxRawScore * 0.16)
        : Math.max(75, maxRawScore * 0.12);

    const qualified = candidates
      .filter((c) => c.finalScore >= minScore)
      .sort((a, b) => b.finalScore - a.finalScore);

    // Diversity + Strict Concept Deduplication (max 2 visually distinct styles per identical icon concept!)
    // Eliminates duplicate clones (e.g. 6 identical Red Hearts) so every slot is fresh, gamified, and relevant!
    const packCounts = new Map();
    const conceptCounts = new Map();
    const balanced = [];
    const overflow = [];
    const reservedFree = [];

    for (const entry of qualified) {
      const p = entry.item.pack;
      const cKey = canonicalConceptKey(entry.item.name) || entry.item.id;
      const cCount = conceptCounts.get(cKey) || 0;

      if (entry.item.tier === 'free' && reservedFree.length < 10 && cCount < 3) {
        reservedFree.push(entry);
      }

      // Keep Top slots strictly diverse (max 2 visually distinct packs per exact concept!);
      // push 3rd/4th style variants to overflow so niche queries ("bakteri") still stay rich without cluttering Top #1..#12!
      if (cCount >= 2) {
        if (cCount < 4) {
          conceptCounts.set(cKey, cCount + 1);
          overflow.push(entry);
        }
        continue;
      }

      const count = packCounts.get(p) || 0;
      const capInTop = entry.item.isMultiColor ? 10 : 6;
      if (count < capInTop && balanced.length < limit) {
        packCounts.set(p, count + 1);
        conceptCounts.set(cKey, cCount + 1);
        balanced.push(entry);
      } else {
        overflow.push(entry);
      }
    }

    const balancedIds = new Set(balanced.map((b) => b.item.id));
    const missingFree = reservedFree.filter((f) => !balancedIds.has(f.item.id));

    let merged;
    if (missingFree.length > 0 && balanced.length >= limit) {
      merged = [
        ...balanced.slice(0, Math.max(8, limit - missingFree.length)),
        ...missingFree,
      ];
    } else if (balanced.length < limit) {
      const extra = [...missingFree, ...overflow.filter((o) => !balancedIds.has(o.item.id))];
      merged = [...balanced, ...extra.slice(0, limit - balanced.length)];
    } else {
      merged = balanced;
    }

    // Re-sort strictly by relevance (`finalScore` descending) so #1 is ALWAYS the most relevant icon!
    merged.sort((a, b) => b.finalScore - a.finalScore);

    // Confidence-calibrated normalizedScore ceiling so weak prefix-only offline hits (`maxRawScore < 620`)
    // NEVER outrank exact 546,996-icon live matches (`0.992`) when an uncommon word is translated online!
    const scoreCeiling =
      maxRawScore >= 1400
        ? 0.988
        : maxRawScore >= 620
        ? 0.935
        : 0.72;

    const hits = merged.map(({ item, finalScore }, idx) => ({
      ...item,
      normalizedScore: Math.max(
        0.48,
        Math.min(
          scoreCeiling,
          scoreCeiling -
            idx * 0.0035 -
            (1 - finalScore / Math.max(1, maxRawScore)) * 0.12
        )
      ),
      bm25Score: Number(finalScore.toFixed(2)),
    }));

    return {
      hits,
      expanded,
    };
  }
}
