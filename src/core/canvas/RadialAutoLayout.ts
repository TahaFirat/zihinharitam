import {
  BRANCH_PALETTE,
  type MindNode,
  type StickerSizePreset,
} from '../../types/mindmap';

export interface TreeMeta {
  childrenMap: Map<string, string[]>;
  hiddenNodeIds: Set<string>;
  descendantCountMap: Map<string, number>;
  depthMap: Map<string, number>;
  mainBranchMap: Map<string, string>;
}

/**
 * Estimates rendered bounding box (including top sticker & bottom long description note)
 * so branches, long notes, and XL stickers never overlap or tangle across trees.
 */
export function estimateNodeDimensions(
  node: MindNode,
  isRoot: boolean
): { width: number; topExtent: number; bottomExtent: number; totalHeight: number } {
  const sizePreset: StickerSizePreset =
    node.stickerSize ?? (node.nodeStyle === 'organic' && !isRoot ? 'lg' : 'md');

  let stickerPx = 0;
  if (node.sticker) {
    if (isRoot) {
      stickerPx =
        sizePreset === 'sm'
          ? 84
          : sizePreset === 'lg'
          ? 168
          : sizePreset === 'xl'
          ? 214
          : 124;
    } else {
      stickerPx =
        sizePreset === 'sm'
          ? 52
          : sizePreset === 'lg'
          ? 124
          : sizePreset === 'xl'
          ? 168
          : 86;
    }
  }

  const hasLongNote = Boolean(node.note && node.note.trim().length > 0);
  const noteText = node.note?.trim() ?? '';
  let noteExtraH = 0;
  if (hasLongNote) {
    if (node.noteCollapsed) {
      noteExtraH = 34;
    } else {
      const explicitLines = noteText.split('\n').length;
      const wrappedLines = Math.ceil(noteText.length / 34);
      const totalLines = Math.min(10, Math.max(explicitLines, wrappedLines));
      noteExtraH = 22 + totalLines * 17;
    }
  }

  const titleLines = Math.max(1, Math.ceil((node.title || 'Yeni Konu').length / 22));
  const cardBodyH =
    (isRoot ? 54 : 44) +
    (titleLines - 1) * 18 +
    (node.subtitle ? 18 : 0) +
    (node.techBadge ? 22 : 0) +
    (node.priorityTag ? 22 : 0) +
    noteExtraH;

  const width = hasLongNote
    ? 304
    : isRoot
    ? 268
    : Math.min(296, Math.max(164, (node.title || '').length * 8.5 + 56));

  const topExtent = Math.round(cardBodyH * 0.5 + stickerPx + 14);
  const bottomExtent = Math.round(cardBodyH * 0.5 + 18);

  return {
    width,
    topExtent,
    bottomExtent,
    totalHeight: topExtent + bottomExtent,
  };
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
 * Accounts for long multi-line notes and XL stickers so new branches never overlap existing ones.
 */
export function findBestOpenBranchPosition(
  parentNode: MindNode,
  allNodes: Record<string, MindNode>,
  rootNodeId: string
): { x: number; y: number } {
  const isRoot = parentNode.id === rootNodeId;
  const siblings = Object.values(allNodes).filter((n) => n.parentId === parentNode.id);

  if (isRoot) {
    const radiusX = 355;
    const radiusY = 268;
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
      -1.14,
      1.14,
      Math.PI - 1.14,
      Math.PI + 1.14,
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
  const parentDims = estimateNodeDimensions(parentNode, false);
  const stepX = Math.max(268, Math.round(parentDims.width * 0.55 + 148)) * outwardSign;

  const candidateOffsetsY = [0, -210, 210, -400, 400, -590, 590, -115, 115, -760, 760];
  let bestPos = { x: parentNode.x + stepX, y: parentNode.y };
  let bestClearScore = -Infinity;

  for (const offsetY of candidateOffsetsY) {
    const cx = parentNode.x + stepX;
    const cy = parentNode.y + offsetY;
    let worstOverlapPenalty = 0;
    let minCenterDist = Infinity;

    for (const other of Object.values(allNodes)) {
      const od = estimateNodeDimensions(other, other.id === rootNodeId);
      const reqX = od.width * 0.5 + 125;
      const reqY = (cy >= other.y ? od.bottomExtent : od.topExtent) + 88;
      const dx = Math.abs(cx - other.x);
      const dy = Math.abs(cy - other.y);
      if (dx < reqX && dy < reqY) {
        worstOverlapPenalty += (reqX - dx) + (reqY - dy) * 1.4;
      }
      const d = Math.hypot(cx - other.x, cy - other.y);
      if (d < minCenterDist) minCenterDist = d;
    }

    const score = minCenterDist - worstOverlapPenalty * 4 - Math.abs(offsetY) * 0.08;
    if (score > bestClearScore) {
      bestClearScore = score;
      bestPos = { x: Math.round(cx), y: Math.round(cy) };
    }
    if (worstOverlapPenalty === 0 && minCenterDist > 195) {
      return { x: Math.round(cx), y: Math.round(cy) };
    }
  }

  return bestPos;
}

/**
 * Gentle non-destructive collision resolver: preserves user's left/right layout while
 * vertically pushing apart any non-root nodes whose long descriptions or XL stickers overlap.
 */
export function resolveTreeCollisions(
  nodes: Record<string, MindNode>,
  rootNodeId: string
): Record<string, MindNode> {
  const meta = computeTreeMeta(nodes, rootNodeId);
  const updated: Record<string, MindNode> = {};
  for (const [id, n] of Object.entries(nodes)) {
    updated[id] = { ...n };
  }

  const visibleIds = Object.keys(updated).filter(
    (id) => !meta.hiddenNodeIds.has(id)
  );
  if (visibleIds.length <= 2) return updated;

  const dimsMap = new Map<string, ReturnType<typeof estimateNodeDimensions>>();
  for (const id of visibleIds) {
    dimsMap.set(id, estimateNodeDimensions(updated[id], id === rootNodeId));
  }

  // Helper to shift a node and its descendants together when separating whole subtrees
  const shiftSubtreeY = (startId: string, deltaY: number) => {
    if (startId === rootNodeId || Math.abs(deltaY) < 0.5) return;
    const stack = [startId];
    const seen = new Set<string>([startId]);
    while (stack.length > 0) {
      const curId = stack.pop()!;
      if (updated[curId]) {
        updated[curId].y = Math.round(updated[curId].y + deltaY);
      }
      const kids = meta.childrenMap.get(curId) ?? [];
      for (const kid of kids) {
        if (!seen.has(kid)) {
          seen.add(kid);
          stack.push(kid);
        }
      }
    }
  };

  const isAncestor = (ancId: string, descId: string): boolean => {
    let cur = updated[descId]?.parentId;
    while (cur) {
      if (cur === ancId) return true;
      cur = updated[cur]?.parentId ?? null;
    }
    return false;
  };

  for (let iter = 0; iter < 16; iter++) {
    let anyMoved = false;
    for (let i = 0; i < visibleIds.length; i++) {
      for (let j = i + 1; j < visibleIds.length; j++) {
        const idA = visibleIds[i];
        const idB = visibleIds[j];
        const a = updated[idA];
        const b = updated[idB];
        const dA = dimsMap.get(idA)!;
        const dB = dimsMap.get(idB)!;

        const minXGap = (dA.width + dB.width) * 0.5 + 34;
        const dx = Math.abs(b.x - a.x);
        if (dx >= minXGap) continue;

        // Vertical required distance depends on which node is above the other (stickers extend upwards, notes extend downwards)
        const aIsAbove = a.y <= b.y;
        const minYGap = aIsAbove
          ? dA.bottomExtent + dB.topExtent + 22
          : dB.bottomExtent + dA.topExtent + 22;
        const dy = Math.abs(b.y - a.y);

        if (dy < minYGap) {
          const overlap = minYGap - dy;
          const dir = b.y >= a.y ? 1 : -1;
          const push = Math.max(4, overlap * 0.48);

          if (idA === rootNodeId) {
            shiftSubtreeY(idB, dir * push * 1.4);
          } else if (idB === rootNodeId) {
            shiftSubtreeY(idA, -dir * push * 1.4);
          } else if (isAncestor(idA, idB)) {
            shiftSubtreeY(idB, dir * push);
          } else if (isAncestor(idB, idA)) {
            shiftSubtreeY(idA, -dir * push);
          } else {
            shiftSubtreeY(idA, -dir * push * 0.55);
            shiftSubtreeY(idB, dir * push * 0.55);
          }
          anyMoved = true;
        }
      }
    }
    if (!anyMoved) break;
  }

  return updated;
}

/**
 * Smart Auto-Layout: Organizes main branches radially balanced left/right around Root Hub
 * and solves overlaps with dynamic bounding-box spacing for long notes and large stickers.
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

  const subtreeVerticalWeight = (nodeId: string): number => {
    const node = updated[nodeId];
    if (!node) return 1;
    const ownDims = estimateNodeDimensions(node, nodeId === rootNodeId);
    const ownWeight = Math.max(1, ownDims.totalHeight / 215);
    if (node.collapsed) return ownWeight;
    const kids = childrenOf(nodeId);
    if (kids.length === 0) return ownWeight;
    const kidsSum = kids.reduce((acc, k) => acc + subtreeVerticalWeight(k.id), 0);
    return Math.max(ownWeight, kidsSum);
  };

  const mainBranches = childrenOf(rootNodeId);
  if (mainBranches.length === 0) return updated;

  const rightBranches: MindNode[] = [];
  const leftBranches: MindNode[] = [];

  let rightWeight = 0;
  let leftWeight = 0;
  const sortedMain = [...mainBranches].sort((a, b) => a.y - b.y);

  for (const branch of sortedMain) {
    const w = subtreeVerticalWeight(branch.id);
    if (rightWeight <= leftWeight) {
      rightBranches.push(branch);
      rightWeight += w;
    } else {
      leftBranches.push(branch);
      leftWeight += w;
    }
  }

  const layoutSide = (sideBranches: MindNode[], direction: 1 | -1) => {
    const verticalUnit = 244;
    const weights = sideBranches.map((b) => subtreeVerticalWeight(b.id));
    const totalSpan = weights.reduce((a, b) => a + b, 0) * verticalUnit;
    let cursorY = -totalSpan * 0.5;

    const placeSubtree = (node: MindNode, depth: number, centerY: number) => {
      const parent = node.parentId ? updated[node.parentId] : updated[rootNodeId];
      const parentDims = estimateNodeDimensions(parent, parent.id === rootNodeId);
      const nodeDims = estimateNodeDimensions(node, false);
      const horizStep =
        depth === 1
          ? Math.max(352, Math.round((parentDims.width + nodeDims.width) * 0.5 + 108))
          : Math.max(306, Math.round((parentDims.width + nodeDims.width) * 0.5 + 84));

      const arcPull = depth === 1 ? Math.min(38, Math.abs(centerY) * 0.06) : 0;
      node.x = Math.round(parent.x + direction * (horizStep - arcPull));
      node.y = Math.round(centerY);
      node.branchColor = depth === 1 ? node.branchColor : parent.branchColor;

      if (node.collapsed) return;
      const kids = childrenOf(node.id);
      if (kids.length === 0) return;

      const kidWeights = kids.map((k) => subtreeVerticalWeight(k.id));
      const subSpan = kidWeights.reduce((a, b) => a + b, 0) * (verticalUnit * 0.96);
      let subCursor = centerY - subSpan * 0.5;

      kids.forEach((kid, idx) => {
        const kw = kidWeights[idx] * (verticalUnit * 0.96);
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

  return resolveTreeCollisions(updated, rootNodeId);
}
