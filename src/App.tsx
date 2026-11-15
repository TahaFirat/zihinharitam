import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Link2,
  Wand2,
  Plus,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import type {
  AcademicDepartment,
  CollaboratorPresence,
  CrossLink,
  ExamRecallMode,
  MindMapDocument,
  MindMapFolder,
  MindNode,
  NodeVisualStyle,
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
import { LocalStore } from './core/sync/LocalStore';
import { RealtimeCollabSession } from './core/sync/RealtimeCollab';
import {
  computeRadialAutoLayout,
  computeTreeMeta,
  findBestOpenBranchPosition,
  resolveNewBranchColor,
} from './core/canvas/RadialAutoLayout';
import { generateMapThumbnailDataUrl } from './core/canvas/ThumbnailGenerator';
import { EntitlementManager } from './core/monetization/EntitlementManager';
import { TopicContextIntelligence } from './core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from './core/visuals/VisualSearchOrchestrator';
import { CanvasStage } from './components/CanvasStage';
import { TopMinimalHUD } from './components/TopMinimalHUD';
import { KeyboardVisualBar } from './components/KeyboardVisualBar';
import { StickerGalleryDrawer } from './components/StickerGalleryDrawer';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AIStickerStudioModal } from './components/AIStickerStudioModal';
import { SmartMapGeneratorModal } from './components/SmartMapGeneratorModal';
import { MiniMapRadar } from './components/MiniMapRadar';
import { NoteCropperModal } from './components/NoteCropperModal';
import { QuickSketchPopover } from './components/QuickSketchPopover';
import { ExportSheet } from './components/ExportSheet';
import { HomeWorkspace } from './components/HomeWorkspace';
import { LifetimePaywallModal } from './components/LifetimePaywallModal';
import {
  OnboardingOverlay,
  ONBOARDING_STORAGE_KEY,
} from './components/OnboardingOverlay';
import {
  SettingsModal,
  type ThemePreference,
} from './components/SettingsModal';
import { hapticLight, hapticMedium, hapticSuccess } from './core/native/NativeBridge';

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
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1';
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
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
  const [exportOpen, setExportOpen] = useState(false);
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

  // Undo / Redo History
  const [pastDocs, setPastDocs] = useState<MindMapDocument[]>([]);
  const [futureDocs, setFutureDocs] = useState<MindMapDocument[]>([]);

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
        await LocalStore.purgeExpiredTrash(30);
        let existing = await LocalStore.listMaps();

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

  // Debounced auto-save with `<6ms` WebP thumbnail refresh
  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (doc.deletedAt) return;

    // Do not overwrite user library with ephemeral URL `?tpl=` preview maps unless saved maps already contain `doc.id`
    const params = new URLSearchParams(window.location.search);
    const isEphemeralTplPreview =
      Boolean(params.get('tpl')) &&
      doc.id.startsWith('tpl_') &&
      doc.id !== 'tpl_sistem_tasarimi';

    const timer = window.setTimeout(async () => {
      if (isEphemeralTplPreview) return;
      const thumb = generateMapThumbnailDataUrl(doc);
      const docWithThumb: MindMapDocument = thumb
        ? { ...doc, thumbnailDataUrl: thumb }
        : doc;
      await LocalStore.saveMap(docWithThumb, { preserveUpdatedAt: true });
      const list = await LocalStore.listMaps();
      setSavedMaps(list);
    }, 260);

    collabRef.current?.syncLocalDocument(doc);
    return () => clearTimeout(timer);
  }, [doc]);

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
    return () => {
      window.removeEventListener('pagehide', flushImmediately);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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

  // Autonomous Topic & Discipline Context Intelligence
  const focusContextNodeId = editingNodeId ?? selectedNodeId ?? doc.rootNodeId;
  const mapContext = useMemo(
    () =>
      TopicContextIntelligence.analyzeMapContext(
        doc.nodes,
        doc.rootNodeId,
        focusContextNodeId,
        doc.department
      ),
    [doc.nodes, doc.rootNodeId, focusContextNodeId, doc.department]
  );

  // Zero-Keystroke Proactive Sub-Branch Suggestions
  const { proactiveSuggestions, existingSiblingTitles } = useMemo(() => {
    const targetNode = doc.nodes[focusContextNodeId];
    if (!targetNode) {
      return { proactiveSuggestions: [], existingSiblingTitles: [] };
    }
    const isFreshEmpty =
      targetNode.title.trim().length === 0 && targetNode.parentId;
    const referenceParentId = isFreshEmpty ? targetNode.parentId! : targetNode.id;
    const referenceParent =
      doc.nodes[referenceParentId] ?? doc.nodes[doc.rootNodeId];

    const siblings = Object.values(doc.nodes)
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
  }, [doc.nodes, doc.rootNodeId, doc.title, focusContextNodeId, mapContext]);

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
      setLinkingFromNodeId(null);
      setExamMode('off');
      setRevealedExamIds(new Set());
      setDoc(nextMap);
      setSelectedNodeId(autoEditRoot ? nextMap.rootNodeId : null);
      setEditingNodeId(autoEditRoot ? nextMap.rootNodeId : null);
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

  // --- HomeWorkspace Library Actions (with 3-Map Free Quota Enforcement) ---
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
    await LocalStore.moveToTrash(mapId);
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
    setSavedMaps(await LocalStore.listMaps());
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
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            ...(parent ? { [parentId]: { ...parent, collapsed: false } } : {}),
            [newId]: newNode,
          },
          updatedAt: Date.now(),
        };
      });

      setSelectedNodeId(newId);
      setEditingNodeId(newId);
    },
    [doc, openPaywall, pushHistory]
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
      pushHistory(doc);
      void hapticMedium();

      setDoc((prev) => {
        const toRemove = new Set<string>([targetId]);
        let added = true;
        while (added) {
          added = false;
          for (const n of Object.values(prev.nodes)) {
            if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
              toRemove.add(n.id);
              added = true;
            }
          }
        }
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

  const handleChangeStickerSize = useCallback(
    (nodeId: string, stickerSize: StickerSizePreset) => {
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
              stickerSize,
            },
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
      nodes: computeRadialAutoLayout(prev.nodes, prev.rootNodeId),
      updatedAt: Date.now(),
    }));
    setTimeout(() => setFitTrigger((t) => t + 1), 30);
    setTimeout(() => setIsAutoLayoutAnimating(false), 380);
  }, [doc, pushHistory]);

  const anyModalOpen =
    stickerDrawerOpen ||
    commandPaletteOpen ||
    aiStudioOpen ||
    smartGenModal.open ||
    noteCropperOpen ||
    sketchPopoverOpen ||
    exportOpen ||
    settingsOpen ||
    paywallState.open ||
    showOnboarding;

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
          setAiStudioOpen(false);
          setSmartGenModal((s) => ({ ...s, open: false }));
          setNoteCropperOpen(false);
          setSketchPopoverOpen(false);
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

  const defaultNodeStyle: NodeVisualStyle = doc.defaultNodeStyle ?? 'card';
  const activeEditNode = editingNodeId ? doc.nodes[editingNodeId] ?? null : null;
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
          onOpenMap={(mapToOpen) => openMapOnCanvas(mapToOpen, false)}
          onCreateBlankMap={handleCreateBlankMap}
          onCreateFromTemplate={handleCreateFromTemplate}
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
          onOpenSettings={() => {
            setSettingsInitialLegal(null);
            setSettingsOpen(true);
          }}
          onTriggerPaywall={(reason) => openPaywall(reason, null)}
        />
      ) : (
        <>
          {/* Screen B: 60/120 FPS Zero-Jitter Visual Mind Map Canvas */}
          <TopMinimalHUD
            mapTitle={doc.title}
            department={doc.department}
            contextEmoji={mapContext.emoji}
            defaultNodeStyle={defaultNodeStyle}
            onToggleDefaultNodeStyle={handleToggleDefaultNodeStyle}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
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

          <CanvasStage
            nodes={doc.nodes}
            crossLinks={doc.crossLinks}
            rootNodeId={doc.rootNodeId}
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
            radarJumpRequest={radarJump}
            onSelectNode={setSelectedNodeId}
            onStartEditing={(id) => {
              setSelectedNodeId(id);
              setEditingNodeId(id);
            }}
            onFinishEditing={handleFinishEditing}
            onUpdateNodeTitle={handleUpdateNodeTitle}
            onCommitBatchNodePositions={handleCommitBatchNodePositions}
            onCreateChildBranch={handleCreateChildBranch}
            onCompleteCrossLink={handleCompleteCrossLink}
            onCancelCrossLink={() => setLinkingFromNodeId(null)}
            onUpdateCrossLinkLabel={handleUpdateCrossLinkLabel}
            onDeleteCrossLink={handleDeleteCrossLink}
            onToggleCollapse={handleToggleCollapse}
            onRevealExamNode={(nodeId) => {
              setRevealedExamIds((prev) => {
                const next = new Set(prev);
                next.add(nodeId);
                return next;
              });
            }}
            onPointerWorldMove={(wx, wy) => {
              collabRef.current?.broadcastCursor(
                wx,
                wy,
                editingNodeId ?? selectedNodeId
              );
            }}
            onZoomChange={setZoomPercent}
            onViewportSnapshot={(vp, w, h, hiddenIds) => {
              setRadarSnap({ vp, w, h, hiddenIds });
            }}
            onActiveNodeScreenPosition={setActiveNodeScreenPos}
          />

          <MiniMapRadar
            nodes={doc.nodes}
            rootNodeId={doc.rootNodeId}
            hiddenNodeIds={radarSnap.hiddenIds}
            viewport={radarSnap.vp}
            stageWidth={radarSnap.w}
            stageHeight={radarSnap.h}
            isObstructedByBottomBar={Boolean(editingNodeId)}
            onJumpToWorldPoint={(wx, wy) => {
              setRadarJump((prev) => ({
                x: wx,
                y: wy,
                seq: (prev?.seq ?? 0) + 1,
              }));
            }}
          />

          <KeyboardVisualBar
            activeNode={activeEditNode}
            isRootNode={activeEditNode?.id === doc.rootNodeId}
            isMainBranch={activeEditNode?.parentId === doc.rootNodeId}
            defaultNodeStyle={defaultNodeStyle}
            mapContext={mapContext}
            proactiveSuggestions={proactiveSuggestions}
            nodeScreenPos={activeNodeScreenPos}
            onApplySticker={handleApplySticker}
            onRequestProStickerUnlock={(item) => openPaywall('pro_sticker', item)}
            onApplyProactiveSuggestion={handleApplyProactiveSuggestion}
            onUpdateTechBadge={handleUpdateNodeTechBadge}
            onChangeStickerSize={handleChangeStickerSize}
            onChangeNodeStyle={handleChangeNodeStyle}
            onRemoveSticker={handleRemoveSticker}
            onChangeBranchColor={handleChangeBranchColor}
            onDeleteNode={handleDeleteNode}
            onOpenGalleryDrawer={() => setStickerDrawerOpen(true)}
            onOpenAIStudio={() =>
              handleRequestOpenAIStudio(activeEditNode?.title || null)
            }
            onOpenNoteCropper={handleRequestOpenNoteCropper}
            onOpenQuickSketch={() => setSketchPopoverOpen(true)}
            onStartCrossLink={(fromId) => setLinkingFromNodeId(fromId)}
            onOpenSmartSubBranches={() =>
              handleRequestOpenSmartGenerator('proactive_branches', false)
            }
            onCloseEdit={handleFinishEditing}
          />

          {/* Mobile & Tablet Thumb-Reachable Bottom Quick-Action Pill (When idle) */}
          {!selectedNodeId &&
            !editingNodeId &&
            !linkingFromNodeId &&
            examMode === 'off' && (
              <div
                className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-2.5 lg:hidden"
                style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}
              >
                <div
                  className="pointer-events-auto flex max-w-full items-center gap-1 rounded-2xl border px-2 py-1.5 text-xs font-extrabold shadow-lg backdrop-blur-md"
                  style={{
                    backgroundColor: 'var(--hud-bg)',
                    borderColor: 'var(--hud-border)',
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
                    className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-3 py-1.5 text-white shadow-xs active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Yeni Dal</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoLayout}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-slate-500/10 active:scale-95"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Düzenle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitTrigger((n) => n + 1)}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-slate-500/10 active:scale-95"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Merkez</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-slate-500/10 active:scale-95"
                  >
                    <Search className="h-3.5 w-3.5 text-violet-500" />
                    <span>İkon Ara</span>
                  </button>
                </div>
              </div>
            )}

          {/* Selected Node Quick-Edit Pill */}
          {selectedNodeId &&
            !editingNodeId &&
            !linkingFromNodeId &&
            examMode === 'off' &&
            doc.nodes[selectedNodeId] && (
              <div
                className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-2.5"
                style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}
              >
                <div
                  className="no-scrollbar pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border px-2.5 py-1.5 text-xs font-bold shadow-lg backdrop-blur-md"
                  style={{
                    backgroundColor: 'var(--hud-bg)',
                    borderColor: 'var(--hud-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setEditingNodeId(selectedNodeId)}
                    className="shrink-0 rounded-xl bg-sky-500 px-3 py-1 text-white shadow-xs active:scale-95"
                  >
                    ✨ Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const parent = doc.nodes[selectedNodeId];
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
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 hover:bg-slate-500/10"
                  >
                    <Plus className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Alt Dal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStickerDrawerOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 hover:bg-slate-500/10"
                  >
                    <Search className="h-3.5 w-3.5 text-sky-500" />
                    <span>+150 Görsel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkingFromNodeId(selectedNodeId)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 hover:bg-slate-500/10"
                  >
                    <Link2 className="h-3.5 w-3.5 text-indigo-500" />
                    <span>İlişki Çek</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleRequestOpenSmartGenerator(
                        'proactive_branches',
                        false
                      )
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 hover:bg-slate-500/10"
                  >
                    <Wand2 className="h-3.5 w-3.5 text-amber-500" />
                    <span>Öneriler</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestOpenNoteCropper}
                    className="shrink-0 rounded-xl px-2 py-1 hover:bg-slate-500/10"
                  >
                    📷 Nottan Kes
                  </button>
                  <button
                    type="button"
                    onClick={() => setSketchPopoverOpen(true)}
                    className="shrink-0 rounded-xl px-2 py-1 hover:bg-slate-500/10"
                  >
                    ✏️ Karala
                  </button>
                </div>
              </div>
            )}

          <StickerGalleryDrawer
            isOpen={stickerDrawerOpen}
            initialQuery={targetModalNode?.title ?? ''}
            branchColor={targetModalNode?.branchColor ?? '#0EA5E9'}
            mapContext={mapContext}
            onClose={() => setStickerDrawerOpen(false)}
            onApplySticker={(sticker) =>
              handleApplySticker(targetModalNodeId, sticker)
            }
            onRequestProStickerUnlock={(item) => openPaywall('pro_sticker', item)}
            onOpenAIStudio={(customQuery) =>
              handleRequestOpenAIStudio(customQuery)
            }
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

          <ExportSheet
            isOpen={exportOpen}
            onClose={() => setExportOpen(false)}
            document={doc}
            collaborators={collaborators}
            onImportDocument={(imported) => {
              void handleImportMapsBatch([imported]);
            }}
            onTriggerPaywall={(reason) => openPaywall(reason, null)}
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
