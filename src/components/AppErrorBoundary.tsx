import { Component, type ErrorInfo, type ReactNode } from 'react';
import { I18nManager } from '../core/i18n/i18n';

interface BoundaryState {
  hasError: boolean;
  errorHint: string;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false, errorHint: '' };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      hasError: true,
      errorHint: error?.message ? String(error.message).slice(0, 140) : '',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ZihinHaritam] Runtime UI recovery:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetView = () => {
    this.setState({ hasError: false, errorHint: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isEn = I18nManager.getLang() === 'en';
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-[#FAF9F5] p-6 text-slate-900 dark:bg-[#0F141D] dark:text-slate-100"
        role="alert"
      >
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl">
            🛡️
          </div>
          <h1 className="text-lg font-extrabold">
            {isEn ? 'Your maps are safe — let’s refresh' : 'Haritaların güvende — ekranı yenileyelim'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {isEn
              ? 'An unexpected rendering issue occurred. All of your mind maps are safely saved on your device.'
              : 'Beklenmedik bir görünüm hatası oluştu. Tüm zihin haritaların cihazında güvenle kayıtlıdır.'}
          </p>
          {this.state.errorHint && (
            <div className="mt-3 truncate rounded-xl bg-slate-100 px-3 py-1.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {this.state.errorHint}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleResetView}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-extrabold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {isEn ? 'Try Again' : 'Tekrar Dene'}
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white dark:bg-sky-500 dark:text-slate-950"
            >
              {isEn ? 'Reload App' : 'Uygulamayı Yenile'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
