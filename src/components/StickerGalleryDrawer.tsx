import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Sparkles,
  Palette,
  Loader2,
  Layers,
  Zap,
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
import { CORNER_MICRO_BADGES } from '../core/visuals/CompositeStickerComposer';
import { retintRawSvgMarkupToBranch } from '../core/visuals/DuotoneStickerColorizer';
import { triggerGalleryPhotoPicker } from '../core/visuals/PhotoStickerImporter';
import { buildDuotoneVectorStickerDataUri } from '../core/visuals/PureVectorStickerizer';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { useKeyboardInset } from '../core/native/useKeyboardInset';

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
  { id: 'photo', label: 'Fotoğraf', emoji: '📷' },
];

const SIZE_OPTIONS: Array<{ id: StickerSizePreset; label: string }> = [
  { id: 'sm', label: 'S' },
  { id: 'md', label: 'M' },
  { id: 'lg', label: 'L' },
  { id: 'xl', label: 'XL' },
];

export const StickerGalleryDrawer: React.FC<StickerGalleryDrawerProps> = ({
  isOpen,
  initialQuery,
  branchColor,
  currentStickerSize = 'md',
  onChangeStickerSize,
  mapContext,
  onClose,
  onApplySticker,
  onRequestProStickerUnlock,
  onOpenAIStudio,
}) => {
  const { isLifetimePro } = useEntitlements();
  const kb = useKeyboardInset();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<GalleryCategoryFilter>('all');
  const [tierFilter, setTierFilter] = useState<IconTierFilter>('all');
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
        180
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

  const handleSelectItem = async (
    item: VisualSearchResult,
    isFree: boolean
  ) => {
    if (!isFree) {
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      style={{ paddingBottom: `${kb.keyboardHeight}px` }}
      onClick={onClose}
      data-testid="sticker-gallery-drawer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          height: kb.isKeyboardOpen
            ? `${Math.max(260, kb.viewportH - 18)}px`
            : kb.isPhone
            ? '90dvh'
            : '86dvh',
          maxHeight: `${Math.max(260, kb.viewportH - 16)}px`,
          paddingBottom: kb.isKeyboardOpen
            ? '6px'
            : 'max(20px, calc(var(--safe-bottom) + 14px))',
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
                  25.000+ İkon & 3D Görsel Kütüphanesi ({visibleEntries.length} Eşleşme)
                </h2>
                {offlineMs !== null && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700 dark:text-emerald-300">
                    <Zap className="h-3 w-3" />
                    {offlineMs}ms Offline
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] opacity-65">
                {mapContext.emoji} Bağlam: <strong>{mapContext.label}</strong> • Fluent 3D, OpenMoji, Bilimsel Atlas & Cihaz Galerisi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-extrabold text-indigo-700 hover:bg-indigo-500/25 active:scale-95 dark:text-indigo-300"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>Galeriden Foto Seç</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAIStudio(query);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>3D Özel Üret</span>
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

        {/* Search + Free/Pro Filter + Size Selector + Category Tabs */}
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
                placeholder="Herhangi bir kavram arayın (örn. kalp, roket, mahkeme, sunucu, araba, ağaç)..."
                autoFocus={!kb.isTouchDevice}
                className="allow-text-input min-h-[42px] w-full rounded-xl border bg-transparent py-2 pr-8 pl-9 text-base font-semibold outline-none focus:ring-2 focus:ring-sky-500 sm:text-sm"
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

            {/* Free vs Pro Tier Filter Pills */}
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-1">
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
                <span>Sadece Ücretsizler ({freeCountInCat})</span>
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
                <span>Pro 3D & Atlas</span>
              </button>
            </div>
          </div>

          {metaphorChips.length > 0 && (
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
              <span className="shrink-0 text-[11px] font-bold opacity-55">
                İlgili Konular:
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

            <div className="flex shrink-0 items-center gap-2 pl-2">
              {onChangeStickerSize && (
                <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5">
                  <span className="px-1.5 text-[10.5px] font-extrabold opacity-65">
                    Boyut:
                  </span>
                  {SIZE_OPTIONS.map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => {
                        void hapticLight();
                        onChangeStickerSize(sz.id);
                      }}
                      className={`rounded-lg px-2 py-1 text-[11px] font-extrabold ${
                        currentStickerSize === sz.id
                          ? 'bg-sky-500 text-white shadow-2xs'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setMatchBranchColor((v) => !v)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold ${
                  matchBranchColor
                    ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                    : 'hover:bg-slate-500/10'
                }`}
                style={{ borderColor: matchBranchColor ? undefined : 'var(--hud-border)' }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white"
                  style={{ backgroundColor: branchColor }}
                />
                <Palette className="h-3 w-3" />
                <span>Dal Rengi</span>
              </button>

              <div className="hidden items-center gap-1 lg:flex">
                <span className="text-[11px] font-bold opacity-60">Rozet:</span>
                {CORNER_MICRO_BADGES.slice(0, 4).map((bdg) => (
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
        </div>

        {/* High-Density Responsive Sticker Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loadingOnline && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Ek görseller getiriliyor...
            </div>
          )}

          {visibleEntries.length === 0 ? (
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
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {visibleEntries.map(({ item, isFree }) => {
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
                    className={`group relative flex flex-col items-center justify-between overflow-hidden rounded-2xl border p-2 text-center transition hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
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
                          setBrokenIds((prev) => new Set(prev).add(item.id));
                        }}
                        className={`max-h-full max-w-full object-contain transition-transform group-hover:scale-110 ${
                          isProLocked
                            ? 'drop-shadow-[0_4px_8px_rgba(245,158,11,0.28)]'
                            : ''
                        }`}
                      />
                      {selectedCornerBadge && (
                        <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border bg-white text-xs shadow-sm">
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
