import React, { useEffect, useRef, useState } from 'react';
import {
  PenTool,
  Highlighter,
  Sparkles,
  ArrowUpRight,
  Square,
  Circle,
  Minus,
  Lasso,
  Eraser,
  StickyNote,
  Grid3X3,
  Undo2,
  Trash2,
  Check,
  Hand,
  Wand2,
  GripHorizontal,
  GripVertical,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import type { EraserMode, InkToolType, PaperStyleType } from '../types/mindmap';
import { hapticLight } from '../core/native/NativeBridge';
import { useKeyboardInset } from '../core/native/useKeyboardInset';

export interface CanvasDrawingToolbarProps {
  isOpen: boolean;
  activeTool: InkToolType;
  eraserMode: EraserMode;
  autoShapeEnabled: boolean;
  inkColor: string;
  strokeWidth: number;
  stylusOnly: boolean;
  paperStyle: PaperStyleType;
  hardwareEraserActive: boolean;
  strokeCount: number;
  selectedLassoCount: number;
  onChangeTool: (tool: InkToolType) => void;
  onToggleEraserMode: () => void;
  onToggleAutoShape: () => void;
  onChangeColor: (color: string) => void;
  onChangeWidth: (width: number) => void;
  onToggleStylusOnly: () => void;
  onCyclePaperStyle: () => void;
  onAddStickyNote: () => void;
  onDeleteLassoSelected: () => void;
  onRecolorLassoSelected: (color: string) => void;
  onUndoInk: () => void;
  onClearAllInk: () => void;
  onClose: () => void;
}

type DockMode = 'bottom' | 'top' | 'left' | 'right' | 'float';

interface PersistedDockState {
  mode: DockMode;
  x: number;
  y: number;
  collapsed: boolean;
}

const DOCK_STORAGE_KEY = 'zh_draw_dock_pos_v2';

const INK_TOOLS: Array<{
  id: InkToolType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'pen', label: 'Kalem', icon: PenTool },
  { id: 'highlighter', label: 'Fosforlu', icon: Highlighter },
  { id: 'laser', label: 'Lazer', icon: Sparkles },
  { id: 'lasso', label: 'Kement', icon: Lasso },
  { id: 'eraser', label: 'Silgi', icon: Eraser },
];

const SHAPE_TOOLS: Array<{
  id: InkToolType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'arrow', label: 'Ok', icon: ArrowUpRight },
  { id: 'line', label: 'Çizgi', icon: Minus },
  { id: 'rect', label: 'Kutu', icon: Square },
  { id: 'ellipse', label: 'Daire', icon: Circle },
];

const INK_COLORS = [
  '#0F172A',
  '#EF4444',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
];

const WIDTH_PRESETS: Array<{ value: number; dotSize: number; label: string }> = [
  { value: 2.5, dotSize: 6, label: 'İnce' },
  { value: 4.5, dotSize: 10, label: 'Orta' },
  { value: 8.5, dotSize: 14, label: 'Kalın' },
];

const PAPER_LABELS: Record<PaperStyleType, string> = {
  dots: 'Noktalı',
  grid: 'Kareli',
  lined: 'Çizgili',
  blank: 'Düz',
  warm: 'Krem',
};

function loadInitialDock(): PersistedDockState {
  try {
    const raw = localStorage.getItem(DOCK_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PersistedDockState>;
      const validMode: DockMode =
        p.mode === 'top' ||
        p.mode === 'bottom' ||
        p.mode === 'left' ||
        p.mode === 'right' ||
        p.mode === 'float'
          ? p.mode
          : 'bottom';
      return {
        mode: validMode,
        x: typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 24,
        y: typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 120,
        collapsed: false,
      };
    }
  } catch {
    // Ignore storage read issues
  }
  return { mode: 'bottom', x: 24, y: 120, collapsed: false };
}

export const CanvasDrawingToolbar: React.FC<CanvasDrawingToolbarProps> = React.memo(({
  isOpen,
  activeTool,
  eraserMode,
  autoShapeEnabled,
  inkColor,
  strokeWidth,
  stylusOnly,
  paperStyle,
  hardwareEraserActive,
  strokeCount,
  selectedLassoCount,
  onChangeTool,
  onToggleEraserMode,
  onToggleAutoShape,
  onChangeColor,
  onChangeWidth,
  onToggleStylusOnly,
  onCyclePaperStyle,
  onAddStickyNote,
  onDeleteLassoSelected,
  onRecolorLassoSelected,
  onUndoInk,
  onClearAllInk,
  onClose,
}) => {
  const kb = useKeyboardInset();
  const [dock, setDock] = useState<PersistedDockState>(loadInitialDock);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origLeft: number;
    origTop: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);

  const isPhone = kb.viewportW < 768;
  const effectiveMode: DockMode =
    isPhone && (dock.mode === 'left' || dock.mode === 'right' || dock.mode === 'float')
      ? 'bottom'
      : dock.mode;
  const isVerticalRail = !isPhone && !dock.collapsed && (effectiveMode === 'left' || effectiveMode === 'right');

  useEffect(() => {
    try {
      localStorage.setItem(
        DOCK_STORAGE_KEY,
        JSON.stringify({ mode: dock.mode, x: dock.x, y: dock.y, collapsed: false })
      );
    } catch {
      // Ignore storage write issues
    }
  }, [dock.mode, dock.x, dock.y]);

  // Apple PKToolPicker Pattern: auto-hide drawing dock while virtual keyboard is open
  if (!isOpen || kb.isKeyboardOpen) return null;

  const isShapeTool =
    activeTool === 'arrow' ||
    activeTool === 'line' ||
    activeTool === 'rect' ||
    activeTool === 'ellipse';

  const startToolbarDrag = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer capture issues
    }
    setIsDragging(true);
  };

  const moveToolbarDrag = (e: React.PointerEvent<HTMLElement>) => {
    const dr = dragRef.current;
    const el = panelRef.current;
    if (!dr || !el || dr.pointerId !== e.pointerId) return;
    const dx = e.clientX - dr.startClientX;
    const dy = e.clientY - dr.startClientY;
    if (Math.hypot(dx, dy) > 4) {
      dr.moved = true;
    }
    el.style.transform = `translate3d(${Math.round(dx)}px, ${Math.round(dy)}px, 0)`;
  };

  const endToolbarDrag = (e: React.PointerEvent<HTMLElement>, onTapFallback?: () => void) => {
    const dr = dragRef.current;
    const el = panelRef.current;
    if (!dr || dr.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    if (el) {
      el.style.transform = '';
    }
    setIsDragging(false);

    if (!dr.moved) {
      onTapFallback?.();
      return;
    }

    const dx = e.clientX - dr.startClientX;
    const dy = e.clientY - dr.startClientY;
    const vw = kb.viewportW;
    const vh = kb.viewportH;
    const dropLeft = dr.origLeft + dx;
    const dropTop = dr.origTop + dy;
    const centerX = dropLeft + dr.width * 0.5;
    const centerY = dropTop + dr.height * 0.5;

    void hapticLight();

    // Magnetic Samsung Notes / Apple PencilKit Edge Snapping!
    if (isPhone) {
      setDock((prev) => ({
        ...prev,
        mode: centerY < vh * 0.38 ? 'top' : 'bottom',
      }));
      return;
    }

    if (dropTop < 118) {
      setDock((prev) => ({ ...prev, mode: 'top' }));
    } else if (dropTop + dr.height > vh - 86) {
      setDock((prev) => ({ ...prev, mode: 'bottom' }));
    } else if (centerX < 130) {
      setDock((prev) => ({ ...prev, mode: 'left' }));
    } else if (centerX > vw - 130) {
      setDock((prev) => ({ ...prev, mode: 'right' }));
    } else {
      const clampedX = Math.max(14, Math.min(vw - dr.width - 14, Math.round(dropLeft)));
      const clampedY = Math.max(76, Math.min(vh - dr.height - 20, Math.round(dropTop)));
      setDock((prev) => ({ ...prev, mode: 'float', x: clampedX, y: clampedY }));
    }
  };

  // Compute grounded, smooth positioning for each magnetic dock zone
  let wrapperStyle: React.CSSProperties;
  let wrapperClass = 'pointer-events-none fixed z-40 flex flex-col select-none';

  if (effectiveMode === 'top') {
    wrapperClass += ' inset-x-0 top-0 items-center px-2.5';
    wrapperStyle = {
      paddingTop: 'max(72px, calc(var(--safe-top) + 66px))',
      transition: isDragging ? 'none' : 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  } else if (effectiveMode === 'left') {
    wrapperClass += ' left-0 top-1/2 -translate-y-1/2 items-start pl-3';
    wrapperStyle = {
      transition: isDragging ? 'none' : 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  } else if (effectiveMode === 'right') {
    wrapperClass += ' right-0 top-1/2 -translate-y-1/2 items-end pr-3';
    wrapperStyle = {
      transition: isDragging ? 'none' : 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  } else if (effectiveMode === 'float') {
    wrapperStyle = {
      left: `${Math.max(12, Math.min(kb.viewportW - 140, dock.x))}px`,
      top: `${Math.max(74, Math.min(kb.viewportH - 120, dock.y))}px`,
      maxWidth: 'calc(100vw - 24px)',
      transition: isDragging ? 'none' : 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  } else {
    // Grounded Native Bottom Dock: flush bottom-sheet on phones, grounded subtle float on tablets
    wrapperClass += isPhone
      ? ' inset-x-0 bottom-0 items-center'
      : ' inset-x-0 bottom-0 items-center px-3';
    wrapperStyle = {
      paddingBottom: isPhone ? '0px' : 'max(14px, calc(var(--safe-bottom) + 10px))',
      transition: isDragging ? 'none' : 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  }

  const ActiveToolIcon =
    INK_TOOLS.find((t) => t.id === activeTool)?.icon ||
    SHAPE_TOOLS.find((t) => t.id === activeTool)?.icon ||
    PenTool;

  return (
    <>
      {/* Top Status Banner for Hardware S-Pen/Apple Pencil Eraser or Lasso Selection */}
      {(hardwareEraserActive || selectedLassoCount > 0) && (
        <div
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
          style={{ top: 'max(72px, calc(var(--safe-top) + 64px))' }}
        >
          {hardwareEraserActive ? (
            <div
              data-testid="hardware-eraser-pill"
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white shadow-lg ring-2 ring-white/25"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Kalem Silgi Tuşu Aktif — Çizgilerin Üzerinden Geçin</span>
            </div>
          ) : (
            <div
              data-testid="lasso-selection-bar"
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-indigo-500/40 bg-slate-900/95 px-3 py-1.5 text-xs font-extrabold text-white shadow-xl backdrop-blur-md"
            >
              <span>{selectedLassoCount} çizim seçili (Sürükleyip taşıyın)</span>
              <div className="flex items-center gap-1">
                {INK_COLORS.slice(1, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onRecolorLassoSelected(c)}
                    className="h-5 w-5 rounded-full border border-white/80 active:scale-90"
                    style={{ backgroundColor: c }}
                    title="Seçilileri Boya"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={onDeleteLassoSelected}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-2.5 py-1 text-xs font-black text-white active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Sil</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Draggable & Magnetically Dockable Samsung Notes / Apple PencilKit Palette */}
      <div
        data-testid="canvas-drawing-toolbar"
        data-dock-mode={effectiveMode}
        onPointerDown={(e) => e.stopPropagation()}
        className={wrapperClass}
        style={wrapperStyle}
      >
        <div
          ref={panelRef}
          className={`pointer-events-auto border shadow-2xl backdrop-blur-2xl ring-1 ring-slate-900/6 dark:ring-white/10 ${
            dock.collapsed
              ? 'flex items-center gap-2 rounded-full px-3 py-2'
              : isPhone && effectiveMode === 'bottom'
              ? 'flex w-full flex-col gap-2 rounded-t-[26px] border-x-0 border-b-0 px-3 pt-1.5'
              : isVerticalRail
              ? 'flex max-h-[76dvh] flex-col items-center gap-2 overflow-y-auto rounded-[26px] p-2'
              : 'flex max-w-full flex-col gap-2 rounded-[26px] px-3 py-2'
          } ${isDragging ? 'scale-[1.015] shadow-sky-500/20' : ''}`}
          style={{
            backgroundColor: 'var(--hud-bg)',
            borderColor: 'var(--hud-border)',
            paddingBottom:
              !dock.collapsed && isPhone && effectiveMode === 'bottom'
                ? 'max(14px, calc(var(--safe-bottom) + 10px))'
                : undefined,
            willChange: isDragging ? 'transform' : undefined,
          }}
        >
          {dock.collapsed ? (
            /* Minimized Compact Floating Orb (Tap to Expand, Drag to Relocate!) */
            <>
              <div
                data-testid="ink-drag-handle"
                onPointerDown={startToolbarDrag}
                onPointerMove={moveToolbarDrag}
                onPointerUp={(e) =>
                  endToolbarDrag(e, () => {
                    void hapticLight();
                    setDock((prev) => ({ ...prev, collapsed: false }));
                  })
                }
                onPointerCancel={(e) => endToolbarDrag(e)}
                title="Sürükleyerek taşı veya dokunarak aç"
                className="flex cursor-grab items-center gap-2 active:cursor-grabbing"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm"
                  style={{
                    backgroundColor:
                      activeTool === 'eraser' || hardwareEraserActive
                        ? '#F43F5E'
                        : activeTool === 'laser'
                        ? '#DC2626'
                        : inkColor,
                  }}
                >
                  <ActiveToolIcon className="h-4.5 w-4.5" />
                </span>
                <span className="text-xs font-extrabold">Çizim Araçları</span>
                <Maximize2 className="h-3.5 w-3.5 opacity-60" />
              </div>
              <button
                type="button"
                data-testid="ink-close-btn"
                onClick={() => {
                  void hapticLight();
                  onClose();
                }}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-500 px-2.5 text-[11px] font-black text-white active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Bitti</span>
              </button>
            </>
          ) : isVerticalRail ? (
            /* Vertical Samsung Notes Side-Rail Layout (Left/Right Tablet Dock!) */
            <>
              <div className="flex w-full items-center justify-between gap-1 border-b pb-1.5" style={{ borderColor: 'var(--hud-border)' }}>
                <div
                  data-testid="ink-drag-handle"
                  onPointerDown={startToolbarDrag}
                  onPointerMove={moveToolbarDrag}
                  onPointerUp={(e) => endToolbarDrag(e)}
                  onPointerCancel={(e) => endToolbarDrag(e)}
                  onDoubleClick={() => setDock((p) => ({ ...p, mode: 'bottom' }))}
                  title="Araç çubuğunu sürükleyerek taşıyın (Çift tıkla: Alt)"
                  className="flex h-7 flex-1 cursor-grab items-center justify-center rounded-lg hover:bg-slate-500/10 active:cursor-grabbing"
                >
                  <GripHorizontal className="h-4 w-4 opacity-60" />
                </div>
                <button
                  type="button"
                  data-testid="ink-collapse-btn"
                  onClick={() => {
                    void hapticLight();
                    setDock((p) => ({ ...p, collapsed: true }));
                  }}
                  title="Küçült"
                  className="flex h-7 w-7 items-center justify-center rounded-lg opacity-70 hover:bg-slate-500/10 hover:opacity-100"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-1">
                {INK_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const active = activeTool === tool.id || (tool.id === 'eraser' && hardwareEraserActive);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      data-testid={`ink-tool-${tool.id}`}
                      onClick={() => {
                        void hapticLight();
                        if (tool.id === 'eraser' && activeTool === 'eraser') {
                          onToggleEraserMode();
                        } else {
                          onChangeTool(tool.id);
                        }
                      }}
                      title={tool.id === 'eraser' ? `Silgi (${eraserMode === 'stroke' ? 'Çizgi Sil' : 'Alan Sil'})` : tool.label}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition active:scale-95 ${
                        active
                          ? tool.id === 'eraser'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : tool.id === 'laser'
                            ? 'bg-red-600 text-white shadow-xs'
                            : tool.id === 'lasso'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-sky-500 text-white shadow-xs'
                          : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </button>
                  );
                })}
              </div>

              <div className="h-px w-8 bg-slate-400/25" />

              <div className="grid grid-cols-2 gap-1">
                {SHAPE_TOOLS.map((sh) => {
                  const Icon = sh.icon;
                  const active = activeTool === sh.id;
                  return (
                    <button
                      key={sh.id}
                      type="button"
                      data-testid={`ink-tool-${sh.id}`}
                      onClick={() => {
                        void hapticLight();
                        onChangeTool(sh.id);
                      }}
                      title={sh.label}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition active:scale-95 ${
                        active
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'opacity-75 hover:bg-slate-500/10 hover:opacity-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>

              <div className="h-px w-8 bg-slate-400/25" />

              <div className="grid grid-cols-2 gap-1.5">
                {INK_COLORS.slice(0, 6).map((col) => {
                  const active = inkColor === col && activeTool !== 'eraser' && activeTool !== 'lasso';
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        void hapticLight();
                        onChangeColor(col);
                        if (activeTool === 'eraser' || activeTool === 'lasso') onChangeTool('pen');
                      }}
                      className={`h-6 w-6 rounded-full border-2 border-white shadow-2xs dark:border-slate-800 ${
                        active ? 'scale-110 ring-2 ring-sky-500' : 'opacity-85'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  );
                })}
              </div>

              <div className="h-px w-8 bg-slate-400/25" />

              <button
                type="button"
                data-testid="ink-add-sticky-btn"
                onClick={() => {
                  void hapticLight();
                  onAddStickyNote();
                }}
                title="Yapışkan Not Ekle"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/25 text-amber-800 active:scale-95 dark:text-yellow-200"
              >
                <StickyNote className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-testid="ink-paper-style-btn"
                onClick={() => {
                  void hapticLight();
                  onCyclePaperStyle();
                }}
                title={`Kağıt: ${PAPER_LABELS[paperStyle]}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10 active:scale-95"
              >
                <Grid3X3 className="h-4 w-4 text-sky-500" />
              </button>
              <button
                type="button"
                data-testid="ink-palm-reject-btn"
                onClick={() => {
                  void hapticLight();
                  onToggleStylusOnly();
                }}
                title={stylusOnly ? 'Sadece Kalem Aktif' : 'Kalem + Parmak'}
                className={`flex h-9 w-9 items-center justify-center rounded-xl active:scale-95 ${
                  stylusOnly ? 'bg-indigo-500 text-white' : 'bg-slate-500/10 opacity-80'
                }`}
              >
                <Hand className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={strokeCount === 0}
                data-testid="ink-undo-btn"
                onClick={() => {
                  void hapticLight();
                  onUndoInk();
                }}
                title="Geri Al"
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10 disabled:opacity-35"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                data-testid="ink-close-btn"
                onClick={() => {
                  void hapticLight();
                  onClose();
                }}
                title="Çizimden Çık"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs active:scale-95"
              >
                <Check className="h-4.5 w-4.5" />
              </button>
            </>
          ) : (
            /* Horizontal Grounded / Floating Dock (Top, Bottom, or Free-Floating) */
            <>
              {/* Smooth Tactile Drag Bar + Minimize Pill */}
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div
                  data-testid="ink-drag-handle"
                  onPointerDown={startToolbarDrag}
                  onPointerMove={moveToolbarDrag}
                  onPointerUp={(e) => endToolbarDrag(e)}
                  onPointerCancel={(e) => endToolbarDrag(e)}
                  onDoubleClick={() => setDock((p) => ({ ...p, mode: 'bottom' }))}
                  title="Samsung Notes gibi sürükleyerek kenara veya istediğiniz yere taşıyın"
                  className="flex h-5 flex-1 cursor-grab items-center justify-center gap-1.5 rounded-full hover:bg-slate-500/10 active:cursor-grabbing"
                >
                  <span className="h-1 w-10 rounded-full bg-slate-400/55" />
                  <GripVertical className="hidden h-3 w-3 opacity-45 sm:block" />
                </div>
                <button
                  type="button"
                  data-testid="ink-collapse-btn"
                  onClick={() => {
                    void hapticLight();
                    setDock((p) => ({ ...p, collapsed: true }));
                  }}
                  title="Araç çubuğunu küçült"
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-500/10 px-2 text-[10px] font-extrabold opacity-75 hover:opacity-100 active:scale-95"
                >
                  <Minimize2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Küçült</span>
                </button>
              </div>

              {/* Row 1: Pen, Highlighter, Laser, Lasso, Smart Eraser, Shapes + Done */}
              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
                <div className="flex shrink-0 items-center gap-0.5 rounded-2xl bg-slate-500/10 p-1">
                  {INK_TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const active = activeTool === tool.id || (tool.id === 'eraser' && hardwareEraserActive);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        data-testid={`ink-tool-${tool.id}`}
                        onClick={() => {
                          void hapticLight();
                          if (tool.id === 'eraser' && activeTool === 'eraser') {
                            onToggleEraserMode();
                          } else {
                            onChangeTool(tool.id);
                          }
                        }}
                        title={
                          tool.id === 'eraser'
                            ? 'Silgi (Tekrar dokun: Çizgi Sil / Alan Sil geçişi)'
                            : tool.label
                        }
                        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold whitespace-nowrap transition active:scale-95 sm:px-3 ${
                          active
                            ? tool.id === 'eraser'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : tool.id === 'laser'
                              ? 'bg-red-600 text-white shadow-xs'
                              : tool.id === 'lasso'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-sky-500 text-white shadow-xs'
                            : 'opacity-85 hover:bg-slate-500/10 hover:opacity-100'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className={active ? 'inline' : 'hidden sm:inline'}>
                          {tool.id === 'eraser' && active
                            ? eraserMode === 'stroke'
                              ? 'Çizgi Sil'
                              : 'Alan Sil'
                            : tool.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Geometric Shape Tools (Arrow / Line / Box / Circle) */}
                <div className="flex shrink-0 items-center gap-0.5 rounded-2xl bg-slate-500/10 p-1">
                  {SHAPE_TOOLS.map((sh) => {
                    const Icon = sh.icon;
                    const active = activeTool === sh.id;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        data-testid={`ink-tool-${sh.id}`}
                        onClick={() => {
                          void hapticLight();
                          onChangeTool(sh.id);
                        }}
                        title={sh.label}
                        className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 text-xs font-extrabold whitespace-nowrap transition active:scale-95 ${
                          active
                            ? 'bg-violet-600 text-white shadow-xs'
                            : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {active && <span>{sh.label}</span>}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  data-testid="ink-close-btn"
                  onClick={() => {
                    void hapticLight();
                    onClose();
                  }}
                  title="Çizim Modundan Çık"
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-white shadow-xs active:scale-95"
                >
                  <Check className="h-4 w-4" />
                  <span>Bitti</span>
                </button>
              </div>

              {/* Row 2: Colors + Thickness + Auto-Shape + Sticky Note + Paper Grid + Palm Rejection + Undo/Clear */}
              <div
                className="no-scrollbar flex items-center justify-between gap-2 overflow-x-auto border-t pt-2"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <div className="flex shrink-0 items-center gap-1.5">
                  {INK_COLORS.map((col) => {
                    const active =
                      inkColor === col &&
                      activeTool !== 'eraser' &&
                      activeTool !== 'lasso' &&
                      activeTool !== 'laser';
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          void hapticLight();
                          onChangeColor(col);
                          if (activeTool === 'eraser' || activeTool === 'lasso') {
                            onChangeTool('pen');
                          }
                        }}
                        aria-label={`Renk ${col}`}
                        className={`h-7 w-7 rounded-full border-2 border-white shadow-2xs transition-transform active:scale-90 dark:border-slate-800 ${
                          active ? 'scale-115 ring-2 ring-sky-500' : 'opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    );
                  })}

                  <div className="mx-0.5 h-5 w-px bg-slate-400/30" />

                  <div className="flex items-center gap-1 rounded-xl bg-slate-500/10 px-1.5 py-0.5">
                    {WIDTH_PRESETS.map((w) => {
                      const active = Math.abs(strokeWidth - w.value) < 0.8;
                      return (
                        <button
                          key={w.value}
                          type="button"
                          title={w.label}
                          onClick={() => {
                            void hapticLight();
                            onChangeWidth(w.value);
                          }}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                            active ? 'bg-white shadow-2xs dark:bg-slate-800' : 'opacity-65 hover:opacity-100'
                          }`}
                        >
                          <span
                            className="rounded-full"
                            style={{
                              width: `${w.dotSize}px`,
                              height: `${w.dotSize}px`,
                              backgroundColor:
                                activeTool === 'eraser'
                                  ? '#64748B'
                                  : activeTool === 'laser'
                                  ? '#EF4444'
                                  : inkColor,
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {(activeTool === 'pen' || isShapeTool) && (
                    <button
                      type="button"
                      data-testid="ink-autoshape-btn"
                      onClick={() => {
                        void hapticLight();
                        onToggleAutoShape();
                      }}
                      title="Oto-Şekil: Çizip ucunda 0.4sn bekleyince düz çizgi, daire veya kutuya düzeltir"
                      className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                        autoShapeEnabled
                          ? 'border-amber-500/45 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'border-slate-500/20 opacity-65 hover:opacity-100'
                      }`}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Oto-Şekil</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="ink-add-sticky-btn"
                    onClick={() => {
                      void hapticLight();
                      onAddStickyNote();
                    }}
                    title="Tuvale Yapışkan Not Ekle"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-yellow-500/45 bg-yellow-400/20 px-2.5 text-xs font-extrabold whitespace-nowrap text-amber-900 hover:bg-yellow-400/30 active:scale-95 dark:text-yellow-200"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Not</span>
                  </button>

                  <button
                    type="button"
                    data-testid="ink-paper-style-btn"
                    onClick={() => {
                      void hapticLight();
                      onCyclePaperStyle();
                    }}
                    title="Defter Kağıdı Deseni"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-500/25 bg-slate-500/10 px-2.5 text-xs font-extrabold whitespace-nowrap hover:bg-slate-500/15 active:scale-95"
                  >
                    <Grid3X3 className="h-3.5 w-3.5 text-sky-500" />
                    <span className="hidden sm:inline">{PAPER_LABELS[paperStyle]}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="ink-palm-reject-btn"
                    onClick={() => {
                      void hapticLight();
                      onToggleStylusOnly();
                    }}
                    title="Avuç İçi Reddi: Açıkken sadece S-Pen / Apple Pencil çizer"
                    className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                      stylusOnly
                        ? 'border-indigo-500 bg-indigo-500 text-white shadow-xs'
                        : 'border-slate-500/20 bg-slate-500/8 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <Hand className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">
                      {stylusOnly ? 'Sadece Kalem' : 'Kalem+Parmak'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={strokeCount === 0}
                    data-testid="ink-undo-btn"
                    onClick={() => {
                      void hapticLight();
                      onUndoInk();
                    }}
                    title="Son Çizgiyi Geri Al"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2 text-xs font-extrabold hover:bg-slate-500/10 active:scale-95 disabled:opacity-35"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={strokeCount === 0}
                    data-testid="ink-clear-btn"
                    onClick={() => {
                      void hapticLight();
                      onClearAllInk();
                    }}
                    title="Tüm Çizimleri Temizle"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2 text-xs font-extrabold text-rose-600 hover:bg-rose-500/12 active:scale-95 disabled:opacity-35 dark:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});
