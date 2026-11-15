import type { VisualSearchResult } from '../../../types/mindmap';

interface OpenverseResultRow {
  id: string;
  title?: string;
  thumbnail?: string;
  url?: string;
  category?: string;
}

/**
 * Source 7: Openverse Global Creative Commons Visual Search (CORS-open anonymous endpoint)
 */
export async function searchOpenverseVisuals(
  englishQuery: string,
  signal?: AbortSignal
): Promise<VisualSearchResult[]> {
  const q = englishQuery.trim();
  if (!q || q.length < 2) return [];

  const endpoint =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}` +
    `&license_type=commercial,modification&page_size=16`;

  try {
    const res = await fetch(endpoint, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: OpenverseResultRow[] };
    const rows = data.results ?? [];

    const out: VisualSearchResult[] = [];
    for (const row of rows) {
      const imgUrl = row.thumbnail || row.url;
      if (!imgUrl || !imgUrl.startsWith('https://')) continue;

      const isIllustration = row.category === 'illustration' || imgUrl.endsWith('.svg');
      out.push({
        id: `openverse_${row.id}`,
        title: (row.title || q).slice(0, 48),
        previewUrl: imgUrl,
        rawUrl: imgUrl,
        mode: isIllustration ? 'illustration' : 'photo',
        category: isIllustration ? 'hand_drawn' : 'photo',
        source: 'library',
        needsDieCut: true,
        aspectRatio: 1,
        score: 0.80 - out.length * 0.01,
        providerName: 'Openverse CC',
      });

      if (out.length >= 14) break;
    }

    return out;
  } catch {
    return [];
  }
}
