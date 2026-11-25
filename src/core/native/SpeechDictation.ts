import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface SpeechDictationNativePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(options: { locale: string }): Promise<{ listening: boolean }>;
  stop(): Promise<{ text: string }>;
  addListener(
    eventName: 'partial',
    listenerFunc: (data: { text: string; isFinal?: boolean }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'final',
    listenerFunc: (data: { text: string }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'state',
    listenerFunc: (data: { listening: boolean }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'error',
    listenerFunc: (data: { message: string }) => void
  ): Promise<PluginListenerHandle>;
}

const NativeSpeechDictation = registerPlugin<SpeechDictationNativePlugin>('SpeechDictation');

interface WebSpeechRecResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface WebSpeechRecEvent {
  resultIndex: number;
  results: ArrayLike<WebSpeechRecResult>;
}

interface WebSpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: WebSpeechRecEvent) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface DictationCallbacks {
  locale?: string;
  onPartial?: (liveText: string) => void;
  onFinal?: (finalText: string) => void;
  onStateChange?: (listening: boolean) => void;
  onError?: (friendlyMessage: string) => void;
}

export function isDictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Unified, rock-solid Turkish/English Speech Dictation Controller:
 * - On iOS Native: Apple SFSpeechRecognizer + AVAudioEngine (never auto-closes early!)
 * - On Android Native: Android SpeechRecognizer with continuous auto-resume across pauses
 * - On Web/Desktop: Continuous + live interim SpeechRecognition with resilience on `no-speech`
 */
export class SpeechDictationController {
  private active = false;
  private nativeHandles: PluginListenerHandle[] = [];
  private webRec: WebSpeechRecLike | null = null;
  private restartTimer: number | null = null;
  private committedWebText = '';
  private latestInterimText = '';
  private callbacks: DictationCallbacks = {};

  public isListening(): boolean {
    return this.active;
  }

  public async start(callbacks: DictationCallbacks): Promise<boolean> {
    await this.stop(false);
    this.callbacks = callbacks;
    this.committedWebText = '';
    this.latestInterimText = '';
    const locale = callbacks.locale || 'tr-TR';

    if (Capacitor.isNativePlatform()) {
      try {
        const h1 = await NativeSpeechDictation.addListener('partial', (d) => {
          const text = (d.text || '').trim();
          if (text) {
            this.latestInterimText = text;
            this.callbacks.onPartial?.(text);
          }
        });
        const h2 = await NativeSpeechDictation.addListener('final', (d) => {
          const text = (d.text || '').trim();
          this.active = false;
          void this.clearNativeListeners();
          if (text) this.callbacks.onFinal?.(text);
          this.callbacks.onStateChange?.(false);
        });
        const h3 = await NativeSpeechDictation.addListener('error', (d) => {
          this.active = false;
          void this.clearNativeListeners();
          this.callbacks.onError?.(d.message || 'Ses algılanamadı.');
          this.callbacks.onStateChange?.(false);
        });
        const h4 = await NativeSpeechDictation.addListener('state', (d) => {
          this.active = Boolean(d.listening);
          this.callbacks.onStateChange?.(this.active);
        });
        this.nativeHandles = [h1, h2, h3, h4];

        await NativeSpeechDictation.start({ locale });
        this.active = true;
        this.callbacks.onStateChange?.(true);
        return true;
      } catch (err) {
        this.active = false;
        await this.clearNativeListeners();
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Mikrofon veya dikte izni gerekli.';
        this.callbacks.onError?.(msg);
        this.callbacks.onStateChange?.(false);
        return false;
      }
    }

    // Web / Desktop SpeechRecognition (continuous + live interim + pause-resilient!)
    const w = window as unknown as {
      SpeechRecognition?: new () => WebSpeechRecLike;
      webkitSpeechRecognition?: new () => WebSpeechRecLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      this.callbacks.onError?.('Tarayıcınız sesli dikteyi desteklemiyor.');
      return false;
    }

    this.active = true;
    this.callbacks.onStateChange?.(true);
    this.startWebRecognizer(Ctor, locale);
    return true;
  }

  private startWebRecognizer(Ctor: new () => WebSpeechRecLike, locale: string): void {
    if (!this.active) return;
    try {
      const rec = new Ctor();
      rec.lang = locale;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      this.webRec = rec;

      rec.onresult = (ev) => {
        if (!this.active) return;
        let finalSeg = '';
        let interimSeg = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const item = ev.results[i];
          const tr = (item?.[0]?.transcript || '').trim();
          if (!tr) continue;
          if (item.isFinal) {
            finalSeg = finalSeg ? `${finalSeg} ${tr}` : tr;
          } else {
            interimSeg = interimSeg ? `${interimSeg} ${tr}` : tr;
          }
        }
        if (finalSeg) {
          this.committedWebText = this.committedWebText
            ? `${this.committedWebText} ${finalSeg}`
            : finalSeg;
        }
        const live = [this.committedWebText, interimSeg].filter(Boolean).join(' ').trim();
        this.latestInterimText = live;
        if (live) {
          this.callbacks.onPartial?.(live);
        }
      };

      rec.onerror = (ev) => {
        const code = ev?.error || '';
        // Ignore harmless pause timeouts while user is thinking — restart smoothly!
        if (code === 'no-speech' || code === 'aborted') {
          return;
        }
        this.active = false;
        this.webRec = null;
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          this.callbacks.onError?.('Mikrofon izni kapalı. Tarayıcı/cihaz ayarlarından izin verin.');
        } else if (code === 'audio-capture') {
          this.callbacks.onError?.('Mikrofon bulunamadı.');
        } else if (code === 'network') {
          this.callbacks.onError?.('Ses tanıma için internet bağlantısı gerekiyor.');
        } else {
          this.callbacks.onError?.('Dikte durduruldu, tekrar dokunup konuşabilirsiniz.');
        }
        this.callbacks.onStateChange?.(false);
      };

      rec.onend = () => {
        if (!this.active) return;
        // Browser WebSpeech naturally stops after ~10-15s of silence; auto-resume smoothly until user taps Stop!
        this.restartTimer = window.setTimeout(() => {
          if (this.active) {
            this.startWebRecognizer(Ctor, locale);
          }
        }, 160);
      };

      rec.start();
    } catch {
      this.active = false;
      this.callbacks.onError?.('Mikrofon başlatılamadı.');
      this.callbacks.onStateChange?.(false);
    }
  }

  public async stop(emitFinal = true): Promise<string> {
    const wasActive = this.active;
    this.active = false;
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (Capacitor.isNativePlatform()) {
      let finalOut = this.latestInterimText;
      if (wasActive) {
        try {
          const res = await NativeSpeechDictation.stop();
          if (res?.text?.trim()) finalOut = res.text.trim();
        } catch {
          // Ignore stop race
        }
      }
      await this.clearNativeListeners();
      this.callbacks.onStateChange?.(false);
      if (emitFinal && finalOut.trim()) {
        this.callbacks.onFinal?.(finalOut.trim());
      }
      return finalOut.trim();
    }

    if (this.webRec) {
      try {
        this.webRec.onend = null;
        this.webRec.onerror = null;
        this.webRec.stop();
      } catch {
        // Ignore
      }
      this.webRec = null;
    }

    const finalText = (this.latestInterimText || this.committedWebText).trim();
    if (wasActive) {
      this.callbacks.onStateChange?.(false);
      if (emitFinal && finalText) {
        this.callbacks.onFinal?.(finalText);
      }
    }
    return finalText;
  }

  private async clearNativeListeners(): Promise<void> {
    const list = this.nativeHandles;
    this.nativeHandles = [];
    for (const h of list) {
      try {
        await h.remove();
      } catch {
        // Ignore
      }
    }
  }
}
