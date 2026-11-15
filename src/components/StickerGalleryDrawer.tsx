import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Sparkles,
  Palette,
  Loader2,
  Layers,
  Zap,
} from 'lucide-react';
import type {
  GalleryCategoryFilter,
  MetaphorChip,
  StickerAsset,
  VisualSearchResult,
} from '../types/mindmap';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import { CORNER_MICRO_BADGES } from '../core/visuals/CompositeStickerComposer';
import { retintRawSvgMarkupToBranch } from '../core/visuals/DuotoneStickerColorizer';
import { buildDuotoneVectorStickerDataUri } from '../core/visuals/PureVectorStickerizer';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';

interface StickerGalleryDrawerProps {
  isOpen: boolean;
  initialQuery: string;
  branchColor: string;
  mapContext: MapContextAnalysis;
  onClose: () => void;
  onApplySticker: (sticker: StickerAsset) => void;
  onRequestProStickerUnlock: (item: VisualSearchResult) => void;
  onOpenAIStudio: (query: string) => void;
}

const CATEGORY_TABS: Array<{ id: GalleryCategoryFilter; label: string; emoji: string }> = [
  { id: 'all', label: 'Tümü', emoji: '🌟' },
  { id: 'system_arch', label: 'Sistem & Mimari', emoji: '🖧' },
  { id: 'hand_drawn', label: 'El Çizimi', emoji: '🎨' },
  { id: 'medical_academic', label: 'Akademik & Bilim', emoji: '🩺' },
  { id: '3d_color', label: '3D & Renkli', emoji: '🧊' },
  { id: 'diagram', label: 'Şema & Diyagram', emoji: '📐' },
  { id: 'photo', label: 'Fotoğraf', emoji: '📷' },
];

export const StickerGalleryDrawer: React.FC<StickerGalleryDrawerProps> = ({
  isOpen,
  initialQuery,
  branchColor,
  mapContext,
  onClose,
  onApplySticker,
  onRequestProStickerUnlock,
  onOpenAIStudio,
}) => {
  useEntitlements();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<GalleryCategoryFilter>('all');
  const [matchBranchColor, setMatchBranchColor] = useState(true);
  const [selectedCornerBadge, setSelectedCornerBadge] = useState<string | null>(null);

  const [allResults, setAllResults] = useState<VisualSearchResult[]>([]);
  const [metaphorChips, setMetaphorChips] = useState<MetaphorChip[]>([]);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [offlineMs, setOfflineMs] = useState<number | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const seqRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setCategory('all');
      setBrokenIds(new Set());
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen) return;

    const seq = ++seqRef.current;
    const controller = new AbortController();
    const effectiveQuery = query.trim();

    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      effectiveQuery,
      mapContext,
      branchColor
    );
    setAllResults(wave1.results);
    setMetaphorChips(wave1.metaphorChips);

    const offlineTimer = window.setTimeout(async () => {
      const offRes = await VisualSearchOrchestrator.searchOfflineWave(
        effectiveQuery,
        mapContext,
        branchColor,
        150
      );
      if (seq !== seqRef.current || controller.signal.aborted) return;
      setAllResults(offRes.results);
      setMetaphorChips(offRes.metaphorChips);
      if (typeof offRes.elapsedMs === 'number') {
        setOfflineMs(Math.max(1, Math.round(offRes.elapsedMs)));
      }
    }, 16);

    let onlineTimer: number | undefined;
    if (
      effectiveQuery.length >= 2 &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      onlineTimer = window.setTimeout(async () => {
        if (seq !== seqRef.current || controller.signal.aborted) return;
        setLoadingOnline(true);
        try {
          const fedRes = await VisualSearchOrchestrator.searchFederatedGallery(
            effectiveQuery,
            mapContext,
            branchColor,
            controller.signal
          );
          if (seq === seqRef.current && !controller.signal.aborted) {
            setAllResults(fedRes.results);
            setMetaphorChips(fedRes.metaphorChips);
          }
        } finally {
          if (seq === seqRef.current && !controller.signal.aborted) {
            setLoadingOnline(false);
          }
        }
      }, 170);
    } else {
      setLoadingOnline(false);
    }

    return () => {
      clearTimeout(offlineTimer);
      if (onlineTimer !== undefined) clearTimeout(onlineTimer);
      controller.abort();
    };
  }, [isOpen, query, mapContext, branchColor]);

  const visibleResults = useMemo(() => {
    const byCat = VisualSearchOrchestrator.filterResultsByCategory(allResults, category);
    return byCat.filter((r) => !brokenIds.has(r.id));
  }, [allResults, category, brokenIds]);

  if (!isOpen) return null;

  const handleSelectItem = async (item: VisualSearchResult, idx: number) => {
    if (!EntitlementManager.isStickerFree(item, idx, 'gallery')) {
      void hapticLight();
      onRequestProStickerUnlock(item);
      return;
    }

    setApplyingId(item.id);
    void hapticLight();
    try {
      const sticker = await VisualSearchOrchestrator.materializeStickerSelection(item, {
        retintToBranchColor: matchBranchColor ? branchColor : '#334155',
        cornerBadgeEmoji: selectedCornerBadge,
      });
      onApplySticker(sticker);
      void hapticSuccess();
      onClose();
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        className="flex h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:h-[85dvh] sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        {/* Header Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-500">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-extrabold sm:text-base">
                  25.000+ Çevrimdışı & Federatif Görsel Galeri ({visibleResults.length} Eşleşme)
                </h2>
                {offlineMs !== null && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700 dark:text-emerald-300">
                    <Zap className="h-3 w-3" />
                    {offlineMs}ms Offline
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] opacity-65">
                {mapContext.emoji} Bağlam: <strong>{mapContext.label}</strong> • Fluent 3D, OpenMoji, IconPark, HealthIcons, GameIcons & Bilimsel Atlas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAIStudio(query);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Stüdyo’da Çiz</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search + Semantic Metaphor Chips + Category Tabs */}
        <div
          className="space-y-2.5 border-b px-4 py-3 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-45" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Türkçe veya İngilizce kavram arayın (örn. mikroorganizma, çip, ekokardiyografi, istinaf, uçan payanda)..."
                autoFocus
                className="allow-text-input w-full rounded-xl border bg-transparent py-2 pr-8 pl-9 text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500"
                style={{ borderColor: 'var(--hud-border)' }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-0.5 opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMatchBranchColor((v) => !v)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold ${
                matchBranchColor
                  ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                  : 'hover:bg-slate-500/10'
              }`}
              style={{ borderColor: matchBranchColor ? undefined : 'var(--hud-border)' }}
            >
              <span
                className="h-3 w-3 rounded-full border border-white shadow-xs"
                style={{ backgroundColor: branchColor }}
              />
              <Palette className="h-3.5 w-3.5" />
              <span>Dal Rengine Uydur</span>
            </button>
          </div>

          {metaphorChips.length > 0 && (
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
              <span className="shrink-0 text-[11px] font-bold opacity-55">
                Semantik Kavramlar:
              </span>
              {metaphorChips.map((chip) => (
                <button
                  key={chip.queryEn}
                  type="button"
                  onClick={() => setQuery(chip.queryEn)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-slate-500/5 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap hover:bg-sky-500/15 hover:text-sky-600 dark:hover:text-sky-300"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <span>{chip.emoji}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="no-scrollbar flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex shrink-0 items-center gap-1">
              {CATEGORY_TABS.map((tab) => {
                const active = category === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategory(tab.id)}
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold whitespace-nowrap ${
                      active
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'opacity-75 hover:bg-slate-500/10 hover:opacity-100'
                    }`}
                  >
                    <span>{tab.emoji}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-1 pl-2">
              <span className="text-[11px] font-bold opacity-60">Köşe Rozeti:</span>
              <button
                type="button"
                onClick={() => setSelectedCornerBadge(null)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                  selectedCornerBadge === null
                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                    : 'opacity-65 hover:bg-slate-500/10'
                }`}
              >
                Yok
              </button>
              {CORNER_MICRO_BADGES.map((bdg) => (
                <button
                  key={bdg.emoji}
                  type="button"
                  title={bdg.labelTr}
                  onClick={() =>
                    setSelectedCornerBadge((prev) =>
                      prev === bdg.emoji ? null : bdg.emoji
                    )
                  }
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${
                    selectedCornerBadge === bdg.emoji
                      ? 'scale-115 bg-sky-500/20 ring-2 ring-sky-500'
                      : 'hover:bg-slate-500/10'
                  }`}
                >
                  {bdg.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* High-Density Responsive Sticker Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loadingOnline && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Çevrimiçi açık kaynak kütüphanelerden ek görseller getiriliyor...
            </div>
          )}

          {visibleResults.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center">
              <p className="text-sm font-bold opacity-75">
                “{query}” için bu kategoride doğrudan eşleşen hazır ikon bulunamadı.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAIStudio(query);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-extrabold text-white shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                <span>AI Stüdyo ile Bu Kavramı Çiz</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {visibleResults.map((item, idx) => {
                let displaySrc = item.previewUrl;
                if (item.isDuotoneColorizable && item.rawSvgMarkup) {
                  const targetColor = matchBranchColor ? branchColor : '#334155';
                  displaySrc = item.rawViewBox
                    ? buildDuotoneVectorStickerDataUri(
                        item.rawViewBox,
                        item.rawSvgMarkup,
                        targetColor
                      )
                    : retintRawSvgMarkupToBranch(item.rawSvgMarkup, targetColor);
                }

                const isApplying = applyingId === item.id;
                const isProLocked = !EntitlementManager.isStickerFree(
                  item,
                  idx,
                  'gallery'
                );

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleSelectItem(item, idx)}
                    title={`${item.title} • ${item.providerName}${isProLocked ? ' • PRO' : ''}`}
                    className="group relative flex flex-col items-center justify-between overflow-hidden rounded-2xl border p-2 text-center hover:-translate-y-0.5 hover:border-sky-500 hover:shadow-md active:scale-95"
                    style={{
                      backgroundColor: 'var(--hud-bg)',
                      borderColor: 'var(--hud-border)',
                    }}
                  >
                    {isProLocked && (
                      <span className="pointer-events-none absolute top-1.5 right-1.5 z-10 rounded-md bg-amber-500 px-1 py-0.2 text-[8.5px] leading-tight font-black text-slate-950 shadow-2xs">
                        PRO
                      </span>
                    )}
                    <div className="relative flex h-16 w-16 items-center justify-center sm:h-17 sm:w-17">
                      <img
                        src={displaySrc}
                        alt={item.title}
                        loading="lazy"
                        onError={() => {
                          setBrokenIds((prev) => new Set(prev).add(item.id));
                        }}
                        className="max-h-full max-w-full object-contain group-hover:scale-108"
                      />
                      {selectedCornerBadge && (
                        <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow-sm">
                          {selectedCornerBadge}
                        </span>
                      )}
                    </div>
                    <span className="mt-1.5 line-clamp-1 w-full text-[10.5px] font-bold opacity-80">
                      {item.title}
                    </span>

                    {isApplying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80">
                        <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
