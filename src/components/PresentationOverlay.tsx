import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Presentation,
  X,
} from 'lucide-react';
import type { MindMapDocument, MindNode } from '../types/mindmap';
import { useI18n } from '../core/i18n/i18n';
import { hapticLight } from '../core/native/NativeBridge';

interface PresentationOverlayProps {
  isOpen: boolean;
  doc: MindMapDocument;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
}

export const PresentationOverlay: React.FC<PresentationOverlayProps> = ({
  isOpen,
  doc,
  onFocusNode,
  onClose,
}) => {
  const { t } = useI18n();
  const [slideIdx, setSlideIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  const slides = useMemo<Array<{ node: MindNode; trail: string[] }>>(() => {
    const out: Array<{ node: MindNode; trail: string[] }> = [];
    const visited = new Set<string>();
    const walk = (id: string, trail: string[]) => {
      if (visited.has(id)) return;
      const n = doc.nodes[id];
      if (!n) return;
      visited.add(id);
      out.push({ node: n, trail });
      const kids = Object.values(doc.nodes).filter((c) => c.parentId === id);
      for (const k of kids) {
        walk(k.id, [...trail, n.title]);
      }
    };
    walk(doc.rootNodeId, []);
    return out;
  }, [doc]);

  useEffect(() => {
    if (!isOpen) {
      setAutoPlay(false);
      return;
    }
    setSlideIdx(0);
  }, [isOpen, doc.id]);

  useEffect(() => {
    if (!isOpen || !slides[slideIdx]) return;
    onFocusNode(slides[slideIdx].node.id);
  }, [isOpen, slideIdx, slides, onFocusNode]);

  useEffect(() => {
    if (!isOpen || !autoPlay) return;
    const timer = window.setInterval(() => {
      setSlideIdx((i) => (i + 1 < slides.length ? i + 1 : 0));
    }, 4500);
    return () => window.clearInterval(timer);
  }, [isOpen, autoPlay, slides.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setSlideIdx((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlideIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, slides.length]);

  if (!isOpen || !slides.length) return null;

  const cur = slides[Math.min(slideIdx, slides.length - 1)];
  const pct = Math.round(((slideIdx + 1) / slides.length) * 100);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[48] flex flex-col justify-between p-3 sm:p-5"
      style={{
        paddingTop: 'max(14px, calc(var(--safe-top) + 10px))',
        paddingBottom: 'max(16px, calc(var(--safe-bottom) + 12px))',
      }}
      data-testid="presentation-overlay"
    >
      {/* Top Floating Presenter Pill */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-extrabold shadow-lg backdrop-blur-md"
          style={{
            backgroundColor: 'var(--hud-bg)',
            borderColor: 'var(--hud-border)',
            color: 'var(--text-primary)',
          }}
        >
          <Presentation className="h-4 w-4 text-amber-500" />
          <span>{t('Sunum Modu', 'Pitch Mode')}</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
            {slideIdx + 1} / {slides.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          data-testid="presentation-exit-btn"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg backdrop-blur-md transition hover:bg-slate-800 active:scale-95"
        >
          <X className="h-4 w-4" />
          <span>{t('Sunumu Bitir', 'Exit Pitch')}</span>
        </button>
      </div>

      {/* Bottom Cinematic Speaker Card & Navigation */}
      <div
        className="pointer-events-auto mx-auto w-full max-w-[600px] rounded-3xl border p-4 shadow-2xl backdrop-blur-md"
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-500/15">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: cur.node.branchColor }}
          />
        </div>

        <div className="mt-3 flex items-start gap-3">
          {cur.node.sticker && (
            <img
              src={cur.node.sticker.url}
              alt={cur.node.title}
              className="h-12 w-12 shrink-0 rounded-2xl bg-white/80 p-1 object-contain shadow-xs dark:bg-slate-800/80"
            />
          )}
          <div className="min-w-0 flex-1">
            {cur.trail.length > 0 && (
              <div
                className="truncate text-[10.5px] font-bold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {cur.trail.join(' › ')}
              </div>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h3 className="text-base leading-snug font-black sm:text-lg">
                {cur.node.title}
              </h3>
              {cur.node.techBadge && (
                <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold text-sky-600 dark:text-sky-300">
                  {cur.node.techBadge}
                </span>
              )}
            </div>
            {cur.node.subtitle && (
              <p className="mt-1 text-xs font-semibold opacity-85">{cur.node.subtitle}</p>
            )}
            {cur.node.note && (
              <p
                className="mt-1.5 line-clamp-3 text-xs leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {cur.node.note}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={slideIdx === 0}
            onClick={() => {
              void hapticLight();
              setSlideIdx((i) => Math.max(0, i - 1));
            }}
            data-testid="presentation-prev-btn"
            className="inline-flex h-10 items-center gap-1 rounded-2xl border px-3.5 text-xs font-extrabold transition hover:bg-slate-500/10 disabled:opacity-35"
            style={{ borderColor: 'var(--hud-border)' }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{t('Önceki', 'Prev')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void hapticLight();
              setAutoPlay((p) => !p);
            }}
            className={`inline-flex h-10 items-center gap-1.5 rounded-2xl px-3.5 text-xs font-extrabold transition ${
              autoPlay
                ? 'bg-amber-500 text-slate-950'
                : 'border hover:bg-slate-500/10'
            }`}
            style={autoPlay ? undefined : { borderColor: 'var(--hud-border)' }}
          >
            {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{autoPlay ? t('Duraklat', 'Pause') : t('Otomatik', 'Auto')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void hapticLight();
              if (slideIdx + 1 >= slides.length) {
                onClose();
              } else {
                setSlideIdx((i) => i + 1);
              }
            }}
            data-testid="presentation-next-btn"
            className="inline-flex h-10 items-center gap-1 rounded-2xl bg-slate-900 px-4 text-xs font-extrabold text-white transition active:scale-95 dark:bg-amber-500 dark:text-slate-950"
          >
            <span>
              {slideIdx + 1 >= slides.length ? t('Bitir', 'Finish') : t('Sonraki', 'Next')}
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
