import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Crown,
  Target,
  GraduationCap,
  Sparkles,
  Share2,
  Maximize2,
  Moon,
  Sun,
  MoreHorizontal,
  Undo2,
  Redo2,
  RotateCcw,
  Eye,
  Check,
  Wand2,
  Search,
  Layers,
  Settings,
  Timer,
  Play,
  Pause,
  Pencil,
  PenTool,
  ListTree,
  Brain,
  HelpCircle,
  Grid3X3,
  Presentation,
  LayoutGrid,
  Palette,
  Workflow,
} from 'lucide-react';
import {
  STUDIO_THEMES,
  type StudioThemeId,
} from '../core/theme/StudioThemes';
import {
  DEPARTMENT_LABELS,
  type AcademicDepartment,
  type CollaboratorPresence,
  type ExamRecallMode,
  type MindMapLayoutType,
  type NodeVisualStyle,
  type PaperStyleType,
  type PaywallTriggerReason,
} from '../types/mindmap';
import { useEntitlements } from '../core/monetization/EntitlementManager';
import { useI18n } from '../core/i18n/i18n';
import { dismissNativeKeyboard } from '../core/native/useKeyboardInset';

export type WorkspaceTopTab = 'map' | 'draw' | 'study';

interface TopMinimalHUDProps {
  mapTitle: string;
  department: AcademicDepartment;
  contextEmoji?: string;
  defaultNodeStyle: NodeVisualStyle;
  paperStyle: PaperStyleType;
  layoutType: MindMapLayoutType;
  colorTheme?: string;
  onChangeLayoutType: (layout: MindMapLayoutType) => void;
  onApplyStudioTheme?: (themeId: StudioThemeId) => void;
  onConvertToFlowchart?: () => void;
  onOpenFlashcards: () => void;
  onStartPresentation: () => void;
  onToggleDefaultNodeStyle: () => void;
  onCyclePaperStyle: () => void;
  onOpenCommandPalette: () => void;
  onOpenOutline: () => void;
  onOpenGuide: () => void;
  onRenameMap: (title: string) => void;
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onTriggerPaywall: (reason: PaywallTriggerReason) => void;
  onOpenSmartGenerator: () => void;
  drawingMode: boolean;
  onToggleDrawingMode: () => void;
  onExitDrawingMode: () => void;
  focusModeActive: boolean;
  onToggleFocusMode: () => void;
  examMode: ExamRecallMode;
  onChangeExamMode: (mode: ExamRecallMode) => void;
  examStats: { revealed: number; total: number };
  onResetExamReveals: () => void;
  onAutoLayout: () => void;
  onFitToScreen: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  collaborators: CollaboratorPresence[];
  onOpenExport: () => void;
  zoomPercent: number;
}

const PAPER_LABELS: Record<PaperStyleType, string> = {
  dots: 'Noktalı',
  grid: 'Kareli',
  lined: 'Çizgili',
  blank: 'Düz Beyaz',
  warm: 'Krem Defter',
};

export const TopMinimalHUD: React.FC<TopMinimalHUDProps> = React.memo(({
  mapTitle,
  department,
  contextEmoji,
  defaultNodeStyle,
  paperStyle,
  layoutType,
  colorTheme,
  onChangeLayoutType,
  onApplyStudioTheme,
  onConvertToFlowchart,
  onOpenFlashcards,
  onStartPresentation,
  onToggleDefaultNodeStyle,
  onCyclePaperStyle,
  onOpenCommandPalette,
  onOpenOutline,
  onOpenGuide,
  onRenameMap,
  onNavigateHome,
  onOpenSettings,
  onTriggerPaywall,
  onOpenSmartGenerator,
  drawingMode,
  onToggleDrawingMode,
  onExitDrawingMode,
  focusModeActive,
  onToggleFocusMode,
  examMode,
  onChangeExamMode,
  examStats,
  onResetExamReveals,
  onAutoLayout,
  onFitToScreen,
  darkMode,
  onToggleDarkMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  collaborators,
  onOpenExport,
  zoomPercent,
}) => {
  const { t } = useI18n();
  const { isLifetimePro, localizedPrice } = useEntitlements();
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(mapTitle);
  const [studyTabOpen, setStudyTabOpen] = useState(false);
  const [examMenuOpen, setExamMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showStudyTimer, setShowStudyTimer] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const formattedTimer = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(
    timerSeconds % 60
  ).padStart(2, '0')}`;

  const examRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTitle(mapTitle);
  }, [mapTitle]);

  useEffect(() => {
    if (drawingMode) {
      setStudyTabOpen(false);
    }
  }, [drawingMode]);

  useEffect(() => {
    const handleOutside = (e: PointerEvent) => {
      if (examRef.current && !examRef.current.contains(e.target as Node)) {
        setExamMenuOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, []);

  const commitTitle = () => {
    setEditingTitle(false);
    void dismissNativeKeyboard();
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== mapTitle) {
      onRenameMap(trimmed);
    } else {
      setDraftTitle(mapTitle);
    }
  };

  const deptMeta = DEPARTMENT_LABELS[department] ?? DEPARTMENT_LABELS.genel;
  const activeTopTab: WorkspaceTopTab = drawingMode
    ? 'draw'
    : studyTabOpen || examMode !== 'off' || focusModeActive
    ? 'study'
    : 'map';

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 z-[45] flex flex-col gap-2 px-2.5 sm:px-4"
      style={{
        paddingTop: 'max(12px, calc(var(--safe-top) + 8px))',
        paddingLeft: 'calc(var(--safe-left) + 10px)',
        paddingRight: 'calc(var(--safe-right) + 10px)',
      }}
    >
      {/* MAIN SIMPLIFIED 3-ZONE TOP BAR (Left: Back+Title | Center: 3 Big Mode Tabs | Right: 4 Clean Actions) */}
      <div className="relative z-20 flex w-full items-center justify-between gap-1.5 sm:gap-2">
        {/* Zone 1: Back + Map Title (Liquid Glass Split-Capsule HUD) */}
        <div
          className="pointer-events-auto flex min-w-0 items-center gap-1 rounded-2xl border px-1 py-1 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] backdrop-blur-md sm:px-1.5 dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.48)] dark:ring-white/[0.07]"
          style={{
            backgroundColor: 'var(--hud-bg)',
            borderColor: 'var(--hud-border)',
          }}
        >
          <button
            type="button"
            onClick={onNavigateHome}
            data-testid="hud-back-home-btn"
            title="Haritalarım Ana Sayfasına Dön"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold hover:bg-slate-500/10 active:scale-95 sm:w-auto sm:px-2.5"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
            <span className="hidden xl:inline">Haritalarım</span>
          </button>

          <div
            className={`${editingTitle ? 'block' : 'hidden sm:block'} h-5 w-px shrink-0 bg-slate-400/25`}
          />

          {editingTitle ? (
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') {
                  setDraftTitle(mapTitle);
                  setEditingTitle(false);
                }
              }}
              autoFocus
              className="allow-text-input w-28 rounded-xl bg-sky-500/10 px-2.5 py-1 text-base font-extrabold outline-none ring-2 ring-sky-500 sm:w-44"
            />
          ) : (
            <button
              type="button"
              data-testid="hud-rename-map-btn"
              onClick={() => setEditingTitle(true)}
              title="Harita adını değiştirmek için dokunun"
              className="group hidden min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-left hover:bg-sky-500/10 sm:flex"
            >
              <span className="text-base leading-none" aria-hidden="true">
                {contextEmoji || deptMeta.emoji}
              </span>
              <span className="max-w-[140px] truncate text-sm font-extrabold tracking-tight md:max-w-[190px] lg:max-w-[260px]">
                {mapTitle}
              </span>
              <Pencil className="h-3 w-3 shrink-0 text-sky-500 opacity-75" />
            </button>
          )}
        </div>

        {/* Zone 2: 3 BIG, CLEAR MODE TABS (`Harita` | `Çiz` | `Çalış`) — Apple Liquid Glass Capsule */}
        <div
          data-testid="hud-mode-tabs"
          className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-2xl border p-1 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] backdrop-blur-md sm:gap-1 dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.48)] dark:ring-white/[0.07]"
          style={{
            backgroundColor: 'var(--hud-bg)',
            borderColor: 'var(--hud-border)',
          }}
        >
          <button
            type="button"
            data-testid="hud-tab-map"
            onClick={() => {
              onExitDrawingMode();
              setStudyTabOpen(false);
            }}
            className={`inline-flex h-10 items-center gap-1 rounded-xl px-2 text-[11px] font-extrabold transition active:scale-95 sm:gap-1.5 sm:px-3.5 sm:text-[13px] ${
              activeTopTab === 'map'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-sky-500 dark:text-slate-950'
                : 'opacity-75 hover:bg-slate-500/10 hover:opacity-100'
            }`}
          >
            <Brain className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span>{t('Harita', 'Map')}</span>
          </button>

          <button
            type="button"
            data-testid="hud-draw-toggle-btn"
            onClick={onToggleDrawingMode}
            title={t('Tuval Üzerine Kalem, Fosforlu, Şekil, Kement & Yapışkan Not', 'Draw with Pen, Highlighter, Smart Shapes, Lasso & Sticky Notes')}
            className={`inline-flex h-10 items-center gap-1 rounded-xl px-2 text-[11px] font-extrabold transition active:scale-95 sm:gap-1.5 sm:px-3.5 sm:text-[13px] ${
              activeTopTab === 'draw'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xs'
                : 'opacity-80 hover:bg-sky-500/12 hover:text-sky-700 hover:opacity-100 dark:hover:text-sky-300'
            }`}
          >
            <PenTool className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span>{drawingMode ? t('Çizim', 'Drawing') : t('Çiz', 'Draw')}</span>
          </button>

          <button
            type="button"
            data-testid="hud-tab-study"
            onClick={() => {
              onExitDrawingMode();
              setStudyTabOpen((v) => !v);
            }}
            title={t('Sınav Modu, Flashcard, Sunum, Odak, Sayaç & Anahat', 'Exam Mode, Flashcards, Pitch Mode, Focus, Timer & Outline')}
            className={`inline-flex h-10 items-center gap-1 rounded-xl px-2 text-[11px] font-extrabold transition active:scale-95 sm:gap-1.5 sm:px-3.5 sm:text-[13px] ${
              activeTopTab === 'study'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'opacity-80 hover:bg-violet-500/12 hover:text-violet-700 hover:opacity-100 dark:hover:text-violet-300'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span>{t('Çalış', 'Study')}</span>
            {examMode !== 'off' && (
              <span className="rounded-md bg-white/25 px-1 py-0.5 text-[9.5px] font-black">
                {examStats.revealed}/{examStats.total}
              </span>
            )}
          </button>
        </div>

        {/* Zone 3: Ultra-Clean Right Actions (Undo, Search, Export, More Menu) */}
        <div
          className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-2xl border px-1 py-1 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] backdrop-blur-md sm:gap-1 sm:px-1.5 dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.48)] dark:ring-white/[0.07]"
          style={{
            backgroundColor: 'var(--hud-bg)',
            borderColor: 'var(--hud-border)',
          }}
        >
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Geri Al"
            className="hidden h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-500/10 active:scale-95 disabled:opacity-30 md:flex"
          >
            <Undo2 className="h-4.5 w-4.5" />
          </button>

          <button
            type="button"
            data-testid="hud-search-btn"
            onClick={onOpenCommandPalette}
            title="Hızlı Dal & İkon Arama"
            className="flex h-10 w-9 items-center justify-center rounded-xl hover:bg-sky-500/12 hover:text-sky-600 active:scale-95 sm:w-auto sm:gap-1.5 sm:px-3 dark:hover:text-sky-300"
          >
            <Search className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            <span className="hidden text-xs font-extrabold lg:inline">Ara</span>
          </button>

          {collaborators.length > 1 && (
            <div className="hidden items-center -space-x-1.5 px-1 xl:flex">
              {collaborators.slice(0, 3).map((peer) => (
                <div
                  key={peer.id}
                  title={peer.isLocal ? 'Sen' : peer.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-extrabold text-white dark:border-slate-900"
                  style={{ backgroundColor: peer.color }}
                >
                  {peer.avatarInitials}
                </div>
              ))}
            </div>
          )}

          {/* Share / Export Button */}
          <button
            type="button"
            onClick={onOpenExport}
            title="300 DPI PDF / PNG / SVG Çıktı ve Paylaşım"
            className="flex h-10 w-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-xs font-extrabold text-white shadow-xs hover:opacity-95 active:scale-95 sm:w-auto sm:px-3 dark:bg-sky-500 dark:text-slate-950"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden md:inline">Paylaş</span>
          </button>

          {/* Spacious Overflow Menu (`⋯`) — Holds Theme, Paper, Guide, Pro, Settings */}
          <div ref={moreRef} className="relative">
            <button
              type="button"
              data-testid="hud-more-menu-btn"
              onClick={() => {
                setExamMenuOpen(false);
                setMoreMenuOpen((v) => !v);
              }}
              title="Görünüm, Kağıt Deseni, Rehber ve Ayarlar"
              className={`flex h-10 w-9 items-center justify-center rounded-xl active:scale-95 sm:w-10 ${
                moreMenuOpen ? 'bg-slate-500/15' : 'hover:bg-slate-500/10'
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {moreMenuOpen && (
              <div
                className="absolute right-0 z-50 mt-2 max-h-[72dvh] w-72 overflow-y-auto rounded-3xl border p-2.5 shadow-2xl backdrop-blur-xl"
                style={{
                  backgroundColor: 'var(--canvas-bg)',
                  borderColor: 'var(--hud-border)',
                }}
              >
                {/* Mobile Map Title & Rename Row */}
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setEditingTitle(true);
                  }}
                  className="mb-1.5 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-2xl bg-sky-500/10 px-3 text-left text-xs font-extrabold text-sky-800 hover:bg-sky-500/15 sm:hidden dark:text-sky-200"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-base leading-none">{contextEmoji || deptMeta.emoji}</span>
                    <span className="truncate">{mapTitle}</span>
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 opacity-80" />
                </button>
                {/* Quick Undo / Redo Row */}
                <div className="mb-1.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onUndo();
                      setMoreMenuOpen(false);
                    }}
                    disabled={!canUndo}
                    className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-slate-500/10 text-xs font-extrabold hover:bg-slate-500/15 disabled:opacity-35"
                  >
                    <Undo2 className="h-4 w-4" />
                    Geri Al
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRedo();
                      setMoreMenuOpen(false);
                    }}
                    disabled={!canRedo}
                    className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-slate-500/10 text-xs font-extrabold hover:bg-slate-500/15 disabled:opacity-35"
                  >
                    <Redo2 className="h-4 w-4" />
                    Yinele
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="hud-smart-map-menu-btn"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onOpenSmartGenerator();
                  }}
                  className="mb-1 flex min-h-[42px] w-full items-center gap-2.5 rounded-2xl bg-amber-500/12 px-3 text-xs font-extrabold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
                >
                  <Wand2 className="h-4 w-4 text-amber-500" />
                  <span>{t('Metinden Harita Oluştur', 'Text to Mind Map')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onAutoLayout();
                    setMoreMenuOpen(false);
                  }}
                  className="flex min-h-[42px] w-full items-center gap-2.5 rounded-2xl px-3 text-xs font-extrabold hover:bg-slate-500/10"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Otomatik Düzenle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onFitToScreen();
                    setMoreMenuOpen(false);
                  }}
                  className="flex min-h-[42px] w-full items-center justify-between rounded-2xl px-3 text-xs font-extrabold hover:bg-slate-500/10"
                >
                  <span className="flex items-center gap-2.5">
                    <Maximize2 className="h-4 w-4 text-sky-500" />
                    <span>Ekrana Sığdır</span>
                  </span>
                  <span className="rounded-lg bg-slate-500/10 px-2 py-0.5 text-[11px] tabular-nums">
                    %{zoomPercent}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCyclePaperStyle();
                  }}
                  className="flex min-h-[42px] w-full items-center justify-between rounded-2xl px-3 text-xs font-extrabold hover:bg-slate-500/10"
                >
                  <span className="flex items-center gap-2.5">
                    <Grid3X3 className="h-4 w-4 text-indigo-500" />
                    <span>Kağıt Deseni</span>
                  </span>
                  <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[11px] text-indigo-700 dark:text-indigo-300">
                    {PAPER_LABELS[paperStyle]}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleDefaultNodeStyle();
                    setMoreMenuOpen(false);
                  }}
                  className="flex min-h-[42px] w-full items-center justify-between rounded-2xl px-3 text-xs font-extrabold hover:bg-slate-500/10"
                >
                  <span className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 text-emerald-500" />
                    <span>Düğüm Stili</span>
                  </span>
                  <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                    {defaultNodeStyle === 'organic' ? 'Organik' : 'Modern Kart'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onToggleDarkMode();
                    setMoreMenuOpen(false);
                  }}
                  className="flex min-h-[42px] w-full items-center gap-2.5 rounded-2xl px-3 text-xs font-extrabold hover:bg-slate-500/10"
                >
                  {darkMode ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-indigo-500" />
                  )}
                  <span>{darkMode ? 'Açık Tema' : 'Koyu Tema'}</span>
                </button>

                <div className="my-1.5 h-px bg-slate-400/20" />

                {/* 4-Way Multi-Layout Mind Map Switcher */}
                <div className="px-2 py-1">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-wider uppercase opacity-60">
                    <LayoutGrid className="h-3 w-3" />
                    <span>{t('Harita Düzeni', 'Map Layout')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'radial', label: t('Radyal', 'Radial') },
                        { id: 'right_tree', label: t('Sağa Ağaç', 'Logic Tree') },
                        { id: 'org_chart', label: t('Org Şeması', 'Org Chart') },
                        { id: 'timeline', label: t('Zaman Çizgisi', 'Timeline') },
                      ] as Array<{ id: MindMapLayoutType; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`layout-btn-${opt.id}`}
                        onClick={() => {
                          onChangeLayoutType(opt.id);
                          setMoreMenuOpen(false);
                        }}
                        className={`min-h-[34px] rounded-xl px-2 text-[11px] font-extrabold transition ${
                          layoutType === opt.id
                            ? 'bg-sky-500 text-white shadow-xs'
                            : 'bg-slate-500/10 hover:bg-slate-500/15'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6 Curated Designer Studio Themes */}
                {onApplyStudioTheme && (
                  <div className="mt-1 px-2 py-1">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-wider uppercase opacity-60">
                      <Palette className="h-3 w-3" />
                      <span>{t('Stüdyo Renk Teması', 'Studio Color Theme')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {STUDIO_THEMES.map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          data-testid={`studio-theme-btn-${th.id}`}
                          onClick={() => {
                            onApplyStudioTheme(th.id);
                            setMoreMenuOpen(false);
                          }}
                          className={`flex min-h-[34px] items-center gap-1.5 rounded-xl px-2 text-[10.5px] font-extrabold transition ${
                            colorTheme === th.id
                              ? 'bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950'
                              : 'bg-slate-500/10 hover:bg-slate-500/15'
                          }`}
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15"
                            style={{ backgroundColor: th.swatch }}
                          />
                          <span className="truncate">{th.nameTr.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {onConvertToFlowchart && (
                  <button
                    type="button"
                    data-testid="hud-convert-flowchart-btn"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onConvertToFlowchart();
                    }}
                    className="mt-1 flex min-h-[40px] w-full items-center gap-2.5 rounded-2xl bg-emerald-500/12 px-3 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <Workflow className="h-4 w-4" />
                    <span>{t('Akış Diyagramına Dönüştür', 'Convert to Flowchart')}</span>
                  </button>
                )}

                <div className="my-1.5 h-px bg-slate-400/20" />

                <button
                  type="button"
                  data-testid="hud-guide-btn"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onOpenGuide();
                  }}
                  className="flex min-h-[42px] w-full items-center gap-2.5 rounded-2xl px-3 text-xs font-extrabold text-sky-700 hover:bg-sky-500/12 dark:text-sky-300"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Rehber</span>
                </button>

                <button
                  type="button"
                  data-testid="hud-settings-btn"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="flex min-h-[42px] w-full items-center gap-2.5 rounded-2xl px-3 text-xs font-extrabold hover:bg-slate-500/10"
                >
                  <Settings className="h-4 w-4" />
                  <span>Ayarlar</span>
                </button>

                {!isLifetimePro && (
                  <button
                    type="button"
                    data-testid="hud-pro-pill"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onTriggerPaywall('header_pill');
                    }}
                    className="mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 text-xs font-black text-slate-950 shadow-sm active:scale-95"
                  >
                    <Crown className="h-4 w-4" />
                    <span>ZihinHaritam Pro • {localizedPrice}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CLEAN SECONDARY STUDY RIBBON (Shown ONLY when `🎓 Çalış` Tab is Open!) */}
      {studyTabOpen && !drawingMode && (
        <div
          data-testid="hud-study-ribbon"
          className="pointer-events-none relative z-10 flex w-full justify-center"
        >
          <div
            className="no-scrollbar pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border px-2.5 py-1.5 shadow-lg backdrop-blur-md"
            style={{
              backgroundColor: 'var(--hud-bg)',
              borderColor: 'var(--hud-border)',
            }}
          >
            {/* Active Recall Exam Dropdown */}
            <div ref={examRef} className="relative">
              <button
                type="button"
                data-testid="study-exam-btn"
                onClick={() => setExamMenuOpen((v) => !v)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                  examMode !== 'off'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-violet-500/12 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300'
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>Sınav Modu</span>
              </button>

              {examMenuOpen && (
                <div
                  className="fixed left-1/2 z-50 mt-2 w-72 -translate-x-1/2 rounded-3xl border p-2.5 shadow-2xl backdrop-blur-xl sm:absolute sm:left-0 sm:translate-x-0"
                  style={{
                    backgroundColor: 'var(--canvas-bg)',
                    borderColor: 'var(--hud-border)',
                  }}
                >
                  <div className="px-2.5 py-1 text-[11px] font-extrabold tracking-wider uppercase opacity-60">
                    Aktif Hatırlama (Sınav Modu)
                  </div>
                  {(
                    [
                      {
                        id: 'off',
                        title: 'Normal Harita Görünümü',
                        desc: 'Tüm görseller ve başlıklar açık',
                        proOnly: false,
                      },
                      {
                        id: 'hide_text',
                        title: 'Başlıkları Gizle',
                        desc: 'İkona bakıp kavramı hatırla, dokununca aç',
                        proOnly: false,
                      },
                      {
                        id: 'hide_visuals_children',
                        title: 'Tam Sınav Modu (Görsel & Dallar)',
                        desc: 'Ana başlıktan tüm alt dalları hatırla',
                        proOnly: true,
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (opt.proOnly && !isLifetimePro) {
                          setExamMenuOpen(false);
                          onTriggerPaywall('exam_mode');
                          return;
                        }
                        onChangeExamMode(opt.id);
                        setExamMenuOpen(false);
                      }}
                      className={`mt-1 flex w-full items-start gap-2.5 rounded-2xl p-2.5 text-left ${
                        examMode === opt.id
                          ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                          : 'hover:bg-slate-500/10'
                      }`}
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current">
                        {examMode === opt.id && <Check className="h-2.5 w-2.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold">
                          <span>{opt.title}</span>
                          {opt.proOnly && !isLifetimePro && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9.5px] font-black text-amber-700 dark:text-amber-300">
                              PRO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] opacity-70">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="study-flashcards-btn"
              onClick={onOpenFlashcards}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-fuchsia-500/12 px-3 text-xs font-extrabold whitespace-nowrap text-fuchsia-700 hover:bg-fuchsia-500/20 active:scale-95 dark:text-fuchsia-300"
            >
              <Brain className="h-4 w-4" />
              <span>{t('Flashcard', 'Flashcards')}</span>
            </button>

            <button
              type="button"
              data-testid="study-presentation-btn"
              onClick={onStartPresentation}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 text-xs font-extrabold whitespace-nowrap text-amber-700 hover:bg-amber-500/25 active:scale-95 dark:text-amber-300"
            >
              <Presentation className="h-4 w-4" />
              <span>{t('Sunum', 'Pitch')}</span>
            </button>

            <button
              type="button"
              onClick={onToggleFocusMode}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                focusModeActive
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'hover:bg-slate-500/10'
              }`}
            >
              <Target className="h-4 w-4" />
              <span>Odak</span>
            </button>

            <button
              type="button"
              data-testid="hud-timer-toggle-btn"
              onClick={() => setShowStudyTimer((v) => !v)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold whitespace-nowrap active:scale-95 ${
                showStudyTimer || timerRunning || timerSeconds > 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'hover:bg-slate-500/10'
              }`}
            >
              <Timer className="h-4 w-4" />
              <span>{timerSeconds > 0 ? formattedTimer : 'Sayaç'}</span>
            </button>

            <button
              type="button"
              data-testid="hud-outline-btn"
              onClick={onOpenOutline}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-500/12 px-3 text-xs font-extrabold whitespace-nowrap text-indigo-700 hover:bg-indigo-500/20 active:scale-95 dark:text-indigo-300"
            >
              <ListTree className="h-4 w-4" />
              <span>Anahat</span>
            </button>

            <button
              type="button"
              onClick={onOpenSmartGenerator}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 text-xs font-extrabold whitespace-nowrap text-amber-700 hover:bg-amber-500/25 active:scale-95 dark:text-amber-300"
            >
              <Wand2 className="h-4 w-4" />
              <span>Akıllı Dal</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Exam Progress or Study Timer Pill (Only when actively running/open) */}
      {(examMode !== 'off' || showStudyTimer || timerRunning || timerSeconds > 0) && (
        <div className="pointer-events-none flex flex-wrap items-center justify-center gap-2">
          {examMode !== 'off' && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-xs font-extrabold text-amber-800 shadow-md backdrop-blur-md dark:text-amber-200">
              <Eye className="h-4 w-4 shrink-0" />
              <span>
                Sınav: {examStats.revealed} / {examStats.total}
              </span>
              <button
                type="button"
                data-testid="exam-counter-reset-btn"
                onClick={onResetExamReveals}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-2.5 py-1 text-[11px] font-black text-slate-950 active:scale-95"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Sıfırla</span>
              </button>
            </div>
          )}

          {(showStudyTimer || timerRunning || timerSeconds > 0) && (
            <div
              data-testid="study-timer-pill"
              className="pointer-events-auto flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-extrabold shadow-md backdrop-blur-md"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <Timer className="h-4 w-4 shrink-0 text-sky-500" />
              <span className="font-mono text-sm font-black tabular-nums">
                {formattedTimer}
              </span>
              <button
                type="button"
                data-testid="study-timer-play-btn"
                onClick={() => setTimerRunning((r) => !r)}
                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-black active:scale-95 ${
                  timerRunning ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-white'
                }`}
              >
                {timerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{timerRunning ? 'Durdur' : 'Başlat'}</span>
              </button>
              <button
                type="button"
                data-testid="study-timer-reset-btn"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/12 px-2.5 py-1 text-[11px] font-black text-rose-600 active:scale-95 dark:text-rose-300"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Sıfırla</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
});
