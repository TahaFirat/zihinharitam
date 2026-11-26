import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Minimize2 } from 'lucide-react';
import App from '@app/App';
import type { ProPlanTier } from '@app/config/appReleaseConfig';
import type { PurchaseResult, WebBillingBridge } from '@app/core/monetization/BillingService';
import { EntitlementManager } from '@app/core/monetization/EntitlementManager';
import { LocalStore } from '@app/core/sync/LocalStore';
import type { MindMapDocument } from '@app/types/mindmap';
import {
  WebApi,
  type BillingStatusResponse,
  type CheckoutResponse,
  type WebUser,
} from './api/webApiClient';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { WebTopBar } from './components/WebTopBar';
import { AccountSecurityModal } from './components/AccountSecurityModal';
import { ShareManagerModal } from './components/ShareManagerModal';
import { PublicShareView } from './components/PublicShareView';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { WebCheckoutModal } from './components/WebCheckoutModal';
import {
  cloneSharedMapToLocalWorkspace,
  runBidirectionalCloudSync,
} from './sync/CloudSyncManager';

interface ParsedRoute {
  page: 'landing' | 'auth' | 'app' | 'share';
  authMode: 'login' | 'register';
  shareSlug: string;
}

function parseCurrentRoute(): ParsedRoute {
  const path = window.location.pathname || '/';
  const params = new URLSearchParams(window.location.search);

  if (path.startsWith('/s/')) {
    const slug = path.slice('/s/'.length).split('/')[0] || '';
    return { page: 'share', authMode: 'login', shareSlug: slug };
  }
  if (path === '/auth' || path.startsWith('/auth/')) {
    const mode = params.get('mode') === 'login' ? 'login' : 'register';
    return { page: 'auth', authMode: mode, shareSlug: '' };
  }
  if (path === '/app' || path.startsWith('/app/')) {
    return { page: 'app', authMode: 'login', shareSlug: '' };
  }
  return { page: 'landing', authMode: 'register', shareSlug: '' };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export const WebPlatformRoot: React.FC = () => {
  const [route, setRoute] = useState<ParsedRoute>(() => parseCurrentRoute());
  const [user, setUser] = useState<WebUser | null>(null);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [cloudMapCount, setCloudMapCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const userRef = useRef<WebUser | null>(null);
  userRef.current = user;

  const [localMapsSnapshot, setLocalMapsSnapshot] = useState<MindMapDocument[]>([]);
  const [appRemountKey, setAppRemountKey] = useState(0);

  const [zenMode, setZenMode] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<ProPlanTier>('yearly');
  const checkoutResolverRef = useRef<((res: PurchaseResult) => void) | null>(null);
  const pendingPlanAfterAuthRef = useRef<ProPlanTier | null>(null);

  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    window.setTimeout(() => {
      setToastText((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(parseCurrentRoute());
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const applyServerBilling = useCallback((status: BillingStatusResponse | null) => {
    setBilling(status);
    EntitlementManager.syncVerifiedWebStatus(
      Boolean(status?.isPro),
      status?.trialEligible ?? true
    );
  }, []);

  const refreshServerBilling = useCallback(async () => {
    try {
      const status = await WebApi.getBillingStatus();
      applyServerBilling(status);
      return status;
    } catch {
      applyServerBilling(null);
      return null;
    }
  }, [applyServerBilling]);

  // Install verified Web Billing Bridge so `LifetimePaywallModal` inside `<App />` uses real server checkout!
  useEffect(() => {
    const bridge: WebBillingBridge = {
      purchaseProPlan(tier: ProPlanTier) {
        return new Promise<PurchaseResult>((resolve) => {
          checkoutResolverRef.current = resolve;
          setCheckoutTier(tier);
          setCheckoutOpen(true);
        });
      },
      async restorePurchases() {
        if (!userRef.current) {
          return {
            restored: false,
            isLifetimePro: false,
            errorMessage: 'Satın alımlarınızı geri yüklemek için hesabınızla giriş yapın.',
          };
        }
        try {
          const res = await WebApi.restoreBilling();
          applyServerBilling(res.billing);
          return {
            restored: res.restored,
            isLifetimePro: res.isLifetimePro,
          };
        } catch {
          return {
            restored: false,
            isLifetimePro: false,
            errorMessage: 'Satın alma durumu doğrulanamadı.',
          };
        }
      },
      async checkEntitlements() {
        try {
          const status = await WebApi.getBillingStatus();
          applyServerBilling(status);
          return {
            isLifetimePro: Boolean(status.isPro),
            trialEligible: status.trialEligible,
          };
        } catch {
          return { isLifetimePro: false, trialEligible: true };
        }
      },
    };
    (window as unknown as { __ZH_WEB_BILLING_BRIDGE__?: WebBillingBridge }).__ZH_WEB_BILLING_BRIDGE__ = bridge;
    return () => {
      delete (window as unknown as { __ZH_WEB_BILLING_BRIDGE__?: WebBillingBridge }).__ZH_WEB_BILLING_BRIDGE__;
    };
  }, [applyServerBilling]);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const onPop = () => setRoute(parseCurrentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Lock full viewport ONLY on /app; all other pages (/, /auth, /s/:slug) scroll freely
  useEffect(() => {
    const html = document.documentElement;
    if (route.page === 'app') {
      html.classList.add('web-app-locked');
    } else {
      html.classList.remove('web-app-locked');
    }
    return () => {
      html.classList.remove('web-app-locked');
    };
  }, [route.page]);

  // Hydrate authenticated session & verified billing status on initial page load
  useEffect(() => {
    Promise.all([WebApi.getMe().catch(() => null), WebApi.getBillingStatus().catch(() => null)])
      .then(([me, bill]) => {
        if (me?.authenticated && me.user) {
          setUser(me.user);
        }
        applyServerBilling(bill);
      })
      .finally(() => setAuthChecking(false));
  }, [applyServerBilling]);

  const performCloudSync = useCallback(
    async (silent = false) => {
      if (!userRef.current || isSyncingRef.current) return;
      isSyncingRef.current = true;
      setIsSyncing(true);
      try {
        const res = await runBidirectionalCloudSync();
        setCloudMapCount(res.totalCloudMaps);
        setLastSyncedAt(res.syncedAt);
        if (res.pulledNewOrUpdated > 0) {
          setAppRemountKey((k) => k + 1);
        }
        if (!silent) {
          showToast(`Bulut yedekleme güncellendi (${res.totalCloudMaps} harita)`);
        }
      } catch {
        if (!silent) {
          showToast('Bulut eşitlemesi tamamlanamadı.');
        }
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [showToast]
  );

  // Sync automatically once on login & periodically every 60s while authenticated
  const activeUserId = user?.id ?? null;
  useEffect(() => {
    if (!activeUserId) return;
    void performCloudSync(true);
    void refreshServerBilling();
    const id = window.setInterval(() => {
      void performCloudSync(true);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [activeUserId, performCloudSync, refreshServerBilling]);

  const openShareModal = useCallback(async () => {
    try {
      const maps = await LocalStore.listMaps();
      setLocalMapsSnapshot(maps);
    } catch {
      setLocalMapsSnapshot([]);
    }
    setShareOpen(true);
  }, []);

  const openCheckoutFlow = useCallback((tier: ProPlanTier) => {
    if (!userRef.current) {
      pendingPlanAfterAuthRef.current = tier;
      navigate('/auth?mode=register');
      showToast('Pro paketini hesabınıza tanımlamak için önce giriş yapın.');
      return;
    }
    setCheckoutTier(tier);
    setCheckoutOpen(true);
  }, [navigate, showToast]);

  const handleCheckoutCancel = useCallback(() => {
    setCheckoutOpen(false);
    const resolver = checkoutResolverRef.current;
    checkoutResolverRef.current = null;
    resolver?.({ purchased: false, cancelled: true });
  }, []);

  const handleCheckoutSuccess = useCallback(
    (res: CheckoutResponse) => {
      setCheckoutOpen(false);
      applyServerBilling(res.billing);
      const resolver = checkoutResolverRef.current;
      checkoutResolverRef.current = null;
      resolver?.({
        purchased: true,
        isTrial: res.isTrial,
        productId: res.productId,
        transactionId: res.transactionId,
      });
      showToast('ZihinHaritam Pro hesabınıza tanımlandı!');
      if (route.page === 'landing') {
        navigate('/app');
      }
    },
    [applyServerBilling, navigate, route.page, showToast]
  );

  // Web Keyboard Shortcuts on /app
  useEffect(() => {
    if (route.page !== 'app') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === '.') {
        e.preventDefault();
        setZenMode((v) => {
          const next = !v;
          showToast(next ? 'Zen Odak Modu açıldı (Ctrl+. ile çık)' : 'Zen Odak Modu kapatıldı');
          return next;
        });
        return;
      }

      if (mod && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (userRef.current) {
          void performCloudSync(false);
        } else {
          showToast('Yerel kaydedildi. Bulut yedekleme için giriş yapın.');
        }
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        void openShareModal();
        return;
      }

      if (!mod && e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [route.page, performCloudSync, openShareModal, showToast]);

  const isPro = Boolean(billing?.isPro);

  return (
    <>
      {authChecking && route.page === 'auth' ? (
        <div className="flex min-h-dvh items-center justify-center bg-[#FAF9F5]">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        </div>
      ) : route.page === 'landing' ? (
        <LandingPage
          user={user}
          isPro={isPro}
          onNavigate={navigate}
          onSelectProPlan={(tier) => {
            if (isPro) {
              navigate('/app');
              return;
            }
            openCheckoutFlow(tier);
          }}
        />
      ) : route.page === 'auth' ? (
        <AuthPage
          initialMode={route.authMode}
          onAuthSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            navigate('/app');
            showToast(`Hoş geldin, ${loggedInUser.displayName}!`);
            const pendingTier = pendingPlanAfterAuthRef.current;
            if (pendingTier) {
              pendingPlanAfterAuthRef.current = null;
              setTimeout(() => {
                setCheckoutTier(pendingTier);
                setCheckoutOpen(true);
              }, 350);
            }
          }}
          onNavigate={navigate}
        />
      ) : route.page === 'share' ? (
        <PublicShareView
          slug={route.shareSlug}
          onNavigate={navigate}
          onCloneToWorkspace={async (sharedDoc) => {
            await cloneSharedMapToLocalWorkspace(sharedDoc);
            setAppRemountKey((k) => k + 1);
            navigate('/app');
            showToast('Paylaşılan harita çalışma alanınıza kopyalandı!');
          }}
        />
      ) : (
        <div className="web-app-shell">
          {!zenMode && (
            <WebTopBar
              user={user}
              isPro={isPro}
              cloudMapCount={cloudMapCount}
              isSyncing={isSyncing}
              lastSyncedAt={lastSyncedAt}
              onNavigateHome={() => navigate('/')}
              onSyncNow={() => void performCloudSync(false)}
              onOpenShare={() => void openShareModal()}
              onOpenCheckout={() => openCheckoutFlow('yearly')}
              onToggleZenMode={() => setZenMode(true)}
              onOpenShortcuts={() => setShortcutsOpen(true)}
              onOpenAccount={() => setAccountOpen(true)}
              onOpenAuth={() => navigate('/auth?mode=register')}
            />
          )}

          <div className="web-app-frame">
            <App key={appRemountKey} />
          </div>

          {zenMode && (
            <button
              type="button"
              onClick={() => setZenMode(false)}
              className="fixed right-4 bottom-4 z-[110] inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg backdrop-blur-xs transition hover:bg-indigo-600"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Zen Modundan Çık (Ctrl+.)</span>
            </button>
          )}
        </div>
      )}

      {toastText && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[160] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-2xl bg-slate-900/95 px-4 py-2 text-center text-xs font-extrabold text-white shadow-xl">
          {toastText}
        </div>
      )}

      {user && (
        <AccountSecurityModal
          isOpen={accountOpen}
          user={user}
          billing={billing}
          cloudMapCount={cloudMapCount}
          lastSyncedAt={lastSyncedAt}
          isSyncing={isSyncing}
          onClose={() => setAccountOpen(false)}
          onUserUpdated={(updated) => setUser(updated)}
          onBillingUpdated={applyServerBilling}
          onOpenCheckout={(tier) => openCheckoutFlow(tier)}
          onSyncNow={() => performCloudSync(false)}
          onLoggedOut={() => {
            setUser(null);
            applyServerBilling(null);
            setCloudMapCount(0);
            setLastSyncedAt(null);
            showToast('Güvenli şekilde çıkış yapıldı.');
          }}
        />
      )}

      <ShareManagerModal
        isOpen={shareOpen}
        user={user}
        localMaps={localMapsSnapshot}
        onClose={() => setShareOpen(false)}
        onRequireAuth={() => navigate('/auth?mode=register')}
      />

      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <WebCheckoutModal
        isOpen={checkoutOpen}
        initialTier={checkoutTier}
        user={user}
        billing={billing}
        onCancel={handleCheckoutCancel}
        onRequireAuth={() => navigate('/auth?mode=register')}
        onSuccess={handleCheckoutSuccess}
      />
    </>
  );
};
