import type { MindMapDocument } from '../../types/mindmap';
import { OrganicBranchRenderer } from './OrganicBranchRenderer';
import { computeTreeMeta } from './RadialAutoLayout';

const THUMB_W = 480;
const THUMB_H = 320;

/**
 * Generates a lightweight `480x320` WebP live preview thumbnail (`thumbnailDataUrl`)
 * directly from a `MindMapDocument` in `<6ms` for crisp HomeWorkspace map cards.
 */
export function generateMapThumbnailDataUrl(doc: MindMapDocument): string {
  if (typeof document === 'undefined') return '';

  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const isDark = Boolean(doc.darkMode);
    ctx.fillStyle = isDark ? '#0F141D' : '#FAF9F5';
    ctx.fillRect(0, 0, THUMB_W, THUMB_H);

    // Subtle paper dot grid
    ctx.fillStyle = isDark ? '#232C3D' : '#E5E2D9';
    for (let x = 16; x < THUMB_W; x += 22) {
      for (let y = 16; y < THUMB_H; y += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dedicated Flowchart Live Thumbnail Preview
    if (doc.documentType === 'flowchart' && doc.flowchart && doc.flowchart.nodes.length > 0) {
      const fc = doc.flowchart;
      let fMinX = Infinity;
      let fMinY = Infinity;
      let fMaxX = -Infinity;
      let fMaxY = -Infinity;
      for (const fn of fc.nodes) {
        fMinX = Math.min(fMinX, fn.x - fn.width * 0.5 - 20);
        fMaxX = Math.max(fMaxX, fn.x + fn.width * 0.5 + 20);
        fMinY = Math.min(fMinY, fn.y - fn.height * 0.5 - 20);
        fMaxY = Math.max(fMaxY, fn.y + fn.height * 0.5 + 20);
      }
      const fW = Math.max(200, fMaxX - fMinX);
      const fH = Math.max(150, fMaxY - fMinY);
      const scale = Math.min((THUMB_W - 44) / fW, (THUMB_H - 44) / fH, 0.72);
      const ox = THUMB_W * 0.5 - ((fMinX + fMaxX) * 0.5) * scale;
      const oy = THUMB_H * 0.5 - ((fMinY + fMaxY) * 0.5) * scale;
      const mapById = new Map(fc.nodes.map((n) => [n.id, n]));

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);

      // Edges
      for (const edge of fc.edges) {
        const a = mapById.get(edge.fromNodeId);
        const b = mapById.get(edge.toNodeId);
        if (!a || !b) continue;
        ctx.strokeStyle = edge.color || '#64748B';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Shapes
      for (const fn of fc.nodes) {
        ctx.fillStyle = isDark ? '#1E293B' : '#FFFFFF';
        ctx.strokeStyle = fn.color || '#0EA5E9';
        ctx.lineWidth = 3.5;
        const l = fn.x - fn.width / 2;
        const t = fn.y - fn.height / 2;
        ctx.beginPath();
        if (fn.shape === 'decision') {
          ctx.moveTo(fn.x, t);
          ctx.lineTo(l + fn.width, fn.y);
          ctx.lineTo(fn.x, t + fn.height);
          ctx.lineTo(l, fn.y);
          ctx.closePath();
        } else {
          ctx.roundRect(l, t, fn.width, fn.height, fn.shape === 'start_end' ? fn.height / 2 : 14);
        }
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      return canvas.toDataURL('image/webp', 0.82);
    }

    const meta = computeTreeMeta(doc.nodes, doc.rootNodeId);
    const visibleNodes = Object.values(doc.nodes).filter(
      (n) => !meta.hiddenNodeIds.has(n.id)
    );

    if (visibleNodes.length === 0) {
      return canvas.toDataURL('image/webp', 0.8);
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of visibleNodes) {
      minX = Math.min(minX, n.x - 130);
      maxX = Math.max(maxX, n.x + 130);
      minY = Math.min(minY, n.y - 110);
      maxY = Math.max(maxY, n.y + 80);
    }

    const worldW = Math.max(280, maxX - minX);
    const worldH = Math.max(200, maxY - minY);
    const pad = 26;
    const scale = Math.min(
      (THUMB_W - pad * 2) / worldW,
      (THUMB_H - pad * 2) / worldH,
      0.85
    );

    const centerWorldX = (minX + maxX) * 0.5;
    const centerWorldY = (minY + maxY) * 0.5;

    ctx.save();
    ctx.translate(THUMB_W * 0.5, THUMB_H * 0.5);
    ctx.scale(scale, scale);
    ctx.translate(-centerWorldX, -centerWorldY);

    // Draw organic tapered branches
    const branchRenderer = new OrganicBranchRenderer();
    for (const n of visibleNodes) {
      if (!n.parentId || n.id === doc.rootNodeId) continue;
      const parent = doc.nodes[n.parentId];
      if (!parent || meta.hiddenNodeIds.has(parent.id)) continue;
      const depth = meta.depthMap.get(n.id) ?? 1;
      branchRenderer.drawTaperedBranch(
        ctx,
        parent.x,
        parent.y,
        n.x,
        n.y,
        n.branchColor,
        depth,
        0.95
      );
    }

    // Draw crisp miniature node pills + sticker accent dots
    for (const n of visibleNodes) {
      const isRoot = n.id === doc.rootNodeId;
      const label = (n.title || 'Yeni Konu').slice(0, 22);
      ctx.font = `${isRoot ? 800 : 700} ${isRoot ? 18 : 13}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const tw = Math.min(210, Math.max(76, ctx.measureText(label).width + 24));
      const th = isRoot ? 34 : 26;

      if (n.sticker) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = `${n.branchColor}66`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y - th * 0.5 - 22, isRoot ? 20 : 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = n.branchColor;
        ctx.beginPath();
        ctx.arc(n.x, n.y - th * 0.5 - 22, isRoot ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isDark ? '#1B2333' : '#FFFFFF';
      ctx.strokeStyle = n.branchColor;
      ctx.lineWidth = isRoot ? 3.2 : 2.2;
      ctx.beginPath();
      ctx.roundRect(n.x - tw * 0.5, n.y - th * 0.5, tw, th, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, n.x, n.y + 0.5);
    }

    ctx.restore();

    const webp = canvas.toDataURL('image/webp', 0.82);
    const out = webp.startsWith('data:image/webp')
      ? webp
      : canvas.toDataURL('image/png');

    canvas.width = 1;
    canvas.height = 1;
    return out;
  } catch {
    return '';
  }
}
