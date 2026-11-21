import type { CrossLink, MindNode, ViewportTransform } from '../../types/mindmap';

export interface CrossLinkCurveGeometry {
  startX: number;
  startY: number;
  cpX: number;
  cpY: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
  endAngleRad: number;
}

/**
 * Computes a clean arching Quadratic Bezier curve between `fromNode` and `toNode`
 * that stops gracefully at the pill border and exposes its exact midpoint `(midX, midY)`
 * for interactive relationship badge pills (`"Cache Miss"`, `"HTTPS 443"`, `"Bozma"`).
 */
export function computeCrossLinkGeometry(
  fromNode: MindNode,
  toNode: MindNode
): CrossLinkCurveGeometry {
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const dist = Math.max(1, Math.hypot(dx, dy));

  // Perpendicular normal to arch smoothly clear of horizontal branches AND central root hub/sticker!
  const nx = -dy / dist;
  const ny = dx / dist;
  const rawMidX = (fromNode.x + toNode.x) * 0.5;
  const rawMidY = (fromNode.y + toNode.y) * 0.5;
  const crossesRootZone = Math.abs(rawMidX) < 230 && Math.abs(rawMidY) < 195;

  let cpX: number;
  let cpY: number;
  if (crossesRootZone) {
    // Arch generously above (or below) the central root node + 124px root sticker so the pill is never occluded!
    const archUp = rawMidY <= 60;
    cpX = rawMidX;
    cpY = archUp
      ? Math.min(-255, rawMidY - 215)
      : Math.max(225, rawMidY + 195);
  } else {
    const archSign = dy >= 0 ? -1 : 1;
    const archMagnitude = Math.min(145, Math.max(52, dist * 0.23));
    cpX = rawMidX + nx * archMagnitude * archSign;
    cpY = rawMidY + ny * archMagnitude * archSign;
  }

  // Offset start & end points slightly outside the node pill so arrowheads sit crisply at pill edge
  const startDirAngle = Math.atan2(cpY - fromNode.y, cpX - fromNode.x);
  const startX = fromNode.x + Math.cos(startDirAngle) * 58;
  const startY = fromNode.y + Math.sin(startDirAngle) * 24;

  const endTangentAngle = Math.atan2(toNode.y - cpY, toNode.x - cpX);
  const endX = toNode.x - Math.cos(endTangentAngle) * 62;
  const endY = toNode.y - Math.sin(endTangentAngle) * 26;

  // Quadratic Bezier point at t = 0.5: B(0.5) = 0.25*P0 + 0.5*CP + 0.25*P2
  const midX = 0.25 * startX + 0.5 * cpX + 0.25 * endX;
  const midY = 0.25 * startY + 0.5 * cpY + 0.25 * endY;

  const endAngleRad = Math.atan2(endY - cpY, endX - cpX);

  return {
    startX,
    startY,
    cpX,
    cpY,
    endX,
    endY,
    midX,
    midY,
    endAngleRad,
  };
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angleRad: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angleRad);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 1.35, -size * 0.72);
  ctx.lineTo(-size * 0.95, 0);
  ctx.lineTo(-size * 1.35, size * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export class CrossLinkRenderer {
  /**
   * Renders animated directional CrossLinks (`systemdesign.io` data-flow marching ants)
   * on the main 60/120 FPS interactive canvas.
   */
  public renderInteractiveCrossLinks(
    ctx: CanvasRenderingContext2D,
    crossLinks: CrossLink[] | undefined,
    nodes: Record<string, MindNode>,
    vp: ViewportTransform,
    hiddenNodeIds: Set<string>,
    nowMs: number,
    pendingFromNode?: MindNode | null,
    pendingTargetWorld?: { x: number; y: number } | null
  ): void {
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.scale, vp.scale);

    if (crossLinks && crossLinks.length > 0) {
      // Static crisp dash pattern when idle so Canvas uses 0% CPU/GPU and never heats up phones!
      for (const link of crossLinks) {
        if (hiddenNodeIds.has(link.fromNodeId) || hiddenNodeIds.has(link.toNodeId)) {
          continue;
        }
        const from = nodes[link.fromNodeId];
        const to = nodes[link.toNodeId];
        if (!from || !to) continue;

        const geom = computeCrossLinkGeometry(from, to);
        const strokeColor = link.color || '#0EA5E9';
        const isSolid = link.style === 'solid_arrow';

        // Soft glow under-stroke for high legibility on dot-grid paper
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(geom.startX, geom.startY);
        ctx.quadraticCurveTo(geom.cpX, geom.cpY, geom.endX, geom.endY);
        ctx.stroke();
        ctx.restore();

        // Main directional flow curve
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        if (!isSolid) {
          ctx.setLineDash([8, 6]);
        }
        ctx.beginPath();
        ctx.moveTo(geom.startX, geom.startY);
        ctx.quadraticCurveTo(geom.cpX, geom.cpY, geom.endX, geom.endY);
        ctx.stroke();
        ctx.restore();

        // Origin dot + Destination arrowhead
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(geom.startX, geom.startY, 4, 0, Math.PI * 2);
        ctx.fill();

        drawArrowhead(ctx, geom.endX, geom.endY, geom.endAngleRad, 9, strokeColor);
      }
    }

    // Live preview line when user is in "🔗 İlişki Çek" target-picking mode
    if (pendingFromNode && pendingTargetWorld) {
      ctx.save();
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2.8;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -((nowMs * 0.04) % 24);
      ctx.beginPath();
      ctx.moveTo(pendingFromNode.x, pendingFromNode.y);
      ctx.lineTo(pendingTargetWorld.x, pendingTargetWorld.y);
      ctx.stroke();
      drawArrowhead(
        ctx,
        pendingTargetWorld.x,
        pendingTargetWorld.y,
        Math.atan2(
          pendingTargetWorld.y - pendingFromNode.y,
          pendingTargetWorld.x - pendingFromNode.x
        ),
        9,
        '#8B5CF6'
      );
      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * Renders CrossLinks + mid-curve pill labels onto the 300-DPI Export Canvas (PDF & PNG).
 */
export function drawStaticCrossLinksForExport(
  ctx: CanvasRenderingContext2D,
  crossLinks: CrossLink[] | undefined,
  nodes: Record<string, MindNode>,
  hiddenNodeIds: Set<string>,
  darkMode: boolean
): void {
  if (!crossLinks || crossLinks.length === 0) return;

  for (const link of crossLinks) {
    if (hiddenNodeIds.has(link.fromNodeId) || hiddenNodeIds.has(link.toNodeId)) continue;
    const from = nodes[link.fromNodeId];
    const to = nodes[link.toNodeId];
    if (!from || !to) continue;

    const geom = computeCrossLinkGeometry(from, to);
    const color = link.color || '#0EA5E9';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    if (link.style !== 'solid_arrow') {
      ctx.setLineDash([8, 6]);
    }
    ctx.beginPath();
    ctx.moveTo(geom.startX, geom.startY);
    ctx.quadraticCurveTo(geom.cpX, geom.cpY, geom.endX, geom.endY);
    ctx.stroke();
    ctx.restore();

    drawArrowhead(ctx, geom.endX, geom.endY, geom.endAngleRad, 9, color);

    if (link.label) {
      ctx.save();
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      const tw = ctx.measureText(link.label).width + 18;
      const th = 22;
      ctx.fillStyle = darkMode ? '#1E293B' : '#FFFFFF';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(geom.midX - tw / 2, geom.midY - th / 2, tw, th, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = darkMode ? '#E2E8F0' : '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(link.label, geom.midX, geom.midY + 0.5);
      ctx.restore();
    }
  }
}

/**
 * Generates clean `<path>` + arrowhead + label pill SVG markup for Vector `.svg` export.
 */
export function generateCrossLinkSvgElements(
  crossLinks: CrossLink[] | undefined,
  nodes: Record<string, MindNode>,
  hiddenNodeIds: Set<string>,
  offsetX: number,
  offsetY: number,
  escapeXmlFn: (s: string) => string
): string[] {
  if (!crossLinks || crossLinks.length === 0) return [];
  const elements: string[] = [];

  for (const link of crossLinks) {
    if (hiddenNodeIds.has(link.fromNodeId) || hiddenNodeIds.has(link.toNodeId)) continue;
    const from = nodes[link.fromNodeId];
    const to = nodes[link.toNodeId];
    if (!from || !to) continue;

    const geom = computeCrossLinkGeometry(from, to);
    const color = link.color || '#0EA5E9';
    const sx = geom.startX + offsetX;
    const sy = geom.startY + offsetY;
    const cx = geom.cpX + offsetX;
    const cy = geom.cpY + offsetY;
    const ex = geom.endX + offsetX;
    const ey = geom.endY + offsetY;
    const mx = geom.midX + offsetX;
    const my = geom.midY + offsetY;
    const deg = ((geom.endAngleRad * 180) / Math.PI).toFixed(1);

    const dashAttr = link.style === 'solid_arrow' ? '' : ' stroke-dasharray="8 6"';
    elements.push(
      `<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(
        1
      )} ${ey.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2.6"${dashAttr} stroke-linecap="round" />`
    );
    elements.push(
      `<polygon points="0,0 -12,-6.5 -9,0 -12,6.5" fill="${color}" transform="translate(${ex.toFixed(
        1
      )},${ey.toFixed(1)}) rotate(${deg})" />`
    );

    if (link.label) {
      const pillW = Math.max(68, link.label.length * 6.8 + 18);
      elements.push(
        `<rect x="${(mx - pillW / 2).toFixed(1)}" y="${(my - 11).toFixed(
          1
        )}" width="${pillW.toFixed(1)}" height="22" rx="11" fill="#FFFFFF" stroke="${color}" stroke-width="1.6" />`
      );
      elements.push(
        `<text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(
          1
        )}" text-anchor="middle" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="700" font-size="11" fill="#0F172A">${escapeXmlFn(
          link.label
        )}</text>`
      );
    }
  }

  return elements;
}
