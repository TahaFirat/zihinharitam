import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Crown,
  Download,
  FolderInput,
  FolderPlus,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Upload,
  Wand2,
  Workflow,
  X,
} from 'lucide-react';
import { APP_RELEASE_CONFIG } from '../config/appReleaseConfig';
import { BrandLogo } from './BrandLogo';
import { generateMapThumbnailDataUrl } from '../core/canvas/ThumbnailGenerator';
import { useEntitlements } from '../core/monetization/EntitlementManager';
import { useI18n } from '../core/i18n/i18n';
import { hapticLight, shareOrDownloadFile } from '../core/native/NativeBridge';
import { normalizeTrToken } from '../core/visuals/SemanticTaxonomyTR';
import { ACADEMIC_TEMPLATES } from '../data/academicTemplates';
import { FLOWCHART_TEMPLATES } from '../data/flowchartTemplates';
import {
  DEPARTMENT_LABELS,
  type AcademicDepartment,
  type CustomUserFolder,
  type MindMapDocument,
  type MindMapFolder,
  type PaywallTriggerReason,
} from '../types/mindmap';

export type WorkspaceFolderFilter =
  | 'all'
  | 'flowcharts'
  | 'pinned'
  | 'study_exam'
  | 'engineering'
  | 'trash'
  | (string & {});

interface HomeWorkspaceProps {
  maps: MindMapDocument[];
  activeMapId: string;
  customFolders: CustomUserFolder[];
  onCreateCustomFolder: (name: string, emoji: string, color: string) => void;
  onDeleteCustomFolder: (folderId: string) => void;
  onOpenMap: (map: MindMapDocument) => void;
  onCreateBlankMap: (title: string, department: AcademicDepartment) => void;
  onCreateBlankFlowchart: (title: string, department: AcademicDepartment) => void;
  onCreateFromTemplate: (templateId: string) => void;
  onCreateFromFlowchartTemplate: (templateId: string) => void;
  onOpenSmartMapGenerator: () => void;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onDuplicateMap: (map: MindMapDocument) => void;
  onTogglePinMap: (mapId: string) => void;
  onChangeMapFolder: (mapId: string, folder: MindMapFolder) => void;
  onMoveToTrash: (mapId: string) => void;
  onRestoreFromTrash: (mapId: string) => void;
  onDeletePermanently: (mapId: string) => void;
  onImportZihinFile: (rawJson: string) => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onTriggerPaywall: (reason: PaywallTriggerReason) => void;
}

function formatRelativeDateTr(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Az önce';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} gün önce`;
  return new Date(ts).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
}

export const HomeWorkspace: React.FC<HomeWorkspaceProps> = ({
  maps,
  activeMapId,
  customFolders,
  onCreateCustomFolder,
  onDeleteCustomFolder,
  onOpenMap,
  onCreateBlankMap,
  onCreateBlankFlowchart,
  onCreateFromTemplate,
  onCreateFromFlowchartTemplate,
  onOpenSmartMapGenerator,
  onRenameMap,
  onDuplicateMap,
  onTogglePinMap,
  onChangeMapFolder,
  onMoveToTrash,
  onRestoreFromTrash,
  onDeletePermanently,
  onImportZihinFile,
  onOpenGuide,
  onOpenSettings,
  onTriggerPaywall,
}) => {
  const { t, isEn } = useI18n();
  const { isLifetimePro, localizedPrice } = useEntitlements();
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<WorkspaceFolderFilter>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Clean new-map / new-flowchart, custom-folder & free permanent-delete modal state
  const [newMapPromptOpen, setNewMapPromptOpen] = useState(false);
  const [newDocKind, setNewDocKind] = useState<'mindmap' | 'flowchart'>('mindmap');
  const [newMapTitle, setNewMapTitle] = useState('');
  const [newMapDept, setNewMapDept] = useState<AcademicDepartment>('genel');
  const [confirmPermanentDeleteMap, setConfirmPermanentDeleteMap] = useState<MindMapDocument | null>(null);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderEmoji, setNewFolderEmoji] = useState('📁');
  const [newFolderColor, setNewFolderColor] = useState('#0EA5E9');

  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLifetimePro && folderFilter === 'trash') {
      setFolderFilter('all');
    }
  }, [isLifetimePro, folderFilter]);

  useEffect(() => {
    const closeMenu = () => setMenuOpenId(null);
    window.addEventListener('pointerdown', closeMenu);
    return () => window.removeEventListener('pointerdown', closeMenu);
  }, []);

  const activeMaps = useMemo(
    () => maps.filter((m) => !m.deletedAt),
    [maps]
  );
  const trashedMaps = useMemo(
    () => maps.filter((m) => Boolean(m.deletedAt)),
    [maps]
  );

  const activeMapsCount = activeMaps.length;
  const freeLimit = APP_RELEASE_CONFIG.quotas.freeActiveMapsLimit;

  const filteredCards = useMemo(() => {
    const normQ = normalizeTrToken(searchQuery.trim());
    const sourceList = folderFilter === 'trash' ? trashedMaps : activeMaps;

    return sourceList
      .filter((m) => {
        if (folderFilter === 'pinned' && !m.isPinned) return false;
        if (folderFilter === 'flowcharts' && m.documentType !== 'flowchart') return false;
        if (
          folderFilter !== 'all' &&
          folderFilter !== 'pinned' &&
          folderFilter !== 'flowcharts' &&
          folderFilter !== 'trash' &&
          m.folder !== folderFilter
        ) {
          return false;
        }

        if (!normQ) return true;
        if (normalizeTrToken(m.title).includes(normQ)) return true;

        for (const node of Object.values(m.nodes || {})) {
          if (normalizeTrToken(node.title).includes(normQ)) return true;
          if (node.subtitle && normalizeTrToken(node.subtitle).includes(normQ)) {
            return true;
          }
        }
        if (m.flowchart?.nodes) {
          for (const fn of m.flowchart.nodes) {
            if (normalizeTrToken(fn.title).includes(normQ)) return true;
          }
        }
        return false;
      })
      .map((m) => {
        let matchedNodeTitle: string | null = null;
        if (normQ && !normalizeTrToken(m.title).includes(normQ)) {
          const hit = Object.values(m.nodes || {}).find((n) =>
            normalizeTrToken(n.title).includes(normQ)
          );
          if (hit) matchedNodeTitle = hit.title;
        }
        return { map: m, matchedNodeTitle };
      })
      .sort((a, b) => {
        if (folderFilter !== 'trash') {
          if (Boolean(a.map.isPinned) !== Boolean(b.map.isPinned)) {
            return a.map.isPinned ? -1 : 1;
          }
        }
        return b.map.updatedAt - a.map.updatedAt;
      });
  }, [activeMaps, trashedMaps, folderFilter, searchQuery]);

  const handleClickNewBlankMap = () => {
    void hapticLight();
    if (!isLifetimePro && activeMapsCount >= freeLimit) {
      onTriggerPaywall('map_limit');
      return;
    }
    setNewDocKind('mindmap');
    setNewMapTitle('');
    setNewMapDept('genel');
    setNewMapPromptOpen(true);
  };

  const handleClickNewBlankFlowchart = () => {
    void hapticLight();
    if (!isLifetimePro && activeMapsCount >= freeLimit) {
      onTriggerPaywall('map_limit');
      return;
    }
    setNewDocKind('flowchart');
    setNewMapTitle('');
    setNewMapDept('sistem_tasarimi');
    setNewMapPromptOpen(true);
  };

  const handleConfirmBlankMap = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newDocKind === 'flowchart') {
      const finalTitle = newMapTitle.trim() || t('Yeni Akış Diyagramı', 'New Flowchart');
      setNewMapPromptOpen(false);
      onCreateBlankFlowchart(finalTitle, newMapDept);
      return;
    }
    const finalTitle = newMapTitle.trim() || t('Yeni Görsel Harita', 'New Visual Map');
    setNewMapPromptOpen(false);
    onCreateBlankMap(finalTitle, newMapDept);
  };

  const handleExportSingleZihin = async (m: MindMapDocument) => {
    const slug =
      m.title
        .toLocaleLowerCase('tr-TR')
        .replace(/[^a-z0-9ğüşıöç]+/gi, '-')
        .replace(/^-|-$/g, '') || 'harita';
    const blob = new Blob([JSON.stringify(m, null, 2)], {
      type: 'application/json',
    });
    await shareOrDownloadFile(blob, `${slug}.zihin`, 'application/json', m.title);
  };

  return (
    <div
      className="flex h-[100dvh] w-[100vw] flex-col overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--canvas-bg)',
        color: 'var(--text-primary)',
      }}
      data-testid="home-workspace"
    >
      {/* Top Minimal Header */}
      <header
        className="shrink-0 border-b px-4 pb-3 sm:px-6"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          borderColor: 'var(--hud-border)',
          backgroundColor: 'var(--hud-bg)',
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2.5">
          {/* App Brand Logo */}
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div>
              <h1 className="text-base leading-tight font-black tracking-tight sm:text-lg">
                {APP_RELEASE_CONFIG.appName}
              </h1>
              <p className="hidden text-[11px] font-medium opacity-65 sm:block">
                Görsel Zihin Haritası & Çizim Defteri
              </p>
            </div>
          </div>

          {/* Search Input (Desktop/Tablet inline) */}
          <div className="order-3 w-full sm:order-2 sm:max-w-xs md:max-w-sm lg:max-w-md">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-45" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Harita adı veya içindeki konuyu ara..."
                className="allow-text-input min-h-[44px] w-full rounded-2xl border bg-slate-500/5 py-2 pr-8 pl-9 text-base font-semibold outline-none focus:ring-2 focus:ring-sky-500 sm:text-sm"
                style={{ borderColor: 'var(--hud-border)' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Aramayı temizle"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right Actions: Pro Pill + Settings */}
          <div className="order-2 flex items-center gap-2 sm:order-3">
            {isLifetimePro ? (
              <span
                data-testid="home-pro-active-badge"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl border border-amber-500/35 bg-amber-500/12 px-3 py-1.5 text-xs font-extrabold text-amber-600 dark:text-amber-400"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Pro</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onTriggerPaywall('header_pill')}
                data-testid="home-pro-pill"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 text-xs font-extrabold text-amber-700 transition hover:bg-amber-500/20 active:scale-95 dark:text-amber-300"
              >
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span>Kilidi Aç • {localizedPrice}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenGuide}
              data-testid="home-guide-btn"
              title="Uygulama Tanıtımı & Nasıl Kullanılır?"
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl border px-3 text-xs font-extrabold hover:bg-sky-500/10 hover:text-sky-600 active:scale-95 dark:hover:text-sky-300"
              style={{ borderColor: 'var(--hud-border)' }}
            >
              <HelpCircle className="h-4.5 w-4.5 text-sky-500" />
              <span className="hidden sm:inline">Rehber</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              data-testid="home-settings-btn"
              title="Ayarlar, Yedekleme ve Yasal Bilgiler"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border hover:bg-slate-500/10 active:scale-95"
              style={{ borderColor: 'var(--hud-border)' }}
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Workspace Content */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-6"
        style={{ paddingBottom: 'max(36px, calc(var(--safe-bottom) + 28px))' }}
      >
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Quick Start Actions + Academic Templates Strip */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-extrabold tracking-wider uppercase opacity-65">
                Hemen Başla & Hazır Şablonlar
              </h2>

              {/* Free Tier Transparent Map Counter (Clean & Simple) */}
              {!isLifetimePro && (
                <button
                  type="button"
                  onClick={() => onTriggerPaywall('map_limit')}
                  data-testid="free-map-quota-badge"
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-bold hover:bg-slate-500/5 active:scale-95"
                  style={{
                    backgroundColor: 'var(--hud-bg)',
                    borderColor: 'var(--hud-border)',
                  }}
                >
                  <span>
                    Ücretsiz Hak:{' '}
                    <strong>
                      {Math.min(activeMapsCount, freeLimit)} / {freeLimit}
                    </strong>{' '}
                    Harita
                  </span>
                  <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-400/25">
                    <span
                      className="block h-full rounded-full bg-amber-500 transition-all"
                      style={{
                        width: `${Math.min(100, (activeMapsCount / freeLimit) * 100)}%`,
                      }}
                    />
                  </span>
                </button>
              )}
            </div>

            {/* Horizontal Quick Creation & Ready Templates Strip */}
            <div className="no-scrollbar flex items-stretch gap-3 overflow-x-auto pb-1">
              {/* 1. Blank Visual Map */}
              <button
                type="button"
                onClick={handleClickNewBlankMap}
                data-testid="create-blank-map-btn"
                className="flex min-h-[104px] w-46 shrink-0 flex-col justify-between rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 p-4 text-left text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] dark:from-sky-500 dark:to-blue-600 dark:text-slate-950"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/18 dark:bg-slate-950/15">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold">{t('+ Yeni Harita', '+ Mind Map')}</div>
                  <div className="text-[11px] opacity-80">
                    {t('Zihin haritasıyla başla', 'Start visual mind map')}
                  </div>
                </div>
              </button>

              {/* 1b. Dedicated Blank Flowchart Studio */}
              <button
                type="button"
                onClick={handleClickNewBlankFlowchart}
                data-testid="create-blank-flowchart-btn"
                className="flex min-h-[104px] w-46 shrink-0 flex-col justify-between rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-left text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold">{t('+ Akış Diyagramı', '+ Flowchart')}</div>
                  <div className="text-[11px] opacity-85">
                    {t('Süreç, karar & algoritma', 'Process, decision & flow')}
                  </div>
                </div>
              </button>

              {/* 2. Text / Outline to Mind Map */}
              <button
                type="button"
                onClick={onOpenSmartMapGenerator}
                data-testid="home-smart-map-btn"
                className="flex min-h-[104px] w-46 shrink-0 flex-col justify-between rounded-2xl border p-4 text-left transition hover:border-amber-500/50 hover:bg-amber-500/5 active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--hud-bg)',
                  borderColor: 'var(--hud-border)',
                }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Wand2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold">Metinden Harita</div>
                  <div className="text-[11px] opacity-65">
                    Notu otomatik haritaya çevir
                  </div>
                </div>
              </button>

              {/* 3. Import .zihin Backup */}
              <input
                ref={importInputRef}
                type="file"
                accept=".zihin,.json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => onImportZihinFile(String(reader.result));
                  reader.readAsText(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="flex min-h-[104px] w-38 shrink-0 flex-col justify-between rounded-2xl border border-dashed p-4 text-left transition hover:bg-slate-500/5 active:scale-[0.98]"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold">Yedek Yükle</div>
                  <div className="text-[11px] opacity-65">.zihin dosyası aç</div>
                </div>
              </button>

              {/* 4. 5 Flagship Academic Templates */}
              {ACADEMIC_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onCreateFromTemplate(tpl.id)}
                  data-testid={`template-card-${tpl.id}`}
                  className="relative flex min-h-[112px] w-56 shrink-0 flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-sky-500/45 hover:shadow-md active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--hud-bg)',
                    borderColor: 'var(--hud-border)',
                  }}
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1 opacity-90"
                    style={{ backgroundColor: tpl.accentColor }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold">{tpl.badge}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white"
                      style={{ backgroundColor: tpl.accentColor }}
                    >
                      Şablon
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="line-clamp-1 text-xs font-extrabold">{tpl.title}</div>
                    <div className="mt-0.5 line-clamp-1 text-[11px] opacity-65">
                      {tpl.description}
                    </div>
                  </div>
                </button>
              ))}

              {/* 5. Ready Flowchart Templates */}
              {FLOWCHART_TEMPLATES.map((ftpl) => (
                <button
                  key={ftpl.id}
                  type="button"
                  onClick={() => onCreateFromFlowchartTemplate(ftpl.id)}
                  data-testid={`flowchart-template-${ftpl.id}`}
                  className="relative flex min-h-[112px] w-56 shrink-0 flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-emerald-500/45 hover:shadow-md active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--hud-bg)',
                    borderColor: 'var(--hud-border)',
                  }}
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1 opacity-90"
                    style={{ backgroundColor: ftpl.accentColor }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold">
                      <Workflow className="h-3.5 w-3.5" style={{ color: ftpl.accentColor }} />
                      {isEn ? ftpl.categoryEn : ftpl.categoryTr}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white"
                      style={{ backgroundColor: ftpl.accentColor }}
                    >
                      {t('Akış', 'Flow')}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="line-clamp-1 text-xs font-extrabold">
                      {isEn ? ftpl.titleEn : ftpl.titleTr}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[11px] opacity-65">
                      {isEn ? ftpl.subtitleEn : ftpl.subtitleTr}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Folder, Flowchart & Custom Folder Tabs */}
          <section className="space-y-4">
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b pb-2.5" style={{ borderColor: 'var(--hud-border)' }}>
              {[
                { id: 'all', label: `${t('Tümü', 'All')} (${activeMaps.length})` },
                {
                  id: 'flowcharts',
                  label: `🔀 ${t('Akış Diyagramları', 'Flowcharts')} (${activeMaps.filter((m) => m.documentType === 'flowchart').length})`,
                },
                { id: 'pinned', label: `📌 ${t('Sabitlenenler', 'Pinned')}` },
                { id: 'study_exam', label: `📚 ${t('Ders & Sınav', 'Study & Exam')}` },
                { id: 'engineering', label: `💻 ${t('Mühendislik', 'Engineering')}` },
                ...customFolders.map((cf) => ({
                  id: cf.id,
                  label: `${cf.emoji} ${cf.name}`,
                  custom: cf,
                })),
                ...(isLifetimePro
                  ? [
                      {
                        id: 'trash',
                        label: `🗑️ ${t('Çöp Kutusu', 'Trash')} (${trashedMaps.length})`,
                      },
                    ]
                  : []),
              ].map((tab) => {
                const active = folderFilter === tab.id;
                const customFolder = 'custom' in tab ? tab.custom : undefined;
                return (
                  <div key={tab.id} className="inline-flex shrink-0 items-center">
                    <button
                      type="button"
                      data-testid={`folder-tab-${tab.id}`}
                      onClick={() => setFolderFilter(tab.id)}
                      className={`min-h-[40px] shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                        active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                          : 'opacity-70 hover:bg-slate-500/10 hover:opacity-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                    {customFolder && active && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteCustomFolder(customFolder.id);
                          setFolderFilter('all');
                        }}
                        title={t('Klasörü Sil', 'Delete Folder')}
                        className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                data-testid="create-custom-folder-btn"
                onClick={() => {
                  void hapticLight();
                  setNewFolderName('');
                  setNewFolderEmoji('📁');
                  setNewFolderColor('#0EA5E9');
                  setNewFolderModalOpen(true);
                }}
                className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl border border-dashed px-3 py-1.5 text-xs font-extrabold text-sky-600 hover:bg-sky-500/10 dark:text-sky-300"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>{t('+ Klasör', '+ Folder')}</span>
              </button>
            </div>

            {folderFilter === 'trash' && trashedMaps.length > 0 && (
              <p className="text-xs opacity-65">
                Çöp kutusundaki haritalar 30 gün boyunca saklanır; yanlışlıkla sildiğiniz sınav notlarını istediğiniz an geri yükleyebilirsiniz.
              </p>
            )}

            {/* Map Cards Grid */}
            {filteredCards.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-14 text-center"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <p className="text-sm font-bold opacity-75">
                  {folderFilter === 'trash'
                    ? 'Çöp kutusu boş.'
                    : searchQuery
                    ? `“${searchQuery}” aramasıyla eşleşen harita veya dal bulunamadı.`
                    : 'Bu klasörde henüz bir harita yok.'}
                </p>
                {folderFilter !== 'trash' && !searchQuery && (
                  <button
                    type="button"
                    onClick={handleClickNewBlankMap}
                    className="mt-3 inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white dark:bg-sky-500 dark:text-slate-950"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Yeni Görsel Harita Oluştur</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCards.map(({ map, matchedNodeTitle }) => {
                  const nodeCount = Object.keys(map.nodes || {}).length;
                  const deptInfo =
                    DEPARTMENT_LABELS[map.department] ?? DEPARTMENT_LABELS.genel;
                  const thumbUrl =
                    map.thumbnailDataUrl || generateMapThumbnailDataUrl(map);
                  const isTrashed = Boolean(map.deletedAt);
                  const isMenuOpen = menuOpenId === map.id;
                  const isRenaming = renamingId === map.id;

                  return (
                    <div
                      key={map.id}
                      data-testid={`workspace-map-card-${map.id}`}
                      className={`group relative flex flex-col overflow-hidden rounded-3xl border transition hover:shadow-md ${
                        map.id === activeMapId && !isTrashed
                          ? 'ring-2 ring-sky-500/40'
                          : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--hud-bg)',
                        borderColor: 'var(--hud-border)',
                      }}
                    >
                      {/* Live 480x320 WebP Thumbnail Preview */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!isTrashed) onOpenMap(map);
                        }}
                        disabled={isTrashed}
                        className="relative aspect-[3/2] w-full overflow-hidden border-b bg-slate-500/5 text-left"
                        style={{ borderColor: 'var(--hud-border)' }}
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={map.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-3xl">
                            {deptInfo.emoji}
                          </div>
                        )}

                        {map.documentType === 'flowchart' && !isTrashed && (
                          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-xs backdrop-blur-xs">
                            <Workflow className="h-2.5 w-2.5" />
                            {t('Akış Diyagramı', 'Flowchart')}
                          </span>
                        )}

                        {map.isPinned && !isTrashed && (
                          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-extrabold text-white backdrop-blur-xs">
                            <Pin className="h-2.5 w-2.5" />
                            Sabitli
                          </span>
                        )}

                        {matchedNodeTitle && (
                          <span className="absolute bottom-2 left-2.5 max-w-[85%] truncate rounded-lg bg-sky-600/90 px-2 py-0.5 text-[10.5px] font-bold text-white shadow-xs">
                            Dal eşleşmesi: {matchedNodeTitle}
                          </span>
                        )}
                      </button>

                      {/* Card Footer Metadata & Context Menu */}
                      <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (renameDraft.trim()) {
                                  onRenameMap(map.id, renameDraft.trim());
                                }
                                setRenamingId(null);
                              }}
                            >
                              <input
                                type="text"
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onBlur={() => {
                                  if (renameDraft.trim()) {
                                    onRenameMap(map.id, renameDraft.trim());
                                  }
                                  setRenamingId(null);
                                }}
                                autoFocus
                                className="allow-text-input w-full rounded-lg border px-2 py-1 text-sm font-extrabold outline-none focus:ring-2 focus:ring-sky-500"
                                style={{ borderColor: 'var(--hud-border)' }}
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!isTrashed) onOpenMap(map);
                              }}
                              className="block w-full truncate text-left text-sm font-extrabold hover:text-sky-600 dark:hover:text-sky-400"
                            >
                              {map.title || 'Yeni Görsel Harita'}
                            </button>
                          )}

                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] opacity-70">
                            <span>
                              {map.documentType === 'flowchart' && map.flowchart
                                ? `🔀 ${map.flowchart.nodes.length} ${t('blok', 'blocks')} • ${map.flowchart.edges.length} ${t('ok', 'edges')}`
                                : `${deptInfo.emoji} ${nodeCount} ${t('dal', 'nodes')}`}
                            </span>
                            {(() => {
                              const allN = Object.values(map.nodes || {});
                              const totalChecks = allN.filter((n) => typeof n.checked === 'boolean').length;
                              if (totalChecks === 0) return null;
                              const doneChecks = allN.filter((n) => n.checked === true).length;
                              return (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                                  ✓ {doneChecks}/{totalChecks}
                                </span>
                              );
                            })()}
                            <span>•</span>
                            <span>{formatRelativeDateTr(map.updatedAt)}</span>
                          </div>
                        </div>

                        {isTrashed ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onRestoreFromTrash(map.id)}
                              title="Haritayı Geri Yükle"
                              data-testid={`restore-trash-${map.id}`}
                              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-emerald-500/15 px-2.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Geri Yükle</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePermanently(map.id)}
                              title="Kalıcı Olarak Sil"
                              className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="relative"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setMenuOpenId((prev) =>
                                  prev === map.id ? null : map.id
                                )
                              }
                              aria-label="Harita Seçenekleri"
                              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-500/10"
                            >
                              <MoreHorizontal className="h-4.5 w-4.5" />
                            </button>

                            {isMenuOpen && (
                              <div
                                className="absolute right-0 bottom-12 z-30 w-52 rounded-2xl border p-1.5 shadow-xl backdrop-blur-xl"
                                style={{
                                  backgroundColor: 'var(--canvas-bg)',
                                  borderColor: 'var(--hud-border)',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenameDraft(map.title);
                                    setRenamingId(map.id);
                                    setMenuOpenId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-slate-500/10"
                                >
                                  <Pencil className="h-3.5 w-3.5 opacity-70" />
                                  <span>Yeniden Adlandır</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onDuplicateMap(map);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-slate-500/10"
                                >
                                  <Copy className="h-3.5 w-3.5 opacity-70" />
                                  <span>Çoğalt (Kopya Oluştur)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onTogglePinMap(map.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-slate-500/10"
                                >
                                  <Pin className="h-3.5 w-3.5 opacity-70" />
                                  <span>
                                    {map.isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    const nextFolder: MindMapFolder =
                                      map.folder === 'engineering'
                                        ? 'study_exam'
                                        : 'engineering';
                                    onChangeMapFolder(map.id, nextFolder);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-slate-500/10"
                                >
                                  <FolderInput className="h-3.5 w-3.5 opacity-70" />
                                    <span>
                                      {map.folder === 'engineering'
                                        ? t('Ders & Sınav Klasörüne Al', 'Move to Study & Exam')
                                        : t('Mühendislik Klasörüne Al', 'Move to Engineering')}
                                    </span>
                                  </button>
                                  {customFolders.map((cf) => (
                                    <button
                                      key={cf.id}
                                      type="button"
                                      onClick={() => {
                                        setMenuOpenId(null);
                                        onChangeMapFolder(map.id, cf.id);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-slate-500/10"
                                    >
                                      <span>{cf.emoji}</span>
                                      <span className="truncate">
                                        {t(`${cf.name} Klasörüne Al`, `Move to ${cf.name}`)}
                                      </span>
                                    </button>
                                  ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void handleExportSingleZihin(map);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-slate-500/10"
                                >
                                  <Download className="h-3.5 w-3.5 opacity-70" />
                                  <span>.zihin Yedek İndir</span>
                                </button>
                                <div className="my-1 h-px bg-slate-500/15" />
                                <button
                                  type="button"
                                  data-testid={`delete-map-btn-${map.id}`}
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    if (isLifetimePro) {
                                      onMoveToTrash(map.id);
                                    } else {
                                      setConfirmPermanentDeleteMap(map);
                                    }
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-500 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>{isLifetimePro ? 'Çöpe Taşı' : 'Kalıcı Olarak Sil'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Clean New Blank Map Dialog */}
      {newMapPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          onClick={() => setNewMapPromptOpen(false)}
        >
          <form
            onSubmit={handleConfirmBlankMap}
            onClick={(e) => e.stopPropagation()}
            data-testid="new-map-dialog"
            className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
            style={{
              backgroundColor: 'var(--canvas-bg)',
              borderColor: 'var(--hud-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                {newDocKind === 'flowchart'
                  ? t('Yeni Akış Diyagramı', 'New Flowchart Diagram')
                  : t('Yeni Görsel Zihin Haritası', 'New Visual Mind Map')}
              </h3>
              <button
                type="button"
                onClick={() => setNewMapPromptOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-3 block text-xs font-bold opacity-75">
              {newDocKind === 'flowchart'
                ? t('Akış Diyagramı Başlığı', 'Flowchart Title')
                : t('Merkez Konu Başlığı', 'Central Topic Title')}
            </label>
            <input
              type="text"
              value={newMapTitle}
              onChange={(e) => setNewMapTitle(e.target.value)}
              placeholder={
                newDocKind === 'flowchart'
                  ? t('Örn: Ödeme Süreci, Klinik Tanı Algoritması...', 'e.g. Checkout Flow, Triage Algorithm...')
                  : t('Örn: Kardiyoloji Semiyolojisi, Mikroservis Mimarisi...', 'e.g. Cardiology Notes, System Design...')
              }
              autoFocus
              data-testid="new-map-title-input"
              className="allow-text-input mt-1.5 min-h-[44px] w-full rounded-xl border bg-transparent px-3.5 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-sky-500 sm:text-sm"
              style={{ borderColor: 'var(--hud-border)' }}
            />

            <label className="mt-3 block text-xs font-bold opacity-75">
              Alan / Ders Bağlamı (Çıkartma zekasını optimize eder)
            </label>
            <select
              value={newMapDept}
              onChange={(e) => setNewMapDept(e.target.value as AcademicDepartment)}
              className="mt-1.5 min-h-[42px] w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none"
              style={{
                backgroundColor: 'var(--canvas-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              {Object.entries(DEPARTMENT_LABELS).map(([k, val]) => (
                <option key={k} value={k}>
                  {val.emoji} {val.label}
                </option>
              ))}
            </select>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewMapPromptOpen(false)}
                className="min-h-[42px] rounded-xl px-4 text-xs font-bold opacity-75 hover:bg-slate-500/10"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                data-testid="new-map-confirm-btn"
                className="min-h-[42px] rounded-xl bg-slate-900 px-5 text-xs font-extrabold text-white shadow-xs active:scale-95 dark:bg-sky-500 dark:text-slate-950"
              >
                Haritayı Aç
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Custom Folder Dialog */}
      {newFolderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setNewFolderModalOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = newFolderName.trim();
              if (!clean) return;
              onCreateCustomFolder(clean, newFolderEmoji, newFolderColor);
              setNewFolderModalOpen(false);
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="custom-folder-modal"
            className="w-full max-w-sm rounded-3xl border p-5 shadow-2xl"
            style={{
              backgroundColor: 'var(--canvas-bg)',
              borderColor: 'var(--hud-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">{t('Yeni Özel Klasör', 'New Custom Folder')}</h3>
              <button
                type="button"
                onClick={() => setNewFolderModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('Örn: Anatomi, AYT Tarih, Projeler...', 'e.g. Anatomy, History, Projects...')}
              data-testid="custom-folder-name-input"
              className="allow-text-input mt-3 min-h-[44px] w-full rounded-xl border bg-transparent px-3.5 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
              style={{ borderColor: 'var(--hud-border)' }}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['📁', '🧠', '🩺', '⚖️', '💻', '📐', '🧪', '📜', '🎯', '🚀'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setNewFolderEmoji(em)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition ${
                    newFolderEmoji === em ? 'bg-sky-500/20 ring-2 ring-sky-500' : 'hover:bg-slate-500/10'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewFolderModalOpen(false)}
                className="min-h-[40px] rounded-xl px-4 text-xs font-bold opacity-75 hover:bg-slate-500/10"
              >
                {t('Vazgeç', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                data-testid="custom-folder-confirm-btn"
                className="min-h-[40px] rounded-xl bg-slate-900 px-4 text-xs font-extrabold text-white disabled:opacity-40 dark:bg-sky-500 dark:text-slate-950"
              >
                {t('Klasör Oluştur', 'Create Folder')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Permanent Delete Confirmation for Free Tier (No Trash Hoarding!) */}
      {confirmPermanentDeleteMap && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={() => setConfirmPermanentDeleteMap(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-testid="free-permanent-delete-dialog"
            className="w-full max-w-sm rounded-3xl border p-5 shadow-2xl"
            style={{
              backgroundColor: 'var(--canvas-bg)',
              borderColor: 'var(--hud-border)',
            }}
          >
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold">Harita Kalıcı Olarak Silinsin mi?</h3>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed opacity-80">
              <strong>“{confirmPermanentDeleteMap.title || 'Harita'}”</strong> cihazınızdan
              kalıcı olarak silinecek ve geri alınamayacaktır.
            </p>
            <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              30 gün Çöp Kutusu koruması ve sınırsız harita arşivi ZihinHaritam Pro ile açılır.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPermanentDeleteMap(null)}
                className="min-h-[42px] rounded-xl px-4 text-xs font-bold opacity-75 hover:bg-slate-500/10"
              >
                Vazgeç
              </button>
              <button
                type="button"
                data-testid="confirm-permanent-delete-btn"
                onClick={() => {
                  const id = confirmPermanentDeleteMap.id;
                  setConfirmPermanentDeleteMap(null);
                  onDeletePermanently(id);
                }}
                className="min-h-[42px] rounded-xl bg-rose-600 px-4 text-xs font-extrabold text-white shadow-xs active:scale-95"
              >
                Kalıcı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
