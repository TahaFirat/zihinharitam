import { useEffect, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

export interface ViewportKeyboardState {
  viewportW: number;
  viewportH: number;
  visibleBottomY: number;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isLandscape: boolean;
  isTouchDevice: boolean;
  studioBarHeight: number;
}

type Subscriber = (snapshot: ViewportKeyboardState) => void;

const subscribers = new Set<Subscriber>();
let nativeKeyboardHeight = 0;
let currentStudioBarHeight = 0;
let initialized = false;

function readTouchCapability(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  const hasCoarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return hasCoarse || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
}

function computeSnapshot(): ViewportKeyboardState {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;

  const vvHeight = vv ? Math.round(vv.height) : winH;
  const vvOffsetTop = vv ? Math.round(vv.offsetTop) : 0;
  const vvBottomY = vv ? Math.min(winH, vvOffsetTop + vvHeight) : winH;
  const vvKbHeight = Math.max(0, winH - vvBottomY);

  const effectiveKbHeight = Math.max(nativeKeyboardHeight, vvKbHeight);
  const isKeyboardOpen = effectiveKbHeight > 120;
  const keyboardOffsetBottom = effectiveKbHeight > 40 ? effectiveKbHeight : 0;
  const visibleBottomY = Math.max(
    180,
    keyboardOffsetBottom > 0
      ? Math.min(winH - nativeKeyboardHeight, vvBottomY)
      : winH
  );

  const isPhone = winW < 768;
  const isTablet = winW >= 768 && winW < 1200;

  return {
    viewportW: vv ? Math.round(vv.width) : winW,
    viewportH: visibleBottomY,
    visibleBottomY,
    keyboardHeight: keyboardOffsetBottom,
    isKeyboardOpen,
    isPhone,
    isTablet,
    isLandscape: winW > winH,
    isTouchDevice: readTouchCapability(),
    studioBarHeight: currentStudioBarHeight,
  };
}

let cachedSnapshot: ViewportKeyboardState = computeSnapshot();

function notifyAll(): void {
  cachedSnapshot = computeSnapshot();
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(
      '--kb-inset',
      `${cachedSnapshot.keyboardHeight}px`
    );
  }
  subscribers.forEach((cb) => cb(cachedSnapshot));
}

function ensureListenersStarted(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const handleViewportChange = () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
    notifyAll();
  };

  window.addEventListener('resize', handleViewportChange, { passive: true });
  window.visualViewport?.addEventListener('resize', handleViewportChange, {
    passive: true,
  });
  window.visualViewport?.addEventListener('scroll', handleViewportChange, {
    passive: true,
  });

  if (Capacitor.isNativePlatform()) {
    void Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => undefined);
    void Keyboard.setScroll({ isDisabled: true }).catch(() => undefined);
    void Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined);

    const handles: PluginListenerHandle[] = [];
    void Promise.all([
      Keyboard.addListener('keyboardWillShow', (info) => {
        nativeKeyboardHeight = Math.max(0, Math.round(info.keyboardHeight || 0));
        notifyAll();
      }),
      Keyboard.addListener('keyboardDidShow', (info) => {
        nativeKeyboardHeight = Math.max(0, Math.round(info.keyboardHeight || 0));
        notifyAll();
      }),
      Keyboard.addListener('keyboardWillHide', () => {
        nativeKeyboardHeight = 0;
        notifyAll();
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        nativeKeyboardHeight = 0;
        notifyAll();
      }),
    ])
      .then((list) => {
        handles.push(...list);
      })
      .catch(() => undefined);
  }

  notifyAll();
}

export function setStudioBarHeight(heightPx: number): void {
  const clean = Math.max(0, Math.round(heightPx));
  if (clean === currentStudioBarHeight) return;
  currentStudioBarHeight = clean;
  notifyAll();
}

export function getViewportKeyboardSnapshot(): ViewportKeyboardState {
  ensureListenersStarted();
  return cachedSnapshot;
}

export async function dismissNativeKeyboard(): Promise<void> {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await Keyboard.hide();
    } catch {
      // Ignore if keyboard already closed
    }
  }
}

export function useKeyboardInset(): ViewportKeyboardState {
  const [snap, setSnap] = useState<ViewportKeyboardState>(() =>
    getViewportKeyboardSnapshot()
  );

  useEffect(() => {
    ensureListenersStarted();
    subscribers.add(setSnap);
    setSnap(getViewportKeyboardSnapshot());
    return () => {
      subscribers.delete(setSnap);
    };
  }, []);

  return snap;
}
