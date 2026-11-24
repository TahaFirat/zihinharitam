import { useSyncExternalStore } from 'react';

export type AppLanguage = 'tr' | 'en';
export type LanguagePreference = 'auto' | 'tr' | 'en';

const LANG_PREF_KEY = 'zh_v11_lang_pref';

function detectDeviceLanguage(): AppLanguage {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('lang')?.toLowerCase();
      if (q === 'en' || q === 'tr') return q;
    } catch {
      // Ignore URL parse error
    }
  }
  if (typeof navigator === 'undefined') return 'tr';
  const navLang = (navigator.language || '').toLowerCase();
  if (navLang.startsWith('tr') || navLang.endsWith('-tr') || navLang.includes('_tr')) {
    return 'tr';
  }
  if (navLang.startsWith('en') || navLang.length >= 2) {
    return 'en';
  }
  return 'tr';
}

function loadSavedPreference(): LanguagePreference {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('lang')?.toLowerCase();
      if (q === 'en' || q === 'tr') return q;
    } catch {
      // Ignore
    }
  }
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_PREF_KEY) : null;
    if (raw === 'tr' || raw === 'en' || raw === 'auto') return raw;
  } catch {
    // Ignore storage read errors
  }
  return 'auto';
}

function resolveLang(pref: LanguagePreference): AppLanguage {
  return pref === 'auto' ? detectDeviceLanguage() : pref;
}

interface I18nSnapshot {
  pref: LanguagePreference;
  lang: AppLanguage;
}

class I18nStore {
  private snapshot: I18nSnapshot;
  private listeners = new Set<() => void>();

  constructor() {
    const pref = loadSavedPreference();
    this.snapshot = { pref, lang: resolveLang(pref) };
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.snapshot.lang;
    }
  }

  public getSnapshot = (): I18nSnapshot => this.snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public setPreference(pref: LanguagePreference): void {
    const lang = resolveLang(pref);
    this.snapshot = { pref, lang };
    try {
      localStorage.setItem(LANG_PREF_KEY, pref);
    } catch {
      // Ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    this.listeners.forEach((fn) => fn());
  }

  public getLang(): AppLanguage {
    return this.snapshot.lang;
  }
}

export const I18nManager = new I18nStore();

/**
 * Inline bilingual translator — zero boilerplate, 100% reactive with `useI18n()`.
 */
export function trEn(tr: string, en: string, lang?: AppLanguage): string {
  const active = lang ?? I18nManager.getLang();
  return active === 'en' ? en : tr;
}

export function useI18n(): {
  lang: AppLanguage;
  pref: LanguagePreference;
  isEn: boolean;
  setLanguagePref: (pref: LanguagePreference) => void;
  t: (tr: string, en: string) => string;
} {
  const snap = useSyncExternalStore(
    I18nManager.subscribe,
    I18nManager.getSnapshot,
    I18nManager.getSnapshot
  );
  return {
    lang: snap.lang,
    pref: snap.pref,
    isEn: snap.lang === 'en',
    setLanguagePref: (pref: LanguagePreference) => I18nManager.setPreference(pref),
    t: (tr: string, en: string) => (snap.lang === 'en' ? en : tr),
  };
}
