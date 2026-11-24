import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  CornerDownLeft,
  Plus,
  Loader2,
  Gift,
} from 'lucide-react';
import type {
  IconTierFilter,
  MindNode,
  NodeVisualStyle,
  StickerAsset,
  VisualSearchResult,
} from '../types/mindmap';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { normalizeTrToken } from '../core/visuals/SemanticTaxonomyTR';
import { useI18n } from '../core/i18n/i18n';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { dismissNativeKeyboard, useKeyboardInset } from '../core/native/useKeyboardInset';

interface CommandPaletteModalProps {
  isOpen: boolean;
  nodes: Record<string, MindNode>;
  rootNodeId: string;
  selectedNodeId: string | null;
  defaultNodeStyle: NodeVisualStyle;
  mapContext: MapContextAnalysis;
  onClose: () => void;
  onJumpToNode: (node: MindNode) => void;
  onApplyStickerToActive: (sticker: StickerAsset) => void;
  onRequestProStickerUnlock: (item: VisualSearchResult) => void;
  onCreateBranchWithSticker: (title: string, sticker: StickerAsset) => void;
  onAutoLayout: () => void;
  onFitToScreen: () => void;
  onToggleDefaultNodeStyle: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  nodes,
  rootNodeId,
  selectedNodeId,
  mapContext,
  onClose,
  onJumpToNode,
  onApplyStickerToActive,
  onRequestProStickerUnlock,
  onCreateBranchWithSticker,
}) => {
  const { t } = useI18n();
  useEntitlements();
  const kb = useKeyboardInset();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VisualSearchResult[]>([]);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [loadingOffline, setLoadingOffline] = useState(false);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createAsNewBranch, setCreateAsNewBranch] = useState(false);
  const [tierFilter, setTierFilter] = useState<IconTierFilter>('all');

  const seqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const targetNode =
    (selectedNodeId ? nodes[selectedNodeId] : null) ?? nodes[rootNodeId];
  const branchColor = targetNode?.branchColor ?? '#0EA5E9';

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setBrokenIds(new Set());
      setCreateAsNewBranch(false);
      setTierFilter('all');
      if (!kb.isTouchDevice) {
        setTimeout(() => inputRef.current?.focus(), 30);
      }
    }
  }, [isOpen, kb.isTouchDevice]);

  const matchingNodes = useMemo(() => {
    const all = Object.values(nodes);
    const normQ = normalizeTrToken(query);
    if (!normQ) return all.slice(0, 6);
    return all
      .filter((n) => {
        const nt = normalizeTrToken(n.title);
        const ns = n.subtitle ? normalizeTrToken(n.subtitle) : '';
        const nn = n.note ? normalizeTrToken(n.note) : '';
        return nt.includes(normQ) || ns.includes(normQ) || nn.includes(normQ);
      })
      .slice(0, 8);
  }, [nodes, query]);

  useEffect(() => {
    if (!isOpen) return;
    const seq = ++seqRef.current;
    const controller = new AbortController();
    let onlineTimer: number | undefined;

    // Instant <1ms synchronous wave so Search NEVER shows blank on cold boot!
    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      query,
      mapContext,
      branchColor
    );
    if (wave1.results.length > 0) {
      setHits(wave1.results.slice(0, 36));
    }

    setLoadingOffline(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await VisualSearchOrchestrator.searchOfflineWave(
          query,
          mapContext,
          branchColor,
          36
        );
        if (seq !== seqRef.current || controller.signal.aborted) return;
        setHits(res.results);
        setLoadingOffline(false);

        const q = query.trim();
        const needsOnline =
          q.length >= 2 &&
          typeof navigator !== 'undefined' &&
          navigator.onLine &&
          (!res.hasLexiconMatch || res.results.length < 10);

        if (needsOnline) {
          onlineTimer = window.setTimeout(async () => {
            if (seq !== seqRef.current || controller.signal.aborted) return;
            setLoadingOnline(true);
            try {
              const fed = await VisualSearchOrchestrator.searchFederatedGallery(
                q,
                mapContext,
                branchColor,
                controller.signal
              );
              if (seq === seqRef.current && !controller.signal.aborted && fed.results.length > 0) {
                setHits(fed.results.slice(0, 36));
              }
            } finally {
              if (seq === seqRef.current && !controller.signal.aborted) {
                setLoadingOnline(false);
              }
            }
          }, 120);
        } else {
          setLoadingOnline(false);
        }
      } catch {
        if (seq === seqRef.current && !controller.signal.aborted) {
          setLoadingOffline(false);
        }
      }
    }, 18);

    return () => {
      clearTimeout(timer);
      if (onlineTimer !== undefined) clearTimeout(onlineTimer);
      controller.abort();
    };
  }, [isOpen, query, mapContext, branchColor]);

  if (!isOpen) return null;

  const handleCloseClean = () => {
    void dismissNativeKeyboard();
    onClose();
  };

  const handleJump = (n: MindNode) => {
    void hapticLight();
    void dismissNativeKeyboard();
    onClose();
    window.setTimeout(() => onJumpToNode(n), 45);
  };

  const handleChooseVisual = async (item: VisualSearchResult, idx = 0) => {
    if (!EntitlementManager.isStickerFree(item, idx, 'command_palette')) {
      void hapticLight();
      void dismissNativeKeyboard();
      onClose();
      onRequestProStickerUnlock(item);
      return;
    }

    setBusyId(item.id);
    void hapticLight();
    try {
      const sticker = await VisualSearchOrchestrator.materializeStickerSelection(item, {
        retintToBranchColor: item.isDuotoneColorizable ? branchColor : null,
      });
      if (createAsNewBranch) {
        onCreateBranchWithSticker(query.trim() || item.title, sticker);
      } else {
        onApplyStickerToActive(sticker);
      }
      void hapticSuccess();
      void dismissNativeKeyboard();
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const filteredIcons = hits
    .filter((item) => !brokenIds.has(item.id))
    .map((item, origIdx) => ({
      item,
      origIdx,
      isFree: EntitlementManager.isStickerFree(item, origIdx, 'command_palette'),
    }))
    .filter((entry) => (tierFilter === 'free' ? entry.isFree : true));

  return (
    <div
      onClick={handleCloseClean}
      data-testid="command-palette-modal"
      className="fixed top-0 right-0 left-0 z-50 flex items-start justify-center bg-slate-950/55 px-3 backdrop-blur-xs"
      style={{
        bottom: `${kb.keyboardHeight}px`,
        paddingTop: 'max(14px, calc(var(--safe-top) + 10px))',
        paddingBottom: '12px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Clean Single-Row Search Bar */}
        <div
          className="flex shrink-0 items-center gap-2 border-b px-3.5 py-2.5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <Search className="h-4.5 w-4.5 shrink-0 text-sky-500" />
          <input
            ref={inputRef}
            type="text"
            data-testid="command-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCloseClean();
              } else if (e.key === 'Enter') {
                if (matchingNodes.length > 0 && query.trim()) {
                  handleJump(matchingNodes[0]);
                } else if (filteredIcons[0]) {
                  void handleChooseVisual(filteredIcons[0].item, filteredIcons[0].origIdx);
                }
              }
            }}
            placeholder={t('Dal veya ikon ara...', 'Search branches or icons...')}
            className="allow-text-input min-h-[40px] min-w-0 flex-1 bg-transparent text-base font-bold outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label={t('Aramayı temizle', 'Clear search')}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-500/12 hover:bg-slate-500/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label={t('Kapat', 'Close')}
            onClick={handleCloseClean}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Results (Branches + Icons) */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3.5">
          {/* Matching Branches */}
          {matchingNodes.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold tracking-wider uppercase opacity-55">
                {t('Dallar', 'Branches')} ({matchingNodes.length})
              </div>
              <div className="space-y-1">
                {matchingNodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    data-testid={`search-branch-hit-${n.id}`}
                    onClick={() => handleJump(n)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition hover:border-sky-500 hover:bg-sky-500/10 active:scale-[0.99]"
                    style={{ borderColor: 'var(--hud-border)' }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {n.sticker ? (
                        <img
                          src={n.sticker.url}
                          alt=""
                          className="h-7 w-7 shrink-0 object-contain"
                        />
                      ) : (
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: n.branchColor }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-xs font-extrabold sm:text-sm">
                          {n.title || t('İsimsiz Dal', 'Untitled')}
                        </div>
                        {n.subtitle && (
                          <div className="truncate text-[11px] opacity-65">
                            {n.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                      {t('Git', 'Go')} <CornerDownLeft className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Icons */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold tracking-wider uppercase opacity-55">
                  {t('İkonlar', 'Icons')}
                </span>
                {loadingOnline && <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />}
                <button
                  type="button"
                  onClick={() => setTierFilter((p) => (p === 'free' ? 'all' : 'free'))}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
                    tierFilter === 'free'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <Gift className="h-3 w-3" />
                  <span>{t('Ücretsiz', 'Free')}</span>
                </button>
              </div>

              <div className="inline-flex items-center gap-0.5 rounded-xl bg-slate-500/10 p-0.5 text-[11px] font-extrabold">
                <button
                  type="button"
                  onClick={() => setCreateAsNewBranch(false)}
                  className={`rounded-lg px-2 py-1 ${
                    !createAsNewBranch
                      ? 'bg-sky-500 text-white shadow-2xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {t('Seçili Dala', 'Active Branch')}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateAsNewBranch(true)}
                  className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-1 ${
                    createAsNewBranch
                      ? 'bg-emerald-500 text-white shadow-2xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  {t('Yeni Dal', 'New Branch')}
                </button>
              </div>
            </div>

            {filteredIcons.length === 0 && (loadingOffline || loadingOnline) ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-xs font-bold opacity-70">
                <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                <span>{t('İkonlar aranıyor...', 'Searching icons...')}</span>
              </div>
            ) : filteredIcons.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-5 text-center text-xs opacity-70">
                {t('Eşleşen ikon bulunamadı.', 'No matching icons found.')}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {filteredIcons.map(({ item, origIdx, isFree }) => {
                  const isProLocked = !isFree;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={isProLocked ? 'search-pro-icon' : 'search-free-icon'}
                      onClick={() => void handleChooseVisual(item, origIdx)}
                      title={item.title}
                      className={`group relative flex flex-col items-center justify-center rounded-2xl border p-2 transition active:scale-95 ${
                        isProLocked
                          ? 'border-amber-400/60 bg-gradient-to-br from-amber-500/12 to-violet-500/8'
                          : 'hover:border-sky-500'
                      }`}
                      style={{
                        backgroundColor: isProLocked ? undefined : 'var(--hud-bg)',
                        borderColor: isProLocked ? undefined : 'var(--hud-border)',
                      }}
                    >
                      {isProLocked && (
                        <span className="pointer-events-none absolute top-1 right-1 rounded bg-amber-500 px-1 text-[8px] font-black text-slate-950">
                          PRO
                        </span>
                      )}
                      <img
                        src={item.previewUrl}
                        alt={item.title}
                        loading="lazy"
                        onError={() => setBrokenIds((prev) => new Set(prev).add(item.id))}
                        className="h-11 w-11 object-contain"
                      />
                      <span className="mt-1 line-clamp-1 w-full text-center text-[10px] font-bold opacity-75">
                        {item.title}
                      </span>
                      {busyId === item.id && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-900/80">
                          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
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
    </div>
  );
};
