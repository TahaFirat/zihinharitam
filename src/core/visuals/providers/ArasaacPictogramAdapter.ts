import type { VisualSearchResult } from '../../../types/mindmap';

interface ArasaacEntry {
  _id: number;
  keywords?: Array<{ keyword?: string }>;
}

/**
 * Source 2: ARASAAC Open Educational Hand-Drawn Pictogram Engine (14,000+ colorful drawings, native TR + EN!)
 * Queries both `/tr/search/` and `/en/search/` in parallel (including multi-word real-world phrases!)
 * so everyday physical objects (`tablet kılıfı`, `diş fırçası`, `tırnak makası`, `ütü masası`, etc.) ALWAYS have rich visuals.
 */
export async function searchArasaacPictograms(
  turkishTerms: string[],
  englishTerms: string[],
  signal?: AbortSignal
): Promise<VisualSearchResult[]> {
  const cleanPhrase = (w?: string): string | null => {
    const s = (w || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (s.length < 2 || s.length > 40) return null;
    return s;
  };

  const trPrimary = cleanPhrase(turkishTerms[0]);
  const enPrimary = cleanPhrase(englishTerms[0]);
  const enSecondary = cleanPhrase(englishTerms[1]);

  const endpoints: Array<{ url: string; fallbackLabel: string; boost: number }> = [];
  const seenUrls = new Set<string>();
  const addEp = (lang: 'tr' | 'en', term: string | null, boost: number) => {
    if (!term) return;
    const url = `https://api.arasaac.org/v1/pictograms/${lang}/search/${encodeURIComponent(term)}`;
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    endpoints.push({ url, fallbackLabel: term, boost });
  };

  addEp('en', enPrimary, 0.02);
  addEp('tr', trPrimary, 0.015);
  if (enSecondary && enSecondary !== enPrimary) {
    addEp('en', enSecondary, 0);
  }

  if (endpoints.length === 0) return [];

  const settled = await Promise.allSettled(
    endpoints.map(async (ep) => {
      const res = await fetch(ep.url, { signal });
      if (!res.ok) return [];
      const json = (await res.json()) as ArasaacEntry[];
      if (!Array.isArray(json)) return [];
      return json.slice(0, 8).map((item, idx) => ({
        id: item._id,
        label: item.keywords?.[0]?.keyword || ep.fallbackLabel,
        rankBoost: ep.boost,
        idx,
      }));
    })
  );

  const seenIds = new Set<number>();
  const results: VisualSearchResult[] = [];

  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const hit of s.value) {
      if (!hit.id || seenIds.has(hit.id)) continue;
      seenIds.add(hit.id);

      const pngUrl = `https://static.arasaac.org/pictograms/${hit.id}/${hit.id}_500.png`;
      results.push({
        id: `arasaac_${hit.id}`,
        title: hit.label.replace(/\b\w/g, (c) => c.toUpperCase()),
        previewUrl: pngUrl,
        rawUrl: pngUrl,
        mode: 'illustration',
        category: 'hand_drawn',
        source: 'library',
        needsDieCut: false,
        aspectRatio: 1,
        score: 0.875 + hit.rankBoost - results.length * 0.008,
        providerName: 'ARASAAC El Çizimi',
        tier: 'pro',
      });

      if (results.length >= 16) break;
    }
  }

  return results;
}
