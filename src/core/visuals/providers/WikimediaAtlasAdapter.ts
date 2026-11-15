import type { VisualSearchResult } from '../../../types/mindmap';

const BANNED_TITLE_TOKENS = [
  '.pdf',
  '.djvu',
  '.tif',
  '.tiff',
  '.ogg',
  '.webm',
  '.ogv',
  'page ',
  'scan ',
  'scanned',
  'newspaper',
  'signature',
  'autograph',
];

/**
 * Source 6: Wikimedia Scientific Atlas & Isolated Photo Engine (`origin=*`)
 * Strictly filters out ugly scanned PDF/DjVu textbook pages, returning clean SVG diagrams
 * and crisp academic/architectural/anatomical visuals.
 */
export async function searchWikimediaAtlas(
  englishTerms: string[],
  wikiThumbnailUrl?: string,
  wikiTitle?: string,
  signal?: AbortSignal
): Promise<VisualSearchResult[]> {
  const primary = englishTerms[0]?.trim();
  if (!primary) return [];

  const results: VisualSearchResult[] = [];

  // 1. Direct Encyclopedia Article Lead Image from CrossLingualWikiBridge (highest precision!)
  if (wikiThumbnailUrl) {
    results.push({
      id: `wikibridge_lead_${encodeURIComponent(wikiTitle || primary)}`,
      title: wikiTitle || primary,
      previewUrl: wikiThumbnailUrl,
      rawUrl: wikiThumbnailUrl,
      mode: 'photo',
      category: 'photo',
      source: 'library',
      needsDieCut: true,
      aspectRatio: 1,
      score: 0.93,
      providerName: 'Wikipedia Ansiklopedi Atlası',
    });
  }

  // 2. Parallel Commons Query A (Vector SVG Diagrams) & Query B (Clean Object/Anatomy/Architecture Photos)
  const queries: Array<{ q: string; mode: 'diagram' | 'photo'; cat: 'diagram' | 'photo' }> = [
    {
      q: `${primary} diagram OR anatomy OR schematic OR architecture filetype:svg`,
      mode: 'diagram',
      cat: 'diagram',
    },
    {
      q: `${primary} filetype:bitmap`,
      mode: 'photo',
      cat: 'photo',
    },
  ];

  const settled = await Promise.allSettled(
    queries.map(async ({ q, mode, cat }) => {
      const endpoint =
        `https://commons.wikimedia.org/w/api.php?action=query` +
        `&generator=search&gsrnamespace=6&gsrlimit=12` +
        `&gsrsearch=${encodeURIComponent(q)}` +
        `&prop=imageinfo&iiprop=url|mime&iiurlwidth=360` +
        `&format=json&origin=*`;

      const res = await fetch(endpoint, { signal });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }>;
            }
          >;
        };
      };

      const pages = Object.values(json.query?.pages ?? {});
      const items: VisualSearchResult[] = [];

      for (const page of pages) {
        const lowerTitle = page.title.toLowerCase();
        if (BANNED_TITLE_TOKENS.some((tok) => lowerTitle.includes(tok))) continue;

        const info = page.imageinfo?.[0];
        if (!info) continue;
        const mime = (info.mime ?? '').toLowerCase();
        if (!mime.startsWith('image/')) continue;
        if (mime.includes('tiff') || mime.includes('djvu') || mime.includes('gif')) continue;

        const thumb = info.thumburl || info.url;
        if (!thumb) continue;

        const cleanTitle = page.title
          .replace(/^File:/i, '')
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/[_-]+/g, ' ')
          .trim()
          .slice(0, 52);

        items.push({
          id: `wiki_${mode}_${page.pageid}`,
          title: cleanTitle,
          previewUrl: thumb,
          rawUrl: thumb,
          mode,
          category: cat,
          source: 'library',
          needsDieCut: true,
          aspectRatio: 1,
          score: (mode === 'diagram' ? 0.87 : 0.83) - items.length * 0.012,
          providerName: mode === 'diagram' ? 'Wikimedia Vektör Şema' : 'Wikimedia Commons',
        });
      }

      return items;
    })
  );

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(...s.value);
    }
  }

  return results;
}
