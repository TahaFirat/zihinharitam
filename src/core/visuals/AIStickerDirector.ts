import type {
  AcademicDepartment,
  AIArtStyle,
  StickerAsset,
  VisualSearchResult,
} from '../../types/mindmap';
import { LocalStore } from '../sync/LocalStore';
import { supabaseClient } from '../sync/RealtimeCollab';
import { DieCutStickerProcessor } from './DieCutStickerProcessor';
import { computeMultilingualEmbedding, cosineSimilarity } from './SemanticConceptEngine';
import {
  TopicContextIntelligence,
  type MapContextAnalysis,
} from './TopicContextIntelligence';

export type AIProviderId = 'flux_free' | 'gemini' | 'openai' | 'fal' | 'together';

export interface AIProviderSettings {
  provider: AIProviderId;
  geminiApiKey?: string;
  openaiApiKey?: string;
  falApiKey?: string;
  togetherApiKey?: string;
}

export interface AICandidateSlot {
  slotIndex: number;
  seed: number;
  status: 'loading' | 'ready' | 'error';
  previewUrl?: string;
  aspectRatio?: number;
  promptEn: string;
  errorMessage?: string;
}

const AI_SETTINGS_STORAGE_KEY = 'gzh_ai_provider_settings_v2';

export const AI_STYLE_PRESETS: Record<
  AIArtStyle,
  { labelTr: string; emoji: string; descTr: string; stylePrefix: string }
> = {
  hand_drawn: {
    labelTr: 'El Çizimi Çıkartma',
    emoji: '🎨',
    descTr: 'Kalın mürekkep konturlu, canlı suluboya/keçeli kalem defter çıkartması',
    stylePrefix:
      'die-cut educational illustration sticker of',
  },
  isometric_3d: {
    labelTr: 'İzometrik 3D Sistem',
    emoji: '🧊',
    descTr: 'Parlak hacimsel 3D sistem mimarisi ve mühendislik objesi',
    stylePrefix:
      'clean isometric 3D icon sticker of',
  },
  scientific_atlas: {
    labelTr: 'Bilimsel Atlas',
    emoji: '🔬',
    descTr: 'Tıp, mimarlık ve temel bilimler ders kitabı kesit/atlas illüstrasyonu',
    stylePrefix:
      'detailed scientific textbook atlas illustration sticker of',
  },
  flat_vector: {
    labelTr: 'Yalın Vektör Amblem',
    emoji: '✨',
    descTr: 'Modern, yüksek kontrastlı çok renkli vektörel sembol',
    stylePrefix:
      'modern flat colorful vector emblem sticker of',
  },
};

const STYLE_MODIFIERS: Record<AIArtStyle, string> = {
  hand_drawn:
    'hand-drawn vibrant marker and watercolor shading, bold clean dark ink outlines, charming academic notebook sticker aesthetic',
  isometric_3d:
    'soft studio lighting, smooth 3D clay and glass render, crisp edges, vibrant modern color palette, systemdesign.io aesthetic',
  scientific_atlas:
    'anatomical and structural precision, clean editorial color fills, fine ink linework, Netter and Dorling Kindersley visual encyclopedia style',
  flat_vector:
    'crisp geometric vector shapes, bold outlines, rich harmonious colors, Notion and Kurzgesagt icon aesthetic',
};

export function loadAIProviderSettings(): AIProviderSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return { provider: 'flux_free' };
    const parsed = JSON.parse(raw) as Partial<AIProviderSettings>;
    return {
      provider: parsed.provider || 'flux_free',
      geminiApiKey: parsed.geminiApiKey || '',
      openaiApiKey: parsed.openaiApiKey || '',
      falApiKey: parsed.falApiKey || '',
      togetherApiKey: parsed.togetherApiKey || '',
    };
  } catch {
    return { provider: 'flux_free' };
  }
}

export function saveAIProviderSettings(settings: AIProviderSettings): void {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota issues
  }
}

/**
 * Visual Art Director Prompt Compiler (Module 3 Section 3.1):
 * Translates abstract Turkish concepts + map context into concrete, physical, drawable English objects,
 * enforcing pure `#FFFFFF` background and zero text!
 */
export function compileArtDirectorStickerPrompt(
  conceptTr: string,
  mapContext: MapContextAnalysis,
  artStyle: AIArtStyle,
  variationIndex = 0
): { fullPrompt: string; subjectEn: string } {
  const expanded = TopicContextIntelligence.expandQueryWithContext(conceptTr, mapContext);
  const concreteProxies = expanded.englishSearchTerms.slice(0, 3).join(', ');
  const subjectEn = expanded.primaryEnglishSubject;

  const angleHints = [
    'front three-quarter view',
    'clean centered elevation view',
    'slightly angled dynamic perspective',
    'iconic compact emblem composition',
  ];
  const compositionHint = angleHints[variationIndex % angleHints.length];

  const preset = AI_STYLE_PRESETS[artStyle];
  const modifier = STYLE_MODIFIERS[artStyle];

  const fullPrompt =
    `${preset.stylePrefix} ${subjectEn} (${concreteProxies}), ${compositionHint}, ${modifier}, ` +
    `single self-contained physical object isolated on pure solid #FFFFFF white background, ` +
    `generous empty white border around subject, zero text, no words, no letters, no labels, no numbers, no watermark`;

  return { fullPrompt, subjectEn };
}

async function generateSingleRawImageFromProvider(
  prompt: string,
  seed: number,
  settings: AIProviderSettings,
  signal?: AbortSignal
): Promise<string> {
  // 1. Google Gemini Imagen / Gemini Flash Image (BYOK)
  if (settings.provider === 'gemini' && settings.geminiApiKey?.trim()) {
    const key = settings.geminiApiKey.trim();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: '1:1' },
        }),
        signal,
      }
    );
    if (!res.ok) throw new Error(`Gemini API Hatası (${res.status})`);
    const json = (await res.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    };
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('Gemini görsel verisi döndürmedi');
    return `data:${json.predictions?.[0]?.mimeType || 'image/png'};base64,${b64}`;
  }

  // 2. OpenAI Image API (BYOK)
  if (settings.provider === 'openai' && settings.openaiApiKey?.trim()) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openaiApiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
      signal,
    });
    if (!res.ok) throw new Error(`OpenAI API Hatası (${res.status})`);
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI görsel verisi döndürmedi');
    return `data:image/png;base64,${b64}`;
  }

  // 3. Fal.ai Flux.1 Schnell (BYOK)
  if (settings.provider === 'fal' && settings.falApiKey?.trim()) {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${settings.falApiKey.trim()}`,
      },
      body: JSON.stringify({
        prompt,
        seed,
        image_size: 'square',
        num_inference_steps: 4,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Fal.ai API Hatası (${res.status})`);
    const json = (await res.json()) as { images?: Array<{ url?: string }> };
    const url = json.images?.[0]?.url;
    if (!url) throw new Error('Fal.ai görsel URL döndürmedi');
    return url;
  }

  // 4. Together AI Flux.1 Schnell (BYOK)
  if (settings.provider === 'together' && settings.togetherApiKey?.trim()) {
    const res = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.togetherApiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt,
        seed,
        width: 512,
        height: 512,
        steps: 4,
        n: 1,
        response_format: 'b64_json',
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Together AI Hatası (${res.status})`);
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error('Together AI görsel döndürmedi');
    return `data:image/png;base64,${b64}`;
  }

  // 5. Default Zero-Setup Keyless Real Flux Diffusion Endpoint (`512x512`, `nologo=true`, `enhance=false`)
  const fluxUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=512&height=512&seed=${seed}&model=flux&nologo=true&enhance=false`;

  // Fetch with explicit timeout & CORS blob read so DieCutStickerProcessor can run BFS Flood-Fill cleanly
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 14000);
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort);

  try {
    const res = await fetch(fluxUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Flux uç noktası yanıt vermedi (${res.status})`);
    }
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.size < 1200) {
      throw new Error('Geçersiz görsel yanıtı');
    }
    return URL.createObjectURL(blob);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

export class AIStickerDirector {
  /**
   * Searches the local IndexedDB + optional Supabase `shared_stickers` semantic pool (<15ms).
   */
  public static async searchSharedPool(
    query: string,
    limit = 6
  ): Promise<VisualSearchResult[]> {
    const clean = query.trim();
    if (!clean) return [];

    const queryVec = computeMultilingualEmbedding(clean);
    const results: VisualSearchResult[] = [];

    try {
      const localPool = await LocalStore.getAllSharedStickers();
      for (const item of localPool) {
        // Guard against any legacy V1 procedural SVG remnants
        if (item.dataUrl.includes('synth_')) continue;
        const sim = cosineSimilarity(queryVec, item.embedding);
        if (sim >= 0.76) {
          results.push({
            id: `pool_${item.id}`,
            title: item.conceptTr,
            previewUrl: item.dataUrl,
            rawUrl: item.dataUrl,
            mode: item.mode,
            category: 'hand_drawn',
            source: 'ai_pool',
            needsDieCut: false,
            aspectRatio: 1,
            score: 0.95 * sim,
            providerName: 'AI Çıkartma Havuzu',
          });
        }
      }
    } catch {
      // Ignore IDB read error
    }

    if (supabaseClient) {
      try {
        const { data } = await supabaseClient.rpc('match_shared_stickers', {
          query_embedding: queryVec,
          match_threshold: 0.78,
          match_count: limit,
          filter_mode: 'illustration',
        });
        if (Array.isArray(data)) {
          for (const row of data) {
            results.push({
              id: `supapool_${row.id}`,
              title: row.concept_tr || clean,
              previewUrl: row.webp_url,
              rawUrl: row.webp_url,
              mode: 'illustration',
              category: 'hand_drawn',
              source: 'ai_pool',
              needsDieCut: false,
              aspectRatio: row.aspect_ratio || 1,
              score: row.similarity || 0.88,
              providerName: 'Küresel AI Havuzu',
            });
          }
        }
      } catch {
        // Offline — local pool served
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Generates 4 parallel real AI sticker candidates (`AIStickerStudioModal`), passing each
   * through the 4-Corner Perimeter BFS Flood-Fill + 8px `#FFFFFF` Die-Cut Processor as soon as it arrives!
   * NEVER produces fake geometric SVG circles/boxes!
   */
  public static async generateFourCandidatesStream(
    conceptTr: string,
    mapContext: MapContextAnalysis,
    artStyle: AIArtStyle,
    baseSeed: number,
    onSlotUpdate: (slot: AICandidateSlot) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const settings = loadAIProviderSettings();
    const slotCount = settings.provider === 'openai' ? 2 : 4; // DALL-E 3 rate-limit friendly

    const tasks = Array.from({ length: slotCount }, async (_, idx) => {
      const seed = baseSeed + idx * 137 + 11;
      const { fullPrompt } = compileArtDirectorStickerPrompt(
        conceptTr,
        mapContext,
        artStyle,
        idx
      );

      onSlotUpdate({
        slotIndex: idx,
        seed,
        status: 'loading',
        promptEn: fullPrompt,
      });

      try {
        const rawImageUrl = await generateSingleRawImageFromProvider(
          fullPrompt,
          seed,
          settings,
          signal
        );
        if (signal?.aborted) return;

        // Pass through 4-Corner Perimeter BFS Flood-Fill + 8px Morphological White Die-Cut!
        const dieCut = await DieCutStickerProcessor.processImageToSticker(rawImageUrl, {
          backgroundMode: 'auto_clean',
          contourRadius: 8,
          maxSize: 384,
        });
        if (signal?.aborted) return;

        onSlotUpdate({
          slotIndex: idx,
          seed,
          status: 'ready',
          previewUrl: dieCut.url,
          aspectRatio: dieCut.aspectRatio,
          promptEn: fullPrompt,
        });
      } catch (err) {
        if (signal?.aborted) return;
        onSlotUpdate({
          slotIndex: idx,
          seed,
          status: 'error',
          promptEn: fullPrompt,
          errorMessage:
            err instanceof Error ? err.message : 'Canlı AI servisine ulaşılamadı',
        });
      }
    });

    await Promise.allSettled(tasks);
  }

  /**
   * Persists a chosen AI candidate into IndexedDB `shared_stickers` & returns a ready `StickerAsset`.
   */
  public static async finalizeSelectedCandidate(
    candidateUrl: string,
    aspectRatio: number,
    conceptTr: string,
    subjectEn: string,
    department: AcademicDepartment = 'genel'
  ): Promise<StickerAsset> {
    const stickerId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let persistentDataUrl = candidateUrl;

    try {
      const resp = await fetch(candidateUrl);
      const blob = await resp.blob();
      persistentDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || candidateUrl));
        reader.readAsDataURL(blob);
      });

      await LocalStore.saveSharedSticker({
        id: stickerId,
        conceptTr: conceptTr.trim() || 'Akademik Kavram',
        conceptEn: subjectEn,
        department,
        mode: 'illustration',
        dataUrl: persistentDataUrl,
        embedding: computeMultilingualEmbedding(conceptTr),
        createdAt: Date.now(),
      });
    } catch {
      // Keep candidateUrl directly
    }

    return {
      id: stickerId,
      url: persistentDataUrl,
      mode: 'illustration',
      source: 'ai_pool',
      dieCutProcessed: true,
      aspectRatio: aspectRatio || 1,
      label: conceptTr,
    };
  }
}
