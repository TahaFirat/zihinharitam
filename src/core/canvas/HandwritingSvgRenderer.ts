import type {
  HandwrittenConceptAsset,
  HandwrittenConceptStroke,
} from '../../types/mindmap';

export const ADAPTIVE_INK_LIGHT = '#0F172A';
export const ADAPTIVE_INK_DARK = '#F8FAFC';

/**
 * Resolves stroke ink color cleanly across Light & Dark themes:
 * adaptive default ink auto-inverts so handwriting NEVER disappears in Dark Mode,
 * while user-chosen colored inks (branch color, blue, red, emerald, etc.) remain faithful!
 */
export function resolveHandwritingStrokeColor(
  stroke: HandwrittenConceptStroke,
  darkMode: boolean
): string {
  const isDefaultInk =
    stroke.adaptive === true ||
    stroke.color.toLowerCase() === ADAPTIVE_INK_LIGHT.toLowerCase() ||
    stroke.color.toLowerCase() === '#1e293b' ||
    stroke.color.toLowerCase() === ADAPTIVE_INK_DARK.toLowerCase();
  if (isDefaultInk) {
    return darkMode ? ADAPTIVE_INK_DARK : ADAPTIVE_INK_LIGHT;
  }
  return stroke.color;
}

/**
 * Decimates dense 120Hz/240Hz pointer samples so saved JSON is compact (<4 KB per concept)
 * while preserving razor-sharp handwritten letter curves!
 */
export function simplifyHandwritingPoints(
  points: Array<[number, number, number]>,
  minDistance = 2.0
): Array<[number, number, number]> {
  if (points.length <= 2) {
    return points.map(([x, y, p]) => [
      Math.round(x * 10) / 10,
      Math.round(y * 10) / 10,
      Math.round(p * 100) / 100,
    ]);
  }
  const out: Array<[number, number, number]> = [
    [
      Math.round(points[0][0] * 10) / 10,
      Math.round(points[0][1] * 10) / 10,
      Math.round(points[0][2] * 100) / 100,
    ],
  ];
  let last = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    if (Math.hypot(cur[0] - last[0], cur[1] - last[1]) >= minDistance) {
      out.push([
        Math.round(cur[0] * 10) / 10,
        Math.round(cur[1] * 10) / 10,
        Math.round(cur[2] * 100) / 100,
      ]);
      last = cur;
    }
  }
  const tail = points[points.length - 1];
  out.push([
    Math.round(tail[0] * 10) / 10,
    Math.round(tail[1] * 10) / 10,
    Math.round(tail[2] * 100) / 100,
  ]);
  return out;
}

/**
 * Builds a silky quadratic Bezier SVG path for a handwritten stroke.
 * Single-tap dots (e.g. Turkish `i`, `ö`, `ü`, `ş` dots!) emit a crisp micro-segment
 * rendered as a clean circular dot with `stroke-linecap="round"`.
 */
export function buildHandwritingStrokePath(
  points: Array<[number, number, number]>
): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + 0.15).toFixed(1)} ${y.toFixed(1)}`;
  }
  if (points.length === 2) {
    return `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} L ${points[1][0].toFixed(
      1
    )} ${points[1][1].toFixed(1)}`;
  }
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) * 0.5;
    const my = (points[i][1] + points[i + 1][1]) * 0.5;
    d += ` Q ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}

/**
 * Computes tightly cropped vector bounding box & metadata for a set of handwritten strokes.
 * Returns `null` if there are no visible strokes.
 */
export function buildHandwrittenConceptAsset(
  rawStrokes: HandwrittenConceptStroke[],
  heightPx = 64
): HandwrittenConceptAsset | null {
  const validStrokes = rawStrokes
    .filter((s) => Array.isArray(s.points) && s.points.length > 0)
    .map((s) => ({
      ...s,
      points: simplifyHandwritingPoints(s.points),
    }));
  if (validStrokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxW = 4;

  for (const st of validStrokes) {
    maxW = Math.max(maxW, st.width || 4);
    for (const [x, y] of st.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const pad = Math.max(10, maxW * 1.6);
  const rawW = Math.max(36, maxX - minX + pad * 2);
  const rawH = Math.max(28, maxY - minY + pad * 2);
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  const viewBox = {
    x: Math.round((cx - rawW * 0.5) * 10) / 10,
    y: Math.round((cy - rawH * 0.5) * 10) / 10,
    w: Math.round(rawW * 10) / 10,
    h: Math.round(rawH * 10) / 10,
  };

  return {
    strokes: validStrokes,
    viewBox,
    aspectRatio: Math.max(0.5, Math.min(7.5, viewBox.w / Math.max(1, viewBox.h))),
    heightPx: Math.max(38, Math.min(110, Math.round(heightPx))),
    updatedAt: Date.now(),
  };
}

/**
 * Computes responsive world-pixel render dimensions (`renderW`, `renderH`) for a handwritten concept
 * so short 1-letter symbols AND wide multi-word handwritten headings both look crisp & balanced!
 */
export function resolveHandwritingRenderBox(
  asset: HandwrittenConceptAsset,
  isRoot: boolean
): { renderW: number; renderH: number } {
  const baseH = asset.heightPx ?? (isRoot ? 78 : 60);
  const targetH = isRoot ? Math.max(baseH, 68) : baseH;
  const aspect = Math.max(0.55, Math.min(6.5, asset.aspectRatio || asset.viewBox.w / Math.max(1, asset.viewBox.h)));

  const maxW = isRoot ? 330 : 285;
  const minW = isRoot ? 96 : 74;

  let renderW = Math.round(targetH * aspect);
  let renderH = Math.round(targetH);

  if (renderW > maxW) {
    renderW = maxW;
    renderH = Math.max(34, Math.round(renderW / aspect));
  } else if (renderW < minW) {
    renderW = minW;
  }

  return { renderW, renderH };
}

/**
 * Hit-tests whether a point `(x, y)` in pad coordinates touches a stroke (for instant Stroke Eraser!).
 */
export function hitTestHandwritingStroke(
  stroke: HandwrittenConceptStroke,
  px: number,
  py: number,
  tolerance = 14
): boolean {
  const r = Math.max(tolerance, (stroke.width || 4) * 1.6);
  const r2 = r * r;
  const pts = stroke.points;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i][0] - px;
    const dy = pts[i][1] - py;
    if (dx * dx + dy * dy <= r2) return true;
    if (i > 0) {
      // Check segment midpoint too so fast pen swipes are never missed by the eraser
      const mx = (pts[i - 1][0] + pts[i][0]) * 0.5 - px;
      const my = (pts[i - 1][1] + pts[i][1]) * 0.5 - py;
      if (mx * mx + my * my <= r2) return true;
    }
  }
  return false;
}

/**
 * Renders a node's handwritten concept strokes directly to a 2D Canvas (for 300 DPI PNG & PDF exports!).
 */
export function drawHandwritingToCanvas2D(
  ctx: CanvasRenderingContext2D,
  asset: HandwrittenConceptAsset,
  centerX: number,
  topY: number,
  renderW: number,
  renderH: number,
  darkMode: boolean
): void {
  const vb = asset.viewBox;
  if (!vb || vb.w <= 0 || vb.h <= 0 || !asset.strokes?.length) return;

  const scale = Math.min(renderW / vb.w, renderH / vb.h);
  const drawnW = vb.w * scale;
  const drawnH = vb.h * scale;
  const ox = centerX - drawnW * 0.5 - vb.x * scale;
  const oy = topY + (renderH - drawnH) * 0.5 - vb.y * scale;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const st of asset.strokes) {
    if (!st.points || st.points.length === 0) continue;
    const col = resolveHandwritingStrokeColor(st, darkMode);
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = st.width || 5;

    if (st.points.length === 1) {
      const [x, y] = st.points[0];
      ctx.beginPath();
      ctx.arc(x, y, (st.width || 5) * 0.5, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(st.points[0][0], st.points[0][1]);
    for (let i = 1; i < st.points.length - 1; i++) {
      const mx = (st.points[i][0] + st.points[i + 1][0]) * 0.5;
      const my = (st.points[i][1] + st.points[i + 1][1]) * 0.5;
      ctx.quadraticCurveTo(st.points[i][0], st.points[i][1], mx, my);
    }
    const last = st.points[st.points.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Generates crisp inline SVG markup for Vector SVG export of a handwritten concept.
 */
export function buildHandwritingExportSvgGroup(
  asset: HandwrittenConceptAsset,
  centerX: number,
  topY: number,
  renderW: number,
  renderH: number,
  darkMode: boolean
): string {
  const vb = asset.viewBox;
  if (!vb || vb.w <= 0 || vb.h <= 0 || !asset.strokes?.length) return '';

  const scale = Math.min(renderW / vb.w, renderH / vb.h);
  const drawnW = vb.w * scale;
  const drawnH = vb.h * scale;
  const ox = centerX - drawnW * 0.5 - vb.x * scale;
  const oy = topY + (renderH - drawnH) * 0.5 - vb.y * scale;

  const paths = asset.strokes
    .filter((st) => st.points && st.points.length > 0)
    .map((st) => {
      const d = buildHandwritingStrokePath(st.points);
      const col = resolveHandwritingStrokeColor(st, darkMode);
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${st.width || 5}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join('');

  return `<g transform="translate(${ox.toFixed(1)}, ${oy.toFixed(1)}) scale(${scale.toFixed(4)})">${paths}</g>`;
}
