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
let baselineFullHeightPortrait = 0;
let baselineFullHeightLandscape = 0;

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
  const isLandscape = winW > winH;
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;

  // Track baseline full height per orientation so we NEVER double-count keyboard height on Android tablets (`adjustResize`)
  // or iPad Split/Floating keyboards where the OS already shrunk `window.innerHeight`!
  if (isLandscape) {
    if (winH > baselineFullHeightLandscape) baselineFullHeightLandscape = winH;
  } else {
    if (winH > baselineFullHeightPortrait) baselineFullHeightPortrait = winH;
  }
  const baseWinH = isLandscape
    ? Math.max(winH, baselineFullHeightLandscape)
    : Math.max(winH, baselineFullHeightPortrait);

  const vvHeight = vv ? Math.round(vv.height) : winH;
  const vvOffsetTop = vv ? Math.round(vv.offsetTop) : 0;
  const vvBottomY = vv ? Math.min(winH, vvOffsetTop + vvHeight) : winH;
  const vvKbHeight = Math.max(0, winH - vvBottomY);
  const osResizedBy = Math.max(0, baseWinH - winH);

  const effectiveKbHeight = Math.max(nativeKeyboardHeight, vvKbHeight, osResizedBy);
  const isKeyboardOpen = effectiveKbHeight > 120;

  // CSS `bottom` offset must subtract any height the OS ALREADY took away from `window.innerHeight`!
  const remainingUnresizedKb = Math.max(
    vvKbHeight,
    Math.max(0, nativeKeyboardHeight - osResizedBy)
  );
  const keyboardOffsetBottom =
    isKeyboardOpen && remainingUnresizedKb > 32
      ? Math.min(Math.round(winH * 0.56), remainingUnresizedKb)
      : 0;

  const visibleBottomY = Math.max(
    180,
    Math.min(winH - keyboardOffsetBottom, vvBottomY)
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
    isLandscape,
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
