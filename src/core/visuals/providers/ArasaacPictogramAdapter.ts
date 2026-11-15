import type { VisualSearchResult } from '../../../types/mindmap';

interface ArasaacEntry {
  _id: number;
  keywords?: Array<{ keyword?: string }>;
}

/**
 * Source 2: ARASAAC Open Educational Hand-Drawn Pictogram Engine (14,000+ colorful drawings, native TR + EN!)
 * Queries both `/tr/search/` and `/en/search/` in parallel for authentic hand-drawn educational illustrations.
 */
export async function searchArasaacPictograms(
  turkishTerms: string[],
  englishTerms: string[],
  signal?: AbortSignal
): Promise<VisualSearchResult[]> {
  const trPrimary = turkishTerms[0]?.trim();
  const enPrimary = englishTerms[0]?.trim();
  const enSecondary = englishTerms[1]?.trim();

  const endpoints: Array<{ url: string; lang: 'tr' | 'en'; fallbackLabel: string }> = [];

  if (trPrimary && trPrimary.length >= 2) {
    endpoints.push({
      url: `https://api.arasaac.org/v1/pictograms/tr/search/${encodeURIComponent(trPrimary)}`,
      lang: 'tr',
      fallbackLabel: trPrimary,
    });
  }
  if (enPrimary && enPrimary.length >= 2) {
    endpoints.push({
      url: `https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(enPrimary)}`,
      lang: 'en',
      fallbackLabel: enPrimary,
    });
  }
  if (enSecondary && enSecondary !== enPrimary && enSecondary.length >= 2) {
    endpoints.push({
      url: `https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(enSecondary)}`,
      lang: 'en',
      fallbackLabel: enSecondary,
    });
  }

  if (endpoints.length === 0) return [];

  const settled = await Promise.allSettled(
    endpoints.map(async (ep) => {
      const res = await fetch(ep.url, { signal });
      if (!res.ok) return [];
      const json = (await res.json()) as ArasaacEntry[];
      if (!Array.isArray(json)) return [];
      return json.slice(0, 14).map((item, idx) => ({
        id: item._id,
        label: item.keywords?.[0]?.keyword || ep.fallbackLabel,
        rankBoost: ep.lang === 'tr' ? 0.04 : 0,
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
        title: hit.label,
        previewUrl: pngUrl,
        rawUrl: pngUrl,
        mode: 'illustration',
        category: 'hand_drawn',
        source: 'library',
        needsDieCut: true,
        aspectRatio: 1,
        score: 0.90 + hit.rankBoost - results.length * 0.008,
        providerName: 'ARASAAC El Çizimi',
      });

      if (results.length >= 22) break;
    }
  }

  return results;
}
