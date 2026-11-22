import React from 'react';
import {
  PenTool,
  Highlighter,
  ArrowUpRight,
  Square,
  Circle,
  Eraser,
  Undo2,
  Trash2,
  Check,
  Hand,
} from 'lucide-react';
import type { InkToolType } from '../types/mindmap';
import { hapticLight } from '../core/native/NativeBridge';
import { useKeyboardInset } from '../core/native/useKeyboardInset';

export interface CanvasDrawingToolbarProps {
  isOpen: boolean;
  activeTool: InkToolType;
  inkColor: string;
  strokeWidth: number;
  stylusOnly: boolean;
  strokeCount: number;
  onChangeTool: (tool: InkToolType) => void;
  onChangeColor: (color: string) => void;
  onChangeWidth: (width: number) => void;
  onToggleStylusOnly: () => void;
  onUndoInk: () => void;
  onClearAllInk: () => void;
  onClose: () => void;
}

const INK_TOOLS: Array<{ id: InkToolType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'pen', label: 'Kalem', icon: PenTool },
  { id: 'highlighter', label: 'Fosforlu', icon: Highlighter },
  { id: 'arrow', label: 'Ok', icon: ArrowUpRight },
  { id: 'rect', label: 'Kutu', icon: Square },
  { id: 'ellipse', label: 'Daire', icon: Circle },
  { id: 'eraser', label: 'Silgi', icon: Eraser },
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
  { value: 8.0, dotSize: 14, label: 'Kalın' },
];

export const CanvasDrawingToolbar: React.FC<CanvasDrawingToolbarProps> = React.memo(({
  isOpen,
  activeTool,
  inkColor,
  strokeWidth,
  stylusOnly,
  strokeCount,
  onChangeTool,
  onChangeColor,
  onChangeWidth,
  onToggleStylusOnly,
  onUndoInk,
  onClearAllInk,
  onClose,
}) => {
  const kb = useKeyboardInset();

  // Apple PKToolPicker Pattern: automatically hide drawing pill when virtual keyboard is active!
  if (!isOpen || kb.isKeyboardOpen) return null;

  return (
    <div
      data-testid="canvas-drawing-toolbar"
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2.5 select-none"
      style={{ paddingBottom: 'max(22px, calc(var(--safe-bottom) + 16px))' }}
    >
      <div
        className="animate-studio-dock pointer-events-auto flex max-w-full flex-col gap-1.5 rounded-3xl border px-3 py-2 shadow-2xl"
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
        }}
      >
        {/* Row 1: Pen, Highlighter, Arrow, Box, Circle, Eraser + Palm Rejection + Done */}
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-0.5 rounded-2xl bg-slate-500/10 p-0.5">
            {INK_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  data-testid={`ink-tool-${tool.id}`}
                  onClick={() => {
                    void hapticLight();
                    onChangeTool(tool.id);
                  }}
                  title={tool.label}
                  className={`inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 text-xs font-extrabold whitespace-nowrap transition active:scale-95 ${
                    active
                      ? tool.id === 'eraser'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-sky-500 text-white shadow-xs'
                      : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className={active ? 'inline' : 'hidden sm:inline'}>
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="ink-palm-reject-btn"
            onClick={() => {
              void hapticLight();
              onToggleStylusOnly();
            }}
            title="Avuç İçi Reddi: Açıkken sadece Apple Pencil / Kalem çizer, parmaklar haritayı kaydırır"
            className={`inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-extrabold whitespace-nowrap active:scale-95 ${
              stylusOnly
                ? 'border-indigo-500 bg-indigo-500 text-white shadow-xs'
                : 'border-slate-500/20 bg-slate-500/8 opacity-85 hover:opacity-100'
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              {stylusOnly ? 'Sadece Kalem' : 'Kalem + Parmak'}
            </span>
          </button>

          <button
            type="button"
            data-testid="ink-close-btn"
            onClick={() => {
              void hapticLight();
              onClose();
            }}
            title="Çizim Modundan Çık"
            className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3 text-xs font-extrabold text-white shadow-xs active:scale-95"
          >
            <Check className="h-4 w-4" />
            <span>Bitti</span>
          </button>
        </div>

        {/* Row 2: Ink Color Swatches + Thickness Dots + Undo + Clear */}
        <div className="no-scrollbar flex items-center justify-between gap-2 overflow-x-auto border-t pt-1.5" style={{ borderColor: 'var(--hud-border)' }}>
          <div className="flex shrink-0 items-center gap-1.5">
            {INK_COLORS.map((col) => {
              const active = inkColor === col && activeTool !== 'eraser';
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    void hapticLight();
                    onChangeColor(col);
                    if (activeTool === 'eraser') onChangeTool('pen');
                  }}
                  aria-label={`Renk ${col}`}
                  className={`h-6 w-6 rounded-full border-2 border-white shadow-2xs transition-transform active:scale-90 dark:border-slate-800 ${
                    active ? 'scale-120 ring-2 ring-sky-500' : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col }}
                />
              );
            })}

            <div className="mx-1 h-4 w-px bg-slate-400/30" />

            {/* Stroke Width Presets */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-500/10 px-1.5 py-0.5">
              {WIDTH_PRESETS.map((w) => {
                const active = Math.abs(strokeWidth - w.value) < 0.6;
                return (
                  <button
                    key={w.value}
                    type="button"
                    title={w.label}
                    onClick={() => {
                      void hapticLight();
                      onChangeWidth(w.value);
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                      active ? 'bg-white shadow-2xs dark:bg-slate-800' : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    <span
                      className="rounded-full"
                      style={{
                        width: `${w.dotSize}px`,
                        height: `${w.dotSize}px`,
                        backgroundColor: activeTool === 'eraser' ? '#64748B' : inkColor,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={strokeCount === 0}
              data-testid="ink-undo-btn"
              onClick={() => {
                void hapticLight();
                onUndoInk();
              }}
              title="Son Çizgiyi Geri Al"
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl px-2.5 text-xs font-extrabold hover:bg-slate-500/10 active:scale-95 disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Geri Al</span>
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
              className="inline-flex min-h-[34px] items-center gap-1 rounded-xl px-2.5 text-xs font-extrabold text-rose-600 hover:bg-rose-500/12 active:scale-95 disabled:opacity-35 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Temizle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
