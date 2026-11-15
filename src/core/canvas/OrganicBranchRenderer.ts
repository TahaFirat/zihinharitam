import type { MindNode, ViewportTransform } from '../../types/mindmap';
import type { WorldBounds } from './InfiniteViewport';

export interface CubicCurvePoints {
  p0x: number;
  p0y: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  p3x: number;
  p3y: number;
}

export interface SpringDragBranchState {
  sourceNodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  depth: number;
}

/**
 * Calculates organic Tony Buzan style cubic Bezier control points between parent and child.
 */
export function computeOrganicCurve(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  isFromRoot: boolean
): CubicCurvePoints {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);

  if (dist < 1) {
    return {
      p0x: startX,
      p0y: startY,
      c1x: startX,
      c1y: startY,
      c2x: endX,
      c2y: endY,
      p3x: endX,
      p3y: endY,
    };
  }

  if (isFromRoot) {
    // Radial organic S-flow out of central root hub
    const angle = Math.atan2(dy, dx);
    const pull1 = Math.min(130, dist * 0.42);
    const pull2 = Math.min(115, dist * 0.36);

    // Slight graceful horizontal leveling near the child label/sticker
    const horizontalBias = Math.abs(Math.cos(angle)) > 0.32 ? Math.sign(dx) : Math.cos(angle);
    return {
      p0x: startX,
      p0y: startY,
      c1x: startX + Math.cos(angle) * pull1,
      c1y: startY + Math.sin(angle) * pull1 * 0.86,
      c2x: endX - horizontalBias * pull2,
      c2y: endY - Math.sin(angle) * pull2 * 0.22,
      p3x: endX,
      p3y: endY,
    };
  }

  // Sub-branches flow outward smoothly along horizontal/radial flow
  const horizDominant = Math.abs(dx) >= Math.abs(dy) * 0.55;
  if (horizDominant) {
    const cDist = Math.max(36, Math.abs(dx) * 0.52);
    const dir = dx >= 0 ? 1 : -1;
    return {
      p0x: startX,
      p0y: startY,
      c1x: startX + dir * cDist,
      c1y: startY + dy * 0.08,
      c2x: endX - dir * cDist * 0.85,
      c2y: endY - dy * 0.06,
      p3x: endX,
      p3y: endY,
    };
  }

  const vDist = Math.max(36, dist * 0.44);
  const angle = Math.atan2(dy, dx);
  return {
    p0x: startX,
    p0y: startY,
    c1x: startX + Math.cos(angle) * vDist * 0.75,
    c1y: startY + Math.sin(angle) * vDist,
    c2x: endX - Math.cos(angle) * vDist * 0.9,
    c2y: endY - Math.sin(angle) * vDist * 0.4,
    p3x: endX,
    p3y: endY,
  };
}

function evalBezierPoint(c: CubicCurvePoints, t: number): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * c.p0x + 3 * mt2 * t * c.c1x + 3 * mt * t2 * c.c2x + t2 * t * c.p3x,
    y: mt2 * mt * c.p0y + 3 * mt2 * t * c.c1y + 3 * mt * t2 * c.c2y + t2 * t * c.p3y,
  };
}

function evalBezierTangent(c: CubicCurvePoints, t: number): { tx: number; ty: number } {
  const mt = 1 - t;
  const tx =
    3 * mt * mt * (c.c1x - c.p0x) +
    6 * mt * t * (c.c2x - c.c1x) +
    3 * t * t * (c.p3x - c.c2x);
  const ty =
    3 * mt * mt * (c.c1y - c.p0y) +
    6 * mt * t * (c.c2y - c.c1y) +
    3 * t * t * (c.p3y - c.c2y);
  const len = Math.hypot(tx, ty) || 1;
  return { tx: tx / len, ty: ty / len };
}

export function getBranchWidthsForDepth(depth: number): { startWidth: number; endWidth: number } {
  if (depth <= 1) {
    // Root -> Main branch: 13px tapering gracefully to 3.8px
    return { startWidth: 13.5, endWidth: 3.8 };
  }
  if (depth === 2) {
    return { startWidth: 8.2, endWidth: 3.2 };
  }
  return { startWidth: 5.4, endWidth: 2.6 };
}

/**
 * Builds a smooth closed tapered polygon path along a cubic Bezier curve.
 */
export function buildTaperedRibbonPoints(
  curve: CubicCurvePoints,
  startWidth: number,
  endWidth: number,
  steps = 26
): { left: Array<{ x: number; y: number }>; right: Array<{ x: number; y: number }> } {
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Smooth nonlinear organic taper (Tony Buzan root bulb -> graceful tip)
    const taperEase = Math.pow(1 - t, 1.32);
    const halfW = (endWidth + (startWidth - endWidth) * taperEase) * 0.5;

    const pt = evalBezierPoint(curve, t);
    const tan = evalBezierTangent(curve, t);
    const nx = -tan.ty;
    const ny = tan.tx;

    left.push({ x: pt.x + nx * halfW, y: pt.y + ny * halfW });
    right.push({ x: pt.x - nx * halfW, y: pt.y - ny * halfW });
  }

  return { left, right };
}

export function generateTaperedBranchSvgPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  depth: number
): string {
  const curve = computeOrganicCurve(startX, startY, endX, endY, depth <= 1);
  const { startWidth, endWidth } = getBranchWidthsForDepth(depth);
  const { left, right } = buildTaperedRibbonPoints(curve, startWidth, endWidth, 28);

  if (left.length === 0) return '';

  const parts: string[] = [`M ${left[0].x.toFixed(2)} ${left[0].y.toFixed(2)}`];
  for (let i = 1; i < left.length; i++) {
    parts.push(`L ${left[i].x.toFixed(2)} ${left[i].y.toFixed(2)}`);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    parts.push(`L ${right[i].x.toFixed(2)} ${right[i].y.toFixed(2)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

export class OrganicBranchRenderer {
  public drawTaperedBranch(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    depth: number,
    opacity = 1,
    dashed = false,
    skipShadow = false
  ): void {
    const curve = computeOrganicCurve(startX, startY, endX, endY, depth <= 1);
    const { startWidth, endWidth } = getBranchWidthsForDepth(depth);

    ctx.save();
    ctx.globalAlpha = opacity;

    if (dashed) {
      ctx.strokeStyle = color;
      ctx.lineWidth = (startWidth + endWidth) * 0.45;
      ctx.lineCap = 'round';
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(curve.p0x, curve.p0y);
      ctx.bezierCurveTo(curve.c1x, curve.c1y, curve.c2x, curve.c2y, curve.p3x, curve.p3y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const { left, right } = buildTaperedRibbonPoints(curve, startWidth, endWidth, 24);
    if (left.length === 0) {
      ctx.restore();
      return;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) {
      ctx.lineTo(left[i].x, left[i].y);
    }
    // Rounded end cap at tip
    const lastIdx = right.length - 1;
    const endMidX = (left[lastIdx].x + right[lastIdx].x) * 0.5;
    const endMidY = (left[lastIdx].y + right[lastIdx].y) * 0.5;
    ctx.arc(
      endMidX,
      endMidY,
      endWidth * 0.5,
      Math.atan2(left[lastIdx].y - endMidY, left[lastIdx].x - endMidX),
      Math.atan2(right[lastIdx].y - endMidY, right[lastIdx].x - endMidX),
      false
    );

    for (let i = right.length - 1; i >= 0; i--) {
      ctx.lineTo(right[i].x, right[i].y);
    }
    // Rounded start cap at root
    const startMidX = (left[0].x + right[0].x) * 0.5;
    const startMidY = (left[0].y + right[0].y) * 0.5;
    ctx.arc(
      startMidX,
      startMidY,
      startWidth * 0.5,
      Math.atan2(right[0].y - startMidY, right[0].x - startMidX),
      Math.atan2(left[0].y - startMidY, left[0].x - startMidX),
      false
    );
    ctx.closePath();

    if (!skipShadow) {
      ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
    }
    ctx.fill();

    ctx.restore();
  }

  public renderAllBranches(
    ctx: CanvasRenderingContext2D,
    nodes: Record<string, MindNode>,
    rootNodeId: string,
    viewport: ViewportTransform,
    visibleWorldBounds: WorldBounds,
    hiddenNodeIds: Set<string>,
    focusedMainBranchId: string | null,
    nodeDepthMap: Map<string, number>,
    nodeMainBranchMap: Map<string, string>,
    dragPreview: SpringDragBranchState | null,
    nodeDimensionsMap?: Map<string, { w: number; h: number }>,
    skipShadow = false
  ): void {
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);

    for (const node of Object.values(nodes)) {
      if (!node.parentId || node.id === rootNodeId) continue;
      if (hiddenNodeIds.has(node.id) || hiddenNodeIds.has(node.parentId)) continue;

      const parent = nodes[node.parentId];
      if (!parent) continue;

      // Dynamic ResizeObserver edge anchor calculation so wide multi-line Turkish cards never overlap Bezier curves
      const parentDim = nodeDimensionsMap?.get(parent.id);
      const childDim = nodeDimensionsMap?.get(node.id);
      const dx = node.x - parent.x;
      const dy = node.y - parent.y;

      let sx = parent.x;
      let sy = parent.y;
      let ex = node.x;
      let ey = node.y;

      if (parentDim && Math.abs(dx) > parentDim.w * 0.65) {
        sx = parent.x + Math.sign(dx) * Math.max(0, parentDim.w * 0.42);
      } else if (parentDim && Math.abs(dy) > parentDim.h * 0.9) {
        sy = parent.y + Math.sign(dy) * Math.max(0, parentDim.h * 0.42);
      }

      if (childDim && Math.abs(dx) > childDim.w * 0.65) {
        ex = node.x - Math.sign(dx) * Math.max(0, childDim.w * 0.44);
      } else if (childDim && Math.abs(dy) > childDim.h * 0.9) {
        ey = node.y - Math.sign(dy) * Math.max(0, childDim.h * 0.44);
      }

      // Fast AABB viewport frustum culling for branch segment
      const segMinX = Math.min(sx, ex) - 90;
      const segMaxX = Math.max(sx, ex) + 90;
      const segMinY = Math.min(sy, ey) - 90;
      const segMaxY = Math.max(sy, ey) + 90;

      if (
        segMaxX < visibleWorldBounds.minX ||
        segMinX > visibleWorldBounds.maxX ||
        segMaxY < visibleWorldBounds.minY ||
        segMinY > visibleWorldBounds.maxY
      ) {
        continue;
      }

      const depth = nodeDepthMap.get(node.id) ?? 1;
      const mainBranchId = nodeMainBranchMap.get(node.id) ?? node.id;
      const isDimmed =
        focusedMainBranchId !== null && mainBranchId !== focusedMainBranchId;

      this.drawTaperedBranch(
        ctx,
        sx,
        sy,
        ex,
        ey,
        node.branchColor,
        depth,
        isDimmed ? 0.18 : 1.0,
        false,
        skipShadow
      );
    }

    // Live spring-physics drag-to-branch preview
    if (dragPreview) {
      this.drawTaperedBranch(
        ctx,
        dragPreview.startX,
        dragPreview.startY,
        dragPreview.currentX,
        dragPreview.currentY,
        dragPreview.color,
        dragPreview.depth,
        0.92,
        false
      );

      // Glowing target node preview ring at finger/stylus tip
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = dragPreview.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = dragPreview.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(dragPreview.currentX, dragPreview.currentY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

export function stepSpringBranch(state: SpringDragBranchState): boolean {
  const stiffness = 0.28;
  const damping = 0.72;
  const ax = (state.targetX - state.currentX) * stiffness;
  const ay = (state.targetY - state.currentY) * stiffness;

  state.vx = (state.vx + ax) * damping;
  state.vy = (state.vy + ay) * damping;
  state.currentX += state.vx;
  state.currentY += state.vy;

  const remaining =
    Math.hypot(state.targetX - state.currentX, state.targetY - state.currentY) +
    Math.hypot(state.vx, state.vy);
  return remaining > 0.25;
}
