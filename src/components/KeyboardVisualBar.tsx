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
  Plus,
  Eraser,
  ImagePlus,
  FileText,
  CheckSquare,
  Flame,
  Gift,
  Crown,
  SlidersHorizontal,
  Palette,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
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
} from '../types/mindmap';
import { resolveStarterStickerForConcept } from '../data/academicTemplates';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import { triggerGalleryPhotoPicker } from '../core/visuals/PhotoStickerImporter';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import {
  sanitizeNodeSearchQuery,
  VisualSearchOrchestrator,
} from '../core/visuals/VisualSearchOrchestrator';
import { splitTitleAndInlineNote } from '../core/smartmap/TextToMindMapParser';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import {
  dismissNativeKeyboard,
  setStudioBarHeight,
  useKeyboardInset,
} from '../core/native/useKeyboardInset';

type DockTab = 'icons' | 'note' | 'style';

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
  onUpdateNodeLink?: (nodeId: string, linkUrl: string) => void;
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
  onOpenGalleryDrawer: (customQuery?: string) => void;
  onOpenAIStudio: (customQuery?: string) => void;
  onOpenNoteCropper: () => void;
  onOpenQuickSketch: () => void;
  onStartCrossLink: (fromNodeId: string) => void;
  onOpenSmartSubBranches: () => void;
  onCloseEdit: () => void;
}

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

interface SpeechRecLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function createSpeechRecognizer(): SpeechRecLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecLike;
    webkitSpeechRecognition?: new () => SpeechRecLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    const rec = new Ctor();
    rec.lang = 'tr-TR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    return rec;
  } catch {
    return null;
  }
}

export const KeyboardVisualBar: React.FC<KeyboardVisualBarProps> = React.memo(({
  activeNode,
  isEditingText,
  isRootNode,
  defaultNodeStyle,
  mapContext,
  proactiveSuggestions,
  nodeScreenPos: _nodeScreenPos,
  onUpdateNodeTitle,
  onUpdateNodeNote,
  onUpdateNodeLink,
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

  const [dockTab, setDockTab] = useState<DockTab>('icons');
  const [tierFilter, setTierFilter] = useState<IconTierFilter>('all');
  const [customIconQuery, setCustomIconQuery] = useState('');
  const [isSearchingCustomIcon, setIsSearchingCustomIcon] = useState(false);
  const [allFederated, setAllFederated] = useState<VisualSearchResult[]>([]);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showTechBadgeInput, setShowTechBadgeInput] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [dockOffset, setDockOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
  const [isDraggingDock, setIsDraggingDock] = useState(false);

  const iconSearchInputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const voiceRecRef = useRef<SpeechRecLike | null>(null);
  const requestSeqRef = useRef(0);
  const dockDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    barW: number;
    barH: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!activeNode) {
      setStudioBarHeight(0);
      return;
    }
    const el = barRef.current;
    if (!el) return;
    const syncH = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 40) setStudioBarHeight(h);
    };
    syncH();
    const ro = new ResizeObserver(syncH);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setStudioBarHeight(0);
    };
  }, [activeNode?.id, dockTab]);

  useEffect(() => {
    setCustomIconQuery('');
    setIsSearchingCustomIcon(false);
    setShowTechBadgeInput(false);
    setBrokenIds(new Set());
    setDockTab('icons');
    setIsSheetMinimized(false);
  }, [activeNode?.id]);

  // Keep panel grounded & clamped cleanly when viewport rotates/resizes or virtual keyboard opens
  useEffect(() => {
    if (kb.isKeyboardOpen || kb.isPhone) {
      setDockOffset({ x: 0, y: 0 });
      if (barRef.current) {
        barRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
    }
  }, [kb.isKeyboardOpen, kb.isPhone, kb.viewportW]);

  useEffect(() => {
    return () => {
      try {
        voiceRecRef.current?.stop();
      } catch {
        // Ignore
      }
    };
  }, []);

  // Smart branch-box description awareness:
  // If user typed a branch note/description (`activeNode.note`), automatically leverage it for icon search
  // when title is empty/placeholder or generic so adding a description inside the branch box is immediately understood!
  const searchQuery = useMemo(() => {
    const manual = customIconQuery.trim();
    if (manual.length > 0) return manual;
    const cleanTitle = sanitizeNodeSearchQuery(activeNode?.title ?? '');
    const cleanNote = (activeNode?.note ?? '').trim();
    if (cleanTitle.length > 0) {
      // If user typed `Başlık: Açıklama` inline inside the title box, focus icon search on the clean title part
      const inlineSplit = splitTitleAndInlineNote(cleanTitle);
      return inlineSplit.title || cleanTitle;
    }
    if (cleanNote.length >= 2) {
      return cleanNote
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .slice(0, 3)
        .join(' ');
    }
    return '';
  }, [customIconQuery, activeNode?.title, activeNode?.note]);

  const inlineTitleSplitCandidate = useMemo(() => {
    const raw = (activeNode?.title ?? '').trim();
    if (raw.length < 14) return null;
    const parsed = splitTitleAndInlineNote(raw);
    if (parsed.note && parsed.note.length >= 6 && parsed.title !== raw) {
      return parsed;
    }
    return null;
  }, [activeNode?.title]);

  const hasBranchNote = (activeNode?.note ?? '').trim().length > 0;
  const activeBranchColor = activeNode?.branchColor ?? '#0EA5E9';

  // Gamified Instant Search: <2ms Offline Shards + ALWAYS-ON Parallel Turkish->English Live Enrichment for new words!
  useEffect(() => {
    if (!activeNode) return;

    const seq = ++requestSeqRef.current;
    const controller = new AbortController();

    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      searchQuery,
      mapContext,
      activeBranchColor
    );
    if (wave1.results.length > 0) {
      setAllFederated(wave1.results);
    }
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = 0;
    }

    let cancelled = false;
    let onlineTimer: number | undefined;

    void VisualSearchOrchestrator.searchOfflineWave(
      searchQuery,
      mapContext,
      activeBranchColor,
      48
    ).then((offlineWave) => {
      if (cancelled || seq !== requestSeqRef.current || controller.signal.aborted) {
        return;
      }
      setAllFederated(offlineWave.results);

      // ALWAYS enrich via Live Google-Translated 540K+ Gamified Iconify + ARASAAC whenever:
      // 1) Offline Turkish lexicon did NOT fully match ALL words (`!offlineWave.allWordsMatched` / `!offlineWave.hasLexiconMatch`), OR
      // 2) Query is multi-word (e.g. "tablet kılıfı") so full-phrase EN translation + head-noun icons ALWAYS appear, OR
      // 3) Offline returned fewer than 12 icons or weak top confidence (< 0.90)
      const isMultiWordQuery = searchQuery.trim().includes(' ');
      const needsOnlineEnrichment =
        searchQuery.trim().length >= 2 &&
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        (!offlineWave.hasLexiconMatch ||
          offlineWave.allWordsMatched === false ||
          isMultiWordQuery ||
          offlineWave.results.length < 12 ||
          (offlineWave.results[0]?.score ?? 0) < 0.9);

      if (needsOnlineEnrichment) {
        onlineTimer = window.setTimeout(async () => {
          if (cancelled || seq !== requestSeqRef.current || controller.signal.aborted) {
            return;
          }
          setLoadingRemote(true);
          try {
            const fullRes = await VisualSearchOrchestrator.searchFederatedGallery(
              searchQuery,
              mapContext,
              activeBranchColor,
              controller.signal
            );
            if (!cancelled && seq === requestSeqRef.current && !controller.signal.aborted) {
              setAllFederated(fullRes.results);
            }
          } finally {
            if (!cancelled && seq === requestSeqRef.current && !controller.signal.aborted) {
              setLoadingRemote(false);
            }
          }
        }, 95);
      } else {
        setLoadingRemote(false);
      }
    });

    return () => {
      cancelled = true;
      if (onlineTimer !== undefined) clearTimeout(onlineTimer);
      controller.abort();
    };
  }, [activeNode?.id, searchQuery, mapContext, activeBranchColor]);

  const healthyList = useMemo(
    () => allFederated.filter((r) => !brokenIds.has(r.id)),
    [allFederated, brokenIds]
  );

  const carouselEntries = useMemo(() => {
    const tagged = healthyList.map((item, origIdx) => ({
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
  }, [healthyList, tierFilter, isLifetimePro]);

  const freeTotalCount = useMemo(
    () =>
      healthyList.filter((item, idx) =>
        EntitlementManager.isStickerFree(item, idx, 'keyboard_bar')
      ).length,
    [healthyList, isLifetimePro]
  );

  const updateScrollChevrons = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    updateScrollChevrons();
  }, [carouselEntries, dockTab]);

  if (!activeNode) return null;

  const isFreshEmptyBranch = !isRootNode && activeNode.title.trim().length === 0;
  const effectiveNodeStyle: NodeVisualStyle =
    activeNode.nodeStyle ?? defaultNodeStyle ?? 'card';
  const effectiveStickerSize: StickerSizePreset = activeNode.stickerSize ?? 'md';

  // Dedicated ultra-compact Icon Search mode while keyboard is open inside `İkon ara...`
  // Collapses the drag handle & Branch Title row so Search Input + FULL Icon Strip stay 100% visible above keyboard on Phone & Tablet!
  const isTitleInputFocused =
    typeof document !== 'undefined' && document.activeElement === titleInputRef.current;
  const isIconSearchFocused =
    kb.isKeyboardOpen &&
    dockTab === 'icons' &&
    (isSearchingCustomIcon ||
      (typeof document !== 'undefined' && document.activeElement === iconSearchInputRef.current));
  const isSlimKeyboardMode =
    kb.isKeyboardOpen &&
    (kb.isPhone || kb.isTablet) &&
    dockTab === 'icons' &&
    isTitleInputFocused &&
    !isIconSearchFocused;

  const toggleVoiceDictation = () => {
    void hapticLight();
    if (isListeningVoice) {
      try {
        voiceRecRef.current?.stop();
      } catch {
        // Ignore
      }
      setIsListeningVoice(false);
      return;
    }
    const rec = createSpeechRecognizer();
    if (!rec) return;
    voiceRecRef.current = rec;
    setIsListeningVoice(true);
    rec.onresult = (ev) => {
      const spoken = ev.results?.[0]?.[0]?.transcript?.trim();
      if (spoken) {
        if (dockTab === 'note') {
          const prev = activeNode.note?.trim() || '';
          onUpdateNodeNote(activeNode.id, prev ? `${prev} ${spoken}` : spoken);
        } else {
          onUpdateNodeTitle(activeNode.id, spoken);
        }
        void hapticSuccess();
      }
    };
    rec.onerror = () => setIsListeningVoice(false);
    rec.onend = () => setIsListeningVoice(false);
    try {
      rec.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

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

  const useFullWidthBottomSheet = kb.isPhone;
  const dockW = useFullWidthBottomSheet
    ? kb.viewportW
    : Math.min(780, Math.max(320, kb.viewportW - 28));
  const baseLeft = useFullWidthBottomSheet
    ? 0
    : Math.max(14, Math.round((kb.viewportW - dockW) * 0.5));

  const clampDockOffset = (rawX: number, rawY: number, barW: number, barH: number) => {
    if (useFullWidthBottomSheet) {
      return { x: 0, y: 0 };
    }
    const minOffsetX = 12 - baseLeft;
    const maxOffsetX = kb.viewportW - barW - 12 - baseLeft;
    const maxUp = -(Math.max(40, kb.viewportH - barH - 86));
    return {
      x: Math.round(Math.max(minOffsetX, Math.min(maxOffsetX, rawX))),
      y: Math.round(Math.max(maxUp, Math.min(0, rawY))),
    };
  };

  const handleDockDragStart = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dockDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: dockOffset.x,
      origY: dockOffset.y,
      barW: rect.width,
      barH: rect.height,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture issues
    }
    setIsDraggingDock(true);
  };

  const handleDockDragMove = (e: React.PointerEvent<HTMLElement>) => {
    const dr = dockDragRef.current;
    const el = barRef.current;
    if (!dr || !el || dr.pointerId !== e.pointerId) return;
    const dx = e.clientX - dr.startClientX;
    const dy = e.clientY - dr.startClientY;
    if (Math.hypot(dx, dy) > 4) {
      dr.moved = true;
    }
    if (useFullWidthBottomSheet) {
      const clampedY = Math.max(-54, Math.min(180, dy));
      el.style.transform = `translate3d(0px, ${Math.round(clampedY)}px, 0)`;
    } else {
      const next = clampDockOffset(dr.origX + dx, dr.origY + dy, dr.barW, dr.barH);
      el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    }
  };

  const handleDockDragEnd = (e: React.PointerEvent<HTMLElement>) => {
    const dr = dockDragRef.current;
    const el = barRef.current;
    if (!dr || dr.pointerId !== e.pointerId) return;
    dockDragRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    setIsDraggingDock(false);

    const dx = e.clientX - dr.startClientX;
    const dy = e.clientY - dr.startClientY;

    if (!dr.moved) {
      if (el) {
        el.style.transform = `translate3d(${dockOffset.x}px, ${dockOffset.y}px, 0)`;
      }
      return;
    }

    if (useFullWidthBottomSheet) {
      if (el) el.style.transform = 'translate3d(0px, 0px, 0)';
      if (dy > 58) {
        void hapticLight();
        setIsSheetMinimized((prev) => {
          if (prev) {
            onCloseEdit();
            return false;
          }
          return true;
        });
      } else if (dy < -42) {
        void hapticLight();
        if (isSheetMinimized) {
          setIsSheetMinimized(false);
        } else if (dockTab === 'icons') {
          onOpenGalleryDrawer(searchQuery);
        }
      }
      return;
    }

    const next = clampDockOffset(dr.origX + dx, dr.origY + dy, dr.barW, dr.barH);
    setDockOffset(next);
  };

  const containerStyle: React.CSSProperties = useFullWidthBottomSheet
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: `${kb.keyboardHeight}px`,
        width: '100vw',
        maxWidth: '100vw',
        maxHeight: `${
          kb.isKeyboardOpen
            ? Math.min(256, Math.max(150, kb.viewportH - 64))
            : Math.min(358, Math.max(220, kb.viewportH - 86))
        }px`,
        transform: 'translate3d(0px, 0px, 0)',
        transition: isDraggingDock
          ? 'none'
          : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), bottom 160ms cubic-bezier(0.22, 1, 0.36, 1)',
      }
    : {
        position: 'fixed',
        left: `${baseLeft}px`,
        bottom: kb.isKeyboardOpen
          ? `${kb.keyboardHeight + 8}px`
          : 'max(14px, calc(var(--safe-bottom) + 10px))',
        width: `${dockW}px`,
        maxWidth: 'calc(100vw - 28px)',
        maxHeight: `${
          kb.isKeyboardOpen
            ? Math.min(264, Math.max(154, kb.viewportH - 64))
            : Math.min(352, Math.max(220, kb.viewportH - 96))
        }px`,
        transform: `translate3d(${dockOffset.x}px, ${dockOffset.y}px, 0)`,
        transition: isDraggingDock
          ? 'none'
          : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), bottom 160ms cubic-bezier(0.22, 1, 0.36, 1)',
      };

  const voiceSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );

  return (
    <div
      ref={barRef}
      style={containerStyle}
      data-testid="keyboard-visual-bar"
      onPointerDown={(e) => e.stopPropagation()}
      className="animate-studio-dock z-40 box-border select-none"
    >
      <div
        className={`flex max-h-full w-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain border shadow-2xl backdrop-blur-2xl ring-1 ring-slate-900/6 dark:ring-white/10 ${
          useFullWidthBottomSheet
            ? 'rounded-t-[28px] border-x-0 border-b-0 px-3 pt-1.5'
            : 'rounded-[26px] px-4 pt-1.5 pb-2.5'
        }`}
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: isSlimKeyboardMode
            ? '8px'
            : useFullWidthBottomSheet && !kb.isKeyboardOpen
            ? 'max(14px, calc(var(--safe-bottom) + 10px))'
            : '12px',
        }}
      >
        {/* Tactile Smooth Drag / Swipe Handle Bar (Hidden while keyboard is open for Title or Icon Search!) */}
        {!isSlimKeyboardMode && !isIconSearchFocused && (
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div
              data-testid="studio-drag-handle"
              onPointerDown={handleDockDragStart}
              onPointerMove={handleDockDragMove}
              onPointerUp={handleDockDragEnd}
              onPointerCancel={handleDockDragEnd}
              onDoubleClick={() => {
                void hapticLight();
                setDockOffset({ x: 0, y: 0 });
              }}
              title={
                useFullWidthBottomSheet
                  ? 'Aşağı kaydır: Küçült • Yukarı kaydır: Tam Galeri'
                  : 'Paneli sağa, sola veya yukarı sürükleyerek taşıyın (Çift tıkla: Ortala)'
              }
              className="flex h-6 flex-1 touch-none cursor-grab items-center justify-center gap-1.5 rounded-full select-none hover:bg-slate-500/8 active:cursor-grabbing"
            >
              <span className="h-1 w-11 rounded-full bg-slate-400/55" />
              {!useFullWidthBottomSheet && (
                <GripHorizontal className="h-3.5 w-3.5 opacity-40" />
              )}
            </div>
            <button
              type="button"
              data-testid="studio-minimize-btn"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                void hapticLight();
                setIsSheetMinimized((v) => !v);
              }}
              title={isSheetMinimized ? 'Paneli Genişlet' : 'Paneli Küçült'}
              className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-500/10 px-2 text-[10px] font-extrabold opacity-75 hover:opacity-100 active:scale-95"
            >
              {isSheetMinimized ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  <span>Aç</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  <span className="hidden sm:inline">Küçült</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ROW 0: Clean Spacious Title Input (Auto-hidden while actively searching icons with keyboard open so icons stay 100% visible!) */}
        {!isIconSearchFocused && (
        <div className="mb-2 flex items-center gap-1.5">
          <div
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border bg-white/80 px-3 shadow-2xs focus-within:ring-2 focus-within:ring-sky-500 dark:bg-slate-900/80"
            style={{ borderColor: 'var(--hud-border)' }}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
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
                isRootNode ? 'Harita başlığını yazın...' : 'Dal başlığını yazın...'
              }
              className="allow-text-input min-w-0 flex-1 bg-transparent text-base font-extrabold outline-none"
              style={{ color: 'var(--node-text)' }}
              data-testid="studio-title-input"
            />
            {voiceSupported && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={toggleVoiceDictation}
                title="Sesle Yaz (Türkçe Dikte)"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition active:scale-95 ${
                  isListeningVoice
                    ? 'animate-pulse bg-rose-500 text-white'
                    : 'opacity-65 hover:bg-slate-500/12 hover:opacity-100'
                }`}
              >
                {isListeningVoice ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}
            {activeNode.title.length > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  onUpdateNodeTitle(activeNode.id, '');
                  titleInputRef.current?.focus();
                }}
                aria-label="Başlığı temizle"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-55 hover:bg-slate-500/15 hover:opacity-100"
              >
                <X className="h-4 w-4" />
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
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/25 active:scale-95 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Alt Dal</span>
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-500/35 bg-rose-500/12 text-rose-600 hover:bg-rose-500/20 active:scale-95 dark:text-rose-400"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void dismissNativeKeyboard();
              onCloseEdit();
            }}
            data-testid="studio-done-btn"
            className="flex h-11 shrink-0 items-center justify-center gap-1 rounded-2xl bg-emerald-500 px-3.5 text-xs font-black text-white shadow-xs active:scale-95"
          >
            <Check className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Tamam</span>
          </button>
        </div>
        )}

        {/* Smart 1-Tap Inline Description Split (`Başlık: Açıklama` -> Title + Branch Note Box!) */}
        {!isIconSearchFocused && !isSheetMinimized && inlineTitleSplitCandidate && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-violet-500/35 bg-violet-500/10 px-2.5 py-1.5 text-[11px]">
            <span className="min-w-0 truncate font-bold text-violet-700 dark:text-violet-300">
              📝 Açıklama algılandı: “{inlineTitleSplitCandidate.note}”
            </span>
            <button
              type="button"
              data-testid="studio-split-note-btn"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                void hapticSuccess();
                const existingNote = (activeNode.note ?? '').trim();
                const mergedNote = existingNote
                  ? `${inlineTitleSplitCandidate.note}\n${existingNote}`
                  : inlineTitleSplitCandidate.note ?? '';
                onUpdateNodeTitle(activeNode.id, inlineTitleSplitCandidate.title);
                onUpdateNodeNote(activeNode.id, mergedNote);
              }}
              className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs active:scale-95"
            >
              Not Kutusuna Ayır
            </button>
          </div>
        )}

        {!isSheetMinimized && (
        <>
        {/* 3 BIG, CRYSTAL-CLEAR BRANCH DOCK TABS (Hidden only while keyboard is open so dock stays spacious) */}
        {!kb.isKeyboardOpen && (
          <div className="mb-2 flex items-center gap-1.5 rounded-2xl bg-slate-500/10 p-1">
            <button
              type="button"
              data-testid="dock-tab-icons"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setDockTab('icons')}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold transition active:scale-95 ${
                dockTab === 'icons'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              <Palette className="h-4 w-4 text-sky-500" />
              <span>İkonlar</span>
            </button>
            <button
              type="button"
              data-testid="studio-note-toggle-btn"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setDockTab('note');
                setTimeout(() => noteInputRef.current?.focus(), 40);
              }}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold transition active:scale-95 ${
                dockTab === 'note'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              <FileText className="h-4 w-4 text-violet-500" />
              <span>{hasBranchNote ? 'Not ✓' : 'Not'}</span>
              {hasBranchNote && (
                <span className="h-2 w-2 rounded-full bg-violet-500" />
              )}
            </button>
            <button
              type="button"
              data-testid="dock-tab-style"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setDockTab('style')}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold transition active:scale-95 ${
                dockTab === 'style'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 text-amber-500" />
              <span>Stil</span>
            </button>
          </div>
        )}

        {/* TAB 1: GAMIFIED ICONS CAROUSEL + SEARCH + PHOTO + 3D STUDIO */}
        {dockTab === 'icons' && (
          <div className="space-y-2">
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <div
                className={`flex min-h-[40px] items-center gap-1.5 rounded-xl border bg-white/90 px-2.5 shadow-2xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/35 dark:bg-slate-900/90 ${
                  isIconSearchFocused ? 'min-w-[140px] flex-1' : 'w-[168px] shrink-0 sm:w-[192px]'
                }`}
                style={{ borderColor: customIconQuery ? '#0EA5E9' : 'var(--hud-border)' }}
              >
                <Search className="h-4 w-4 shrink-0 text-sky-500" />
                <input
                  ref={iconSearchInputRef}
                  type="text"
                  data-testid="bar-dedicated-icon-search"
                  value={customIconQuery}
                  onFocus={() => setIsSearchingCustomIcon(true)}
                  onBlur={() => setIsSearchingCustomIcon(false)}
                  onChange={(e) => setCustomIconQuery(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      setCustomIconQuery('');
                      iconSearchInputRef.current?.blur();
                    } else if (e.key === 'Enter') {
                      iconSearchInputRef.current?.blur();
                    }
                  }}
                  placeholder="İkon ara..."
                  className="allow-text-input min-w-0 flex-1 bg-transparent text-base font-bold outline-none"
                  style={{ color: 'var(--node-text)' }}
                />
                {customIconQuery && (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => setCustomIconQuery('')}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-500/15"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

                {/* Clean Tier Filter */}
                <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-0.5">
                  <button
                    type="button"
                    data-testid="bar-tier-all-btn"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => setTierFilter('all')}
                    className={`min-h-[34px] rounded-lg px-2.5 text-xs font-extrabold whitespace-nowrap ${
                      tierFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                        : 'opacity-75'
                    }`}
                  >
                    Tümü
                  </button>
                  <button
                    type="button"
                    data-testid="bar-tier-free-btn"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => setTierFilter((p) => (p === 'free' ? 'all' : 'free'))}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-xs font-extrabold whitespace-nowrap ${
                      tierFilter === 'free'
                        ? 'bg-emerald-500 text-white'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <Gift className="h-3.5 w-3.5" />
                    <span>Ücretsiz ({freeTotalCount})</span>
                  </button>
                  <button
                    type="button"
                    data-testid="bar-tier-pro-btn"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => setTierFilter((p) => (p === 'pro' ? 'all' : 'pro'))}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-xs font-extrabold whitespace-nowrap ${
                      tierFilter === 'pro'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span>Pro</span>
                  </button>
                </div>

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
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-2.5 text-xs font-extrabold whitespace-nowrap text-indigo-700 active:scale-95 dark:text-indigo-300"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>Foto</span>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onOpenAIStudio(searchQuery)}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 text-xs font-extrabold whitespace-nowrap text-white shadow-xs active:scale-95"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>3D Özel</span>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onOpenGalleryDrawer(searchQuery)}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-2.5 text-xs font-extrabold whitespace-nowrap text-sky-700 active:scale-95 dark:text-sky-300"
                >
                  <Search className="h-4 w-4" />
                  <span>Galeri</span>
                </button>

                {isIconSearchFocused && (
                  <button
                    type="button"
                    aria-label="Klavyeyi kapat"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      iconSearchInputRef.current?.blur();
                      void dismissNativeKeyboard();
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs active:scale-95"
                  >
                    <Check className="h-4.5 w-4.5" />
                  </button>
                )}
              </div>

            {/* Live Gamified Sticker Carousel */}
            <div className="relative flex items-center">
              {canScrollLeft && !kb.isTouchDevice && (
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => carouselRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                  className="absolute left-0.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 shadow-md dark:bg-slate-900/95"
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
                {isFreshEmptyBranch &&
                  proactiveSuggestions.length > 0 &&
                  searchQuery.trim().length === 0 &&
                  proactiveSuggestions.slice(0, 4).map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        void hapticSuccess();
                        onApplyProactiveSuggestion(activeNode.id, sug);
                      }}
                      className="inline-flex h-14 shrink-0 items-center gap-2 rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3 text-xs font-extrabold whitespace-nowrap active:scale-95"
                    >
                      <img src={sug.sticker.url} alt="" className="h-7 w-7 object-contain" />
                      <span>{sug.title}</span>
                    </button>
                  ))}

                {carouselEntries.map(({ item, origIdx, isFree }) => {
                  const isBusy = processingId === item.id;
                  const isSelected = activeNode.sticker?.id === item.id;
                  const isProLocked = !isFree;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={isProLocked ? 'pro-sticker-tile' : 'free-sticker-tile'}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => void handleSelectVisual(item, origIdx, isFree)}
                      title={`${item.title} (${item.providerName})`}
                      className={`group relative flex shrink-0 flex-col items-center justify-center overflow-hidden border transition hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                        isSlimKeyboardMode
                          ? 'h-13 w-13 rounded-xl p-1'
                          : 'h-[66px] w-[66px] rounded-2xl p-1.5 sm:h-[72px] sm:w-[72px]'
                      } ${
                        isSelected
                          ? 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-500/50'
                          : isProLocked
                          ? 'border-amber-400/65 bg-gradient-to-br from-amber-500/14 via-violet-500/8 to-amber-400/20'
                          : 'bg-white/95 dark:bg-slate-800/90'
                      }`}
                      style={{
                        borderColor: isSelected || isProLocked ? undefined : 'var(--hud-border)',
                      }}
                    >
                      <img
                        src={item.previewUrl}
                        alt={item.title}
                        loading={origIdx < 16 ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                        onError={() => setBrokenIds((prev) => new Set(prev).add(item.id))}
                        className={`${
                          isSlimKeyboardMode ? 'h-9 w-9' : 'h-12 w-12 sm:h-13 sm:w-13'
                        } object-contain transition-transform group-hover:scale-110`}
                      />
                      {isProLocked && (
                        <span
                          data-testid="pro-sticker-badge"
                          className="pointer-events-none absolute top-1 right-1 rounded-md bg-gradient-to-r from-amber-500 to-orange-400 px-1 text-[8px] font-black text-slate-950 shadow-xs"
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
                })}

                {carouselEntries.length === 0 && !loadingRemote && (
                  <div className="flex min-h-[56px] flex-1 items-center justify-between gap-2 rounded-2xl border border-dashed px-3 py-2 text-xs font-bold opacity-80">
                    <span>“{searchQuery || 'İkon'}” için sonuç yok</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {tierFilter !== 'all' && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => setTierFilter('all')}
                          className="rounded-xl border px-2.5 py-1 text-[11px] font-extrabold"
                        >
                          Tümünü Göster
                        </button>
                      )}
                      <button
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => onOpenAIStudio(searchQuery)}
                        className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 py-1 text-[11px] font-extrabold text-white"
                      >
                        3D Üret
                      </button>
                    </div>
                  </div>
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
                  onClick={() => carouselRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                  className="absolute right-0.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-white/95 shadow-md dark:bg-slate-900/95"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LONG NOTE, PRIORITY, CHECKLIST, CROSS-LINK & SMART SUB-BRANCHES */}
        {dockTab === 'note' && (
          <div className="space-y-2.5">
            <textarea
              ref={noteInputRef}
              data-testid="studio-note-textarea"
              rows={2}
              value={activeNode.note ?? ''}
              onChange={(e) => onUpdateNodeNote(activeNode.id, e.target.value)}
              placeholder="Bu dal için detaylı ders notu, tanım veya örnek yazın..."
              className="allow-text-input max-h-24 w-full resize-y rounded-2xl border bg-white/80 px-3 py-2 text-base leading-relaxed font-semibold outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-900/80"
              style={{ borderColor: 'var(--hud-border)', color: 'var(--node-text)' }}
            />

            {onUpdateNodeLink && (
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                <input
                  type="url"
                  data-testid="studio-link-input"
                  value={activeNode.linkUrl ?? ''}
                  onChange={(e) => onUpdateNodeLink(activeNode.id, e.target.value)}
                  placeholder="Kaynak linki (https://youtube.com/..., PDF, makale)..."
                  className="allow-text-input min-h-[38px] min-w-0 flex-1 rounded-xl border bg-white/75 px-3 text-base font-semibold outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-900/75"
                  style={{ borderColor: 'var(--hud-border)', color: 'var(--node-text)' }}
                />
              </div>
            )}

            {showTechBadgeInput && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-sky-500" />
                <input
                  type="text"
                  value={activeNode.techBadge ?? ''}
                  onChange={(e) => onUpdateTechBadge(activeNode.id, e.target.value)}
                  placeholder="Kısa teknik rozet (Örn: Formül, Tarih, Madde)..."
                  className="allow-text-input min-h-[38px] min-w-0 flex-1 rounded-xl border bg-transparent px-3 text-base font-bold outline-none focus:ring-2 focus:ring-sky-500"
                  style={{ borderColor: 'var(--hud-border)' }}
                />
              </div>
            )}

            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                data-testid="studio-priority-btn"
                onPointerDown={(e) => e.preventDefault()}
                onClick={handleCyclePriority}
                className={`inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                  activeNode.priorityTag === 'important'
                    ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white'
                    : activeNode.priorityTag === 'exam'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950'
                    : activeNode.priorityTag === 'review'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                    : 'border border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300'
                }`}
              >
                {!activeNode.priorityTag && <Flame className="h-4 w-4 text-rose-500" />}
                <span>
                  {activeNode.priorityTag ? PRIORITY_LABELS[activeNode.priorityTag] : 'Önemli'}
                </span>
              </button>

              {!isRootNode && (
                <button
                  type="button"
                  data-testid="studio-task-toggle-btn"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    void hapticLight();
                    onToggleNodeCheck(activeNode.id);
                  }}
                  className={`inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                    typeof activeNode.checked === 'boolean'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-500/12 hover:bg-slate-500/18'
                  }`}
                >
                  <CheckSquare className="h-4 w-4" />
                  <span>Görev Kutusu</span>
                </button>
              )}

              <button
                type="button"
                data-testid="studio-crosslink-btn"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  void dismissNativeKeyboard();
                  onCloseEdit();
                  onStartCrossLink(activeNode.id);
                }}
                className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-indigo-500/15 px-3.5 text-xs font-extrabold whitespace-nowrap text-indigo-700 active:scale-95 dark:text-indigo-300"
              >
                <Link2 className="h-4 w-4" />
                <span>Bağlantı Çek</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenSmartSubBranches}
                className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-amber-500/15 px-3.5 text-xs font-extrabold whitespace-nowrap text-amber-700 active:scale-95 dark:text-amber-300"
              >
                <Wand2 className="h-4 w-4" />
                <span>Alt Dal Öner</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenNoteCropper}
                className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500/12 px-3.5 text-xs font-extrabold whitespace-nowrap text-emerald-700 active:scale-95 dark:text-emerald-300"
              >
                <Camera className="h-4 w-4" />
                <span>Nottan Kes</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenQuickSketch}
                className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-sky-500/12 px-3 text-xs font-extrabold whitespace-nowrap text-sky-700 active:scale-95 dark:text-sky-300"
              >
                <Pencil className="h-4 w-4" />
                <span>Karala</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setShowTechBadgeInput((v) => !v)}
                className={`inline-flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-extrabold whitespace-nowrap ${
                  showTechBadgeInput || activeNode.techBadge
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-500/10'
                }`}
              >
                <Tag className="h-4 w-4" />
                <span>Rozet</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: BIG S/M/L/XL SIZE + CARD/ORGANIC + COLOR SWATCHES + REMOVE ICON */}
        {dockTab === 'style' && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 py-0.5">
            {/* BIG S/M/L/XL Size Buttons */}
            <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-500/10 p-1">
              <span className="px-2 text-xs font-extrabold opacity-70">Boyut:</span>
              {SIZE_PRESETS.map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  data-testid={`size-btn-${sz.id}`}
                  title={sz.hint}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => handlePickStickerSize(sz.id)}
                  className={`min-h-[42px] min-w-[42px] rounded-xl text-sm font-black transition active:scale-95 ${
                    effectiveStickerSize === sz.id
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            {/* Card vs Organic Style */}
            {!isRootNode && (
              <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-500/10 p-1">
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onChangeNodeStyle(activeNode.id, 'card')}
                  className={`min-h-[42px] rounded-xl px-3.5 text-xs font-extrabold active:scale-95 ${
                    effectiveNodeStyle === 'card'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'opacity-75'
                  }`}
                >
                  Kart
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onChangeNodeStyle(activeNode.id, 'organic')}
                  className={`min-h-[42px] rounded-xl px-3.5 text-xs font-extrabold active:scale-95 ${
                    effectiveNodeStyle === 'organic'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'opacity-75'
                  }`}
                >
                  Organik
                </button>
              </div>
            )}

            {/* Big Branch Color Swatches */}
            <div className="flex items-center gap-2 rounded-2xl bg-slate-500/10 px-3 py-1.5">
              {BRANCH_PALETTE.map((col) => (
                <button
                  key={col}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onChangeBranchColor(activeNode.id, col)}
                  title="Dal Rengi"
                  className={`h-7 w-7 rounded-full transition-transform active:scale-90 ${
                    activeNode.branchColor === col
                      ? 'scale-115 ring-2 ring-slate-900 dark:ring-white'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>

            {activeNode.sticker && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onRemoveSticker(activeNode.id)}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-slate-500/12 px-3 text-xs font-extrabold hover:bg-slate-500/20 active:scale-95"
              >
                <Eraser className="h-4 w-4" />
                <span>İkonu Kaldır</span>
              </button>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
});
