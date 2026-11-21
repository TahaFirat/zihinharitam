import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  Zap,
  CornerDownLeft,
  Plus,
  Sparkles,
  Maximize2,
  Layers,
  Loader2,
  Gift,
  ImagePlus,
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
import { triggerGalleryPhotoPicker } from '../core/visuals/PhotoStickerImporter';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { normalizeTrToken } from '../core/visuals/SemanticTaxonomyTR';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { useKeyboardInset } from '../core/native/useKeyboardInset';

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
  defaultNodeStyle,
  mapContext,
  onClose,
  onJumpToNode,
  onApplyStickerToActive,
  onRequestProStickerUnlock,
  onCreateBranchWithSticker,
  onAutoLayout,
  onFitToScreen,
  onToggleDefaultNodeStyle,
}) => {
  useEntitlements();
  const kb = useKeyboardInset();
  const [query, setQuery] = useState('');
  const [offlineHits, setOfflineHits] = useState<VisualSearchResult[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
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
      setCreateAsNewBranch(false);
      if (!kb.isTouchDevice) {
        setTimeout(() => inputRef.current?.focus(), 20);
      }
    }
  }, [isOpen, kb.isTouchDevice]);

  const matchingNodes = useMemo(() => {
    const all = Object.values(nodes);
    const normQ = normalizeTrToken(query);
    if (!normQ) return all.slice(0, 8);
    return all
      .filter((n) => {
        const nt = normalizeTrToken(n.title);
        const ns = n.subtitle ? normalizeTrToken(n.subtitle) : '';
        return nt.includes(normQ) || ns.includes(normQ);
      })
      .slice(0, 8);
  }, [nodes, query]);

  useEffect(() => {
    if (!isOpen) return;
    const seq = ++seqRef.current;

    const timer = window.setTimeout(async () => {
      const res = await VisualSearchOrchestrator.searchOfflineWave(
        query,
        mapContext,
        branchColor,
        36
      );
      if (seq !== seqRef.current) return;
      setOfflineHits(res.results);
      if (typeof res.elapsedMs === 'number') {
        setElapsedMs(Math.max(1, Math.round(res.elapsedMs)));
      }
    }, 16);

    return () => clearTimeout(timer);
  }, [isOpen, query, mapContext, branchColor]);

  if (!isOpen) return null;

  const handleChooseVisual = async (item: VisualSearchResult, idx = 0) => {
    if (!EntitlementManager.isStickerFree(item, idx, 'command_palette')) {
      void hapticLight();
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
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 px-3 pt-10 backdrop-blur-xs sm:pt-18"
      style={{
        paddingTop: 'max(16px, calc(var(--safe-top) + 12px))',
        paddingBottom: `${kb.keyboardHeight + 12}px`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          maxHeight: `${Math.max(240, kb.viewportH - 36)}px`,
        }}
      >
        {/* Top Command Search Input */}
        <div
          className="flex items-center gap-2.5 border-b px-4 py-3.5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <Search className="h-4.5 w-4.5 shrink-0 text-sky-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'Enter') {
                if (matchingNodes.length > 0 && query.trim()) {
                  onJumpToNode(matchingNodes[0]);
                  onClose();
                } else if (offlineHits[0]) {
                  void handleChooseVisual(offlineHits[0]);
                }
              }
            }}
            placeholder="Dala atla veya 25.000+ çevrimdışı ikondan ara..."
            className="allow-text-input min-w-0 flex-1 bg-transparent text-base font-bold outline-none sm:text-base"
          />
          {elapsedMs !== null && (
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10.5px] font-extrabold text-emerald-700 sm:inline-flex dark:text-emerald-300">
              <Zap className="h-3 w-3" />
              {elapsedMs}ms Offline
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Sections */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Quick Canvas Actions */}
          {!query.trim() && (
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold tracking-wider uppercase opacity-55">
                Hızlı Tuval Komutları
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    onAutoLayout();
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-extrabold hover:border-sky-500 hover:bg-sky-500/10"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Otomatik Radyal Düzen</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleDefaultNodeStyle();
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-extrabold hover:border-sky-500 hover:bg-sky-500/10"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <Layers className="h-4 w-4 shrink-0 text-violet-500" />
                  <span>
                    Stil: {defaultNodeStyle === 'organic' ? 'Kart Moduna Geç' : 'Organik Moda Geç'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onFitToScreen();
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-extrabold hover:border-sky-500 hover:bg-sky-500/10"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <Maximize2 className="h-4 w-4 shrink-0 text-sky-500" />
                  <span>Haritayı Merkeze Sığdır</span>
                </button>
              </div>
            </div>
          )}

          {/* Matching Nodes in Current Map */}
          {matchingNodes.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold tracking-wider uppercase opacity-55">
                Haritadaki Dallar ({matchingNodes.length})
              </div>
              <div className="space-y-1">
                {matchingNodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onJumpToNode(n);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left hover:border-sky-500 hover:bg-sky-500/10"
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
                          {n.title || 'İsimsiz Dal'}
                        </div>
                        {n.subtitle && (
                          <div className="truncate text-[11px] opacity-65">
                            {n.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-bold opacity-60">
                      Odakla <CornerDownLeft className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 25,209+ Offline Vector Sticker Instant Picker */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold tracking-wider uppercase opacity-55">
                  25.000+ Çevrimdışı İkon ({offlineHits.length})
                </span>
                <button
                  type="button"
                  onClick={() => setTierFilter((p) => (p === 'free' ? 'all' : 'free'))}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold ${
                    tierFilter === 'free'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <Gift className="h-3 w-3" />
                  <span>Sadece Ücretsiz</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerGalleryPhotoPicker(branchColor, (sticker) => {
                      if (createAsNewBranch) {
                        onCreateBranchWithSticker(
                          query.trim() || sticker.label || 'Fotoğraf',
                          sticker
                        );
                      } else {
                        onApplyStickerToActive(sticker);
                      }
                      void hapticSuccess();
                      onClose();
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/12 px-2 py-0.5 text-[10.5px] font-extrabold text-indigo-700 dark:text-indigo-300"
                >
                  <ImagePlus className="h-3 w-3" />
                  <span>Galeriden Foto</span>
                </button>
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-500/10 p-0.5 text-[11px] font-extrabold">
                <button
                  type="button"
                  onClick={() => setCreateAsNewBranch(false)}
                  className={`rounded-lg px-2.5 py-1 ${
                    !createAsNewBranch
                      ? 'bg-sky-500 text-white shadow-2xs'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  “{(targetNode?.title || 'Seçili Dal').slice(0, 18)}” Dalına Ata
                </button>
                <button
                  type="button"
                  onClick={() => setCreateAsNewBranch(true)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                    createAsNewBranch
                      ? 'bg-emerald-500 text-white shadow-2xs'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  Yeni Alt Dal Ekle
                </button>
              </div>
            </div>

            {offlineHits.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-4 text-center text-xs opacity-70">
                Bu arama için doğrudan eşleşen çevrimdışı vektör bulunamadı.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {offlineHits
                  .map((item, origIdx) => ({
                    item,
                    origIdx,
                    isFree: EntitlementManager.isStickerFree(
                      item,
                      origIdx,
                      'command_palette'
                    ),
                  }))
                  .filter((entry) => (tierFilter === 'free' ? entry.isFree : true))
                  .map(({ item, origIdx, isFree }) => {
                    const isProLocked = !isFree;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleChooseVisual(item, origIdx)}
                        title={`${item.title} (${item.providerName})`}
                        className={`group relative flex flex-col items-center justify-center rounded-2xl border p-2 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
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
                          <span className="pointer-events-none absolute top-1 right-1 rounded bg-amber-500 px-1 py-0.2 text-[8px] font-black text-slate-950">
                            👑 PRO
                          </span>
                        )}
                        <img
                          src={item.previewUrl}
                          alt={item.title}
                          loading="lazy"
                          className="h-12 w-12 object-contain group-hover:scale-108"
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
