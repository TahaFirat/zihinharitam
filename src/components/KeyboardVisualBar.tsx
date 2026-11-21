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
  ImagePlus,
  FileText,
  CheckSquare,
  Flame,
  Gift,
  Crown,
} from 'lucide-react';
import {
  BRANCH_PALETTE,
  type IconTierFilter,
  type MindNode,
  type NodePriorityTag,
  type NodeVisualStyle,
  type ProactiveBranchSuggestion,
  type StickerAsset,
  type StickerSizePreset,
  type VisualSearchResult,
  type VisualStyleMode,
} from '../types/mindmap';
import { resolveStarterStickerForConcept } from '../data/academicTemplates';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import { triggerGalleryPhotoPicker } from '../core/visuals/PhotoStickerImporter';
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
  onUpdateNodeNote: (nodeId: string, note: string) => void;
  onToggleNodeCheck: (nodeId: string) => void;
  onChangePriorityTag: (nodeId: string, tag: NodePriorityTag | null) => void;
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

const STYLE_TABS: Array<{ id: VisualStyleMode | 'all'; emoji: string; label: string }> = [
  { id: 'all', emoji: '🌟', label: 'Tümü' },
  { id: 'illustration', emoji: '✨', label: 'Çizim' },
  { id: '3d', emoji: '🧊', label: '3D' },
  { id: 'diagram', emoji: '📐', label: 'Şema' },
  { id: 'photo', emoji: '📷', label: 'Foto' },
];

const SIZE_PRESETS: Array<{ id: StickerSizePreset; label: string; hint: string }> = [
  { id: 'sm', label: 'S', hint: 'Küçük İkon (50px)' },
  { id: 'md', label: 'M', hint: 'Orta İkon (86px)' },
  { id: 'lg', label: 'L', hint: 'Büyük İkon (126px)' },
  { id: 'xl', label: 'XL', hint: 'Dev İkon (170px)' },
];

const PRIORITY_CYCLE: Array<NodePriorityTag | null> = [
  null,
  'important',
  'exam',
  'review',
];

const PRIORITY_LABELS: Record<NodePriorityTag, string> = {
  important: '🔥 Önemli',
  exam: '🎓 Sınav',
  review: '❓ Tekrar',
};

export const KeyboardVisualBar: React.FC<KeyboardVisualBarProps> = React.memo(({
  activeNode,
  isEditingText,
  isRootNode,
  isMainBranch,
  defaultNodeStyle,
  mapContext,
  proactiveSuggestions,
  nodeScreenPos: _nodeScreenPos,
  onUpdateNodeTitle,
  onUpdateNodeNote,
  onToggleNodeCheck,
  onChangePriorityTag,
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
  const { isLifetimePro } = useEntitlements();
  const kb = useKeyboardInset();

  const [styleMode, setStyleMode] = useState<VisualStyleMode | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<IconTierFilter>('all');
  const [allFederated, setAllFederated] = useState<VisualSearchResult[]>([]);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [offlineMs, setOfflineMs] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showTechBadgeInput, setShowTechBadgeInput] = useState(false);
  const [showStyleCustomize, setShowStyleCustomize] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const barRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);
  const swipeStartYRef = useRef<number | null>(null);

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
    setShowTechBadgeInput(false);
    setShowNoteEditor(false);
    setBrokenIds(new Set());
  }, [activeNode?.id]);

  // 0ms Built-In Atlas -> 16ms Offline 25,209-icon Shard Search -> 185ms Online Enrichment
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
        110
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

  const healthyByMode = useMemo(() => {
    const healthy = allFederated.filter((r) => !brokenIds.has(r.id));
    if (styleMode === 'all') return healthy;
    return VisualSearchOrchestrator.filterResultsByMode(healthy, styleMode);
  }, [allFederated, styleMode, brokenIds]);

  const carouselEntries = useMemo(() => {
    const tagged = healthyByMode.map((item, origIdx) => ({
      item,
      origIdx,
      isFree: EntitlementManager.isStickerFree(item, origIdx, 'keyboard_bar'),
    }));

    if (tierFilter === 'free') {
      return tagged.filter((t) => t.isFree).slice(0, 32);
    }
    if (tierFilter === 'pro') {
      return tagged
        .filter((t) => !t.isFree || t.item.tier === 'pro' || t.item.mode === '3d')
        .slice(0, 32);
    }
    return tagged.slice(0, 32);
  }, [healthyByMode, tierFilter, isLifetimePro]);

  const freeTotalCount = useMemo(
    () =>
      healthyByMode.filter((item, idx) =>
        EntitlementManager.isStickerFree(item, idx, 'keyboard_bar')
      ).length,
    [healthyByMode, isLifetimePro]
  );

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
  }, [carouselEntries]);

  if (!activeNode) return null;

  const isFreshEmptyBranch = !isRootNode && activeNode.title.trim().length === 0;
  const effectiveNodeStyle: NodeVisualStyle =
    activeNode.nodeStyle ?? defaultNodeStyle ?? 'card';
  const effectiveStickerSize: StickerSizePreset =
    activeNode.stickerSize ?? 'md';

  const isTightAboveKeyboard = kb.isKeyboardOpen && kb.viewportH < 360;
  const isSlimKeyboardMode =
    kb.isKeyboardOpen && (kb.isPhone || kb.isTablet) && !showNoteEditor;

  const handleSelectVisual = async (
    item: VisualSearchResult,
    _origIdx: number,
    isFree: boolean
  ) => {
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

  const handlePickStickerSize = (size: StickerSizePreset) => {
    void hapticLight();
    // If user taps S/M/L/XL before picking an icon, automatically attach a matching free starter icon so sizing works visibly right away!
    if (!activeNode.sticker) {
      const freeCandidate = carouselEntries.find((c) => c.isFree);
      if (freeCandidate) {
        void VisualSearchOrchestrator.materializeStickerSelection(freeCandidate.item, {
          retintToBranchColor: freeCandidate.item.isDuotoneColorizable
            ? activeBranchColor
            : null,
        }).then((st) => {
          onApplySticker(activeNode.id, st);
          onChangeStickerSize(activeNode.id, size);
        });
        return;
      }
      const fallback = resolveStarterStickerForConcept(
        activeNode.title || 'Yeni Konu',
        'genel'
      );
      onApplySticker(activeNode.id, fallback);
    }
    onChangeStickerSize(activeNode.id, size);
  };

  const handleCyclePriority = () => {
    void hapticLight();
    const cur = activeNode.priorityTag ?? null;
    const idx = PRIORITY_CYCLE.indexOf(cur);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    onChangePriorityTag(activeNode.id, next);
  };

  const scrollCarouselBy = (delta: number) => {
    carouselRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const useFullWidthBottomSheet = kb.isPhone;

  let containerStyle: React.CSSProperties;

  if (useFullWidthBottomSheet) {
    containerStyle = {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: `${kb.keyboardHeight}px`,
      width: '100vw',
      maxWidth: '100vw',
      maxHeight: `${
        isSlimKeyboardMode
          ? Math.min(138, Math.max(96, kb.viewportH - 56))
          : Math.min(410, Math.max(220, kb.viewportH - 64))
      }px`,
      transition: 'bottom 180ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  } else {
    // 100% Native iPad / Android Tablet / Landscape Centered Bottom Studio Dock (Zero mid-screen floating or right-edge clipping!)
    const cardWidth = Math.min(860, Math.max(320, kb.viewportW - 28));
    const leftPx = Math.max(14, Math.round((kb.viewportW - cardWidth) * 0.5));
    containerStyle = {
      position: 'fixed',
      left: `${leftPx}px`,
      bottom: kb.isKeyboardOpen
        ? `${kb.keyboardHeight + 10}px`
        : 'max(28px, calc(var(--safe-bottom) + 24px))',
      width: `${cardWidth}px`,
      maxWidth: 'calc(100vw - 28px)',
      maxHeight: `${
        isSlimKeyboardMode
          ? Math.min(140, Math.max(98, kb.viewportH - 68))
          : Math.min(420, Math.max(230, kb.viewportH - 88))
      }px`,
      transition: 'bottom 180ms cubic-bezier(0.22, 1, 0.36, 1)',
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
          if (dy > 48 && !showNoteEditor) {
            onOpenGalleryDrawer();
          }
        }
      }}
      className="animate-studio-dock z-40 box-border select-none"
    >
      <div
        className={`flex max-h-full w-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain border shadow-2xl ${
          isSlimKeyboardMode
            ? useFullWidthBottomSheet
              ? 'rounded-t-2xl border-x-0 border-b-0 px-2.5 pt-1.5'
              : 'rounded-2xl px-3 py-1.5'
            : useFullWidthBottomSheet
            ? 'rounded-t-3xl border-x-0 border-b-0 px-3 pt-1.5'
            : 'rounded-3xl px-4 py-2.5'
        }`}
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: isSlimKeyboardMode
            ? '8px'
            : useFullWidthBottomSheet && !kb.isKeyboardOpen
            ? 'max(22px, calc(var(--safe-bottom) + 14px))'
            : useFullWidthBottomSheet
            ? '10px'
            : '12px',
        }}
      >
        {useFullWidthBottomSheet && !isSlimKeyboardMode && (
          <button
            type="button"
            onClick={onOpenGalleryDrawer}
            title="Tam Görsel Galerisi İçin Yukarı Kaydırın"
            className="mx-auto mb-1 flex w-full items-center justify-center py-0.5"
          >
            <span className="h-1 w-10 rounded-full bg-slate-400/45" />
          </button>
        )}

        {/* ROW 0: Synced Node/Tree Title Input + Note Toggle + Gallery Photo + Child + Delete + Done */}
        <div
          className={`flex items-center ${
            isSlimKeyboardMode ? 'mb-1 gap-1' : 'mb-1.5 gap-1.5'
          }`}
        >
          <div
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl border bg-white/75 px-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-sky-500 dark:bg-slate-900/75 ${
              isSlimKeyboardMode ? 'h-9 py-1' : 'h-10 py-1'
            }`}
            style={{ borderColor: 'var(--hud-border)' }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/80 dark:ring-slate-900"
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
              placeholder={
                isRootNode
                  ? 'Ana ağaç / harita adını yazın...'
                  : isSlimKeyboardMode
                  ? 'Dal başlığı yazın...'
                  : 'Dal başlığını yazın, ardından aşağıdan ikon seçin...'
              }
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

          {/* 1-Tap Long Description / Note Toggle (`📝 Açıklama`) */}
          <button
            type="button"
            data-testid="studio-note-toggle-btn"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              void hapticLight();
              setShowNoteEditor((prev) => {
                const next = !prev;
                if (next) {
                  setTimeout(() => noteInputRef.current?.focus(), 40);
                }
                return next;
              });
            }}
            title="Bu dalın altına uzun açıklama / ders notu ekle"
            className={`inline-flex shrink-0 items-center gap-1 rounded-2xl border font-extrabold active:scale-95 ${
              isSlimKeyboardMode ? 'h-9 px-2 text-[11px]' : 'h-10 px-2.5 text-xs'
            } ${
              showNoteEditor || Boolean(activeNode.note?.trim())
                ? 'border-sky-500 bg-sky-500 text-white shadow-2xs'
                : 'border-sky-500/35 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {!isSlimKeyboardMode && (
              <span className="hidden sm:inline">Açıklama</span>
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              void hapticLight();
              onAddChildBranch(activeNode.id);
            }}
            title="Bu dala yeni alt dal ekle"
            className={`inline-flex shrink-0 items-center gap-1 rounded-2xl border border-emerald-500/35 bg-emerald-500/12 font-extrabold text-emerald-700 hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300 ${
              isSlimKeyboardMode ? 'h-9 px-2 text-[11px]' : 'h-10 px-2.5 text-xs'
            }`}
          >
            <Plus className="h-4 w-4" />
            {!isSlimKeyboardMode && (
              <span className="hidden xs:inline sm:inline">Alt Dal</span>
            )}
          </button>

          {!isRootNode && (
            <button
              type="button"
              data-testid="studio-delete-btn"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                void dismissNativeKeyboard();
                onDeleteNode(activeNode.id);
              }}
              title="Bu dalı sil (Geri Alınabilir)"
              aria-label="Dalı sil"
              className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-2xl border border-rose-500/35 bg-rose-500/12 font-extrabold text-rose-600 hover:bg-rose-500/20 active:scale-95 dark:text-rose-400 ${
                isSlimKeyboardMode ? 'h-9 w-8.5' : 'h-10 px-2.5 text-xs'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {!isSlimKeyboardMode && <span className="hidden sm:inline">Sil</span>}
            </button>
          )}

          {isSlimKeyboardMode && (
            <>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() =>
                  triggerGalleryPhotoPicker(activeBranchColor, (sticker) => {
                    onApplySticker(activeNode.id, sticker);
                    void hapticSuccess();
                  })
                }
                title="Galeriden Fotoğraf Ekle"
                className="inline-flex h-9 w-8.5 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/40 bg-indigo-500/15 text-indigo-700 active:scale-95 dark:text-indigo-300"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenGalleryDrawer}
                title="43.000+ Çevrimdışı & 540.000+ Görsel Galerisi"
                className="inline-flex h-9 w-8.5 shrink-0 items-center justify-center rounded-2xl border border-sky-500/40 bg-sky-500/15 text-sky-700 active:scale-95 dark:text-sky-300"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </>
          )}

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
              title={
                kb.isKeyboardOpen
                  ? 'Klavyeyi Gizle (Görsellere ve Araçlara Geç)'
                  : 'Metni Düzenle (Klavye Aç)'
              }
              className={`flex shrink-0 items-center justify-center rounded-2xl border active:scale-95 ${
                isSlimKeyboardMode ? 'h-9 w-8.5' : 'h-10 w-10'
              } ${
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
            className={`flex shrink-0 items-center justify-center gap-1 rounded-2xl bg-emerald-500 font-extrabold text-white shadow-xs active:scale-95 ${
              isSlimKeyboardMode ? 'h-9 px-2.5 text-[11px]' : 'h-10 px-3 text-xs'
            }`}
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Tamam</span>
          </button>
        </div>

        {/* EXPANDABLE MULTI-LINE BRANCH DESCRIPTION EDITOR (`📝 Uzun Açıklama`) */}
        {showNoteEditor && (
          <div className="mb-1.5 rounded-2xl border bg-white/80 p-2 shadow-inner dark:bg-slate-900/80" style={{ borderColor: 'var(--hud-border)' }}>
            <div className="mb-1 flex items-center justify-between text-[10.5px] font-extrabold opacity-75">
              <span>📝 Dal Altı Uzun Açıklama / Ders Notu (Diğer dallara karışmaz, otomatik hizalanır)</span>
              {activeNode.note && (
                <button
                  type="button"
                  onClick={() => onUpdateNodeNote(activeNode.id, '')}
                  className="text-rose-500 hover:underline"
                >
                  Temizle
                </button>
              )}
            </div>
            <textarea
              ref={noteInputRef}
              data-testid="studio-note-textarea"
              rows={2}
              value={activeNode.note ?? ''}
              onChange={(e) => onUpdateNodeNote(activeNode.id, e.target.value)}
              placeholder="Bu dal için detaylı açıklama, tanım, örnek veya maddeler yazın..."
              className="allow-text-input max-h-24 w-full resize-y rounded-xl border bg-transparent px-2.5 py-1.5 text-base leading-relaxed font-medium outline-none focus:ring-2 focus:ring-sky-500 sm:text-xs"
              style={{ borderColor: 'var(--hud-border)', color: 'var(--node-text)' }}
            />
          </div>
        )}

        {/* Friendly Continuous Icon Guidance Banner when branch has no custom icon yet */}
        {!isSlimKeyboardMode &&
          !showNoteEditor &&
          !isTightAboveKeyboard &&
          !activeNode.sticker && (
            <div className="mb-1.5 flex items-center justify-between gap-2 rounded-xl border border-sky-500/25 bg-sky-500/8 px-2.5 py-1 text-[11px] font-bold text-sky-800 dark:text-sky-200">
              <span className="truncate">
                🎨 Dalınızı görselleştirin: Aşağıdan <strong>Ücretsiz İkon</strong> seçin veya <strong>Galeriden Foto</strong> ekleyin!
              </span>
              <button
                type="button"
                onClick={onOpenGalleryDrawer}
                className="shrink-0 rounded-lg bg-sky-500 px-2 py-0.5 text-[10px] font-extrabold text-white"
              >
                Tüm İkonlar
              </button>
            </div>
          )}

        {/* Proactive Sub-Branch Quick Chips on newly created empty nodes */}
        {!isSlimKeyboardMode &&
          !showNoteEditor &&
          !isTightAboveKeyboard &&
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
        {!isSlimKeyboardMode && showTechBadgeInput && !isFreshEmptyBranch && (
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

        {/* ROW 1: Free/Pro Filter + Style Tabs + Gallery Photo Import + 3D Studio + Gallery */}
        {!isSlimKeyboardMode && (
          <div className="no-scrollbar mb-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {/* 1-Tap Free vs Pro Filter (`[Tümü | 🎁 Ücretsiz | 👑 Pro 3D]`) */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-0.5">
              <button
                type="button"
                data-testid="bar-tier-all-btn"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setTierFilter('all')}
                className={`min-h-[32px] rounded-lg px-2 text-[11px] font-extrabold whitespace-nowrap transition ${
                  tierFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                data-testid="bar-tier-free-btn"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setTierFilter((prev) => (prev === 'free' ? 'all' : 'free'))}
                className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-extrabold whitespace-nowrap transition ${
                  tierFilter === 'free'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                }`}
              >
                <Gift className="h-3 w-3" />
                <span>Ücretsiz ({Math.max(12, freeTotalCount)})</span>
              </button>
              <button
                type="button"
                data-testid="bar-tier-pro-btn"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setTierFilter((prev) => (prev === 'pro' ? 'all' : 'pro'))}
                className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-[11px] font-extrabold whitespace-nowrap transition ${
                  tierFilter === 'pro'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-amber-700 hover:bg-amber-500/15 dark:text-amber-300'
                }`}
              >
                <Crown className="h-3 w-3" />
                <span>Pro 3D</span>
              </button>
            </div>

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
                    className={`flex min-h-[32px] items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    <span>{tab.emoji}</span>
                    <span className={active ? 'inline' : 'hidden md:inline'}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 1-Tap Device Photo Gallery Picker (`🖼️ Foto Ekle`) */}
            <button
              type="button"
              data-testid="bar-gallery-photo-btn"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() =>
                triggerGalleryPhotoPicker(activeBranchColor, (sticker) => {
                  onApplySticker(activeNode.id, sticker);
                  void hapticSuccess();
                })
              }
              title="Telefon / Tablet Galerisinden Kendi Fotoğrafını veya Görselini Ekle (%100 Ücretsiz)"
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-indigo-700 hover:bg-indigo-500/25 active:scale-95 dark:text-indigo-300"
            >
              <ImagePlus className="h-3.5 w-3.5 shrink-0" />
              <span>Foto Ekle</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenGalleryDrawer}
              title="43.000+ Çevrimdışı & 540.000+ Online Görsel Galerisi"
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-sky-700 hover:bg-sky-500/25 active:scale-95 dark:text-sky-300"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span>+{Math.max(150, totalHealthyCount)} İkon</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenAIStudio}
              title="3D & Özel Tasarım Çıkartma Stüdyosu (%100 Ücretsiz)"
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-[11.5px] font-extrabold whitespace-nowrap text-white shadow-xs active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>3D & Özel İkon</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenNoteCropper}
              title="Ders Notundan / Slayttan Şema Kes"
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-emerald-700 hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
            >
              <Camera className="h-3.5 w-3.5 shrink-0" />
              <span>Nottan Kes</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={onOpenQuickSketch}
              title="Kalem veya Parmakla Çiz"
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/12 px-2.5 text-[11.5px] font-extrabold whitespace-nowrap text-amber-700 hover:bg-amber-500/20 active:scale-95 dark:text-amber-300"
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span>Karala</span>
            </button>
          </div>
        )}

        {/* ROW 2: Live Horizontal Sticker Carousel */}
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
            className={`no-scrollbar flex w-full items-center overflow-x-auto ${
              isSlimKeyboardMode ? 'gap-1.5 py-0' : 'gap-2 py-0.5'
            }`}
            style={{ touchAction: 'pan-x' }}
          >
            {isSlimKeyboardMode &&
              isFreshEmptyBranch &&
              proactiveSuggestions.length > 0 &&
              searchQuery.trim().length === 0 &&
              proactiveSuggestions.slice(0, 3).map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    void hapticSuccess();
                    onApplyProactiveSuggestion(activeNode.id, sug);
                  }}
                  className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-violet-500/35 bg-violet-500/10 px-2.5 text-[11px] font-extrabold whitespace-nowrap active:scale-95"
                >
                  <img
                    src={sug.sticker.url}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                  <span>{sug.title}</span>
                </button>
              ))}

            {carouselEntries.length === 0 && searchQuery.trim().length > 0 ? (
              <div className="flex h-12 w-full items-center justify-between gap-2 rounded-2xl border border-dashed px-3 py-1.5 text-xs">
                <span className="truncate opacity-75">
                  “<strong>{searchQuery}</strong>” için bu filtrede ikon yok.
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {tierFilter !== 'all' && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => setTierFilter('all')}
                      className="rounded-xl border px-2.5 py-1.5 font-extrabold"
                    >
                      Tümünü Göster
                    </button>
                  )}
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() =>
                      triggerGalleryPhotoPicker(activeBranchColor, (sticker) => {
                        onApplySticker(activeNode.id, sticker);
                        void hapticSuccess();
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/40 bg-indigo-500/12 px-2.5 py-1.5 font-extrabold text-indigo-700 dark:text-indigo-300"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span>Foto Seç</span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={onOpenAIStudio}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 font-extrabold text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>3D Üret</span>
                  </button>
                </div>
              </div>
            ) : (
              carouselEntries.map(({ item, origIdx, isFree }) => {
                const isBusy = processingId === item.id;
                const isSelected = activeNode.sticker?.id === item.id;
                const isProLocked = !isFree;
                const isProCraft = !isFree || item.tier === 'pro' || item.mode === '3d';

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={isProLocked ? 'pro-sticker-tile' : 'free-sticker-tile'}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => void handleSelectVisual(item, origIdx, isFree)}
                    title={`${item.title} (${item.providerName})${
                      isProLocked ? ' • PRO 3D & Atlas' : ' • Ücretsiz'
                    }`}
                    className={`group relative flex shrink-0 flex-col items-center justify-center overflow-hidden border transition hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                      isSlimKeyboardMode
                        ? 'h-12 w-12 rounded-xl p-1'
                        : isTightAboveKeyboard
                        ? 'h-14 w-14 rounded-2xl p-1.5'
                        : 'h-[58px] w-[58px] rounded-2xl p-1.5 sm:h-[68px] sm:w-[68px]'
                    } ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-500/50'
                        : isProLocked
                        ? 'border-amber-400/65 bg-gradient-to-br from-amber-500/14 via-violet-500/8 to-amber-400/20 shadow-xs hover:border-amber-400'
                        : isProCraft
                        ? 'border-violet-400/45 bg-gradient-to-br from-violet-500/10 to-sky-500/10'
                        : 'bg-white/90 hover:bg-white dark:bg-slate-800/85 dark:hover:bg-slate-800'
                    }`}
                    style={{
                      borderColor:
                        isSelected || isProLocked || isProCraft
                          ? undefined
                          : 'var(--hud-border)',
                    }}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      onError={() => {
                        setBrokenIds((prev) => new Set(prev).add(item.id));
                      }}
                      className={`${
                        isSlimKeyboardMode
                          ? 'h-9 w-9'
                          : isTightAboveKeyboard
                          ? 'h-10 w-10'
                          : 'h-11 w-11 sm:h-12 sm:w-12'
                      } object-contain transition-transform group-hover:scale-110 ${
                        isProLocked ? 'drop-shadow-[0_3px_6px_rgba(245,158,11,0.28)]' : ''
                      }`}
                    />
                    {isProLocked && (
                      <span
                        data-testid="pro-sticker-badge"
                        className="pointer-events-none absolute top-1 right-1 inline-flex items-center gap-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-400 px-1 py-0.2 text-[8px] leading-tight font-black tracking-tight text-slate-950 shadow-xs"
                      >
                        👑 PRO
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

        {/* ROW 3: Working S/M/L/XL Size + Style + Colors + Checklist + Priority + Link + Delete */}
        {!isSlimKeyboardMode && !isTightAboveKeyboard && (
          <div
            className="no-scrollbar mt-1.5 flex items-center justify-between gap-2.5 overflow-x-auto border-t pt-2 pb-0.5 text-[11.5px]"
            style={{ borderColor: 'var(--hud-border)', touchAction: 'pan-x' }}
          >
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Working Sticker Size Preset (S / M / L / XL) - Generous Tablet & Phone Touch Targets */}
              <div
                className="inline-flex items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5"
                title="İkon / Görsel Boyutu (S / M / L / XL)"
              >
                <span className="px-1.5 text-[10.5px] font-extrabold opacity-70">
                  Boyut:
                </span>
                {SIZE_PRESETS.map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    data-testid={`size-btn-${sz.id}`}
                    title={sz.hint}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => handlePickStickerSize(sz.id)}
                    className={`min-h-[36px] min-w-[34px] rounded-lg px-2 text-xs font-extrabold transition active:scale-95 ${
                      effectiveStickerSize === sz.id
                        ? 'bg-sky-500 text-white shadow-2xs'
                        : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
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
                    className={`min-h-[36px] rounded-lg px-2.5 text-[11px] font-extrabold active:scale-95 ${
                      effectiveNodeStyle === 'card'
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    Kart
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => onChangeNodeStyle(activeNode.id, 'organic')}
                    className={`min-h-[36px] rounded-lg px-2.5 text-[11px] font-extrabold active:scale-95 ${
                      effectiveNodeStyle === 'organic'
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    Organik
                  </button>
                </div>
              )}

              {/* Branch Color Swatches */}
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
                <span className="hidden items-center gap-0.5 rounded-lg bg-emerald-500/12 px-2 py-1 text-[10px] font-extrabold text-emerald-700 xl:inline-flex dark:text-emerald-300">
                  <Zap className="h-3 w-3" />
                  {offlineMs}ms
                </span>
              )}
            </div>

            {/* Right Utility Pills (Task Checkbox + Priority + Link + Smart Sub-branches + Badge + Remove Icon) */}
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

              {!isRootNode && (
                <button
                  type="button"
                  data-testid="studio-task-toggle-btn"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    void hapticLight();
                    onToggleNodeCheck(activeNode.id);
                  }}
                  title="Görev / Tamamlandı Onay Kutusu Ekle"
                  className={`inline-flex h-8 items-center gap-1 rounded-xl px-2 font-bold ${
                    typeof activeNode.checked === 'boolean'
                      ? 'bg-emerald-500 text-white'
                      : 'hover:bg-slate-500/10'
                  }`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Görev</span>
                </button>
              )}

              <button
                type="button"
                data-testid="studio-priority-btn"
                onPointerDown={(e) => e.preventDefault()}
                onClick={handleCyclePriority}
                title="Önemli / Sınavda Çıkar / Tekrar Et Vurgusu Ekle"
                className={`inline-flex min-h-[36px] items-center gap-1 rounded-xl px-2.5 font-extrabold transition active:scale-95 ${
                  activeNode.priorityTag === 'important'
                    ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-sm'
                    : activeNode.priorityTag === 'exam'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-sm'
                    : activeNode.priorityTag === 'review'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                    : 'border border-rose-500/35 bg-rose-500/12 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300'
                }`}
              >
                {!activeNode.priorityTag && <Flame className="h-3.5 w-3.5 text-rose-500" />}
                <span>
                  {activeNode.priorityTag
                    ? PRIORITY_LABELS[activeNode.priorityTag]
                    : 'Önemli'}
                </span>
              </button>

              <button
                type="button"
                data-testid="studio-crosslink-btn"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  void dismissNativeKeyboard();
                  onCloseEdit();
                  onStartCrossLink(activeNode.id);
                }}
                title="Başka Dala Çapraz Bağlantı / İlişki Oku Çek"
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-indigo-500/12 px-2.5 font-extrabold text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Bağlantı</span>
              </button>

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
                <span className="hidden md:inline">Rozet</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenSmartSubBranches}
                title="Akıllı Alt Dallar Öner"
                className="inline-flex h-8 items-center gap-1 rounded-xl px-2 font-bold text-amber-600 hover:bg-amber-500/12 dark:text-amber-300"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Öner</span>
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
                  <span className="hidden lg:inline">İkon Sil</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
