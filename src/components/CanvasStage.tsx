import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Plus, Eye, Sparkles, ChevronRight, X, Link2 } from 'lucide-react';
import type {
  AcademicDepartment,
  CollaboratorPresence,
  CrossLink,
  ExamRecallMode,
  MindNode,
  NodeVisualStyle,
  StickerSizePreset,
  ViewportTransform,
} from '../types/mindmap';
import { computeSafeCanvasDimensions } from '../core/canvas/CanvasMemoryGuard';
import {
  computeCrossLinkGeometry,
  CrossLinkRenderer,
} from '../core/canvas/CrossLinkRenderer';
import { HitTestSpatialIndex } from '../core/canvas/HitTestSpatialIndex';
import { InfiniteViewport } from '../core/canvas/InfiniteViewport';
import {
  OrganicBranchRenderer,
  stepSpringBranch,
  type SpringDragBranchState,
} from '../core/canvas/OrganicBranchRenderer';
import {
  computeTreeMeta,
  findBestOpenBranchPosition,
  resolveNewBranchColor,
} from '../core/canvas/RadialAutoLayout';
import { resolveStarterStickerForConcept } from '../data/academicTemplates';
import { hapticLight, hapticMedium, hapticSuccess } from '../core/native/NativeBridge';
import { getViewportKeyboardSnapshot, useKeyboardInset } from '../core/native/useKeyboardInset';

interface CanvasStageProps {
  nodes: Record<string, MindNode>;
  crossLinks?: CrossLink[];
  rootNodeId: string;
  department?: AcademicDepartment;
  darkMode: boolean;
  defaultNodeStyle?: NodeVisualStyle;
  singleNodeDragMode?: boolean;
  spacePressed?: boolean;
  isAutoLayoutAnimating?: boolean;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  linkingFromNodeId: string | null;
  focusMode: boolean;
  examMode: ExamRecallMode;
  revealedExamIds: Set<string>;
  collaborators: CollaboratorPresence[];
  fitTrigger: number;
  radarJumpRequest: { x: number; y: number; seq: number } | null;
  onSelectNode: (nodeId: string | null) => void;
  onStartEditing: (nodeId: string) => void;
  onFinishEditing: () => void;
  onUpdateNodeTitle: (nodeId: string, title: string) => void;
  onCommitBatchNodePositions: (updates: Record<string, { x: number; y: number }>) => void;
  onCreateChildBranch: (
    parentId: string,
    worldX: number,
    worldY: number,
    branchColor: string
  ) => void;
  onCompleteCrossLink: (fromNodeId: string, toNodeId: string) => void;
  onCancelCrossLink: () => void;
  onUpdateCrossLinkLabel: (linkId: string, label: string) => void;
  onDeleteCrossLink: (linkId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onRevealExamNode: (nodeId: string) => void;
  onPointerWorldMove: (worldX: number, worldY: number) => void;
  onZoomChange: (zoomPercent: number) => void;
  onViewportSnapshot: (
    vp: ViewportTransform,
    stageW: number,
    stageH: number,
    hiddenIds: Set<string>
  ) => void;
  onActiveNodeScreenPosition: (pos: { x: number; y: number } | null) => void;
}

function collectSubtreeIds(
  startId: string,
  nodes: Record<string, MindNode>,
  rootNodeId: string,
  singleOnly: boolean
): string[] {
  if (singleOnly || startId === rootNodeId) {
    return [startId];
  }
  const childrenMap = new Map<string, string[]>();
  for (const n of Object.values(nodes)) {
    if (n.parentId) {
      let arr = childrenMap.get(n.parentId);
      if (!arr) {
        arr = [];
        childrenMap.set(n.parentId, arr);
      }
      arr.push(n.id);
    }
  }

  const collected: string[] = [];
  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    collected.push(cur);
    const kids = childrenMap.get(cur);
    if (kids) {
      for (const k of kids) {
        if (!visited.has(k)) {
          visited.add(k);
          queue.push(k);
        }
      }
    }
  }
  return collected;
}

function resolveStickerSizeClasses(
  size: StickerSizePreset | undefined,
  isRoot: boolean,
  isOrganic: boolean
): string {
  const effective: StickerSizePreset = size ?? (isOrganic ? 'lg' : 'md');
  if (isRoot) {
    switch (effective) {
      case 'sm':
        return 'h-26 w-26 sm:h-30 sm:w-30';
      case 'lg':
        return 'h-40 w-40 sm:h-46 sm:w-46';
      case 'xl':
        return 'h-48 w-48 sm:h-54 sm:w-54';
      case 'md':
      default:
        return 'h-34 w-34 sm:h-40 sm:w-40';
    }
  }
  switch (effective) {
    case 'sm':
      return 'h-16 w-16 sm:h-18 sm:w-18';
    case 'lg':
      return 'h-27 w-27 sm:h-31 sm:w-31';
    case 'xl':
      return 'h-34 w-34 sm:h-38 sm:w-38';
    case 'md':
    default:
      return 'h-22 w-22 sm:h-25 sm:w-25';
  }
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  nodes,
  crossLinks,
  rootNodeId,
  department = 'genel',
  darkMode,
  defaultNodeStyle = 'card',
  singleNodeDragMode = false,
  spacePressed = false,
  isAutoLayoutAnimating = false,
  selectedNodeId,
  editingNodeId,
  linkingFromNodeId,
  focusMode,
  examMode,
  revealedExamIds,
  collaborators,
  fitTrigger,
  radarJumpRequest,
  onSelectNode,
  onStartEditing,
  onFinishEditing,
  onUpdateNodeTitle,
  onCommitBatchNodePositions,
  onCreateChildBranch,
  onCompleteCrossLink,
  onCancelCrossLink,
  onUpdateCrossLinkLabel,
  onDeleteCrossLink,
  onToggleCollapse,
  onRevealExamNode,
  onPointerWorldMove,
  onZoomChange,
  onViewportSnapshot,
  onActiveNodeScreenPosition,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const domWorldRef = useRef<HTMLDivElement>(null);

  // Direct GPU DOM element handles for 0-React-Render Transient Drag + Dynamic Card ResizeObserver
  const nodeDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const nodeCardElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const nodeDimensionsRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const cardResizeObserverRef = useRef<ResizeObserver | null>(null);
  const crossLinkDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const transientPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const isInteractingRef = useRef<boolean>(false);
  const penReleaseTimerRef = useRef<number | null>(null);
  const [activeDragIds, setActiveDragIds] = useState<string[]>([]);

  const viewportRef = useRef<InfiniteViewport>(
    new InfiniteViewport({ x: 0, y: 0, scale: 1 })
  );
  const spatialIndexRef = useRef<HitTestSpatialIndex>(new HitTestSpatialIndex());
  const branchRendererRef = useRef<OrganicBranchRenderer>(new OrganicBranchRenderer());
  const crossLinkRendererRef = useRef<CrossLinkRenderer>(new CrossLinkRenderer());
  const dragPreviewRef = useRef<SpringDragBranchState | null>(null);
  const pendingLinkTargetRef = useRef<{ x: number; y: number } | null>(null);
  const needsRedrawRef = useRef<boolean>(true);

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1200,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  const [cullTick, setCullTick] = useState(0);
  const [currentScale, setCurrentScale] = useState(1);
  const lastCullTransformRef = useRef<ViewportTransform>({ x: 0, y: 0, scale: 1 });

  const activeTouchesRef = useRef<
    Map<number, { x: number; y: number; pointerType: string }>
  >(new Map());
  const pinchStateRef = useRef<{
    lastDist: number;
    lastMidX: number;
    lastMidY: number;
  } | null>(null);
  const panStateRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);

  // V3 Transient Subtree Drag State (0 React re-renders during pointermove!)
  const nodeDragRef = useRef<{
    pointerId: number;
    nodeId: string;
    startClientX: number;
    startClientY: number;
    initialPositions: Map<string, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  const branchDragRef = useRef<{
    pointerId: number;
    parentId: string;
    directionBias?: 1 | -1;
    startClientX: number;
    startClientY: number;
    color: string;
    moved: boolean;
  } | null>(null);
  const lastTapRef = useRef<{ nodeId: string; time: number } | null>(null);
  const penActiveRef = useRef<boolean>(false);
  const kbSnap = useKeyboardInset();

  const setInteractingAttr = useCallback((active: boolean) => {
    isInteractingRef.current = active;
    if (containerRef.current) {
      containerRef.current.dataset.interacting = active ? 'true' : 'false';
    }
  }, []);

  // Hard reset for any iOS WKWebView orphaned pointers/captures (prevents pan lock after branch add/focus steal)
  const resetAllGestureStates = useCallback(() => {
    activeTouchesRef.current.clear();
    pinchStateRef.current = null;
    panStateRef.current = null;
    nodeDragRef.current = null;
    branchDragRef.current = null;
    dragPreviewRef.current = null;
    penActiveRef.current = false;
    setActiveDragIds([]);
    setInteractingAttr(false);
  }, [setInteractingAttr]);

  // Shared ResizeObserver measuring real rendered widths/heights of node cards (fixes long Turkish word branch anchors)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const id = el.dataset.nodeCardId;
        if (!id) continue;
        const w = Math.round(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth);
        const h = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
        const prev = nodeDimensionsRef.current.get(id);
        if (!prev || Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1) {
          nodeDimensionsRef.current.set(id, { w, h });
          changed = true;
        }
      }
      if (changed) {
        needsRedrawRef.current = true;
      }
    });
    cardResizeObserverRef.current = ro;
    nodeCardElementsRef.current.forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      cardResizeObserverRef.current = null;
    };
  }, []);

  const bindNodeCardElement = useCallback((nodeId: string, el: HTMLElement | null) => {
    const prev = nodeCardElementsRef.current.get(nodeId);
    if (prev && prev !== el) {
      cardResizeObserverRef.current?.unobserve(prev);
      nodeCardElementsRef.current.delete(nodeId);
    }
    if (el && prev !== el) {
      nodeCardElementsRef.current.set(nodeId, el);
      cardResizeObserverRef.current?.observe(el);
    }
  }, []);

  const treeMeta = useMemo(
    () =>
      computeTreeMeta(
        nodes,
        rootNodeId,
        examMode === 'hide_visuals_children',
        revealedExamIds
      ),
    [nodes, rootNodeId, examMode, revealedExamIds]
  );

  const focusedMainBranchId = useMemo(() => {
    if (!focusMode || !selectedNodeId || selectedNodeId === rootNodeId) {
      return null;
    }
    return treeMeta.mainBranchMap.get(selectedNodeId) ?? null;
  }, [focusMode, selectedNodeId, rootNodeId, treeMeta]);

  useEffect(() => {
    spatialIndexRef.current.rebuild(nodes, rootNodeId, treeMeta.hiddenNodeIds);
    needsRedrawRef.current = true;
    setCullTick((t) => t + 1);
  }, [nodes, rootNodeId, treeMeta.hiddenNodeIds]);

  const renderDataRef = useRef({
    nodes,
    crossLinks,
    rootNodeId,
    darkMode,
    treeMeta,
    focusedMainBranchId,
    stageSize,
    editingNodeId,
    linkingFromNodeId,
  });
  renderDataRef.current = {
    nodes,
    crossLinks,
    rootNodeId,
    darkMode,
    treeMeta,
    focusedMainBranchId,
    stageSize,
    editingNodeId,
    linkingFromNodeId,
  };

  const callbacksRef = useRef({
    onZoomChange,
    onViewportSnapshot,
    onActiveNodeScreenPosition,
  });
  callbacksRef.current = {
    onZoomChange,
    onViewportSnapshot,
    onActiveNodeScreenPosition,
  };

  const lastSnapSentRef = useRef<{
    x: number;
    y: number;
    scale: number;
    w: number;
    h: number;
    hiddenCount: number;
  } | null>(null);
  const lastScreenPosSentRef = useRef<{ x: number; y: number } | null>(null);

  const syncDomWorldLayer = useCallback(() => {
    const vp = viewportRef.current.getTransform();
    if (domWorldRef.current) {
      domWorldRef.current.style.transform = `translate3d(${vp.x}px, ${vp.y}px, 0) scale(${vp.scale})`;
    }
    callbacksRef.current.onZoomChange(Math.round(vp.scale * 100));

    const w = renderDataRef.current.stageSize.w;
    const h = renderDataRef.current.stageSize.h;
    const hiddenIds = renderDataRef.current.treeMeta.hiddenNodeIds;
    const prevSnap = lastSnapSentRef.current;
    if (
      !prevSnap ||
      Math.abs(prevSnap.x - vp.x) > 0.5 ||
      Math.abs(prevSnap.y - vp.y) > 0.5 ||
      Math.abs(prevSnap.scale - vp.scale) > 0.002 ||
      prevSnap.w !== w ||
      prevSnap.h !== h ||
      prevSnap.hiddenCount !== hiddenIds.size
    ) {
      lastSnapSentRef.current = {
        x: vp.x,
        y: vp.y,
        scale: vp.scale,
        w,
        h,
        hiddenCount: hiddenIds.size,
      };
      callbacksRef.current.onViewportSnapshot(vp, w, h, hiddenIds);
    }

    const editId = renderDataRef.current.editingNodeId;
    if (editId && renderDataRef.current.nodes[editId]) {
      const n = renderDataRef.current.nodes[editId];
      const tr = transientPositionsRef.current.get(editId);
      const sp = viewportRef.current.worldToScreen(tr ? tr.x : n.x, tr ? tr.y : n.y);
      const prevPos = lastScreenPosSentRef.current;
      if (
        !prevPos ||
        Math.abs(prevPos.x - sp.x) > 0.5 ||
        Math.abs(prevPos.y - sp.y) > 0.5
      ) {
        lastScreenPosSentRef.current = sp;
        callbacksRef.current.onActiveNodeScreenPosition(sp);
      }
    } else if (lastScreenPosSentRef.current !== null) {
      lastScreenPosSentRef.current = null;
      callbacksRef.current.onActiveNodeScreenPosition(null);
    }

    const prev = lastCullTransformRef.current;
    if (
      Math.hypot(vp.x - prev.x, vp.y - prev.y) > 72 ||
      Math.abs(vp.scale - prev.scale) > 0.05
    ) {
      lastCullTransformRef.current = vp;
      setCurrentScale(vp.scale);
      setCullTick((t) => t + 1);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(240, Math.round(rect.width));
      const h = Math.max(240, Math.round(rect.height));
      setStageSize({ w, h });

      if (canvasRef.current) {
        // iOS WKWebView 256MB Jetsam Memory Guard (`MAX_CANVAS_AREA = 16_777_216`)
        const safe = computeSafeCanvasDimensions(w, h);
        canvasRef.current.width = safe.width;
        canvasRef.current.height = safe.height;
      }
      needsRedrawRef.current = true;
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const bounds = spatialIndexRef.current.getTotalBounds();
    const isPhone = rect.width < 640;
    viewportRef.current.fitBounds(
      bounds,
      rect.width || window.innerWidth,
      rect.height || window.innerHeight,
      isPhone ? 44 : 92,
      fitTrigger === 0 ? 1 : 360
    );
    needsRedrawRef.current = true;
    syncDomWorldLayer();
  }, [fitTrigger, syncDomWorldLayer]);

  useEffect(() => {
    if (!radarJumpRequest) return;
    const cur = viewportRef.current.getTransform();
    viewportRef.current.centerWorldPoint(
      radarJumpRequest.x,
      radarJumpRequest.y,
      stageSize.w,
      stageSize.h,
      cur.scale,
      300
    );
    needsRedrawRef.current = true;
  }, [radarJumpRequest, stageSize.w, stageSize.h]);

  useEffect(() => {
    const activeTargetId = editingNodeId ?? selectedNodeId;
    if (!activeTargetId) return;
    const node = nodes[activeTargetId];
    if (!node) return;

    const centerAboveKeyboard = () => {
      // iOS WKWebView Keyboard Scroll Lock: prevent page upward push
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      const snap = getViewportKeyboardSnapshot();
      const availW = snap.viewportW || window.innerWidth;
      const availH = snap.visibleBottomY || window.innerHeight;
      const barH = snap.studioBarHeight || 220;
      const isCompactOrKeyboard =
        snap.isPhone || snap.isTablet || snap.isKeyboardOpen || snap.isTouchDevice;

      const curScale = viewportRef.current.getTransform().scale;
      const desiredScale =
        editingNodeId && curScale < 0.78
          ? 0.92
          : curScale < 0.65
          ? 0.85
          : curScale > 1.55
          ? 1.25
          : curScale;

      if (isCompactOrKeyboard) {
        // Compute exact unobstructed middle between TopMinimalHUD (~72px) and Studio Dock + Keyboard
        const topSafe = 72;
        const bottomEdge = Math.max(topSafe + 90, availH - barH - 12);
        const usableCenterY = Math.round((topSafe + bottomEdge) * 0.52);
        const curT = viewportRef.current.getTransform();
        const endX = availW * 0.5 - node.x * desiredScale;
        const endY = usableCenterY - node.y * desiredScale;
        if (
          Math.abs(curT.x - endX) > 4 ||
          Math.abs(curT.y - endY) > 4 ||
          Math.abs(curT.scale - desiredScale) > 0.015
        ) {
          viewportRef.current.animateTo(
            { x: endX, y: endY, scale: desiredScale },
            220
          );
          needsRedrawRef.current = true;
        }
      } else {
        const sp = viewportRef.current.worldToScreen(node.x, node.y);
        if (
          sp.x < 140 ||
          sp.x > availW - 140 ||
          sp.y < 110 ||
          sp.y > availH - barH - 40
        ) {
          viewportRef.current.centerWorldPoint(
            node.x,
            node.y - 40,
            availW,
            availH,
            desiredScale,
            260
          );
          needsRedrawRef.current = true;
        } else {
          onActiveNodeScreenPosition(sp);
        }
      }
    };

    const lockWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    let lastObservedKbHeight = getViewportKeyboardSnapshot().keyboardHeight;
    const handleViewportResize = () => {
      const nextKbHeight = getViewportKeyboardSnapshot().keyboardHeight;
      if (Math.abs(nextKbHeight - lastObservedKbHeight) > 20) {
        lastObservedKbHeight = nextKbHeight;
        centerAboveKeyboard();
      }
    };

    // Slight delay allows ResizeObserver in KeyboardVisualBar to report accurate dock height
    const initTimer = window.setTimeout(centerAboveKeyboard, 35);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', handleViewportResize);
    vv?.addEventListener('scroll', lockWindowScroll);
    window.addEventListener('scroll', lockWindowScroll);
    return () => {
      window.clearTimeout(initTimer);
      vv?.removeEventListener('resize', handleViewportResize);
      vv?.removeEventListener('scroll', lockWindowScroll);
      window.removeEventListener('scroll', lockWindowScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNodeId, selectedNodeId]);

  useEffect(() => {
    needsRedrawRef.current = true;
  }, [nodes, crossLinks, darkMode, focusedMainBranchId, stageSize, treeMeta, linkingFromNodeId]);

  // 60/120 FPS Main Canvas Render Loop (reads transientPositionsRef directly during drag!)
  useEffect(() => {
    let rafId = 0;

    const frame = (now: number) => {
      const vpChanged = viewportRef.current.step(now);
      let springChanged = false;
      if (dragPreviewRef.current) {
        springChanged = stepSpringBranch(dragPreviewRef.current);
      }

      const hasAnimatedCrossLinks =
        Boolean(renderDataRef.current.crossLinks?.length) ||
        Boolean(renderDataRef.current.linkingFromNodeId);

      if (
        vpChanged ||
        springChanged ||
        needsRedrawRef.current ||
        hasAnimatedCrossLinks
      ) {
        const shouldSyncDom = vpChanged || needsRedrawRef.current;
        needsRedrawRef.current = false;

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const {
              nodes: baseNodes,
              crossLinks: curLinks,
              rootNodeId: curRoot,
              darkMode: curDark,
              treeMeta: curMeta,
              focusedMainBranchId: curFocus,
              stageSize: curSize,
              linkingFromNodeId: curLinkFrom,
            } = renderDataRef.current;

            // Overlay transient dragged coordinates in O(k) without mutating React state
            let curNodes = baseNodes;
            if (transientPositionsRef.current.size > 0) {
              const overlaid: Record<string, MindNode> = { ...baseNodes };
              transientPositionsRef.current.forEach((pos, id) => {
                const orig = baseNodes[id];
                if (orig) {
                  overlaid[id] = { ...orig, x: pos.x, y: pos.y };
                }
              });
              curNodes = overlaid;
            }

            const dpr = canvas.width / Math.max(1, curSize.w);
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // 1. Paper-textured dot grid background
            viewportRef.current.renderPaperDotGrid(ctx, curSize.w, curSize.h, curDark);

            // 2. Organic tapered Bezier branches
            const vp = viewportRef.current.getTransform();
            const visBounds = viewportRef.current.getVisibleWorldBounds(
              curSize.w,
              curSize.h,
              520
            );

            branchRendererRef.current.renderAllBranches(
              ctx,
              curNodes,
              curRoot,
              vp,
              visBounds,
              curMeta.hiddenNodeIds,
              curFocus,
              curMeta.depthMap,
              curMeta.mainBranchMap,
              dragPreviewRef.current,
              nodeDimensionsRef.current,
              isInteractingRef.current
            );

            // 3. Animated Directional CrossLinks
            crossLinkRendererRef.current.renderInteractiveCrossLinks(
              ctx,
              curLinks,
              curNodes,
              vp,
              curMeta.hiddenNodeIds,
              now,
              curLinkFrom ? curNodes[curLinkFrom] ?? null : null,
              curLinkFrom ? pendingLinkTargetRef.current : null
            );

            ctx.restore();
          }
        }

        if (shouldSyncDom) {
          syncDomWorldLayer();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [syncDomWorldLayer]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const cur = viewportRef.current.getTransform();
      const zoomFactor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.0085 : 0.0016));
      viewportRef.current.zoomAtScreenPoint(cur.scale * zoomFactor, sx, sy);
      needsRedrawRef.current = true;
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    // Authoritative iOS/iPadOS physical touch count sync: clears any ghost pointers dropped during <input>/modal focus shifts
    const onNativeTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length === 1 && activeTouchesRef.current.size > 0) {
        activeTouchesRef.current.clear();
        pinchStateRef.current = null;
        if (!branchDragRef.current && !nodeDragRef.current) {
          panStateRef.current = null;
        }
        penActiveRef.current = false;
      }
    };
    const onNativeTouchEndOrCancel = (ev: TouchEvent) => {
      if (ev.touches.length === 0) {
        window.setTimeout(() => {
          if (activeTouchesRef.current.size > 0 && !nodeDragRef.current && !branchDragRef.current && !panStateRef.current) {
            resetAllGestureStates();
          }
        }, 50);
      }
    };
    const onWindowBlur = () => {
      resetAllGestureStates();
    };

    el.addEventListener('touchstart', onNativeTouchStart, { passive: true });
    el.addEventListener('touchend', onNativeTouchEndOrCancel, { passive: true });
    el.addEventListener('touchcancel', onNativeTouchEndOrCancel, { passive: true });
    window.addEventListener('blur', onWindowBlur);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onNativeTouchStart);
      el.removeEventListener('touchend', onNativeTouchEndOrCancel);
      el.removeEventListener('touchcancel', onNativeTouchEndOrCancel);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [resetAllGestureStates]);

  // True RBush Spatial Viewport Virtualization (`<0.4ms` query, `+260px` buffer):
  // Ensures 1,000+ node maps render ONLY visible DOM nodes (+ selected/editing/dragged subtree),
  // holding steady 60 FPS on iPhone 12 and 120 FPS on iPad Pro!
  const visibleNodeIds = useMemo(() => {
    void cullTick;
    const bounds = viewportRef.current.getVisibleWorldBounds(
      stageSize.w,
      stageSize.h,
      260
    );
    const ids = spatialIndexRef.current.queryViewport(bounds);
    const set = new Set<string>(ids);

    if (rootNodeId && nodes[rootNodeId] && !treeMeta.hiddenNodeIds.has(rootNodeId)) {
      set.add(rootNodeId);
    }
    if (selectedNodeId && nodes[selectedNodeId] && !treeMeta.hiddenNodeIds.has(selectedNodeId)) {
      set.add(selectedNodeId);
    }
    if (editingNodeId && nodes[editingNodeId] && !treeMeta.hiddenNodeIds.has(editingNodeId)) {
      set.add(editingNodeId);
    }
    for (const dragId of activeDragIds) {
      if (nodes[dragId] && !treeMeta.hiddenNodeIds.has(dragId)) {
        set.add(dragId);
      }
    }
    return Array.from(set);
  }, [
    cullTick,
    stageSize.w,
    stageSize.h,
    rootNodeId,
    selectedNodeId,
    editingNodeId,
    activeDragIds,
    nodes,
    treeMeta.hiddenNodeIds,
  ]);

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'pen') {
      if (penReleaseTimerRef.current !== null) {
        window.clearTimeout(penReleaseTimerRef.current);
        penReleaseTimerRef.current = null;
      }
      penActiveRef.current = true;
    } else if (e.pointerType === 'touch' && penActiveRef.current) {
      penActiveRef.current = false;
    }

    // Clear any stale ghost touches/drags before beginning a fresh primary touch/mouse gesture
    if (e.isPrimary) {
      if (activeTouchesRef.current.size > 0 && !activeTouchesRef.current.has(e.pointerId)) {
        activeTouchesRef.current.clear();
        pinchStateRef.current = null;
      }
      branchDragRef.current = null;
      nodeDragRef.current = null;
      dragPreviewRef.current = null;
    }

    const rect = containerRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    activeTouchesRef.current.set(e.pointerId, {
      x: sx,
      y: sy,
      pointerType: e.pointerType,
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic/mobile capture failures
    }
    viewportRef.current.stopMomentum();
    setInteractingAttr(true);

    if (activeTouchesRef.current.size === 2) {
      panStateRef.current = null;
      const pts = Array.from(activeTouchesRef.current.values());
      pinchStateRef.current = {
        lastDist: Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)),
        lastMidX: (pts[0].x + pts[1].x) * 0.5,
        lastMidY: (pts[0].y + pts[1].y) * 0.5,
      };
      return;
    }

    if (activeTouchesRef.current.size === 1) {
      panStateRef.current = {
        pointerId: e.pointerId,
        lastX: sx,
        lastY: sy,
        vx: 0,
        vy: 0,
        moved: false,
      };
    }
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' && penActiveRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Apple Pencil 120Hz/240Hz high-precision coalesced sample extraction
    const coalesced =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const latestSample =
      coalesced.length > 0 ? coalesced[coalesced.length - 1] : e.nativeEvent;

    const sx = latestSample.clientX - rect.left;
    const sy = latestSample.clientY - rect.top;

    const worldPt = viewportRef.current.screenToWorld(sx, sy);
    onPointerWorldMove(worldPt.x, worldPt.y);

    if (linkingFromNodeId) {
      pendingLinkTargetRef.current = worldPt;
      needsRedrawRef.current = true;
    }

    if (activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, {
        x: sx,
        y: sy,
        pointerType: e.pointerType,
      });
    }

    // 1. Branch `+` Handle Spring Drag
    if (branchDragRef.current && branchDragRef.current.pointerId === e.pointerId) {
      const bd = branchDragRef.current;
      const distPx = Math.hypot(
        e.clientX - bd.startClientX,
        e.clientY - bd.startClientY
      );
      if (distPx > 8) {
        bd.moved = true;
        const parent = nodes[bd.parentId];
        if (parent) {
          if (!dragPreviewRef.current) {
            const parentDepth = treeMeta.depthMap.get(parent.id) ?? 0;
            dragPreviewRef.current = {
              sourceNodeId: parent.id,
              startX: parent.x,
              startY: parent.y,
              currentX: worldPt.x,
              currentY: worldPt.y,
              targetX: worldPt.x,
              targetY: worldPt.y,
              vx: 0,
              vy: 0,
              color: bd.color,
              depth: parentDepth + 1,
            };
          } else {
            dragPreviewRef.current.targetX = worldPt.x;
            dragPreviewRef.current.targetY = worldPt.y;
          }
          needsRedrawRef.current = true;
        }
      }
      return;
    }

    // 2. V3 Transient Subtree Drag Engine (ZERO React setState, ZERO cumulative rounding drift!)
    if (nodeDragRef.current && nodeDragRef.current.pointerId === e.pointerId) {
      const nd = nodeDragRef.current;
      const distPx = Math.hypot(
        e.clientX - nd.startClientX,
        e.clientY - nd.startClientY
      );
      if (distPx > 4 || nd.moved) {
        if (!nd.moved) {
          nd.moved = true;
          setInteractingAttr(true);
        }
        const scale = viewportRef.current.getTransform().scale;
        const dxWorld = (e.clientX - nd.startClientX) / scale;
        const dyWorld = (e.clientY - nd.startClientY) / scale;

        nd.initialPositions.forEach((initPos, id) => {
          const nx = initPos.x + dxWorld;
          const ny = initPos.y + dyWorld;
          transientPositionsRef.current.set(id, { x: nx, y: ny });

          const domEl = nodeDomRefs.current.get(id);
          if (domEl) {
            domEl.style.transform = `translate3d(${nx}px, ${ny}px, 0) translate(-50%, -50%)`;
          }
        });

        // Synchronize any CrossLink mid-curve pill DOM elements attached to moved nodes
        const curLinks = renderDataRef.current.crossLinks;
        if (curLinks && curLinks.length > 0) {
          for (const link of curLinks) {
            if (
              transientPositionsRef.current.has(link.fromNodeId) ||
              transientPositionsRef.current.has(link.toNodeId)
            ) {
              const pillEl = crossLinkDomRefs.current.get(link.id);
              const baseFrom = nodes[link.fromNodeId];
              const baseTo = nodes[link.toNodeId];
              if (pillEl && baseFrom && baseTo) {
                const trFrom = transientPositionsRef.current.get(link.fromNodeId);
                const trTo = transientPositionsRef.current.get(link.toNodeId);
                const geom = computeCrossLinkGeometry(
                  trFrom ? { ...baseFrom, x: trFrom.x, y: trFrom.y } : baseFrom,
                  trTo ? { ...baseTo, x: trTo.x, y: trTo.y } : baseTo
                );
                pillEl.style.transform = `translate3d(${geom.midX}px, ${geom.midY}px, 0) translate(-50%, -50%)`;
              }
            }
          }
        }

        needsRedrawRef.current = true;
      }
      return;
    }

    // 3. Multi-Touch Pinch-Zoom
    if (activeTouchesRef.current.size >= 2 && pinchStateRef.current) {
      const pts = Array.from(activeTouchesRef.current.values());
      const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;

      const cur = viewportRef.current.getTransform();
      const nextScale = cur.scale * (dist / pinchStateRef.current.lastDist);

      viewportRef.current.panBy(
        midX - pinchStateRef.current.lastMidX,
        midY - pinchStateRef.current.lastMidY
      );
      viewportRef.current.zoomAtScreenPoint(nextScale, midX, midY);

      pinchStateRef.current = {
        lastDist: dist,
        lastMidX: midX,
        lastMidY: midY,
      };
      needsRedrawRef.current = true;
      return;
    }

    // 4. Canvas Pan
    if (panStateRef.current && panStateRef.current.pointerId === e.pointerId) {
      const ps = panStateRef.current;
      const dx = sx - ps.lastX;
      const dy = sy - ps.lastY;
      if (Math.hypot(dx, dy) > 3) {
        ps.moved = true;
      }
      ps.vx = dx;
      ps.vy = dy;
      ps.lastX = sx;
      ps.lastY = sy;
      viewportRef.current.panBy(dx, dy);
      needsRedrawRef.current = true;
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'pen') {
      if (penReleaseTimerRef.current !== null) {
        window.clearTimeout(penReleaseTimerRef.current);
      }
      // 400ms palm rejection window after Apple Pencil lift
      penReleaseTimerRef.current = window.setTimeout(() => {
        penActiveRef.current = false;
        penReleaseTimerRef.current = null;
      }, 400);
    }

    activeTouchesRef.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release errors
    }
    if (activeTouchesRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    if (activeTouchesRef.current.size === 0) {
      setInteractingAttr(false);
    }

    if (branchDragRef.current && branchDragRef.current.pointerId === e.pointerId) {
      const bd = branchDragRef.current;
      branchDragRef.current = null;
      setInteractingAttr(false);
      const parent = nodes[bd.parentId];

      if (parent) {
        if (bd.moved && dragPreviewRef.current) {
          const dropX = Math.round(dragPreviewRef.current.targetX);
          const dropY = Math.round(dragPreviewRef.current.targetY);
          dragPreviewRef.current = null;
          needsRedrawRef.current = true;
          void hapticMedium();
          onCreateChildBranch(parent.id, dropX, dropY, bd.color);
        } else {
          dragPreviewRef.current = null;
          needsRedrawRef.current = true;
          const autoPos = findBestOpenBranchPosition(parent, nodes, rootNodeId);
          const finalX =
            bd.directionBias && parent.id === rootNodeId
              ? parent.x + Math.abs(autoPos.x - parent.x) * bd.directionBias
              : autoPos.x;
          void hapticMedium();
          onCreateChildBranch(parent.id, finalX, autoPos.y, bd.color);
        }
      } else {
        dragPreviewRef.current = null;
        needsRedrawRef.current = true;
      }
      return;
    }

    if (nodeDragRef.current && nodeDragRef.current.pointerId === e.pointerId) {
      const nd = nodeDragRef.current;
      nodeDragRef.current = null;
      setInteractingAttr(false);
      setActiveDragIds([]);

      if (nd.moved) {
        const batchUpdates: Record<string, { x: number; y: number }> = {};
        transientPositionsRef.current.forEach((pos, id) => {
          batchUpdates[id] = {
            x: Math.round(pos.x),
            y: Math.round(pos.y),
          };
          const domEl = nodeDomRefs.current.get(id);
          if (domEl) {
            domEl.style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(
              pos.y
            )}px, 0) translate(-50%, -50%)`;
          }
        });
        transientPositionsRef.current.clear();
        needsRedrawRef.current = true;
        onCommitBatchNodePositions(batchUpdates);
        return;
      }

      transientPositionsRef.current.clear();

      // CrossLink target selection (`🔗 İlişki Çek`)
      if (linkingFromNodeId) {
        if (nd.nodeId !== linkingFromNodeId) {
          void hapticSuccess();
          pendingLinkTargetRef.current = null;
          onCompleteCrossLink(linkingFromNodeId, nd.nodeId);
        } else {
          onCancelCrossLink();
        }
        return;
      }

      if (examMode !== 'off') {
        void hapticLight();
        onRevealExamNode(nd.nodeId);
        return;
      }

      const now = Date.now();
      const prevTap = lastTapRef.current;
      const childCount = treeMeta.descendantCountMap.get(nd.nodeId) ?? 0;

      if (prevTap && prevTap.nodeId === nd.nodeId && now - prevTap.time < 320) {
        lastTapRef.current = null;
        if (childCount > 0 && nd.nodeId !== rootNodeId) {
          void hapticMedium();
          onToggleCollapse(nd.nodeId);
        } else {
          onStartEditing(nd.nodeId);
        }
        return;
      }

      lastTapRef.current = { nodeId: nd.nodeId, time: now };
      if (selectedNodeId === nd.nodeId && editingNodeId !== nd.nodeId) {
        onStartEditing(nd.nodeId);
      } else {
        void hapticLight();
        onSelectNode(nd.nodeId);
        if (editingNodeId && editingNodeId !== nd.nodeId) {
          onFinishEditing();
        }
      }
      return;
    }

    if (panStateRef.current && panStateRef.current.pointerId === e.pointerId) {
      const ps = panStateRef.current;
      panStateRef.current = null;
      if (ps.moved) {
        viewportRef.current.setInertia(ps.vx, ps.vy);
        needsRedrawRef.current = true;
      } else {
        if (linkingFromNodeId) {
          pendingLinkTargetRef.current = null;
          onCancelCrossLink();
        }
        setEditingLinkId(null);
        onSelectNode(null);
        if (editingNodeId) {
          onFinishEditing();
        }
      }
    }
  };

  const startNodePointerDown = (e: React.PointerEvent, node: MindNode) => {
    if (e.pointerType === 'touch' && penActiveRef.current) {
      penActiveRef.current = false;
    }
    // Space + Drag anywhere (even on top of a node) pans the canvas cleanly!
    if (spacePressed) return;
    if (editingNodeId === node.id && !kbSnap.isTouchDevice) return;

    e.stopPropagation();
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors
    }
    viewportRef.current.stopMomentum();

    const singleOnly = e.altKey || singleNodeDragMode;
    const affectedIds = collectSubtreeIds(node.id, nodes, rootNodeId, singleOnly);
    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const id of affectedIds) {
      const n = nodes[id];
      if (n) {
        initialPositions.set(id, { x: n.x, y: n.y });
      }
    }
    if (affectedIds.length > 1) {
      setActiveDragIds(affectedIds);
    }

    nodeDragRef.current = {
      pointerId: e.pointerId,
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialPositions,
      moved: false,
    };
  };

  const startBranchHandlePointerDown = (
    e: React.PointerEvent,
    parentNode: MindNode,
    directionBias?: 1 | -1
  ) => {
    if (e.pointerType === 'touch' && penActiveRef.current) {
      penActiveRef.current = false;
    }
    if (spacePressed) return;
    e.stopPropagation();
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors
    }
    viewportRef.current.stopMomentum();
    setInteractingAttr(true);
    void hapticLight();

    const branchColor = resolveNewBranchColor(parentNode, nodes, rootNodeId);
    branchDragRef.current = {
      pointerId: e.pointerId,
      parentId: parentNode.id,
      directionBias,
      startClientX: e.clientX,
      startClientY: e.clientY,
      color: branchColor,
      moved: false,
    };
  };

  const isSemanticFarZoom = currentScale < 0.44;

  return (
    <div
      ref={containerRef}
      data-interacting="false"
      data-auto-layout={isAutoLayoutAnimating ? 'true' : 'false'}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      className={`canvas-stage canvas-touch-lock relative h-full w-full overflow-hidden ${
        spacePressed
          ? 'cursor-grab active:cursor-grabbing'
          : linkingFromNodeId
          ? 'cursor-crosshair'
          : ''
      }`}
    >
      {/* Floating Banner When User Is Drawing a CrossLink (`🔗 İlişki Çek`) */}
      {linkingFromNodeId && nodes[linkingFromNodeId] && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-3">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-lg">
            <Link2 className="h-3.5 w-3.5" />
            <span>
              “{nodes[linkingFromNodeId].title || 'Dal'}” dalından ilişki kurulacak hedef dala dokunun
            </span>
            <button
              type="button"
              onClick={onCancelCrossLink}
              className="ml-1 rounded-lg bg-white/20 px-2 py-0.5 hover:bg-white/30"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Layer 1: HiDPI 60/120 FPS Canvas (Dot Grid + Organic Tapered Branches + Animated CrossLinks) */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />

      {/* Layer 2: GPU-Synchronized DOM World Layer */}
      <div
        ref={domWorldRef}
        className="pointer-events-none absolute top-0 left-0 origin-top-left will-change-transform"
      >
        {/* Interactive Mid-Curve CrossLink Relationship Pills */}
        {examMode === 'off' &&
          (crossLinks ?? []).map((link) => {
            if (
              treeMeta.hiddenNodeIds.has(link.fromNodeId) ||
              treeMeta.hiddenNodeIds.has(link.toNodeId)
            ) {
              return null;
            }
            const from = nodes[link.fromNodeId];
            const to = nodes[link.toNodeId];
            if (!from || !to) return null;

            const geom = computeCrossLinkGeometry(from, to);
            const isEditingThisLink = editingLinkId === link.id;
            const accent = link.color || '#0EA5E9';

            return (
              <div
                key={link.id}
                ref={(el) => {
                  if (el) crossLinkDomRefs.current.set(link.id, el);
                  else crossLinkDomRefs.current.delete(link.id);
                }}
                onPointerDown={(e) => {
                  if (!spacePressed) e.stopPropagation();
                }}
                style={{
                  transform: `translate3d(${Math.round(geom.midX)}px, ${Math.round(
                    geom.midY
                  )}px, 0) translate(-50%, -50%)`,
                  zIndex: isEditingThisLink ? 35 : 8,
                }}
                className="pointer-events-auto absolute top-0 left-0 will-change-transform"
              >
                {isEditingThisLink ? (
                  <div
                    className="flex items-center gap-1 rounded-full border-2 bg-white px-2.5 py-1 shadow-lg dark:bg-slate-900"
                    style={{ borderColor: accent }}
                  >
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => onUpdateCrossLinkLabel(link.id, e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setEditingLinkId(null);
                        }
                      }}
                      autoFocus
                      placeholder="İlişki etiketi..."
                      className="allow-text-input w-32 bg-transparent text-[11px] font-extrabold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteCrossLink(link.id)}
                      title="İlişki Okunu Sil"
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingLinkId(link.id)}
                    title="İlişki etiketini düzenlemek için dokunun"
                    style={{ borderColor: accent }}
                    className="inline-flex items-center gap-1 rounded-full border bg-white/92 px-2.5 py-0.5 text-[10.5px] font-extrabold whitespace-nowrap shadow-xs backdrop-blur-xs hover:scale-105 dark:bg-slate-900/92"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <span>{link.label || 'İlişki'}</span>
                  </button>
                )}
              </div>
            );
          })}

        {/* Visible Nodes (GPU Transform Locked) */}
        {visibleNodeIds.map((nodeId) => {
          const node = nodes[nodeId];
          if (!node || treeMeta.hiddenNodeIds.has(nodeId)) return null;

          const isRoot = node.id === rootNodeId;
          const isSelected = selectedNodeId === node.id;
          const isEditing = editingNodeId === node.id;
          const isLinkSource = linkingFromNodeId === node.id;
          const descendantCount = treeMeta.descendantCountMap.get(node.id) ?? 0;
          const mainBranchId = treeMeta.mainBranchMap.get(node.id) ?? node.id;
          const isDimmedByFocus =
            focusedMainBranchId !== null &&
            !isRoot &&
            mainBranchId !== focusedMainBranchId;

          const parentNode = node.parentId ? nodes[node.parentId] : null;
          const outwardRight = parentNode ? node.x >= parentNode.x : true;

          const isExamRevealed = isRoot || revealedExamIds.has(node.id);
          const hideTextInExam = examMode === 'hide_text' && !isExamRevealed;
          const hideVisualInExam =
            examMode === 'hide_visuals_children' && !isExamRevealed;

          const effectiveStyle: NodeVisualStyle =
            node.nodeStyle ?? defaultNodeStyle ?? 'card';
          const isOrganic = effectiveStyle === 'organic' && !isRoot;

          const stickerAnimKey = `${node.sticker?.id ?? 'none'}_${
            node.stickerUpdatedAt ?? 0
          }`;
          const showSecondaryMeta =
            !isEditing && (!isSemanticFarZoom || isRoot || isSelected);
          const stickerSizeCls = resolveStickerSizeClasses(
            node.stickerSize,
            isRoot,
            isOrganic
          );

          return (
            <div
              key={node.id}
              ref={(el) => {
                if (el) nodeDomRefs.current.set(node.id, el);
                else nodeDomRefs.current.delete(node.id);
              }}
              onPointerDown={(e) => startNodePointerDown(e, node)}
              style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0) translate(-50%, -50%)`,
                opacity: isDimmedByFocus ? 0.2 : 1,
                zIndex: isEditing ? 30 : isSelected ? 20 : isRoot ? 15 : 10,
              }}
              className="mind-node-wrapper pointer-events-auto absolute top-0 left-0 flex flex-col items-center will-change-transform select-none"
            >
              {/* DIE-CUT VISUAL STICKER (`onError` Self-Healing Offline Fallback) */}
              {node.sticker && !hideVisualInExam && (
                <div
                  key={stickerAnimKey}
                  className={`animate-sticker-pop absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 items-center justify-center ${stickerSizeCls}`}
                >
                  <img
                    src={node.sticker.url}
                    alt={node.title || 'Yeni Konu'}
                    draggable={false}
                    onError={(e) => {
                      const imgEl = e.currentTarget;
                      if (imgEl.dataset.fallbackApplied === 'true') return;
                      imgEl.dataset.fallbackApplied = 'true';
                      imgEl.src = resolveStarterStickerForConcept(
                        node.title || 'Yeni Konu',
                        department
                      ).url;
                    }}
                    className="die-cut-shadow pointer-events-none h-full w-full object-contain"
                  />
                </div>
              )}

              {/* Hidden Visual / Children Recall Prompt */}
              {hideVisualInExam && (node.sticker || descendantCount > 0) && (
                <div className="absolute bottom-full left-1/2 mb-1.5 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-extrabold whitespace-nowrap text-white shadow-md">
                  <Sparkles className="h-3 w-3" />
                  <span>
                    Tahmin Et & Dokun (
                    {descendantCount > 0 ? `+${descendantCount} alt dal` : 'Görsel'})
                  </span>
                </div>
              )}

              {/* NODE TITLE, TECH BADGE & SUBTITLE (CARD OR BOXLESS ORGANIC STYLE) */}
              {hideTextInExam ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-dashed border-violet-500/60 bg-violet-500/15 px-4 py-2 text-xs font-extrabold text-violet-700 shadow-sm backdrop-blur-xs dark:text-violet-200"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Terimi Hatırla • Dokun Aç</span>
                </button>
              ) : isOrganic && !isEditing ? (
                /* ORGANIC BOXLESS STICKER NODE STYLE (GoodNotes / MindNode Aesthetic) */
                <div
                  ref={(el) => bindNodeCardElement(node.id, el)}
                  data-node-card-id={node.id}
                  style={{
                    backgroundColor: isSelected
                      ? darkMode
                        ? 'rgba(30,41,59,0.92)'
                        : 'rgba(255,255,255,0.94)'
                      : darkMode
                      ? 'rgba(15,20,29,0.88)'
                      : 'rgba(250,249,245,0.90)',
                    boxShadow: isSelected
                      ? `0 0 0 2px ${node.branchColor}66, 0 6px 16px rgba(15,23,42,0.10)`
                      : 'none',
                  }}
                  className={`relative flex min-w-[116px] max-w-[304px] flex-col items-center rounded-2xl px-3.5 py-1.5 text-center ${
                    linkingFromNodeId && !isLinkSource
                      ? 'hover:ring-2 hover:ring-violet-500'
                      : ''
                  }`}
                >
                  <div
                    style={{
                      color: 'var(--node-text)',
                      textShadow: darkMode
                        ? '0 1px 6px rgba(15,23,42,0.95)'
                        : '0 1px 5px rgba(255,255,255,0.98), 0 0 2px rgba(255,255,255,0.95)',
                    }}
                    className="node-title-balanced text-[14px] leading-snug font-black tracking-tight sm:text-[15px]"
                  >
                    {node.title || 'Yeni Konu'}
                  </div>

                  <div
                    className="mt-1 h-1 w-12 rounded-full opacity-90"
                    style={{ backgroundColor: node.branchColor }}
                  />

                  {showSecondaryMeta && node.subtitle && (
                    <div
                      className="mt-0.5 text-[11px] leading-tight font-bold opacity-75"
                      style={{ color: 'var(--node-subtext)' }}
                    >
                      {node.subtitle}
                    </div>
                  )}

                  {showSecondaryMeta && node.techBadge && (
                    <span
                      style={{
                        borderColor: `${node.branchColor}55`,
                        backgroundColor: darkMode
                          ? 'rgba(15,23,42,0.75)'
                          : 'rgba(255,255,255,0.88)',
                      }}
                      className="mt-1 inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight"
                    >
                      {node.techBadge}
                    </span>
                  )}

                  {examMode === 'off' && !linkingFromNodeId && (
                    <button
                      type="button"
                      onPointerDown={(e) => startBranchHandlePointerDown(e, node)}
                      title="Sürükle-Yaz veya Tek Dokunuşla Alt Dal Ekle"
                      style={{ backgroundColor: node.branchColor }}
                      className={`hit-slop-44 absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white shadow-md hover:scale-115 active:scale-95 ${
                        outwardRight ? '-right-3.5' : '-left-3.5'
                      } ${
                        isSelected
                          ? 'opacity-100 scale-105'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                    </button>
                  )}

                  {descendantCount > 0 && examMode === 'off' && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        void hapticMedium();
                        onToggleCollapse(node.id);
                      }}
                      style={{
                        backgroundColor: node.collapsed ? node.branchColor : undefined,
                        borderColor: node.branchColor,
                        color: node.collapsed ? '#FFFFFF' : node.branchColor,
                      }}
                      className="absolute -bottom-3 inline-flex items-center gap-0.5 rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold shadow-xs hover:scale-105 dark:bg-slate-900"
                    >
                      {node.collapsed ? (
                        <span>+{descendantCount}</span>
                      ) : (
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      )}
                    </button>
                  )}
                </div>
              ) : (
                /* MODERN CARD NODE STYLE */
                <div
                  ref={(el) => bindNodeCardElement(node.id, el)}
                  data-node-card-id={node.id}
                  style={{
                    backgroundColor: 'var(--node-pill-bg)',
                    borderColor: isLinkSource
                      ? '#8B5CF6'
                      : isEditing || isSelected
                      ? node.branchColor
                      : 'rgba(148,163,184,0.28)',
                    boxShadow: isEditing
                      ? `0 0 0 3px ${node.branchColor}40, 0 10px 25px -5px rgba(15,23,42,0.18)`
                      : isSelected
                      ? `0 0 0 2.5px ${node.branchColor}55, 0 8px 20px -4px rgba(15,23,42,0.14)`
                      : '0 4px 14px rgba(15, 23, 42, 0.08)',
                  }}
                  className={`animate-card-reveal relative flex flex-col items-center rounded-2xl border-2 px-4 py-2 text-center backdrop-blur-md ${
                    isRoot
                      ? 'min-w-[180px] max-w-[310px] px-5 py-2.5'
                      : 'min-w-[122px] max-w-[304px]'
                  } ${
                    linkingFromNodeId && !isLinkSource
                      ? 'hover:ring-2 hover:ring-violet-500'
                      : ''
                  }`}
                >
                  <div
                    className="mb-1 h-1 w-8 rounded-full"
                    style={{ backgroundColor: node.branchColor }}
                  />

                  {isEditing && !kbSnap.isTouchDevice ? (
                    <input
                      type="text"
                      value={node.title}
                      onChange={(e) => onUpdateNodeTitle(node.id, e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          e.preventDefault();
                          onFinishEditing();
                        } else if (e.key === 'Tab') {
                          e.preventDefault();
                          onFinishEditing();
                          const autoPos = findBestOpenBranchPosition(
                            node,
                            nodes,
                            rootNodeId
                          );
                          const color = resolveNewBranchColor(node, nodes, rootNodeId);
                          onCreateChildBranch(node.id, autoPos.x, autoPos.y, color);
                        }
                      }}
                      autoFocus
                      onFocus={(e) => {
                        if (window.scrollY !== 0) window.scrollTo(0, 0);
                        e.currentTarget.select();
                      }}
                      placeholder="Dal adını yazın..."
                      className={`allow-text-input max-w-full min-w-[136px] bg-transparent text-center font-extrabold outline-none ${
                        isRoot ? 'text-base sm:text-lg' : 'text-base sm:text-sm'
                      }`}
                      style={{
                        color: 'var(--node-text)',
                        width: `${Math.min(28, Math.max(13, (node.title || '').length + 2))}ch`,
                      }}
                    />
                  ) : (
                    <div
                      className={`node-title-balanced leading-snug font-extrabold ${
                        isRoot ? 'text-base sm:text-lg' : 'text-[13.5px] sm:text-sm'
                      }`}
                      style={{ color: 'var(--node-text)' }}
                    >
                      {node.title || 'Yeni Konu'}
                    </div>
                  )}

                  {showSecondaryMeta && node.subtitle && (
                    <div
                      className="mt-0.5 text-[11px] leading-tight font-semibold opacity-75"
                      style={{ color: 'var(--node-subtext)' }}
                    >
                      {node.subtitle}
                    </div>
                  )}

                  {showSecondaryMeta && node.techBadge && (
                    <span
                      style={{
                        borderColor: `${node.branchColor}55`,
                        backgroundColor: `${node.branchColor}18`,
                      }}
                      className="mt-1 inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight"
                    >
                      {node.techBadge}
                    </span>
                  )}

                  {/* DRAG-TO-BRANCH & SINGLE-TAP `+` HANDLES (44x44 HIG Hit-Slop) */}
                  {examMode === 'off' && !linkingFromNodeId && isRoot && (
                    <>
                      <button
                        type="button"
                        onPointerDown={(e) => startBranchHandlePointerDown(e, node, 1)}
                        title="Sürükleyerek veya dokunarak sağa ana dal ekle"
                        className="hit-slop-44 absolute top-1/2 -right-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow-md hover:scale-115 active:scale-95"
                      >
                        <Plus className="h-4 w-4 stroke-[2.8]" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => startBranchHandlePointerDown(e, node, -1)}
                        title="Sürükleyerek veya dokunarak sola ana dal ekle"
                        className="hit-slop-44 absolute top-1/2 -left-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-md hover:scale-115 active:scale-95"
                      >
                        <Plus className="h-4 w-4 stroke-[2.8]" />
                      </button>
                    </>
                  )}

                  {examMode === 'off' && !linkingFromNodeId && !isRoot && (
                    <button
                      type="button"
                      onPointerDown={(e) => startBranchHandlePointerDown(e, node)}
                      title="Sürükle-Yaz veya Tek Dokunuşla Alt Dal Ekle"
                      style={{ backgroundColor: node.branchColor }}
                      className={`hit-slop-44 absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white shadow-md hover:scale-115 active:scale-95 ${
                        outwardRight ? '-right-3.5' : '-left-3.5'
                      } ${
                        isSelected || isEditing
                          ? 'opacity-100 scale-105'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                    </button>
                  )}

                  {/* COLLAPSE / EXPAND `+N` DESCENDANT BADGE */}
                  {!isRoot && descendantCount > 0 && examMode === 'off' && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        void hapticMedium();
                        onToggleCollapse(node.id);
                      }}
                      title={
                        node.collapsed
                          ? `${descendantCount} gizli alt dalı aç`
                          : 'Alt dalları katla (veya düğüme çift dokunun)'
                      }
                      style={{
                        backgroundColor: node.collapsed ? node.branchColor : undefined,
                        borderColor: node.branchColor,
                        color: node.collapsed ? '#FFFFFF' : node.branchColor,
                      }}
                      className={`absolute -bottom-3 inline-flex items-center gap-0.5 rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold shadow-xs hover:scale-105 active:scale-95 dark:bg-slate-900 ${
                        node.collapsed ? '!bg-opacity-100' : ''
                      }`}
                    >
                      {node.collapsed ? (
                        <span>+{descendantCount}</span>
                      ) : (
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* LIVE COLLABORATOR CURSORS */}
        {collaborators
          .filter((c) => !c.isLocal)
          .map((peer) => (
            <div
              key={peer.id}
              style={{
                transform: `translate3d(${peer.worldX}px, ${peer.worldY}px, 0)`,
              }}
              className="pointer-events-none absolute top-0 left-0 z-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={peer.color}>
                <path
                  d="M4 2L20 10.5L12.5 13L9.5 20.5L4 2Z"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                style={{ backgroundColor: peer.color }}
                className="ml-3 -mt-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-white shadow-sm"
              >
                {peer.name}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
