import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  Check,
  Loader2,
  Search,
  Layers,
  ImagePlus,
} from 'lucide-react';
import type {
  AcademicDepartment,
  AIArtStyle,
  StickerAsset,
  VisualSearchResult,
} from '../types/mindmap';
import {
  AI_STYLE_PRESETS,
  AIStickerDirector,
  compileArtDirectorStickerPrompt,
  type AICandidateSlot,
} from '../core/visuals/AIStickerDirector';
import { triggerGalleryPhotoPicker } from '../core/visuals/PhotoStickerImporter';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { useKeyboardInset } from '../core/native/useKeyboardInset';

interface AIStickerStudioModalProps {
  isOpen: boolean;
  initialConcept: string;
  department: AcademicDepartment;
  mapContext: MapContextAnalysis;
  branchColor: string;
  onClose: () => void;
  onApplySticker: (sticker: StickerAsset) => void;
}

type QuickCategoryFilter = 'all' | 'illustration' | '3d' | 'diagram';

const QUICK_CONCEPT_CHIPS: Array<{ label: string; query: string }> = [
  { label: '🫀 Kalp & Anatomi', query: 'kalp anatomi' },
  { label: '🧠 Beyin & Nöron', query: 'beyin nöron' },
  { label: '☁️ Sunucu & Bulut', query: 'sunucu bulut' },
  { label: '⚖️ Mahkeme & Hukuk', query: 'mahkeme adalet' },
  { label: '🧬 DNA & Hücre', query: 'dna genetik' },
  { label: '🏛️ Mimarlık & Yapı', query: 'mimarlık bina' },
  { label: '⚡ Elektronik & Devre', query: 'elektronik çip' },
  { label: '🎯 Hedef & Strateji', query: 'hedef roket' },
];

export const AIStickerStudioModal: React.FC<AIStickerStudioModalProps> = ({
  isOpen,
  initialConcept,
  department,
  mapContext,
  branchColor,
  onClose,
  onApplySticker,
}) => {
  const kb = useKeyboardInset();
  const [conceptText, setConceptText] = useState(initialConcept);
  const [artStyle, setArtStyle] = useState<AIArtStyle>('isometric_3d');
  const [categoryFilter, setCategoryFilter] = useState<QuickCategoryFilter>('all');
  const [seedBase, setSeedBase] = useState<number>(
    () => Math.floor(Math.random() * 9000) + 100
  );
  const [slots, setSlots] = useState<AICandidateSlot[]>([]);
  const [federatedPicks, setFederatedPicks] = useState<VisualSearchResult[]>([]);
  const [brokenFallbackIds, setBrokenFallbackIds] = useState<Set<string>>(new Set());
  const [applyingSlot, setApplyingSlot] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConceptText(initialConcept || mapContext.parentTitle || 'Akademik Kavram');
      setBrokenFallbackIds(new Set());
      setCategoryFilter('all');
    } else {
      abortRef.current?.abort();
    }
  }, [isOpen, initialConcept, mapContext.parentTitle]);

  // Trigger 4-candidate instant on-device Die-Cut Sticker synthesis + 36+ rich multi-category icons
  useEffect(() => {
    if (!isOpen) return;
    const clean = conceptText.trim() || 'Akademik Kavram';

    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      clean,
      mapContext,
      branchColor
    );
    setFederatedPicks(wave1.results.slice(0, 36));

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const initialSlots: AICandidateSlot[] = Array.from({ length: 4 }, (_, idx) => ({
      slotIndex: idx,
      seed: seedBase + idx * 137 + 11,
      status: 'loading',
      promptEn: compileArtDirectorStickerPrompt(clean, mapContext, artStyle, idx).fullPrompt,
    }));
    setSlots(initialSlots);

    const timer = window.setTimeout(() => {
      void AIStickerDirector.generateFourCandidatesStream(
        clean,
        mapContext,
        artStyle,
        seedBase,
        (updated) => {
          setSlots((prev) =>
            prev.map((s) => (s.slotIndex === updated.slotIndex ? updated : s))
          );
        },
        controller.signal,
        branchColor
      );

      void VisualSearchOrchestrator.searchOfflineWave(
        clean,
        mapContext,
        branchColor,
        48
      ).then((off) => {
        if (!controller.signal.aborted && off.results.length > 0) {
          setFederatedPicks(off.results.slice(0, 36));
        }
      });

      void VisualSearchOrchestrator.searchFederatedGallery(
        clean,
        mapContext,
        branchColor,
        controller.signal
      ).then((fed) => {
        if (!controller.signal.aborted && fed.results.length > 0) {
          setFederatedPicks(fed.results.slice(0, 36));
        }
      });
    }, 60);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, conceptText, artStyle, seedBase, mapContext, branchColor]);

  const filteredIcons = useMemo(() => {
    const valid = federatedPicks.filter((item) => !brokenFallbackIds.has(item.id));
    if (categoryFilter === 'all') return valid.slice(0, 32);
    const matching = valid.filter((item) => item.mode === categoryFilter);
    return (matching.length >= 4 ? matching : valid).slice(0, 32);
  }, [federatedPicks, brokenFallbackIds, categoryFilter]);

  if (!isOpen) return null;

  const { subjectEn } = compileArtDirectorStickerPrompt(
    conceptText || 'Akademik Kavram',
    mapContext,
    artStyle,
    0
  );

  const anyLoading = slots.some((s) => s.status === 'loading');

  const handleSelectAICandidate = async (slot: AICandidateSlot) => {
    if (!slot.previewUrl) return;
    setApplyingSlot(`slot_${slot.slotIndex}`);
    void hapticLight();
    try {
      const sticker = await AIStickerDirector.finalizeSelectedCandidate(
        slot.previewUrl,
        slot.aspectRatio || 1,
        conceptText,
        subjectEn,
        department
      );
      onApplySticker(sticker);
      void hapticSuccess();
      onClose();
    } finally {
      setApplyingSlot(null);
    }
  };

  const handleSelectFederatedPick = async (item: VisualSearchResult) => {
    setApplyingSlot(item.id);
    void hapticLight();
    try {
      const sticker = await VisualSearchOrchestrator.materializeStickerSelection(
        item,
        { retintToBranchColor: branchColor }
      );
      onApplySticker(sticker);
      void hapticSuccess();
      onClose();
    } finally {
      setApplyingSlot(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      style={{ paddingBottom: `${kb.keyboardHeight}px` }}
      onClick={onClose}
      data-testid="ai-sticker-studio-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          maxHeight: `${Math.max(300, kb.viewportH - 16)}px`,
          paddingBottom: kb.isKeyboardOpen ? '4px' : 'var(--safe-bottom)',
        }}
      >
        {/* Header (Zero API key required — 100% Free Built-In Engine) */}
        <div
          className="flex items-center justify-between border-b px-4 py-3 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
              <h2 className="truncate text-base font-extrabold">
                Akıllı Çıkartma & 25.000+ İkon Stüdyosu
              </h2>
              <span className="hidden rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-600 sm:inline-block dark:text-emerald-400">
                %100 ÜCRETSİZ & ANINDA
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] opacity-70">
              {mapContext.emoji} Bağlam: <strong>{mapContext.label}</strong> • Kavram:{' '}
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                {subjectEn}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5 overflow-y-auto p-4 sm:p-5">
          {/* Concept Input + Regenerate 4 Variations */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-45" />
              <input
                type="text"
                value={conceptText}
                onChange={(e) => setConceptText(e.target.value)}
                placeholder="Kavram veya ikon ara (örn. Kalp, Sunucu, Mahkeme, DNA...)"
                className="allow-text-input min-h-[42px] w-full rounded-xl border bg-transparent py-2 pr-3.5 pl-9 text-base font-bold outline-none focus:ring-2 focus:ring-violet-500 sm:text-sm"
                style={{ borderColor: 'var(--hud-border)' }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void hapticLight();
                setSeedBase((prev) => prev + Math.floor(Math.random() * 500) + 17);
              }}
              disabled={anyLoading}
              className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition-transform active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${anyLoading ? 'animate-spin' : ''}`} />
              <span>Yeni 3D Tasarımlar</span>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerGalleryPhotoPicker(branchColor, (sticker) => {
                  onApplySticker(sticker);
                  void hapticSuccess();
                  onClose();
                })
              }
              className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-2 text-xs font-extrabold text-indigo-700 transition hover:bg-indigo-500/25 active:scale-95 dark:text-indigo-300"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>Galeriden Foto Ekle</span>
            </button>
          </div>

          {/* Quick Academic Topic Chips */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {QUICK_CONCEPT_CHIPS.map((chip) => (
              <button
                key={chip.query}
                type="button"
                onClick={() => {
                  void hapticLight();
                  setConceptText(chip.query);
                }}
                className="shrink-0 rounded-xl border bg-slate-500/5 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition hover:border-violet-500/40 hover:bg-violet-500/10 active:scale-95"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* 4 Art Style Selector Pills */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(Object.keys(AI_STYLE_PRESETS) as AIArtStyle[]).map((styleKey) => {
              const st = AI_STYLE_PRESETS[styleKey];
              const active = artStyle === styleKey;
              return (
                <button
                  key={styleKey}
                  type="button"
                  onClick={() => {
                    void hapticLight();
                    setArtStyle(styleKey);
                  }}
                  title={st.descTr}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-extrabold transition-all ${
                    active
                      ? 'border-violet-500 bg-violet-500/15 text-violet-700 shadow-xs dark:text-violet-200'
                      : 'opacity-75 hover:bg-slate-500/10 hover:opacity-100'
                  }`}
                  style={{ borderColor: active ? undefined : 'var(--hud-border)' }}
                >
                  <span>{st.emoji}</span>
                  <span className="truncate">{st.labelTr}</span>
                </button>
              );
            })}
          </div>

          {/* 4-Candidate Instant Custom Die-Cut Sticker Grid */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold tracking-wider uppercase opacity-70">
              <span>Özel Tasarım Die-Cut Çıkartmalar (4 Stil Varyasyonu)</span>
              <span className="text-violet-600 dark:text-violet-400">Tek Dokunuşla Ekle</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {slots.map((slot) => {
                const isBusy = applyingSlot === `slot_${slot.slotIndex}`;
                return (
                  <div
                    key={slot.slotIndex}
                    className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border p-2 transition hover:border-violet-500/50 hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--hud-bg)',
                      backgroundImage:
                        'radial-gradient(var(--canvas-dot) 1.25px, transparent 1.25px)',
                      backgroundSize: '16px 16px',
                      borderColor: 'var(--hud-border)',
                    }}
                  >
                    {slot.status === 'loading' && (
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-violet-500/15">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                        </div>
                        <span className="text-[11px] font-bold opacity-70">
                          Hazırlanıyor...
                        </span>
                      </div>
                    )}

                    {slot.status === 'ready' && slot.previewUrl && (
                      <button
                        type="button"
                        data-testid={`ai-candidate-slot-${slot.slotIndex}`}
                        onClick={() => void handleSelectAICandidate(slot)}
                        className="group relative flex h-full w-full flex-col items-center justify-center"
                      >
                        <img
                          src={slot.previewUrl}
                          alt={`Özel Çıkartma ${slot.slotIndex + 1}`}
                          className="h-full w-full object-contain transition-transform group-hover:scale-106"
                        />
                        {slot.variantLabelTr && (
                          <span className="pointer-events-none absolute bottom-1 left-1 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
                            {slot.variantLabelTr}
                          </span>
                        )}
                        <span className="absolute right-1 bottom-1 inline-flex items-center gap-0.5 rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white opacity-95 shadow-sm transition-transform group-hover:scale-105">
                          <Check className="h-3 w-3" /> Seç
                        </span>
                        {isBusy && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-slate-900/75">
                            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expanded 32+ Multi-Color Concept Icons Section with Category Filter Tabs */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider uppercase opacity-70">
                <Layers className="h-3.5 w-3.5 text-sky-500" />
                <span>Zengin İkon & İllüstrasyon Kütüphanesi ({filteredIcons.length}+ Hazır İkon)</span>
              </div>

              <div className="flex items-center gap-1 rounded-xl bg-slate-500/10 p-0.5 text-[10.5px] font-extrabold">
                {(
                  [
                    ['all', 'Tümü'],
                    ['illustration', '🎨 Çizim'],
                    ['3d', '🧊 3D'],
                    ['diagram', '📐 Şema'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategoryFilter(id)}
                    className={`rounded-lg px-2 py-1 transition ${
                      categoryFilter === id
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {filteredIcons.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleSelectFederatedPick(item)}
                  title={`${item.title} (${item.providerName})`}
                  className="group relative flex aspect-square flex-col items-center justify-center rounded-2xl border bg-white/80 p-1.5 transition-all hover:-translate-y-0.5 hover:border-sky-500/50 hover:shadow-md active:scale-95 dark:bg-slate-800/80"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    onError={() =>
                      setBrokenFallbackIds((prev) => new Set(prev).add(item.id))
                    }
                    className="h-10 w-10 object-contain transition-transform group-hover:scale-108 sm:h-11 sm:w-11"
                  />
                  {applyingSlot === item.id && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-900/80">
                      <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
