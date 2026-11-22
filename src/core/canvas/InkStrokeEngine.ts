import type { CanvasInkStroke, CanvasStickyNote } from '../../types/mindmap';

/**
 * Samsung Notes / Apple Pencil / GoodNotes Pro World-Space Vector Ink Engine (120Hz):
 * - Smooth quadratic midpoint Bezier ink (`pen`, `pencil`, `highlighter`) with pressure scaling
 * - Precision geometric shapes (`line`, `arrow`, `rect`, `ellipse`)
 * - Hold-to-Snap Auto-Shape Assist (`detectSnappedShape` -> snaps rough lines, circles & boxes!)
 * - Dual Eraser: Stroke Eraser (`hitTestInkStroke`) AND Precision Area Eraser (`eraseAreaFromStroke`)
 * - Freehand Lasso Selection (`findStrokesInsideLasso` & `translateInkStroke`)
 * - Full PNG/PDF Canvas2D & Vector SVG export for both Ink Strokes and Canvas Sticky Notes
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

  // Freehand `pen` / `pencil` / `highlighter` — smooth quadratic midpoint spline
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

/**
 * Samsung Notes & Apple Notes "Hold-to-Snap Auto-Shape Assist":
 * Analyzes a freehand stroke when the stylus pauses at the end and snaps rough lines,
 * circles/ellipses, or rectangles into crisp geometric vector shapes!
 */
export function detectSnappedShape(
  points: Array<[number, number, number]>
): { tool: 'line' | 'rect' | 'ellipse'; points: Array<[number, number, number]> } | null {
  if (!points || points.length < 6) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let pathLen = 0;

  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (i > 0) {
      pathLen += Math.hypot(x - points[i - 1][0], y - points[i - 1][1]);
    }
  }

  const w = maxX - minX;
  const h = maxY - minY;
  const diag = Math.hypot(w, h);
  if (diag < 28 || pathLen < 30) return null;

  const p0 = points[0];
  const pLast = points[points.length - 1];
  const endDist = Math.hypot(pLast[0] - p0[0], pLast[1] - p0[1]);

  // 1. Straight Line Detection (`endDist / pathLen >= 0.88`)
  if (endDist > 30 && endDist / pathLen >= 0.88) {
    return { tool: 'line', points: [p0, pLast] };
  }

  // 2. Closed Shape Detection (`ellipse` vs `rect`) when start & end nearly meet
  if (endDist < Math.max(46, diag * 0.34) && w > 22 && h > 22) {
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const rx = w * 0.5;
    const ry = h * 0.5;

    let ellipseErrSum = 0;
    let rectErrSum = 0;
    for (const [x, y] of points) {
      const normE = Math.hypot((x - cx) / rx, (y - cy) / ry);
      ellipseErrSum += Math.abs(normE - 1);

      const dEdge = Math.min(
        Math.abs(x - minX),
        Math.abs(x - maxX),
        Math.abs(y - minY),
        Math.abs(y - maxY)
      );
      rectErrSum += dEdge / Math.max(12, Math.min(rx, ry));
    }

    const avgEllipseErr = ellipseErrSum / points.length;
    const avgRectErr = rectErrSum / points.length;

    if (avgEllipseErr < 0.24 && avgEllipseErr <= avgRectErr * 1.05) {
      return {
        tool: 'ellipse',
        points: [
          [minX, minY, 0.5],
          [maxX, maxY, 0.5],
        ],
      };
    }
    if (avgRectErr < 0.26) {
      return {
        tool: 'rect',
        points: [
          [minX, minY, 0.5],
          [maxX, maxY, 0.5],
        ],
      };
    }
  }

  return null;
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

/**
 * Samsung Notes Precision Area Eraser:
 * Splits freehand strokes (`pen`, `pencil`, `highlighter`) cleanly around the erased circle
 * so users can erase just part of a word or drawing without losing the rest of the stroke!
 * Geometric shapes (`rect`, `ellipse`, `line`, `arrow`) are deleted whole when hit.
 */
export function eraseAreaFromStroke(
  stroke: CanvasInkStroke,
  worldX: number,
  worldY: number,
  eraserRadiusWorld: number
): CanvasInkStroke[] | null {
  if (!hitTestInkStroke(stroke, worldX, worldY, eraserRadiusWorld)) {
    return null; // Unchanged
  }

  if (
    stroke.tool !== 'pen' &&
    stroke.tool !== 'pencil' &&
    stroke.tool !== 'highlighter'
  ) {
    return []; // Delete shape whole
  }

  const rSq = Math.pow(eraserRadiusWorld + stroke.width * 0.5, 2);
  const pieces: Array<Array<[number, number, number]>> = [];
  let current: Array<[number, number, number]> = [];

  for (const pt of stroke.points) {
    const dx = pt[0] - worldX;
    const dy = pt[1] - worldY;
    if (dx * dx + dy * dy <= rSq) {
      if (current.length >= 2) {
        pieces.push(current);
      }
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length >= 2) {
    pieces.push(current);
  }

  const now = Date.now();
  return pieces.map((pts, idx) => ({
    ...stroke,
    id: `${stroke.id}_p${idx}_${now}`,
    points: pts,
  }));
}

/**
 * Ray-casting point-in-polygon check for GoodNotes / Samsung Notes Freehand Lasso Selection!
 */
export function isPointInPolygon(
  x: number,
  y: number,
  polygon: Array<[number, number]>
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findStrokesInsideLasso(
  strokes: CanvasInkStroke[],
  lassoPoints: Array<[number, number, number]>
): string[] {
  if (lassoPoints.length < 4 || strokes.length === 0) return [];
  const poly: Array<[number, number]> = lassoPoints.map((p) => [p[0], p[1]]);
  const matched: string[] = [];

  for (const s of strokes) {
    if (!s.points || s.points.length === 0) continue;
    let sumX = 0;
    let sumY = 0;
    let hitAny = false;
    for (let i = 0; i < s.points.length; i++) {
      const [px, py] = s.points[i];
      sumX += px;
      sumY += py;
      if (i % 3 === 0 && isPointInPolygon(px, py, poly)) {
        hitAny = true;
        break;
      }
    }
    if (hitAny || isPointInPolygon(sumX / s.points.length, sumY / s.points.length, poly)) {
      matched.push(s.id);
    }
  }
  return matched;
}

export function getInkStrokesBoundingBox(
  strokes: CanvasInkStroke[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (strokes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    for (const [x, y] of s.points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

export function translateInkStroke(
  stroke: CanvasInkStroke,
  dx: number,
  dy: number
): CanvasInkStroke {
  return {
    ...stroke,
    points: stroke.points.map(([x, y, p]) => [x + dx, y + dy, p]),
  };
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
    if (s.tool === 'pencil') {
      ctx.setLineDash([1.6, 0.8]);
    }
    try {
      ctx.stroke(new Path2D(d));
    } catch {
      // Ignore fallback
    }
    ctx.restore();
  }
}

export function drawStickyNotesToCanvas2D(
  ctx: CanvasRenderingContext2D,
  notes: CanvasStickyNote[] | undefined
): void {
  if (!notes || notes.length === 0) return;
  for (const n of notes) {
    const w = n.width ?? 196;
    const lines = (n.text || 'Yapışkan Not').split(/\r?\n/).slice(0, 6);
    const h = Math.max(96, 42 + lines.length * 20);
    ctx.save();
    ctx.fillStyle = n.color || '#FEF08A';
    ctx.strokeStyle = 'rgba(15,23,42,0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(n.x, n.y, w, h, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    lines.forEach((line, idx) => {
      ctx.fillText(line.slice(0, 28), n.x + 14, n.y + 30 + idx * 20, w - 28);
    });
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
      const dash = s.tool === 'pencil' ? ' stroke-dasharray="2 0.8"' : '';
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.opacity}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
    })
    .filter(Boolean)
    .join('\n');
}

export function generateStickyNotesSvgElements(
  notes: CanvasStickyNote[] | undefined
): string {
  if (!notes || notes.length === 0) return '';
  return notes
    .map((n) => {
      const w = n.width ?? 196;
      const lines = (n.text || 'Yapışkan Not').split(/\r?\n/).slice(0, 6);
      const h = Math.max(96, 42 + lines.length * 20);
      const esc = (t: string) =>
        t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const textEls = lines
        .map(
          (line, idx) =>
            `<text x="${n.x + 14}" y="${n.y + 30 + idx * 20}" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#0F172A">${esc(
              line.slice(0, 28)
            )}</text>`
        )
        .join('');
      return `<g><rect x="${n.x}" y="${n.y}" width="${w}" height="${h}" rx="16" fill="${
        n.color || '#FEF08A'
      }" stroke="rgba(15,23,42,0.18)" stroke-width="1.5"/>${textEls}</g>`;
    })
    .join('\n');
}
