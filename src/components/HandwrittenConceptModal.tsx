import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Check,
  PenTool,
  Highlighter,
  Type,
  Hand,
  Maximize2,
  Minimize2,
  Plus,
  Grid3X3,
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
  resolveHandwritingStrokeOpacity,
  simplifyHandwritingPoints,
  sortHandwritingStrokesForPaint,
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

const PAD_W = 860;
const BASE_PAD_H = 380;
const MAX_PAD_H = 1480;
const LINE_STEP = 52;

type PaperGuideMode = 'lined' | 'grid' | 'dots' | 'blank';
type ActivePadTool = 'pen' | 'highlighter' | 'eraser';

const PEN_WIDTH_PRESETS = [
  { id: 'xfine', label: '0.3', width: 1.5 },
  { id: 'fine', label: '0.5', width: 2.4 },
  { id: 'med', label: '0.8', width: 3.8 },
  { id: 'bold', label: '1.5', width: 6.0 },
] as const;

const SIZE_SCALES = [
  { id: 'sm', label: 'S', scale: 0.78 },
  { id: 'md', label: 'M', scale: 1.0 },
  { id: 'lg', label: 'L', scale: 1.32 },
  { id: 'xl', label: 'XL', scale: 1.72 },
] as const;

const PAPER_GUIDE_ORDER: PaperGuideMode[] = ['lined', 'grid', 'dots', 'blank'];
const PAPER_GUIDE_LABELS: Record<PaperGuideMode, string> = {
  lined: 'Çizgili',
  grid: 'Kareli',
  dots: 'Noktalı',
  blank: 'Düz',
};

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
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);
  const livePathRef = useRef<SVGPathElement | null>(null);

  const [strokes, setStrokes] = useState<HandwrittenConceptStroke[]>([]);
  const [redoStack, setRedoStack] = useState<HandwrittenConceptStroke[]>([]);
  const [labelText, setLabelText] = useState(nodeTitle);
  const [padHeight, setPadHeight] = useState<number>(BASE_PAD_H);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [paperGuide, setPaperGuide] = useState<PaperGuideMode>('lined');
  const [activeTool, setActiveTool] = useState<ActivePadTool>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('adaptive');
  const [penWidth, setPenWidth] = useState<number>(2.4); // Crisp 0.5mm fine gel pen default!
  const [sizeScale, setSizeScale] = useState<number>(1.0);
  const [stylusOnly, setStylusOnly] = useState<boolean>(false);

  const activeStrokeRef = useRef<HandwrittenConceptStroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const eraserDownRef = useRef<boolean>(false);
  const penLiftGuardRef = useRef<boolean>(false);

  const colorPalette = useMemo(
    () => [
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
    ],
    [branchColor, darkMode, t]
  );

  // Hydrate existing strokes (if re-editing) cleanly without ever clipping multi-line content!
  useEffect(() => {
    if (!isOpen) return;
    setLabelText(nodeTitle || '');
    setActiveTool('pen');
    setRedoStack([]);
    setPaperGuide(initialHandwriting?.paperGuide ?? 'lined');

    if (initialHandwriting?.strokes?.length) {
      let maxY = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      for (const st of initialHandwriting.strokes) {
        for (const [x, y] of st.points) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      const fitsWidth = minX >= -10 && maxX <= PAD_W + 10;
      if (fitsWidth) {
        setStrokes(initialHandwriting.strokes);
        setPadHeight(Math.min(MAX_PAD_H, Math.max(BASE_PAD_H, Math.ceil((maxY + 120) / 80) * 80)));
      } else {
        const vb = initialHandwriting.viewBox;
        const scale = Math.min(1, (PAD_W * 0.86) / Math.max(1, vb.w));
        const ox = (PAD_W - vb.w * scale) * 0.5 - vb.x * scale;
        const oy = 44 - vb.y * scale;
        const scaled = initialHandwriting.strokes.map((st) => ({
          ...st,
          width: Math.max(1.2, Math.round(st.width * scale * 10) / 10),
          points: st.points.map(([x, y, p]): [number, number, number] => [
            Math.round((x * scale + ox) * 10) / 10,
            Math.round((y * scale + oy) * 10) / 10,
            p,
          ]),
        }));
        setStrokes(scaled);
        setPadHeight(Math.min(MAX_PAD_H, Math.max(BASE_PAD_H, Math.ceil(vb.h * scale + 160))));
      }
      setSizeScale(initialHandwriting.sizeScale ?? 1.0);
    } else {
      setStrokes([]);
      setPadHeight(BASE_PAD_H);
      setSizeScale(1.0);
    }
  }, [isOpen, initialHandwriting, nodeTitle]);

  const toPadCoords = useCallback(
    (ev: PointerEvent): [number, number, number] => {
      const svg = svgRef.current;
      if (!svg) return [0, 0, 0.5];
      const rect = svg.getBoundingClientRect();
      const sx = PAD_W / Math.max(1, rect.width);
      const sy = padHeight / Math.max(1, rect.height);
      const x = Math.max(0, Math.min(PAD_W, (ev.clientX - rect.left) * sx));
      const y = Math.max(0, Math.min(padHeight, (ev.clientY - rect.top) * sy));
      const pressure = ev.pointerType === 'pen' ? Math.max(0.25, ev.pressure || 0.6) : 0.55;
      return [x, y, pressure];
    },
    [padHeight]
  );

  const orderedCommittedStrokes = useMemo(
    () => sortHandwritingStrokesForPaint(strokes),
    [strokes]
  );

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

  const handleExpandWritingArea = () => {
    void hapticLight();
    setPadHeight((h) => {
      const next = Math.min(MAX_PAD_H, h + 208);
      window.setTimeout(() => {
        if (scrollWrapRef.current) {
          scrollWrapRef.current.scrollTo({
            top: scrollWrapRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 40);
      return next;
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
    if (activeTool === 'eraser' || isHardwareEraser(e.nativeEvent)) {
      eraserDownRef.current = true;
      eraseAtPoint(pt[0], pt[1]);
      return;
    }

    const isHighlighter = activeTool === 'highlighter';
    const isAdaptive = !isHighlighter && selectedColor === 'adaptive';
    const strokeColor = isHighlighter
      ? selectedColor === 'adaptive'
        ? '#FACC15'
        : selectedColor
      : isAdaptive
      ? darkMode
        ? ADAPTIVE_INK_DARK
        : ADAPTIVE_INK_LIGHT
      : selectedColor;
    const effectiveWidth = isHighlighter ? Math.max(14, penWidth * 4.5) : penWidth;

    const fresh: HandwrittenConceptStroke = {
      color: strokeColor,
      width: effectiveWidth,
      adaptive: isAdaptive,
      tool: isHighlighter ? 'highlighter' : 'pen',
      opacity: isHighlighter ? 0.34 : 1,
      points: [pt],
    };
    activeStrokeRef.current = fresh;
    if (livePathRef.current) {
      livePathRef.current.setAttribute('d', buildHandwritingStrokePath(fresh.points));
      livePathRef.current.setAttribute('stroke', resolveHandwritingStrokeColor(fresh, darkMode));
      livePathRef.current.setAttribute('stroke-opacity', String(resolveHandwritingStrokeOpacity(fresh)));
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
      if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 1.3) {
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
      const simplified = simplifyHandwritingPoints(finished.points);
      let maxStrokeY = 0;
      for (const [, y] of simplified) {
        if (y > maxStrokeY) maxStrokeY = y;
      }
      setStrokes((prev) => [...prev, { ...finished, points: simplified }]);
      setRedoStack([]);
      // Auto-expand writing paper seamlessly when user writes near the bottom edge!
      if (maxStrokeY > padHeight - 72 && padHeight < MAX_PAD_H) {
        setPadHeight((h) => Math.min(MAX_PAD_H, h + 180));
      }
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    void hapticLight();
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    void hapticLight();
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, restored]);
  };

  const handleSave = () => {
    if (strokes.length === 0) {
      onClearHandwriting();
      onClose();
      return;
    }
    const asset = buildHandwrittenConceptAsset(strokes, {
      sizeScale,
      renderWidthPx: initialHandwriting?.renderWidthPx,
      paperGuide,
    });
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
  const lineCount = Math.floor((padHeight - 40) / LINE_STEP);
  const guideStroke = darkMode ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.10)';

  return (
    <div
      data-testid="handwriting-concept-modal"
      className={`fixed inset-0 z-50 flex justify-center bg-slate-950/55 backdrop-blur-xs ${
        isFullscreen ? 'items-stretch p-0' : 'items-end p-0 sm:items-center sm:p-4'
      }`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col overflow-hidden border shadow-2xl transition-all ${
          isFullscreen
            ? 'h-full w-full rounded-none'
            : 'max-h-[95dvh] w-full max-w-3xl rounded-t-3xl sm:rounded-3xl'
        }`}
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingTop: isFullscreen ? 'max(8px, var(--safe-top))' : undefined,
          paddingBottom: 'max(14px, calc(var(--safe-bottom) + 10px))',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: branchColor }}
            >
              <PenTool className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold sm:text-base">
                {t('El Yazısı Kavram', 'Handwritten Concept')}
              </h3>
              <p className="truncate text-[11px] font-semibold opacity-70">
                {t(
                  'İstediğin kadar satır yaz — alan aşağı doğru otomatik genişler',
                  'Write as many lines as you need — sheet auto-expands downward'
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-testid="handwriting-fullscreen-btn"
              onClick={() => {
                void hapticLight();
                setIsFullscreen((v) => !v);
              }}
              title={isFullscreen ? t('Küçült', 'Exit Fullscreen') : t('Tam Ekran Yaz', 'Full-Screen Writing')}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-500/10 px-2.5 text-xs font-extrabold hover:bg-slate-500/18"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{isFullscreen ? t('Normal', 'Normal') : t('Tam Ekran', 'Fullscreen')}</span>
            </button>
            <button
              type="button"
              aria-label={t('Kapat', 'Close')}
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Rich Fine-Pen & Paper Controls */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          {/* Tool Selector (Pen / Highlighter / Eraser) + Ink Colors */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5">
              <button
                type="button"
                data-testid="handwriting-pen-btn"
                onClick={() => {
                  void hapticLight();
                  setActiveTool('pen');
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold transition ${
                  activeTool === 'pen' ? 'bg-sky-500 text-white shadow-2xs' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>{t('Kalem', 'Pen')}</span>
              </button>
              <button
                type="button"
                data-testid="handwriting-highlighter-btn"
                onClick={() => {
                  void hapticLight();
                  setActiveTool('highlighter');
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold transition ${
                  activeTool === 'highlighter'
                    ? 'bg-amber-400 text-slate-950 shadow-2xs'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <Highlighter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('Fosforlu', 'Marker')}</span>
              </button>
              <button
                type="button"
                data-testid="handwriting-eraser-btn"
                onClick={() => {
                  void hapticLight();
                  setActiveTool((cur) => (cur === 'eraser' ? 'pen' : 'eraser'));
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold transition ${
                  activeTool === 'eraser' ? 'bg-rose-500 text-white shadow-2xs' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>{t('Silgi', 'Eraser')}</span>
              </button>
            </div>

            {/* Color Swatches */}
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-500/10 px-2 py-1">
              {colorPalette.map((item) => {
                const active = activeTool !== 'eraser' && selectedColor === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => {
                      void hapticLight();
                      setSelectedColor(item.id);
                      if (activeTool === 'eraser') setActiveTool('pen');
                    }}
                    className={`h-5.5 w-5.5 rounded-full border transition-transform ${
                      active
                        ? 'scale-120 ring-2 ring-sky-500 ring-offset-1 dark:ring-offset-slate-900'
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
          </div>

          {/* Precision Fine Tip Presets + Slider + Undo/Redo/Clear/Guide/Stylus */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-500/10 px-2 py-1">
              {/* Live tip thickness dot preview */}
              <span
                aria-hidden="true"
                className="inline-block shrink-0 rounded-full"
                style={{
                  width: `${Math.max(4, Math.min(14, penWidth * 1.9))}px`,
                  height: `${Math.max(4, Math.min(14, penWidth * 1.9))}px`,
                  backgroundColor:
                    selectedColor === 'adaptive'
                      ? darkMode
                        ? ADAPTIVE_INK_DARK
                        : ADAPTIVE_INK_LIGHT
                      : selectedColor,
                }}
              />
              {PEN_WIDTH_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`handwriting-tip-${p.id}`}
                  onClick={() => {
                    setPenWidth(p.width);
                    if (activeTool === 'eraser') setActiveTool('pen');
                  }}
                  className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold transition ${
                    activeTool !== 'eraser' && Math.abs(penWidth - p.width) < 0.25
                      ? 'bg-sky-500 text-white'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="range"
                data-testid="handwriting-width-slider"
                min={1.0}
                max={8.0}
                step={0.2}
                value={penWidth}
                onChange={(e) => {
                  setPenWidth(Number(e.target.value));
                  if (activeTool === 'eraser') setActiveTool('pen');
                }}
                title={`${t('Kalem Kalınlığı', 'Tip Width')}: ${penWidth.toFixed(1)}`}
                className="ml-0.5 w-14 accent-sky-500"
              />
            </div>

            <button
              type="button"
              data-testid="handwriting-guide-btn"
              onClick={() => {
                void hapticLight();
                setPaperGuide(
                  (cur) => PAPER_GUIDE_ORDER[(PAPER_GUIDE_ORDER.indexOf(cur) + 1) % PAPER_GUIDE_ORDER.length]
                );
              }}
              title={t('Kağıt Deseni', 'Paper Guide')}
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-slate-500/10 px-2 text-[10.5px] font-extrabold hover:bg-slate-500/18"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              <span>{PAPER_GUIDE_LABELS[paperGuide]}</span>
            </button>

            <button
              type="button"
              data-testid="handwriting-undo-btn"
              disabled={strokes.length === 0}
              onClick={handleUndo}
              title={t('Geri Al', 'Undo')}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/10 hover:bg-slate-500/18 disabled:opacity-35"
            >
              <Undo2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              data-testid="handwriting-redo-btn"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title={t('Yinele', 'Redo')}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/10 hover:bg-slate-500/18 disabled:opacity-35"
            >
              <Redo2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              data-testid="handwriting-clear-btn"
              disabled={strokes.length === 0}
              onClick={() => {
                void hapticLight();
                setStrokes([]);
                setRedoStack([]);
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
              title={t('Avuç İçi Koruması (Sadece Kalem)', 'Palm Rejection (Stylus Only)')}
              className={`inline-flex h-8 items-center gap-1 rounded-xl px-2 text-[10.5px] font-extrabold transition ${
                stylusOnly
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-500/10 opacity-75 hover:opacity-100'
              }`}
            >
              <Hand className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t('Sadece Kalem', 'Stylus Only')}</span>
            </button>
          </div>
        </div>

        {/* Scrollable, Auto-Expanding Multi-Line Vector Writing Sheet! */}
        <div
          ref={scrollWrapRef}
          className={`min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 ${
            isFullscreen ? '' : 'max-h-[54vh]'
          }`}
        >
          <div
            className="relative overflow-hidden rounded-2xl border-2 shadow-inner"
            style={{
              borderColor: activeTool === 'eraser' ? '#F43F5E' : `${branchColor}75`,
              backgroundColor: darkMode ? '#0F141D' : '#FAF9F5',
            }}
          >
            <svg
              ref={svgRef}
              data-testid="handwriting-pad-svg"
              viewBox={`0 0 ${PAD_W} ${padHeight}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointer}
              onPointerCancel={finishPointer}
              className={`canvas-touch-lock block w-full select-none ${
                activeTool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'
              }`}
              style={{
                aspectRatio: `${PAD_W} / ${padHeight}`,
                touchAction: 'none',
              }}
            >
              {/* Notebook Paper Guides (visual aids only — never saved to strokes!) */}
              {paperGuide === 'lined' &&
                Array.from({ length: lineCount }, (_, i) => {
                  const y = 64 + i * LINE_STEP;
                  return (
                    <line
                      key={i}
                      x1="24"
                      y1={y}
                      x2={PAD_W - 24}
                      y2={y}
                      stroke={guideStroke}
                      strokeWidth="1.2"
                    />
                  );
                })}
              {paperGuide === 'grid' && (
                <defs>
                  <pattern id="zh-hw-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                    <path
                      d="M 36 0 L 0 0 0 36"
                      fill="none"
                      stroke={guideStroke}
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
              )}
              {paperGuide === 'grid' && (
                <rect x="0" y="0" width={PAD_W} height={padHeight} fill="url(#zh-hw-grid)" />
              )}
              {paperGuide === 'dots' && (
                <defs>
                  <pattern id="zh-hw-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle
                      cx="14"
                      cy="14"
                      r="1.4"
                      fill={darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(15,23,42,0.18)'}
                    />
                  </pattern>
                </defs>
              )}
              {paperGuide === 'dots' && (
                <rect x="0" y="0" width={PAD_W} height={padHeight} fill="url(#zh-hw-dots)" />
              )}

              {/* Committed Vector Strokes (Highlighters beneath crisp Ink!) */}
              {orderedCommittedStrokes.map((st, idx) => (
                <path
                  key={idx}
                  d={buildHandwritingStrokePath(st.points)}
                  fill="none"
                  stroke={resolveHandwritingStrokeColor(st, darkMode)}
                  strokeOpacity={resolveHandwritingStrokeOpacity(st)}
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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center">
                <span className="rounded-full bg-slate-500/10 px-4 py-1.5 text-xs font-extrabold opacity-65">
                  ✍️ {t('İnce uçlu kalemle istediğin kadar satır yaz — alan otomatik büyür', 'Write freely with fine ink — sheet expands as you write')}
                </span>
              </div>
            )}
          </div>

          {/* Expand More Lines Row */}
          {padHeight < MAX_PAD_H && (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                data-testid="handwriting-expand-area-btn"
                onClick={handleExpandWritingArea}
                className="inline-flex items-center gap-1 rounded-xl border border-dashed border-sky-500/45 bg-sky-500/8 px-3.5 py-1.5 text-[11px] font-extrabold text-sky-700 transition hover:bg-sky-500/15 active:scale-95 dark:text-sky-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('Daha Fazla Satır Ekle (+Alan)', 'Add More Writing Lines (+Space)')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Metadata Row: Canvas Size Scale + Optional Search Label */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-500/10 p-1">
            <span className="px-1.5 text-[11px] font-extrabold opacity-75">
              {t('Harita Boyutu:', 'Map Size:')}
            </span>
            {SIZE_SCALES.map((sz) => (
              <button
                key={sz.id}
                type="button"
                data-testid={`handwriting-size-${sz.id}`}
                onClick={() => {
                  void hapticLight();
                  setSizeScale(sz.scale);
                }}
                className={`min-w-[28px] rounded-lg px-2 py-1 text-[11px] font-black transition ${
                  Math.abs(sizeScale - sz.scale) < 0.05
                    ? 'bg-sky-500 text-white shadow-2xs'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>

          <div
            className="flex min-w-[180px] flex-1 items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
            style={{ borderColor: 'var(--hud-border)' }}
          >
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

        {/* Footer Actions */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 pt-2.5 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          {hasExisting ? (
            <button
              type="button"
              data-testid="handwriting-revert-text-btn"
              onClick={handleRevertToTextBox}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-400/35 bg-slate-500/10 px-3.5 py-2 text-xs font-extrabold hover:bg-slate-500/18 active:scale-95"
            >
              <Type className="h-4 w-4" />
              <span>{t('Metin Kutusuna Dön', 'Switch Back to Text Box')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold opacity-80 hover:bg-slate-500/10 hover:opacity-100"
            >
              {t('Vazgeç', 'Cancel')}
            </button>
          )}

          <button
            type="button"
            data-testid="handwriting-apply-btn"
            disabled={strokes.length === 0}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-2 text-xs font-extrabold text-white shadow-md transition-transform active:scale-95 disabled:opacity-45"
          >
            <Check className="h-4 w-4" />
            <span>{t('El Yazısını Uygula', 'Apply Handwriting')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
