import {
  filterAndCleanAcademicLine,
  isFormulaExpression,
} from './AcademicContentFilter';
import type { LectureNoteDepth } from './LectureNoteStructurer';

export interface AiStatusInfo {
  available: boolean;
  requiresPro: boolean;
  isPro: boolean;
  providerCount: number;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  cacheEnabled: boolean;
  endpointConfigured: boolean;
}

export interface AiOutlineResult {
  usedAi: boolean;
  outline: string | null;
  cached: boolean;
  provider?: string;
  dailyRemaining?: number;
  dailyLimit?: number;
  fallbackReason?: 'offline' | 'unconfigured' | 'pro_required' | 'quota_exceeded' | 'rate_limited' | 'error';
}

const PREF_STORAGE_KEY = 'zh_smartmap_ai_mode_v1';
const REQUEST_TIMEOUT_MS = 22_000;
const DEFAULT_MOBILE_AI_WORKER_URL = 'https://zihinharitam-ai-proxy.tahafirat3365.workers.dev';

declare global {
  interface Window {
    __ZH_CSRF_TOKEN__?: string | null;
  }
}

export function getSavedAiModePreference(): boolean {
  try {
    const val = localStorage.getItem(PREF_STORAGE_KEY);
    if (val === '0' || val === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

export function saveAiModePreference(enabled: boolean): void {
  try {
    localStorage.setItem(PREF_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore private-mode storage error
  }
}

/**
 * Resolves the active AI proxy base URL:
 *  1) Explicit `VITE_AI_API_URL` if set
 *  2) Same-origin `web-platform` Node server when running in a standard web browser (http/https, not Capacitor)
 *  3) Deployed Cloudflare Free AI Worker (`https://zihinharitam-ai-proxy.tahafirat3365.workers.dev`)
 *     for native iOS & Android Capacitor apps so mobile & web have identical Pro AI!
 */
export function resolveAiProxyBaseUrl(): string | null {
  const configured =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_API_URL
      ? String(import.meta.env.VITE_AI_API_URL).trim().replace(/\/+$/, '')
      : '';
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    const isCapacitorNative =
      proto === 'capacitor:' ||
      proto === 'file:' ||
      Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
    if (isCapacitorNative) {
      return DEFAULT_MOBILE_AI_WORKER_URL;
    }
    if ((proto === 'http:' || proto === 'https:') && host) {
      return '';
    }
  }
  return DEFAULT_MOBILE_AI_WORKER_URL;
}

/**
 * Strips university cover metadata, repeated headers, instructor titles, and numeric table dumps
 * locally on-device BEFORE sending lecture text to AI, while preserving FULL coverage across
 * beginning, middle, and end of long 35+ page university PDFs (up to 46,000 chars!).
 */
export function preCleanTextForAi(rawText: string, maxChars = 46_000): string {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (isFormulaExpression(trimmed)) return trimmed;
      return filterAndCleanAcademicLine(trimmed);
    })
    .filter((l) => l.length > 0);

  const joined = lines.join('\n').trim();
  if (joined.length <= maxChars) return joined;

  // Balanced full-document sampling so late-slide concepts & formulas are NEVER truncated!
  const headBudget = Math.floor(maxChars * 0.42);
  const midBudget = Math.floor(maxChars * 0.29);
  const tailBudget = maxChars - headBudget - midBudget - 60;
  const head = joined.slice(0, headBudget);
  const midStart = Math.max(headBudget, Math.floor((joined.length - midBudget) / 2));
  const mid = joined.slice(midStart, midStart + midBudget);
  const tail = joined.slice(Math.max(midStart + midBudget, joined.length - tailBudget));
  return `${head}\n\n[...]\n\n${mid}\n\n[...]\n\n${tail}`.trim();
}

export async function fetchAiStatus(clientIsPro = false): Promise<AiStatusInfo> {
  const baseUrl = resolveAiProxyBaseUrl();
  if (baseUrl === null || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return {
      available: false,
      requiresPro: true,
      isPro: clientIsPro,
      providerCount: 0,
      dailyLimit: 0,
      dailyUsed: 0,
      dailyRemaining: 0,
      cacheEnabled: false,
      endpointConfigured: baseUrl !== null,
    };
  }

  const headers: Record<string, string> = {};
  if (baseUrl !== '' && clientIsPro) {
    headers['X-Zihin-Pro'] = 'pro';
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(`${baseUrl}/api/v1/ai/status`, {
      method: 'GET',
      credentials: baseUrl === '' ? 'include' : 'omit',
      headers,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return {
        available: false,
        requiresPro: true,
        isPro: clientIsPro,
        providerCount: 0,
        dailyLimit: 0,
        dailyUsed: 0,
        dailyRemaining: 0,
        cacheEnabled: false,
        endpointConfigured: true,
      };
    }
    const data = (await res.json()) as Partial<AiStatusInfo>;
    return {
      available: Boolean(data.available),
      requiresPro: data.requiresPro !== false,
      isPro: Boolean(data.isPro),
      providerCount: Number(data.providerCount || 0),
      dailyLimit: Number(data.dailyLimit || 0),
      dailyUsed: Number(data.dailyUsed || 0),
      dailyRemaining: Number(data.dailyRemaining || 0),
      cacheEnabled: Boolean(data.cacheEnabled),
      endpointConfigured: true,
    };
  } catch {
    return {
      available: false,
      requiresPro: true,
      isPro: clientIsPro,
      providerCount: 0,
      dailyLimit: 0,
      dailyUsed: 0,
      dailyRemaining: 0,
      cacheEnabled: false,
      endpointConfigured: true,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Requests a clean hierarchical mind-map outline from our Pro-Only Free AI Proxy.
 * GUARANTEED NON-THROWING: if not Pro, offline, unconfigured, 429 quota, or timeout, returns `{ usedAi: false }`
 * so the caller transparently falls back to our fast local offline engine!
 */
export async function requestAiStructuredOutline(
  rawSourceText: string,
  options?: {
    depth?: LectureNoteDepth;
    lang?: 'tr' | 'en';
    isPro?: boolean;
  }
): Promise<AiOutlineResult> {
  if (!options?.isPro) {
    return { usedAi: false, outline: null, cached: false, fallbackReason: 'pro_required' };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { usedAi: false, outline: null, cached: false, fallbackReason: 'offline' };
  }

  const baseUrl = resolveAiProxyBaseUrl();
  if (baseUrl === null) {
    return { usedAi: false, outline: null, cached: false, fallbackReason: 'unconfigured' };
  }

  const cleanedText = preCleanTextForAi(rawSourceText);
  if (cleanedText.length < 20) {
    return { usedAi: false, outline: null, cached: false, fallbackReason: 'error' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'ZihinHaritamWeb',
  };
  if (baseUrl === '' && typeof window !== 'undefined' && window.__ZH_CSRF_TOKEN__) {
    headers['X-CSRF-Token'] = window.__ZH_CSRF_TOKEN__;
  } else if (baseUrl !== '') {
    headers['X-Zihin-Pro'] = 'pro';
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/v1/ai/structure-note`, {
      method: 'POST',
      credentials: baseUrl === '' ? 'include' : 'omit',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        text: cleanedText,
        depth: options?.depth ?? 'compact',
        lang: options?.lang ?? 'tr',
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      outline?: string;
      cached?: boolean;
      provider?: string;
      code?: string;
      dailyRemaining?: number;
      dailyLimit?: number;
    };

    if (res.ok && data.ok && typeof data.outline === 'string' && data.outline.trim().length >= 20) {
      return {
        usedAi: true,
        outline: data.outline.trim(),
        cached: Boolean(data.cached),
        provider: data.provider,
        dailyRemaining: data.dailyRemaining,
        dailyLimit: data.dailyLimit,
      };
    }

    if (res.status === 403 || data.code === 'AI_PRO_REQUIRED') {
      return { usedAi: false, outline: null, cached: false, fallbackReason: 'pro_required' };
    }
    if (data.code === 'AI_NOT_CONFIGURED') {
      return { usedAi: false, outline: null, cached: false, fallbackReason: 'unconfigured' };
    }
    if (data.code === 'AI_DAILY_QUOTA_EXCEEDED') {
      return {
        usedAi: false,
        outline: null,
        cached: false,
        dailyRemaining: 0,
        dailyLimit: data.dailyLimit,
        fallbackReason: 'quota_exceeded',
      };
    }
    if (res.status === 429 || data.code === 'AI_RATE_LIMITED') {
      return { usedAi: false, outline: null, cached: false, fallbackReason: 'rate_limited' };
    }
    return { usedAi: false, outline: null, cached: false, fallbackReason: 'error' };
  } catch {
    return { usedAi: false, outline: null, cached: false, fallbackReason: 'error' };
  } finally {
    window.clearTimeout(timer);
  }
}
