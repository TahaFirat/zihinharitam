import type { CanvasInkStroke } from '../../types/mindmap';

/**
 * High-performance World-Space Vector Ink Engine for 120Hz Tablet & Apple Pencil / S-Pen Drawing.
 * - Quadratic midpoint Bezier smoothing for silky handwriting & highlighting (`pen`, `highlighter`).
 * - Precision geometric shapes (`line`, `arrow`, `rect`, `ellipse`) around mind-map branches.
 * - Fast bounding-box + segment distance hit-testing for instant swipe-to-erase (`eraser`).
 */

export function buildInkSvgPath(
  tool: CanvasInkStroke['tool'],
  points: Array<[number, number, number]>,
  strokeWidth = 3.5
): string {
  if (!points || points.length === 0) return '';

  const p0 = points[0];
  const pLast = points[points.length - 1];

  if (tool === 'line') {
    return `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} L ${pLast[0].toFixed(1)} ${pLast[1].toFixed(1)}`;
  }

  if (tool === 'arrow') {
    const x1 = p0[0];
    const y1 = p0[1];
    const x2 = pLast[0];
    const y2 = pLast[1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 3) {
      return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(12, Math.min(28, strokeWidth * 3.6 + len * 0.08));
    const spread = Math.PI / 6.2;
    const lx = x2 - headLen * Math.cos(angle - spread);
    const ly = y2 - headLen * Math.sin(angle - spread);
    const rx = x2 - headLen * Math.cos(angle + spread);
    const ry = y2 - headLen * Math.sin(angle + spread);
    return (
      `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} ` +
      `M ${lx.toFixed(1)} ${ly.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)}`
    );
  }

  if (tool === 'rect') {
    const minX = Math.min(p0[0], pLast[0]);
    const minY = Math.min(p0[1], pLast[1]);
    const w = Math.max(2, Math.abs(pLast[0] - p0[0]));
    const h = Math.max(2, Math.abs(pLast[1] - p0[1]));
    const r = Math.min(14, w * 0.2, h * 0.2);
    return (
      `M ${(minX + r).toFixed(1)} ${minY.toFixed(1)} ` +
      `H ${(minX + w - r).toFixed(1)} Q ${(minX + w).toFixed(1)} ${minY.toFixed(1)} ${(minX + w).toFixed(1)} ${(minY + r).toFixed(1)} ` +
      `V ${(minY + h - r).toFixed(1)} Q ${(minX + w).toFixed(1)} ${(minY + h).toFixed(1)} ${(minX + w - r).toFixed(1)} ${(minY + h).toFixed(1)} ` +
      `H ${(minX + r).toFixed(1)} Q ${minX.toFixed(1)} ${(minY + h).toFixed(1)} ${minX.toFixed(1)} ${(minY + h - r).toFixed(1)} ` +
      `V ${(minY + r).toFixed(1)} Q ${minX.toFixed(1)} ${minY.toFixed(1)} ${(minX + r).toFixed(1)} ${minY.toFixed(1)} Z`
    );
  }

  if (tool === 'ellipse') {
    const cx = (p0[0] + pLast[0]) * 0.5;
    const cy = (p0[1] + pLast[1]) * 0.5;
    const rx = Math.max(2, Math.abs(pLast[0] - p0[0]) * 0.5);
    const ry = Math.max(2, Math.abs(pLast[1] - p0[1]) * 0.5);
    return (
      `M ${(cx - rx).toFixed(1)} ${cy.toFixed(1)} ` +
      `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(cx + rx).toFixed(1)} ${cy.toFixed(1)} ` +
      `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(cx - rx).toFixed(1)} ${cy.toFixed(1)} Z`
    );
  }

  // Freehand `pen` / `highlighter` — smooth quadratic midpoint spline
  if (points.length === 1) {
    return `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} l 0.5 0.5`;
  }

  let d = `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)}`;
  if (points.length === 2) {
    return `${d} L ${pLast[0].toFixed(1)} ${pLast[1].toFixed(1)}`;
  }

  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const midX = (cur[0] + next[0]) * 0.5;
    const midY = (cur[1] + next[1]) * 0.5;
    d += ` Q ${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  d += ` L ${pLast[0].toFixed(1)} ${pLast[1].toFixed(1)}`;
  return d;
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) {
    const ex = px - ax;
    const ey = py - ay;
    return ex * ex + ey * ey;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return ex * ex + ey * ey;
}

export function hitTestInkStroke(
  stroke: CanvasInkStroke,
  worldX: number,
  worldY: number,
  eraserRadiusWorld: number
): boolean {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;
  const hitR = eraserRadiusWorld + stroke.width * 0.6;
  const hitRSq = hitR * hitR;

  if (stroke.tool === 'rect' && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    const minX = Math.min(a[0], b[0]);
    const maxX = Math.max(a[0], b[0]);
    const minY = Math.min(a[1], b[1]);
    const maxY = Math.max(a[1], b[1]);
    if (worldX < minX - hitR || worldX > maxX + hitR || worldY < minY - hitR || worldY > maxY + hitR) {
      return false;
    }
    return (
      pointToSegmentDistSq(worldX, worldY, minX, minY, maxX, minY) <= hitRSq ||
      pointToSegmentDistSq(worldX, worldY, maxX, minY, maxX, maxY) <= hitRSq ||
      pointToSegmentDistSq(worldX, worldY, maxX, maxY, minX, maxY) <= hitRSq ||
      pointToSegmentDistSq(worldX, worldY, minX, maxY, minX, minY) <= hitRSq
    );
  }

  if (stroke.tool === 'ellipse' && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    const cx = (a[0] + b[0]) * 0.5;
    const cy = (a[1] + b[1]) * 0.5;
    const rx = Math.max(4, Math.abs(b[0] - a[0]) * 0.5);
    const ry = Math.max(4, Math.abs(b[1] - a[1]) * 0.5);
    const nx = (worldX - cx) / rx;
    const ny = (worldY - cy) / ry;
    const normDist = Math.hypot(nx, ny);
    const tol = hitR / Math.max(8, Math.min(rx, ry));
    return Math.abs(normDist - 1) <= Math.max(0.18, tol);
  }

  if (pts.length === 1) {
    const dx = worldX - pts[0][0];
    const dy = worldY - pts[0][1];
    return dx * dx + dy * dy <= hitRSq;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    if (
      pointToSegmentDistSq(
        worldX,
        worldY,
        pts[i][0],
        pts[i][1],
        pts[i + 1][0],
        pts[i + 1][1]
      ) <= hitRSq
    ) {
      return true;
    }
  }
  return false;
}

export function drawInkStrokesToCanvas2D(
  ctx: CanvasRenderingContext2D,
  strokes: CanvasInkStroke[] | undefined
): void {
  if (!strokes || strokes.length === 0) return;
  for (const s of strokes) {
    const d = buildInkSvgPath(s.tool, s.points, s.width);
    if (!d) continue;
    ctx.save();
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    try {
      ctx.stroke(new Path2D(d));
    } catch {
      // Ignore fallback
    }
    ctx.restore();
  }
}

export function generateInkStrokesSvgElements(
  strokes: CanvasInkStroke[] | undefined
): string {
  if (!strokes || strokes.length === 0) return '';
  return strokes
    .map((s) => {
      const d = buildInkSvgPath(s.tool, s.points, s.width);
      if (!d) return '';
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .filter(Boolean)
    .join('\n');
}
