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
  Plus,
  Keyboard,
  Eraser,
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
import {
  dismissNativeKeyboard,
  setStudioBarHeight,
  useKeyboardInset,
} from '../core/native/useKeyboardInset';

interface KeyboardVisualBarProps {
  activeNode: MindNode | null;
  isEditingText: boolean;
  isRootNode: boolean;
  isMainBranch: boolean;
  defaultNodeStyle: NodeVisualStyle;
  mapContext: MapContextAnalysis;
  proactiveSuggestions: ProactiveBranchSuggestion[];
  nodeScreenPos: { x: number; y: number } | null;
  onUpdateNodeTitle: (nodeId: string, title: string) => void;
  onRequestEditTitle: () => void;
  onAddChildBranch: (nodeId: string) => void;
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
  isEditingText,
  isRootNode,
  isMainBranch,
  defaultNodeStyle,
  mapContext,
  proactiveSuggestions,
  nodeScreenPos,
  onUpdateNodeTitle,
  onRequestEditTitle,
  onAddChildBranch,
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
  const kb = useKeyboardInset();

  const [styleMode, setStyleMode] = useState<VisualStyleMode>('illustration');
  const [allFederated, setAllFederated] = useState<VisualSearchResult[]>([]);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [offlineMs, setOfflineMs] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showTechBadgeInput, setShowTechBadgeInput] = useState(false);
  const [showStyleCustomize, setShowStyleCustomize] = useState(false);
  const [barHeight, setBarHeight] = useState(216);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const barRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);
  const swipeStartYRef = useRef<number | null>(null);

  // Measure actual rendered height and publish globally for CanvasStage viewport centering
  useEffect(() => {
    if (!activeNode) {
      setStudioBarHeight(0);
      return;
    }
    const el = barRef.current;
    if (!el) return;
    const syncH = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 40) {
        setBarHeight(h);
        setStudioBarHeight(h);
      }
    };
    syncH();
    const ro = new ResizeObserver(syncH);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setStudioBarHeight(0);
    };
  }, [activeNode?.id]);

  const searchQuery = activeNode?.title ?? '';
  const activeBranchColor = activeNode?.branchColor ?? '#0EA5E9';

  useEffect(() => {
    setShowTechBadgeInput(Boolean(activeNode?.techBadge));
    setBrokenIds(new Set());
  }, [activeNode?.id, activeNode?.techBadge]);

  // V3 Search Pipeline: 0ms Built-In Atlas -> 16ms Offline 25,209-icon Shard Search -> 185ms Online Enrichment
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
    activeNode.stickerSize ??
    (effectiveNodeStyle === 'organic' && !isRootNode ? 'lg' : 'md');

  // Compact vertical layout if small phone landscape has keyboard open
  const isTightAboveKeyboard = kb.isKeyboardOpen && kb.viewportH < 360;

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

  // Native iOS / iPadOS / Web Adaptive Positioning:
  // Uses exact UIKit `keyboardHeight` + `visualViewport` so the Studio Dock ALWAYS floats cleanly above the keyboard!
  const useFullWidthBottomSheet = kb.isPhone;
  const useCenteredTabletDock =
    !kb.isPhone && (kb.isTablet || kb.isKeyboardOpen || kb.isTouchDevice || !nodeScreenPos);

  let containerStyle: React.CSSProperties;

  if (useFullWidthBottomSheet) {
    containerStyle = {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: `${kb.keyboardHeight}px`,
      width: '100vw',
      maxWidth: '100vw',
      maxHeight: `${Math.max(185, kb.viewportH - 64)}px`,
      transition: 'bottom 180ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  } else if (useCenteredTabletDock) {
    const cardWidth = Math.min(780, kb.viewportW - 24);
    const leftPx = Math.round((kb.viewportW - cardWidth) * 0.5);
    const bottomGap = kb.isKeyboardOpen ? kb.keyboardHeight + 8 : 16;
    containerStyle = {
      position: 'fixed',
      left: `${leftPx}px`,
      bottom: `${bottomGap}px`,
      width: `${cardWidth}px`,
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: `${Math.max(210, kb.viewportH - 72)}px`,
      transition: 'bottom 180ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  } else {
    const cardWidth = Math.min(736, kb.viewportW - 32);
    const clampedLeft = Math.max(
      16,
      Math.min(kb.viewportW - cardWidth - 16, nodeScreenPos!.x - cardWidth * 0.5)
    );
    const placeAbove = nodeScreenPos!.y > kb.viewportH * 0.56;
    const rawTop = placeAbove
      ? nodeScreenPos!.y - (barHeight + 92)
      : nodeScreenPos!.y + 74;
    const clampedTop = Math.max(
      64,
      Math.min(kb.viewportH - barHeight - 16, rawTop)
    );

    containerStyle = {
      position: 'fixed',
      left: `${Math.round(clampedLeft)}px`,
      top: `${Math.round(clampedTop)}px`,
      width: `${cardWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
    };
  }

  return (
    <div
      ref={barRef}
      style={containerStyle}
      data-testid="keyboard-visual-bar"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        if (kb.isTouchDevice && e.touches.length === 1) {
          swipeStartYRef.current = e.touches[0].clientY;
        }
      }}
      onTouchEnd={(e) => {
        if (
          kb.isTouchDevice &&
          swipeStartYRef.current !== null &&
          e.changedTouches.length === 1
        ) {
          const dy = swipeStartYRef.current - e.changedTouches[0].clientY;
          swipeStartYRef.current = null;
          if (dy > 48) {
            onOpenGalleryDrawer();
          }
        }
      }}
      className="animate-studio-dock z-40 box-border select-none"
    >
      <div
        className={`flex max-h-full w-full flex-col overflow-hidden border shadow-2xl backdrop-blur-xl ${
          useFullWidthBottomSheet
            ? 'rounded-t-3xl border-x-0 border-b-0 px-3 pt-1.5'
            : 'rounded-3xl px-3.5 py-2.5'
        }`}
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom:
            useFullWidthBottomSheet && !kb.isKeyboardOpen
              ? 'max(10px, var(--safe-bottom))'
              : useFullWidthBottomSheet
              ? '8px'
              : undefined,
        }}
      >
        {/* Top Swipe Handle */}
        {useFullWidthBottomSheet && (
          <button
            type="button"
            onClick={onOpenGalleryDrawer}
            title="Tam 25K Görsel Galerisi İçin Yukarı Kaydırın"
            className="mx-auto mb-1.5 flex w-full items-center justify-center py-0.5"
          >
            <span className="h-1 w-11 rounded-full bg-slate-400/45" />
          </button>
        )}

        {/* ROW 0: Synced Node Title Input + Add Child + Keyboard Toggle + Done */}
        <div className="mb-2 flex items-center gap-1.5">
          <div
            className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border bg-white/75 px-2.5 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-sky-500 dark:bg-slate-900/75"
            style={{ borderColor: 'var(--hud-border)' }}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/80 dark:ring-slate-900"
              style={{ backgroundColor: activeBranchColor }}
            />
            <input
              ref={titleInputRef}
              type="text"
              value={activeNode.title}
              onFocus={() => {
                if (!isEditingText) onRequestEditTitle();
              }}
              onChange={(e) => onUpdateNodeTitle(activeNode.id, e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  void dismissNativeKeyboard();
                  onCloseEdit();
                }
              }}
              placeholder="Dal başlığını yazın veya aşağıdan ikon seçin..."
              className="allow-text-input min-w-0 flex-1 bg-transparent text-base font-extrabold outline-none sm:text-sm"
              style={{ color: 'var(--node-text)' }}
              data-testid="studio-title-input"
            />
            {activeNode.title.length > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  onUpdateNodeTitle(activeNode.id, '');
                  titleInputRef.current?.focus();
                }}
                aria-label="Başlığı temizle"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-55 hover:bg-slate-500/15 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              void hapticLight();
              onAddChildBranch(activeNode.id);
            }}
            title="Bu dala yeni alt dal ekle"
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-2.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Alt Dal</span>
          </button>

          {kb.isTouchDevice && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                void hapticLight();
                if (kb.isKeyboardOpen) {
                  void dismissNativeKeyboard();
                } else {
                  onRequestEditTitle();
                  setTimeout(() => titleInputRef.current?.focus(), 30);
                }
              }}
              title={kb.isKeyboardOpen ? 'Klavyeyi Gizle (Görsellere Odaklan)' : 'Metni Düzenle (Klavye Aç)'}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border active:scale-95 ${
                kb.isKeyboardOpen
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                  : 'hover:bg-slate-500/10'
              }`}
              style={{ borderColor: kb.isKeyboardOpen ? undefined : 'var(--hud-border)' }}
            >
              <Keyboard className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void dismissNativeKeyboard();
              onCloseEdit();
            }}
            title="Tamamlandı"
            data-testid="studio-done-btn"
            className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-2xl bg-emerald-500 px-3 text-xs font-extrabold text-white shadow-xs active:scale-95"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Tamam</span>
          </button>
        </div>

        {/* Proactive Sub-Branch Quick Chips on newly created empty nodes */}
        {!isTightAboveKeyboard &&
          isFreshEmptyBranch &&
          proactiveSuggestions.length > 0 && (
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
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border bg-white/85 px-2.5 py-1 text-xs font-extrabold whitespace-nowrap shadow-2xs hover:border-violet-500 hover:bg-violet-500/10 active:scale-95 dark:bg-slate-800/85"
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

        {/* Optional Inline Tech Badge Input */}
        {showTechBadgeInput && !isFreshEmptyBranch && (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1 text-[10.5px] font-extrabold text-sky-700 dark:text-sky-300">
              <Tag className="h-3 w-3" /> Rozet:
            </span>
            <input
              type="text"
              value={activeNode.techBadge ?? ''}
              onChange={(e) => onUpdateTechBadge(activeNode.id, e.target.value)}
              placeholder="Örn: Port 443, S1/S2, HMK m.341..."
              className="allow-text-input min-w-0 flex-1 rounded-xl border bg-transparent px-2.5 py-1.5 font-mono text-base font-bold outline-none focus:ring-2 focus:ring-sky-500 sm:text-xs"
              style={{ borderColor: 'var(--hud-border)' }}
            />
          </div>
        )}

        {/* ROW 1: Style Mode Tabs + Always-Visible Creation Tools (Horizontal Scrollable on narrow phones, Clean Row on iPad/Desktop) */}
        <div className="no-scrollbar mb-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {/* Style Tabs */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5">
            {STYLE_TABS.map((tab) => {
              const active = styleMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setStyleMode(tab.id)}
                  className={`flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] font-extrabold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span className={active ? 'inline' : 'hidden sm:inline'}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={onOpenGalleryDrawer}
            title="25.000+ Çevrimdışı & Federatif Görsel Galerisi"
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 text-[11.5px] font-extrabold whitespace-nowrap text-sky-700 hover:bg-sky-500/25 active:scale-95 dark:text-sky-300"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>+{Math.max(150, totalHealthyCount)} Görsel</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={onOpenAIStudio}
            title="4 Adaylı AI Çıkartma Stüdyosu"
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-[11.5px] font-extrabold whitespace-nowrap text-white shadow-xs active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>AI Çiz</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={onOpenNoteCropper}
            title="Ders Notundan / Slayttan Şema Kes"
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-emerald-700 hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
          >
            <Camera className="h-3.5 w-3.5 shrink-0" />
            <span>Nottan Kes</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={onOpenQuickSketch}
            title="Kalem veya Parmakla Çiz"
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/12 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-amber-700 hover:bg-amber-500/20 active:scale-95 dark:text-amber-300"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            <span>Karala</span>
          </button>
        </div>

        {/* ROW 2: Live Horizontal Sticker Carousel (Prominent, Crisp, Never Obstructed) */}
        <div className="relative flex items-center">
          {canScrollLeft && !kb.isTouchDevice && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => scrollCarouselBy(-280)}
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
            className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto py-0.5"
            style={{ touchAction: 'pan-x' }}
          >
            {filteredCarousel.length === 0 && searchQuery.trim().length > 0 ? (
              <div className="flex h-17 w-full items-center justify-between gap-2 rounded-2xl border border-dashed px-3 py-2 text-xs">
                <span className="truncate opacity-75">
                  “<strong>{searchQuery}</strong>” için hazır ikon bulunamadı.
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={onOpenGalleryDrawer}
                    className="inline-flex items-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/12 px-2.5 py-1.5 font-extrabold text-sky-700 dark:text-sky-300"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Galeri</span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={onOpenAIStudio}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 font-extrabold text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Çiz</span>
                  </button>
                </div>
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
                    className={`group relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border p-1.5 transition hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                      isTightAboveKeyboard
                        ? 'h-14 w-14'
                        : 'h-[66px] w-[66px] sm:h-[74px] sm:w-[74px]'
                    } ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/12 ring-2 ring-sky-500/45'
                        : 'bg-white/85 hover:bg-white dark:bg-slate-800/85 dark:hover:bg-slate-800'
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
                      className={`${
                        isTightAboveKeyboard ? 'h-10 w-10' : 'h-12 w-12 sm:h-13 sm:w-13'
                      } object-contain group-hover:scale-106`}
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
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                      </div>
                    )}
                  </button>
                );
              })
            )}

            {loadingRemote && (
              <div className="flex h-[66px] w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed text-sky-500">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>

          {canScrollRight && !kb.isTouchDevice && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => scrollCarouselBy(280)}
              title="Sağa Kaydır"
              className="absolute right-0.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 text-slate-800 shadow-md hover:scale-105 dark:bg-slate-900/95 dark:text-white"
              style={{ borderColor: 'var(--hud-border)' }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ROW 3: Accessible Size / Style / Branch Colors / Link / Delete Strip (Never hidden on mobile!) */}
        {!isTightAboveKeyboard && (
          <div
            className="no-scrollbar mt-1.5 flex items-center justify-between gap-2 overflow-x-auto border-t pt-1.5 text-[11px]"
            style={{ borderColor: 'var(--hud-border)' }}
          >
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Node Size Preset (S/M/L/XL) */}
              <div
                className="inline-flex items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5"
                title="Çıkartma Boyutu"
              >
                {SIZE_PRESETS.map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => onChangeStickerSize(activeNode.id, sz.id)}
                    className={`min-h-[28px] min-w-[26px] rounded-lg px-1.5 text-[10.5px] font-extrabold ${
                      effectiveStickerSize === sz.id
                        ? 'bg-sky-500 text-white shadow-2xs'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>

              {/* Card vs Organic Style Toggle */}
              {!isRootNode && (
                <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5">
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => onChangeNodeStyle(activeNode.id, 'card')}
                    className={`min-h-[28px] rounded-lg px-2 text-[10.5px] font-extrabold ${
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
                    className={`min-h-[28px] rounded-lg px-2 text-[10.5px] font-extrabold ${
                      effectiveNodeStyle === 'organic'
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    Organik
                  </button>
                </div>
              )}

              {/* Branch Color Palette Toggle / Inline Swatches */}
              {(isMainBranch || isRootNode || showStyleCustomize) && (
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-500/10 px-2 py-1">
                  {BRANCH_PALETTE.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => onChangeBranchColor(activeNode.id, col)}
                      title="Dal Rengi"
                      className={`h-5 w-5 rounded-full transition-transform ${
                        activeNode.branchColor === col
                          ? 'scale-115 ring-2 ring-slate-900 dark:ring-white'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              )}

              {offlineMs !== null && (
                <span className="hidden items-center gap-0.5 rounded-lg bg-emerald-500/12 px-2 py-1 text-[10px] font-extrabold text-emerald-700 md:inline-flex dark:text-emerald-300">
                  <Zap className="h-3 w-3" />
                  {offlineMs}ms Offline
                </span>
              )}
            </div>

            {/* Right Utility Pills */}
            <div className="flex shrink-0 items-center gap-1">
              {!isMainBranch && !isRootNode && (
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setShowStyleCustomize((v) => !v)}
                  title="Dal Rengi Seç"
                  className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
                >
                  <span
                    className="h-4 w-4 rounded-full border border-white shadow-xs"
                    style={{ backgroundColor: activeBranchColor }}
                  />
                </button>
              )}

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setShowTechBadgeInput((v) => !v)}
                title="Teknik Rozet / Madde Ekle"
                className={`inline-flex h-8 items-center gap-1 rounded-xl px-2 font-bold ${
                  showTechBadgeInput || activeNode.techBadge
                    ? 'bg-sky-500 text-white'
                    : 'hover:bg-slate-500/10'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rozet</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  void dismissNativeKeyboard();
                  onCloseEdit();
                  onStartCrossLink(activeNode.id);
                }}
                title="Başka Dala İlişki Oku Çek"
                className="inline-flex h-8 items-center gap-1 rounded-xl px-2 font-bold text-indigo-600 hover:bg-indigo-500/12 dark:text-indigo-300"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">İlişki</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenSmartSubBranches}
                title="Akıllı Alt Dallar Öner"
                className="inline-flex h-8 items-center gap-1 rounded-xl px-2 font-bold text-amber-600 hover:bg-amber-500/12 dark:text-amber-300"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Öner</span>
              </button>

              {activeNode.sticker && (
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onRemoveSticker(activeNode.id)}
                  title="İkonu Kaldır"
                  className="inline-flex h-8 items-center gap-1 rounded-xl px-2 font-bold text-slate-600 hover:bg-slate-500/10 dark:text-slate-300"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">İkon Sil</span>
                </button>
              )}

              {!isRootNode && (
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    void dismissNativeKeyboard();
                    onDeleteNode(activeNode.id);
                  }}
                  title="Dalı Sil"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/12"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
