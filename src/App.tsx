import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Trash2,
  ListTree,
  PenTool,
} from 'lucide-react';
import { useKeyboardInset } from './core/native/useKeyboardInset';
import { APP_RELEASE_CONFIG } from './config/appReleaseConfig';
import type {
  AcademicDepartment,
  CanvasInkStroke,
  CanvasStickyNote,
  CollaboratorPresence,
  CrossLink,
  CustomUserFolder,
  EraserMode,
  ExamRecallMode,
  InkToolType,
  MindMapDocument,
  MindMapFolder,
  MindMapLayoutType,
  MindNode,
  NodePriorityTag,
  NodeVisualStyle,
  PaperStyleType,
  PaywallTriggerReason,
  ProactiveBranchSuggestion,
  StickerAsset,
  StickerSizePreset,
  ViewportTransform,
  VisualSearchResult,
} from './types/mindmap';
import {
  ACADEMIC_TEMPLATES,
  createBlankMindMap,
  KNOWN_TEMPLATE_SUBTITLES,
  KNOWN_TEMPLATE_TECH_BADGES,
  resolveStarterStickerForConcept,
} from './data/academicTemplates';
import {
  FLOWCHART_TEMPLATES,
  convertMindMapToFlowchart,
  createBlankFlowchart,
} from './data/flowchartTemplates';
import {
  applyStudioThemeToDocument,
  type StudioThemeId,
} from './core/theme/StudioThemes';
import { sanitizeExternalLinkUrl } from './core/security/Sanitizer';
import { LocalStore } from './core/sync/LocalStore';
import { RealtimeCollabSession } from './core/sync/RealtimeCollab';
import {
  computeMindMapLayout,
  computeRadialAutoLayout,
  computeTreeMeta,
  findBestOpenBranchPosition,
  resolveNewBranchColor,
  resolveTreeCollisions,
} from './core/canvas/RadialAutoLayout';
import { generateMapThumbnailDataUrl } from './core/canvas/ThumbnailGenerator';
import { BillingService } from './core/monetization/BillingService';
import { EntitlementManager } from './core/monetization/EntitlementManager';
import { TopicContextIntelligence } from './core/visuals/TopicContextIntelligence';
import { OfflineVisualSearchClient } from './core/visuals/OfflineVisualSearchClient';
import { VisualSearchOrchestrator } from './core/visuals/VisualSearchOrchestrator';
import { CanvasStage } from './components/CanvasStage';
import { CanvasFindBar } from './components/CanvasFindBar';
import { FlowchartWorkspace } from './components/FlowchartWorkspace';
import { FlashcardStudyModal } from './components/FlashcardStudyModal';
import { MapQuizModal } from './components/MapQuizModal';
import { PresentationOverlay } from './components/PresentationOverlay';
import { CanvasDrawingToolbar } from './components/CanvasDrawingToolbar';
import { TopMinimalHUD } from './components/TopMinimalHUD';
import { KeyboardVisualBar } from './components/KeyboardVisualBar';
import { StickerGalleryDrawer } from './components/StickerGalleryDrawer';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AIStickerStudioModal } from './components/AIStickerStudioModal';
import { SmartMapGeneratorModal } from './components/SmartMapGeneratorModal';
import { MiniMapRadar } from './components/MiniMapRadar';
import { NoteCropperModal } from './components/NoteCropperModal';
import { QuickSketchPopover } from './components/QuickSketchPopover';
import { HandwrittenConceptModal } from './components/HandwrittenConceptModal';
import type { HandwrittenConceptAsset } from './types/mindmap';
import { ExportSheet } from './components/ExportSheet';
import { OutlineModal } from './components/OutlineModal';
import { HomeWorkspace } from './components/HomeWorkspace';
import { LifetimePaywallModal } from './components/LifetimePaywallModal';
import {
  OnboardingOverlay,
  hasCompletedOnboardingSync,
  checkNativeOnboardingCompleted,
  persistOnboardingCompleted,
} from './components/OnboardingOverlay';
import {
  SettingsModal,
  type ThemePreference,
} from './components/SettingsModal';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  syncNativeStatusBarTheme,
} from './core/native/NativeBridge';

const THEME_PREF_KEY = 'zh_v4_theme_pref';
const V4_SEED_MIGRATION_KEY = 'zh_v4_seed_migrated';

function loadInitialThemePref(): ThemePreference {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dark') === '1') return 'dark';
    const raw = localStorage.getItem(THEME_PREF_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Ignore storage read errors
  }
  return 'light';
}

function loadInitialScreen(): 'home' | 'canvas' {
  try {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('room') ||
      params.get('view') === 'canvas' ||
      params.get('tpl')
    ) {
      return 'canvas';
    }
  } catch {
    // Fallback to home
  }
  return 'home';
}

function shouldShowInitialOnboarding(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('no_onboard') === '1' ||
      params.get('room') ||
      params.get('tpl') ||
      params.get('view') === 'canvas'
    ) {
      return false;
    }
    return !hasCompletedOnboardingSync();
  } catch {
    return false;
  }
}

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<'home' | 'canvas'>(
    loadInitialScreen
  );
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    shouldShowInitialOnboarding
  );
  const [themePref, setThemePref] = useState<ThemePreference>(loadInitialThemePref);

  const [doc, setDoc] = useState<MindMapDocument>(() =>
    ACADEMIC_TEMPLATES[0].build()
  );
  const [savedMaps, setSavedMaps] = useState<MindMapDocument[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [linkingFromNodeId, setLinkingFromNodeId] = useState<string | null>(null);
  const [activeNodeScreenPos, setActiveNodeScreenPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [focusMode, setFocusMode] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [inkTool, setInkTool] = useState<InkToolType>('pen');
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [autoShapeEnabled, setAutoShapeEnabled] = useState(true);
  const [inkColor, setInkColor] = useState('#0F172A');
  const [inkWidth, setInkWidth] = useState(4.5);
  // Finger drawing is OFF by default in Draw mode (Apple Pencil / Samsung S-Pen / Desktop Mouse draw immediately;
  // fingers pan/zoom smoothly unless user explicitly enables finger drawing on the toolbar!)
  const [stylusOnly, setStylusOnly] = useState(true);
  const [hardwareEraserActive, setHardwareEraserActive] = useState(false);
  const [selectedLassoIds, setSelectedLassoIds] = useState<string[]>([]);
  const prevDrawToolRef = useRef<InkToolType>('pen');
  const [examMode, setExamMode] = useState<ExamRecallMode>('off');
  const [revealedExamIds, setRevealedExamIds] = useState<Set<string>>(new Set());
  const [zoomPercent, setZoomPercent] = useState(100);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isAutoLayoutAnimating, setIsAutoLayoutAnimating] = useState(false);

  // MiniMap Radar state
  const [radarSnap, setRadarSnap] = useState<{
    vp: ViewportTransform;
    w: number;
    h: number;
    hiddenIds: Set<string>;
  }>({
    vp: { x: 0, y: 0, scale: 1 },
    w: 1200,
    h: 800,
    hiddenIds: new Set(),
  });
  const [radarJump, setRadarJump] = useState<{
    x: number;
    y: number;
    seq: number;
  } | null>(null);

  // Modals, Sheets & Commercial Paywall State
  const [stickerDrawerOpen, setStickerDrawerOpen] = useState(false);
  const [stickerDrawerCustomQuery, setStickerDrawerCustomQuery] = useState<
    string | null
  >(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [aiStudioOpen, setAiStudioOpen] = useState(false);
  const [aiStudioInitialQuery, setAiStudioInitialQuery] = useState<string | null>(
    null
  );
  const [smartGenModal, setSmartGenModal] = useState<{
    open: boolean;
    tab: 'text_to_map' | 'proactive_branches';
  }>({ open: false, tab: 'text_to_map' });
  const [noteCropperOpen, setNoteCropperOpen] = useState(false);
  const [sketchPopoverOpen, setSketchPopoverOpen] = useState(false);
  const [handwritingModalOpen, setHandwritingModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findActiveIndex, setFindActiveIndex] = useState(0);
  const [findMatchIds, setFindMatchIds] = useState<string[]>([]);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [customFolders, setCustomFolders] = useState<CustomUserFolder[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialLegal, setSettingsInitialLegal] = useState<
    'privacy' | 'terms' | 'support' | null
  >(null);

  const [paywallState, setPaywallState] = useState<{
    open: boolean;
    reason: PaywallTriggerReason;
    previewSticker: VisualSearchResult | null;
  }>({
    open: false,
    reason: 'header_pill',
    previewSticker: null,
  });

  // Undo / Redo History & Mobile Ergonomics
  const [pastDocs, setPastDocs] = useState<MindMapDocument[]>([]);
  const [futureDocs, setFutureDocs] = useState<MindMapDocument[]>([]);
  const [zoomRequest, setZoomRequest] = useState<{ factor: number; seq: number } | null>(null);
  const [deletedToast, setDeletedToast] = useState<{ label: string; count: number; seq: number } | null>(null);
  const deleteToastTimerRef = useRef<number | null>(null);
  const kbInset = useKeyboardInset();

  // Realtime Collaboration & Latest Document Ref for Atomic Lifecycle Flush
  const collabRef = useRef<RealtimeCollabSession | null>(null);
  const docRef = useRef<MindMapDocument>(doc);
  docRef.current = doc;
  const isHydratedRef = useRef(false);

  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);

  const activeMapsCount = useMemo(
    () => savedMaps.filter((m) => !m.deletedAt).length,
    [savedMaps]
  );

  const openPaywall = useCallback(
    (
      reason: PaywallTriggerReason,
      previewSticker: VisualSearchResult | null = null
    ) => {
      setPaywallState({
        open: true,
        reason,
        previewSticker,
      });
    },
    []
  );

  const pushHistory = useCallback((snapshot: MindMapDocument) => {
    setPastDocs((prev) => [...prev.slice(-34), snapshot]);
    setFutureDocs([]);
  }, []);

  // Pre-warm V7 Pre-Compiled Offline Icon Search Engine in background idle time so 1st tap is <3ms!
  useEffect(() => {
    OfflineVisualSearchClient.prewarm();
  }, []);

  // Theme preference synchronization (`light` | `dark` | `system`)
  useEffect(() => {
    try {
      localStorage.setItem(THEME_PREF_KEY, themePref);
    } catch {
      // Ignore storage write errors
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolvedDark =
        themePref === 'dark' || (themePref === 'system' && media.matches);
      document.documentElement.classList.toggle('dark-study', resolvedDark);
      void syncNativeStatusBarTheme(resolvedDark);
      setDoc((prev) =>
        Boolean(prev.darkMode) === resolvedDark
          ? prev
          : { ...prev, darkMode: resolvedDark }
      );
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [themePref]);

  // Load Offline-First IndexedDB maps + V4 Seed Migration + URL Scene Hooks
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const nativeDone = await checkNativeOnboardingCompleted();
        if (nativeDone && mounted) {
          setShowOnboarding(false);
        }

        await LocalStore.purgeExpiredTrash(30);
        // Request persistent IndexedDB quota so iOS/Android never evicts user maps on low storage
        void LocalStore.requestPersistentStorage();
        // Free tier has NO Trash Can (prevents hoarding past 2-map limit); purge any legacy soft-trashed maps!
        if (!EntitlementManager.getSnapshot().isLifetimePro) {
          await LocalStore.purgeAllTrashedMaps();
        }
        // Auto-purge expired 30-day trash on Pro accounts
        await LocalStore.purgeExpiredTrash(APP_RELEASE_CONFIG.quotas.trashRetentionDays);

        let existing = await LocalStore.listMaps();

        // If user already created extra maps or edited their starter map previously, never show onboarding again
        const hasPreviousUserActivity =
          existing.length > 1 ||
          existing.some(
            (m) => !m.id.startsWith('tpl_') || m.updatedAt - m.createdAt > 15000
          );
        if (hasPreviousUserActivity) {
          persistOnboardingCompleted();
          if (mounted) {
            setShowOnboarding(false);
          }
        }

        // One-time V4 Migration: prune extra V3 auto-seeded `tpl_*` templates so Free users start at 1 / 3 maps
        const alreadyMigrated =
          localStorage.getItem(V4_SEED_MIGRATION_KEY) === '1';
        if (!alreadyMigrated && existing.length > 0) {
          const extraTemplateIds = existing
            .filter(
              (m) =>
                m.id.startsWith('tpl_') && m.id !== 'tpl_sistem_tasarimi'
            )
            .map((m) => m.id);
          for (const extraId of extraTemplateIds) {
            await LocalStore.deleteMapPermanently(extraId);
          }
          localStorage.setItem(V4_SEED_MIGRATION_KEY, '1');
          existing = await LocalStore.listMaps();
        }

        // Fresh install: seed exactly 1 flagship starter map (`1 / 3 Ücretsiz Harita`)
        if (existing.length === 0) {
          const starter = ACADEMIC_TEMPLATES[0].build();
          starter.darkMode =
            themePref === 'dark' ||
            (themePref === 'system' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches);
          starter.thumbnailDataUrl = generateMapThumbnailDataUrl(starter);
          await LocalStore.saveMap(starter, { forceSnapshot: true });
          localStorage.setItem(V4_SEED_MIGRATION_KEY, '1');
          existing = await LocalStore.listMaps();
        }

        // Auto-heal broken blob URLs, default template subtitles, and missing thumbnails
        for (const saved of existing) {
          let mutated = false;
          const nextNodes = { ...saved.nodes };
          for (const [nid, n] of Object.entries(nextNodes)) {
            let nextNode = n;

            if (
              n.subtitle &&
              !n.subtitleIsTemplateDefault &&
              KNOWN_TEMPLATE_SUBTITLES.has(n.subtitle.trim())
            ) {
              nextNode = { ...nextNode, subtitleIsTemplateDefault: true };
              mutated = true;
            }

            const hasBrokenSticker =
              n.sticker &&
              (!n.sticker.url ||
                n.sticker.url.startsWith('blob:') ||
                n.sticker.id.startsWith('synth_') ||
                n.sticker.id.startsWith('sel_v2_') ||
                n.sticker.id === 's_eko' ||
                n.sticker.id === 'l_sure');

            if (hasBrokenSticker) {
              nextNode = {
                ...nextNode,
                sticker: resolveStarterStickerForConcept(
                  nextNode.title,
                  saved.department
                ),
              };
              mutated = true;
            }

            if (nextNode !== n) {
              nextNodes[nid] = nextNode;
            }
          }

          if (!saved.thumbnailDataUrl) {
            saved.thumbnailDataUrl = generateMapThumbnailDataUrl({
              ...saved,
              nodes: nextNodes,
            });
            mutated = true;
          }

          if (mutated) {
            saved.nodes = nextNodes;
            await LocalStore.saveMap(saved, { preserveUpdatedAt: true });
          }
        }

        if (!mounted) return;
        setSavedMaps(existing);

        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        const tplParam = params.get('tpl');
        const editParam = params.get('edit');
        const examParam = params.get('exam') as ExamRecallMode | null;
        const paywallParam = params.get('paywall') as PaywallTriggerReason | null;

        let initialDoc: MindMapDocument | undefined;

        if (tplParam) {
          const matchedTpl = ACADEMIC_TEMPLATES.find((t) => t.id === tplParam);
          if (matchedTpl) {
            const built = matchedTpl.build();
            built.darkMode =
              params.get('dark') === '1' ||
              themePref === 'dark';
            built.thumbnailDataUrl = generateMapThumbnailDataUrl(built);
            initialDoc = built;
          }
        } else if (roomParam) {
          const matched = existing.find((m) => m.id === roomParam);
          if (matched) {
            initialDoc = matched;
          } else {
            const roomBlank = createBlankMindMap('Ortak Çalışma Haritası', 'genel');
            roomBlank.id = roomParam;
            roomBlank.thumbnailDataUrl = generateMapThumbnailDataUrl(roomBlank);
            await LocalStore.saveMap(roomBlank);
            setSavedMaps(await LocalStore.listMaps());
            initialDoc = roomBlank;
          }
        } else {
          const activeList = existing.filter((m) => !m.deletedAt);
          initialDoc =
            activeList.find((m) => m.id === 'tpl_sistem_tasarimi') ??
            activeList[0] ??
            existing[0];
        }

        if (initialDoc) {
          setDoc(initialDoc);
          if (editParam && initialDoc.nodes[editParam]) {
            setSelectedNodeId(editParam);
            setEditingNodeId(editParam);
          }
        }

        if (
          examParam === 'hide_text' ||
          examParam === 'hide_visuals_children'
        ) {
          setExamMode(examParam);
        }

        if (paywallParam) {
          setPaywallState({
            open: true,
            reason: paywallParam,
            previewSticker: null,
          });
        }

        isHydratedRef.current = true;
        setFitTrigger((n) => n + 1);
      } catch {
        isHydratedRef.current = true;
      }
    };
    void init();

    return () => {
      mounted = false;
      LocalStore.revokeAllObjectUrls();
    };
  }, []);

  // Zero-lag debounced auto-save: saves quietly after 650ms idle (no per-keystroke thumbnail/listMaps/Yjs storm!)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (doc.deletedAt) return;

    // Do not overwrite user library with ephemeral URL `?tpl=` preview maps unless saved maps already contain `doc.id`
    const params = new URLSearchParams(window.location.search);
    const isEphemeralTplPreview =
      Boolean(params.get('tpl')) &&
      doc.id.startsWith('tpl_') &&
      doc.id !== 'tpl_sistem_tasarimi';

    const saveTimer = window.setTimeout(async () => {
      if (isEphemeralTplPreview) return;
      await LocalStore.saveMap(doc, { preserveUpdatedAt: true });
      // Only refresh Home library cards list when Home screen is visible (avoids unnecessary App root re-render on Canvas!)
      if (activeScreen === 'home') {
        const list = await LocalStore.listMaps();
        setSavedMaps(list);
      }
    }, 650);

    const collabTimer = window.setTimeout(() => {
      collabRef.current?.syncLocalDocument(doc);
    }, 900);

    return () => {
      clearTimeout(saveTimer);
      clearTimeout(collabTimer);
    };
  }, [doc, activeScreen]);

  // Atomic iOS / Browser background & swipe-kill flush (`visibilitychange` + `pagehide`)
  useEffect(() => {
    const flushImmediately = () => {
      if (!isHydratedRef.current) return;
      const current = docRef.current;
      if (!current || current.deletedAt) return;
      const params = new URLSearchParams(window.location.search);
      if (
        Boolean(params.get('tpl')) &&
        current.id.startsWith('tpl_') &&
        current.id !== 'tpl_sistem_tasarimi'
      ) {
        return;
      }
      const thumb = generateMapThumbnailDataUrl(current);
      void LocalStore.saveMap(
        thumb ? { ...current, thumbnailDataUrl: thumb } : current,
        { preserveUpdatedAt: true, forceSnapshot: true }
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushImmediately();
      }
    };

    window.addEventListener('pagehide', flushImmediately);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const onCloudUpdated = () => {
      void LocalStore.listMaps().then((freshList) => {
        setSavedMaps(freshList);
      });
    };
    window.addEventListener('zh:cloud-maps-updated', onCloudUpdated);
    return () => {
      window.removeEventListener('pagehide', flushImmediately);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('zh:cloud-maps-updated', onCloudUpdated);
    };
  }, []);

  useEffect(() => {
    collabRef.current?.destroy();
    const session = new RealtimeCollabSession(
      doc.id,
      (remoteNodes, remoteTitle, remoteCrossLinks) => {
        setDoc((prev) => ({
          ...prev,
          title: remoteTitle ?? prev.title,
          nodes: remoteNodes,
          crossLinks: remoteCrossLinks ?? prev.crossLinks,
          updatedAt: Date.now(),
        }));
      },
      (peers) => {
        setCollaborators(peers);
      }
    );
    collabRef.current = session;
    setCollaborators(session.getInitialPresence());

    return () => {
      session.destroy();
    };
  }, [doc.id]);

  // Autonomous Topic & Discipline Context Intelligence (keyed on lightweight title/tree signature so dragging/styling/notes NEVER recompute!)
  const focusContextNodeId = editingNodeId ?? selectedNodeId ?? doc.rootNodeId;
  const activeFocusNodeIdRef = useRef<string | null>(null);
  activeFocusNodeIdRef.current = editingNodeId ?? selectedNodeId;

  const nodesContextSig = useMemo(() => {
    const vals = Object.values(doc.nodes);
    let sig = `${vals.length}|`;
    for (let i = 0; i < vals.length; i++) {
      const n = vals[i];
      sig += `${n.id}:${n.parentId ?? ''}:${n.title};`;
    }
    return sig;
  }, [doc.nodes]);

  const mapContext = useMemo(
    () =>
      TopicContextIntelligence.analyzeMapContext(
        docRef.current.nodes,
        doc.rootNodeId,
        focusContextNodeId,
        doc.department
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesContextSig, doc.rootNodeId, focusContextNodeId, doc.department]
  );

  // Zero-Keystroke Proactive Sub-Branch Suggestions
  const { proactiveSuggestions, existingSiblingTitles } = useMemo(() => {
    const curNodes = docRef.current.nodes;
    const targetNode = curNodes[focusContextNodeId];
    if (!targetNode) {
      return { proactiveSuggestions: [], existingSiblingTitles: [] };
    }
    const isFreshEmpty =
      targetNode.title.trim().length === 0 && targetNode.parentId;
    const referenceParentId = isFreshEmpty ? targetNode.parentId! : targetNode.id;
    const referenceParent =
      curNodes[referenceParentId] ?? curNodes[doc.rootNodeId];

    const siblings = Object.values(curNodes)
      .filter((n) => n.parentId === referenceParentId && n.id !== targetNode.id)
      .map((n) => n.title)
      .filter(Boolean);

    const suggestions = TopicContextIntelligence.getProactiveSubBranches(
      referenceParent?.title ?? doc.title,
      mapContext,
      siblings
    );

    return {
      proactiveSuggestions: suggestions,
      existingSiblingTitles: siblings,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesContextSig, doc.rootNodeId, doc.title, focusContextNodeId, mapContext]);

  const openMapOnCanvas = useCallback(
    (targetMap: MindMapDocument, autoEditRoot = false) => {
      const resolvedDark =
        themePref === 'dark' ||
        (themePref === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      const nextMap: MindMapDocument = {
        ...targetMap,
        darkMode: resolvedDark,
      };
      setPastDocs([]);
      setFutureDocs([]);
      setDrawingMode(false);
      setLinkingFromNodeId(null);
      setExamMode('off');
      setRevealedExamIds(new Set());
      setDoc(nextMap);
      setSelectedNodeId(autoEditRoot ? nextMap.rootNodeId : null);
      setEditingNodeId(autoEditRoot && !kbInset.isTouchDevice ? nextMap.rootNodeId : null);
      setActiveScreen('canvas');
      setTimeout(() => setFitTrigger((t) => t + 1), 45);
    },
    [themePref]
  );

  const handleNavigateHome = useCallback(async () => {
    void hapticLight();
    let finalDoc = docRef.current;
    if (editingNodeId && finalDoc.nodes[editingNodeId]) {
      const ed = finalDoc.nodes[editingNodeId];
      finalDoc = {
        ...finalDoc,
        nodes: {
          ...finalDoc.nodes,
          [editingNodeId]: {
            ...ed,
            title: ed.title.trim() || 'Yeni Konu',
          },
        },
      };
      setDoc(finalDoc);
    }
    setDrawingMode(false);
    setEditingNodeId(null);
    setSelectedNodeId(null);
    setLinkingFromNodeId(null);

    if (!finalDoc.deletedAt) {
      const thumb = generateMapThumbnailDataUrl(finalDoc);
      await LocalStore.saveMap(
        thumb ? { ...finalDoc, thumbnailDataUrl: thumb } : finalDoc,
        { preserveUpdatedAt: true, forceSnapshot: true }
      );
      setSavedMaps(await LocalStore.listMaps());
    }
    setActiveScreen('home');
  }, [editingNodeId]);

  // Load custom user folders from persistent storage
  useEffect(() => {
    void LocalStore.listCustomFolders().then(setCustomFolders);
  }, []);

  const handleCreateCustomFolder = useCallback(
    (name: string, emoji: string, color: string) => {
      const nextFolder: CustomUserFolder = {
        id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: name.trim().slice(0, 32),
        emoji: emoji || '📁',
        color: color || '#0EA5E9',
        createdAt: Date.now(),
      };
      setCustomFolders((prev) => {
        const next = [...prev, nextFolder];
        void LocalStore.saveCustomFolders(next);
        return next;
      });
      void hapticSuccess();
    },
    []
  );

  const handleDeleteCustomFolder = useCallback((folderId: string) => {
    setCustomFolders((prev) => {
      const next = prev.filter((f) => f.id !== folderId);
      void LocalStore.saveCustomFolders(next);
      return next;
    });
    void hapticLight();
  }, []);

  // --- HomeWorkspace Library Actions (with 2-Map Free Quota Enforcement) ---
  const handleCreateBlankMap = useCallback(
    async (title: string, dept: AcademicDepartment) => {
      if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
        openPaywall('map_limit');
        return;
      }
      const fresh = createBlankMindMap(title, dept);
      fresh.darkMode =
        themePref === 'dark' ||
        (themePref === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      fresh.thumbnailDataUrl = generateMapThumbnailDataUrl(fresh);
      await LocalStore.saveMap(fresh, { forceSnapshot: true });
      setSavedMaps(await LocalStore.listMaps());
      openMapOnCanvas(fresh, true);
    },
    [activeMapsCount, openMapOnCanvas, openPaywall, themePref]
  );

  const handleCreateBlankFlowchart = useCallback(
    async (title: string, dept: AcademicDepartment) => {
      if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
        openPaywall('map_limit');
        return;
      }
      const fresh = createBlankFlowchart(title, dept);
      fresh.darkMode =
        themePref === 'dark' ||
        (themePref === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      fresh.thumbnailDataUrl = generateMapThumbnailDataUrl(fresh);
      await LocalStore.saveMap(fresh, { forceSnapshot: true });
      setSavedMaps(await LocalStore.listMaps());
      openMapOnCanvas(fresh, false);
    },
    [activeMapsCount, openMapOnCanvas, openPaywall, themePref]
  );

  const handleCreateFromFlowchartTemplate = useCallback(
    async (templateId: string) => {
      if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
        openPaywall('map_limit');
        return;
      }
      const tpl = FLOWCHART_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      const built = tpl.build();
      built.darkMode =
        themePref === 'dark' ||
        (themePref === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      built.thumbnailDataUrl = generateMapThumbnailDataUrl(built);
      await LocalStore.saveMap(built, { forceSnapshot: true });
      setSavedMaps(await LocalStore.listMaps());
      openMapOnCanvas(built, false);
    },
    [activeMapsCount, openMapOnCanvas, openPaywall, themePref]
  );

  const handleCreateFromTemplate = useCallback(
    async (templateId: string) => {
      if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
        openPaywall('map_limit');
        return;
      }
      const tpl = ACADEMIC_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      const built = tpl.build();
      built.id = `map_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      built.updatedAt = Date.now();
      built.darkMode =
        themePref === 'dark' ||
        (themePref === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      built.thumbnailDataUrl = generateMapThumbnailDataUrl(built);
      await LocalStore.saveMap(built, { forceSnapshot: true });
      setSavedMaps(await LocalStore.listMaps());
      openMapOnCanvas(built, false);
    },
    [activeMapsCount, openMapOnCanvas, openPaywall, themePref]
  );

  const handleDuplicateMap = useCallback(
    async (sourceMap: MindMapDocument) => {
      if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
        openPaywall('map_limit');
        return;
      }
      const copy: MindMapDocument = {
        ...JSON.parse(JSON.stringify(sourceMap)),
        id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `${sourceMap.title} (Kopya)`,
        isPinned: false,
        deletedAt: null,
        updatedAt: Date.now(),
      };
      copy.thumbnailDataUrl = generateMapThumbnailDataUrl(copy);
      await LocalStore.saveMap(copy, { forceSnapshot: true });
      setSavedMaps(await LocalStore.listMaps());
      void hapticSuccess();
    },
    [activeMapsCount, openPaywall]
  );

  const handleRenameMapById = useCallback(
    async (mapId: string, newTitle: string) => {
      const target = await LocalStore.getMap(mapId);
      if (!target) return;
      const root = target.nodes[target.rootNodeId];
      const updated: MindMapDocument = {
        ...target,
        title: newTitle,
        nodes: root
          ? {
              ...target.nodes,
              [target.rootNodeId]: { ...root, title: newTitle },
            }
          : target.nodes,
        updatedAt: Date.now(),
      };
      updated.thumbnailDataUrl = generateMapThumbnailDataUrl(updated);
      await LocalStore.saveMap(updated);
      if (docRef.current.id === mapId) {
        setDoc(updated);
      }
      setSavedMaps(await LocalStore.listMaps());
    },
    []
  );

  const handleTogglePinMap = useCallback(async (mapId: string) => {
    const target = await LocalStore.getMap(mapId);
    if (!target) return;
    const updated: MindMapDocument = {
      ...target,
      isPinned: !target.isPinned,
    };
    await LocalStore.saveMap(updated, { preserveUpdatedAt: true });
    if (docRef.current.id === mapId) {
      setDoc(updated);
    }
    setSavedMaps(await LocalStore.listMaps());
  }, []);

  const handleChangeMapFolder = useCallback(
    async (mapId: string, folder: MindMapFolder) => {
      const target = await LocalStore.getMap(mapId);
      if (!target) return;
      const updated: MindMapDocument = {
        ...target,
        folder,
      };
      await LocalStore.saveMap(updated, { preserveUpdatedAt: true });
      if (docRef.current.id === mapId) {
        setDoc(updated);
      }
      setSavedMaps(await LocalStore.listMaps());
    },
    []
  );

  const handleMoveToTrash = useCallback(async (mapId: string) => {
    // Free tier has NO Trash Can -> immediately delete permanently so users cannot hoard deleted maps!
    if (!EntitlementManager.getSnapshot().isLifetimePro) {
      await LocalStore.deleteMapPermanently(mapId);
    } else {
      await LocalStore.moveToTrash(mapId);
    }
    const list = await LocalStore.listMaps();
    setSavedMaps(list);
    if (docRef.current.id === mapId) {
      const nextActive = list.find((m) => !m.deletedAt);
      if (nextActive) {
        setDoc(nextActive);
      }
    }
  }, []);

  const handleRestoreFromTrash = useCallback(
    async (mapId: string) => {
      if (!EntitlementManager.getSnapshot().isLifetimePro) {
        openPaywall('map_limit');
        return;
      }
      if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
        openPaywall('map_limit');
        return;
      }
      await LocalStore.restoreFromTrash(mapId);
      setSavedMaps(await LocalStore.listMaps());
      void hapticSuccess();
    },
    [activeMapsCount, openPaywall]
  );

  const handleDeletePermanently = useCallback(async (mapId: string) => {
    await LocalStore.deleteMapPermanently(mapId);
    const list = await LocalStore.listMaps();
    setSavedMaps(list);
    if (docRef.current.id === mapId) {
      const nextActive = list.find((m) => !m.deletedAt);
      if (nextActive) {
        setDoc(nextActive);
      }
    }
  }, []);

  const handleImportMapsBatch = useCallback(
    async (incomingDocs: MindMapDocument[]) => {
      if (incomingDocs.length === 0) return;
      let currentActiveCount = activeMapsCount;
      let lastImported: MindMapDocument | null = null;

      for (const item of incomingDocs) {
        const existingMatch = savedMaps.find(
          (m) => m.id === item.id && !m.deletedAt
        );
        if (
          !existingMatch &&
          !EntitlementManager.canCreateActiveMap(currentActiveCount)
        ) {
          openPaywall('map_limit');
          break;
        }
        const sanitized: MindMapDocument = {
          ...item,
          id:
            existingMatch
              ? item.id
              : `map_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          deletedAt: null,
          updatedAt: Date.now(),
        };
        sanitized.thumbnailDataUrl = generateMapThumbnailDataUrl(sanitized);
        await LocalStore.saveMap(sanitized, { forceSnapshot: true });
        if (!existingMatch) {
          currentActiveCount += 1;
        }
        lastImported = sanitized;
      }

      setSavedMaps(await LocalStore.listMaps());
      if (lastImported) {
        openMapOnCanvas(lastImported, false);
      }
    },
    [activeMapsCount, openMapOnCanvas, openPaywall, savedMaps]
  );

  const handleImportZihinRaw = useCallback(
    (rawJson: string) => {
      try {
        const parsedDocs = LocalStore.parseZihinImportPayload(rawJson);
        void handleImportMapsBatch(parsedDocs);
      } catch {
        // Ignore malformed files
      }
    },
    [handleImportMapsBatch]
  );

  // --- Feature Gate Openers ---
  const handleRequestOpenSmartGenerator = useCallback(
    (tab: 'text_to_map' | 'proactive_branches', fromHome = false) => {
      if (tab === 'text_to_map') {
        if (!EntitlementManager.canUseSmartMap()) {
          openPaywall('smart_map_limit');
          return;
        }
        if (fromHome && !EntitlementManager.canCreateActiveMap(activeMapsCount)) {
          openPaywall('map_limit');
          return;
        }
      }
      setSmartGenModal({ open: true, tab });
    },
    [activeMapsCount, openPaywall]
  );

  const handleRequestOpenNoteCropper = useCallback(() => {
    if (!EntitlementManager.canUseNoteCrop()) {
      openPaywall('note_crop_limit');
      return;
    }
    setNoteCropperOpen(true);
  }, [openPaywall]);

  const handleRequestOpenAIStudio = useCallback(
    (customQuery?: string | null) => {
      if (!EntitlementManager.canUseAiSticker()) {
        openPaywall('ai_sticker_limit');
        return;
      }
      setAiStudioInitialQuery(customQuery ?? null);
      setAiStudioOpen(true);
    },
    [openPaywall]
  );

  // --- Canvas Editing & Node Quota Gates (`45` Free Nodes / Map) ---
  const handleUndo = useCallback(() => {
    setPastDocs((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setFutureDocs((prevFut) => [doc, ...prevFut.slice(0, 34)]);
      setDoc(previous);
      return prevPast.slice(0, -1);
    });
  }, [doc]);

  const handleRedo = useCallback(() => {
    setFutureDocs((prevFut) => {
      if (prevFut.length === 0) return prevFut;
      const next = prevFut[0];
      setPastDocs((prevPast) => [...prevPast.slice(-34), doc]);
      setDoc(next);
      return prevFut.slice(1);
    });
  }, [doc]);

  const handleCreateChildBranch = useCallback(
    (parentId: string, worldX: number, worldY: number, branchColor: string) => {
      const currentNodeCount = Object.keys(doc.nodes).length;
      if (!EntitlementManager.canAddNodeToMap(currentNodeCount)) {
        openPaywall('node_limit');
        return;
      }

      pushHistory(doc);
      const newId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newNode: MindNode = {
        id: newId,
        parentId,
        title: '',
        x: worldX,
        y: worldY,
        branchColor,
        collapsed: false,
      };

      setDoc((prev) => {
        const parent = prev.nodes[parentId];
        const nextNodes: Record<string, MindNode> = {
          ...prev.nodes,
          ...(parent ? { [parentId]: { ...parent, collapsed: false } } : {}),
          [newId]: newNode,
        };
        return {
          ...prev,
          nodes: resolveTreeCollisions(nextNodes, prev.rootNodeId),
          updatedAt: Date.now(),
        };
      });

      setSelectedNodeId(newId);
      // Never auto-pop virtual keyboard on touch devices; user taps title/search input explicitly when ready to type!
      setEditingNodeId(kbInset.isTouchDevice ? null : newId);
    },
    [doc, kbInset.isTouchDevice, openPaywall, pushHistory]
  );

  const handleCreateBranchWithSticker = useCallback(
    (title: string, sticker: StickerAsset) => {
      const currentNodeCount = Object.keys(doc.nodes).length;
      if (!EntitlementManager.canAddNodeToMap(currentNodeCount)) {
        openPaywall('node_limit');
        return;
      }

      const parentId = selectedNodeId ?? doc.rootNodeId;
      const parent = doc.nodes[parentId] ?? doc.nodes[doc.rootNodeId];
      if (!parent) return;

      pushHistory(doc);
      const pos = findBestOpenBranchPosition(parent, doc.nodes, doc.rootNodeId);
      const branchColor = resolveNewBranchColor(parent, doc.nodes, doc.rootNodeId);
      const newId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      setDoc((prev) => ({
        ...prev,
        nodes: {
          ...prev.nodes,
          [parent.id]: { ...parent, collapsed: false },
          [newId]: {
            id: newId,
            parentId: parent.id,
            title,
            x: pos.x,
            y: pos.y,
            branchColor,
            collapsed: false,
            sticker,
            stickerUpdatedAt: Date.now(),
          },
        },
        updatedAt: Date.now(),
      }));

      setSelectedNodeId(newId);
      setRadarJump((prev) => ({ x: pos.x, y: pos.y, seq: (prev?.seq ?? 0) + 1 }));
    },
    [doc, openPaywall, pushHistory, selectedNodeId]
  );

  const handleApplyProactiveSuggestion = useCallback(
    (nodeId: string, suggestion: ProactiveBranchSuggestion) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              title: suggestion.title,
              subtitle: undefined,
              subtitleIsTemplateDefault: false,
              techBadge: suggestion.techBadge,
              sticker: suggestion.sticker,
              stickerUpdatedAt: Date.now(),
            },
          },
          updatedAt: Date.now(),
        };
      });
      setEditingNodeId(null);
    },
    [doc, pushHistory]
  );

  const handleAddProactiveBranches = useCallback(
    (parentId: string, branches: ProactiveBranchSuggestion[]) => {
      if (branches.length === 0) return;
      const currentNodeCount = Object.keys(doc.nodes).length;
      if (!EntitlementManager.canAddNodeToMap(currentNodeCount)) {
        openPaywall('node_limit');
        return;
      }

      pushHistory(doc);
      setDoc((prev) => {
        const parent = prev.nodes[parentId];
        if (!parent) return prev;
        const workingNodes: Record<string, MindNode> = {
          ...prev.nodes,
          [parentId]: { ...parent, collapsed: false },
        };

        branches.forEach((b, idx) => {
          if (
            !EntitlementManager.canAddNodeToMap(Object.keys(workingNodes).length)
          ) {
            return;
          }
          const pos = findBestOpenBranchPosition(
            parent,
            workingNodes,
            prev.rootNodeId
          );
          const col = resolveNewBranchColor(parent, workingNodes, prev.rootNodeId);
          const id = `nb_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`;
          workingNodes[id] = {
            id,
            parentId,
            title: b.title,
            techBadge: b.techBadge,
            x: pos.x,
            y: pos.y,
            branchColor: col,
            collapsed: false,
            sticker: b.sticker,
            stickerUpdatedAt: Date.now(),
          };
        });

        return {
          ...prev,
          nodes: computeRadialAutoLayout(workingNodes, prev.rootNodeId),
          updatedAt: Date.now(),
        };
      });
      setTimeout(() => setFitTrigger((t) => t + 1), 40);
    },
    [doc, openPaywall, pushHistory]
  );

  const handleDeleteNode = useCallback(
    (targetId: string) => {
      if (targetId === doc.rootNodeId) return;
      const targetNode = doc.nodes[targetId];
      if (!targetNode) return;

      pushHistory(doc);
      void hapticMedium();

      const toRemove = new Set<string>([targetId]);
      let added = true;
      while (added) {
        added = false;
        for (const n of Object.values(doc.nodes)) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id);
            added = true;
          }
        }
      }

      setDoc((prev) => {
        const nextNodes: Record<string, MindNode> = {};
        for (const [id, n] of Object.entries(prev.nodes)) {
          if (!toRemove.has(id)) nextNodes[id] = n;
        }
        const nextCrossLinks = (prev.crossLinks ?? []).filter(
          (cl) => !toRemove.has(cl.fromNodeId) && !toRemove.has(cl.toNodeId)
        );
        return {
          ...prev,
          nodes: nextNodes,
          crossLinks: nextCrossLinks,
          updatedAt: Date.now(),
        };
      });

      setSelectedNodeId(null);
      setEditingNodeId(null);

      // Show instant 5-second 1-tap Undo toast so branch deletion is effortless & worry-free
      if (deleteToastTimerRef.current !== null) {
        window.clearTimeout(deleteToastTimerRef.current);
      }
      setDeletedToast((prev) => ({
        label: targetNode.title?.trim() || 'Dal',
        count: toRemove.size,
        seq: (prev?.seq ?? 0) + 1,
      }));
      deleteToastTimerRef.current = window.setTimeout(() => {
        setDeletedToast(null);
        deleteToastTimerRef.current = null;
      }, 5000);
    },
    [doc, pushHistory]
  );

  const handleUpdateNodeTitle = useCallback((nodeId: string, title: string) => {
    setDoc((prev) => {
      const target = prev.nodes[nodeId];
      if (!target) return prev;
      const isRoot = nodeId === prev.rootNodeId;
      const titleChanged =
        title.trim().toLocaleLowerCase('tr-TR') !==
        target.title.trim().toLocaleLowerCase('tr-TR');

      const shouldClearSubtitle =
        titleChanged &&
        Boolean(
          target.subtitleIsTemplateDefault ||
            (target.subtitle &&
              KNOWN_TEMPLATE_SUBTITLES.has(target.subtitle.trim()))
        );

      const shouldClearTemplateBadge =
        titleChanged &&
        Boolean(
          target.techBadge &&
            KNOWN_TEMPLATE_TECH_BADGES.has(target.techBadge.trim())
        );

      return {
        ...prev,
        title: isRoot && title.trim() ? title : prev.title,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...target,
            title,
            subtitle: shouldClearSubtitle ? undefined : target.subtitle,
            subtitleIsTemplateDefault: shouldClearSubtitle
              ? false
              : target.subtitleIsTemplateDefault,
            techBadge: shouldClearTemplateBadge ? undefined : target.techBadge,
          },
        },
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleUpdateNodeTechBadge = useCallback(
    (nodeId: string, techBadge: string) => {
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              techBadge: techBadge || undefined,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    []
  );

  const handleUpdateNodeNote = useCallback((nodeId: string, note: string) => {
    setDoc((prev) => {
      const target = prev.nodes[nodeId];
      if (!target) return prev;
      const nextNodes: Record<string, MindNode> = {
        ...prev.nodes,
        [nodeId]: {
          ...target,
          note: note || undefined,
          noteCollapsed: false,
        },
      };
      return {
        ...prev,
        nodes: resolveTreeCollisions(nextNodes, prev.rootNodeId),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleToggleNodeNoteCollapse = useCallback((nodeId: string) => {
    setDoc((prev) => {
      const target = prev.nodes[nodeId];
      if (!target) return prev;
      const nextNodes: Record<string, MindNode> = {
        ...prev.nodes,
        [nodeId]: {
          ...target,
          noteCollapsed: !target.noteCollapsed,
        },
      };
      return {
        ...prev,
        nodes: resolveTreeCollisions(nextNodes, prev.rootNodeId),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleToggleNodeCheck = useCallback(
    (nodeId: string) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        // Cycle: no checkbox -> unchecked (false) -> checked (true) -> unchecked (false)
        // Wait: if clicked from canvas checkbox when already boolean, flip false<->true; if null/undefined, enable as false (ready to check) or true?
        // Enabling as false first lets user add a task checkbox cleanly, and clicking checkbox marks it true!
        const nextChecked =
          typeof target.checked === 'boolean' ? !target.checked : false;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              checked: nextChecked,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleChangeNodePriorityTag = useCallback(
    (nodeId: string, priorityTag: NodePriorityTag | null) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              priorityTag,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleCycleNodePriorityTag = useCallback(
    (nodeId: string) => {
      const cur = doc.nodes[nodeId]?.priorityTag ?? null;
      const order: Array<NodePriorityTag | null> = [
        null,
        'important',
        'exam',
        'review',
      ];
      const next = order[(order.indexOf(cur) + 1) % order.length];
      handleChangeNodePriorityTag(nodeId, next);
    },
    [doc.nodes, handleChangeNodePriorityTag]
  );

  const handleChangeStickerSize = useCallback(
    (nodeId: string, stickerSize: StickerSizePreset) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        const { stickerWidthPx: _clearedCustom, ...restTarget } = target;
        const nextNodes: Record<string, MindNode> = {
          ...prev.nodes,
          [nodeId]: {
            ...restTarget,
            stickerSize,
          },
        };
        return {
          ...prev,
          nodes: resolveTreeCollisions(nextNodes, prev.rootNodeId),
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const lastResizeHistoryAtRef = useRef(0);
  const handleResizeNodeVisual = useCallback(
    (
      nodeId: string,
      patch: {
        stickerWidthPx?: number | null;
        fontScale?: number | null;
        handwritingWidthPx?: number | null;
      }
    ) => {
      const nowMs = Date.now();
      if (nowMs - lastResizeHistoryAtRef.current > 650) {
        pushHistory(doc);
        lastResizeHistoryAtRef.current = nowMs;
      }
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        const nextNode: MindNode = { ...target };

        if ('stickerWidthPx' in patch) {
          if (patch.stickerWidthPx === null || patch.stickerWidthPx === undefined) {
            delete nextNode.stickerWidthPx;
          } else {
            nextNode.stickerWidthPx = Math.round(
              Math.max(28, Math.min(440, patch.stickerWidthPx))
            );
          }
        }
        if ('fontScale' in patch) {
          if (patch.fontScale === null || patch.fontScale === undefined) {
            delete nextNode.fontScale;
          } else {
            nextNode.fontScale =
              Math.round(Math.max(0.65, Math.min(2.6, patch.fontScale)) * 20) / 20;
          }
        }
        if ('handwritingWidthPx' in patch && nextNode.handwriting) {
          const nextHw = { ...nextNode.handwriting };
          if (patch.handwritingWidthPx === null || patch.handwritingWidthPx === undefined) {
            delete nextHw.renderWidthPx;
          } else {
            nextHw.renderWidthPx = Math.round(
              Math.max(64, Math.min(680, patch.handwritingWidthPx))
            );
          }
          nextNode.handwriting = nextHw;
        }

        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: nextNode,
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleChangeNodeStyle = useCallback(
    (nodeId: string, nodeStyle: NodeVisualStyle) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              nodeStyle,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleApplyNodeHandwriting = useCallback(
    (nodeId: string, handwriting: HandwrittenConceptAsset, optionalTitle?: string) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        const nextTitle =
          optionalTitle && optionalTitle.trim().length > 0
            ? optionalTitle.trim()
            : target.title;
        const isRoot = nodeId === prev.rootNodeId;
        return {
          ...prev,
          title: isRoot && nextTitle ? nextTitle : prev.title,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              title: nextTitle,
              handwriting,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleClearNodeHandwriting = useCallback(
    (nodeId: string) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target || !target.handwriting) return prev;
        const { handwriting: _removed, ...rest } = target;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: rest,
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleSetDefaultNodeStyle = useCallback(
    (nextStyle: NodeVisualStyle) => {
      pushHistory(doc);
      void hapticLight();
      setDoc((prev) => {
        const cleanedNodes: Record<string, MindNode> = {};
        for (const [id, n] of Object.entries(prev.nodes)) {
          cleanedNodes[id] = { ...n, nodeStyle: undefined };
        }
        return {
          ...prev,
          defaultNodeStyle: nextStyle,
          nodes: cleanedNodes,
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleToggleDefaultNodeStyle = useCallback(() => {
    const nextStyle: NodeVisualStyle =
      doc.defaultNodeStyle === 'organic' ? 'card' : 'organic';
    handleSetDefaultNodeStyle(nextStyle);
  }, [doc.defaultNodeStyle, handleSetDefaultNodeStyle]);

  const handleFinishEditing = useCallback(() => {
    setDoc((prev) => {
      if (!editingNodeId) return prev;
      const target = prev.nodes[editingNodeId];
      if (!target) return prev;
      const finalTitle = target.title.trim() || 'Yeni Konu';
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [editingNodeId]: {
            ...target,
            title: finalTitle,
          },
        },
      };
    });
    setEditingNodeId(null);
  }, [editingNodeId]);

  const handleApplySticker = useCallback(
    (nodeId: string, sticker: StickerAsset) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              sticker,
              stickerUpdatedAt: Date.now(),
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleRemoveSticker = useCallback(
    (nodeId: string) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        const copy = { ...target };
        delete copy.sticker;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: copy,
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleChangeBranchColor = useCallback(
    (nodeId: string, color: string) => {
      pushHistory(doc);
      setDoc((prev) => {
        const subtreeIds = new Set<string>([nodeId]);
        if (nodeId !== prev.rootNodeId) {
          let grow = true;
          while (grow) {
            grow = false;
            for (const n of Object.values(prev.nodes)) {
              if (n.parentId && subtreeIds.has(n.parentId) && !subtreeIds.has(n.id)) {
                subtreeIds.add(n.id);
                grow = true;
              }
            }
          }
        }
        const nextNodes = { ...prev.nodes };
        for (const id of subtreeIds) {
          if (nextNodes[id]) {
            nextNodes[id] = { ...nextNodes[id], branchColor: color };
          }
        }
        return {
          ...prev,
          nodes: nextNodes,
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleCompleteCrossLink = useCallback(
    (fromNodeId: string, toNodeId: string) => {
      pushHistory(doc);
      const fromNode = doc.nodes[fromNodeId];
      const newLink: CrossLink = {
        id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        fromNodeId,
        toNodeId,
        label:
          mapContext.discipline === 'system_design_cs'
            ? 'Veri / API Akışı'
            : mapContext.discipline === 'law_governance'
            ? 'Kanun Yolu İletimi'
            : 'Doğrudan İlişki',
        color: fromNode?.branchColor || '#0EA5E9',
        style: 'dashed_flow',
      };

      setDoc((prev) => ({
        ...prev,
        crossLinks: [...(prev.crossLinks ?? []), newLink],
        updatedAt: Date.now(),
      }));
      setLinkingFromNodeId(null);
    },
    [doc, mapContext.discipline, pushHistory]
  );

  const handleUpdateCrossLinkLabel = useCallback(
    (linkId: string, label: string) => {
      setDoc((prev) => ({
        ...prev,
        crossLinks: (prev.crossLinks ?? []).map((cl) =>
          cl.id === linkId ? { ...cl, label } : cl
        ),
        updatedAt: Date.now(),
      }));
    },
    []
  );

  const handleDeleteCrossLink = useCallback(
    (linkId: string) => {
      pushHistory(doc);
      setDoc((prev) => ({
        ...prev,
        crossLinks: (prev.crossLinks ?? []).filter((cl) => cl.id !== linkId),
        updatedAt: Date.now(),
      }));
    },
    [doc, pushHistory]
  );

  const handleCommitBatchNodePositions = useCallback(
    (updates: Record<string, { x: number; y: number }>) => {
      const keys = Object.keys(updates);
      if (keys.length === 0) return;

      pushHistory(doc);
      setDoc((prev) => {
        const nextNodes = { ...prev.nodes };
        for (const id of keys) {
          const orig = nextNodes[id];
          if (orig) {
            nextNodes[id] = {
              ...orig,
              x: updates[id].x,
              y: updates[id].y,
            };
          }
        }
        return {
          ...prev,
          nodes: nextNodes,
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleToggleCollapse = useCallback(
    (nodeId: string) => {
      pushHistory(doc);
      setDoc((prev) => {
        const target = prev.nodes[nodeId];
        if (!target) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: { ...target, collapsed: !target.collapsed },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [doc, pushHistory]
  );

  const handleAutoLayout = useCallback(() => {
    pushHistory(doc);
    void hapticMedium();
    setIsAutoLayoutAnimating(true);
    setDoc((prev) => ({
      ...prev,
      nodes: computeMindMapLayout(prev.nodes, prev.rootNodeId, prev.layoutType ?? 'radial'),
      updatedAt: Date.now(),
    }));
    setTimeout(() => setFitTrigger((t) => t + 1), 30);
    setTimeout(() => setIsAutoLayoutAnimating(false), 380);
  }, [doc, pushHistory]);

  const handleChangeLayoutType = useCallback(
    (nextLayout: MindMapLayoutType) => {
      pushHistory(doc);
      void hapticMedium();
      setIsAutoLayoutAnimating(true);
      setDoc((prev) => ({
        ...prev,
        layoutType: nextLayout,
        nodes: computeMindMapLayout(prev.nodes, prev.rootNodeId, nextLayout),
        updatedAt: Date.now(),
      }));
      setTimeout(() => setFitTrigger((t) => t + 1), 40);
      setTimeout(() => setIsAutoLayoutAnimating(false), 380);
    },
    [doc, pushHistory]
  );

  const handleApplyStudioTheme = useCallback(
    (themeId: StudioThemeId) => {
      pushHistory(doc);
      void hapticMedium();
      setDoc((prev) => applyStudioThemeToDocument(prev, themeId));
    },
    [doc, pushHistory]
  );

  const handleUpdateNodeLink = useCallback((nodeId: string, rawUrl: string) => {
    setDoc((prev) => {
      const target = prev.nodes[nodeId];
      if (!target) return prev;
      const trimmed = rawUrl.trim();
      const safe = trimmed ? sanitizeExternalLinkUrl(trimmed) ?? trimmed : undefined;
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: { ...target, linkUrl: safe },
        },
        updatedAt: Date.now(),
      };
    });
  }, []);

  const handleConvertActiveMapToFlowchart = useCallback(async () => {
    if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
      openPaywall('map_limit');
      return;
    }
    const converted = convertMindMapToFlowchart(doc);
    converted.darkMode = Boolean(doc.darkMode);
    converted.thumbnailDataUrl = generateMapThumbnailDataUrl(converted);
    await LocalStore.saveMap(converted, { forceSnapshot: true });
    setSavedMaps(await LocalStore.listMaps());
    void hapticSuccess();
    openMapOnCanvas(converted, false);
  }, [activeMapsCount, doc, openMapOnCanvas, openPaywall]);

  const handleFocusPresentationNode = useCallback(
    (nodeId: string) => {
      const target = doc.nodes[nodeId];
      if (!target) return;
      setSelectedNodeId(nodeId);
      setRadarJump({ x: target.x, y: target.y, seq: Date.now() });
    },
    [doc.nodes]
  );

  const anyModalOpen =
    stickerDrawerOpen ||
    commandPaletteOpen ||
    outlineOpen ||
    aiStudioOpen ||
    smartGenModal.open ||
    noteCropperOpen ||
    sketchPopoverOpen ||
    handwritingModalOpen ||
    exportOpen ||
    flashcardsOpen ||
    presentationOpen ||
    settingsOpen ||
    paywallState.open ||
    showOnboarding;

  // Native Mobile App Shell Guards: suppress web browser context menus, image drag ghosts & UI pinch-zoom
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.allow-text-input'))
      ) {
        return;
      }
      e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };
    const onGestureStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.canvas-stage')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('gesturestart', onGestureStart, { passive: false });
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('gesturestart', onGestureStart);
    };
  }, []);

  // Full Pro Keyboard Shortcuts (`Cmd/Ctrl+K`, `Space+Drag`, `Tab`, `Enter`, `Delete`, `Ctrl+Z/Y`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      const isInputFocused =
        targetEl?.tagName === 'INPUT' ||
        targetEl?.tagName === 'TEXTAREA' ||
        targetEl?.isContentEditable;

      if (
        activeScreen === 'canvas' &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'k'
      ) {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }

      if (
        activeScreen === 'canvas' &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'f'
      ) {
        e.preventDefault();
        setFindBarOpen(true);
        return;
      }

      if (activeScreen !== 'canvas') {
        if (e.key === 'Escape' && anyModalOpen) {
          setSettingsOpen(false);
          setPaywallState((p) => ({ ...p, open: false }));
          setSmartGenModal((s) => ({ ...s, open: false }));
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isInputFocused) {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isInputFocused) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      if (e.code === 'Space' && !isInputFocused && !anyModalOpen) {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      if (isInputFocused) return;
      if (anyModalOpen) {
        if (e.key === 'Escape') {
          setStickerDrawerOpen(false);
          setCommandPaletteOpen(false);
          setOutlineOpen(false);
          setAiStudioOpen(false);
          setSmartGenModal((s) => ({ ...s, open: false }));
          setNoteCropperOpen(false);
          setSketchPopoverOpen(false);
          setHandwritingModalOpen(false);
          setExportOpen(false);
          setSettingsOpen(false);
          setPaywallState((p) => ({ ...p, open: false }));
        }
        return;
      }

      if (e.key === 'Escape') {
        if (linkingFromNodeId) {
          setLinkingFromNodeId(null);
        } else {
          setSelectedNodeId(null);
        }
        return;
      }

      if (e.key === 'Tab' && selectedNodeId && doc.nodes[selectedNodeId]) {
        e.preventDefault();
        const parent = doc.nodes[selectedNodeId];
        const pos = findBestOpenBranchPosition(parent, doc.nodes, doc.rootNodeId);
        const col = resolveNewBranchColor(parent, doc.nodes, doc.rootNodeId);
        handleCreateChildBranch(parent.id, pos.x, pos.y, col);
      } else if (e.key === 'Enter' && selectedNodeId && doc.nodes[selectedNodeId]) {
        e.preventDefault();
        const sel = doc.nodes[selectedNodeId];
        if (e.shiftKey || !sel.parentId || !doc.nodes[sel.parentId]) {
          setEditingNodeId(selectedNodeId);
        } else {
          const siblingParent = doc.nodes[sel.parentId];
          const pos = findBestOpenBranchPosition(
            siblingParent,
            doc.nodes,
            doc.rootNodeId
          );
          const col = resolveNewBranchColor(
            siblingParent,
            doc.nodes,
            doc.rootNodeId
          );
          handleCreateChildBranch(siblingParent.id, pos.x, pos.y, col);
        }
      } else if (e.key === 'F2' && selectedNodeId && doc.nodes[selectedNodeId]) {
        e.preventDefault();
        setEditingNodeId(selectedNodeId);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedNodeId &&
        selectedNodeId !== doc.rootNodeId
      ) {
        e.preventDefault();
        handleDeleteNode(selectedNodeId);
      } else if (e.key === 'Escape' && drawingMode) {
        e.preventDefault();
        setDrawingMode(false);
      } else if (e.key.toLowerCase() === 'f') {
        setFocusMode((v) => !v);
      } else if (e.key === '0') {
        setFitTrigger((n) => n + 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    const onBlur = () => setSpacePressed(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    activeScreen,
    doc,
    selectedNodeId,
    linkingFromNodeId,
    anyModalOpen,
    handleCreateChildBranch,
    handleDeleteNode,
    handleUndo,
    handleRedo,
  ]);

  const examStats = useMemo(() => {
    const meta = computeTreeMeta(doc.nodes, doc.rootNodeId);
    const quizNodes = Object.values(doc.nodes).filter(
      (n) => n.id !== doc.rootNodeId && !meta.hiddenNodeIds.has(n.id)
    );
    const revealed = quizNodes.filter((n) => revealedExamIds.has(n.id)).length;
    return {
      revealed,
      total: quizNodes.length,
    };
  }, [doc.nodes, doc.rootNodeId, revealedExamIds]);

  // Native Apple Pencil Double-Tap/Squeeze & Samsung S-Pen Side Barrel Eraser Button Listeners!
  useEffect(() => {
    const onApplePencilToggle = () => {
      if (activeScreen !== 'canvas') return;
      void hapticLight();
      setSelectedNodeId(null);
      setEditingNodeId(null);
      setDrawingMode(true);
      setInkTool((cur) => {
        if (cur === 'eraser') {
          return prevDrawToolRef.current || 'pen';
        }
        prevDrawToolRef.current = cur;
        return 'eraser';
      });
    };

    const onAndroidSPenHold = (ev: Event) => {
      const detail = (ev as CustomEvent<{ active?: boolean }>).detail;
      const isActive = Boolean(detail?.active);
      setHardwareEraserActive(isActive);
      if (isActive && activeScreen === 'canvas') {
        void hapticLight();
      }
    };

    window.addEventListener('zh:stylus-eraser-toggle', onApplePencilToggle);
    window.addEventListener('zh:stylus-eraser-hold', onAndroidSPenHold);
    return () => {
      window.removeEventListener('zh:stylus-eraser-toggle', onApplePencilToggle);
      window.removeEventListener('zh:stylus-eraser-hold', onAndroidSPenHold);
    };
  }, [activeScreen]);

  const handleToggleDrawingMode = useCallback(() => {
    void hapticLight();
    setSelectedLassoIds([]);
    setDrawingMode((prev) => {
      const next = !prev;
      if (next) {
        setSelectedNodeId(null);
        setEditingNodeId(null);
        setLinkingFromNodeId(null);
        if (docRef.current.darkMode && inkColor === '#0F172A') {
          setInkColor('#38BDF8');
        }
      }
      return next;
    });
  }, [inkColor]);

  const handleChangeInkTool = useCallback((nextTool: InkToolType) => {
    if (nextTool !== 'eraser') {
      prevDrawToolRef.current = nextTool;
    }
    if (nextTool !== 'lasso') {
      setSelectedLassoIds([]);
    }
    setInkTool(nextTool);
  }, []);

  const handlePushInkHistory = useCallback(() => {
    pushHistory(docRef.current);
  }, [pushHistory]);

  const handleStartEditing = useCallback((id: string) => {
    setSelectedNodeId(id);
    if (docRef.current.nodes[id]?.handwriting?.strokes?.length) {
      setEditingNodeId(null);
      setHandwritingModalOpen(true);
      return;
    }
    setEditingNodeId(id);
  }, []);

  const handleOpenHandwritingEditor = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setEditingNodeId(null);
    setHandwritingModalOpen(true);
  }, []);

  const handleStartCrossLink = useCallback((fromId: string) => {
    setSelectedNodeId(null);
    setEditingNodeId(null);
    setLinkingFromNodeId(fromId);
  }, []);

  const handleOpenStickerGallery = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setStickerDrawerOpen(true);
  }, []);

  const handleCancelCrossLink = useCallback(() => {
    setLinkingFromNodeId(null);
  }, []);

  const handleRevealExamNode = useCallback((nodeId: string) => {
    setRevealedExamIds((prev) => {
      if (prev.has(nodeId)) return prev;
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  }, []);

  const handlePointerWorldMove = useCallback((wx: number, wy: number) => {
    collabRef.current?.broadcastCursor(wx, wy, activeFocusNodeIdRef.current);
  }, []);

  const handleViewportSnapshot = useCallback(
    (vp: ViewportTransform, w: number, h: number, hiddenIds: Set<string>) => {
      setRadarSnap({ vp, w, h, hiddenIds });
    },
    []
  );

  const handleAddInkStroke = useCallback(
    (stroke: CanvasInkStroke) => {
      pushHistory(docRef.current);
      setDoc((prev) => ({
        ...prev,
        inkStrokes: [...(prev.inkStrokes ?? []), stroke],
        updatedAt: Date.now(),
      }));
    },
    [pushHistory]
  );

  const handleDeleteInkStroke = useCallback(
    (strokeId: string) => {
      pushHistory(docRef.current);
      setDoc((prev) => ({
        ...prev,
        inkStrokes: (prev.inkStrokes ?? []).filter((s) => s.id !== strokeId),
        updatedAt: Date.now(),
      }));
    },
    [pushHistory]
  );

  const handleReplaceInkStrokes = useCallback(
    (nextStrokes: CanvasInkStroke[]) => {
      setDoc((prev) => ({
        ...prev,
        inkStrokes: nextStrokes,
        updatedAt: Date.now(),
      }));
    },
    []
  );

  const handleDeleteLassoSelected = useCallback(() => {
    if (selectedLassoIds.length === 0) return;
    pushHistory(docRef.current);
    const delSet = new Set(selectedLassoIds);
    setDoc((prev) => ({
      ...prev,
      inkStrokes: (prev.inkStrokes ?? []).filter((s) => !delSet.has(s.id)),
      updatedAt: Date.now(),
    }));
    setSelectedLassoIds([]);
    void hapticLight();
  }, [selectedLassoIds, pushHistory]);

  const handleRecolorLassoSelected = useCallback(
    (newColor: string) => {
      if (selectedLassoIds.length === 0) return;
      pushHistory(docRef.current);
      const selSet = new Set(selectedLassoIds);
      setDoc((prev) => ({
        ...prev,
        inkStrokes: (prev.inkStrokes ?? []).map((s) =>
          selSet.has(s.id) ? { ...s, color: newColor } : s
        ),
        updatedAt: Date.now(),
      }));
      void hapticLight();
    },
    [selectedLassoIds, pushHistory]
  );

  const handleCyclePaperStyle = useCallback(() => {
    const order: PaperStyleType[] = ['dots', 'grid', 'lined', 'blank', 'warm'];
    void hapticLight();
    setDoc((prev) => {
      const cur = prev.paperStyle ?? 'dots';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      return { ...prev, paperStyle: next, updatedAt: Date.now() };
    });
  }, []);

  const handleAddStickyNote = useCallback(() => {
    pushHistory(docRef.current);
    const existing = docRef.current.stickyNotes ?? [];
    const pastelColors = ['#FEF08A', '#BBF7D0', '#BAE6FD', '#FBCFE8', '#DDD6FE'];
    const root = docRef.current.nodes[docRef.current.rootNodeId];
    const offset = (existing.length % 5) * 28;
    const newNote: CanvasStickyNote = {
      id: `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: Math.round((root?.x ?? 0) + 210 + offset),
      y: Math.round((root?.y ?? 0) - 140 + offset),
      text: '',
      color: pastelColors[existing.length % pastelColors.length],
      width: 204,
    };
    setDoc((prev) => ({
      ...prev,
      stickyNotes: [...(prev.stickyNotes ?? []), newNote],
      updatedAt: Date.now(),
    }));
    void hapticSuccess();
  }, [pushHistory]);

  const handleUpdateStickyNote = useCallback(
    (noteId: string, patch: Partial<CanvasStickyNote>) => {
      setDoc((prev) => ({
        ...prev,
        stickyNotes: (prev.stickyNotes ?? []).map((n) =>
          n.id === noteId ? { ...n, ...patch } : n
        ),
        updatedAt: Date.now(),
      }));
    },
    []
  );

  const handleDeleteStickyNote = useCallback(
    (noteId: string) => {
      pushHistory(docRef.current);
      setDoc((prev) => ({
        ...prev,
        stickyNotes: (prev.stickyNotes ?? []).filter((n) => n.id !== noteId),
        updatedAt: Date.now(),
      }));
      void hapticLight();
    },
    [pushHistory]
  );

  const handleUndoInkStroke = useCallback(() => {
    const existing = docRef.current.inkStrokes ?? [];
    if (existing.length === 0) return;
    pushHistory(docRef.current);
    setDoc((prev) => ({
      ...prev,
      inkStrokes: (prev.inkStrokes ?? []).slice(0, -1),
      updatedAt: Date.now(),
    }));
  }, [pushHistory]);

  const handleClearAllInk = useCallback(() => {
    const existing = docRef.current.inkStrokes ?? [];
    if (existing.length === 0) return;
    pushHistory(docRef.current);
    setSelectedLassoIds([]);
    setDoc((prev) => ({
      ...prev,
      inkStrokes: [],
      updatedAt: Date.now(),
    }));
  }, [pushHistory]);

  const handleReparentNode = useCallback(
    (nodeId: string, newParentId: string) => {
      const curDoc = docRef.current;
      if (nodeId === curDoc.rootNodeId || nodeId === newParentId) return;
      const moving = curDoc.nodes[nodeId];
      const newParent = curDoc.nodes[newParentId];
      if (!moving || !newParent || moving.parentId === newParentId) return;

      // Cycle guard: ensure `newParentId` is NOT inside `nodeId`'s subtree
      let walk: string | null | undefined = newParent.parentId;
      while (walk) {
        if (walk === nodeId) return;
        walk = curDoc.nodes[walk]?.parentId;
      }

      pushHistory(curDoc);
      const nextColor = resolveNewBranchColor(newParent, curDoc.nodes, curDoc.rootNodeId);
      // Collect subtree of `nodeId` to harmonize its branch color
      const subtreeIds = new Set<string>([nodeId]);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const n of Object.values(curDoc.nodes)) {
          if (n.parentId && subtreeIds.has(n.parentId) && !subtreeIds.has(n.id)) {
            subtreeIds.add(n.id);
            expanded = true;
          }
        }
      }

      setIsAutoLayoutAnimating(true);
      setDoc((prev) => {
        const nextNodes: Record<string, MindNode> = { ...prev.nodes };
        if (nextNodes[newParentId]?.collapsed) {
          nextNodes[newParentId] = { ...nextNodes[newParentId], collapsed: false };
        }
        for (const id of subtreeIds) {
          const item = nextNodes[id];
          if (!item) continue;
          nextNodes[id] = {
            ...item,
            parentId: id === nodeId ? newParentId : item.parentId,
            branchColor: nextColor,
          };
        }
        return {
          ...prev,
          nodes: computeMindMapLayout(
            nextNodes,
            prev.rootNodeId,
            prev.layoutType ?? 'radial'
          ),
          updatedAt: Date.now(),
        };
      });
      setSelectedNodeId(nodeId);
      window.setTimeout(() => setIsAutoLayoutAnimating(false), 380);
    },
    [pushHistory]
  );

  const handleMarkNodesForReview = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds.length) return;
      pushHistory(docRef.current);
      setDoc((prev) => {
        const nextNodes = { ...prev.nodes };
        for (const id of nodeIds) {
          if (nextNodes[id]) {
            nextNodes[id] = { ...nextNodes[id], priorityTag: 'review' };
          }
        }
        return {
          ...prev,
          nodes: nextNodes,
          updatedAt: Date.now(),
        };
      });
    },
    [pushHistory]
  );

  const searchMatchIdSet = useMemo(
    () => (findBarOpen && findQuery.trim() ? new Set(findMatchIds) : undefined),
    [findBarOpen, findMatchIds, findQuery]
  );
  const activeSearchMatchId =
    findBarOpen && findQuery.trim() && findMatchIds.length > 0
      ? findMatchIds[
          ((findActiveIndex % findMatchIds.length) + findMatchIds.length) %
            findMatchIds.length
        ] ?? null
      : null;

  const handleFindJumpToNode = useCallback((node: MindNode) => {
    setSelectedNodeId(node.id);
    setRadarJump((prev) => ({
      x: node.x,
      y: node.y,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  const defaultNodeStyle: NodeVisualStyle = doc.defaultNodeStyle ?? 'card';
  const activeEditNode = editingNodeId ? doc.nodes[editingNodeId] ?? null : null;
  const activeStudioNode = drawingMode
    ? null
    : activeEditNode ??
      (examMode === 'off' && !linkingFromNodeId && selectedNodeId
        ? doc.nodes[selectedNodeId] ?? null
        : null);
  const targetModalNodeId = editingNodeId ?? selectedNodeId ?? doc.rootNodeId;
  const targetModalNode =
    doc.nodes[targetModalNodeId] ?? doc.nodes[doc.rootNodeId];

  return (
    <main className="relative h-[100dvh] w-[100vw] overflow-hidden select-none">
      {/* Screen A: Commercial "Haritalarım" Workspace Library */}
      {activeScreen === 'home' ? (
        <HomeWorkspace
          maps={savedMaps}
          activeMapId={doc.id}
          customFolders={customFolders}
          onCreateCustomFolder={handleCreateCustomFolder}
          onDeleteCustomFolder={handleDeleteCustomFolder}
          onOpenMap={(mapToOpen) => openMapOnCanvas(mapToOpen, false)}
          onCreateBlankMap={handleCreateBlankMap}
          onCreateBlankFlowchart={handleCreateBlankFlowchart}
          onCreateFromTemplate={handleCreateFromTemplate}
          onCreateFromFlowchartTemplate={handleCreateFromFlowchartTemplate}
          onOpenSmartMapGenerator={() =>
            handleRequestOpenSmartGenerator('text_to_map', true)
          }
          onRenameMap={handleRenameMapById}
          onDuplicateMap={handleDuplicateMap}
          onTogglePinMap={handleTogglePinMap}
          onChangeMapFolder={handleChangeMapFolder}
          onMoveToTrash={handleMoveToTrash}
          onRestoreFromTrash={handleRestoreFromTrash}
          onDeletePermanently={handleDeletePermanently}
          onImportZihinFile={handleImportZihinRaw}
          onOpenGuide={() => setShowOnboarding(true)}
          onOpenSettings={() => {
            setSettingsInitialLegal(null);
            setSettingsOpen(true);
          }}
          onTriggerPaywall={(reason) => openPaywall(reason, null)}
          onStartDueFlashcards={(targetMap) => {
            openMapOnCanvas(targetMap, false);
            window.setTimeout(() => setFlashcardsOpen(true), 120);
          }}
        />
      ) : doc.documentType === 'flowchart' ? (
        <>
          {/* Screen C: Dedicated Flowchart & Process Diagram Studio */}
          <FlowchartWorkspace
            doc={doc}
            darkMode={Boolean(doc.darkMode)}
            onChangeDoc={(updater, recordHistory = true) => {
              if (recordHistory) pushHistory(doc);
              setDoc((prev) => ({
                ...updater(prev),
                updatedAt: Date.now(),
              }));
            }}
            onNavigateHome={() => void handleNavigateHome()}
            onToggleDarkMode={() => {
              const nextDark = !doc.darkMode;
              setThemePref(nextDark ? 'dark' : 'light');
            }}
            onOpenExport={() => setExportOpen(true)}
            onOpenSettings={() => {
              setSettingsInitialLegal(null);
              setSettingsOpen(true);
            }}
            canUndo={pastDocs.length > 0}
            canRedo={futureDocs.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />

          <ExportSheet
            isOpen={exportOpen}
            onClose={() => setExportOpen(false)}
            document={doc}
            collaborators={collaborators}
            onImportDocument={(imported) => {
              void handleImportMapsBatch([imported]);
            }}
            onTriggerPaywall={(reason) => openPaywall(reason, null)}
            onExportSuccess={() => {
              void BillingService.recordDelightMomentAndMaybeRequestReview();
            }}
          />
        </>
      ) : (
        <>
          {/* Screen B: 60/120 FPS Zero-Jitter Visual Mind Map Canvas */}
          {!presentationOpen && (
            <TopMinimalHUD
            mapTitle={doc.title}
            department={doc.department}
            contextEmoji={mapContext.emoji}
            defaultNodeStyle={defaultNodeStyle}
            paperStyle={doc.paperStyle ?? 'dots'}
            layoutType={doc.layoutType ?? 'radial'}
            colorTheme={doc.colorTheme}
            onChangeLayoutType={handleChangeLayoutType}
            onApplyStudioTheme={handleApplyStudioTheme}
            onConvertToFlowchart={() => void handleConvertActiveMapToFlowchart()}
            onOpenFlashcards={() => setFlashcardsOpen(true)}
            onOpenQuiz={() => setQuizOpen(true)}
            onOpenCanvasFind={() => setFindBarOpen(true)}
            onStartPresentation={() => {
              setDrawingMode(false);
              setEditingNodeId(null);
              setFocusMode(true);
              setPresentationOpen(true);
            }}
            onToggleDefaultNodeStyle={handleToggleDefaultNodeStyle}
            onCyclePaperStyle={handleCyclePaperStyle}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenOutline={() => setOutlineOpen(true)}
            onOpenGuide={() => setShowOnboarding(true)}
            onRenameMap={(newTitle) => {
              pushHistory(doc);
              setDoc((prev) => {
                const root = prev.nodes[prev.rootNodeId];
                const shouldClearRootSub =
                  root &&
                  Boolean(
                    root.subtitleIsTemplateDefault ||
                      (root.subtitle &&
                        KNOWN_TEMPLATE_SUBTITLES.has(root.subtitle.trim()))
                  );
                const shouldClearRootBadge =
                  root &&
                  Boolean(
                    root.techBadge &&
                      KNOWN_TEMPLATE_TECH_BADGES.has(root.techBadge.trim())
                  );

                return {
                  ...prev,
                  title: newTitle,
                  nodes: root
                    ? {
                        ...prev.nodes,
                        [prev.rootNodeId]: {
                          ...root,
                          title: newTitle,
                          subtitle: shouldClearRootSub
                            ? undefined
                            : root.subtitle,
                          subtitleIsTemplateDefault: shouldClearRootSub
                            ? false
                            : root.subtitleIsTemplateDefault,
                          techBadge: shouldClearRootBadge
                            ? undefined
                            : root.techBadge,
                        },
                      }
                    : prev.nodes,
                  updatedAt: Date.now(),
                };
              });
            }}
            onNavigateHome={() => void handleNavigateHome()}
            onOpenSettings={() => {
              setSettingsInitialLegal(null);
              setSettingsOpen(true);
            }}
            onTriggerPaywall={(reason) => openPaywall(reason, null)}
            onOpenSmartGenerator={() =>
              handleRequestOpenSmartGenerator('text_to_map', false)
            }
            drawingMode={drawingMode}
            onToggleDrawingMode={handleToggleDrawingMode}
            onExitDrawingMode={() => {
              setDrawingMode(false);
              setSelectedLassoIds([]);
            }}
            focusModeActive={focusMode}
            onToggleFocusMode={() => {
              void hapticLight();
              setFocusMode((v) => !v);
            }}
            examMode={examMode}
            onChangeExamMode={(mode) => {
              void hapticLight();
              setExamMode(mode);
              setRevealedExamIds(new Set());
              if (mode !== 'off') {
                setEditingNodeId(null);
              }
            }}
            examStats={examStats}
            onResetExamReveals={() => setRevealedExamIds(new Set())}
            onAutoLayout={handleAutoLayout}
            onFitToScreen={() => setFitTrigger((n) => n + 1)}
            darkMode={Boolean(doc.darkMode)}
            onToggleDarkMode={() => {
              const nextDark = !doc.darkMode;
              setThemePref(nextDark ? 'dark' : 'light');
            }}
            canUndo={pastDocs.length > 0}
            canRedo={futureDocs.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            collaborators={collaborators}
            onOpenExport={() => setExportOpen(true)}
            zoomPercent={zoomPercent}
          />
          )}

          <CanvasStage
            nodes={doc.nodes}
            crossLinks={doc.crossLinks}
            inkStrokes={doc.inkStrokes}
            stickyNotes={doc.stickyNotes}
            paperStyle={doc.paperStyle ?? 'dots'}
            drawingMode={drawingMode}
            inkTool={inkTool}
            eraserMode={eraserMode}
            autoShapeEnabled={autoShapeEnabled}
            inkColor={inkColor}
            inkWidth={inkWidth}
            stylusOnly={stylusOnly}
            hardwareEraserActive={hardwareEraserActive}
            selectedLassoIds={selectedLassoIds}
            onAddInkStroke={handleAddInkStroke}
            onDeleteInkStroke={handleDeleteInkStroke}
            onReplaceInkStrokes={handleReplaceInkStrokes}
            onPushInkHistory={handlePushInkHistory}
            onSelectLassoIds={setSelectedLassoIds}
            onUpdateStickyNote={handleUpdateStickyNote}
            onDeleteStickyNote={handleDeleteStickyNote}
            rootNodeId={doc.rootNodeId}
            department={doc.department}
            darkMode={Boolean(doc.darkMode)}
            defaultNodeStyle={defaultNodeStyle}
            spacePressed={spacePressed}
            isAutoLayoutAnimating={isAutoLayoutAnimating}
            selectedNodeId={selectedNodeId}
            editingNodeId={editingNodeId}
            linkingFromNodeId={linkingFromNodeId}
            focusMode={focusMode}
            examMode={examMode}
            revealedExamIds={revealedExamIds}
            collaborators={collaborators}
            fitTrigger={fitTrigger}
            zoomRequest={zoomRequest}
            radarJumpRequest={radarJump}
            onSelectNode={setSelectedNodeId}
            onStartEditing={handleStartEditing}
            onFinishEditing={handleFinishEditing}
            onUpdateNodeTitle={handleUpdateNodeTitle}
            onDeleteNode={handleDeleteNode}
            onToggleNodeCheck={handleToggleNodeCheck}
            onCyclePriorityTag={handleCycleNodePriorityTag}
            onToggleNoteCollapse={handleToggleNodeNoteCollapse}
            onStartCrossLink={handleStartCrossLink}
            onOpenStickerGallery={handleOpenStickerGallery}
            onOpenHandwritingEditor={handleOpenHandwritingEditor}
            onResizeNodeVisual={handleResizeNodeVisual}
            onCommitBatchNodePositions={handleCommitBatchNodePositions}
            onReparentNode={handleReparentNode}
            searchMatchIds={searchMatchIdSet}
            activeSearchMatchId={activeSearchMatchId}
            onCreateChildBranch={handleCreateChildBranch}
            onCompleteCrossLink={handleCompleteCrossLink}
            onCancelCrossLink={handleCancelCrossLink}
            onUpdateCrossLinkLabel={handleUpdateCrossLinkLabel}
            onDeleteCrossLink={handleDeleteCrossLink}
            onToggleCollapse={handleToggleCollapse}
            onRevealExamNode={handleRevealExamNode}
            onPointerWorldMove={handlePointerWorldMove}
            onZoomChange={setZoomPercent}
            onViewportSnapshot={handleViewportSnapshot}
            onActiveNodeScreenPosition={setActiveNodeScreenPos}
          />

          <MiniMapRadar
            nodes={doc.nodes}
            rootNodeId={doc.rootNodeId}
            hiddenNodeIds={radarSnap.hiddenIds}
            viewport={radarSnap.vp}
            stageWidth={radarSnap.w}
            stageHeight={radarSnap.h}
            isObstructedByBottomBar={Boolean(activeStudioNode) || drawingMode}
            onJumpToWorldPoint={(wx, wy) => {
              setRadarJump((prev) => ({
                x: wx,
                y: wy,
                seq: (prev?.seq ?? 0) + 1,
              }));
            }}
          />

          <KeyboardVisualBar
            activeNode={activeStudioNode}
            isEditingText={Boolean(activeEditNode)}
            isRootNode={activeStudioNode?.id === doc.rootNodeId}
            isMainBranch={activeStudioNode?.parentId === doc.rootNodeId}
            defaultNodeStyle={defaultNodeStyle}
            mapContext={mapContext}
            proactiveSuggestions={proactiveSuggestions}
            nodeScreenPos={activeNodeScreenPos}
            onUpdateNodeTitle={handleUpdateNodeTitle}
            onUpdateNodeNote={handleUpdateNodeNote}
            onUpdateNodeLink={handleUpdateNodeLink}
            onToggleNodeCheck={handleToggleNodeCheck}
            onChangePriorityTag={handleChangeNodePriorityTag}
            onRequestEditTitle={() => {
              if (activeStudioNode) {
                setEditingNodeId(activeStudioNode.id);
              }
            }}
            onAddChildBranch={(parentId) => {
              const parent = doc.nodes[parentId];
              if (!parent) return;
              const pos = findBestOpenBranchPosition(
                parent,
                doc.nodes,
                doc.rootNodeId
              );
              const col = resolveNewBranchColor(parent, doc.nodes, doc.rootNodeId);
              handleCreateChildBranch(parent.id, pos.x, pos.y, col);
            }}
            onApplySticker={handleApplySticker}
            onRequestProStickerUnlock={(item) => openPaywall('pro_sticker', item)}
            onApplyProactiveSuggestion={handleApplyProactiveSuggestion}
            onUpdateTechBadge={handleUpdateNodeTechBadge}
            onChangeStickerSize={handleChangeStickerSize}
            onResizeNodeVisual={handleResizeNodeVisual}
            onChangeNodeStyle={handleChangeNodeStyle}
            onRemoveSticker={handleRemoveSticker}
            onChangeBranchColor={handleChangeBranchColor}
            onDeleteNode={handleDeleteNode}
            onOpenGalleryDrawer={(customQuery) => {
              setStickerDrawerCustomQuery(customQuery ?? null);
              setStickerDrawerOpen(true);
            }}
            onOpenAIStudio={(customQuery) =>
              handleRequestOpenAIStudio(customQuery || activeStudioNode?.title || null)
            }
            onOpenNoteCropper={handleRequestOpenNoteCropper}
            onOpenQuickSketch={() => setSketchPopoverOpen(true)}
            onOpenHandwriting={() => {
              setEditingNodeId(null);
              setHandwritingModalOpen(true);
            }}
            onClearHandwriting={handleClearNodeHandwriting}
            onStartCrossLink={(fromId) => setLinkingFromNodeId(fromId)}
            onOpenSmartSubBranches={() =>
              handleRequestOpenSmartGenerator('proactive_branches', false)
            }
            onCloseEdit={() => {
              handleFinishEditing();
              setSelectedNodeId(null);
            }}
          />

          {/* Instant 1-Tap Undo Toast after Deleting a Branch */}
          {deletedToast && (
            <div
              data-testid="delete-undo-toast"
              className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
              style={{ top: 'max(68px, calc(var(--safe-top) + 60px))' }}
            >
              <div className="pointer-events-auto inline-flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-slate-900/95 px-3.5 py-2 text-xs font-extrabold text-white shadow-xl backdrop-blur-md">
                <Trash2 className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span className="max-w-[200px] truncate">
                  “{deletedToast.label}”
                  {deletedToast.count > 1 ? ` (+${deletedToast.count - 1} alt dal)` : ''} silindi
                </span>
                <button
                  type="button"
                  data-testid="delete-undo-btn"
                  onClick={() => {
                    if (deleteToastTimerRef.current !== null) {
                      window.clearTimeout(deleteToastTimerRef.current);
                      deleteToastTimerRef.current = null;
                    }
                    setDeletedToast(null);
                    handleUndo();
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-2.5 py-1 text-xs font-black text-white shadow-xs active:scale-95"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  <span>Geri Al</span>
                </button>
              </div>
            </div>
          )}

          {/* Compact 1-Handed Mobile/Tablet Right-Edge Zoom (+/-) & Quick Undo Controls */}
          {!kbInset.isKeyboardOpen && examMode === 'off' && (
            <div
              className="pointer-events-auto fixed right-2.5 z-20 flex flex-col items-center gap-1 rounded-2xl border p-1 shadow-lg lg:hidden"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
                bottom: activeStudioNode
                  ? `${Math.max(250, kbInset.studioBarHeight + 36)}px`
                  : drawingMode
                  ? 'max(142px, calc(var(--safe-bottom) + 136px))'
                  : 'max(88px, calc(var(--safe-bottom) + 84px))',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setZoomRequest((prev) => ({ factor: 1.24, seq: (prev?.seq ?? 0) + 1 }))
                }
                title="Yakınlaştır"
                aria-label="Yakınlaştır"
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/12 active:scale-95"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoomRequest((prev) => ({ factor: 0.8, seq: (prev?.seq ?? 0) + 1 }))
                }
                title="Uzaklaştır"
                aria-label="Uzaklaştır"
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/12 active:scale-95"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <div className="h-px w-5 bg-slate-400/25" />
              <button
                type="button"
                onClick={() => setFitTrigger((n) => n + 1)}
                title="Haritayı Ortala"
                aria-label="Haritayı Ortala"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-600 hover:bg-emerald-500/12 active:scale-95 dark:text-emerald-400"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              {pastDocs.length > 0 && (
                <>
                  <div className="h-px w-5 bg-slate-400/25" />
                  <button
                    type="button"
                    onClick={handleUndo}
                    title="Geri Al"
                    aria-label="Geri Al"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-sky-600 hover:bg-sky-500/12 active:scale-95 dark:text-sky-400"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )}

          <CanvasDrawingToolbar
            isOpen={drawingMode}
            activeTool={inkTool}
            eraserMode={eraserMode}
            autoShapeEnabled={autoShapeEnabled}
            inkColor={inkColor}
            strokeWidth={inkWidth}
            stylusOnly={stylusOnly}
            paperStyle={doc.paperStyle ?? 'dots'}
            hardwareEraserActive={hardwareEraserActive}
            strokeCount={(doc.inkStrokes ?? []).length}
            selectedLassoCount={selectedLassoIds.length}
            onChangeTool={handleChangeInkTool}
            onToggleEraserMode={() =>
              setEraserMode((m) => (m === 'stroke' ? 'area' : 'stroke'))
            }
            onToggleAutoShape={() => setAutoShapeEnabled((v) => !v)}
            onChangeColor={setInkColor}
            onChangeWidth={setInkWidth}
            onToggleStylusOnly={() => setStylusOnly((v) => !v)}
            onCyclePaperStyle={handleCyclePaperStyle}
            onAddStickyNote={handleAddStickyNote}
            onDeleteLassoSelected={handleDeleteLassoSelected}
            onRecolorLassoSelected={handleRecolorLassoSelected}
            onUndoInk={handleUndoInkStroke}
            onClearAllInk={handleClearAllInk}
            onClose={() => {
              setDrawingMode(false);
              setSelectedLassoIds([]);
            }}
          />

          {/* Mobile & Tablet Thumb-Reachable Bottom Quick-Action Pill (When idle) */}
          {!drawingMode &&
            !selectedNodeId &&
            !editingNodeId &&
            !linkingFromNodeId &&
            examMode === 'off' && (
              <div
                className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-2.5 lg:hidden"
                style={{ paddingBottom: 'max(24px, calc(var(--safe-bottom) + 20px))' }}
              >
                <div
                  className="no-scrollbar pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border px-2 py-1.5 text-xs font-extrabold whitespace-nowrap shadow-xl"
                  style={{
                    backgroundColor: 'var(--hud-bg)',
                    borderColor: 'var(--hud-border)',
                    touchAction: 'pan-x',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const root = doc.nodes[doc.rootNodeId];
                      if (!root) return;
                      const pos = findBestOpenBranchPosition(
                        root,
                        doc.nodes,
                        doc.rootNodeId
                      );
                      const col = resolveNewBranchColor(
                        root,
                        doc.nodes,
                        doc.rootNodeId
                      );
                      handleCreateChildBranch(root.id, pos.x, pos.y, col);
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-sky-500 px-3 py-1.5 text-white shadow-xs active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Yeni Dal</span>
                  </button>
                  <button
                    type="button"
                    data-testid="mobile-draw-toggle-btn"
                    onClick={handleToggleDrawingMode}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-indigo-500/15 px-2.5 py-1.5 text-indigo-700 hover:bg-indigo-500/25 active:scale-95 dark:text-indigo-300"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    <span>Çiz</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoLayout}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-slate-500/10 active:scale-95"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Düzenle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitTrigger((n) => n + 1)}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-slate-500/10 active:scale-95"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Merkez</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-slate-500/10 active:scale-95"
                  >
                    <Search className="h-3.5 w-3.5 text-violet-500" />
                    <span>İkon Ara</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutlineOpen(true)}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-slate-500/10 active:scale-95"
                  >
                    <ListTree className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Anahat</span>
                  </button>
                </div>
              </div>
            )}

          <StickerGalleryDrawer
            isOpen={stickerDrawerOpen}
            initialQuery={
              stickerDrawerCustomQuery ?? targetModalNode?.title ?? ''
            }
            branchColor={targetModalNode?.branchColor ?? '#0EA5E9'}
            currentStickerSize={targetModalNode?.stickerSize ?? 'md'}
            onChangeStickerSize={(sz) =>
              handleChangeStickerSize(targetModalNodeId, sz)
            }
            mapContext={mapContext}
            onClose={() => {
              setStickerDrawerOpen(false);
              setStickerDrawerCustomQuery(null);
            }}
            onApplySticker={(sticker) =>
              handleApplySticker(targetModalNodeId, sticker)
            }
            onRequestProStickerUnlock={(item) => openPaywall('pro_sticker', item)}
            onOpenAIStudio={(customQuery) =>
              handleRequestOpenAIStudio(customQuery)
            }
          />

          <OutlineModal
            isOpen={outlineOpen}
            nodes={doc.nodes}
            rootNodeId={doc.rootNodeId}
            onClose={() => setOutlineOpen(false)}
            onUpdateNodeTitle={handleUpdateNodeTitle}
            onUpdateNodeNote={handleUpdateNodeNote}
            onToggleNodeCheck={handleToggleNodeCheck}
            onAddChildBranch={(parentId) => {
              const parent = doc.nodes[parentId];
              if (!parent) return;
              const pos = findBestOpenBranchPosition(
                parent,
                doc.nodes,
                doc.rootNodeId
              );
              const col = resolveNewBranchColor(
                parent,
                doc.nodes,
                doc.rootNodeId
              );
              handleCreateChildBranch(parent.id, pos.x, pos.y, col);
            }}
            onOpenStickerPickerForNode={(nodeId) => {
              setSelectedNodeId(nodeId);
              setStickerDrawerOpen(true);
            }}
            onJumpToNode={(node) => {
              setSelectedNodeId(node.id);
              setRadarJump((prev) => ({
                x: node.x,
                y: node.y,
                seq: (prev?.seq ?? 0) + 1,
              }));
            }}
          />

          <CommandPaletteModal
            isOpen={commandPaletteOpen}
            nodes={doc.nodes}
            rootNodeId={doc.rootNodeId}
            selectedNodeId={selectedNodeId}
            defaultNodeStyle={defaultNodeStyle}
            mapContext={mapContext}
            onClose={() => setCommandPaletteOpen(false)}
            onJumpToNode={(node) => {
              setSelectedNodeId(node.id);
              setRadarJump((prev) => ({
                x: node.x,
                y: node.y,
                seq: (prev?.seq ?? 0) + 1,
              }));
            }}
            onApplyStickerToActive={(sticker) =>
              handleApplySticker(targetModalNodeId, sticker)
            }
            onRequestProStickerUnlock={(item) => openPaywall('pro_sticker', item)}
            onCreateBranchWithSticker={handleCreateBranchWithSticker}
            onAutoLayout={handleAutoLayout}
            onFitToScreen={() => setFitTrigger((n) => n + 1)}
            onToggleDefaultNodeStyle={handleToggleDefaultNodeStyle}
          />

          <AIStickerStudioModal
            isOpen={aiStudioOpen}
            initialConcept={
              aiStudioInitialQuery ?? targetModalNode?.title ?? doc.title
            }
            department={doc.department}
            mapContext={mapContext}
            branchColor={targetModalNode?.branchColor ?? '#0EA5E9'}
            onClose={() => {
              setAiStudioOpen(false);
              setAiStudioInitialQuery(null);
            }}
            onApplySticker={(sticker) => {
              EntitlementManager.recordAiStickerUsed();
              handleApplySticker(targetModalNodeId, sticker);
            }}
          />

          <NoteCropperModal
            isOpen={noteCropperOpen}
            onClose={() => setNoteCropperOpen(false)}
            onApplySticker={(sticker) => {
              EntitlementManager.recordNoteCropUsed();
              handleApplySticker(targetModalNodeId, sticker);
            }}
          />

          <QuickSketchPopover
            isOpen={sketchPopoverOpen}
            nodeTitle={targetModalNode?.title ?? doc.title}
            onClose={() => setSketchPopoverOpen(false)}
            onApplySticker={(sticker) =>
              handleApplySticker(targetModalNodeId, sticker)
            }
            onOpenAIStudio={() =>
              handleRequestOpenAIStudio(targetModalNode?.title ?? doc.title)
            }
          />

          <HandwrittenConceptModal
            isOpen={handwritingModalOpen}
            darkMode={Boolean(doc.darkMode)}
            nodeTitle={targetModalNode?.title ?? doc.title}
            branchColor={targetModalNode?.branchColor ?? '#0EA5E9'}
            initialHandwriting={targetModalNode?.handwriting ?? null}
            onClose={() => setHandwritingModalOpen(false)}
            onApplyHandwriting={(asset, optionalTitle) =>
              handleApplyNodeHandwriting(targetModalNodeId, asset, optionalTitle)
            }
            onClearHandwriting={() =>
              handleClearNodeHandwriting(targetModalNodeId)
            }
          />

          <ExportSheet
            isOpen={exportOpen}
            onClose={() => setExportOpen(false)}
            document={doc}
            collaborators={collaborators}
            onImportDocument={(imported) => {
              void handleImportMapsBatch([imported]);
            }}
            onTriggerPaywall={(reason) => openPaywall(reason, null)}
            onExportSuccess={() => {
              void BillingService.recordDelightMomentAndMaybeRequestReview();
            }}
          />

          <CanvasFindBar
            isOpen={findBarOpen}
            query={findQuery}
            nodes={doc.nodes}
            activeIndex={findActiveIndex}
            onQueryChange={setFindQuery}
            onActiveIndexChange={setFindActiveIndex}
            onMatchesComputed={setFindMatchIds}
            onJumpToNode={handleFindJumpToNode}
            onClose={() => {
              setFindBarOpen(false);
              setFindQuery('');
              setFindMatchIds([]);
            }}
          />

          <FlashcardStudyModal
            isOpen={flashcardsOpen}
            doc={doc}
            onClose={() => setFlashcardsOpen(false)}
            onSessionComplete={() => {
              void BillingService.recordDelightMomentAndMaybeRequestReview();
            }}
            onStartQuiz={() => setQuizOpen(true)}
          />

          <MapQuizModal
            isOpen={quizOpen}
            doc={doc}
            onClose={() => setQuizOpen(false)}
            onMarkNodesForReview={handleMarkNodesForReview}
            onQuizComplete={() => {
              void BillingService.recordDelightMomentAndMaybeRequestReview();
            }}
          />

          <PresentationOverlay
            isOpen={presentationOpen}
            doc={doc}
            onFocusNode={handleFocusPresentationNode}
            onClose={() => {
              setPresentationOpen(false);
              setFocusMode(false);
            }}
          />
        </>
      )}

      {/* Shared Modals Available Across Both Home & Canvas */}
      <SmartMapGeneratorModal
        isOpen={smartGenModal.open}
        initialTab={smartGenModal.tab}
        activeNode={targetModalNode ?? null}
        mapContext={mapContext}
        existingSiblingTitles={existingSiblingTitles}
        onTriggerPaywall={(reason) => openPaywall(reason)}
        onClose={() => setSmartGenModal((s) => ({ ...s, open: false }))}
        onGenerateCompleteMap={(generatedDoc) => {
          void (async () => {
            if (!EntitlementManager.canCreateActiveMap(activeMapsCount)) {
              openPaywall('map_limit');
              return;
            }
            EntitlementManager.recordSmartMapUsed();
            const prepared: MindMapDocument = {
              ...generatedDoc,
              id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              updatedAt: Date.now(),
              darkMode:
                themePref === 'dark' ||
                (themePref === 'system' &&
                  window.matchMedia('(prefers-color-scheme: dark)').matches),
            };
            prepared.thumbnailDataUrl = generateMapThumbnailDataUrl(prepared);
            await LocalStore.saveMap(prepared, { forceSnapshot: true });
            setSavedMaps(await LocalStore.listMaps());
            openMapOnCanvas(prepared, false);
          })();
        }}
        onAddProactiveBranches={handleAddProactiveBranches}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsInitialLegal(null);
        }}
        themePref={themePref}
        onChangeThemePref={setThemePref}
        defaultNodeStyle={defaultNodeStyle}
        onChangeDefaultNodeStyle={handleSetDefaultNodeStyle}
        activeMap={doc}
        onRestoreMapSnapshot={(restoredDoc) => {
          openMapOnCanvas(restoredDoc, false);
        }}
        onImportBackupMaps={handleImportMapsBatch}
        onTriggerPaywall={(reason) => {
          setSettingsOpen(false);
          openPaywall(reason, null);
        }}
        onOpenGuide={() => setShowOnboarding(true)}
        initialLegalDoc={settingsInitialLegal}
      />

      <LifetimePaywallModal
        isOpen={paywallState.open}
        triggerReason={paywallState.reason}
        previewSticker={paywallState.previewSticker}
        previewBranchColor={targetModalNode?.branchColor ?? '#0EA5E9'}
        previewNodeTitle={targetModalNode?.title || doc.title}
        onClose={() =>
          setPaywallState((prev) => ({
            ...prev,
            open: false,
            previewSticker: null,
          }))
        }
        onUnlocked={(unlockedSticker) => {
          setPaywallState((prev) => ({
            ...prev,
            open: false,
            previewSticker: null,
          }));
          if (unlockedSticker && activeScreen === 'canvas') {
            void VisualSearchOrchestrator.materializeStickerSelection(
              unlockedSticker,
              {
                retintToBranchColor: targetModalNode?.branchColor ?? '#0EA5E9',
              }
            ).then((asset) => {
              handleApplySticker(targetModalNodeId, asset);
            });
          }
        }}
        onOpenLegalPage={(page) => {
          setPaywallState((prev) => ({ ...prev, open: false }));
          setSettingsInitialLegal(page);
          setSettingsOpen(true);
        }}
      />

      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}
    </main>
  );
};

export default App;
