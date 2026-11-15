import RBush from 'rbush';
import type { MindNode } from '../../types/mindmap';
import type { WorldBounds } from './InfiniteViewport';

export interface SpatialNodeItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nodeId: string;
  isRoot: boolean;
}

export function estimateNodeHalfSize(node: MindNode, isRoot: boolean): { halfW: number; halfH: number } {
  const sizeMult =
    node.stickerSize === 'xl'
      ? 1.38
      : node.stickerSize === 'lg'
      ? 1.18
      : node.stickerSize === 'sm'
      ? 0.82
      : 1;

  if (isRoot) {
    return {
      halfW: node.sticker ? Math.round(115 * sizeMult) : 105,
      halfH: node.sticker ? Math.round(122 * sizeMult) : 62,
    };
  }
  const textLen = Math.max(8, node.title.length);
  const halfW = Math.min(145, Math.max(78 * sizeMult, textLen * 4.4));
  const halfH = node.sticker ? Math.round(88 * sizeMult) : 42;
  return { halfW, halfH };
}

export class HitTestSpatialIndex {
  private tree = new RBush<SpatialNodeItem>();
  private itemByNodeId = new Map<string, SpatialNodeItem>();

  public rebuild(
    nodes: Record<string, MindNode>,
    rootNodeId: string,
    hiddenNodeIds: Set<string>
  ): void {
    this.tree.clear();
    this.itemByNodeId.clear();

    const items: SpatialNodeItem[] = [];
    for (const node of Object.values(nodes)) {
      if (hiddenNodeIds.has(node.id)) continue;
      const isRoot = node.id === rootNodeId;
      const { halfW, halfH } = estimateNodeHalfSize(node, isRoot);
      const item: SpatialNodeItem = {
        minX: node.x - halfW,
        minY: node.y - (node.sticker ? halfH * 1.65 : halfH),
        maxX: node.x + halfW,
        maxY: node.y + halfH * 0.85,
        nodeId: node.id,
        isRoot,
      };
      items.push(item);
      this.itemByNodeId.set(node.id, item);
    }

    if (items.length > 0) {
      this.tree.load(items);
    }
  }

  public queryViewport(bounds: WorldBounds): string[] {
    const matches = this.tree.search(bounds);
    return matches.map((m) => m.nodeId);
  }

  public hitTestPoint(worldX: number, worldY: number, touchSlop = 12): string | null {
    const candidates = this.tree.search({
      minX: worldX - touchSlop,
      minY: worldY - touchSlop,
      maxX: worldX + touchSlop,
      maxY: worldY + touchSlop,
    });
    if (candidates.length === 0) return null;

    // Pick closest center to touch point
    let bestId: string | null = null;
    let bestDistSq = Infinity;
    for (const item of candidates) {
      const cx = (item.minX + item.maxX) * 0.5;
      const cy = (item.minY + item.maxY) * 0.5;
      const dx = worldX - cx;
      const dy = worldY - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestId = item.nodeId;
      }
    }
    return bestId;
  }

  public getTotalBounds(): WorldBounds {
    const all = this.tree.all();
    if (all.length === 0) {
      return { minX: -240, minY: -180, maxX: 240, maxY: 180 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const item of all) {
      if (item.minX < minX) minX = item.minX;
      if (item.minY < minY) minY = item.minY;
      if (item.maxX > maxX) maxX = item.maxX;
      if (item.maxY > maxY) maxY = item.maxY;
    }
    return { minX, minY, maxX, maxY };
  }
}
