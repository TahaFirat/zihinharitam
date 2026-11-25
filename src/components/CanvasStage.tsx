import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import {
  Plus,
  Eye,
  Sparkles,
  ChevronRight,
  X,
  Link2,
  Trash2,
  Move,
  Check,
  Pencil,
  Image as ImageIcon,
  CheckSquare,
  ChevronDown,
  Flame,
} from 'lucide-react';
import type {
  AcademicDepartment,
  CanvasInkStroke,
  CanvasStickyNote,
  CollaboratorPresence,
  CrossLink,
  EraserMode,
  ExamRecallMode,
  InkToolType,
  MindNode,
  NodePriorityTag,
  NodeVisualStyle,
  PaperStyleType,
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
  buildInkSvgPath,
  detectSnappedShape,
  eraseAreaFromStroke,
  findStrokesInsideLasso,
  getInkStrokesBoundingBox,
  hitTestInkStroke,
  translateInkStroke,
} from '../core/canvas/InkStrokeEngine';
import {
  generateTaperedBranchSvgPath,
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
  inkStrokes?: CanvasInkStroke[];
  stickyNotes?: CanvasStickyNote[];
  paperStyle?: PaperStyleType;
  drawingMode?: boolean;
  inkTool?: InkToolType;
  eraserMode?: EraserMode;
  autoShapeEnabled?: boolean;
  inkColor?: string;
  inkWidth?: number;
  stylusOnly?: boolean;
  hardwareEraserActive?: boolean;
  selectedLassoIds?: string[];
  onAddInkStroke?: (stroke: CanvasInkStroke) => void;
  onDeleteInkStroke?: (strokeId: string) => void;
  onReplaceInkStrokes?: (strokes: CanvasInkStroke[]) => void;
  onPushInkHistory?: () => void;
  onSelectLassoIds?: (ids: string[]) => void;
  onUpdateStickyNote?: (id: string, patch: Partial<CanvasStickyNote>) => void;
  onDeleteStickyNote?: (id: string) => void;
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
  zoomRequest?: { factor: number; seq: number } | null;
  radarJumpRequest: { x: number; y: number; seq: number } | null;
  onSelectNode: (nodeId: string | null) => void;
  onStartEditing: (nodeId: string) => void;
  onFinishEditing: () => void;
  onUpdateNodeTitle: (nodeId: string, title: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onToggleNodeCheck?: (nodeId: string) => void;
  onCyclePriorityTag?: (nodeId: string) => void;
  onToggleNoteCollapse?: (nodeId: string) => void;
  onStartCrossLink?: (fromNodeId: string) => void;
  onOpenStickerGallery?: (nodeId: string) => void;
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

const PRIORITY_BADGE_META: Record<
  NodePriorityTag,
  {
    label: string;
    shortBtnLabel: string;
    emoji: string;
    ribbonCls: string;
    borderColor: string;
    bgLight: string;
    bgDark: string;
    haloShadow: string;
    branchHighlight: string;
  }
> = {
  important: {
    label: 'ÖNEMLİ',
    shortBtnLabel: '🔥 Önemli',
    emoji: '🔥',
    ribbonCls:
      'bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 text-white shadow-sm ring-1 ring-white/40',
    borderColor: '#F43F5E',
    bgLight: 'linear-gradient(180deg, #FFF1F2 0%, #FFFFFF 88%)',
    bgDark: 'linear-gradient(180deg, rgba(159, 18, 57, 0.52) 0%, rgba(22, 29, 43, 0.97) 100%)',
    haloShadow:
      '0 0 0 4px rgba(244, 63, 94, 0.22), 0 10px 26px -4px rgba(244, 63, 94, 0.32)',
    branchHighlight: 'rgba(244, 63, 94, 0.36)',
  },
  exam: {
    label: 'SINAVDA ÇIKAR ⭐',
    shortBtnLabel: '🎓 Sınav',
    emoji: '🎓',
    ribbonCls:
      'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-sm ring-1 ring-amber-900/15',
    borderColor: '#F59E0B',
    bgLight: 'linear-gradient(180deg, #FEF3C7 0%, #FFFBEB 48%, #FFFFFF 100%)',
    bgDark: 'linear-gradient(180deg, rgba(146, 64, 14, 0.52) 0%, rgba(22, 29, 43, 0.97) 100%)',
    haloShadow:
      '0 0 0 4px rgba(245, 158, 11, 0.25), 0 10px 26px -4px rgba(245, 158, 11, 0.32)',
    branchHighlight: 'rgba(245, 158, 11, 0.38)',
  },
  review: {
    label: 'TEKRAR ET',
    shortBtnLabel: '❓ Tekrar',
    emoji: '❓',
    ribbonCls:
      'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm ring-1 ring-white/35',
    borderColor: '#8B5CF6',
    bgLight: 'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 90%)',
    bgDark: 'linear-gradient(180deg, rgba(91, 33, 182, 0.50) 0%, rgba(22, 29, 43, 0.97) 100%)',
    haloShadow:
      '0 0 0 4px rgba(139, 92, 246, 0.22), 0 10px 24px -4px rgba(139, 92, 246, 0.30)',
    branchHighlight: 'rgba(139, 92, 246, 0.34)',
  },
};

/**
 * Consistent pixel sizing across BOTH Card and Organic modes so toggling `Kart <-> Organik`
 * never jumps or blinks sticker size!
 */
function resolveStickerSizePixels(
  size: StickerSizePreset | undefined,
  isRoot: boolean
): { px: number; preset: StickerSizePreset } {
  const effective: StickerSizePreset = size ?? 'md';
  if (isRoot) {
    switch (effective) {
      case 'sm':
        return { px: 82, preset: 'sm' };
      case 'lg':
        return { px: 168, preset: 'lg' };
      case 'xl':
        return { px: 214, preset: 'xl' };
      case 'md':
      default:
        return { px: 124, preset: 'md' };
    }
  }
  switch (effective) {
    case 'sm':
      return { px: 50, preset: 'sm' };
    case 'lg':
      return { px: 126, preset: 'lg' };
    case 'xl':
      return { px: 170, preset: 'xl' };
    case 'md':
    default:
      return { px: 86, preset: 'md' };
  }
}

function computeBranchSvgPathForNode(
  node: { id: string; x: number; y: number },
  parent: { id: string; x: number; y: number },
  depth: number,
  dimensionsMap?: Map<string, { w: number; h: number }>
): string {
  const parentDim = dimensionsMap?.get(parent.id);
  const childDim = dimensionsMap?.get(node.id);
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

  return generateTaperedBranchSvgPath(sx, sy, ex, ey, depth);
}

function buildCrossLinkArrowTransform(tipX: number, tipY: number, angleRad: number): string {
  const deg = (angleRad * 180) / Math.PI;
  return `translate(${tipX.toFixed(1)}, ${tipY.toFixed(1)}) rotate(${deg.toFixed(1)})`;
}

export const CanvasStage: React.FC<CanvasStageProps> = React.memo(({
  nodes,
  crossLinks,
  inkStrokes,
  stickyNotes,
  paperStyle = 'dots',
  drawingMode = false,
  inkTool = 'pen',
  eraserMode = 'stroke',
  autoShapeEnabled = true,
  inkColor = '#0F172A',
  inkWidth = 4.5,
  stylusOnly = false,
  hardwareEraserActive = false,
  selectedLassoIds = [],
  onAddInkStroke,
  onDeleteInkStroke,
  onReplaceInkStrokes,
  onPushInkHistory,
  onSelectLassoIds,
  onUpdateStickyNote,
  onDeleteStickyNote,
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
  zoomRequest,
  radarJumpRequest,
  onSelectNode,
  onStartEditing,
  onFinishEditing,
  onUpdateNodeTitle,
  onDeleteNode,
  onToggleNodeCheck,
  onCyclePriorityTag,
  onToggleNoteCollapse,
  onStartCrossLink,
  onOpenStickerGallery,
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
  const dotGridRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const domWorldRef = useRef<HTMLDivElement>(null);
  const liveInkPathRef = useRef<SVGPathElement>(null);
  const liveLaserPathRef = useRef<SVGPathElement>(null);
  const liveLassoPathRef = useRef<SVGPathElement>(null);
  const stylusHoverRef = useRef<HTMLDivElement>(null);
  const laserClearTimerRef = useRef<number | null>(null);
  const shapeHoldTimerRef = useRef<number | null>(null);
  const activeInkRef = useRef<{
    pointerId: number;
    tool: Exclude<InkToolType, 'eraser' | 'lasso' | 'laser'>;
    color: string;
    width: number;
    opacity: number;
    points: Array<[number, number, number]>;
    snapped?: boolean;
  } | null>(null);
  const activeLaserRef = useRef<{
    pointerId: number;
    points: Array<[number, number, number]>;
  } | null>(null);
  const activeLassoRef = useRef<{
    pointerId: number;
    points: Array<[number, number, number]>;
  } | null>(null);
  const lassoMoveRef = useRef<{
    pointerId: number;
    startWorldX: number;
    startWorldY: number;
    baseStrokes: CanvasInkStroke[];
  } | null>(null);
  const stickyDragRef = useRef<{
    pointerId: number;
    noteId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const activeEraserPointerRef = useRef<number | null>(null);
  const lastEraserWorldPtRef = useRef<{ x: number; y: number } | null>(null);
  const eraserPushedHistoryRef = useRef<boolean>(false);
  const liveInkStrokesRef = useRef<CanvasInkStroke[]>(inkStrokes ?? []);
  liveInkStrokesRef.current = inkStrokes ?? [];
  const inkRafPendingRef = useRef<boolean>(false);
  const resizeRafRef = useRef<number | null>(null);
  const pendingResizeIdsRef = useRef<Set<string>>(new Set());
  const stageRectRef = useRef<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  // Direct GPU DOM & SVG element handles for 0-React-Render Transient Drag + Dynamic Card ResizeObserver
  const nodeDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const branchPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const branchHaloRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const crossLinkCurveRefs = useRef<
    Map<
      string,
      {
        main: SVGPathElement | null;
        glow: SVGPathElement | null;
        dot: SVGCircleElement | null;
        arrow: SVGPolygonElement | null;
      }
    >
  >(new Map());
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
  const rafIdRef = useRef<number | null>(null);
  const scheduleRenderRef = useRef<() => void>(() => {});
  const requestRender = useCallback(() => {
    needsRedrawRef.current = true;
    scheduleRenderRef.current();
  }, []);

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

  // Transient Subtree Drag State (0 React re-renders during pointermove!)
  const nodeDragRef = useRef<{
    pointerId: number;
    nodeId: string;
    pointerType: string;
    isLongPressArmed: boolean;
    startClientX: number;
    startClientY: number;
    startStageX: number;
    startStageY: number;
    initialPositions: Map<string, { x: number; y: number }>;
    connectedBranchIds: string[];
    moved: boolean;
  } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [liftingNodeId, setLiftingNodeId] = useState<string | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

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

  const refreshCachedStageRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return stageRectRef.current;
    const rect = el.getBoundingClientRect();
    stageRectRef.current = {
      left: rect.left,
      top: rect.top,
      width: rect.width || 1200,
      height: rect.height || 800,
    };
    return stageRectRef.current;
  }, []);

  const resetAllGestureStates = useCallback(() => {
    clearLongPressTimer();
    activeTouchesRef.current.clear();
    pinchStateRef.current = null;
    panStateRef.current = null;
    nodeDragRef.current = null;
    branchDragRef.current = null;
    dragPreviewRef.current = null;
    activeEraserPointerRef.current = null;
    lastEraserWorldPtRef.current = null;
    eraserPushedHistoryRef.current = false;
    penActiveRef.current = false;
    setLiftingNodeId(null);
    setActiveDragIds([]);
    setInteractingAttr(false);
  }, [clearLongPressTimer, setInteractingAttr]);

  const isEventHardwareEraser = useCallback(
    (ev: { pointerType: string; button: number; buttons: number }) =>
      hardwareEraserActive ||
      ev.pointerType === 'eraser' ||
      (ev.pointerType === 'pen' &&
        ((ev.buttons & 32) !== 0 ||
          (ev.buttons & 2) !== 0 ||
          ev.button === 5 ||
          ev.button === 2)),
    [hardwareEraserActive]
  );

  /**
   * 120Hz Interpolated Synchronized Ink Eraser (Samsung S-Pen + Apple Pencil + Touch):
   * - Interpolates along fast swipe segments so thin strokes are NEVER skipped!
   * - Mutates `liveInkStrokesRef.current` synchronously so 8ms consecutive frames NEVER overwrite
   *   previous erasures with stale React props!
   * - Pushes a single clean Undo snapshot per swipe gesture.
   */
  const performInterpolatedErase = useCallback(
    (targetWorldPts: Array<{ x: number; y: number }>) => {
      if (targetWorldPts.length === 0) return;
      const current = liveInkStrokesRef.current;
      if (!current || current.length === 0) {
        lastEraserWorldPtRef.current = targetWorldPts[targetWorldPts.length - 1];
        return;
      }

      const scale = Math.max(0.25, viewportRef.current.getTransform().scale);
      const rWorld = Math.max(18, 26 / scale);
      const stepWorld = Math.max(6, rWorld * 0.45);

      const samples: Array<{ x: number; y: number }> = [];
      let prevPt = lastEraserWorldPtRef.current;

      for (const pt of targetWorldPts) {
        if (prevPt) {
          const dist = Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
          if (dist > stepWorld) {
            const steps = Math.min(28, Math.ceil(dist / stepWorld));
            for (let i = 1; i < steps; i++) {
              const t = i / steps;
              samples.push({
                x: prevPt.x + (pt.x - prevPt.x) * t,
                y: prevPt.y + (pt.y - prevPt.y) * t,
              });
            }
          }
        }
        samples.push(pt);
        prevPt = pt;
      }
      lastEraserWorldPtRef.current = prevPt;

      let working = current;
      let anyChanged = false;

      if (eraserMode === 'area' && onReplaceInkStrokes) {
        for (const sPt of samples) {
          let stepChanged = false;
          const next: CanvasInkStroke[] = [];
          for (const st of working) {
            const res = eraseAreaFromStroke(st, sPt.x, sPt.y, rWorld);
            if (res === null) {
              next.push(st);
            } else {
              stepChanged = true;
              next.push(...res);
            }
          }
          if (stepChanged) {
            working = next;
            anyChanged = true;
          }
        }
        if (anyChanged) {
          if (!eraserPushedHistoryRef.current) {
            eraserPushedHistoryRef.current = true;
            onPushInkHistory?.();
            void hapticLight();
          }
          liveInkStrokesRef.current = working;
          onReplaceInkStrokes(working);
        }
      } else {
        const hitIds = new Set<string>();
        for (const st of working) {
          for (const sPt of samples) {
            if (hitTestInkStroke(st, sPt.x, sPt.y, rWorld)) {
              hitIds.add(st.id);
              break;
            }
          }
        }
        if (hitIds.size > 0) {
          if (!eraserPushedHistoryRef.current) {
            eraserPushedHistoryRef.current = true;
            onPushInkHistory?.();
            void hapticLight();
          }
          const remaining = working.filter((st) => !hitIds.has(st.id));
          liveInkStrokesRef.current = remaining;
          if (onReplaceInkStrokes) {
            onReplaceInkStrokes(remaining);
          } else if (onDeleteInkStroke) {
            hitIds.forEach((id) => onDeleteInkStroke(id));
          }
        }
      }
    },
    [eraserMode, onDeleteInkStroke, onPushInkHistory, onReplaceInkStrokes]
  );

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

  // Shared ResizeObserver measuring real rendered widths/heights of node cards and updating SVG branch anchors in rAF (zero synchronous layout thrash!)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const id = el.dataset.nodeCardId;
        if (!id) continue;
        const w = Math.round(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth);
        const h = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
        const prev = nodeDimensionsRef.current.get(id);
        if (!prev || Math.abs(prev.w - w) > 2 || Math.abs(prev.h - h) > 2) {
          nodeDimensionsRef.current.set(id, { w, h });
          pendingResizeIdsRef.current.add(id);
        }
      }
      if (pendingResizeIdsRef.current.size > 0 && resizeRafRef.current === null) {
        resizeRafRef.current = requestAnimationFrame(() => {
          resizeRafRef.current = null;
          const changedIds = pendingResizeIdsRef.current;
          pendingResizeIdsRef.current = new Set();
          const curNodes = renderDataRef.current.nodes;
          const curDepthMap = renderDataRef.current.treeMeta.depthMap;
          for (const n of Object.values(curNodes)) {
            if (!n.parentId || n.id === renderDataRef.current.rootNodeId) continue;
            if (!changedIds.has(n.id) && !changedIds.has(n.parentId)) continue;
            const p = curNodes[n.parentId];
            if (!p) continue;
            const trN = transientPositionsRef.current.get(n.id);
            const trP = transientPositionsRef.current.get(p.id);
            const dStr = computeBranchSvgPathForNode(
              trN ? { id: n.id, x: trN.x, y: trN.y } : n,
              trP ? { id: p.id, x: trP.x, y: trP.y } : p,
              curDepthMap.get(n.id) ?? 1,
              nodeDimensionsRef.current
            );
            branchPathRefs.current.get(n.id)?.setAttribute('d', dStr);
            branchHaloRefs.current.get(n.id)?.setAttribute('d', dStr);
          }
        });
      }
    });
    cardResizeObserverRef.current = ro;
    nodeCardElementsRef.current.forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      cardResizeObserverRef.current = null;
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
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

  useEffect(() => {
    spatialIndexRef.current.rebuild(nodes, rootNodeId, treeMeta.hiddenNodeIds);
    requestRender();
    setCullTick((t) => t + 1);
  }, [nodes, rootNodeId, treeMeta.hiddenNodeIds, requestRender]);

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
  const lastZoomSentRef = useRef<number>(100);
  const lastPointerBroadcastAtRef = useRef<number>(0);

  const syncDomWorldLayer = useCallback((forceFlush = false) => {
    const vp = viewportRef.current.getTransform();
    if (domWorldRef.current) {
      domWorldRef.current.style.transform = `translate3d(${vp.x}px, ${vp.y}px, 0) scale(${vp.scale})`;
    }

    // 120Hz Pure GPU Compositor Dot-Grid: translate3d ONLY (ZERO radial-gradient re-rasterization or CSS-var cascade!)
    if (dotGridRef.current) {
      const tileStep = 28;
      const ox = ((vp.x % tileStep) + tileStep) % tileStep - tileStep;
      const oy = ((vp.y % tileStep) + tileStep) % tileStep - tileStep;
      dotGridRef.current.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0)`;
    }

    // ZERO React Root Re-Renders during active pan/zoom/inertia! Flush zoom% & MiniMap ONLY after motion settles (`forceFlush`).
    if (forceFlush) {
      const nextZoomPct = Math.round(vp.scale * 100);
      if (nextZoomPct !== lastZoomSentRef.current) {
        lastZoomSentRef.current = nextZoomPct;
        callbacksRef.current.onZoomChange(nextZoomPct);
      }

      const w = renderDataRef.current.stageSize.w;
      const h = renderDataRef.current.stageSize.h;
      if (w >= 640) {
        const hiddenIds = renderDataRef.current.treeMeta.hiddenNodeIds;
        const prevSnap = lastSnapSentRef.current;
        const snapChanged =
          !prevSnap ||
          Math.abs(prevSnap.x - vp.x) > 4 ||
          Math.abs(prevSnap.y - vp.y) > 4 ||
          Math.abs(prevSnap.scale - vp.scale) > 0.01 ||
          prevSnap.w !== w ||
          prevSnap.h !== h ||
          prevSnap.hiddenCount !== hiddenIds.size;

        if (snapChanged) {
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
      }
    }

    const prev = lastCullTransformRef.current;
    const crossedSemanticZoom = (prev.scale < 0.14) !== (vp.scale < 0.14);
    const totalNodeCount = Object.keys(renderDataRef.current.nodes).length;
    if (crossedSemanticZoom) {
      lastCullTransformRef.current = vp;
      setCurrentScale(vp.scale);
    } else if (
      totalNodeCount > 64 &&
      (Math.hypot(vp.x - prev.x, vp.y - prev.y) > 260 ||
        Math.abs(vp.scale - prev.scale) > 0.16)
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
      stageRectRef.current = {
        left: rect.left,
        top: rect.top,
        width: w,
        height: h,
      };
      setStageSize({ w, h });
      requestRender();
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [requestRender]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = refreshCachedStageRect();
    const bounds = spatialIndexRef.current.getTotalBounds();
    const isPhone = rect.width < 640;
    viewportRef.current.fitBounds(
      bounds,
      rect.width || window.innerWidth,
      rect.height || window.innerHeight,
      isPhone ? 44 : 92,
      fitTrigger === 0 ? 1 : 340
    );
    requestRender();
    syncDomWorldLayer(true);
  }, [fitTrigger, refreshCachedStageRect, syncDomWorldLayer, requestRender]);

  useEffect(() => {
    if (!radarJumpRequest) return;
    const cur = viewportRef.current.getTransform();
    const snap = getViewportKeyboardSnapshot();
    const availW = snap.viewportW || stageSize.w || window.innerWidth;
    const availH = snap.visibleBottomY || stageSize.h || window.innerHeight;
    const barH = selectedNodeId || editingNodeId ? snap.studioBarHeight || 220 : 0;
    const topSafe = 76;
    const bottomEdge = Math.max(topSafe + 100, availH - barH - 24);
    const targetCenterY = Math.round((topSafe + bottomEdge) * 0.5);
    const endX = availW * 0.5 - radarJumpRequest.x * cur.scale;
    const endY = targetCenterY - radarJumpRequest.y * cur.scale;
    viewportRef.current.animateTo({ x: endX, y: endY, scale: cur.scale }, 260);
    requestRender();
  }, [radarJumpRequest, stageSize.w, stageSize.h, requestRender, selectedNodeId, editingNodeId]);

  useEffect(() => {
    if (!zoomRequest) return;
    const cur = viewportRef.current.getTransform();
    viewportRef.current.zoomAtScreenPoint(
      cur.scale * zoomRequest.factor,
      stageSize.w * 0.5,
      stageSize.h * 0.5
    );
    requestRender();
  }, [zoomRequest, stageSize.w, stageSize.h, requestRender]);

  useEffect(() => {
    const activeTargetId = editingNodeId ?? selectedNodeId;
    if (!activeTargetId) return;
    const node = nodes[activeTargetId];
    if (!node) return;

    const centerAboveKeyboard = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      const snap = getViewportKeyboardSnapshot();
      const availW = snap.viewportW || window.innerWidth;
      const availH = snap.visibleBottomY || window.innerHeight;
      const barH = snap.studioBarHeight || 228;

      const curT = viewportRef.current.getTransform();
      const curScale = curT.scale;
      // Preserve the user's exact zoom scale when typing or selecting a node!
      // NEVER unexpectedly zoom the canvas up (which made the screen appear permanently enlarged after typing).
      const desiredScale = curScale;

      if (snap.isPhone || snap.isKeyboardOpen) {
        // Place active node smoothly in unobstructed upper area above dock/keyboard without hijacking zoom
        const topSafe = 76;
        const bottomEdge = Math.max(topSafe + 90, availH - barH - 36);
        const usableCenterY = Math.round((topSafe + bottomEdge) * 0.5);
        const endX = availW * 0.5 - node.x * desiredScale;
        const endY = usableCenterY - node.y * desiredScale;
        if (
          Math.abs(curT.x - endX) > 6 ||
          Math.abs(curT.y - endY) > 6 ||
          Math.abs(curT.scale - desiredScale) > 0.02
        ) {
          viewportRef.current.animateTo(
            { x: endX, y: endY, scale: desiredScale },
            210
          );
          requestRender();
        }
      } else {
        // On Tablets & Desktops (with keyboard closed): keep camera rock-solid unless node is obstructed by HUD or Studio Dock!
        const sp = viewportRef.current.worldToScreen(node.x, node.y);
        const minSafeX = 96;
        const maxSafeX = availW - 96;
        const minSafeY = 90;
        const maxSafeY = Math.max(minSafeY + 110, availH - barH - 48);

        if (
          sp.x < minSafeX ||
          sp.x > maxSafeX ||
          sp.y < minSafeY ||
          sp.y > maxSafeY
        ) {
          const targetScreenX = Math.min(maxSafeX, Math.max(minSafeX, sp.x));
          const targetScreenY =
            sp.y > maxSafeY || sp.y < minSafeY
              ? Math.round((minSafeY + maxSafeY) * 0.52)
              : sp.y;
          viewportRef.current.animateTo(
            {
              x: targetScreenX - node.x * desiredScale,
              y: targetScreenY - node.y * desiredScale,
              scale: desiredScale,
            },
            220
          );
          requestRender();
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
    requestRender();
  }, [nodes, crossLinks, darkMode, focusedMainBranchId, stageSize, treeMeta, linkingFromNodeId, requestRender]);

  // True 120Hz Zero-Canvas-Overhead Render Scheduler:
  // During pan/pinch/inertia, ONLY `domWorldRef` GPU `translate3d + scale` + CSS dot grid update (0 Canvas2D redraws!).
  // `<canvas>` activates ONLY during transient `+` spring branch preview or `🔗 İlişki Çek` target picking!
  useEffect(() => {
    let unmounted = false;

    const frame = (now: number) => {
      rafIdRef.current = null;
      if (unmounted) return;

      const vpChanged = viewportRef.current.step(now);
      let springChanged = false;
      if (dragPreviewRef.current) {
        springChanged = stepSpringBranch(dragPreviewRef.current);
      }

      const isActivelyLinking = Boolean(renderDataRef.current.linkingFromNodeId);
      const needsInteractiveCanvasOverlay =
        Boolean(dragPreviewRef.current) || isActivelyLinking;

      if (
        vpChanged ||
        springChanged ||
        needsRedrawRef.current ||
        needsInteractiveCanvasOverlay
      ) {
        const shouldSyncDom = vpChanged || needsRedrawRef.current;
        needsRedrawRef.current = false;

        const canvas = canvasRef.current;
        if (canvas) {
          if (needsInteractiveCanvasOverlay) {
            const {
              nodes: curNodes,
              stageSize: curSize,
              linkingFromNodeId: curLinkFrom,
              treeMeta: curMeta,
            } = renderDataRef.current;

            const safe = computeSafeCanvasDimensions(curSize.w, curSize.h);
            if (canvas.width !== safe.width || canvas.height !== safe.height) {
              canvas.width = safe.width;
              canvas.height = safe.height;
              canvas.style.opacity = '1';
            }

            const ctx = canvas.getContext('2d', { alpha: true });
            if (ctx) {
              const dpr = canvas.width / Math.max(1, curSize.w);
              const vp = viewportRef.current.getTransform();
              ctx.save();
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              ctx.clearRect(0, 0, curSize.w, curSize.h);

              if (dragPreviewRef.current) {
                const dp = dragPreviewRef.current;
                ctx.save();
                ctx.translate(vp.x, vp.y);
                ctx.scale(vp.scale, vp.scale);
                branchRendererRef.current.drawTaperedBranch(
                  ctx,
                  dp.startX,
                  dp.startY,
                  dp.currentX,
                  dp.currentY,
                  dp.color,
                  dp.depth,
                  0.92,
                  false
                );
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = dp.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(dp.currentX, dp.currentY, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
              }

              if (curLinkFrom && curNodes[curLinkFrom] && pendingLinkTargetRef.current) {
                crossLinkRendererRef.current.renderInteractiveCrossLinks(
                  ctx,
                  undefined,
                  curNodes,
                  vp,
                  curMeta.hiddenNodeIds,
                  now,
                  curNodes[curLinkFrom],
                  pendingLinkTargetRef.current
                );
              }

              ctx.restore();
            }
          } else if (canvas.width !== 1 || canvas.height !== 1) {
            // Shrink overlay canvas to 1x1 when idle/panning -> saves 12.5MB tablet GPU VRAM!
            canvas.width = 1;
            canvas.height = 1;
            canvas.style.opacity = '0';
          }
        }

        const stillAnimating =
          viewportRef.current.isAnimating() ||
          springChanged ||
          needsRedrawRef.current ||
          isActivelyLinking;

        if (shouldSyncDom) {
          syncDomWorldLayer(!stillAnimating);
        }

        if (stillAnimating && !unmounted && rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(frame);
        }
      }
    };

    const schedule = () => {
      if (unmounted || rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(frame);
    };

    scheduleRenderRef.current = schedule;
    schedule();

    return () => {
      unmounted = true;
      scheduleRenderRef.current = () => {};
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [syncDomWorldLayer]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = refreshCachedStageRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const cur = viewportRef.current.getTransform();
      const zoomFactor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.0085 : 0.0016));
      viewportRef.current.zoomAtScreenPoint(cur.scale * zoomFactor, sx, sy);
      requestRender();
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    const onNativeTouchEndOrCancel = (ev: TouchEvent) => {
      if (ev.touches.length === 0) {
        window.setTimeout(() => {
          if (
            activeTouchesRef.current.size > 0 &&
            !nodeDragRef.current &&
            !branchDragRef.current &&
            !panStateRef.current
          ) {
            resetAllGestureStates();
          }
        }, 120);
      }
    };
    const onWindowBlur = () => {
      resetAllGestureStates();
    };

    el.addEventListener('touchend', onNativeTouchEndOrCancel, { passive: true });
    el.addEventListener('touchcancel', onNativeTouchEndOrCancel, { passive: true });
    window.addEventListener('blur', onWindowBlur);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchend', onNativeTouchEndOrCancel);
      el.removeEventListener('touchcancel', onNativeTouchEndOrCancel);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [refreshCachedStageRect, resetAllGestureStates, requestRender]);

  // Smart Hybrid Spatial Virtualization:
  // - Maps <= 64 nodes: keep all non-hidden nodes & SVG branches stably mounted (ZERO mid-pan React re-render!).
  // - Giant maps > 64 nodes: RBush O(log N) viewport virtualization (+360px buffer) holding steady 120 FPS!
  const visibleNodeIds = useMemo(() => {
    void cullTick;
    const allIds = Object.keys(nodes);
    if (allIds.length <= 64) {
      return allIds.filter((id) => !treeMeta.hiddenNodeIds.has(id));
    }
    const bounds = viewportRef.current.getVisibleWorldBounds(
      stageSize.w,
      stageSize.h,
      360
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

  const visibleBranchNodes = useMemo(() => {
    const visibleSet = new Set(visibleNodeIds);
    const list: MindNode[] = [];
    for (const n of Object.values(nodes)) {
      if (!n.parentId || n.id === rootNodeId) continue;
      if (treeMeta.hiddenNodeIds.has(n.id) || treeMeta.hiddenNodeIds.has(n.parentId)) {
        continue;
      }
      if (!nodes[n.parentId]) continue;
      if (visibleSet.has(n.id) || visibleSet.has(n.parentId)) {
        list.push(n);
      }
    }
    return list;
  }, [nodes, rootNodeId, treeMeta.hiddenNodeIds, visibleNodeIds]);

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

    if (e.isPrimary) {
      if (activeTouchesRef.current.size > 0 && !activeTouchesRef.current.has(e.pointerId)) {
        activeTouchesRef.current.clear();
        pinchStateRef.current = null;
      }
      clearLongPressTimer();
      setLiftingNodeId(null);
      branchDragRef.current = null;
      nodeDragRef.current = null;
      dragPreviewRef.current = null;
    }

    const rect = refreshCachedStageRect();
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

    if (activeTouchesRef.current.size >= 2) {
      clearLongPressTimer();
      setLiftingNodeId(null);
      nodeDragRef.current = null;
      branchDragRef.current = null;
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
      // Hardware Stylus Eraser Detection (Samsung S-Pen side button, Android TOOL_TYPE_ERASER, Apple Pencil)
      const isStylusHardwareEraser = isEventHardwareEraser(e);

      // Freehand Tablet / S-Pen / Apple Pencil / Finger Canvas Drawing Intercept (`drawingMode === true`)
      const shouldDrawWithPointer =
        (drawingMode || isStylusHardwareEraser) &&
        !spacePressed &&
        (!stylusOnly ||
          e.pointerType === 'pen' ||
          (e.pointerType as string) === 'eraser' ||
          e.pointerType === 'mouse');

      if (shouldDrawWithPointer) {
        const wPt = viewportRef.current.screenToWorld(sx, sy);
        const effTool: InkToolType = isStylusHardwareEraser ? 'eraser' : inkTool;

        if (effTool === 'eraser') {
          activeEraserPointerRef.current = e.pointerId;
          lastEraserWorldPtRef.current = wPt;
          eraserPushedHistoryRef.current = false;
          performInterpolatedErase([wPt]);
          if (stylusHoverRef.current) {
            stylusHoverRef.current.style.opacity = '1';
            stylusHoverRef.current.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
            stylusHoverRef.current.style.borderColor = '#F43F5E';
            stylusHoverRef.current.style.width = '34px';
            stylusHoverRef.current.style.height = '34px';
          }
          return;
        }

        if (effTool === 'laser') {
          if (laserClearTimerRef.current !== null) {
            window.clearTimeout(laserClearTimerRef.current);
            laserClearTimerRef.current = null;
          }
          activeLaserRef.current = {
            pointerId: e.pointerId,
            points: [[wPt.x, wPt.y, 0.5]],
          };
          if (liveLaserPathRef.current) {
            liveLaserPathRef.current.style.opacity = '1';
            liveLaserPathRef.current.setAttribute(
              'd',
              buildInkSvgPath('pen', activeLaserRef.current.points, 5)
            );
          }
          return;
        }

        if (effTool === 'lasso') {
          // If dragging inside an existing lasso selection box, move all selected strokes together!
          if (selectedLassoIds.length > 0 && inkStrokes && onReplaceInkStrokes) {
            const selSet = new Set(selectedLassoIds);
            const selStrokes = inkStrokes.filter((s) => selSet.has(s.id));
            const box = getInkStrokesBoundingBox(selStrokes);
            if (
              box &&
              wPt.x >= box.minX - 24 &&
              wPt.x <= box.maxX + 24 &&
              wPt.y >= box.minY - 24 &&
              wPt.y <= box.maxY + 24
            ) {
              lassoMoveRef.current = {
                pointerId: e.pointerId,
                startWorldX: wPt.x,
                startWorldY: wPt.y,
                baseStrokes: inkStrokes,
              };
              return;
            }
          }
          onSelectLassoIds?.([]);
          activeLassoRef.current = {
            pointerId: e.pointerId,
            points: [[wPt.x, wPt.y, 0.5]],
          };
          if (liveLassoPathRef.current) {
            liveLassoPathRef.current.setAttribute(
              'd',
              buildInkSvgPath('pen', activeLassoRef.current.points, 2)
            );
          }
          return;
        }

        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        const pressureScale =
          effTool === 'pen' ? 0.72 + Math.min(1, pressure) * 0.56 : 1;
        const effWidth =
          effTool === 'highlighter'
            ? Math.max(15, inkWidth * 3.8)
            : Number((inkWidth * pressureScale).toFixed(2));
        const effOpacity = effTool === 'highlighter' ? 0.34 : 0.96;

        activeInkRef.current = {
          pointerId: e.pointerId,
          tool: effTool,
          color: inkColor,
          width: effWidth,
          opacity: effOpacity,
          points: [[wPt.x, wPt.y, pressure]],
          snapped: false,
        };
        if (liveInkPathRef.current) {
          liveInkPathRef.current.setAttribute('stroke', inkColor);
          liveInkPathRef.current.setAttribute('stroke-width', String(effWidth));
          liveInkPathRef.current.setAttribute('stroke-opacity', String(effOpacity));
          liveInkPathRef.current.removeAttribute('stroke-dasharray');
          liveInkPathRef.current.setAttribute(
            'd',
            buildInkSvgPath(effTool, activeInkRef.current.points, effWidth)
          );
        }
        return;
      }

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
    // Zero forced reflow: read cached stageRectRef instead of calling getBoundingClientRect() 120-240x/sec!
    const rect = stageRectRef.current;

    const coalesced =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const latestSample =
      coalesced.length > 0 ? coalesced[coalesced.length - 1] : e.nativeEvent;

    const sx = latestSample.clientX - rect.left;
    const sy = latestSample.clientY - rect.top;

    const worldPt = viewportRef.current.screenToWorld(sx, sy);
    if (collaborators.length > 1) {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (nowMs - lastPointerBroadcastAtRef.current >= 100) {
        lastPointerBroadcastAtRef.current = nowMs;
        onPointerWorldMove(worldPt.x, worldPt.y);
      }
    }

    if (linkingFromNodeId) {
      pendingLinkTargetRef.current = worldPt;
      requestRender();
    }

    if (activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, {
        x: sx,
        y: sy,
        pointerType: e.pointerType,
      });
    }

    // S-Pen & Apple Pencil Hover & Live Active-Eraser Ring Preview
    if (stylusHoverRef.current) {
      const isActivelyErasing = activeEraserPointerRef.current === e.pointerId;
      const isPenHover =
        (e.pointerType === 'pen' || (e.pointerType as string) === 'eraser') &&
        e.pressure === 0 &&
        (drawingMode || hardwareEraserActive);
      if (isActivelyErasing || isPenHover) {
        const hoverIsEraser =
          isActivelyErasing ||
          inkTool === 'eraser' ||
          isEventHardwareEraser(e);
        stylusHoverRef.current.style.opacity = '1';
        stylusHoverRef.current.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
        stylusHoverRef.current.style.borderColor = hoverIsEraser ? '#F43F5E' : inkColor;
        stylusHoverRef.current.style.width = hoverIsEraser ? '34px' : `${Math.max(10, inkWidth * 2.2)}px`;
        stylusHoverRef.current.style.height = hoverIsEraser ? '34px' : `${Math.max(10, inkWidth * 2.2)}px`;
      } else {
        stylusHoverRef.current.style.opacity = '0';
      }
    }

    // Sticky Note Drag Move (World Space)
    if (stickyDragRef.current && stickyDragRef.current.pointerId === e.pointerId && onUpdateStickyNote) {
      const sd = stickyDragRef.current;
      const sc = Math.max(0.2, viewportRef.current.getTransform().scale);
      const dx = (e.clientX - sd.startClientX) / sc;
      const dy = (e.clientY - sd.startClientY) / sc;
      onUpdateStickyNote(sd.noteId, {
        x: Math.round(sd.origX + dx),
        y: Math.round(sd.origY + dy),
      });
      return;
    }

    // Lasso Selection Move (Drag all enclosed ink strokes smoothly!)
    if (lassoMoveRef.current && lassoMoveRef.current.pointerId === e.pointerId && onReplaceInkStrokes) {
      const lm = lassoMoveRef.current;
      const dx = worldPt.x - lm.startWorldX;
      const dy = worldPt.y - lm.startWorldY;
      const selSet = new Set(selectedLassoIds);
      onReplaceInkStrokes(
        lm.baseStrokes.map((st) => (selSet.has(st.id) ? translateInkStroke(st, dx, dy) : st))
      );
      return;
    }

    // Lasso Freehand Loop Preview
    if (activeLassoRef.current && activeLassoRef.current.pointerId === e.pointerId) {
      const pts = activeLassoRef.current.points;
      const prev = pts[pts.length - 1];
      if (!prev || Math.hypot(worldPt.x - prev[0], worldPt.y - prev[1]) >= 4) {
        pts.push([worldPt.x, worldPt.y, 0.5]);
        if (liveLassoPathRef.current) {
          liveLassoPathRef.current.setAttribute('d', `${buildInkSvgPath('pen', pts, 2)} Z`);
        }
      }
      return;
    }

    // Presentation Laser Pointer Trail
    if (activeLaserRef.current && activeLaserRef.current.pointerId === e.pointerId) {
      const pts = activeLaserRef.current.points;
      pts.push([worldPt.x, worldPt.y, 0.5]);
      if (pts.length > 36) pts.shift();
      if (liveLaserPathRef.current) {
        liveLaserPathRef.current.setAttribute('d', buildInkSvgPath('pen', pts, 5));
      }
      return;
    }

    // 0. 120Hz Zero-React-Render Freehand Canvas Drawing & Smart Interpolated Swipe-to-Erase!
    if (activeEraserPointerRef.current === e.pointerId) {
      const samples = coalesced.length > 0 ? coalesced : [e.nativeEvent];
      const worldSamples = samples.map((s) =>
        viewportRef.current.screenToWorld(s.clientX - rect.left, s.clientY - rect.top)
      );
      performInterpolatedErase(worldSamples);
      return;
    }

    if (activeInkRef.current && activeInkRef.current.pointerId === e.pointerId) {
      // Mid-stroke chorded S-Pen side button press: seamlessly abort ink and erase!
      if (isEventHardwareEraser(e)) {
        if (shapeHoldTimerRef.current !== null) {
          window.clearTimeout(shapeHoldTimerRef.current);
          shapeHoldTimerRef.current = null;
        }
        activeInkRef.current = null;
        if (liveInkPathRef.current) {
          liveInkPathRef.current.setAttribute('d', '');
        }
        activeEraserPointerRef.current = e.pointerId;
        lastEraserWorldPtRef.current = worldPt;
        eraserPushedHistoryRef.current = false;
        performInterpolatedErase([worldPt]);
        return;
      }

      const stroke = activeInkRef.current;
      const samples = coalesced.length > 0 ? coalesced : [e.nativeEvent];
      let movedEnough = false;
      for (const sample of samples) {
        const pt = viewportRef.current.screenToWorld(
          sample.clientX - rect.left,
          sample.clientY - rect.top
        );
        const prev = stroke.points[stroke.points.length - 1];
        const minDist =
          stroke.tool === 'pen' || stroke.tool === 'highlighter' ? 1.8 : 0.5;
        if (!prev || Math.hypot(pt.x - prev[0], pt.y - prev[1]) >= minDist) {
          movedEnough = true;
          const pVal = sample.pressure > 0 ? sample.pressure : 0.5;
          if (
            stroke.tool === 'line' ||
            stroke.tool === 'arrow' ||
            stroke.tool === 'rect' ||
            stroke.tool === 'ellipse'
          ) {
            if (stroke.points.length >= 2) {
              stroke.points[1] = [pt.x, pt.y, pVal];
            } else {
              stroke.points.push([pt.x, pt.y, pVal]);
            }
          } else {
            stroke.points.push([pt.x, pt.y, pVal]);
          }
        }
      }

      // Samsung Notes & Apple Notes Hold-to-Snap Auto-Shape Assist (420ms stationary hold snaps line/circle/box!)
      if (autoShapeEnabled && stroke.tool === 'pen' && !stroke.snapped && movedEnough) {
        if (shapeHoldTimerRef.current !== null) {
          window.clearTimeout(shapeHoldTimerRef.current);
        }
        shapeHoldTimerRef.current = window.setTimeout(() => {
          shapeHoldTimerRef.current = null;
          if (!activeInkRef.current || activeInkRef.current.snapped) return;
          const snapped = detectSnappedShape(activeInkRef.current.points);
          if (snapped) {
            activeInkRef.current.tool = snapped.tool;
            activeInkRef.current.points = snapped.points;
            activeInkRef.current.snapped = true;
            void hapticMedium();
            if (liveInkPathRef.current) {
              liveInkPathRef.current.setAttribute(
                'd',
                buildInkSvgPath(snapped.tool, snapped.points, activeInkRef.current.width)
              );
            }
          }
        }, 420);
      }

      if (!inkRafPendingRef.current) {
        inkRafPendingRef.current = true;
        requestAnimationFrame(() => {
          inkRafPendingRef.current = false;
          if (activeInkRef.current && liveInkPathRef.current) {
            liveInkPathRef.current.setAttribute(
              'd',
              buildInkSvgPath(
                activeInkRef.current.tool,
                activeInkRef.current.points,
                activeInkRef.current.width
              )
            );
          }
        });
      }
      return;
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
          requestRender();
        }
      }
      return;
    }

    // 2. Transient Subtree Drag Engine (ZERO React setState, ZERO Canvas redraw!)
    if (nodeDragRef.current && nodeDragRef.current.pointerId === e.pointerId) {
      const nd = nodeDragRef.current;

      if (activeTouchesRef.current.size >= 2) {
        clearLongPressTimer();
        setLiftingNodeId(null);
        nodeDragRef.current = null;
        setActiveDragIds([]);
      } else if (nd.pointerType === 'touch' && !nd.isLongPressArmed) {
        const distPx = Math.hypot(
          e.clientX - nd.startClientX,
          e.clientY - nd.startClientY
        );
        if (distPx > 6) {
          clearLongPressTimer();
          setLiftingNodeId(null);
          nodeDragRef.current = null;
          setActiveDragIds([]);
          const initDx = sx - nd.startStageX;
          const initDy = sy - nd.startStageY;
          viewportRef.current.panBy(initDx, initDy);
          panStateRef.current = {
            pointerId: e.pointerId,
            lastX: sx,
            lastY: sy,
            vx: initDx,
            vy: initDy,
            moved: true,
          };
          setInteractingAttr(true);
          requestRender();
        }
        return;
      } else {
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

          // Directly update affected SVG tapered branch paths in O(k) (0 React renders, 0 Canvas draws!)
          for (const branchChildId of nd.connectedBranchIds) {
            const childNode = nodes[branchChildId];
            const parentNode = childNode?.parentId ? nodes[childNode.parentId] : null;
            if (!childNode || !parentNode) continue;
            const trC = transientPositionsRef.current.get(childNode.id);
            const trP = transientPositionsRef.current.get(parentNode.id);
            const dStr = computeBranchSvgPathForNode(
              trC ? { id: childNode.id, x: trC.x, y: trC.y } : childNode,
              trP ? { id: parentNode.id, x: trP.x, y: trP.y } : parentNode,
              treeMeta.depthMap.get(childNode.id) ?? 1,
              nodeDimensionsRef.current
            );
            branchPathRefs.current.get(childNode.id)?.setAttribute('d', dStr);
            branchHaloRefs.current.get(childNode.id)?.setAttribute('d', dStr);
          }

          // Synchronize any CrossLink SVG curves & mid-curve pill DOM elements attached to moved nodes
          const curLinks = renderDataRef.current.crossLinks;
          if (curLinks && curLinks.length > 0) {
            for (const link of curLinks) {
              if (
                transientPositionsRef.current.has(link.fromNodeId) ||
                transientPositionsRef.current.has(link.toNodeId)
              ) {
                const baseFrom = nodes[link.fromNodeId];
                const baseTo = nodes[link.toNodeId];
                if (baseFrom && baseTo) {
                  const trFrom = transientPositionsRef.current.get(link.fromNodeId);
                  const trTo = transientPositionsRef.current.get(link.toNodeId);
                  const geom = computeCrossLinkGeometry(
                    trFrom ? { ...baseFrom, x: trFrom.x, y: trFrom.y } : baseFrom,
                    trTo ? { ...baseTo, x: trTo.x, y: trTo.y } : baseTo
                  );
                  const pillEl = crossLinkDomRefs.current.get(link.id);
                  if (pillEl) {
                    pillEl.style.transform = `translate3d(${geom.midX}px, ${geom.midY}px, 0) translate(-50%, -50%)`;
                  }
                  const svgRefs = crossLinkCurveRefs.current.get(link.id);
                  if (svgRefs) {
                    const qPath = `M ${geom.startX.toFixed(1)} ${geom.startY.toFixed(1)} Q ${geom.cpX.toFixed(1)} ${geom.cpY.toFixed(1)} ${geom.endX.toFixed(1)} ${geom.endY.toFixed(1)}`;
                    svgRefs.main?.setAttribute('d', qPath);
                    svgRefs.glow?.setAttribute('d', qPath);
                    svgRefs.dot?.setAttribute('cx', geom.startX.toFixed(1));
                    svgRefs.dot?.setAttribute('cy', geom.startY.toFixed(1));
                    svgRefs.arrow?.setAttribute(
                      'transform',
                      buildCrossLinkArrowTransform(geom.endX, geom.endY, geom.endAngleRad)
                    );
                  }
                }
              }
            }
          }
        }
        return;
      }
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
      requestRender();
      return;
    }

    // 4. 120Hz Silky Canvas Pan with Exponential Velocity Smoothing
    if (panStateRef.current && panStateRef.current.pointerId === e.pointerId) {
      const ps = panStateRef.current;
      const dx = sx - ps.lastX;
      const dy = sy - ps.lastY;
      if (Math.hypot(dx, dy) > 2.5) {
        ps.moved = true;
      }
      ps.vx = ps.moved ? ps.vx * 0.42 + dx * 0.58 : dx;
      ps.vy = ps.moved ? ps.vy * 0.42 + dy * 0.58 : dy;
      ps.lastX = sx;
      ps.lastY = sy;
      viewportRef.current.panBy(dx, dy);
      requestRender();
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'pen') {
      if (penReleaseTimerRef.current !== null) {
        window.clearTimeout(penReleaseTimerRef.current);
      }
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

    if (stickyDragRef.current && stickyDragRef.current.pointerId === e.pointerId) {
      stickyDragRef.current = null;
      return;
    }

    if (lassoMoveRef.current && lassoMoveRef.current.pointerId === e.pointerId) {
      lassoMoveRef.current = null;
      return;
    }

    if (activeLassoRef.current && activeLassoRef.current.pointerId === e.pointerId) {
      const lassoPts = activeLassoRef.current.points;
      activeLassoRef.current = null;
      if (liveLassoPathRef.current) {
        liveLassoPathRef.current.setAttribute('d', '');
      }
      if (inkStrokes && onSelectLassoIds) {
        const found = findStrokesInsideLasso(inkStrokes, lassoPts);
        onSelectLassoIds(found);
        if (found.length > 0) void hapticLight();
      }
      return;
    }

    if (activeLaserRef.current && activeLaserRef.current.pointerId === e.pointerId) {
      activeLaserRef.current = null;
      if (liveLaserPathRef.current) {
        liveLaserPathRef.current.style.opacity = '0';
        laserClearTimerRef.current = window.setTimeout(() => {
          liveLaserPathRef.current?.setAttribute('d', '');
          laserClearTimerRef.current = null;
        }, 1200);
      }
      return;
    }

    if (activeEraserPointerRef.current === e.pointerId) {
      activeEraserPointerRef.current = null;
      lastEraserWorldPtRef.current = null;
      eraserPushedHistoryRef.current = false;
      if (stylusHoverRef.current) {
        stylusHoverRef.current.style.opacity = '0';
      }
      return;
    }

    if (activeInkRef.current && activeInkRef.current.pointerId === e.pointerId) {
      if (shapeHoldTimerRef.current !== null) {
        window.clearTimeout(shapeHoldTimerRef.current);
        shapeHoldTimerRef.current = null;
      }
      const finished = activeInkRef.current;
      activeInkRef.current = null;
      if (liveInkPathRef.current) {
        liveInkPathRef.current.setAttribute('d', '');
      }
      if (finished.points.length > 0 && onAddInkStroke) {
        onAddInkStroke({
          id: `ink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          tool: finished.tool,
          color: finished.color,
          width: finished.width,
          opacity: finished.opacity,
          points: finished.points,
        });
      }
      return;
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
          requestRender();
          void hapticMedium();
          onCreateChildBranch(parent.id, dropX, dropY, bd.color);
        } else {
          dragPreviewRef.current = null;
          requestRender();
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
        requestRender();
      }
      return;
    }

    if (nodeDragRef.current && nodeDragRef.current.pointerId === e.pointerId) {
      const nd = nodeDragRef.current;
      clearLongPressTimer();
      setLiftingNodeId(null);
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
        requestRender();
        onCommitBatchNodePositions(batchUpdates);
        return;
      }

      transientPositionsRef.current.clear();

      if (nd.pointerType === 'touch' && nd.isLongPressArmed) {
        onSelectNode(nd.nodeId);
        return;
      }

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
      if (!kbSnap.isTouchDevice && selectedNodeId === nd.nodeId && editingNodeId !== nd.nodeId) {
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
        requestRender();
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
    if (spacePressed) return;
    // Never steal stylus/eraser/pen strokes from the drawing layer when drawing or holding hardware eraser!
    if (drawingMode || isEventHardwareEraser(e)) return;
    if (editingNodeId === node.id && !kbSnap.isTouchDevice) return;

    e.stopPropagation();
    const rect = refreshCachedStageRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (e.pointerType === 'touch') {
      if (e.isPrimary && activeTouchesRef.current.size > 0 && !activeTouchesRef.current.has(e.pointerId)) {
        activeTouchesRef.current.clear();
        pinchStateRef.current = null;
      }
      activeTouchesRef.current.set(e.pointerId, {
        x: sx,
        y: sy,
        pointerType: 'touch',
      });
    }

    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors
    }
    viewportRef.current.stopMomentum();

    if (e.pointerType === 'touch' && activeTouchesRef.current.size >= 2) {
      clearLongPressTimer();
      setLiftingNodeId(null);
      nodeDragRef.current = null;
      panStateRef.current = null;
      branchDragRef.current = null;
      const pts = Array.from(activeTouchesRef.current.values());
      pinchStateRef.current = {
        lastDist: Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)),
        lastMidX: (pts[0].x + pts[1].x) * 0.5,
        lastMidY: (pts[0].y + pts[1].y) * 0.5,
      };
      setInteractingAttr(true);
      return;
    }

    const singleOnly = e.altKey || singleNodeDragMode;
    const affectedIds = collectSubtreeIds(node.id, nodes, rootNodeId, singleOnly);
    const affectedSet = new Set(affectedIds);
    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const id of affectedIds) {
      const n = nodes[id];
      if (n) {
        initialPositions.set(id, { x: n.x, y: n.y });
      }
    }
    const connectedBranchIds: string[] = [];
    for (const n of Object.values(nodes)) {
      if (!n.parentId || n.id === rootNodeId) continue;
      if (affectedSet.has(n.id) || affectedSet.has(n.parentId)) {
        connectedBranchIds.push(n.id);
      }
    }
    if (affectedIds.length > 1) {
      setActiveDragIds(affectedIds);
    }

    const isTouch = e.pointerType === 'touch';
    clearLongPressTimer();
    setLiftingNodeId(null);

    nodeDragRef.current = {
      pointerId: e.pointerId,
      nodeId: node.id,
      pointerType: e.pointerType,
      isLongPressArmed: !isTouch,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startStageX: sx,
      startStageY: sy,
      initialPositions,
      connectedBranchIds,
      moved: false,
    };

    if (isTouch) {
      const capturedPointerId = e.pointerId;
      longPressTimerRef.current = window.setTimeout(() => {
        const cur = nodeDragRef.current;
        if (
          cur &&
          cur.pointerId === capturedPointerId &&
          !cur.moved &&
          activeTouchesRef.current.size === 1
        ) {
          cur.isLongPressArmed = true;
          setLiftingNodeId(node.id);
          setInteractingAttr(true);
          void hapticMedium();
        }
      }, 260);
    }
  };

  const startBranchHandlePointerDown = (
    e: React.PointerEvent,
    parentNode: MindNode,
    directionBias?: 1 | -1
  ) => {
    if (e.pointerType === 'touch' && penActiveRef.current) {
      penActiveRef.current = false;
    }
    if (spacePressed || drawingMode || isEventHardwareEraser(e)) return;
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

  const isSemanticFarZoom = currentScale < 0.14;

  return (
    <div
      ref={containerRef}
      data-interacting="false"
      data-auto-layout={isAutoLayoutAnimating ? 'true' : 'false'}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      style={{
        backgroundColor: darkMode
          ? '#0F141D'
          : paperStyle === 'warm'
          ? '#F6EFE1'
          : '#FAF9F5',
      }}
      className={`canvas-stage canvas-touch-lock relative h-full w-full overflow-hidden ${
        spacePressed
          ? 'cursor-grab active:cursor-grabbing'
          : drawingMode
          ? inkTool === 'eraser' || hardwareEraserActive
            ? 'cursor-cell'
            : 'cursor-crosshair'
          : linkingFromNodeId
          ? 'cursor-crosshair'
          : ''
      }`}
    >
      {/* Layer 0: Isolated 120Hz Pure-GPU Paper Template Layer (Dots / Grid / Lined / Blank / Warm — ZERO jank!) */}
      <div
        ref={dotGridRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 will-change-transform"
        style={{
          width: 'calc(100% + 64px)',
          height: 'calc(100% + 64px)',
          backgroundSize: paperStyle === 'lined' ? '28px 32px' : '28px 28px',
          backgroundImage:
            paperStyle === 'blank'
              ? 'none'
              : paperStyle === 'grid'
              ? darkMode
                ? 'linear-gradient(to right, rgba(148,163,184,0.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.11) 1px, transparent 1px)'
                : 'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)'
              : paperStyle === 'lined'
              ? darkMode
                ? 'linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)'
                : 'linear-gradient(to bottom, rgba(56,189,248,0.22) 1px, transparent 1px)'
              : darkMode
              ? 'radial-gradient(circle, rgba(148, 163, 184, 0.16) 1.25px, transparent 1.7px)'
              : 'radial-gradient(circle, rgba(148, 163, 184, 0.34) 1.25px, transparent 1.7px)',
        }}
      />
      {/* S-Pen & Apple Pencil Live Hover Preview Ring */}
      <div
        ref={stylusHoverRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-50 rounded-full border-2 border-dashed opacity-0 transition-opacity duration-75"
      />
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

      {/* Layer 1: GPU-Synchronized World Layer (SVG Branches + SVG CrossLinks + DOM Cards locked on ONE 120Hz Compositor Layer!) */}
      <div
        ref={domWorldRef}
        className="pointer-events-none absolute top-0 left-0 origin-top-left will-change-transform"
      >
        {/* 120Hz Vector Branches & CrossLinks Layer (Zero mid-pan Canvas2D texture uploads!) */}
        <svg
          width="1"
          height="1"
          data-testid="world-svg-layer"
          className="pointer-events-none absolute top-0 left-0 overflow-visible"
          style={{ zIndex: 2 }}
        >
          {/* Organic Tapered Bezier Branches */}
          {visibleBranchNodes.map((node) => {
            const parent = node.parentId ? nodes[node.parentId] : null;
            if (!parent) return null;
            const depth = treeMeta.depthMap.get(node.id) ?? 1;
            const mainBranchId = treeMeta.mainBranchMap.get(node.id) ?? node.id;
            const isDimmed =
              focusedMainBranchId !== null && mainBranchId !== focusedMainBranchId;
            const dPath = computeBranchSvgPathForNode(
              node,
              parent,
              depth,
              nodeDimensionsRef.current
            );
            const pMeta = node.priorityTag
              ? PRIORITY_BADGE_META[node.priorityTag]
              : null;

            return (
              <g key={node.id} opacity={isDimmed ? 0.18 : 1}>
                {pMeta && (
                  <path
                    ref={(el) => {
                      if (el) branchHaloRefs.current.set(node.id, el);
                      else branchHaloRefs.current.delete(node.id);
                    }}
                    d={dPath}
                    fill="none"
                    stroke={pMeta.branchHighlight}
                    strokeWidth={6}
                    strokeLinejoin="round"
                  />
                )}
                <path
                  ref={(el) => {
                    if (el) branchPathRefs.current.set(node.id, el);
                    else branchPathRefs.current.delete(node.id);
                  }}
                  d={dPath}
                  fill={node.branchColor}
                />
              </g>
            );
          })}

          {/* Directional CrossLink Curves & Arrowheads */}
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
              const strokeColor = link.color || '#0EA5E9';
              const isSolid = link.style === 'solid_arrow';
              const qPath = `M ${geom.startX.toFixed(1)} ${geom.startY.toFixed(1)} Q ${geom.cpX.toFixed(1)} ${geom.cpY.toFixed(1)} ${geom.endX.toFixed(1)} ${geom.endY.toFixed(1)}`;
              const arrowTf = buildCrossLinkArrowTransform(
                geom.endX,
                geom.endY,
                geom.endAngleRad
              );

              return (
                <g key={link.id}>
                  <path
                    ref={(el) => {
                      const prev = crossLinkCurveRefs.current.get(link.id) ?? {
                        main: null,
                        glow: null,
                        dot: null,
                        arrow: null,
                      };
                      prev.glow = el;
                      crossLinkCurveRefs.current.set(link.id, prev);
                    }}
                    d={qPath}
                    fill="none"
                    stroke={strokeColor}
                    strokeOpacity={0.16}
                    strokeWidth={5.5}
                    strokeLinecap="round"
                  />
                  <path
                    ref={(el) => {
                      const prev = crossLinkCurveRefs.current.get(link.id) ?? {
                        main: null,
                        glow: null,
                        dot: null,
                        arrow: null,
                      };
                      prev.main = el;
                      crossLinkCurveRefs.current.set(link.id, prev);
                    }}
                    d={qPath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeDasharray={isSolid ? undefined : '8 6'}
                  />
                  <circle
                    ref={(el) => {
                      const prev = crossLinkCurveRefs.current.get(link.id) ?? {
                        main: null,
                        glow: null,
                        dot: null,
                        arrow: null,
                      };
                      prev.dot = el;
                      crossLinkCurveRefs.current.set(link.id, prev);
                    }}
                    cx={geom.startX.toFixed(1)}
                    cy={geom.startY.toFixed(1)}
                    r={4}
                    fill={strokeColor}
                  />
                  <polygon
                    ref={(el) => {
                      const prev = crossLinkCurveRefs.current.get(link.id) ?? {
                        main: null,
                        glow: null,
                        dot: null,
                        arrow: null,
                      };
                      prev.arrow = el;
                      crossLinkCurveRefs.current.set(link.id, prev);
                    }}
                    points="0,0 -12.15,-6.48 -8.55,0 -12.15,6.48"
                    fill={strokeColor}
                    transform={arrowTf}
                  />
                </g>
              );
            })}
        </svg>

        {/* Foreground 120Hz World-Space Ink, Highlighter, Shapes, Laser & Lasso Layer (zIndex: 35 — ALWAYS visible ABOVE node cards!) */}
        <svg
          width="1"
          height="1"
          data-testid="world-ink-layer"
          className="pointer-events-none absolute top-0 left-0 overflow-visible"
          style={{ zIndex: 35 }}
        >
          {(inkStrokes ?? []).map((stroke) => {
            const isLassoSelected = selectedLassoIds.includes(stroke.id);
            const pathD = buildInkSvgPath(stroke.tool, stroke.points, stroke.width);
            return (
              <g key={stroke.id}>
                {isLassoSelected && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth={stroke.width + 6}
                    strokeOpacity={0.32}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <path
                  d={pathD}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeOpacity={stroke.opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          {/* Selected Lasso Bounding Box Hint */}
          {selectedLassoIds.length > 0 && (() => {
            const selSet = new Set(selectedLassoIds);
            const box = getInkStrokesBoundingBox(
              (inkStrokes ?? []).filter((s) => selSet.has(s.id))
            );
            if (!box) return null;
            return (
              <rect
                x={box.minX - 12}
                y={box.minY - 12}
                width={Math.max(24, box.maxX - box.minX + 24)}
                height={Math.max(24, box.maxY - box.minY + 24)}
                rx={12}
                fill="rgba(99,102,241,0.06)"
                stroke="#6366F1"
                strokeWidth={2}
                strokeDasharray="6 5"
              />
            );
          })()}
          <path
            ref={liveInkPathRef}
            d=""
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            ref={liveLassoPathRef}
            d=""
            fill="rgba(99,102,241,0.09)"
            stroke="#6366F1"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            ref={liveLaserPathRef}
            d=""
            fill="none"
            stroke="#EF4444"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.9))',
              transition: 'opacity 1.1s ease-out',
            }}
          />
        </svg>

        {/* Movable Pastel Sticky Notes on Infinite Canvas (Apple Freeform & Samsung Notes!) */}
        {(stickyNotes ?? []).map((note) => {
          const STICKY_COLORS = ['#FEF08A', '#BBF7D0', '#BAE6FD', '#FBCFE8', '#DDD6FE'];
          return (
            <div
              key={note.id}
              data-testid={`canvas-sticky-${note.id}`}
              onPointerDown={(e) => {
                if (isEventHardwareEraser(e)) return;
                e.stopPropagation();
              }}
              style={{
                transform: `translate3d(${note.x}px, ${note.y}px, 0)`,
                width: `${note.width ?? 204}px`,
                backgroundColor: note.color || '#FEF08A',
                zIndex: 28,
              }}
              className="pointer-events-auto absolute top-0 left-0 flex flex-col overflow-hidden rounded-2xl border border-slate-900/15 text-slate-900 shadow-lg"
            >
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  stickyDragRef.current = {
                    pointerId: e.pointerId,
                    noteId: note.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    origX: note.x,
                    origY: note.y,
                  };
                  try {
                    containerRef.current?.setPointerCapture?.(e.pointerId);
                  } catch {
                    // Ignore
                  }
                }}
                className="flex cursor-grab items-center justify-between gap-1 bg-slate-900/8 px-2.5 py-1.5 active:cursor-grabbing"
              >
                <div className="flex items-center gap-1">
                  <Move className="h-3 w-3 opacity-60" />
                  <span className="text-[10px] font-black tracking-wide uppercase opacity-70">
                    Not
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {STICKY_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onUpdateStickyNote?.(note.id, { color: col })}
                      aria-label="Not Rengi"
                      className={`h-3.5 w-3.5 rounded-full border border-slate-900/25 ${
                        note.color === col ? 'scale-115 ring-1 ring-slate-900' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onDeleteStickyNote?.(note.id)}
                    aria-label="Notu Sil"
                    className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-md hover:bg-rose-500/20 hover:text-rose-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={note.text}
                onChange={(e) => onUpdateStickyNote?.(note.id, { text: e.target.value })}
                placeholder="Notunuzu buraya yazın..."
                className="allow-text-input min-h-[84px] w-full resize-y bg-transparent p-2.5 text-xs leading-relaxed font-semibold text-slate-900 placeholder:text-slate-600/70 outline-none"
              />
            </div>
          );
        })}

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
                  zIndex: isEditingThisLink ? 38 : 24,
                }}
                className="pointer-events-auto absolute top-0 left-0"
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
                      autoFocus={!kbSnap.isTouchDevice}
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
                    className="inline-flex items-center gap-1 rounded-full border bg-white/95 px-2.5 py-0.5 text-[10.5px] font-extrabold whitespace-nowrap shadow-xs hover:scale-105 dark:bg-slate-900/95"
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

        {/* Visible Nodes (Unified Zero-Blink DOM across Card & Organic Styles!) */}
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

          const showSecondaryMeta =
            !isEditing && (!isSemanticFarZoom || isRoot || isSelected);
          const stickerSizing = resolveStickerSizePixels(node.stickerSize, isRoot);
          const priorityMeta = node.priorityTag
            ? PRIORITY_BADGE_META[node.priorityTag]
            : null;
          const hasTaskCheck = typeof node.checked === 'boolean';
          const isTaskDone = node.checked === true;
          const cleanNote = node.note?.trim() ?? '';
          const isLongNote =
            cleanNote.length > 135 || cleanNote.split('\n').length > 3;
          const isUntitledRoot =
            isRoot &&
            (!node.title ||
              node.title.trim() === 'Yeni Zihin Haritası' ||
              node.title.trim() === 'Merkez Konu');

          // Compute unified Card vs Organic surface, border, and premium priority glow without unmounting DOM!
          let cardBackground: string;
          let cardBorderColor: string;
          let cardBoxShadow: string;

          if (priorityMeta) {
            cardBackground = darkMode ? priorityMeta.bgDark : priorityMeta.bgLight;
            cardBorderColor = isLinkSource ? '#8B5CF6' : priorityMeta.borderColor;
            cardBoxShadow = priorityMeta.haloShadow;
          } else if (isOrganic) {
            cardBackground =
              isSelected || isEditing
                ? darkMode
                  ? 'rgba(30,41,59,0.95)'
                  : 'rgba(255,255,255,0.96)'
                : darkMode
                ? 'rgba(15,20,29,0.90)'
                : 'rgba(250,249,245,0.92)';
            cardBorderColor = isLinkSource
              ? '#8B5CF6'
              : isSelected || isEditing
              ? `${node.branchColor}99`
              : 'transparent';
            cardBoxShadow =
              isSelected || isEditing
                ? `0 0 0 2px ${node.branchColor}55, 0 6px 16px rgba(15,23,42,0.10)`
                : 'none';
          } else {
            cardBackground = 'var(--node-pill-bg)';
            cardBorderColor = isLinkSource
              ? '#8B5CF6'
              : isEditing || isSelected
              ? node.branchColor
              : 'rgba(148,163,184,0.28)';
            cardBoxShadow = isEditing
              ? `0 0 0 3px ${node.branchColor}40, 0 10px 25px -5px rgba(15,23,42,0.18)`
              : isSelected
              ? `0 0 0 2.5px ${node.branchColor}55, 0 8px 20px -4px rgba(15,23,42,0.14)`
              : '0 4px 14px rgba(15, 23, 42, 0.08)';
          }

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
                zIndex: isEditing
                  ? 30
                  : isSelected
                  ? 22
                  : priorityMeta
                  ? 18
                  : isRoot
                  ? 15
                  : 10,
              }}
              className="mind-node-wrapper pointer-events-auto absolute top-0 left-0 flex flex-col items-center select-none"
            >
              {/* DIE-CUT VISUAL STICKER (Stable `node.sticker.id` key -> ZERO blink or remount on selection / Organic toggle!) */}
              {node.sticker && !hideVisualInExam && (
                <div
                  key={node.sticker.id}
                  data-testid="node-sticker-box"
                  data-sticker-size={stickerSizing.preset}
                  style={{
                    width: `${stickerSizing.px}px`,
                    height: `${stickerSizing.px}px`,
                    transition:
                      'width 180ms cubic-bezier(0.22, 1, 0.36, 1), height 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                  className="animate-sticker-pop absolute bottom-full left-1/2 mb-1.5 flex -translate-x-1/2 items-center justify-center"
                >
                  <img
                    src={node.sticker.url}
                    alt={node.title || 'Yeni Konu'}
                    decoding="async"
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

              {/* UNIFIED NODE PILL (Card & Organic share ONE stable DOM subtree -> Zero mount/unmount flicker!) */}
              {hideTextInExam ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-dashed border-violet-500/60 bg-violet-500/15 px-4 py-2 text-xs font-extrabold text-violet-700 shadow-sm backdrop-blur-xs dark:text-violet-200"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Terimi Hatırla • Dokun Aç</span>
                </button>
              ) : (
                <div
                  ref={(el) => bindNodeCardElement(node.id, el)}
                  data-node-card-id={node.id}
                  data-node-style={isOrganic ? 'organic' : 'card'}
                  data-priority-tag={node.priorityTag ?? undefined}
                  style={{
                    background: cardBackground,
                    borderColor: cardBorderColor,
                    borderWidth: priorityMeta ? '2.5px' : '2px',
                    boxShadow: cardBoxShadow,
                  }}
                  className={`relative flex flex-col items-center rounded-2xl border-solid text-center ${
                    isRoot
                      ? 'min-w-[180px] max-w-[316px] px-5 py-2.5'
                      : isOrganic && !priorityMeta
                      ? 'min-w-[118px] max-w-[308px] px-3.5 py-1.5'
                      : 'min-w-[124px] max-w-[312px] px-4 py-2'
                  } ${
                    linkingFromNodeId && !isLinkSource
                      ? 'hover:ring-2 hover:ring-violet-500'
                      : ''
                  }`}
                >
                  {/* Top Color Bar (Card mode) */}
                  {!isOrganic && !priorityMeta && (
                    <div
                      className="mb-1 h-1 w-8 rounded-full"
                      style={{ backgroundColor: node.branchColor }}
                    />
                  )}

                  {/* UNMISSABLE PREMIUM PRIORITY RIBBON (`🔥 ÖNEMLİ`, `🎓 SINAVDA ÇIKAR ⭐`, `❓ TEKRAR ET`) */}
                  {priorityMeta && (
                    <span
                      data-testid="node-priority-ribbon"
                      className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] leading-tight font-black tracking-wide whitespace-nowrap ${priorityMeta.ribbonCls}`}
                    >
                      <span>{priorityMeta.emoji}</span>
                      <span>{priorityMeta.label}</span>
                    </span>
                  )}

                  {isEditing &&
                  !kbSnap.isTouchDevice &&
                  !(
                    typeof document !== 'undefined' &&
                    document.activeElement?.closest('[data-testid="keyboard-visual-bar"]')
                  ) ? (
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
                      autoFocus={!kbSnap.isTouchDevice}
                      onFocus={(e) => {
                        if (window.scrollY !== 0) window.scrollTo(0, 0);
                        e.currentTarget.select();
                      }}
                      placeholder="Dal adını yazın..."
                      className={`allow-text-input max-w-full min-w-[136px] bg-transparent text-center font-extrabold outline-none ${
                        isRoot ? 'text-base sm:text-lg' : 'text-base'
                      }`}
                      style={{
                        color: 'var(--node-text)',
                        width: `${Math.min(28, Math.max(13, (node.title || '').length + 2))}ch`,
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      {hasTaskCheck && examMode === 'off' && (
                        <button
                          type="button"
                          data-testid="node-checkbox-btn"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            void hapticSuccess();
                            onToggleNodeCheck?.(node.id);
                          }}
                          title={isTaskDone ? 'Tamamlandı (Geri al)' : 'Tamamlandı olarak işaretle'}
                          style={{
                            borderColor: isTaskDone ? '#10B981' : node.branchColor,
                            backgroundColor: isTaskDone ? '#10B981' : 'transparent',
                          }}
                          className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border-2 text-white transition active:scale-90"
                        >
                          {isTaskDone && <Check className="h-3 w-3 stroke-[3]" />}
                        </button>
                      )}

                      <div
                        className={`node-title-balanced leading-snug ${
                          isOrganic
                            ? 'text-[14px] font-black tracking-tight sm:text-[15px]'
                            : isRoot
                            ? 'text-base font-extrabold sm:text-lg'
                            : 'text-[13.5px] font-extrabold sm:text-sm'
                        } ${isTaskDone ? 'line-through opacity-65' : ''}`}
                        style={{
                          color: 'var(--node-text)',
                          textShadow:
                            isOrganic && !priorityMeta
                              ? darkMode
                                ? '0 1px 6px rgba(15,23,42,0.95)'
                                : '0 1px 5px rgba(255,255,255,0.98), 0 0 2px rgba(255,255,255,0.95)'
                              : undefined,
                        }}
                      >
                        {node.title || 'Yeni Konu'}
                      </div>
                    </div>
                  )}

                  {/* Organic Bottom Accent Underline */}
                  {isOrganic && (
                    <div
                      className="mt-1 h-1 w-12 rounded-full opacity-90"
                      style={{
                        backgroundColor: priorityMeta
                          ? priorityMeta.borderColor
                          : node.branchColor,
                      }}
                    />
                  )}

                  {isUntitledRoot && !isSelected && !isEditing && examMode === 'off' && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[10px] font-extrabold text-sky-600 dark:text-sky-300">
                      <Pencil className="h-2.5 w-2.5" />
                      <span>Dokun: Ağaç İsmi & İkon Seç</span>
                    </span>
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
                        backgroundColor: isOrganic
                          ? darkMode
                            ? 'rgba(15,23,42,0.75)'
                            : 'rgba(255,255,255,0.88)'
                          : `${node.branchColor}18`,
                      }}
                      className="mt-1 inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight"
                    >
                      {node.techBadge}
                    </span>
                  )}

                  {showSecondaryMeta && node.linkUrl && /^https?:\/\//i.test(node.linkUrl) && (
                    <a
                      href={node.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="node-link-badge"
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => ev.stopPropagation()}
                      className="mt-1 inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-sky-500/35 bg-sky-500/12 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                    >
                      <span>🔗</span>
                      <span className="truncate">
                        {(() => {
                          try {
                            return new URL(node.linkUrl).hostname.replace(/^www\./, '');
                          } catch {
                            return 'Kaynak';
                          }
                        })()}
                      </span>
                    </a>
                  )}

                  {/* RESPONSIVE MULTI-LINE BRANCH DESCRIPTION (`node.note`) — stays live-visible even while editing so users see their description immediately! */}
                  {(showSecondaryMeta || isEditing) && cleanNote.length > 0 && (
                    <div
                      data-testid="node-note-block"
                      style={{
                        borderColor: priorityMeta
                          ? `${priorityMeta.borderColor}48`
                          : `${node.branchColor}38`,
                        backgroundColor: darkMode
                          ? 'rgba(15,23,42,0.62)'
                          : 'rgba(248,250,252,0.94)',
                      }}
                      className="mt-1.5 w-full min-w-[200px] max-w-[280px] rounded-xl border px-3 py-2 text-left sm:min-w-[240px]"
                    >
                      <p
                        style={{ color: 'var(--node-subtext)' }}
                        className={`text-[11.5px] leading-relaxed font-medium break-words whitespace-pre-wrap ${
                          node.noteCollapsed ? 'line-clamp-2' : ''
                        }`}
                      >
                        {cleanNote}
                      </p>
                      {isLongNote && onToggleNoteCollapse && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            void hapticLight();
                            onToggleNoteCollapse(node.id);
                          }}
                          className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-extrabold text-sky-600 hover:underline dark:text-sky-400"
                        >
                          <ChevronDown
                            className={`h-3 w-3 transition-transform ${
                              node.noteCollapsed ? '' : 'rotate-180'
                            }`}
                          />
                          <span>{node.noteCollapsed ? 'Devamını Gör' : 'Daralt'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* DRAG-TO-BRANCH & SINGLE-TAP `+` HANDLES (44x44 HIG Hit-Slop) */}
                  {examMode === 'off' && !linkingFromNodeId && isRoot && (
                    <>
                      <button
                        type="button"
                        onPointerDown={(e) => startBranchHandlePointerDown(e, node, 1)}
                        title="Sağa ana dal ekle"
                        className="hit-slop-44 absolute top-1/2 -right-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow-md hover:scale-115 active:scale-95"
                      >
                        <Plus className="h-4 w-4 stroke-[2.8]" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => startBranchHandlePointerDown(e, node, -1)}
                        title="Sola ana dal ekle"
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
                      title="Alt Dal Ekle"
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

                  {examMode === 'off' &&
                    !linkingFromNodeId &&
                    !isRoot &&
                    (isSelected || isEditing) &&
                    onDeleteNode && (
                      <button
                        type="button"
                        data-testid="node-quick-delete-btn"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          void hapticMedium();
                          onDeleteNode(node.id);
                        }}
                        title="Bu dalı sil"
                        aria-label="Dalı sil"
                        className={`hit-slop-44 absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow-md transition hover:scale-115 active:scale-95 ${
                          outwardRight ? '-left-3.5' : '-right-3.5'
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5 stroke-[2.5]" />
                      </button>
                    )}

                  {liftingNodeId === node.id && (
                    <span className="pointer-events-none absolute -top-7 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-white shadow-md">
                      <Move className="h-2.5 w-2.5" />
                      Taşınıyor
                    </span>
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
                          : 'Alt dalları katla'
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

              {/* FLOATING CONTEXTUAL NODE QUICK-ACTION PILL (Hidden on phones to prevent Photo-4 edge overflow & duplicate controls!) */}
              {isSelected &&
                !isEditing &&
                !drawingMode &&
                !linkingFromNodeId &&
                examMode === 'off' &&
                !kbSnap.isPhone &&
                !kbSnap.isKeyboardOpen && (
                  <div
                    data-testid="node-floating-actions"
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      backgroundColor: 'var(--hud-bg)',
                      borderColor: 'var(--hud-border)',
                    }}
                    className="absolute top-full left-1/2 z-30 mt-3.5 flex -translate-x-1/2 items-center gap-1 rounded-2xl border px-1.5 py-1 text-[10.5px] font-extrabold whitespace-nowrap shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void hapticLight();
                        onStartEditing(node.id);
                      }}
                      className="inline-flex min-h-[30px] items-center gap-1 rounded-xl bg-sky-500/15 px-2.5 py-1 text-sky-700 hover:bg-sky-500/25 active:scale-95 dark:text-sky-300"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>{isRoot ? 'Ağaç İsmi' : 'Düzenle'}</span>
                    </button>

                    {onOpenStickerGallery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void hapticLight();
                          onOpenStickerGallery(node.id);
                        }}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-xl bg-violet-500/15 px-2.5 py-1 text-violet-700 hover:bg-violet-500/25 active:scale-95 dark:text-violet-300"
                      >
                        <ImageIcon className="h-3 w-3" />
                        <span>İkon / Foto</span>
                      </button>
                    )}

                    {onCyclePriorityTag && (
                      <button
                        type="button"
                        data-testid="node-quick-priority-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void hapticSuccess();
                          onCyclePriorityTag(node.id);
                        }}
                        className={`inline-flex min-h-[30px] items-center gap-1 rounded-xl px-2.5 py-1 active:scale-95 ${
                          priorityMeta
                            ? priorityMeta.ribbonCls
                            : 'bg-rose-500/14 text-rose-700 hover:bg-rose-500/24 dark:text-rose-300'
                        }`}
                      >
                        {!priorityMeta && <Flame className="h-3 w-3 text-rose-500" />}
                        <span>
                          {priorityMeta ? priorityMeta.shortBtnLabel : 'Önemli'}
                        </span>
                      </button>
                    )}

                    {onStartCrossLink && Object.keys(nodes).length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void hapticLight();
                          onStartCrossLink(node.id);
                        }}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-xl bg-indigo-500/15 px-2 py-1 text-indigo-700 hover:bg-indigo-500/25 active:scale-95 dark:text-indigo-300"
                      >
                        <Link2 className="h-3 w-3" />
                        <span>Bağlantı</span>
                      </button>
                    )}

                    {onToggleNodeCheck && !isRoot && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void hapticLight();
                          onToggleNodeCheck(node.id);
                        }}
                        className={`inline-flex min-h-[30px] items-center gap-1 rounded-xl px-2 py-1 active:scale-95 ${
                          hasTaskCheck
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/22 dark:text-emerald-300'
                        }`}
                      >
                        <CheckSquare className="h-3 w-3" />
                        <span>Görev</span>
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

      {/* Layer 2: Lightweight On-Demand Interactive Preview Canvas (1x1 when idle/panning; active ONLY during `+` spring drag or `🔗` target picking) */}
      <canvas
        ref={canvasRef}
        width={1}
        height={1}
        style={{ opacity: 0 }}
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  );
});
