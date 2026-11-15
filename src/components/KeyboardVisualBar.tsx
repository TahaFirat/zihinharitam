import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Sparkles,
  Camera,
  Pencil,
  Check,
  Trash2,
  Loader2,
  X,
  Search,
  Link2,
  Tag,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  BRANCH_PALETTE,
  type MindNode,
  type NodeVisualStyle,
  type ProactiveBranchSuggestion,
  type StickerAsset,
  type StickerSizePreset,
  type VisualSearchResult,
  type VisualStyleMode,
} from '../types/mindmap';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';

interface KeyboardVisualBarProps {
  activeNode: MindNode | null;
  isRootNode: boolean;
  isMainBranch: boolean;
  defaultNodeStyle: NodeVisualStyle;
  mapContext: MapContextAnalysis;
  proactiveSuggestions: ProactiveBranchSuggestion[];
  nodeScreenPos: { x: number; y: number } | null;
  onApplySticker: (nodeId: string, sticker: StickerAsset) => void;
  onRequestProStickerUnlock: (item: VisualSearchResult) => void;
  onApplyProactiveSuggestion: (
    nodeId: string,
    suggestion: ProactiveBranchSuggestion
  ) => void;
  onUpdateTechBadge: (nodeId: string, techBadge: string) => void;
  onChangeStickerSize: (nodeId: string, size: StickerSizePreset) => void;
  onChangeNodeStyle: (nodeId: string, style: NodeVisualStyle) => void;
  onRemoveSticker: (nodeId: string) => void;
  onChangeBranchColor: (nodeId: string, color: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onOpenGalleryDrawer: () => void;
  onOpenAIStudio: () => void;
  onOpenNoteCropper: () => void;
  onOpenQuickSketch: () => void;
  onStartCrossLink: (fromNodeId: string) => void;
  onOpenSmartSubBranches: () => void;
  onCloseEdit: () => void;
}

const STYLE_TABS: Array<{ id: VisualStyleMode; emoji: string; label: string }> = [
  { id: 'illustration', emoji: '✨', label: 'Çizim' },
  { id: '3d', emoji: '🧊', label: '3D' },
  { id: 'photo', emoji: '📷', label: 'Foto' },
  { id: 'diagram', emoji: '📐', label: 'Şema' },
];

const SIZE_PRESETS: Array<{ id: StickerSizePreset; label: string }> = [
  { id: 'sm', label: 'S' },
  { id: 'md', label: 'M' },
  { id: 'lg', label: 'L' },
  { id: 'xl', label: 'XL' },
];

export const KeyboardVisualBar: React.FC<KeyboardVisualBarProps> = ({
  activeNode,
  isRootNode,
  isMainBranch,
  defaultNodeStyle,
  mapContext,
  proactiveSuggestions,
  nodeScreenPos,
  onApplySticker,
  onRequestProStickerUnlock,
  onApplyProactiveSuggestion,
  onUpdateTechBadge,
  onChangeStickerSize,
  onChangeNodeStyle,
  onRemoveSticker,
  onChangeBranchColor,
  onDeleteNode,
  onOpenGalleryDrawer,
  onOpenAIStudio,
  onOpenNoteCropper,
  onOpenQuickSketch,
  onStartCrossLink,
  onOpenSmartSubBranches,
  onCloseEdit,
}) => {
  useEntitlements();
  const [styleMode, setStyleMode] = useState<VisualStyleMode>('illustration');
  const [allFederated, setAllFederated] = useState<VisualSearchResult[]>([]);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [offlineMs, setOfflineMs] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showTechBadgeInput, setShowTechBadgeInput] = useState(false);
  const [barHeight, setBarHeight] = useState(196);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const [vvMetrics, setVvMetrics] = useState<{
    bottomY: number;
    isMobile: boolean;
    isTablet: boolean;
    isKeyboardOpen: boolean;
    viewportW: number;
    viewportH: number;
  }>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      bottomY: h,
      isMobile: w < 768,
      isTablet: w >= 768 && w < 1024,
      isKeyboardOpen: false,
      viewportW: w,
      viewportH: h,
    };
  });

  const barRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);
  const swipeStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const updateViewport = () => {
      const vv = window.visualViewport;
      const winH = window.innerHeight;
      const winW = window.innerWidth;

      if (vv) {
        const keyboardHeight = winH - (vv.offsetTop + vv.height);
        setVvMetrics({
          bottomY: Math.round(vv.offsetTop + vv.height),
          isMobile: winW < 768,
          isTablet: winW >= 768 && winW < 1024,
          isKeyboardOpen: keyboardHeight > 85,
          viewportW: Math.round(vv.width),
          viewportH: Math.round(vv.height),
        });
      } else {
        setVvMetrics({
          bottomY: winH,
          isMobile: winW < 768,
          isTablet: winW >= 768 && winW < 1024,
          isKeyboardOpen: false,
          viewportW: winW,
          viewportH: winH,
        });
      }
    };

    updateViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', updateViewport);
    vv?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);

    return () => {
      vv?.removeEventListener('resize', updateViewport);
      vv?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  // Measure actual rendered height so clamping is 100% overflow-proof
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 40) setBarHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeNode?.id]);

  const searchQuery = activeNode?.title ?? '';
  const activeBranchColor = activeNode?.branchColor ?? '#0EA5E9';

  useEffect(() => {
    setShowTechBadgeInput(Boolean(activeNode?.techBadge));
    setBrokenIds(new Set());
  }, [activeNode?.id, activeNode?.techBadge]);

  // V3 Search Pipeline:
  // 1) 0ms sync Built-In Multi-Color Atlas (zero fallback garbage)
  // 2) 16ms single-frame Offline 25,209-icon Shard Search (<8ms Web Worker)
  // 3) 180ms optional Online Enrichment (only when navigator.onLine, strictly seqId + AbortController guarded)
  useEffect(() => {
    if (!activeNode) return;

    const seq = ++requestSeqRef.current;
    const controller = new AbortController();

    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      searchQuery,
      mapContext,
      activeBranchColor
    );
    setAllFederated(wave1.results);
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = 0;
    }

    const offlineTimer = window.setTimeout(async () => {
      const offlineWave = await VisualSearchOrchestrator.searchOfflineWave(
        searchQuery,
        mapContext,
        activeBranchColor,
        96
      );
      if (seq !== requestSeqRef.current || controller.signal.aborted) return;
      setAllFederated(offlineWave.results);
      if (typeof offlineWave.elapsedMs === 'number') {
        setOfflineMs(Math.max(1, Math.round(offlineWave.elapsedMs)));
      }
    }, 16);

    let onlineTimer: number | undefined;
    if (
      searchQuery.trim().length >= 2 &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      onlineTimer = window.setTimeout(async () => {
        if (seq !== requestSeqRef.current || controller.signal.aborted) return;
        setLoadingRemote(true);
        try {
          const fullRes = await VisualSearchOrchestrator.searchFederatedGallery(
            searchQuery,
            mapContext,
            activeBranchColor,
            controller.signal
          );
          if (seq === requestSeqRef.current && !controller.signal.aborted) {
            setAllFederated(fullRes.results);
          }
        } finally {
          if (seq === requestSeqRef.current && !controller.signal.aborted) {
            setLoadingRemote(false);
          }
        }
      }, 185);
    } else {
      setLoadingRemote(false);
    }

    return () => {
      clearTimeout(offlineTimer);
      if (onlineTimer !== undefined) clearTimeout(onlineTimer);
      controller.abort();
    };
  }, [activeNode?.id, searchQuery, mapContext, activeBranchColor]);

  const filteredCarousel = useMemo(() => {
    const byMode = VisualSearchOrchestrator.filterResultsByMode(allFederated, styleMode);
    return byMode.filter((r) => !brokenIds.has(r.id)).slice(0, 36);
  }, [allFederated, styleMode, brokenIds]);

  const totalHealthyCount = useMemo(
    () => allFederated.filter((r) => !brokenIds.has(r.id)).length,
    [allFederated, brokenIds]
  );

  const updateScrollChevrons = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    updateScrollChevrons();
  }, [filteredCarousel]);

  if (!activeNode) return null;

  const isFreshEmptyBranch = !isRootNode && activeNode.title.trim().length === 0;
  const effectiveNodeStyle: NodeVisualStyle =
    activeNode.nodeStyle ?? defaultNodeStyle ?? 'card';
  const effectiveStickerSize: StickerSizePreset =
    activeNode.stickerSize ?? (effectiveNodeStyle === 'organic' && !isRootNode ? 'lg' : 'md');

  const handleSelectVisual = async (item: VisualSearchResult, idx: number) => {
    const isFree = EntitlementManager.isStickerFree(item, idx, 'keyboard_bar');
    if (!isFree) {
      void hapticLight();
      onRequestProStickerUnlock(item);
      return;
    }

    setProcessingId(item.id);
    void hapticLight();
    try {
      const sticker = await VisualSearchOrchestrator.materializeStickerSelection(item, {
        retintToBranchColor: item.isDuotoneColorizable ? activeBranchColor : null,
      });
      onApplySticker(activeNode.id, sticker);
      void hapticSuccess();
    } finally {
      setProcessingId(null);
    }
  };

  const scrollCarouselBy = (delta: number) => {
    carouselRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Strict Viewport-Clamped 3-Tier Positioning (0.0px right/left/bottom overflow!)
  const useDockedSheet =
    vvMetrics.isMobile || vvMetrics.isKeyboardOpen || !nodeScreenPos;
  const isTabletFloating = !useDockedSheet && vvMetrics.isTablet;

  let containerStyle: React.CSSProperties;

  if (useDockedSheet) {
    const topPx = Math.max(52, vvMetrics.bottomY - barHeight);
    containerStyle = {
      position: 'fixed',
      left: 0,
      right: 0,
      top: 0,
      width: '100vw',
      maxWidth: '100vw',
      transform: `translate3d(0, ${topPx}px, 0)`,
      paddingBottom:
        vvMetrics.bottomY >= window.innerHeight - 10 ? 'var(--safe-bottom)' : '0px',
    };
  } else if (isTabletFloating) {
    const cardWidth = Math.min(736, vvMetrics.viewportW - 24);
    const leftPx = Math.round((vvMetrics.viewportW - cardWidth) * 0.5);
    const topPx = Math.max(64, vvMetrics.viewportH - barHeight - 18);
    containerStyle = {
      position: 'fixed',
      left: 0,
      top: 0,
      width: `${cardWidth}px`,
      maxWidth: 'calc(100vw - 24px)',
      transform: `translate3d(${leftPx}px, ${topPx}px, 0)`,
    };
  } else {
    const cardWidth = Math.min(716, vvMetrics.viewportW - 32);
    const clampedLeft = Math.max(
      16,
      Math.min(vvMetrics.viewportW - cardWidth - 16, nodeScreenPos!.x - cardWidth * 0.5)
    );
    const placeAbove = nodeScreenPos!.y > vvMetrics.viewportH * 0.56;
    const rawTop = placeAbove
      ? nodeScreenPos!.y - (barHeight + 90)
      : nodeScreenPos!.y + 72;
    const clampedTop = Math.max(
      64,
      Math.min(vvMetrics.viewportH - barHeight - 16, rawTop)
    );

    containerStyle = {
      position: 'fixed',
      left: 0,
      top: 0,
      width: `${cardWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
      transform: `translate3d(${Math.round(clampedLeft)}px, ${Math.round(clampedTop)}px, 0)`,
    };
  }

  return (
    <div
      ref={barRef}
      style={containerStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        if (vvMetrics.isMobile && e.touches.length === 1) {
          swipeStartYRef.current = e.touches[0].clientY;
        }
      }}
      onTouchEnd={(e) => {
        if (
          vvMetrics.isMobile &&
          swipeStartYRef.current !== null &&
          e.changedTouches.length === 1
        ) {
          const dy = swipeStartYRef.current - e.changedTouches[0].clientY;
          swipeStartYRef.current = null;
          if (dy > 44) {
            onOpenGalleryDrawer();
          }
        }
      }}
      className="z-40 box-border select-none will-change-transform"
    >
      <div
        className={`box-border w-full overflow-hidden border shadow-2xl backdrop-blur-xl ${
          useDockedSheet
            ? 'rounded-t-2xl border-x-0 border-b-0 px-2.5 pt-1.5 pb-2'
            : 'rounded-2xl p-2.5'
        }`}
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
        }}
      >
        {/* Mobile Swipe-Up Handle -> Opens +150 Görsel Drawer */}
        {useDockedSheet && (
          <button
            type="button"
            onClick={onOpenGalleryDrawer}
            title="Tam Galeri İçin Yukarı Kaydırın veya Dokunun"
            className="mx-auto mb-1 flex w-full items-center justify-center py-0.5"
          >
            <span className="h-1 w-10 rounded-full bg-slate-400/45" />
          </button>
        )}

        {/* ZERO-KEYSTROKE PROACTIVE SUB-BRANCH PREDICTIONS */}
        {isFreshEmptyBranch && proactiveSuggestions.length > 0 && (
          <div className="no-scrollbar mb-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-1 text-[10.5px] font-extrabold text-violet-700 dark:text-violet-300">
              {mapContext.emoji} Hazır Dal:
            </span>
            {proactiveSuggestions.map((sug) => (
              <button
                key={sug.id}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  void hapticSuccess();
                  onApplyProactiveSuggestion(activeNode.id, sug);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border bg-white/80 px-2.5 py-1 text-xs font-extrabold whitespace-nowrap shadow-2xs hover:border-violet-500 hover:bg-violet-500/10 active:scale-95 dark:bg-slate-800/80"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <img
                  src={sug.sticker.url}
                  alt=""
                  className="h-5 w-5 object-contain"
                />
                <span>{sug.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* OPTIONAL INLINE TECH BADGE INPUT */}
        {showTechBadgeInput && !isFreshEmptyBranch && (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1 text-[10.5px] font-extrabold text-sky-700 dark:text-sky-300">
              <Tag className="h-3 w-3" /> Rozet:
            </span>
            <input
              type="text"
              value={activeNode.techBadge ?? ''}
              onChange={(e) => onUpdateTechBadge(activeNode.id, e.target.value)}
              placeholder="Örn: Port 443 • HTTPS, O(log N), Av = -Rf/Rin, HMK m.341..."
              className="allow-text-input min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 py-1 font-mono text-xs font-bold outline-none focus:ring-1 focus:ring-sky-500"
              style={{ borderColor: 'var(--hud-border)' }}
            />
          </div>
        )}

        {/* ROW 1: Style Tabs + Primary Studio Buttons (100% Fit Without Clipping!) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5">
          {/* Style Mode Selector */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5">
            {STYLE_TABS.map((tab) => {
              const active = styleMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setStyleMode(tab.id)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-extrabold whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Primary Visual Creation & Gallery Actions (Never Clipped!) */}
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenGalleryDrawer}
              title="25.000+ Çevrimdışı & Federatif Görsel Galerisi"
              className="inline-flex h-7.5 items-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/15 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-sky-700 hover:bg-sky-500/25 active:scale-95 dark:text-sky-300"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span>+{Math.max(150, totalHealthyCount)} Görsel</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenAIStudio}
              title="4 Adaylı AI Çıkartma Stüdyosu"
              className="inline-flex h-7.5 items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-white shadow-xs active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>AI Çiz</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenNoteCropper}
              title="Ders Notundan / Slayttan Şema Kes"
              className="inline-flex h-7.5 items-center gap-1 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-2 text-[11.5px] font-extrabold whitespace-nowrap text-emerald-700 hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
            >
              <Camera className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Nottan Kes</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenQuickSketch}
              title="Kalem veya Parmakla Karala"
              className="inline-flex h-7.5 items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/12 px-2 text-[11.5px] font-extrabold whitespace-nowrap text-amber-700 hover:bg-amber-500/20 active:scale-95 dark:text-amber-300"
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Karala</span>
            </button>

            <button
              type="button"
              onClick={onCloseEdit}
              title="Düzenlemeyi Tamamla (Enter)"
              className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs active:scale-95"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ROW 2: Compact Node Style (Kart/Organik), Size (S/M/L/XL), Colors & Node Actions */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 border-y py-1 text-[11px]" style={{ borderColor: 'var(--hud-border)' }}>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Offline Speed & Context Pill */}
            <span
              title={`Algılanan Bağlam: ${mapContext.label} • Çevrimdışı Vektör Motoru`}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap"
            >
              <span>{mapContext.emoji}</span>
              <span className="max-w-[110px] truncate">{mapContext.label}</span>
              {offlineMs !== null && (
                <span className="hidden items-center gap-0.5 text-emerald-600 sm:inline-flex dark:text-emerald-400">
                  • <Zap className="h-2.5 w-2.5" />
                  {offlineMs}ms
                </span>
              )}
            </span>

            {/* Sticker Size Selector (S / M / L / XL) */}
            <div
              className="inline-flex items-center gap-0.5 rounded-lg bg-slate-500/10 p-0.5"
              title="Çıkartma Boyutu"
            >
              {SIZE_PRESETS.map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onChangeStickerSize(activeNode.id, sz.id)}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                    effectiveStickerSize === sz.id
                      ? 'bg-sky-500 text-white shadow-2xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            {/* Card vs Organic Boxless Node Style */}
            {!isRootNode && (
              <div
                className="inline-flex items-center gap-0.5 rounded-lg bg-slate-500/10 p-0.5"
                title="Düğüm Görünüm Stili"
              >
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onChangeNodeStyle(activeNode.id, 'card')}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                    effectiveNodeStyle === 'card'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  Kart
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onChangeNodeStyle(activeNode.id, 'organic')}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                    effectiveNodeStyle === 'organic'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  Organik
                </button>
              </div>
            )}
          </div>

          {/* Right Node Utility Actions (Colors, Badge, CrossLink, SubBranches, Remove Sticker, Delete) */}
          <div className="flex items-center gap-1">
            {(isMainBranch || isRootNode) && (
              <div className="hidden items-center gap-1 pr-1 sm:flex">
                {BRANCH_PALETTE.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => onChangeBranchColor(activeNode.id, col)}
                    title="Dal Rengi"
                    className={`h-3.5 w-3.5 rounded-full ${
                      activeNode.branchColor === col
                        ? 'scale-125 ring-2 ring-slate-900 dark:ring-white'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setShowTechBadgeInput((v) => !v)}
              title="Teknik Rozet / Port / Madde Ekle"
              className={`flex h-6.5 w-6.5 items-center justify-center rounded-lg ${
                showTechBadgeInput || activeNode.techBadge
                  ? 'bg-sky-500 text-white'
                  : 'hover:bg-slate-500/10'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                onCloseEdit();
                onStartCrossLink(activeNode.id);
              }}
              title="Başka Dala İlişki Oku Çek"
              className="flex h-6.5 w-6.5 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-500/15 dark:text-indigo-300"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenSmartSubBranches}
              title="Akıllı Alt Dallar Öner"
              className="flex h-6.5 w-6.5 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-500/15 dark:text-amber-300"
            >
              <Wand2 className="h-3.5 w-3.5" />
            </button>

            {activeNode.sticker && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onRemoveSticker(activeNode.id)}
                title="Mevcut Çıkartmayı Kaldır"
                className="flex h-6.5 w-6.5 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-500/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {!isRootNode && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onDeleteNode(activeNode.id)}
                title="Bu Dalı Sil"
                className="flex h-6.5 w-6.5 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ROW 3: Live Horizontal Offline-First Sticker Carousel with Scroll Chevrons */}
        <div className="relative flex items-center">
          {canScrollLeft && !vvMetrics.isMobile && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => scrollCarouselBy(-260)}
              title="Sola Kaydır"
              className="absolute left-0.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 text-slate-800 shadow-md hover:scale-105 dark:bg-slate-900/95 dark:text-white"
              style={{ borderColor: 'var(--hud-border)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <div
            ref={carouselRef}
            onScroll={updateScrollChevrons}
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pt-0.5 pb-0.5"
            style={{ touchAction: 'pan-x' }}
          >
            {filteredCarousel.length === 0 && searchQuery.trim().length > 0 ? (
              <div className="flex h-17 w-full items-center justify-between gap-2 rounded-2xl border border-dashed px-3 py-2 text-xs">
                <span className="opacity-75">
                  “<strong>{searchQuery}</strong>” için doğrudan eşleşen hazır ikon bulunamadı (rastgele ikon gösterilmez).
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={onOpenAIStudio}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 font-extrabold text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI ile Özel Çiz</span>
                </button>
              </div>
            ) : (
              filteredCarousel.map((item, idx) => {
                const isBusy = processingId === item.id;
                const isSelected = activeNode.sticker?.id === item.id;
                const isProLocked = !EntitlementManager.isStickerFree(
                  item,
                  idx,
                  'keyboard_bar'
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={isProLocked ? 'pro-sticker-tile' : 'free-sticker-tile'}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => void handleSelectVisual(item, idx)}
                    title={`${item.title} (${item.providerName})${isProLocked ? ' • PRO' : ''}`}
                    className={`group relative flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border p-1.5 hover:-translate-y-0.5 hover:shadow-md active:scale-95 sm:h-18 sm:w-18 ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/40'
                        : 'bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800'
                    }`}
                    style={{
                      borderColor: isSelected ? undefined : 'var(--hud-border)',
                    }}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      loading="lazy"
                      onError={() => {
                        setBrokenIds((prev) => new Set(prev).add(item.id));
                      }}
                      className="h-11.5 w-11.5 object-contain group-hover:scale-106 sm:h-13 sm:w-13"
                    />
                    {isProLocked && (
                      <span
                        data-testid="pro-sticker-badge"
                        className="pointer-events-none absolute top-1 right-1 rounded-md bg-amber-500 px-1 py-0.2 text-[8.5px] leading-tight font-black tracking-tight text-slate-950 shadow-2xs"
                      >
                        PRO
                      </span>
                    )}
                    {isBusy && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-slate-900/75">
                        <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                      </div>
                    )}
                  </button>
                );
              })
            )}

            {/* Open Full +150 Drawer Tile */}
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenGalleryDrawer}
              className="flex h-16 w-22 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-sky-500/50 bg-sky-500/10 px-2 text-center text-[10.5px] font-extrabold text-sky-700 hover:bg-sky-500/20 sm:h-18 dark:text-sky-300"
            >
              <Search className="h-4 w-4" />
              <span>Tümünü Gör ({Math.max(totalHealthyCount, 0)})</span>
            </button>

            {loadingRemote && (
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed text-[10px] opacity-60 sm:h-18 sm:w-18">
                <Loader2 className="mb-1 h-4 w-4 animate-spin text-sky-500" />
                <span>Ek Kaynak</span>
              </div>
            )}
          </div>

          {canScrollRight && !vvMetrics.isMobile && filteredCarousel.length > 5 && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => scrollCarouselBy(260)}
              title="Sağa Kaydır"
              className="absolute right-0.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 text-slate-800 shadow-md hover:scale-105 dark:bg-slate-900/95 dark:text-white"
              style={{ borderColor: 'var(--hud-border)' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
