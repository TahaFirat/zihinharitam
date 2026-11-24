import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Eraser, Undo2, Trash2, Sparkles, Check, Loader2 } from 'lucide-react';
import type { StickerAsset } from '../types/mindmap';
import { SketchToSticker, type SketchStroke } from '../core/visuals/SketchToSticker';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';

interface QuickSketchPopoverProps {
  isOpen: boolean;
  nodeTitle: string;
  onClose: () => void;
  onApplySticker: (sticker: StickerAsset) => void;
  onOpenAIStudio: () => void;
}

const INK_COLORS = [
  '#1E293B', // Koyu Mürekkep
  '#F43F5E', // Mercan
  '#0EA5E9', // Okyanus Mavisi
  '#10B981', // Zümrüt
  '#F59E0B', // Kehribar
  '#8B5CF6', // Mor
];

export const QuickSketchPopover: React.FC<QuickSketchPopoverProps> = ({
  isOpen,
  nodeTitle,
  onClose,
  onApplySticker,
  onOpenAIStudio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const currentStrokeRef = useRef<SketchStroke | null>(null);
  const activePenRef = useRef<boolean>(false);

  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [busy, setBusy] = useState(false);

  const redrawAll = useCallback((strokeList: SketchStroke[], liveStroke: SketchStroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = liveStroke ? [...strokeList, liveStroke] : strokeList;

    for (const st of all) {
      if (st.points.length === 0) continue;
      ctx.save();
      ctx.globalCompositeOperation = st.isEraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = st.color;
      ctx.fillStyle = st.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (st.points.length === 1) {
        const p = st.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, st.width * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length - 1; i++) {
        const midX = (st.points[i].x + st.points[i + 1].x) * 0.5;
        const midY = (st.points[i].y + st.points[i + 1].y) * 0.5;
        ctx.lineWidth = st.width * (0.7 + st.points[i].pressure * 0.6);
        ctx.quadraticCurveTo(st.points[i].x, st.points[i].y, midX, midY);
      }
      const last = st.points[st.points.length - 1];
      ctx.lineWidth = st.width;
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      redrawAll(strokes, null);
    }
  }, [isOpen, strokes, redrawAll]);

  if (!isOpen) return null;

  const getRawPointerPoint = (ev: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY,
      pressure: ev.pointerType === 'pen' ? Math.max(0.25, ev.pressure || 0.6) : 0.55,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      activePenRef.current = true;
    } else if (e.pointerType === 'touch' && activePenRef.current) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getRawPointerPoint(e.nativeEvent);
    currentStrokeRef.current = {
      color: inkColor,
      width: isEraser ? brushSize * 2.6 : brushSize,
      isEraser,
      points: [pt],
    };
    redrawAll(strokes, currentStrokeRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    if (e.pointerType === 'touch' && activePenRef.current) return;

    // Apple Pencil 120Hz/240Hz lossless sub-frame point capture via getCoalescedEvents()
    const coalesced =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const samples = coalesced.length > 0 ? coalesced : [e.nativeEvent];
    for (const sample of samples) {
      currentStrokeRef.current.points.push(getRawPointerPoint(sample));
    }
    redrawAll(strokes, currentStrokeRef.current);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      // 400ms palm rejection window after Apple Pencil lift
      window.setTimeout(() => {
        activePenRef.current = false;
      }, 400);
    }
    if (!currentStrokeRef.current) return;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const handleConvertDirectSticker = async () => {
    if (!canvasRef.current || strokes.length === 0) return;
    setBusy(true);
    void hapticLight();
    try {
      const sticker = await SketchToSticker.convertCanvasSketchToDieCutSticker(
        canvasRef.current,
        nodeTitle
      );
      onApplySticker(sticker);
      void hapticSuccess();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'max(22px, calc(var(--safe-bottom) + 14px))',
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <h3 className="text-sm font-extrabold">
            Hızlı Çizim
          </h3>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <div className="flex items-center gap-1.5">
            {INK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setInkColor(c);
                  setIsEraser(false);
                }}
                className={`h-6 w-6 rounded-full transition-transform ${
                  !isEraser && inkColor === c
                    ? 'scale-120 ring-2 ring-sky-500 ring-offset-2'
                    : 'opacity-80'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <input
              type="range"
              min={3}
              max={16}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-16 accent-sky-500"
              title="Kalem Kalınlığı"
            />
            <button
              type="button"
              onClick={() => setIsEraser((v) => !v)}
              title="Silgi"
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                isEraser ? 'bg-sky-500 text-white' : 'hover:bg-slate-500/10'
              }`}
            >
              <Eraser className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStrokes((prev) => prev.slice(0, -1))}
              disabled={strokes.length === 0}
              title="Geri Al"
              className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10 disabled:opacity-35"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              title="Temizle"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10 disabled:opacity-35"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div
            className="overflow-hidden rounded-2xl border-2 bg-white shadow-inner"
            style={{ borderColor: 'var(--hud-border)' }}
          >
            <canvas
              ref={canvasRef}
              width={360}
              height={260}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="canvas-touch-lock block h-56 w-full cursor-crosshair"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAIStudio();
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition-transform active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            3D Stüdyo
          </button>

          <button
            type="button"
            onClick={handleConvertDirectSticker}
            disabled={busy || strokes.length === 0}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-45"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Çizimi Çıkartmaya Çevir
          </button>
        </div>
      </div>
    </div>
  );
};
