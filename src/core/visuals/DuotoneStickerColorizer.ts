/**
 * DuotoneStickerColorizer (Module 1 — BAN 3 Enforcement)
 *
 * Converts ANY monochrome specialist vector icon (`healthicons`, `game-icons`, `carbon`,
 * `ph`, `lucide`, `tabler`, `mdi`) into a rich 3-tone colorful Die-Cut Sticker harmonized
 * with the active `branchColor` (or discipline accent), wrapped in a crisp `#FFFFFF` die-cut contour.
 * Raw black/monochrome (`#000` / `currentColor`) icons are NEVER rendered directly!
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 14,
      g: parseInt(clean[1] + clean[1], 16) || 165,
      b: parseInt(clean[2] + clean[2], 16) || 233,
    };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) {
    return { r: 14, g: 165, b: 233 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslCss(h: number, s: number, l: number, alpha?: number): string {
  const normH = ((h % 360) + 360) % 360;
  if (alpha !== undefined) {
    return `hsla(${normH}, ${s}%, ${l}%, ${alpha})`;
  }
  return `hsl(${normH}, ${s}%, ${l}%)`;
}

export const DUOTONE_HARMONY_PALETTE = [
  '#0EA5E9', // Sky
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#0284C7', // Deep Cyan
  '#D97706', // Ochre
] as const;

/**
 * Sanitizes monochrome fills/strokes in raw SVG icon bodies so they adopt the rich deep chromatic ink.
 */
function recolorSvgBodyMarkup(rawBody: string, deepInkColor: string, midToneColor: string): string {
  return rawBody
    .replace(/currentColor/gi, deepInkColor)
    .replace(/fill="#000000"|fill="#000"|fill="black"/gi, `fill="${deepInkColor}"`)
    .replace(/stroke="#000000"|stroke="#000"|stroke="black"/gi, `stroke="${deepInkColor}"`)
    .replace(/fill="#fff"|fill="#ffffff"|fill="white"/gi, `fill="${midToneColor}"`);
}

/**
 * Colorizes an Iconify `{ body, width, height }` icon into a vibrant 3-tone Die-Cut Sticker Data URI.
 */
export function buildDuotoneStickerDataUri(
  iconBody: string,
  iconWidth = 24,
  iconHeight = 24,
  accentHex = '#0EA5E9',
  variantIndex = 0
): string {
  const { h } = rgbToHsl(hexToRgb(accentHex));
  const compHue = (h + (variantIndex % 2 === 0 ? 38 : -36) + 360) % 360;

  const pastelBg = hslCss(h, 78, 95);
  const pastelBgEnd = hslCss(h, 68, 90);
  const softRibbon = hslCss(h, 84, 62, 0.24);
  const warmSpark = hslCss(compHue, 88, 66, 0.42);
  const borderAccent = hslCss(h, 72, 74);
  const deepInk = hslCss(h, 76, 23);
  const highlightFill = '#FFFFFF';

  const cleanBody = recolorSvgBodyMarkup(iconBody, deepInk, highlightFill);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pastelBg}"/>
      <stop offset="100%" stop-color="${pastelBgEnd}"/>
    </linearGradient>
    <filter id="stickerShadow" x="-18%" y="-18%" width="136%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0F172A" flood-opacity="0.15"/>
    </filter>
  </defs>
  <g filter="url(#stickerShadow)">
    <rect x="14" y="14" width="132" height="132" rx="38" fill="#FFFFFF" stroke="#0F172A" stroke-opacity="0.10" stroke-width="1.5"/>
    <rect x="22" y="22" width="116" height="116" rx="30" fill="url(#bgGrad)" stroke="${borderAccent}" stroke-width="2.5"/>
    <circle cx="106" cy="54" r="30" fill="${softRibbon}"/>
    <circle cx="52" cy="110" r="18" fill="${warmSpark}"/>
    <svg x="38" y="38" width="84" height="84" viewBox="0 0 ${iconWidth} ${iconHeight}" fill="${deepInk}" color="${deepInk}">
      ${cleanBody}
    </svg>
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Re-tints an existing raw SVG markup string (`<svg ...>...</svg>` or inner body) to match a target `branchColor`.
 */
export function retintRawSvgMarkupToBranch(rawSvgMarkup: string, branchColor: string): string {
  const viewBoxMatch = rawSvgMarkup.match(/viewBox=["']([^"']+)["']/i);
  let w = 24;
  let h = 24;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      w = parts[2];
      h = parts[3];
    }
  }
  const inner = rawSvgMarkup
    .replace(/^[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();

  return buildDuotoneStickerDataUri(inner || rawSvgMarkup, w, h, branchColor, 0);
}
