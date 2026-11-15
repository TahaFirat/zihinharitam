import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  Settings2,
  Check,
  Loader2,
  AlertCircle,
  KeyRound,
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
  loadAIProviderSettings,
  saveAIProviderSettings,
  type AICandidateSlot,
  type AIProviderId,
  type AIProviderSettings,
} from '../core/visuals/AIStickerDirector';
import type { MapContextAnalysis } from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';

interface AIStickerStudioModalProps {
  isOpen: boolean;
  initialConcept: string;
  department: AcademicDepartment;
  mapContext: MapContextAnalysis;
  branchColor: string;
  onClose: () => void;
  onApplySticker: (sticker: StickerAsset) => void;
}

export const AIStickerStudioModal: React.FC<AIStickerStudioModalProps> = ({
  isOpen,
  initialConcept,
  department,
  mapContext,
  branchColor,
  onClose,
  onApplySticker,
}) => {
  const [conceptText, setConceptText] = useState(initialConcept);
  const [artStyle, setArtStyle] = useState<AIArtStyle>('hand_drawn');
  const [seedBase, setSeedBase] = useState<number>(() => Math.floor(Math.random() * 9000) + 100);
  const [slots, setSlots] = useState<AICandidateSlot[]>([]);
  const [federatedPicks, setFederatedPicks] = useState<VisualSearchResult[]>([]);
  const [brokenFallbackIds, setBrokenFallbackIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AIProviderSettings>(() => loadAIProviderSettings());
  const [applyingSlot, setApplyingSlot] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConceptText(initialConcept || mapContext.parentTitle || 'Akademik Kavram');
      setBrokenFallbackIds(new Set());
    } else {
      abortRef.current?.abort();
    }
  }, [isOpen, initialConcept, mapContext.parentTitle]);

  // Trigger real 4-candidate AI generation + federated companion picks
  useEffect(() => {
    if (!isOpen) return;
    const clean = conceptText.trim() || 'Akademik Kavram';

    // Load real federated stickers for instant comparison & honest offline fallback
    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      clean,
      mapContext,
      branchColor
    );
    setFederatedPicks(wave1.results.slice(0, 8));

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const slotCount = settings.provider === 'openai' ? 2 : 4;
    const initialSlots: AICandidateSlot[] = Array.from({ length: slotCount }, (_, idx) => ({
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
        controller.signal
      );

      void VisualSearchOrchestrator.searchFederatedGallery(
        clean,
        mapContext,
        branchColor,
        controller.signal
      ).then((fed) => {
        if (!controller.signal.aborted) {
          setFederatedPicks(fed.results.slice(0, 8));
        }
      });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, conceptText, artStyle, seedBase, mapContext, branchColor, settings.provider]);

  if (!isOpen) return null;

  const { subjectEn } = compileArtDirectorStickerPrompt(
    conceptText || 'Akademik Kavram',
    mapContext,
    artStyle,
    0
  );

  const allErrored = slots.length > 0 && slots.every((s) => s.status === 'error');
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
      const sticker = await VisualSearchOrchestrator.materializeStickerSelection(item);
      onApplySticker(sticker);
      void hapticSuccess();
      onClose();
    } finally {
      setApplyingSlot(null);
    }
  };

  const handleSaveSettings = (next: AIProviderSettings) => {
    setSettings(next);
    saveAIProviderSettings(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3.5 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <h2 className="truncate text-base font-extrabold">
                Gerçek AI Çıkartma Stüdyosu
              </h2>
            </div>
            <p className="mt-0.5 truncate text-[11px] opacity-70">
              {mapContext.emoji} Bağlam: <strong>{mapContext.label}</strong> • Somut Sahne:{' '}
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                {subjectEn}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              title="AI Motoru & API Anahtarı Ayarları (BYOK)"
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                settingsOpen
                  ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                  : 'hover:bg-slate-500/10'
              }`}
              style={{ borderColor: settingsOpen ? undefined : 'var(--hud-border)' }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Motoru</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* Optional BYOK AI Provider Settings Panel */}
          {settingsOpen && (
            <div
              className="rounded-2xl border p-3.5"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-violet-600 dark:text-violet-300">
                <KeyRound className="h-3.5 w-3.5" />
                AI Görsel Üretim Sağlayıcısı (Yalnızca Cihazınızda `localStorage` İçinde Saklanır)
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {(
                  [
                    ['flux_free', '⚡ Flux (Ücretsiz)'],
                    ['gemini', '♊ Gemini Imagen'],
                    ['openai', '🟢 OpenAI'],
                    ['fal', '🚀 Fal.ai Flux'],
                    ['together', '🔷 Together AI'],
                  ] as Array<[AIProviderId, string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSaveSettings({ ...settings, provider: id })}
                    className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition-colors ${
                      settings.provider === id
                        ? 'border-violet-500 bg-violet-600 text-white'
                        : 'hover:bg-slate-500/10'
                    }`}
                    style={{
                      borderColor: settings.provider === id ? undefined : 'var(--hud-border)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {settings.provider !== 'flux_free' && (
                <div className="mt-2.5">
                  <input
                    type="password"
                    value={
                      settings.provider === 'gemini'
                        ? settings.geminiApiKey || ''
                        : settings.provider === 'openai'
                        ? settings.openaiApiKey || ''
                        : settings.provider === 'fal'
                        ? settings.falApiKey || ''
                        : settings.togetherApiKey || ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (settings.provider === 'gemini')
                        handleSaveSettings({ ...settings, geminiApiKey: val });
                      else if (settings.provider === 'openai')
                        handleSaveSettings({ ...settings, openaiApiKey: val });
                      else if (settings.provider === 'fal')
                        handleSaveSettings({ ...settings, falApiKey: val });
                      else handleSaveSettings({ ...settings, togetherApiKey: val });
                    }}
                    placeholder={`${settings.provider.toUpperCase()} API Anahtarınızı yapıştırın...`}
                    className="allow-text-input w-full rounded-xl border bg-transparent px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                    style={{ borderColor: 'var(--hud-border)' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Concept Input + Regenerate 4 Variations */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={conceptText}
              onChange={(e) => setConceptText(e.target.value)}
              placeholder="Çizilecek kavramı yazın (örn. Yük Dengeleyici, Mitral Kapak, İstinaf...)"
              className="allow-text-input flex-1 rounded-xl border bg-transparent px-3.5 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500"
              style={{ borderColor: 'var(--hud-border)' }}
            />
            <button
              type="button"
              onClick={() => setSeedBase(Math.floor(Math.random() * 90000) + 100)}
              disabled={anyLoading}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition-transform active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${anyLoading ? 'animate-spin' : ''}`} />
              <span>Yeni Varyasyonlar</span>
            </button>
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
                  onClick={() => setArtStyle(styleKey)}
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

          {/* 4-Candidate Parallel Real AI Generation Grid */}
          {!allErrored ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {slots.map((slot) => {
                const isBusy = applyingSlot === `slot_${slot.slotIndex}`;
                return (
                  <div
                    key={slot.slotIndex}
                    className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border p-2"
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
                        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-violet-500/15">
                          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                        </div>
                        <span className="text-[11px] font-bold opacity-70">
                          AI Çiziyor & Kesiyor...
                        </span>
                      </div>
                    )}

                    {slot.status === 'ready' && slot.previewUrl && (
                      <button
                        type="button"
                        onClick={() => handleSelectAICandidate(slot)}
                        className="group relative flex h-full w-full flex-col items-center justify-center"
                      >
                        <img
                          src={slot.previewUrl}
                          alt={`AI Varyasyon ${slot.slotIndex + 1}`}
                          className="h-full w-full object-contain transition-transform group-hover:scale-106"
                        />
                        <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-0.5 rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                          <Check className="h-3 w-3" /> Seç
                        </span>
                        {isBusy && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-slate-900/75">
                            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                          </div>
                        )}
                      </button>
                    )}

                    {slot.status === 'error' && (
                      <div className="px-2 text-center text-[11px] opacity-65">
                        Aday #{slot.slotIndex + 1} zaman aşımı
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <div className="font-extrabold text-amber-700 dark:text-amber-300">
                  Dış AI Üretim Servisine Şu An Ağdan Erişilemedi
                </div>
                <p className="mt-0.5 opacity-80">
                  Sahte geometrik şekil üretmek yerine aşağıda bu kavram için{' '}
                  <strong>Federatif Görsel Motorumuzun</strong> bulduğu gerçek renkli
                  çıkartmaları seçebilir veya sağ üstteki <strong>AI Motoru</strong>{' '}
                  düğmesinden kendi Gemini / OpenAI / Fal.ai anahtarınızı tanımlayabilirsiniz.
                </p>
              </div>
            </div>
          )}

          {/* Instant Federated Concept Stickers (Always available, colorful, zero fake SVG blobs) */}
          <div>
            <div className="mb-2 text-[11px] font-extrabold tracking-wider uppercase opacity-65">
              Bu Kavram İçin Hazır Çok Renkli Federatif Çıkartmalar
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {federatedPicks
                .filter((item) => !brokenFallbackIds.has(item.id))
                .slice(0, 8)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectFederatedPick(item)}
                    title={`${item.title} (${item.providerName})`}
                    className="group relative flex aspect-square items-center justify-center rounded-2xl border bg-white/75 p-1.5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800/75"
                    style={{ borderColor: 'var(--hud-border)' }}
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      onError={() =>
                        setBrokenFallbackIds((prev) => new Set(prev).add(item.id))
                      }
                      className="h-11 w-11 object-contain transition-transform group-hover:scale-108"
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
