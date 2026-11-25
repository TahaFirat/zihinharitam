import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Sparkles,
  Loader2,
  Layers,
  Gift,
  Crown,
  ImagePlus,
} from 'lucide-react';
import type {
  GalleryCategoryFilter,
  IconTierFilter,
  MetaphorChip,
  StickerAsset,
  StickerSizePreset,
  VisualSearchResult,
} from '../types/mindmap';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import { retintRawSvgMarkupToBranch } from '../core/visuals/DuotoneStickerColorizer';
import { triggerGalleryPhotoPicker } from '../core/visuals/PhotoStickerImporter';
import { buildDuotoneVectorStickerDataUri } from '../core/visuals/PureVectorStickerizer';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import {
  sanitizeNodeSearchQuery,
  VisualSearchOrchestrator,
} from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { dismissNativeKeyboard, useKeyboardInset } from '../core/native/useKeyboardInset';

interface StickerGalleryDrawerProps {
  isOpen: boolean;
  initialQuery: string;
  branchColor: string;
  currentStickerSize?: StickerSizePreset;
  onChangeStickerSize?: (size: StickerSizePreset) => void;
  mapContext: MapContextAnalysis;
  onClose: () => void;
  onApplySticker: (sticker: StickerAsset) => void;
  onRequestProStickerUnlock: (item: VisualSearchResult) => void;
  onOpenAIStudio: (query: string) => void;
}

const CATEGORY_TABS: Array<{ id: GalleryCategoryFilter; label: string; emoji: string }> = [
  { id: 'all', label: 'Tümü', emoji: '🌟' },
  { id: '3d_color', label: '3D & Parlak', emoji: '🧊' },
  { id: 'hand_drawn', label: 'El Çizimi', emoji: '🎨' },
  { id: 'system_arch', label: 'Sistem & Mimari', emoji: '🖧' },
  { id: 'medical_academic', label: 'Akademik & Bilim', emoji: '🩺' },
  { id: 'diagram', label: 'Şema & Diyagram', emoji: '📐' },
];

export const StickerGalleryDrawer: React.FC<StickerGalleryDrawerProps> = ({
  isOpen,
  initialQuery,
  branchColor,
  currentStickerSize: _currentStickerSize = 'md',
  onChangeStickerSize: _onChangeStickerSize,
  mapContext,
  onClose,
  onApplySticker,
  onRequestProStickerUnlock,
  onOpenAIStudio,
}) => {
  void _currentStickerSize;
  void _onChangeStickerSize;
  const { isLifetimePro } = useEntitlements();
  const kb = useKeyboardInset();
  const [query, setQuery] = useState(() => sanitizeNodeSearchQuery(initialQuery));
  const [category, setCategory] = useState<GalleryCategoryFilter>('all');
  const [tierFilter, setTierFilter] = useState<IconTierFilter>('all');
  const [displayLimit, setDisplayLimit] = useState(60);

  const [allResults, setAllResults] = useState<VisualSearchResult[]>([]);
  const [metaphorChips, setMetaphorChips] = useState<MetaphorChip[]>([]);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const seqRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setQuery(sanitizeNodeSearchQuery(initialQuery));
      setCategory('all');
      setDisplayLimit(60);
      setBrokenIds(new Set());
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    setDisplayLimit(60);
    setBrokenIds(new Set());
  }, [query, category, tierFilter]);

  useEffect(() => {
    if (!isOpen) return;

    const seq = ++seqRef.current;
    const controller = new AbortController();
    const effectiveQuery = sanitizeNodeSearchQuery(query);

    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      effectiveQuery,
      mapContext,
      branchColor
    );
    if (wave1.results.length > 0) {
      setAllResults(wave1.results);
    }
    setMetaphorChips(wave1.metaphorChips);

    let cancelled = false;
    let onlineTimer: number | undefined;
    void VisualSearchOrchestrator.searchOfflineWave(
      effectiveQuery,
      mapContext,
      branchColor,
      84
    ).then((offRes) => {
      if (cancelled || seq !== seqRef.current || controller.signal.aborted) return;
      setAllResults(offRes.results);
      setMetaphorChips(offRes.metaphorChips);

      // Only trigger remote enrichment when query isn't already richly satisfied by curated offline icons
      // (prevents curated words like "kar" from jumping/flashing 155ms after crisp offline icons appear!)
      const needsOnline =
        effectiveQuery.length >= 2 &&
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        (!offRes.hasLexiconMatch ||
          offRes.allWordsMatched === false ||
          effectiveQuery.includes(' ') ||
          offRes.results.length < 18 ||
          (offRes.results[0]?.score ?? 0) < 0.9);

      if (needsOnline) {
        setLoadingOnline(true);
        onlineTimer = window.setTimeout(async () => {
          if (cancelled || seq !== seqRef.current || controller.signal.aborted) return;
          try {
            const fedRes = await VisualSearchOrchestrator.searchFederatedGallery(
              effectiveQuery,
              mapContext,
              branchColor,
              controller.signal
            );
            if (!cancelled && seq === seqRef.current && !controller.signal.aborted) {
              if (fedRes.results.length > 0 || offRes.results.length === 0) {
                setAllResults(fedRes.results);
              }
              setMetaphorChips(fedRes.metaphorChips);
            }
          } finally {
            if (!cancelled && seq === seqRef.current && !controller.signal.aborted) {
              setLoadingOnline(false);
            }
          }
        }, 120);
      } else {
        setLoadingOnline(false);
      }
    });

    return () => {
      cancelled = true;
      if (onlineTimer !== undefined) clearTimeout(onlineTimer);
      controller.abort();
    };
  }, [isOpen, query, mapContext, branchColor]);

  const byCategoryHealthy = useMemo(() => {
    const byCat = VisualSearchOrchestrator.filterResultsByCategory(allResults, category);
    return byCat.filter((r) => !brokenIds.has(r.id));
  }, [allResults, category, brokenIds]);

  const visibleEntries = useMemo(() => {
    const tagged = byCategoryHealthy.map((item, origIdx) => ({
      item,
      origIdx,
      isFree: EntitlementManager.isStickerFree(item, origIdx, 'gallery'),
    }));

    if (tierFilter === 'free') {
      return tagged.filter((t) => t.isFree);
    }
    if (tierFilter === 'pro') {
      return tagged.filter(
        (t) => !t.isFree || t.item.tier === 'pro' || t.item.mode === '3d'
      );
    }
    return tagged;
  }, [byCategoryHealthy, tierFilter, isLifetimePro]);

  const freeCountInCat = useMemo(
    () =>
      byCategoryHealthy.filter((item, idx) =>
        EntitlementManager.isStickerFree(item, idx, 'gallery')
      ).length,
    [byCategoryHealthy, isLifetimePro]
  );

  if (!isOpen) return null;

  const handleCloseClean = () => {
    void dismissNativeKeyboard();
    onClose();
  };

  const handleSelectItem = async (
    item: VisualSearchResult,
    isFree: boolean
  ) => {
    if (!isFree) {
      void hapticLight();
      void dismissNativeKeyboard();
      onRequestProStickerUnlock(item);
      return;
    }

    setApplyingId(item.id);
    void hapticLight();
    try {
      const sticker = await VisualSearchOrchestrator.materializeStickerSelection(item, {
        retintToBranchColor: branchColor,
        cornerBadgeEmoji: null,
      });
      onApplySticker(sticker);
      void hapticSuccess();
      void dismissNativeKeyboard();
      onClose();
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div
      className="fixed top-0 right-0 left-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      style={{
        bottom: `${kb.keyboardHeight}px`,
        paddingTop: 'max(14px, calc(var(--safe-top) + 10px))',
      }}
      onClick={handleCloseClean}
      data-testid="sticker-gallery-drawer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:h-[86%] sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: kb.isKeyboardOpen
            ? '4px'
            : 'max(14px, calc(var(--safe-bottom) + 10px))',
        }}
      >
        {/* Clean Minimal Header Bar (Auto-collapses while keyboard is open so 3-4 icon rows stay visible above keyboard!) */}
        {!kb.isKeyboardOpen && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <h2 className="truncate text-sm font-extrabold sm:text-base">
              İkon Seç
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              data-testid="gallery-import-photo-btn"
              onClick={() =>
                triggerGalleryPhotoPicker(branchColor, (sticker) => {
                  onApplySticker(sticker);
                  void hapticSuccess();
                  onClose();
                })
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-2.5 text-xs font-extrabold text-indigo-700 hover:bg-indigo-500/25 active:scale-95 dark:text-indigo-300"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>Foto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void dismissNativeKeyboard();
                onClose();
                onOpenAIStudio(query);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 text-xs font-extrabold text-white shadow-xs active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>3D Üret</span>
            </button>

            <button
              type="button"
              aria-label="Kapat"
              onClick={handleCloseClean}
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-500/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        )}

        {/* Compact Search + Tier Filter (Secondary chips auto-collapse while keyboard is open so icons stay huge & visible!) */}
        <div
          className="shrink-0 space-y-2 border-b px-3.5 py-2 sm:px-5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className={`flex gap-2 ${kb.isKeyboardOpen ? 'flex-row items-center' : 'flex-col sm:flex-row sm:items-center'}`}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-45" />
              <input
                type="text"
                data-testid="gallery-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="İkon ara (kar, top, taş, tablet kılıfı...)"
                autoFocus={false}
                className="allow-text-input min-h-[42px] w-full rounded-xl border bg-transparent py-2 pr-9 pl-9 text-base font-semibold outline-none focus:ring-2 focus:ring-sky-500"
                style={{ borderColor: 'var(--hud-border)' }}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Aramayı temizle"
                  onClick={() => setQuery('')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-500/12 opacity-75 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {kb.isKeyboardOpen && (
              <button
                type="button"
                aria-label="Kapat"
                onClick={handleCloseClean}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 hover:bg-slate-500/20"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Free vs Pro Tier Filter Pills (Hidden in single-row compact mode on phones while typing; shown on tablets or when keyboard closed!) */}
            <div className={`${kb.isKeyboardOpen ? 'hidden sm:flex' : 'flex w-full justify-between sm:w-auto sm:justify-start'} shrink-0 items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-1`}>
              <button
                type="button"
                data-testid="gallery-tier-all-btn"
                onClick={() => setTierFilter('all')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${
                  tierFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                data-testid="gallery-tier-free-btn"
                onClick={() => setTierFilter((p) => (p === 'free' ? 'all' : 'free'))}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${
                  tierFilter === 'free'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                }`}
              >
                <Gift className="h-3.5 w-3.5" />
                <span>Ücretsiz ({freeCountInCat})</span>
              </button>
              <button
                type="button"
                data-testid="gallery-tier-pro-btn"
                onClick={() => setTierFilter((p) => (p === 'pro' ? 'all' : 'pro'))}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${
                  tierFilter === 'pro'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-amber-700 hover:bg-amber-500/15 dark:text-amber-300'
                }`}
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Pro</span>
              </button>
            </div>
          </div>

          {!kb.isKeyboardOpen && metaphorChips.length > 0 && (
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
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

          {!kb.isKeyboardOpen && (
            <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
              {CATEGORY_TABS.map((tab) => {
                const active = category === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategory(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold whitespace-nowrap ${
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
          )}
        </div>

        {/* High-Density Responsive Sticker Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loadingOnline && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Ek görseller getiriliyor...
            </div>
          )}

          {visibleEntries.length === 0 && loadingOnline ? (
            <div className="flex h-40 items-center justify-center gap-2 text-xs font-bold opacity-70">
              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
              <span>İkonlar aranıyor...</span>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center">
              <p className="text-sm font-bold opacity-75">
                “{query}” için bu filtrede doğrudan eşleşen hazır ikon bulunamadı.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {tierFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setTierFilter('all')}
                    className="rounded-2xl border px-3.5 py-2 text-xs font-extrabold"
                  >
                    Tüm İkonları Göster
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    triggerGalleryPhotoPicker(branchColor, (sticker) => {
                      onApplySticker(sticker);
                      void hapticSuccess();
                      onClose();
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-indigo-500/40 bg-indigo-500/15 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>Galeriden Fotoğraf Ekle</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAIStudio(query);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-extrabold text-white shadow-md"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>3D Özel İkon Üret</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                {visibleEntries.slice(0, displayLimit).map(({ item, isFree }) => {
                let displaySrc = item.previewUrl;
                if (item.isDuotoneColorizable && item.rawSvgMarkup) {
                  const targetColor = branchColor;
                  displaySrc = item.rawViewBox
                    ? buildDuotoneVectorStickerDataUri(
                        item.rawViewBox,
                        item.rawSvgMarkup,
                        targetColor
                      )
                    : retintRawSvgMarkupToBranch(item.rawSvgMarkup, targetColor);
                }

                const isApplying = applyingId === item.id;
                const isProLocked = !isFree;
                const isProCraft = !isFree || item.tier === 'pro' || item.mode === '3d';

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={
                      isProLocked ? 'gallery-pro-tile' : 'gallery-free-tile'
                    }
                    onClick={() => void handleSelectItem(item, isFree)}
                    title={`${item.title} • ${item.providerName}${
                      isProLocked ? ' • PRO 3D & Atlas' : ' • Ücretsiz'
                    }`}
                    className={`icon-grid-tile group relative flex flex-col items-center justify-between overflow-hidden rounded-2xl border p-2 text-center transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 ${
                      isProLocked
                        ? 'border-amber-400/65 bg-gradient-to-br from-amber-500/14 via-violet-500/8 to-amber-400/20 hover:border-amber-400'
                        : isProCraft
                        ? 'border-violet-400/40 bg-gradient-to-br from-violet-500/10 to-sky-500/10 hover:border-sky-500'
                        : 'hover:border-sky-500'
                    }`}
                    style={{
                      backgroundColor:
                        isProLocked || isProCraft ? undefined : 'var(--hud-bg)',
                      borderColor:
                        isProLocked || isProCraft ? undefined : 'var(--hud-border)',
                    }}
                  >
                    {isProLocked ? (
                      <span className="pointer-events-none absolute top-1.5 right-1.5 z-10 rounded-md bg-gradient-to-r from-amber-500 to-orange-400 px-1.5 py-0.2 text-[8.5px] leading-tight font-black text-slate-950 shadow-2xs">
                        👑 PRO
                      </span>
                    ) : (
                      <span className="pointer-events-none absolute top-1.5 left-1.5 z-10 rounded-md bg-emerald-500/15 px-1 py-0.2 text-[8px] leading-tight font-extrabold text-emerald-700 opacity-85 dark:text-emerald-300">
                        ÜCRETSİZ
                      </span>
                    )}
                    <div className="relative mt-2 flex h-16 w-16 items-center justify-center sm:h-17 sm:w-17">
                      <img
                        src={displaySrc}
                        alt={item.title}
                        loading="lazy"
                        onError={() => {
                          if (!displaySrc.startsWith('data:')) {
                            setBrokenIds((prev) => new Set(prev).add(item.id));
                          }
                        }}
                        className={`max-h-full max-w-full object-contain transition-transform group-hover:scale-110 ${
                          isProLocked
                            ? 'drop-shadow-[0_4px_8px_rgba(245,158,11,0.28)]'
                            : ''
                        }`}
                      />
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
              {visibleEntries.length > displayLimit && (
                <div className="mt-4 flex justify-center pb-2">
                  <button
                    type="button"
                    data-testid="gallery-load-more-btn"
                    onClick={() => setDisplayLimit((prev) => prev + 60)}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl border border-sky-500/40 bg-sky-500/12 px-5 py-2 text-xs font-extrabold text-sky-700 hover:bg-sky-500/20 active:scale-95 dark:text-sky-300"
                  >
                    <span>
                      Daha Fazla İkon Göster (+
                      {Math.min(60, visibleEntries.length - displayLimit)})
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
