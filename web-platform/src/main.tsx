import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './web.css';
import { WebPlatformRoot } from './WebPlatformRoot';

interface BoundaryState {
  hasError: boolean;
}

class WebErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  public state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ZihinHaritam Web] Render error caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FAF9F5] p-6 text-center text-slate-900">
          <h1 className="text-lg font-black">Beklenmeyen bir görünüm hatası oluştu</h1>
          <p className="mt-2 max-w-md text-xs font-semibold text-slate-600">
            Haritalarınız güvende. Sayfayı yenileyerek kaldığınız yerden devam edebilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-600"
          >
            Sayfayı Yenile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <WebErrorBoundary>
        <WebPlatformRoot />
      </WebErrorBoundary>
    </React.StrictMode>
  );
}
