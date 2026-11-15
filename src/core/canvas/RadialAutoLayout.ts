import { BRANCH_PALETTE, type MindNode } from '../../types/mindmap';

export interface TreeMeta {
  childrenMap: Map<string, string[]>;
  hiddenNodeIds: Set<string>;
  descendantCountMap: Map<string, number>;
  depthMap: Map<string, number>;
  mainBranchMap: Map<string, string>;
}

/**
 * Computes hierarchy metadata: collapsed hidden sets, descendant counts (+N badges),
 * branch depths, and main branch lineage for Focus Mode & color inheritance.
 */
export function computeTreeMeta(
  nodes: Record<string, MindNode>,
  rootNodeId: string,
  hideChildrenInExamMode = false,
  revealedExamNodeIds?: Set<string>
): TreeMeta {
  const childrenMap = new Map<string, string[]>();
  for (const id of Object.keys(nodes)) {
    childrenMap.set(id, []);
  }

  for (const node of Object.values(nodes)) {
    if (node.parentId && childrenMap.has(node.parentId)) {
      childrenMap.get(node.parentId)!.push(node.id);
    }
  }

  const hiddenNodeIds = new Set<string>();
  const descendantCountMap = new Map<string, number>();
  const depthMap = new Map<string, number>();
  const mainBranchMap = new Map<string, string>();

  const countDescendants = (id: string): number => {
    const kids = childrenMap.get(id) ?? [];
    let total = 0;
    for (const kidId of kids) {
      total += 1 + countDescendants(kidId);
    }
    descendantCountMap.set(id, total);
    return total;
  };
  if (nodes[rootNodeId]) {
    countDescendants(rootNodeId);
  }

  const walk = (
    id: string,
    depth: number,
    ancestorCollapsed: boolean,
    mainBranchId: string | null
  ) => {
    const node = nodes[id];
    if (!node) return;

    const currentMain = depth === 1 ? id : mainBranchId;
    if (currentMain) {
      mainBranchMap.set(id, currentMain);
    }
    depthMap.set(id, depth);

    if (ancestorCollapsed) {
      hiddenNodeIds.add(id);
    }

    const examBlocksChildren =
      hideChildrenInExamMode &&
      depth >= 1 &&
      !(revealedExamNodeIds?.has(id) ?? false);

    const nextCollapsed = ancestorCollapsed || node.collapsed || examBlocksChildren;
    const kids = childrenMap.get(id) ?? [];
    for (const kidId of kids) {
      walk(kidId, depth + 1, nextCollapsed, currentMain);
    }
  };

  if (nodes[rootNodeId]) {
    walk(rootNodeId, 0, false, null);
  }

  return {
    childrenMap,
    hiddenNodeIds,
    descendantCountMap,
    depthMap,
    mainBranchMap,
  };
}

/**
 * Picks the next vibrant main branch color or inherits parent's branch color.
 */
export function resolveNewBranchColor(
  parentNode: MindNode,
  allNodes: Record<string, MindNode>,
  rootNodeId: string
): string {
  if (parentNode.id !== rootNodeId) {
    return parentNode.branchColor;
  }
  const existingRootChildren = Object.values(allNodes).filter(
    (n) => n.parentId === rootNodeId
  );
  const usedCounts = new Map<string, number>();
  for (const c of BRANCH_PALETTE) usedCounts.set(c, 0);
  for (const child of existingRootChildren) {
    usedCounts.set(child.branchColor, (usedCounts.get(child.branchColor) ?? 0) + 1);
  }

  let chosen: string = BRANCH_PALETTE[existingRootChildren.length % BRANCH_PALETTE.length];
  let minCount = Infinity;
  for (const paletteColor of BRANCH_PALETTE) {
    const count = usedCounts.get(paletteColor) ?? 0;
    if (count < minCount) {
      minCount = count;
      chosen = paletteColor;
    }
  }
  return chosen;
}

/**
 * Collision-avoiding single-tap angle & position finder for one-thumb mobile branching.
 */
export function findBestOpenBranchPosition(
  parentNode: MindNode,
  allNodes: Record<string, MindNode>,
  rootNodeId: string
): { x: number; y: number } {
  const isRoot = parentNode.id === rootNodeId;
  const siblings = Object.values(allNodes).filter((n) => n.parentId === parentNode.id);

  if (isRoot) {
    const radiusX = 335;
    const radiusY = 248;
    // Preferred organic left/right hemisphere angles (never straight -PI/2 on top of root sticker!)
    const candidateAngles = [
      -0.44,
      0.44,
      Math.PI - 0.44,
      Math.PI + 0.44,
      -0.86,
      0.86,
      Math.PI - 0.86,
      Math.PI + 0.86,
      0,
      Math.PI,
      -1.12,
      1.12,
      Math.PI - 1.12,
      Math.PI + 1.12,
    ];

    if (siblings.length === 0) {
      return {
        x: Math.round(parentNode.x + Math.cos(-0.35) * radiusX),
        y: Math.round(parentNode.y + Math.sin(-0.35) * radiusY),
      };
    }

    const existingAngles = siblings.map((s) =>
      Math.atan2(s.y - parentNode.y, s.x - parentNode.x)
    );

    let bestAngle = candidateAngles[0];
    let bestClearance = -1;

    for (let i = 0; i < candidateAngles.length; i++) {
      const angle = candidateAngles[i];
      let minAngularDist = Infinity;
      for (const ea of existingAngles) {
        let diff = Math.abs(angle - ea) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < minAngularDist) minAngularDist = diff;
      }
      if (minAngularDist > bestClearance) {
        bestClearance = minAngularDist;
        bestAngle = angle;
      }
    }

    return {
      x: Math.round(parentNode.x + Math.cos(bestAngle) * radiusX),
      y: Math.round(parentNode.y + Math.sin(bestAngle) * radiusY),
    };
  }

  // Sub-branch outward from parent relative to root or parent's parent
  const grandParent = parentNode.parentId ? allNodes[parentNode.parentId] : null;
  const baseAngle = grandParent
    ? Math.atan2(parentNode.y - grandParent.y, parentNode.x - grandParent.x)
    : 0;

  const outwardSign = Math.cos(baseAngle) >= 0 ? 1 : -1;
  const stepX = 235 * outwardSign;

  // Fan out siblings vertically without colliding with existing nodes
  const candidateOffsetsY = [0, -182, 182, -355, 355, -520, 520, -95, 95];
  let bestPos = { x: parentNode.x + stepX, y: parentNode.y };
  let bestMinDist = -1;

  for (const offsetY of candidateOffsetsY) {
    const cx = parentNode.x + stepX;
    const cy = parentNode.y + offsetY;
    let minDist = Infinity;
    for (const other of Object.values(allNodes)) {
      const d = Math.hypot(cx - other.x, cy - other.y);
      if (d < minDist) minDist = d;
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestPos = { x: Math.round(cx), y: Math.round(cy) };
    }
    if (minDist > 155) {
      return { x: Math.round(cx), y: Math.round(cy) };
    }
  }

  return bestPos;
}

/**
 * Smart Auto-Layout: Organizes main branches radially balanced left/right around Root Hub
 * and solves overlaps with force-directed spacing relaxation.
 */
export function computeRadialAutoLayout(
  nodes: Record<string, MindNode>,
  rootNodeId: string
): Record<string, MindNode> {
  const root = nodes[rootNodeId];
  if (!root) return nodes;

  const updated: Record<string, MindNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    updated[id] = { ...node };
  }

  updated[rootNodeId].x = 0;
  updated[rootNodeId].y = 0;

  const childrenOf = (parentId: string): MindNode[] =>
    Object.values(updated).filter((n) => n.parentId === parentId);

  const subtreeLeafWeight = (nodeId: string): number => {
    const node = updated[nodeId];
    if (!node || node.collapsed) return 1;
    const kids = childrenOf(nodeId);
    if (kids.length === 0) return 1;
    return kids.reduce((acc, k) => acc + subtreeLeafWeight(k.id), 0);
  };

  const mainBranches = childrenOf(rootNodeId);
  if (mainBranches.length === 0) return updated;

  // Balance main branches between right and left hemispheres (Tony Buzan mind map balance)
  const rightBranches: MindNode[] = [];
  const leftBranches: MindNode[] = [];

  // Preserve current side preference if already placed cleanly, else alternate balanced weights
  let rightWeight = 0;
  let leftWeight = 0;
  const sortedMain = [...mainBranches].sort((a, b) => a.y - b.y);

  for (const branch of sortedMain) {
    const w = subtreeLeafWeight(branch.id);
    if (rightWeight <= leftWeight) {
      rightBranches.push(branch);
      rightWeight += w;
    } else {
      leftBranches.push(branch);
      leftWeight += w;
    }
  }

  const layoutSide = (sideBranches: MindNode[], direction: 1 | -1) => {
    const verticalUnit = 232;
    const weights = sideBranches.map((b) => subtreeLeafWeight(b.id));
    const totalSpan = weights.reduce((a, b) => a + b, 0) * verticalUnit;
    let cursorY = -totalSpan * 0.5;

    const placeSubtree = (node: MindNode, depth: number, centerY: number) => {
      const horizStep = depth === 1 ? 330 : 272;
      const parent = node.parentId ? updated[node.parentId] : updated[rootNodeId];
      // Slight organic curve arc on main branches
      const arcPull = depth === 1 ? Math.min(42, Math.abs(centerY) * 0.08) : 0;
      node.x = Math.round(parent.x + direction * (horizStep - arcPull));
      node.y = Math.round(centerY);
      node.branchColor =
        depth === 1 ? node.branchColor : parent.branchColor;

      if (node.collapsed) return;
      const kids = childrenOf(node.id);
      if (kids.length === 0) return;

      const kidWeights = kids.map((k) => subtreeLeafWeight(k.id));
      const subSpan = kidWeights.reduce((a, b) => a + b, 0) * (verticalUnit * 0.94);
      let subCursor = centerY - subSpan * 0.5;

      kids.forEach((kid, idx) => {
        const kw = kidWeights[idx] * (verticalUnit * 0.94);
        const kidCenterY = subCursor + kw * 0.5;
        subCursor += kw;
        placeSubtree(kid, depth + 1, kidCenterY);
      });
    };

    sideBranches.forEach((branch, idx) => {
      const span = weights[idx] * verticalUnit;
      const centerY = cursorY + span * 0.5;
      cursorY += span;
      placeSubtree(branch, 1, centerY);
    });
  };

  layoutSide(rightBranches, 1);
  layoutSide(leftBranches, -1);

  // Repulsive collision relaxation pass so large stickers never overlap
  const movableIds = Object.keys(updated).filter((id) => id !== rootNodeId);
  for (let iter = 0; iter < 22; iter++) {
    for (let i = 0; i < movableIds.length; i++) {
      for (let j = i + 1; j < movableIds.length; j++) {
        const a = updated[movableIds[i]];
        const b = updated[movableIds[j]];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minXGap = 215;
        const minYGap = 224;
        if (Math.abs(dx) < minXGap && Math.abs(dy) < minYGap) {
          const pushY = (minYGap - Math.abs(dy)) * 0.35 * (dy >= 0 ? 1 : -1);
          a.y = Math.round(a.y - pushY);
          b.y = Math.round(b.y + pushY);
        }
      }
    }
  }

  return updated;
}
