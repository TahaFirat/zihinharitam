import React from 'react';
import {
  Cloud,
  CloudOff,
  Crown,
  Keyboard,
  Loader2,
  LogIn,
  Maximize2,
  Share2,
} from 'lucide-react';
import type { WebUser } from '../api/webApiClient';
import { WebFocusPomodoro } from './WebFocusPomodoro';

interface WebTopBarProps {
  user: WebUser | null;
  isPro: boolean;
  cloudMapCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  onNavigateHome: () => void;
  onSyncNow: () => void;
  onOpenShare: () => void;
  onOpenCheckout: () => void;
  onToggleZenMode: () => void;
  onOpenShortcuts: () => void;
  onOpenAccount: () => void;
  onOpenAuth: () => void;
}

export const WebTopBar: React.FC<WebTopBarProps> = ({
  user,
  isPro,
  cloudMapCount,
  isSyncing,
  lastSyncedAt,
  onNavigateHome,
  onSyncNow,
  onOpenShare,
  onOpenCheckout,
  onToggleZenMode,
  onOpenShortcuts,
  onOpenAccount,
  onOpenAuth,
}) => {
  return (
    <header className="z-[90] flex h-12 shrink-0 items-center justify-between gap-1.5 border-b border-slate-200/90 bg-white/95 px-2.5 text-slate-900 backdrop-blur-md sm:gap-2 sm:px-3">
      {/* Left: Brand & Cloud Sync Status */}
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <button
          type="button"
          onClick={onNavigateHome}
          title="ZihinHaritam Ana Sayfa"
          className="flex shrink-0 items-center gap-2 rounded-lg p-1 transition hover:bg-slate-100"
        >
          <img
            src="/app-icon.png"
            alt="ZihinHaritam"
            className="h-6 w-6 rounded-md shadow-2xs ring-1 ring-slate-900/10"
          />
          <span className="hidden text-xs font-black tracking-tight text-slate-900 sm:inline">
            ZihinHaritam
          </span>
        </button>

        {user ? (
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            title="Bulutla şimdi eşitle (Ctrl+S)"
            className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2 py-1 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 sm:px-2.5"
          >
            {isSyncing ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-emerald-600" />
            ) : (
              <Cloud className="h-3 w-3 shrink-0 text-emerald-600" />
            )}
            <span className="hidden md:inline">
              {isSyncing
                ? 'Eşitleniyor...'
                : lastSyncedAt
                  ? `Bulutta Güncel (${cloudMapCount})`
                  : 'Buluta Yedekle'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            title="Bulut yedekleme için giriş yapın"
            className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:px-2.5"
          >
            <CloudOff className="h-3 w-3 shrink-0" />
            <span className="hidden md:inline">Misafir</span>
          </button>
        )}
      </div>

      {/* Right: Web Power Tools + Pro + Account */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {!isPro ? (
          <button
            type="button"
            onClick={onOpenCheckout}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-extrabold text-amber-900 transition hover:bg-amber-200 sm:px-2.5 sm:text-xs"
          >
            <Crown className="h-3.5 w-3.5 text-amber-600" />
            <span>Pro</span>
          </button>
        ) : (
          <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800 sm:inline-flex">
            <Crown className="h-3 w-3 text-amber-600" /> PRO
          </span>
        )}

        <WebFocusPomodoro />

        <button
          type="button"
          onClick={onOpenShare}
          title="Paylaşım Bağlantısı (Ctrl+Shift+L)"
          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-extrabold text-indigo-700 transition hover:bg-indigo-100 sm:px-2.5"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Paylaş</span>
        </button>

        <button
          type="button"
          onClick={onToggleZenMode}
          title="Zen Odak Modu (Ctrl+.)"
          className="hidden min-h-[32px] items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900 md:inline-flex"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Zen</span>
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          title="Klavye Kısayolları (?)"
          className="hidden min-h-[32px] items-center justify-center rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900 md:inline-flex"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </button>

        <div className="mx-0.5 h-4 w-px bg-slate-200" />

        {user ? (
          <button
            type="button"
            onClick={onOpenAccount}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-1 pr-2 pl-1 text-xs font-extrabold text-slate-800 shadow-2xs transition hover:border-indigo-300 hover:bg-indigo-50/40 sm:gap-2 sm:pr-2.5 sm:pl-1.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white">
              {user.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden max-w-[100px] truncate sm:inline">{user.displayName}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-1 text-xs font-extrabold text-white shadow-xs transition hover:bg-indigo-600 sm:px-3"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Giriş</span>
          </button>
        )}
      </div>
    </header>
  );
};
