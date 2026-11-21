import type { StickerAsset, VisualSearchResult } from '../../types/mindmap';
import { normalizeTrAscii } from './AcademicOntologyTR';

export interface BadgeDescriptor {
  emoji: string;
  labelTr: string;
  bgHex: string;
  svgInner: string; // Crisp vector micro-icon inside 46x46 badge circle (0,0..46,46)
}

export const CORNER_MICRO_BADGES: BadgeDescriptor[] = [
  {
    emoji: '🔒',
    labelTr: 'Şifreli / Güvenli',
    bgHex: '#8B5CF6',
    svgInner: `<rect x="13" y="21" width="20" height="15" rx="4" fill="#FEF08A" stroke="#1E293B" stroke-width="2.4"/><path d="M17 21 V16 A6 6 0 0 1 29 16 V21" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round"/>`,
  },
  {
    emoji: '⚡',
    labelTr: 'Yüksek Hız / Önbellek',
    bgHex: '#F59E0B',
    svgInner: `<polygon points="25,9 13,25 22,25 20,37 33,20 24,20" fill="#FEF08A" stroke="#1E293B" stroke-width="2.2" stroke-linejoin="round"/>`,
  },
  {
    emoji: '✅',
    labelTr: 'Onay / Kesinleşmiş',
    bgHex: '#10B981',
    svgInner: `<polyline points="13,24 20,31 34,15" fill="none" stroke="#FFFFFF" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    emoji: '❌',
    labelTr: 'Hata / Bozma / Ret',
    bgHex: '#F43F5E',
    svgInner: `<path d="M15 15 L31 31 M31 15 L15 31" stroke="#FFFFFF" stroke-width="4.2" stroke-linecap="round"/>`,
  },
  {
    emoji: '⚠️',
    labelTr: 'Kritik Uyarı / Darboğaz',
    bgHex: '#D97706',
    svgInner: `<polygon points="23,10 36,34 10,34" fill="#FEF08A" stroke="#1E293B" stroke-width="2.4" stroke-linejoin="round"/><line x1="23" y1="18" x2="23" y2="26" stroke="#1E293B" stroke-width="2.8" stroke-linecap="round"/><circle cx="23" cy="30.5" r="1.8" fill="#1E293B"/>`,
  },
  {
    emoji: '🔥',
    labelTr: 'Yüksek Trafik / Aktif',
    bgHex: '#EA580C',
    svgInner: `<path d="M23 10 C29 17, 34 21, 32 29 C30 35, 25 37, 21 36 C15 35, 13 29, 16 23 C18 26, 20 25, 20 21 C20 17, 21 13, 23 10 Z" fill="#FDE047" stroke="#1E293B" stroke-width="2.2" stroke-linejoin="round"/>`,
  },
  {
    emoji: '📡',
    labelTr: 'Kablosuz / Telemetri',
    bgHex: '#0EA5E9',
    svgInner: `<circle cx="23" cy="28" r="3.5" fill="#FFFFFF"/><path d="M16 22 A10 10 0 0 1 30 22 M12 17 A16 16 0 0 1 34 17" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round"/>`,
  },
  {
    emoji: '⚖️',
    labelTr: 'Hukuki / Denetim',
    bgHex: '#6D28D9',
    svgInner: `<line x1="23" y1="11" x2="23" y2="34" stroke="#FEF08A" stroke-width="2.8"/><line x1="13" y1="17" x2="33" y2="17" stroke="#FEF08A" stroke-width="2.8"/><circle cx="15" cy="25" r="4" fill="#FFFFFF"/><circle cx="31" cy="25" r="4" fill="#FFFFFF"/>`,
  },
  {
    emoji: '1️⃣',
    labelTr: 'Adım 1 / Birincil',
    bgHex: '#0284C7',
    svgInner: `<text x="23" y="30" text-anchor="middle" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="800" font-size="21" fill="#FFFFFF">1</text>`,
  },
  {
    emoji: '2️⃣',
    labelTr: 'Adım 2 / İkincil',
    bgHex: '#7C3AED',
    svgInner: `<text x="23" y="30" text-anchor="middle" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="800" font-size="21" fill="#FFFFFF">2</text>`,
  },
];

const QUALIFIER_TRIGGER_WORDS: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ['sifreli', 'guvenli', 'kilit', 'tls', 'ssl', 'https', 'oauth', 'jwt', 'auth', 'private', 'gizli'], emoji: '🔒' },
  { keywords: ['hizli', 'onbellek', 'cache', 'dusuk gecikme', 'turbo', 'anlik', 'sub ms', 'performans'], emoji: '⚡' },
  { keywords: ['onay', 'onama', 'kabul', 'kesin', 'dogrulama', 'basarili', 'saglikli'], emoji: '✅' },
  { keywords: ['hata', 'bozma', 'ret', 'red', 'iptal', 'kesinti', 'basarisiz', 'yasak'], emoji: '❌' },
  { keywords: ['uyari', 'kritik', 'darbogaz', 'risk', 'limit', 'asiri yuk'], emoji: '⚠️' },
  { keywords: ['kablosuz', 'rf', 'anten', 'uzaktan', 'canli akis', 'yayin'], emoji: '📡' },
  { keywords: ['kanun', 'hukuki', 'yargi', 'denetim', 'mevzuat', 'anayasal'], emoji: '⚖️' },
];

export function detectQualifierBadgeForQuery(query: string): BadgeDescriptor | null {
  const norm = normalizeTrAscii(query);
  if (!norm) return null;
  for (const rule of QUALIFIER_TRIGGER_WORDS) {
    if (rule.keywords.some((kw) => norm.includes(kw))) {
      return CORNER_MICRO_BADGES.find((b) => b.emoji === rule.emoji) ?? null;
    }
  }
  return null;
}

/**
 * Wraps any SVG Data URI with a crisp white-contoured corner micro-badge (`0ms` synchronous).
 */
export function composeSvgStickerWithBadge(baseSvgDataUri: string, badgeEmoji: string): string {
  const badge =
    CORNER_MICRO_BADGES.find((b) => b.emoji === badgeEmoji) ?? CORNER_MICRO_BADGES[0];
  const safeHref = baseSvgDataUri
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');

  const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <image href="${safeHref}" x="0" y="0" width="154" height="154" />
  <g transform="translate(104, 104)">
    <circle cx="23" cy="23" r="24" fill="#FFFFFF" stroke="#0F172A" stroke-opacity="0.14" stroke-width="1.5"/>
    <circle cx="23" cy="23" r="19.5" fill="${badge.bgHex}" stroke="#1E293B" stroke-width="2.4"/>
    ${badge.svgInner}
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(compositeSvg)}`;
}

/**
 * Composes any `StickerAsset` (SVG Data URI, Blob URL, or PNG/WebP) with a selected corner micro-badge.
 */
export async function applyCornerBadgeToStickerAsset(
  sticker: StickerAsset,
  badgeEmoji: string | null
): Promise<StickerAsset> {
  if (!badgeEmoji) {
    return sticker;
  }

  const badge =
    CORNER_MICRO_BADGES.find((b) => b.emoji === badgeEmoji) ?? CORNER_MICRO_BADGES[0];

  if (sticker.url.startsWith('data:image/svg+xml')) {
    return {
      ...sticker,
      id: `${sticker.id}_bdg_${badge.emoji}`,
      url: composeSvgStickerWithBadge(sticker.url, badge.emoji),
      badgeEmoji: badge.emoji,
    };
  }

  // Raster Canvas composition for PNG/WebP/Blob stickers
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      if (!sticker.url.startsWith('data:') && !sticker.url.startsWith('blob:')) {
        el.crossOrigin = 'anonymous';
      }
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Badge load failed'));
      el.src = sticker.url;
    });

    const badgeImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const badgeOnlySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="96" height="96">
        <circle cx="26" cy="26" r="24" fill="#FFFFFF" stroke="#0F172A" stroke-opacity="0.16" stroke-width="1.5"/>
        <g transform="translate(3,3)">
          <circle cx="23" cy="23" r="19.5" fill="${badge.bgHex}" stroke="#1E293B" stroke-width="2.4"/>
          ${badge.svgInner}
        </g>
      </svg>`;
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Badge vector failed'));
      el.src = `data:image/svg+xml;utf8,${encodeURIComponent(badgeOnlySvg)}`;
    });

    const size = 320;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    const drawW = ratio >= 1 ? size * 0.92 : size * 0.92 * ratio;
    const drawH = ratio >= 1 ? (size * 0.92) / ratio : size * 0.92;
    ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);

    const bSize = Math.round(size * 0.34);
    ctx.drawImage(badgeImg, size - bSize - 6, size - bSize - 6, bSize, bSize);

    const dataUrl = canvas.toDataURL('image/webp', 0.92);
    return {
      ...sticker,
      id: `${sticker.id}_bdg_${badge.emoji}`,
      url: dataUrl,
      aspectRatio: 1,
      badgeEmoji: badge.emoji,
    };
  } catch {
    return sticker;
  }
}

/**
 * Generates instant Composite Concept Stickers when a multi-word query contains qualifiers.
 */
export function buildInstantCompositeResults(
  query: string,
  baseResults: VisualSearchResult[]
): VisualSearchResult[] {
  const detected = detectQualifierBadgeForQuery(query);
  const svgCandidates = baseResults.filter((r) =>
    r.previewUrl.startsWith('data:image/svg+xml')
  );
  if (svgCandidates.length === 0) return [];

  // Attach corner micro-badges ONLY when the query explicitly asks for a qualifier (e.g. "şifreli", "hızlı", "onay")
  const badgesToCompose = detected ? [detected] : [];

  const composites: VisualSearchResult[] = [];
  badgesToCompose.forEach((bdg, idx) => {
    const base = svgCandidates[idx % svgCandidates.length];
    if (!base) return;
    const compUri = composeSvgStickerWithBadge(base.previewUrl, bdg.emoji);
    composites.push({
      id: `comp_${base.id}_${bdg.emoji}`,
      title: `${base.title} • ${bdg.labelTr}`,
      previewUrl: compUri,
      rawUrl: compUri,
      mode: 'illustration',
      category: base.category,
      source: 'library',
      needsDieCut: false,
      aspectRatio: 1,
      score: 0.93 - idx * 0.02,
      providerName: 'Kompozit Çıkartma',
    });
  });

  return composites;
}
