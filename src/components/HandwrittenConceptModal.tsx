import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  X,
  Eraser,
  Undo2,
  Trash2,
  Check,
  PenTool,
  Type,
  Hand,
} from 'lucide-react';
import type {
  HandwrittenConceptAsset,
  HandwrittenConceptStroke,
} from '../types/mindmap';
import {
  ADAPTIVE_INK_DARK,
  ADAPTIVE_INK_LIGHT,
  buildHandwritingStrokePath,
  buildHandwrittenConceptAsset,
  hitTestHandwritingStroke,
  resolveHandwritingStrokeColor,
  simplifyHandwritingPoints,
} from '../core/canvas/HandwritingSvgRenderer';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { useI18n } from '../core/i18n/i18n';

interface HandwrittenConceptModalProps {
  isOpen: boolean;
  darkMode: boolean;
  nodeTitle: string;
  branchColor: string;
  initialHandwriting?: HandwrittenConceptAsset | null;
  onClose: () => void;
  onApplyHandwriting: (asset: HandwrittenConceptAsset, optionalTitle?: string) => void;
  onClearHandwriting: () => void;
}

const PAD_W = 720;
const PAD_H = 280;

const WIDTH_PRESETS = [
  { id: 'thin', label: 'İnce', width: 4 },
  { id: 'med', label: 'Orta', width: 6 },
  { id: 'bold', label: 'Kalın', width: 9 },
] as const;

const SIZE_PRESETS = [
  { id: 'sm', label: 'S', px: 48 },
  { id: 'md', label: 'M', px: 64 },
  { id: 'lg', label: 'L', px: 86 },
] as const;

export const HandwrittenConceptModal: React.FC<HandwrittenConceptModalProps> = ({
  isOpen,
  darkMode,
  nodeTitle,
  branchColor,
  initialHandwriting,
  onClose,
  onApplyHandwriting,
  onClearHandwriting,
}) => {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const livePathRef = useRef<SVGPathElement | null>(null);

  const [strokes, setStrokes] = useState<HandwrittenConceptStroke[]>([]);
  const [labelText, setLabelText] = useState(nodeTitle);
  const [selectedColor, setSelectedColor] = useState<string>('adaptive');
  const [penWidth, setPenWidth] = useState<number>(6);
  const [heightPx, setHeightPx] = useState<number>(64);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [stylusOnly, setStylusOnly] = useState<boolean>(false);

  const activeStrokeRef = useRef<HandwrittenConceptStroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const eraserDownRef = useRef<boolean>(false);
  const penLiftGuardRef = useRef<boolean>(false);

  const colorPalette = [
    {
      id: 'adaptive',
      label: t('Otomatik Mürekkep', 'Auto Ink'),
      swatch: darkMode ? ADAPTIVE_INK_DARK : ADAPTIVE_INK_LIGHT,
    },
    { id: branchColor, label: t('Dal Rengi', 'Branch Color'), swatch: branchColor },
    { id: '#0EA5E9', label: 'Mavi', swatch: '#0EA5E9' },
    { id: '#F43F5E', label: 'Mercan', swatch: '#F43F5E' },
    { id: '#10B981', label: 'Zümrüt', swatch: '#10B981' },
    { id: '#F59E0B', label: 'Kehribar', swatch: '#F59E0B' },
    { id: '#8B5CF6', label: 'Mor', swatch: '#8B5CF6' },
  ];

  // Hydrate existing strokes (if re-editing) or start fresh whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLabelText(nodeTitle || '');
    setIsEraser(false);
    if (initialHandwriting?.strokes?.length) {
      // Center existing strokes comfortably inside the 720x280 pad if they were drawn before
      const vb = initialHandwriting.viewBox;
      const fitsNaturally =
        vb &&
        vb.x >= -20 &&
        vb.y >= -20 &&
        vb.x + vb.w <= PAD_W + 20 &&
        vb.y + vb.h <= PAD_H + 20;
      if (fitsNaturally) {
        setStrokes(initialHandwriting.strokes);
      } else if (vb && vb.w > 0 && vb.h > 0) {
        const scale = Math.min((PAD_W * 0.78) / vb.w, (PAD_H * 0.72) / vb.h);
        const ox = (PAD_W - vb.w * scale) * 0.5 - vb.x * scale;
        const oy = (PAD_H - vb.h * scale) * 0.5 - vb.y * scale;
        setStrokes(
          initialHandwriting.strokes.map((st) => ({
            ...st,
            width: Math.max(3, Math.round(st.width * scale * 10) / 10),
            points: st.points.map(([x, y, p]) => [
              Math.round((x * scale + ox) * 10) / 10,
              Math.round((y * scale + oy) * 10) / 10,
              p,
            ]),
          }))
        );
      } else {
        setStrokes(initialHandwriting.strokes);
      }
      setHeightPx(initialHandwriting.heightPx ?? 64);
    } else {
      setStrokes([]);
      setHeightPx(64);
    }
  }, [isOpen, initialHandwriting, nodeTitle]);

  const toPadCoords = useCallback((ev: PointerEvent): [number, number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0, 0.5];
    const rect = svg.getBoundingClientRect();
    const sx = PAD_W / Math.max(1, rect.width);
    const sy = PAD_H / Math.max(1, rect.height);
    const x = Math.max(0, Math.min(PAD_W, (ev.clientX - rect.left) * sx));
    const y = Math.max(0, Math.min(PAD_H, (ev.clientY - rect.top) * sy));
    const pressure = ev.pointerType === 'pen' ? Math.max(0.25, ev.pressure || 0.6) : 0.55;
    return [x, y, pressure];
  }, []);

  if (!isOpen) return null;

  const isHardwareEraser = (ev: PointerEvent) =>
    ev.pointerType === 'eraser' ||
    (ev.pointerType === 'pen' &&
      ((ev.buttons & 32) !== 0 || (ev.buttons & 2) !== 0 || ev.button === 5 || ev.button === 2));

  const eraseAtPoint = (px: number, py: number) => {
    setStrokes((prev) => {
      const next = prev.filter((st) => !hitTestHandwritingStroke(st, px, py, 16));
      if (next.length !== prev.length) {
        void hapticLight();
        return next;
      }
      return prev;
    });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'pen') {
      penLiftGuardRef.current = true;
    } else if (e.pointerType === 'touch' && (stylusOnly || penLiftGuardRef.current)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;

    const pt = toPadCoords(e.nativeEvent);
    if (isEraser || isHardwareEraser(e.nativeEvent)) {
      eraserDownRef.current = true;
      eraseAtPoint(pt[0], pt[1]);
      return;
    }

    const isAdaptive = selectedColor === 'adaptive';
    const strokeColor = isAdaptive
      ? darkMode
        ? ADAPTIVE_INK_DARK
        : ADAPTIVE_INK_LIGHT
      : selectedColor;

    const fresh: HandwrittenConceptStroke = {
      color: strokeColor,
      width: penWidth,
      adaptive: isAdaptive,
      points: [pt],
    };
    activeStrokeRef.current = fresh;
    if (livePathRef.current) {
      livePathRef.current.setAttribute('d', buildHandwritingStrokePath(fresh.points));
      livePathRef.current.setAttribute('stroke', resolveHandwritingStrokeColor(fresh, darkMode));
      livePathRef.current.setAttribute('stroke-width', String(fresh.width));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    if (e.pointerType === 'touch' && (stylusOnly || penLiftGuardRef.current)) return;

    const coalesced =
      typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const samples = coalesced.length > 0 ? coalesced : [e.nativeEvent];

    if (eraserDownRef.current) {
      for (const s of samples) {
        const pt = toPadCoords(s);
        eraseAtPoint(pt[0], pt[1]);
      }
      return;
    }

    const st = activeStrokeRef.current;
    if (!st) return;

    for (const s of samples) {
      const pt = toPadCoords(s);
      const last = st.points[st.points.length - 1];
      if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 1.5) {
        st.points.push(pt);
      }
    }
    if (livePathRef.current) {
      livePathRef.current.setAttribute('d', buildHandwritingStrokePath(st.points));
    }
  };

  const finishPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'pen') {
      window.setTimeout(() => {
        penLiftGuardRef.current = false;
      }, 400);
    }
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;

    if (eraserDownRef.current) {
      eraserDownRef.current = false;
      return;
    }

    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (livePathRef.current) {
      livePathRef.current.setAttribute('d', '');
    }
    if (finished && finished.points.length > 0) {
      setStrokes((prev) => [
        ...prev,
        {
          ...finished,
          points: simplifyHandwritingPoints(finished.points),
        },
      ]);
    }
  };

  const handleSave = () => {
    if (strokes.length === 0) {
      onClearHandwriting();
      onClose();
      return;
    }
    const asset = buildHandwrittenConceptAsset(strokes, heightPx);
    if (!asset) {
      onClearHandwriting();
      onClose();
      return;
    }
    void hapticSuccess();
    onApplyHandwriting(asset, labelText.trim() || undefined);
    onClose();
  };

  const handleRevertToTextBox = () => {
    void hapticLight();
    onClearHandwriting();
    onClose();
  };

  const hasExisting = Boolean(initialHandwriting?.strokes?.length);

  return (
    <div
      data-testid="handwriting-concept-modal"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'max(18px, calc(var(--safe-bottom) + 12px))',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: branchColor }}
            >
              <PenTool className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold sm:text-base">
                {t('El Yazısı Kavram', 'Handwritten Concept')}
              </h3>
              <p className="truncate text-[11px] font-semibold opacity-70">
                {t(
                  'Kutu yerine doğrudan kendi el yazın dalın üzerinde görünür',
                  'Your own handwriting replaces the text box directly on the branch'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('Kapat', 'Close')}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-2 sm:px-5">
          {/* Toolbar Row: Colors + Pen Width + Eraser + Undo + Clear + Stylus-Only */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Ink Color Swatches */}
            <div className="flex items-center gap-1.5 rounded-2xl bg-slate-500/10 px-2.5 py-1.5">
              {colorPalette.map((item) => {
                const active = !isEraser && selectedColor === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      void hapticLight();
                      setSelectedColor(item.id);
                      setIsEraser(false);
                    }}
                    className={`h-6 w-6 rounded-full border transition-transform ${
                      active
                        ? 'scale-120 ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-slate-900'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: item.swatch,
                      borderColor: darkMode ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.18)',
                    }}
                  />
                );
              })}
            </div>

            {/* Pen Width + Eraser + Undo + Clear */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5">
                {WIDTH_PRESETS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setPenWidth(w.width);
                      setIsEraser(false);
                    }}
                    className={`rounded-lg px-2 py-1 text-[11px] font-extrabold transition ${
                      !isEraser && penWidth === w.width
                        ? 'bg-sky-500 text-white shadow-2xs'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-testid="handwriting-eraser-btn"
                onClick={() => {
                  void hapticLight();
                  setIsEraser((v) => !v);
                }}
                title={t('Çizgi Silgisi', 'Stroke Eraser')}
                className={`inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-[11px] font-extrabold transition ${
                  isEraser
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-slate-500/10 hover:bg-slate-500/18'
                }`}
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>{t('Silgi', 'Eraser')}</span>
              </button>

              <button
                type="button"
                data-testid="handwriting-undo-btn"
                disabled={strokes.length === 0}
                onClick={() => {
                  void hapticLight();
                  setStrokes((prev) => prev.slice(0, -1));
                }}
                title={t('Geri Al', 'Undo')}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/10 hover:bg-slate-500/18 disabled:opacity-35"
              >
                <Undo2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                data-testid="handwriting-clear-btn"
                disabled={strokes.length === 0}
                onClick={() => {
                  void hapticLight();
                  setStrokes([]);
                }}
                title={t('Temizle', 'Clear')}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 hover:bg-rose-500/20 disabled:opacity-35 dark:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  void hapticLight();
                  setStylusOnly((v) => !v);
                }}
                title={t('Avuç İçi Koruması (Yalnızca Kalem)', 'Palm Rejection (Stylus Only)')}
                className={`inline-flex h-8 items-center gap-1 rounded-xl px-2 text-[10.5px] font-extrabold transition ${
                  stylusOnly
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-500/10 opacity-75 hover:opacity-100'
                }`}
              >
                <Hand className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('Sadece Kalem', 'Stylus Only')}</span>
              </button>
            </div>
          </div>

          {/* Wide, Responsive Vector Handwriting Pad with Subtle Notebook Guides */}
          <div
            className="relative overflow-hidden rounded-2xl border-2 shadow-inner"
            style={{
              borderColor: isEraser ? '#F43F5E' : `${branchColor}80`,
              backgroundColor: darkMode ? '#0F141D' : '#FAF9F5',
            }}
          >
            <svg
              ref={svgRef}
              data-testid="handwriting-pad-svg"
              viewBox={`0 0 ${PAD_W} ${PAD_H}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointer}
              onPointerCancel={finishPointer}
              className={`canvas-touch-lock block aspect-[720/280] w-full select-none ${
                isEraser ? 'cursor-cell' : 'cursor-crosshair'
              }`}
              style={{ touchAction: 'none' }}
            >
              {/* Subtle writing baselines (visual guides only — never saved to strokes!) */}
              <line
                x1="28"
                y1="95"
                x2={PAD_W - 28}
                y2="95"
                stroke={darkMode ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)'}
                strokeDasharray="6 6"
                strokeWidth="1.2"
              />
              <line
                x1="28"
                y1="185"
                x2={PAD_W - 28}
                y2="185"
                stroke={darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.14)'}
                strokeWidth="1.4"
              />
              {/* Branch-colored decorative hint under baseline */}
              <line
                x1={PAD_W * 0.25}
                y1="215"
                x2={PAD_W * 0.75}
                y2="215"
                stroke={branchColor}
                strokeOpacity="0.28"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Committed Vector Strokes */}
              {strokes.map((st, idx) => (
                <path
                  key={idx}
                  d={buildHandwritingStrokePath(st.points)}
                  fill="none"
                  stroke={resolveHandwritingStrokeColor(st, darkMode)}
                  strokeWidth={st.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* Active 120Hz Live Stroke */}
              <path
                ref={livePathRef}
                d=""
                fill="none"
                stroke={darkMode ? ADAPTIVE_INK_DARK : ADAPTIVE_INK_LIGHT}
                strokeWidth={penWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {strokes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-slate-500/10 px-3.5 py-1.5 text-xs font-extrabold opacity-60">
                  ✍️ {t('Kavramı kalemle veya parmağınla buraya yaz...', 'Write your concept here with stylus or finger...')}
                </span>
              </div>
            )}
          </div>

          {/* Size Preset + Optional Search/Outline Label */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-500/10 p-1">
              <span className="px-1.5 text-[11px] font-extrabold opacity-75">
                {t('Yazı Boyutu:', 'Size:')}
              </span>
              {SIZE_PRESETS.map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  data-testid={`handwriting-size-${sz.id}`}
                  onClick={() => {
                    void hapticLight();
                    setHeightPx(sz.px);
                  }}
                  className={`min-w-[30px] rounded-lg px-2 py-1 text-[11px] font-black transition ${
                    heightPx === sz.px
                      ? 'bg-sky-500 text-white shadow-2xs'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            <div className="flex min-w-[200px] flex-1 items-center gap-1.5 rounded-xl border px-2.5 py-1.5" style={{ borderColor: 'var(--hud-border)' }}>
              <Type className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <input
                type="text"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder={t('Arama/Özet etiketi (isteğe bağlı)...', 'Search/Outline label (optional)...')}
                className="allow-text-input min-w-0 flex-1 bg-transparent text-xs font-bold outline-none"
                style={{ color: 'var(--node-text)' }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 pt-3 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          {hasExisting ? (
            <button
              type="button"
              data-testid="handwriting-revert-text-btn"
              onClick={handleRevertToTextBox}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-400/35 bg-slate-500/10 px-3.5 py-2.5 text-xs font-extrabold hover:bg-slate-500/18 active:scale-95"
            >
              <Type className="h-4 w-4" />
              <span>{t('Metin Kutusuna Dön', 'Switch Back to Text Box')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-bold opacity-80 hover:bg-slate-500/10 hover:opacity-100"
            >
              {t('Vazgeç', 'Cancel')}
            </button>
          )}

          <button
            type="button"
            data-testid="handwriting-apply-btn"
            disabled={strokes.length === 0}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform active:scale-95 disabled:opacity-45"
          >
            <Check className="h-4 w-4" />
            <span>{t('El Yazısını Uygula', 'Apply Handwriting')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
