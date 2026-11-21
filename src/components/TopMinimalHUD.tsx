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
  Zap,
  Timer,
  Play,
  Pause,
  Pencil,
  ListTree,
} from 'lucide-react';
import {
  DEPARTMENT_LABELS,
  type AcademicDepartment,
  type CollaboratorPresence,
  type ExamRecallMode,
  type NodeVisualStyle,
  type PaywallTriggerReason,
} from '../types/mindmap';
import { useEntitlements } from '../core/monetization/EntitlementManager';
import { OfflineVisualSearchClient } from '../core/visuals/OfflineVisualSearchClient';

interface TopMinimalHUDProps {
  mapTitle: string;
  department: AcademicDepartment;
  contextEmoji?: string;
  defaultNodeStyle: NodeVisualStyle;
  onToggleDefaultNodeStyle: () => void;
  onOpenCommandPalette: () => void;
  onOpenOutline: () => void;
  onRenameMap: (title: string) => void;
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onTriggerPaywall: (reason: PaywallTriggerReason) => void;
  onOpenSmartGenerator: () => void;
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

export const TopMinimalHUD: React.FC<TopMinimalHUDProps> = React.memo(({
  mapTitle,
  department,
  contextEmoji,
  defaultNodeStyle,
  onToggleDefaultNodeStyle,
  onOpenCommandPalette,
  onOpenOutline,
  onRenameMap,
  onNavigateHome,
  onOpenSettings,
  onTriggerPaywall,
  onOpenSmartGenerator,
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
  const { isLifetimePro, localizedPrice } = useEntitlements();
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(mapTitle);
  const [examMenuOpen, setExamMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineTotal, setOfflineTotal] = useState(0);
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
    let unsub: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      unsub = OfflineVisualSearchClient.subscribeStatus((st) => {
        setOfflineReady(st.ready);
        setOfflineTotal(st.totalIndexed);
      });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      unsub?.();
    };
  }, []);

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
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== mapTitle) {
      onRenameMap(trimmed);
    } else {
      setDraftTitle(mapTitle);
    }
  };

  const deptMeta = DEPARTMENT_LABELS[department] ?? DEPARTMENT_LABELS.genel;

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-1.5 px-2 sm:gap-2 sm:px-4"
      style={{
        paddingTop: 'max(12px, calc(var(--safe-top) + 8px))',
        paddingLeft: 'calc(var(--safe-left) + 8px)',
        paddingRight: 'calc(var(--safe-right) + 8px)',
      }}
    >
      {/* Left Minimal Pill: ← Haritalarım + Map Name + Offline Ready Badge */}
      <div
        className="pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-2xl border px-2 py-1 shadow-sm"
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
        }}
      >
        <button
          type="button"
          onClick={onNavigateHome}
          data-testid="hud-back-home-btn"
          title="Haritalarım Çalışma Alanına Dön"
          className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-extrabold hover:bg-slate-500/10 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden lg:inline">Haritalarım</span>
        </button>

        <div className="h-4 w-px shrink-0 bg-slate-400/25" />

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
            className="allow-text-input w-28 rounded-lg bg-sky-500/10 px-2 py-0.5 text-base font-bold outline-none ring-1 ring-sky-500 sm:w-44 sm:text-sm"
          />
        ) : (
          <button
            type="button"
            data-testid="hud-rename-map-btn"
            onClick={() => setEditingTitle(true)}
            title="Ağaç / Harita adını değiştirmek için dokunun"
            className="group flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1 text-left hover:bg-sky-500/10"
          >
            <span className="text-sm leading-none" aria-hidden="true">
              {contextEmoji || deptMeta.emoji}
            </span>
            <span className="max-w-[92px] truncate text-xs font-extrabold tracking-tight sm:max-w-[140px] md:max-w-[168px] lg:max-w-[220px] sm:text-sm">
              {mapTitle}
            </span>
            <Pencil className="h-3 w-3 shrink-0 text-sky-500 opacity-75 transition group-hover:scale-110 group-hover:opacity-100" />
          </button>
        )}

        {offlineReady && (
          <span
            title={`${offlineTotal.toLocaleString('tr-TR')} Çevrimdışı + 540.000+ Online Vektör İkon Hazır`}
            className="hidden shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 xl:inline-flex dark:text-emerald-300"
          >
            <Zap className="h-2.5 w-2.5" />
            <span>{Math.max(25, Math.floor(offlineTotal / 1000))}K+ Offline</span>
          </span>
        )}
      </div>

      {/* Center / Sub-Header Active Exam Counter & Study Timer Pill (Visible on Mobile, Tablet & Desktop!) */}
      {(examMode !== 'off' || showStudyTimer || timerRunning || timerSeconds > 0) && (
        <div
          className="pointer-events-none fixed inset-x-0 z-20 flex flex-wrap items-center justify-center gap-1.5 px-3 lg:static lg:w-auto lg:px-0"
          style={{ top: 'max(64px, calc(var(--safe-top) + 56px))' }}
        >
          {examMode !== 'off' && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-xs font-extrabold text-amber-800 shadow-md backdrop-blur-md dark:text-amber-200">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span>
                Sınav Sayacı: {examStats.revealed} / {examStats.total}
              </span>
              <button
                type="button"
                data-testid="exam-counter-reset-btn"
                onClick={onResetExamReveals}
                className="ml-0.5 inline-flex items-center gap-1 rounded-xl bg-amber-500 px-2.5 py-0.5 text-[11px] font-black text-slate-950 shadow-2xs transition hover:bg-amber-400 active:scale-95"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Sıfırla</span>
              </button>
            </div>
          )}

          {(showStudyTimer || timerRunning || timerSeconds > 0) && (
            <div
              data-testid="study-timer-pill"
              className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-extrabold shadow-md backdrop-blur-md"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <Timer className="h-3.5 w-3.5 shrink-0 text-sky-500" />
              <span className="font-mono text-xs font-black tabular-nums">
                {formattedTimer}
              </span>
              <button
                type="button"
                data-testid="study-timer-play-btn"
                onClick={() => setTimerRunning((r) => !r)}
                title={timerRunning ? 'Duraklat' : 'Başlat'}
                className={`inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] font-black text-white shadow-2xs active:scale-95 ${
                  timerRunning ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500'
                }`}
              >
                {timerRunning ? (
                  <>
                    <Pause className="h-3 w-3" />
                    <span>Durdur</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    <span>Başlat</span>
                  </>
                )}
              </button>
              <button
                type="button"
                data-testid="study-timer-reset-btn"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
                title="Sayacı Sıfırla"
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/12 px-2 py-0.5 text-[11px] font-black text-rose-600 hover:bg-rose-500/20 active:scale-95 dark:text-rose-300"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Sıfırla</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Right Minimal Pill */}
      <div
        className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-2xl border px-1.5 py-1.5 shadow-sm sm:gap-1.5 sm:px-2"
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
        }}
      >
        {/* Quick Search & 540K+ Command Palette (`Cmd/Ctrl + K`) */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Hızlı Dal & 540.000+ İkon Arama Paleti (Ctrl+K)"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-500/10 px-2.5 text-xs font-extrabold hover:bg-sky-500/15 hover:text-sky-600 active:scale-95 dark:hover:text-sky-300"
        >
          <Search className="h-4 w-4" />
          <span className="hidden lg:inline">Ara</span>
          <kbd className="hidden rounded bg-slate-500/15 px-1 py-0.5 font-mono text-[10px] opacity-75 xl:inline">
            ⌘K
          </kbd>
        </button>

        {/* Hierarchical Outliner View (`📋 Anahat`) */}
        <button
          type="button"
          data-testid="hud-outline-btn"
          onClick={onOpenOutline}
          title="Hiyerarşik Anahat & Uzun Notlar Görünümü"
          className="hidden h-9 items-center gap-1.5 rounded-xl bg-indigo-500/12 px-2.5 text-xs font-extrabold text-indigo-700 hover:bg-indigo-500/20 active:scale-95 md:flex dark:text-indigo-300"
        >
          <ListTree className="h-4 w-4" />
          <span className="hidden xl:inline">Anahat</span>
        </button>

        {/* Desktop & Landscape Tablet Undo/Redo (Phones/Portrait Tablets use right zoom rail & More menu) */}
        <div className="hidden items-center gap-0.5 lg:flex">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Geri Al (Ctrl+Z)"
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10 disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Yinele (Ctrl+Y)"
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10 disabled:opacity-30"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="mx-0.5 h-4 w-px bg-slate-400/25" />
        </div>

        {/* Organic vs Card Style Switch (`lg+`) */}
        <button
          type="button"
          onClick={onToggleDefaultNodeStyle}
          title="Düğüm Görünüm Stili: Modern Kart veya Kutucuksuz Organik Çıkartma"
          className={`hidden h-8 items-center gap-1 rounded-xl px-2 text-xs font-extrabold active:scale-95 lg:flex ${
            defaultNodeStyle === 'organic'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'hover:bg-slate-500/10'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>{defaultNodeStyle === 'organic' ? 'Organik' : 'Kart'}</span>
        </button>

        {/* Smart Text-to-Map Generator (`lg+`; portrait tablets use More menu) */}
        <button
          type="button"
          onClick={onOpenSmartGenerator}
          title="Metinden / Konudan Otomatik Görsel Harita Üret"
          className="hidden h-8 items-center gap-1.5 rounded-xl bg-amber-500/15 px-2.5 text-xs font-extrabold text-amber-700 hover:bg-amber-500/25 active:scale-95 lg:flex dark:text-amber-300"
        >
          <Wand2 className="h-3.5 w-3.5" />
          <span className="hidden 2xl:inline">Metinden Harita</span>
        </button>

        {/* Focus Mode */}
        <button
          type="button"
          onClick={onToggleFocusMode}
          title="Odak Modu: Seçili ana dal dışındakileri %20 opaklığa düşürür"
          className={`flex h-8 items-center gap-1.5 rounded-xl px-2 text-xs font-bold active:scale-95 ${
            focusModeActive
              ? 'bg-sky-500 text-white shadow-sm'
              : 'hover:bg-slate-500/10'
          }`}
        >
          <Target className="h-4 w-4" />
          <span className="hidden 2xl:inline">Odak</span>
        </button>

        {/* Study Timer / Counter Toggle Button */}
        <button
          type="button"
          data-testid="hud-timer-toggle-btn"
          onClick={() => setShowStudyTimer((v) => !v)}
          title="Çalışma Sayacı & Kronometre (Başlat / Sıfırla)"
          className={`flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-bold active:scale-95 ${
            showStudyTimer || timerRunning || timerSeconds > 0
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'hover:bg-slate-500/10'
          }`}
        >
          <Timer className="h-4 w-4" />
          {(timerRunning || timerSeconds > 0) && (
            <span className="font-mono text-[10.5px] font-black tabular-nums">
              {formattedTimer}
            </span>
          )}
        </button>

        {/* Active Recall / Exam Mode Dropdown */}
        <div ref={examRef} className="relative">
          <button
            type="button"
            onClick={() => setExamMenuOpen((v) => !v)}
            title="Aktif Hatırlama / Sınav Modu"
            className={`flex h-8 items-center gap-1.5 rounded-xl px-2 text-xs font-bold active:scale-95 ${
              examMode !== 'off'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'hover:bg-slate-500/10'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span className="hidden 2xl:inline">Sınav</span>
            {examMode !== 'off' && (
              <span className="rounded-md bg-white/20 px-1 text-[10px] lg:hidden">
                {examStats.revealed}/{examStats.total}
              </span>
            )}
          </button>

          {examMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-68 rounded-2xl border p-2 shadow-xl backdrop-blur-xl"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <div className="px-2.5 py-1.5 text-[11px] font-extrabold tracking-wider uppercase opacity-60">
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
                    title: 'Temel Önizleme: Metinleri Gizle',
                    desc: 'Çıkartmaya bakıp terimi hatırla, dokununca aç',
                    proOnly: false,
                  },
                  {
                    id: 'hide_visuals_children',
                    title: 'Tam Sınav Modu: Görsel & Alt Dalları Gizle',
                    desc: 'Ana başlığa bakıp tüm alt dalları ve şemaları hatırla',
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
                  className={`mt-1 flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left ${
                    examMode === opt.id
                      ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                      : 'hover:bg-slate-500/10'
                  }`}
                >
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current">
                    {examMode === opt.id && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span>{opt.title}</span>
                      {opt.proOnly && !isLifetimePro && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-extrabold text-amber-600 dark:text-amber-400">
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] opacity-70">{opt.desc}</div>
                  </div>
                </button>
              ))}

              {examMode !== 'off' && (
                <button
                  type="button"
                  onClick={() => {
                    onResetExamReveals();
                    setExamMenuOpen(false);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500/15 py-2 text-xs font-bold text-amber-600 hover:bg-amber-500/25 dark:text-amber-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Açılan Kartları Sıfırla ({examStats.revealed}/{examStats.total})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Smart Auto-Layout */}
        <button
          type="button"
          onClick={onAutoLayout}
          title="Akıllı Otomatik Düzen (Çakışmaları Çöz)"
          className="hidden h-8 items-center gap-1 rounded-xl px-2 text-xs font-bold hover:bg-slate-500/10 active:scale-95 sm:flex"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="hidden 2xl:inline">Düzenle</span>
        </button>

        {/* Fit to Screen */}
        <button
          type="button"
          onClick={onFitToScreen}
          title={`Ekrana Sığdır (%${zoomPercent})`}
          className="hidden h-8 items-center gap-1 rounded-xl px-2 text-xs font-semibold hover:bg-slate-500/10 md:flex"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="text-[11px] tabular-nums opacity-75">{zoomPercent}%</span>
        </button>

        {/* Dark Study Mode */}
        <button
          type="button"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Açık Defter Modu' : 'Karanlık Çalışma Modu'}
          className="hidden h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10 md:flex"
        >
          {darkMode ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Mobile/Tablet Compact Overflow Menu */}
        <div ref={moreRef} className="relative md:hidden">
          <button
            type="button"
            onClick={() => setMoreMenuOpen((v) => !v)}
            title="Hızlı Tuval Araçları"
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {moreMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl border p-2 shadow-xl backdrop-blur-xl"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  onOpenOutline();
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300"
              >
                <ListTree className="h-4 w-4" />
                Anahat & Uzun Notlar Listesi
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenSmartGenerator();
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-500/10 dark:text-amber-300"
              >
                <Wand2 className="h-4 w-4" />
                Metinden Otomatik Harita Üret
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleDefaultNodeStyle();
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-500/10"
              >
                <Layers className="h-4 w-4 text-emerald-500" />
                Stil: {defaultNodeStyle === 'organic' ? 'Modern Kart Modu' : 'Organik Çıkartma Modu'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onAutoLayout();
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-500/10"
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
                Otomatik Radyal Düzen
              </button>
              <button
                type="button"
                onClick={() => {
                  onFitToScreen();
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-500/10"
              >
                <Maximize2 className="h-4 w-4 text-sky-500" />
                Haritayı Merkeze Sığdır ({zoomPercent}%)
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleDarkMode();
                  setMoreMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-500/10"
              >
                {darkMode ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-500" />
                )}
                {darkMode ? 'Açık Kağıt Zemini' : 'Karanlık Çalışma Modu'}
              </button>
              <div className="my-1 h-px bg-slate-400/20" />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onUndo();
                    setMoreMenuOpen(false);
                  }}
                  disabled={!canUndo}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold hover:bg-slate-500/10 disabled:opacity-35"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Geri Al
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRedo();
                    setMoreMenuOpen(false);
                  }}
                  disabled={!canRedo}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold hover:bg-slate-500/10 disabled:opacity-35"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                  Yinele
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Collaborator Avatars Stack */}
        <div className="hidden items-center -space-x-1.5 pl-1 xl:flex">
          {collaborators.slice(0, 4).map((peer) => (
            <div
              key={peer.id}
              title={peer.isLocal ? 'Sen (Çevrimiçi)' : `${peer.name} (Canlı Ortak Çalışma)`}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-extrabold text-white shadow-xs dark:border-slate-900"
              style={{ backgroundColor: peer.color }}
            >
              {peer.avatarInitials}
            </div>
          ))}
        </div>

        {/* Pro Status / Unlock Pill */}
        {!isLifetimePro ? (
          <button
            type="button"
            onClick={() => onTriggerPaywall('header_pill')}
            data-testid="hud-pro-pill"
            title="ZihinHaritam Pro Planlarını Gör"
            className="hidden h-8 items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/12 px-2 text-[11px] font-extrabold text-amber-700 hover:bg-amber-500/20 active:scale-95 md:inline-flex dark:text-amber-300"
          >
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            <span>{localizedPrice}</span>
          </button>
        ) : (
          <span
            data-testid="hud-pro-active-badge"
            className="hidden h-8 items-center gap-1 rounded-xl bg-amber-500/12 px-2 text-[11px] font-extrabold text-amber-600 lg:inline-flex dark:text-amber-400"
          >
            <Crown className="h-3 w-3" />
            <span>Pro</span>
          </span>
        )}

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          data-testid="hud-settings-btn"
          title="Ayarlar, Yedekleme & Lisans"
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10 active:scale-95"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Share & High-Res Export Button */}
        <button
          type="button"
          onClick={onOpenExport}
          title="300 DPI PDF / PNG / SVG Çıktı ve Canlı Paylaşım"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95 lg:px-3 dark:bg-sky-500 dark:text-slate-950"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Paylaş</span>
        </button>
      </div>
    </header>
  );
});
