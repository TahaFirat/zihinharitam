import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App.tsx';

// Native Capacitor builds bundle 100% of assets locally inside the APK/IPA.
// Never register a PWA Service Worker on native, and purge any legacy SW/caches from earlier installs
// so APK/IPA updates NEVER serve stale JS or icon indexes!
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
    if (typeof caches !== 'undefined') {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  } else if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
