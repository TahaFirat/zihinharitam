import React from 'react';
import {
  PenTool,
  Pencil,
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

const INK_TOOLS: Array<{
  id: InkToolType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'pen', label: 'Kalem', icon: PenTool },
  { id: 'pencil', label: 'Kurşun', icon: Pencil },
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

  // Apple PKToolPicker Pattern: auto-hide drawing dock while virtual keyboard is open
  if (!isOpen || kb.isKeyboardOpen) return null;

  const isShapeTool =
    activeTool === 'arrow' ||
    activeTool === 'line' ||
    activeTool === 'rect' ||
    activeTool === 'ellipse';

  return (
    <div
      data-testid="canvas-drawing-toolbar"
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-1.5 px-2.5 select-none"
      style={{ paddingBottom: 'max(28px, calc(var(--safe-bottom) + 22px))' }}
    >
      {/* Live Hardware Stylus Button / Lasso Selection Context Pill */}
      {hardwareEraserActive && (
        <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1 text-xs font-black text-white shadow-lg">
          <Eraser className="h-3.5 w-3.5" />
          <span>Kalem Silgi Tuşu Aktif (S-Pen / Apple Pencil)</span>
        </div>
      )}

      {selectedLassoCount > 0 && !hardwareEraserActive && (
        <div
          data-testid="lasso-selection-bar"
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

      {/* Main Samsung Notes / GoodNotes Pro Floating Dock */}
      <div
        className="animate-studio-dock pointer-events-auto flex max-w-full flex-col gap-2 rounded-3xl border px-3 py-2.5 shadow-2xl"
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
        }}
      >
        {/* Row 1: Pen, Pencil, Highlighter, Laser, Shapes, Lasso, Smart Eraser + Done */}
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
                  className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold whitespace-nowrap transition active:scale-95 ${
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
                  className={`inline-flex min-h-[42px] items-center gap-1 rounded-xl px-2.5 text-xs font-extrabold whitespace-nowrap transition active:scale-95 ${
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
            className="inline-flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-white shadow-xs active:scale-95"
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

            {/* Stroke Width Presets */}
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
            {/* Hold-to-Snap Auto-Shape Assist Toggle */}
            {(activeTool === 'pen' || isShapeTool) && (
              <button
                type="button"
                data-testid="ink-autoshape-btn"
                onClick={() => {
                  void hapticLight();
                  onToggleAutoShape();
                }}
                title="Oto-Şekil (Samsung/Apple Notes): Çizip ucunda 0.4sn bekleyince düz çizgi, daire veya kutuya düzeltir"
                className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                  autoShapeEnabled
                    ? 'border-amber-500/45 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'border-slate-500/20 opacity-65 hover:opacity-100'
                }`}
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Oto-Şekil</span>
              </button>
            )}

            {/* 1-Tap Sticky Note on Canvas (Apple Freeform & Samsung Notes!) */}
            <button
              type="button"
              data-testid="ink-add-sticky-btn"
              onClick={() => {
                void hapticLight();
                onAddStickyNote();
              }}
              title="Tuvale Yapışkan Not Ekle (Taşınabilir)"
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-yellow-500/45 bg-yellow-400/20 px-2.5 text-xs font-extrabold whitespace-nowrap text-amber-900 hover:bg-yellow-400/30 active:scale-95 dark:text-yellow-200"
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Not</span>
            </button>

            {/* Paper Template Switcher (Noktalı / Kareli / Çizgili / Düz / Krem) */}
            <button
              type="button"
              data-testid="ink-paper-style-btn"
              onClick={() => {
                void hapticLight();
                onCyclePaperStyle();
              }}
              title="Defter Kağıdı Deseni: Noktalı / Kareli / Çizgili / Düz / Krem"
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-500/25 bg-slate-500/10 px-2.5 text-xs font-extrabold whitespace-nowrap hover:bg-slate-500/15 active:scale-95"
            >
              <Grid3X3 className="h-3.5 w-3.5 text-sky-500" />
              <span className="hidden sm:inline">{PAPER_LABELS[paperStyle]}</span>
            </button>

            {/* Stylus-Only Palm Rejection Toggle */}
            <button
              type="button"
              data-testid="ink-palm-reject-btn"
              onClick={() => {
                void hapticLight();
                onToggleStylusOnly();
              }}
              title="Avuç İçi Reddi: Açıkken sadece S-Pen / Apple Pencil çizer, parmaklar tuvali kaydırır"
              className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
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
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 text-xs font-extrabold hover:bg-slate-500/10 active:scale-95 disabled:opacity-35"
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
              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 text-xs font-extrabold text-rose-600 hover:bg-rose-500/12 active:scale-95 disabled:opacity-35 dark:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
