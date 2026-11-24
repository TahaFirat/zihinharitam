import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Code2,
  Copy,
  Database,
  Diamond,
  FileText,
  GitBranch,
  Grid3X3,
  Link2,
  Maximize2,
  Moon,
  Palette,
  Plus,
  Redo2,
  Settings,
  Share2,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
  Workflow,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  FlowchartData,
  FlowchartNode,
  FlowchartPort,
  FlowchartShapeType,
  MindMapDocument,
  PaperStyleType,
  ViewportTransform,
} from '../types/mindmap';
import {
  buildFlowchartEdgePath,
  computeFlowchartAutoLayout,
  computeFlowchartBounds,
  getPortCoords,
  parseMermaidToFlowchart,
} from '../data/flowchartTemplates';
import {
  applyStudioThemeToDocument,
  STUDIO_THEMES,
} from '../core/theme/StudioThemes';
import { useI18n } from '../core/i18n/i18n';
import { hapticLight, hapticMedium, hapticSuccess } from '../core/native/NativeBridge';

interface FlowchartWorkspaceProps {
  doc: MindMapDocument;
  darkMode: boolean;
  onChangeDoc: (
    updater: (prev: MindMapDocument) => MindMapDocument,
    recordHistory?: boolean
  ) => void;
  onNavigateHome: () => void;
  onToggleDarkMode: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const FLOW_COLORS = [
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#F43F5E',
  '#EC4899',
  '#64748B',
] as const;

const SHAPE_META: Array<{
  shape: FlowchartShapeType;
  labelTr: string;
  labelEn: string;
  defaultW: number;
  defaultH: number;
  defaultColor: string;
}> = [
  { shape: 'start_end', labelTr: 'Başla/Bitir', labelEn: 'Start/End', defaultW: 176, defaultH: 64, defaultColor: '#10B981' },
  { shape: 'process', labelTr: 'İşlem', labelEn: 'Process', defaultW: 200, defaultH: 74, defaultColor: '#0EA5E9' },
  { shape: 'decision', labelTr: 'Karar ◇', labelEn: 'Decision ◇', defaultW: 184, defaultH: 110, defaultColor: '#F59E0B' },
  { shape: 'io', labelTr: 'Veri ▱', labelEn: 'Data ▱', defaultW: 204, defaultH: 70, defaultColor: '#8B5CF6' },
  { shape: 'database', labelTr: 'Veritabanı', labelEn: 'Database', defaultW: 192, defaultH: 80, defaultColor: '#0284C7' },
  { shape: 'document', labelTr: 'Doküman', labelEn: 'Document', defaultW: 198, defaultH: 76, defaultColor: '#EC4899' },
];

const QUICK_EDGE_LABELS_TR = ['Evet', 'Hayır', 'Başarılı', 'Hata', 'Tekrar'];
const QUICK_EDGE_LABELS_EN = ['Yes', 'No', 'Success', 'Error', 'Retry'];
const BLOCK_EMOJIS = ['⚡', '🔐', '🗄️', '✅', '⚠️', '🫀', '🚀', '📊', '🌐', '📄', '🤖', '💳'] as const;
const SAMPLE_MERMAID = `flowchart TD
  A([Başla: İstek Al]) --> B[Doğrulama Yap]
  B --> C{Geçerli mi?}
  C -->|Evet| D[(Veritabanına Kaydet)]
  C -->|Hayır| E[Hata Mesajı Döndür]
  D --> F([Tamamlandı])`;

function snap16(v: number): number {
  return Math.round(v / 16) * 16;
}

function renderNodeSvgShape(
  node: FlowchartNode,
  cardBg: string,
  isSelected: boolean,
  isConnectTarget: boolean
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const strokeW = isSelected ? 3.2 : isConnectTarget ? 3 : 2.3;
  const stroke = isConnectTarget ? '#10B981' : node.color;

  if (node.shape === 'start_end') {
    return (
      <rect
        x={2}
        y={2}
        width={w - 4}
        height={h - 4}
        rx={(h - 4) / 2}
        fill={cardBg}
        stroke={stroke}
        strokeWidth={strokeW}
      />
    );
  }
  if (node.shape === 'decision') {
    const pts = `${w / 2},3 ${w - 3},${h / 2} ${w / 2},${h - 3} 3,${h / 2}`;
    return (
      <polygon
        points={pts}
        fill={cardBg}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
    );
  }
  if (node.shape === 'io') {
    const skew = 18;
    const pts = `${skew},3 ${w - 3},3 ${w - skew},${h - 3} 3,${h - 3}`;
    return (
      <polygon
        points={pts}
        fill={cardBg}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
    );
  }
  if (node.shape === 'database') {
    const ry = 11;
    const rx = (w - 6) / 2;
    const bodyD = `M 3 ${3 + ry} V ${h - 3 - ry} A ${rx} ${ry} 0 0 0 ${w - 3} ${h - 3 - ry} V ${3 + ry} Z`;
    return (
      <>
        <path d={bodyD} fill={cardBg} stroke={stroke} strokeWidth={strokeW} />
        <ellipse
          cx={w / 2}
          cy={3 + ry}
          rx={rx}
          ry={ry}
          fill={cardBg}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      </>
    );
  }
  if (node.shape === 'document') {
    const waveY = h - 11;
    const d = `M 14 3 H ${w - 14} Q ${w - 3} 3 ${w - 3} 14 V ${waveY} Q ${w * 0.75} ${waveY - 13} ${w / 2} ${waveY} T 3 ${waveY} V 14 Q 3 3 14 3 Z`;
    return <path d={d} fill={cardBg} stroke={stroke} strokeWidth={strokeW} />;
  }
  return (
    <rect
      x={2}
      y={2}
      width={w - 4}
      height={h - 4}
      rx={16}
      fill={cardBg}
      stroke={stroke}
      strokeWidth={strokeW}
    />
  );
}

export const FlowchartWorkspace: React.FC<FlowchartWorkspaceProps> = ({
  doc,
  darkMode,
  onChangeDoc,
  onNavigateHome,
  onToggleDarkMode,
  onOpenExport,
  onOpenSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const { t, isEn } = useI18n();
  const fc: FlowchartData = useMemo(
    () => doc.flowchart ?? { nodes: [], edges: [], direction: 'TB' },
    [doc.flowchart]
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, scale: 0.92 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    port: FlowchartPort;
  } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);
  const [mermaidDraft, setMermaidDraft] = useState('');

  // Drag state (pan or node drag)
  const dragRef = useRef<{
    kind: 'pan' | 'node';
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    nodeId?: string;
    moved: boolean;
  } | null>(null);
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; scale: number; midX: number; midY: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    setTitleDraft(doc.title);
  }, [doc.title]);

  const updateFlowchart = useCallback(
    (updater: (prev: FlowchartData) => FlowchartData, recordHistory = true) => {
      onChangeDoc((prev) => {
        const current = prev.flowchart ?? { nodes: [], edges: [], direction: 'TB' };
        const nextFc = updater(current);
        const rootNode = prev.nodes[prev.rootNodeId];
        return {
          ...prev,
          flowchart: nextFc,
          nodes: rootNode
            ? {
                ...prev.nodes,
                [prev.rootNodeId]: {
                  ...rootNode,
                  subtitle: `${nextFc.nodes.length} blok • ${nextFc.edges.length} bağlantı`,
                },
              }
            : prev.nodes,
        };
      }, recordHistory);
    },
    [onChangeDoc]
  );

  const fitToScreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const bounds = computeFlowchartBounds(fc);
    const worldW = Math.max(260, bounds.maxX - bounds.minX);
    const worldH = Math.max(220, bounds.maxY - bounds.minY);
    const usableW = Math.max(220, rect.width - 48);
    const usableH = Math.max(220, rect.height - 190);
    const scale = Math.max(0.32, Math.min(1.18, Math.min(usableW / worldW, usableH / worldH)));
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    setViewport({
      scale,
      x: rect.width / 2 - cx * scale,
      y: rect.height / 2 - 24 - cy * scale,
    });
  }, [fc]);

  // Auto-fit when opening a flowchart document
  useEffect(() => {
    const id = window.setTimeout(() => fitToScreen(), 40);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const cur = viewportRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      const nextScale = Math.max(0.22, Math.min(2.6, cur.scale * factor));
      const worldX = (px - cur.x) / cur.scale;
      const worldY = (py - cur.y) / cur.scale;
      setViewport({
        scale: nextScale,
        x: px - worldX * nextScale,
        y: py - worldY * nextScale,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const nodeMap = useMemo(() => new Map(fc.nodes.map((n) => [n.id, n])), [fc.nodes]);
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? fc.edges.find((e) => e.id === selectedEdgeId) ?? null : null;

  const addShapeNode = useCallback(
    (shape: FlowchartShapeType, customLabel?: string, edgeLabel?: string, offsetDx = 0) => {
      const meta = SHAPE_META.find((m) => m.shape === shape) ?? SHAPE_META[1];
      const newId = `fn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const dir = fc.direction ?? 'TB';
      const anchor = selectedNode ?? fc.nodes[fc.nodes.length - 1] ?? null;

      let x = 0;
      let y = 0;
      if (anchor) {
        if (dir === 'TB') {
          x = snap16(anchor.x + offsetDx);
          y = snap16(anchor.y + 148);
        } else {
          x = snap16(anchor.x + 256);
          y = snap16(anchor.y + offsetDx);
        }
      }

      const defaultTitle =
        customLabel ||
        (shape === 'start_end'
          ? t('Başla / Bitir', 'Start / End')
          : shape === 'decision'
          ? t('Koşul Doğru mu?', 'Condition Met?')
          : shape === 'io'
          ? t('Veri Girdisi', 'Data Input')
          : shape === 'database'
          ? t('Veritabanı', 'Database')
          : shape === 'document'
          ? t('Rapor / Belge', 'Report / Doc')
          : t('Yeni İşlem', 'New Process'));

      const newNode: FlowchartNode = {
        id: newId,
        shape,
        title: defaultTitle,
        x,
        y,
        width: meta.defaultW,
        height: meta.defaultH,
        color: meta.defaultColor,
      };

      updateFlowchart((prev) => {
        const nextEdges = [...prev.edges];
        if (selectedNode) {
          const fromPort: FlowchartPort =
            dir === 'TB'
              ? offsetDx > 40
                ? 'right'
                : offsetDx < -40
                ? 'left'
                : 'bottom'
              : 'right';
          const toPort: FlowchartPort = dir === 'TB' ? 'top' : 'left';
          nextEdges.push({
            id: `fe_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            fromNodeId: selectedNode.id,
            fromPort,
            toNodeId: newId,
            toPort,
            label: edgeLabel,
            color:
              edgeLabel === 'Evet' || edgeLabel === 'Yes'
                ? '#10B981'
                : edgeLabel === 'Hayır' || edgeLabel === 'No'
                ? '#F43F5E'
                : '#64748B',
            style: 'solid',
            routing: 'orthogonal',
          });
        }
        return { ...prev, nodes: [...prev.nodes, newNode], edges: nextEdges };
      });
      setSelectedNodeId(newId);
      setSelectedEdgeId(null);
      void hapticLight();
    },
    [fc.direction, fc.nodes, selectedNode, t, updateFlowchart]
  );

  const handleAddYesNoBranches = useCallback(() => {
    if (!selectedNode) return;
    const baseTs = Date.now();
    const yesId = `fn_yes_${baseTs}`;
    const noId = `fn_no_${baseTs + 1}`;
    const yesNode: FlowchartNode = {
      id: yesId,
      shape: 'process',
      title: t('Onay Akışı', 'Approved Path'),
      x: snap16(selectedNode.x + 192),
      y: snap16(selectedNode.y + 152),
      width: 192,
      height: 72,
      color: '#10B981',
    };
    const noNode: FlowchartNode = {
      id: noId,
      shape: 'process',
      title: t('Alternatif Akış', 'Fallback Path'),
      x: snap16(selectedNode.x - 192),
      y: snap16(selectedNode.y + 152),
      width: 192,
      height: 72,
      color: '#F43F5E',
    };
    updateFlowchart((prev) => ({
      ...prev,
      nodes: [...prev.nodes, yesNode, noNode],
      edges: [
        ...prev.edges,
        {
          id: `fe_yes_${baseTs}`,
          fromNodeId: selectedNode.id,
          fromPort: 'right',
          toNodeId: yesId,
          toPort: 'top',
          label: t('Evet', 'Yes'),
          color: '#10B981',
          style: 'solid',
          routing: 'orthogonal',
        },
        {
          id: `fe_no_${baseTs + 1}`,
          fromNodeId: selectedNode.id,
          fromPort: 'left',
          toNodeId: noId,
          toPort: 'top',
          label: t('Hayır', 'No'),
          color: '#F43F5E',
          style: 'solid',
          routing: 'orthogonal',
        },
      ],
    }));
    void hapticSuccess();
  }, [selectedNode, t, updateFlowchart]);

  const completeConnectionTo = useCallback(
    (targetNodeId: string, preferredPort?: FlowchartPort) => {
      if (!connectingFrom || connectingFrom.nodeId === targetNodeId) {
        setConnectingFrom(null);
        return;
      }
      const fromN = nodeMap.get(connectingFrom.nodeId);
      const toN = nodeMap.get(targetNodeId);
      if (!fromN || !toN) {
        setConnectingFrom(null);
        return;
      }
      let toPort: FlowchartPort = preferredPort ?? 'top';
      if (!preferredPort) {
        const dx = toN.x - fromN.x;
        const dy = toN.y - fromN.y;
        if (Math.abs(dy) >= Math.abs(dx)) {
          toPort = dy >= 0 ? 'top' : 'bottom';
        } else {
          toPort = dx >= 0 ? 'left' : 'right';
        }
      }
      const edgeId = `fe_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      updateFlowchart((prev) => ({
        ...prev,
        edges: [
          ...prev.edges,
          {
            id: edgeId,
            fromNodeId: connectingFrom.nodeId,
            fromPort: connectingFrom.port,
            toNodeId: targetNodeId,
            toPort,
            color: '#64748B',
            style: 'solid',
            routing: 'orthogonal',
          },
        ],
      }));
      setConnectingFrom(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(edgeId);
      void hapticSuccess();
    },
    [connectingFrom, nodeMap, updateFlowchart]
  );

  const handleAutoTidy = useCallback(
    (dir: 'TB' | 'LR') => {
      updateFlowchart((prev) => computeFlowchartAutoLayout(prev, dir));
      void hapticMedium();
      window.setTimeout(() => fitToScreen(), 60);
    },
    [fitToScreen, updateFlowchart]
  );

  const cyclePaperStyle = useCallback(() => {
    const order: PaperStyleType[] = ['grid', 'dots', 'blank', 'warm'];
    onChangeDoc((prev) => {
      const idx = order.indexOf(prev.paperStyle ?? 'grid');
      return { ...prev, paperStyle: order[(idx + 1) % order.length] };
    });
    void hapticLight();
  }, [onChangeDoc]);

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeTouchesRef.current.size === 2) {
      const pts = Array.from(activeTouchesRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = stageRef.current?.getBoundingClientRect();
      pinchStartRef.current = {
        dist: Math.max(10, dist),
        scale: viewportRef.current.scale,
        midX: (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0),
        midY: (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0),
        vx: viewportRef.current.x,
        vy: viewportRef.current.y,
      };
      dragRef.current = null;
      return;
    }
    if ((e.target as HTMLElement).closest('[data-fc-interactive="1"]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'pan',
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: viewportRef.current.x,
      origY: viewportRef.current.y,
      moved: false,
    };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (activeTouchesRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activeTouchesRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const p0 = pinchStartRef.current;
      const nextScale = Math.max(0.24, Math.min(2.5, p0.scale * (dist / p0.dist)));
      const worldX = (p0.midX - p0.vx) / p0.scale;
      const worldY = (p0.midY - p0.vy) / p0.scale;
      setViewport({
        scale: nextScale,
        x: p0.midX - worldX * nextScale,
        y: p0.midY - worldY * nextScale,
      });
      return;
    }

    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    const crossedThreshold = !d.moved && Math.hypot(dx, dy) > 4;
    if (crossedThreshold) d.moved = true;

    if (d.kind === 'pan') {
      setViewport((cur) => ({ ...cur, x: d.origX + dx, y: d.origY + dy }));
    } else if (d.kind === 'node' && d.nodeId && d.moved) {
      const scale = viewportRef.current.scale;
      const nx = snap16(d.origX + dx / scale);
      const ny = snap16(d.origY + dy / scale);
      const targetId = d.nodeId;
      updateFlowchart(
        (prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === targetId ? { ...n, x: nx, y: ny } : n)),
        }),
        crossedThreshold
      );
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activeTouchesRef.current.delete(e.pointerId);
    if (activeTouchesRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      if (d.kind === 'pan' && !d.moved) {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectingFrom(null);
      }
      dragRef.current = null;
    }
  };

  const paperStyle = doc.paperStyle ?? 'grid';
  const stageBgStyle: React.CSSProperties = useMemo(() => {
    const gridPx = Math.max(12, Math.round(24 * viewport.scale));
    const bgPos = `${Math.round(viewport.x)}px ${Math.round(viewport.y)}px`;
    const baseBg =
      paperStyle === 'warm'
        ? darkMode
          ? '#1A1814'
          : '#FBF6E8'
        : darkMode
        ? '#0B1220'
        : '#F8FAFC';

    if (paperStyle === 'grid') {
      const line = darkMode ? 'rgba(148,163,184,0.11)' : 'rgba(15,23,42,0.07)';
      return {
        backgroundColor: baseBg,
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: `${gridPx}px ${gridPx}px`,
        backgroundPosition: bgPos,
      };
    }
    if (paperStyle === 'dots') {
      const dot = darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.15)';
      return {
        backgroundColor: baseBg,
        backgroundImage: `radial-gradient(${dot} 1.4px, transparent 1.4px)`,
        backgroundSize: `${gridPx}px ${gridPx}px`,
        backgroundPosition: bgPos,
      };
    }
    return { backgroundColor: baseBg };
  }, [darkMode, paperStyle, viewport.scale, viewport.x, viewport.y]);

  const cardFill = darkMode ? '#1E293B' : '#FFFFFF';
  const edgeLabels = isEn ? QUICK_EDGE_LABELS_EN : QUICK_EDGE_LABELS_TR;

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      data-testid="flowchart-workspace"
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Top Minimal Flowchart HUD */}
      <header
        className="pointer-events-none fixed top-0 right-0 left-0 z-30 flex items-center justify-between gap-2 px-2.5 sm:px-4"
        style={{ paddingTop: 'max(10px, calc(var(--safe-top) + 6px))' }}
      >
        <div
          className="pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-2xl border px-2 py-1.5 shadow-sm backdrop-blur-md"
          style={{ backgroundColor: 'var(--hud-bg)', borderColor: 'var(--hud-border)' }}
        >
          <button
            type="button"
            onClick={() => {
              void hapticLight();
              onNavigateHome();
            }}
            data-testid="fc-home-btn"
            aria-label={t('Ana Sayfa', 'Home')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition hover:bg-slate-500/10 active:scale-95"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          <span className="hidden items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-0.5 text-[11px] font-extrabold text-sky-600 sm:inline-flex dark:text-sky-300">
            <Workflow className="h-3.5 w-3.5" />
            {t('Akış Diyagramı', 'Flowchart')}
          </span>

          {editingTitle ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = titleDraft.trim() || doc.title;
                onChangeDoc((prev) => ({ ...prev, title: clean }));
                setEditingTitle(false);
              }}
            >
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  const clean = titleDraft.trim() || doc.title;
                  onChangeDoc((prev) => ({ ...prev, title: clean }));
                  setEditingTitle(false);
                }}
                className="allow-text-input w-36 rounded-lg border px-2 py-1 text-xs font-extrabold outline-none focus:ring-2 focus:ring-sky-500 sm:w-52"
                style={{ borderColor: 'var(--hud-border)', backgroundColor: 'var(--canvas-bg)' }}
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="max-w-[140px] truncate rounded-lg px-1.5 py-1 text-left text-xs font-extrabold hover:bg-slate-500/10 sm:max-w-[220px] sm:text-[13px]"
            >
              {doc.title}
            </button>
          )}
        </div>

        {/* Right Controls */}
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-2xl border px-1.5 py-1.5 shadow-sm backdrop-blur-md"
          style={{ backgroundColor: 'var(--hud-bg)', borderColor: 'var(--hud-border)' }}
        >
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title={t('Geri Al', 'Undo')}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-500/10 disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title={t('İleri Al', 'Redo')}
            className="hidden h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-500/10 disabled:opacity-35 sm:flex"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => handleAutoTidy(fc.direction === 'LR' ? 'TB' : 'LR')}
            data-testid="fc-auto-layout-btn"
            title={t('Otomatik Hizala (Dikey/Yatay)', 'Auto-Layout (Vertical/Horizontal)')}
            className="flex h-9 items-center gap-1 rounded-xl bg-sky-500/12 px-2.5 text-xs font-extrabold text-sky-600 transition hover:bg-sky-500/20 active:scale-95 dark:text-sky-300"
          >
            {fc.direction === 'LR' ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            <span className="hidden md:inline">
              {fc.direction === 'LR' ? t('Dikey', 'Vertical') : t('Yatay', 'Horizontal')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMermaidDraft(SAMPLE_MERMAID);
              setMermaidModalOpen(true);
            }}
            data-testid="fc-mermaid-import-btn"
            title={t('Mermaid Kodundan Akış Diyagramı Kur', 'Import from Mermaid Code')}
            className="flex h-9 items-center gap-1 rounded-xl bg-violet-500/12 px-2.5 text-xs font-extrabold text-violet-600 transition hover:bg-violet-500/20 active:scale-95 dark:text-violet-300"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Mermaid</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const curIdx = STUDIO_THEMES.findIndex((th) => th.id === doc.colorTheme);
              const nextTheme = STUDIO_THEMES[(curIdx + 1) % STUDIO_THEMES.length];
              onChangeDoc((prev) => applyStudioThemeToDocument(prev, nextTheme.id));
              void hapticLight();
            }}
            data-testid="fc-theme-cycle-btn"
            title={t('Renk Paleti Değiştir', 'Cycle Studio Palette')}
            className="hidden h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-500/10 sm:flex"
          >
            <Palette className="h-4 w-4 text-amber-500" />
          </button>

          <button
            type="button"
            onClick={cyclePaperStyle}
            title={t('Kağıt Deseni', 'Canvas Grid')}
            className="hidden h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-500/10 sm:flex"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            title={t('Tema', 'Theme')}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-500/10"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title={t('Ayarlar', 'Settings')}
            className="hidden h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-500/10 sm:flex"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenExport}
            data-testid="fc-export-btn"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-extrabold text-white shadow-xs transition active:scale-95 dark:bg-sky-500 dark:text-slate-950"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('Dışa Aktar', 'Export')}</span>
          </button>
        </div>
      </header>

      {/* Active Connect Mode Banner */}
      {connectingFrom && (
        <div
          className="fixed top-[68px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-lg"
          data-testid="fc-connect-banner"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>{t('Bağlamak istediğin hedef bloğa dokun', 'Tap a target block to connect')}</span>
          <button
            type="button"
            onClick={() => setConnectingFrom(null)}
            className="ml-1 rounded-full bg-white/20 p-0.5 hover:bg-white/30"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Interactive 120Hz Infinite Flowchart Canvas */}
      <div
        ref={stageRef}
        className="h-full w-full touch-none"
        style={stageBgStyle}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
      >
        <div
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            transformOrigin: '0 0',
            width: 0,
            height: 0,
            position: 'relative',
          }}
        >
          {/* SVG Directed Edges Layer */}
          <svg
            className="overflow-visible"
            style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, pointerEvents: 'none' }}
          >
            <defs>
              <marker
                id="fc-live-arrow"
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="6.8"
                markerHeight="6.8"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" />
              </marker>
            </defs>
            {fc.edges.map((edge) => {
              const a = nodeMap.get(edge.fromNodeId);
              const b = nodeMap.get(edge.toNodeId);
              if (!a || !b) return null;
              const { d, labelX, labelY } = buildFlowchartEdgePath(a, b, edge);
              const isSel = selectedEdgeId === edge.id;
              const stroke = isSel ? '#0EA5E9' : edge.color || '#64748B';
              return (
                <g key={edge.id} style={{ pointerEvents: 'auto' }}>
                  {/* Fat invisible hit target for easy mobile tap */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    className="cursor-pointer"
                    data-fc-interactive="1"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                      void hapticLight();
                    }}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isSel ? 3.5 : 2.5}
                    strokeLinecap="round"
                    strokeDasharray={edge.style === 'dashed' ? '7 5' : undefined}
                    markerEnd="url(#fc-live-arrow)"
                    style={{ pointerEvents: 'none' }}
                  />
                  {edge.label?.trim() && (
                    <g
                      transform={`translate(${labelX}, ${labelY})`}
                      className="cursor-pointer"
                      data-fc-interactive="1"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    >
                      <rect
                        x={-Math.max(24, edge.label.length * 4 + 10)}
                        y={-12}
                        width={Math.max(48, edge.label.length * 8 + 20)}
                        height={24}
                        rx={12}
                        fill={cardFill}
                        stroke={stroke}
                        strokeWidth={1.6}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fontSize={11.5}
                        fontWeight={800}
                        fill={darkMode ? '#F8FAFC' : '#0F172A'}
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Flowchart Block Nodes Layer */}
          {fc.nodes.map((node) => {
            const isSel = selectedNodeId === node.id;
            const isConnectTarget = Boolean(connectingFrom && connectingFrom.nodeId !== node.id);
            const ports: FlowchartPort[] = ['top', 'right', 'bottom', 'left'];

            return (
              <div
                key={node.id}
                data-fc-interactive="1"
                data-testid={`fc-node-${node.id}`}
                style={{
                  position: 'absolute',
                  left: node.x - node.width / 2,
                  top: node.y - node.height / 2,
                  width: node.width,
                  height: node.height,
                  zIndex: isSel ? 20 : 10,
                }}
                className="group cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (connectingFrom) {
                    completeConnectionTo(node.id);
                    return;
                  }
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                  stageRef.current?.setPointerCapture(e.pointerId);
                  dragRef.current = {
                    kind: 'node',
                    pointerId: e.pointerId,
                    nodeId: node.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    origX: node.x,
                    origY: node.y,
                    moved: false,
                  };
                }}
              >
                <svg
                  width={node.width}
                  height={node.height}
                  className="pointer-events-none block overflow-visible drop-shadow-sm"
                >
                  {renderNodeSvgShape(node, cardFill, isSel, isConnectTarget)}
                </svg>

                {/* Crisp Centered Title + Subtitle */}
                <div
                  className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center ${
                    node.shape === 'decision'
                      ? 'px-7 py-4'
                      : node.shape === 'database'
                      ? 'px-4 pt-5 pb-2'
                      : 'px-4 py-2'
                  }`}
                >
                  <div className="line-clamp-2 text-[13px] leading-tight font-extrabold">
                    {node.emoji ? `${node.emoji} ` : ''}
                    {node.title}
                  </div>
                  {node.subtitle && node.shape !== 'decision' && (
                    <div
                      className="mt-0.5 line-clamp-1 text-[10.5px] font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {node.subtitle}
                    </div>
                  )}
                </div>

                {/* 4 Interactive Connector Ports when selected or in connect mode */}
                {(isSel || isConnectTarget) &&
                  ports.map((port) => {
                    const p = getPortCoords(node, port);
                    const relX = p.x - (node.x - node.width / 2);
                    const relY = p.y - (node.y - node.height / 2);
                    return (
                      <button
                        key={port}
                        type="button"
                        data-fc-interactive="1"
                        data-testid={`fc-port-${node.id}-${port}`}
                        title={t('Bağlantı çek', 'Connect from port')}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          if (connectingFrom) {
                            completeConnectionTo(node.id, port);
                          } else {
                            setConnectingFrom({ nodeId: node.id, port });
                            void hapticLight();
                          }
                        }}
                        style={{ left: relX - 9, top: relY - 9 }}
                        className={`absolute flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white shadow-md transition hover:scale-125 ${
                          isConnectTarget ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Floating Zoom Controls */}
      <div
        className="fixed right-3 bottom-[112px] z-20 flex flex-col items-center gap-1 rounded-2xl border p-1 shadow-md backdrop-blur-md sm:bottom-24"
        style={{ backgroundColor: 'var(--hud-bg)', borderColor: 'var(--hud-border)' }}
      >
        <button
          type="button"
          onClick={() => setViewport((v) => ({ ...v, scale: Math.min(2.4, v.scale * 1.18) }))}
          aria-label={t('Yakınlaştır', 'Zoom In')}
          className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-extrabold opacity-70">
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setViewport((v) => ({ ...v, scale: Math.max(0.25, v.scale * 0.85) }))}
          aria-label={t('Uzaklaştır', 'Zoom Out')}
          className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={fitToScreen}
          title={t('Ekrana Sığdır', 'Fit to Screen')}
          className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Selected Node or Edge Contextual Inspector Sheet (compact, grounded right above bottom bar) */}
      {selectedNode && (
        <div
          className="fixed right-2.5 bottom-[82px] left-2.5 z-30 mx-auto max-w-[540px] rounded-2xl border p-3 shadow-xl backdrop-blur-md sm:bottom-[92px]"
          style={{ backgroundColor: 'var(--hud-bg)', borderColor: 'var(--hud-border)' }}
          data-testid="fc-node-inspector"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={selectedNode.title}
              onChange={(e) => {
                const val = e.target.value;
                updateFlowchart((prev) => ({
                  ...prev,
                  nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, title: val } : n)),
                }));
              }}
              placeholder={t('Blok başlığı...', 'Block title...')}
              data-testid="fc-node-title-input"
              className="allow-text-input min-w-0 flex-1 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold outline-none focus:ring-2 focus:ring-sky-500"
              style={{ backgroundColor: 'var(--canvas-bg)', borderColor: 'var(--hud-border)' }}
            />
            {selectedNode.shape !== 'decision' && (
              <input
                type="text"
                value={selectedNode.subtitle ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateFlowchart((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, subtitle: val } : n)),
                  }));
                }}
                placeholder={t('Alt not...', 'Subtitle...')}
                className="allow-text-input hidden w-36 rounded-xl border px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-sky-500 sm:block"
                style={{ backgroundColor: 'var(--canvas-bg)', borderColor: 'var(--hud-border)' }}
              />
            )}
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hover:bg-slate-500/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {/* Emoji Badge Quick Strip */}
            <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() =>
                  updateFlowchart((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, emoji: undefined } : n)),
                  }))
                }
                className={`h-6 shrink-0 rounded-lg px-2 text-[10px] font-bold ${
                  !selectedNode.emoji ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950' : 'bg-slate-500/10'
                }`}
              >
                {t('İkonsuz', 'None')}
              </button>
              {BLOCK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() =>
                    updateFlowchart((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, emoji: em } : n)),
                    }))
                  }
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs transition ${
                    selectedNode.emoji === em ? 'bg-sky-500/25 ring-1 ring-sky-500' : 'hover:bg-slate-500/10'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>

            {/* Color Swatches */}
            <div className="flex items-center gap-1.5">
              {FLOW_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    updateFlowchart((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) => (n.id === selectedNode.id ? { ...n, color: c } : n)),
                    }))
                  }
                  className={`h-6 w-6 rounded-full transition ${
                    selectedNode.color === c ? 'scale-110 ring-2 ring-slate-900 ring-offset-1 dark:ring-white' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Quick Actions: Connect, +Next Step, +Yes/No (if decision), Duplicate, Delete */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setConnectingFrom({ nodeId: selectedNode.id, port: 'bottom' })}
                data-testid="fc-start-connect-btn"
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-sky-500/15 px-2.5 text-[11px] font-extrabold text-sky-600 dark:text-sky-300"
              >
                <Link2 className="h-3.5 w-3.5" />
                {t('Bağla', 'Connect')}
              </button>

              {selectedNode.shape === 'decision' ? (
                <button
                  type="button"
                  onClick={handleAddYesNoBranches}
                  data-testid="fc-add-yesno-btn"
                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-500/15 px-2.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  {t('+ Evet / Hayır', '+ Yes / No')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => addShapeNode('process')}
                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-500/15 px-2.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('Sonraki', 'Next')}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const copyId = `fn_dup_${Date.now()}`;
                  const dup: FlowchartNode = {
                    ...selectedNode,
                    id: copyId,
                    x: snap16(selectedNode.x + 48),
                    y: snap16(selectedNode.y + 48),
                  };
                  updateFlowchart((prev) => ({ ...prev, nodes: [...prev.nodes, dup] }));
                  setSelectedNodeId(copyId);
                }}
                title={t('Çoğalt', 'Duplicate')}
                className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const delId = selectedNode.id;
                  updateFlowchart((prev) => ({
                    ...prev,
                    nodes: prev.nodes.filter((n) => n.id !== delId),
                    edges: prev.edges.filter((e) => e.fromNodeId !== delId && e.toNodeId !== delId),
                  }));
                  setSelectedNodeId(null);
                }}
                title={t('Sil', 'Delete')}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Edge Inspector */}
      {selectedEdge && (
        <div
          className="fixed right-2.5 bottom-[82px] left-2.5 z-30 mx-auto max-w-[520px] rounded-2xl border p-3 shadow-xl backdrop-blur-md sm:bottom-[92px]"
          style={{ backgroundColor: 'var(--hud-bg)', borderColor: 'var(--hud-border)' }}
          data-testid="fc-edge-inspector"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={selectedEdge.label ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                updateFlowchart((prev) => ({
                  ...prev,
                  edges: prev.edges.map((ed) => (ed.id === selectedEdge.id ? { ...ed, label: val } : ed)),
                }));
              }}
              placeholder={t('Ok etiketi (örn. Evet, Hayır, Hata)...', 'Arrow label (e.g. Yes, No)...')}
              className="allow-text-input min-w-0 flex-1 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold outline-none focus:ring-2 focus:ring-sky-500"
              style={{ backgroundColor: 'var(--canvas-bg)', borderColor: 'var(--hud-border)' }}
            />
            <button
              type="button"
              onClick={() =>
                updateFlowchart((prev) => ({
                  ...prev,
                  edges: prev.edges.map((ed) =>
                    ed.id === selectedEdge.id
                      ? { ...ed, routing: ed.routing === 'smooth' ? 'orthogonal' : 'smooth' }
                      : ed
                  ),
                }))
              }
              className="h-8 rounded-xl bg-slate-500/12 px-2.5 text-[11px] font-extrabold"
            >
              {selectedEdge.routing === 'smooth' ? t('Kavisli', 'Smooth') : t('Köşeli 90°', 'Elbow 90°')}
            </button>
            <button
              type="button"
              onClick={() =>
                updateFlowchart((prev) => ({
                  ...prev,
                  edges: prev.edges.map((ed) =>
                    ed.id === selectedEdge.id
                      ? { ...ed, style: ed.style === 'dashed' ? 'solid' : 'dashed' }
                      : ed
                  ),
                }))
              }
              className="h-8 rounded-xl bg-slate-500/12 px-2.5 text-[11px] font-extrabold"
            >
              {selectedEdge.style === 'dashed' ? t('Kesikli', 'Dashed') : t('Düz', 'Solid')}
            </button>
            <button
              type="button"
              onClick={() => {
                updateFlowchart((prev) => ({
                  ...prev,
                  edges: prev.edges.filter((ed) => ed.id !== selectedEdge.id),
                }));
                setSelectedEdgeId(null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {edgeLabels.map((lbl) => (
              <button
                key={lbl}
                type="button"
                onClick={() =>
                  updateFlowchart((prev) => ({
                    ...prev,
                    edges: prev.edges.map((ed) =>
                      ed.id === selectedEdge.id
                        ? {
                            ...ed,
                            label: lbl,
                            color:
                              lbl === 'Evet' || lbl === 'Yes' || lbl === 'Başarılı' || lbl === 'Success'
                                ? '#10B981'
                                : lbl === 'Hayır' || lbl === 'No' || lbl === 'Hata' || lbl === 'Error'
                                ? '#F43F5E'
                                : '#0EA5E9',
                          }
                        : ed
                    ),
                  }))
                }
                className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold hover:bg-sky-500/10"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mermaid Live Import Modal */}
      {mermaidModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setMermaidModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-testid="fc-mermaid-modal"
            className="w-full max-w-lg rounded-3xl border p-5 shadow-2xl"
            style={{ backgroundColor: 'var(--canvas-bg)', borderColor: 'var(--hud-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-violet-500" />
                <h3 className="text-sm font-extrabold sm:text-base">
                  {t('Mermaid Kodundan Akış Diyagramı Kur', 'Import Mermaid Flowchart')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMermaidModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs opacity-70">
              {t(
                'ChatGPT, GitHub veya Notion’daki herhangi bir Mermaid akış kodunu yapıştır; anında düzenlenebilir görsel bloklara dönüşsün.',
                'Paste any Mermaid flowchart syntax from ChatGPT, GitHub, or Notion to generate an editable visual flowchart.'
              )}
            </p>
            <textarea
              rows={7}
              value={mermaidDraft}
              onChange={(e) => setMermaidDraft(e.target.value)}
              data-testid="fc-mermaid-textarea"
              className="allow-text-input mt-3 w-full rounded-2xl border bg-white/80 p-3 font-mono text-xs leading-relaxed font-semibold outline-none focus:ring-2 focus:ring-violet-500 dark:bg-slate-900/80"
              style={{ borderColor: 'var(--hud-border)' }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMermaidModalOpen(false)}
                className="min-h-[40px] rounded-xl px-4 text-xs font-bold opacity-75 hover:bg-slate-500/10"
              >
                {t('Vazgeç', 'Cancel')}
              </button>
              <button
                type="button"
                data-testid="fc-mermaid-apply-btn"
                onClick={() => {
                  const parsed = parseMermaidToFlowchart(mermaidDraft);
                  if (parsed.nodes.length > 0) {
                    updateFlowchart(() => parsed);
                    setMermaidModalOpen(false);
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                    void hapticSuccess();
                    window.setTimeout(() => fitToScreen(), 60);
                  }
                }}
                className="min-h-[40px] rounded-xl bg-violet-600 px-5 text-xs font-extrabold text-white shadow-xs active:scale-95"
              >
                {t('Diyagramı Oluştur', 'Generate Flowchart')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grounded Bottom Shape Palette (Phone Flush Bottom Sheet / Tablet Dock) */}
      <div
        className="fixed right-0 bottom-0 left-0 z-20 flex justify-center sm:right-4 sm:bottom-3 sm:left-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div
          className="flex w-full items-center gap-1.5 overflow-x-auto border-t px-2.5 py-2 shadow-lg backdrop-blur-md sm:w-auto sm:rounded-2xl sm:border"
          style={{ backgroundColor: 'var(--hud-bg)', borderColor: 'var(--hud-border)' }}
          data-testid="fc-shape-palette"
        >
          {SHAPE_META.map((item) => {
            const IconComp =
              item.shape === 'start_end'
                ? Sparkles
                : item.shape === 'decision'
                ? Diamond
                : item.shape === 'database'
                ? Database
                : item.shape === 'document'
                ? FileText
                : Square;
            return (
              <button
                key={item.shape}
                type="button"
                data-testid={`fc-add-${item.shape}`}
                onClick={() => addShapeNode(item.shape)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition hover:bg-sky-500/10 active:scale-95"
                style={{
                  borderColor: 'var(--hud-border)',
                  backgroundColor: 'var(--canvas-bg)',
                }}
              >
                <IconComp className="h-3.5 w-3.5" style={{ color: item.defaultColor }} />
                <span>{isEn ? item.labelEn : item.labelTr}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
