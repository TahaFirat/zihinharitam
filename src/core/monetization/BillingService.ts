import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { APP_RELEASE_CONFIG, type ProPlanTier } from '../../config/appReleaseConfig';

export interface IntroOfferInfo {
  eligible: boolean;
  freeTrialDays: number;
  paymentMode: 'free_trial' | 'pay_as_you_go' | 'pay_up_front';
}

export interface StoreProductInfo {
  id: string;
  tier?: ProPlanTier;
  title: string;
  description: string;
  displayPrice: string;
  price: number;
  introOffer?: IntroOfferInfo;
}

export interface PurchaseResult {
  purchased: boolean;
  cancelled?: boolean;
  pending?: boolean;
  isTrial?: boolean;
  productId?: string;
  transactionId?: string;
  errorMessage?: string;
}

export interface RestoreResult {
  restored: boolean;
  isLifetimePro: boolean;
  errorMessage?: string;
}

export interface WebBillingBridge {
  purchaseProPlan(tier: ProPlanTier, expectedProductId?: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  checkEntitlements(): Promise<{ isLifetimePro: boolean; trialEligible?: boolean }>;
}

function getWebBillingBridge(): WebBillingBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __ZH_WEB_BILLING_BRIDGE__?: WebBillingBridge };
  return w.__ZH_WEB_BILLING_BRIDGE__ ?? null;
}

interface StoreKitBillingPlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreProductInfo[] }>;
  purchaseLifetime(options: { productId: string }): Promise<PurchaseResult>;
  restorePurchases(): Promise<{ restored: boolean; isLifetimePro: boolean }>;
  checkEntitlements(): Promise<{ isLifetimePro: boolean }>;
  presentOfferCodeRedeemSheet?(): Promise<{ presented: boolean; isLifetimePro: boolean }>;
  requestAppReview?(): Promise<{ requested: boolean }>;
}

const StoreKitBilling = registerPlugin<StoreKitBillingPlugin>('StoreKitBilling');

const ENTITLEMENT_STORAGE_KEY = 'zh_v4_entitlement_pro_lifetime';
const SANDBOX_RECEIPT_STORAGE_KEY = 'zh_v4_sandbox_cloud_receipt';
const SANDBOX_TRIAL_USED_KEY = 'zh_v11_sandbox_trial_used';
const REVIEW_DELIGHT_KEY = 'zh_v11_review_delight_state';

type EntitlementSource = 'store' | 'friend_promo' | 'sandbox';

interface PersistedEntitlementPayload {
  entitlementId: string;
  productId: string;
  unlocked: boolean;
  source?: EntitlementSource;
  txId: string;
  verifiedAt: number;
}

const ALL_PRO_PRODUCT_IDS: readonly string[] = [
  APP_RELEASE_CONFIG.iap.monthlyProductId,
  APP_RELEASE_CONFIG.iap.yearlyProductId,
  APP_RELEASE_CONFIG.iap.lifetimeProductId,
];

async function persistVerifiedEntitlement(
  unlocked: boolean,
  txId?: string,
  productId?: string,
  source: EntitlementSource = 'store'
): Promise<void> {
  const payloadObj: PersistedEntitlementPayload = {
    entitlementId: APP_RELEASE_CONFIG.iap.entitlementId,
    productId: productId ?? APP_RELEASE_CONFIG.iap.yearlyProductId,
    unlocked,
    source,
    txId: txId ?? 'verified',
    verifiedAt: Date.now(),
  };
  const payload = JSON.stringify(payloadObj);

  try {
    if (!unlocked) {
      localStorage.removeItem(ENTITLEMENT_STORAGE_KEY);
    } else {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEY, payload);
    }
  } catch {
    // Ignore private-mode storage errors
  }

  try {
    if (!unlocked) {
      await Preferences.remove({ key: ENTITLEMENT_STORAGE_KEY });
    } else {
      await Preferences.set({ key: ENTITLEMENT_STORAGE_KEY, value: payload });
    }
  } catch {
    // Ignore Preferences fallback errors on non-native environments
  }
}

async function readPersistedEntitlementPayload(): Promise<PersistedEntitlementPayload | null> {
  try {
    const localRaw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    if (localRaw) {
      return JSON.parse(localRaw) as PersistedEntitlementPayload;
    }
  } catch {
    // Continue to Preferences
  }
  try {
    const pref = await Preferences.get({ key: ENTITLEMENT_STORAGE_KEY });
    if (pref.value) {
      return JSON.parse(pref.value) as PersistedEntitlementPayload;
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function readCachedEntitlement(): Promise<boolean> {
  const p = await readPersistedEntitlementPayload();
  return p?.unlocked === true;
}

function isSandboxTrialAlreadyUsed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SANDBOX_TRIAL_USED_KEY) === '1';
  } catch {
    return false;
  }
}

function getDefaultPlansMap(): Record<ProPlanTier, StoreProductInfo> {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    tz = '';
  }
  const navLang = typeof navigator !== 'undefined' ? (navigator.language || 'tr').toLowerCase() : 'tr';
  const isTrLocale =
    typeof navigator === 'undefined' ||
    navLang.startsWith('tr') ||
    navLang.endsWith('-tr') ||
    navLang.includes('_tr') ||
    tz.includes('Istanbul');
  const { monthly, yearly, lifetime } = APP_RELEASE_CONFIG.iap.plans;

  return {
    monthly: {
      id: monthly.productId,
      tier: 'monthly',
      title: isTrLocale ? monthly.titleTr : monthly.titleEn,
      description: monthly.subtextTr,
      displayPrice: isTrLocale ? monthly.displayPriceTr : monthly.appStoreReferenceUsd,
      price: isTrLocale ? monthly.trNumeric : monthly.usdNumeric,
    },
    yearly: {
      id: yearly.productId,
      tier: 'yearly',
      title: isTrLocale ? yearly.titleTr : yearly.titleEn,
      description: yearly.subtextTr,
      displayPrice: isTrLocale ? yearly.displayPriceTr : yearly.appStoreReferenceUsd,
      price: isTrLocale ? yearly.trNumeric : yearly.usdNumeric,
    },
    lifetime: {
      id: lifetime.productId,
      tier: 'lifetime',
      title: isTrLocale ? lifetime.titleTr : lifetime.titleEn,
      description: lifetime.subtextTr,
      displayPrice: isTrLocale ? lifetime.displayPriceTr : lifetime.appStoreReferenceUsd,
      price: isTrLocale ? lifetime.trNumeric : lifetime.usdNumeric,
    },
  };
}

/**
 * Unified Native Billing Adapter (Apple StoreKit 2 on iOS + Google Play Billing v7.1 on Android):
 * - On iOS (`Capacitor.getPlatform() === 'ios'`): Uses Apple StoreKit 2 (`StoreKitPlugin.swift`).
 * - On Android (`Capacitor.getPlatform() === 'android'`): Uses Google Play Billing v7.1 (`PlayBillingPlugin.java`).
 * - On Web / Dev Preview: Uses realistic local Sandbox receipts so purchase & Restore Purchases
 *   can be tested end-to-end offline and in automated verification suites.
 */
export const BillingService = {
  isNativeStorePlatform(): boolean {
    const plat = Capacitor.getPlatform();
    return Capacitor.isNativePlatform() && (plat === 'ios' || plat === 'android');
  },

  isNativeIos(): boolean {
    return Capacitor.getPlatform() === 'ios';
  },

  async fetchAllProPlans(): Promise<Record<ProPlanTier, StoreProductInfo>> {
    const defaults = getDefaultPlansMap();

    if (this.isNativeStorePlatform()) {
      // On native iOS/Android: NEVER assume trial eligibility locally — wait strictly for StoreKit 2 / Play Billing!
      try {
        const { products } = await StoreKitBilling.getProducts({
          productIds: [...ALL_PRO_PRODUCT_IDS],
        });
        for (const p of products) {
          if (!p?.displayPrice || (typeof p.price === 'number' && p.price <= 0)) continue;
          const safeIntro: IntroOfferInfo | undefined =
            p.introOffer &&
            p.introOffer.eligible === true &&
            Number(p.introOffer.freeTrialDays) > 0
              ? {
                  eligible: true,
                  freeTrialDays: Math.min(30, Math.max(1, Math.round(Number(p.introOffer.freeTrialDays)))),
                  paymentMode: 'free_trial',
                }
              : undefined;

          if (p.id === defaults.monthly.id) {
            defaults.monthly = {
              ...defaults.monthly,
              ...p,
              id: defaults.monthly.id,
              tier: 'monthly',
              introOffer: undefined, // Monthly NEVER displays trial badge
            };
          } else if (p.id === defaults.yearly.id) {
            defaults.yearly = {
              ...defaults.yearly,
              ...p,
              id: defaults.yearly.id,
              tier: 'yearly',
              introOffer: safeIntro,
            };
          } else if (p.id === defaults.lifetime.id) {
            defaults.lifetime = {
              ...defaults.lifetime,
              ...p,
              id: defaults.lifetime.id,
              tier: 'lifetime',
              introOffer: undefined,
            };
          }
        }
      } catch {
        // Fallback to localized regional prices (without trial claims) when offline
      }
      return defaults;
    }

    // Web / Desktop Sandbox preview: simulate 7-day free trial eligibility on Yearly ONLY until consumed
    if (!isSandboxTrialAlreadyUsed()) {
      defaults.yearly = {
        ...defaults.yearly,
        introOffer: {
          eligible: true,
          freeTrialDays: 7,
          paymentMode: 'free_trial',
        },
      };
    }

    return defaults;
  },

  async fetchLifetimeProduct(): Promise<StoreProductInfo> {
    const plans = await this.fetchAllProPlans();
    return plans.monthly;
  },

  async purchaseProPlan(
    tier: ProPlanTier,
    expectedProductId?: string
  ): Promise<PurchaseResult> {
    const planCfg = APP_RELEASE_CONFIG.iap.plans[tier];
    if (!planCfg) {
      return {
        purchased: false,
        errorMessage: 'Geçersiz abonelik planı seçildi. Lütfen paketi tekrar seçin.',
      };
    }
    const productId = planCfg.productId;
    if (expectedProductId && expectedProductId !== productId) {
      return {
        purchased: false,
        errorMessage: 'Seçilen paket kimliği uyuşmadı. Lütfen paketi yeniden seçip deneyin.',
      };
    }

    // 1. Native Apple StoreKit 2 (iOS) or Google Play Billing v8 (Android)
    if (this.isNativeStorePlatform()) {
      try {
        const res = await StoreKitBilling.purchaseLifetime({ productId });
        if (res.purchased) {
          await persistVerifiedEntitlement(true, res.transactionId, res.productId || productId, 'store');
        }
        return res;
      } catch (err) {
        return {
          purchased: false,
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Mağaza satın alma işlemi tamamlanamadı.',
        };
      }
    }

    // 1.5. Verified Web Platform Checkout Bridge (only active inside web-platform/, untouched on iOS/Android)
    const webBridge = getWebBillingBridge();
    if (webBridge) {
      const res = await webBridge.purchaseProPlan(tier, expectedProductId);
      if (res.purchased) {
        await persistVerifiedEntitlement(true, res.transactionId, res.productId || productId, 'store');
      }
      return res;
    }

    // 2. Web / Desktop Sandbox StoreKit Simulator
    const isTrial = tier === 'yearly' && !isSandboxTrialAlreadyUsed();
    const txId = `sk2_sandbox_${tier}_${Date.now()}`;
    try {
      const receiptPayload = JSON.stringify({
        productId,
        tier,
        isTrial,
        transactionId: txId,
        purchasedAt: Date.now(),
      });
      localStorage.setItem(SANDBOX_RECEIPT_STORAGE_KEY, receiptPayload);
      if (isTrial) {
        localStorage.setItem(SANDBOX_TRIAL_USED_KEY, '1');
      }
      await Preferences.set({ key: SANDBOX_RECEIPT_STORAGE_KEY, value: receiptPayload });
    } catch {
      // Ignore storage quota issues
    }

    await persistVerifiedEntitlement(true, txId, productId, 'sandbox');
    return {
      purchased: true,
      isTrial,
      productId,
      transactionId: txId,
    };
  },

  async purchaseLifetimePro(): Promise<PurchaseResult> {
    return this.purchaseProPlan('yearly');
  },

  async restorePurchases(): Promise<RestoreResult> {
    // 1. Native Apple StoreKit 2 (iOS) or Google Play Billing v7.1 (Android)
    if (this.isNativeStorePlatform()) {
      try {
        const res = await StoreKitBilling.restorePurchases();
        if (res.isLifetimePro) {
          await persistVerifiedEntitlement(true, 'restored_native_store');
        }
        return {
          restored: res.restored,
          isLifetimePro: res.isLifetimePro,
        };
      } catch (err) {
        return {
          restored: false,
          isLifetimePro: await readCachedEntitlement(),
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Mağaza satın alımları eşitlenemedi.',
        };
      }
    }

    // 1.5. Verified Web Platform Restore Bridge
    const webBridge = getWebBillingBridge();
    if (webBridge) {
      const res = await webBridge.restorePurchases();
      await persistVerifiedEntitlement(Boolean(res.isLifetimePro), res.isLifetimePro ? 'web_verified' : 'web_none', undefined, 'store');
      return res;
    }

    // 2. Web / Desktop Sandbox Restore
    try {
      const localReceipt = localStorage.getItem(SANDBOX_RECEIPT_STORAGE_KEY);
      const prefReceipt = (await Preferences.get({ key: SANDBOX_RECEIPT_STORAGE_KEY })).value;
      const rawReceipt = localReceipt || prefReceipt;
      if (rawReceipt) {
        const parsed = JSON.parse(rawReceipt) as { productId?: string; transactionId?: string };
        if (parsed.productId && ALL_PRO_PRODUCT_IDS.includes(parsed.productId)) {
          await persistVerifiedEntitlement(
            true,
            parsed.transactionId ?? 'restored_sandbox',
            parsed.productId
          );
          return { restored: true, isLifetimePro: true };
        }
      }

      const alreadyCached = await readCachedEntitlement();
      if (alreadyCached) {
        return { restored: true, isLifetimePro: true };
      }
    } catch {
      // Ignore parse errors
    }

    return {
      restored: false,
      isLifetimePro: false,
    };
  },

  async syncEntitlementsOnLaunch(): Promise<boolean> {
    const persisted = await readPersistedEntitlementPayload();
    const cachedUnlocked = persisted?.unlocked === true;

    if (this.isNativeStorePlatform()) {
      // Preserve verified Android friend-gift unlocks (never stored on Apple iOS)
      if (!this.isNativeIos() && cachedUnlocked && persisted?.source === 'friend_promo') {
        return true;
      }
      try {
        const res = await StoreKitBilling.checkEntitlements();
        if (res.isLifetimePro) {
          await persistVerifiedEntitlement(true, 'launch_native_store', undefined, 'store');
          return true;
        }
        // Online store confirmed zero active entitlements -> cleanly expire ended trials/subscriptions!
        if (cachedUnlocked && (persisted?.source === 'store' || this.isNativeIos())) {
          await persistVerifiedEntitlement(false, 'expired_native_store', undefined, 'store');
        }
        return false;
      } catch {
        // Offline launch: gracefully trust cached entitlement until next network sync
        return cachedUnlocked;
      }
    }

    // Reconcile strictly with server-verified Web Billing status when running on Web Platform
    const webBridge = getWebBillingBridge();
    if (webBridge) {
      try {
        const res = await webBridge.checkEntitlements();
        const unlocked = Boolean(res?.isLifetimePro);
        await persistVerifiedEntitlement(unlocked, unlocked ? 'web_verified' : 'web_free', undefined, 'store');
        return unlocked;
      } catch {
        return false;
      }
    }

    return cachedUnlocked;
  },

  async recordDelightMomentAndMaybeRequestReview(): Promise<boolean> {
    try {
      const now = Date.now();
      const raw = localStorage.getItem(REVIEW_DELIGHT_KEY);
      const state: { count: number; lastPromptAt: number } = raw
        ? JSON.parse(raw)
        : { count: 0, lastPromptAt: 0 };
      const nextCount = (Number(state.count) || 0) + 1;
      const cooldownMs = 60 * 24 * 60 * 60 * 1000; // Max once every 60 days
      const shouldAsk = nextCount >= 2 && now - (Number(state.lastPromptAt) || 0) > cooldownMs;

      localStorage.setItem(
        REVIEW_DELIGHT_KEY,
        JSON.stringify({
          count: nextCount,
          lastPromptAt: shouldAsk ? now : state.lastPromptAt || 0,
        })
      );

      if (shouldAsk && this.isNativeIos() && StoreKitBilling.requestAppReview) {
        const res = await StoreKitBilling.requestAppReview();
        return Boolean(res?.requested);
      }
      return false;
    } catch {
      return false;
    }
  },

  async presentIosOfferCodeRedeemSheet(): Promise<{
    presented: boolean;
    isLifetimePro: boolean;
    errorMessage?: string;
  }> {
    if (!this.isNativeIos() || !StoreKitBilling.presentOfferCodeRedeemSheet) {
      return {
        presented: false,
        isLifetimePro: await readCachedEntitlement(),
      };
    }
    try {
      const res = await StoreKitBilling.presentOfferCodeRedeemSheet();
      if (res.isLifetimePro) {
        await persistVerifiedEntitlement(true, 'apple_offer_code_redeem');
      }
      return {
        presented: Boolean(res.presented),
        isLifetimePro: Boolean(res.isLifetimePro),
      };
    } catch (err) {
      return {
        presented: false,
        isLifetimePro: await readCachedEntitlement(),
        errorMessage:
          err instanceof Error ? err.message : 'Teklif kodu penceresi açılamadı.',
      };
    }
  },

  async unlockViaFriendPromoCode(codeHash: string, slotNumber: number): Promise<void> {
    await persistVerifiedEntitlement(
      true,
      `friend_gift_slot_${slotNumber}_${codeHash.slice(0, 10)}`,
      APP_RELEASE_CONFIG.iap.lifetimeProductId,
      'friend_promo'
    );
  },

  async resetLocalEntitlementForTesting(keepCloudReceiptForRestore = true): Promise<void> {
    try {
      localStorage.removeItem(ENTITLEMENT_STORAGE_KEY);
      await Preferences.remove({ key: ENTITLEMENT_STORAGE_KEY });
      if (!keepCloudReceiptForRestore) {
        localStorage.removeItem(SANDBOX_RECEIPT_STORAGE_KEY);
        localStorage.removeItem(SANDBOX_TRIAL_USED_KEY);
        await Preferences.remove({ key: SANDBOX_RECEIPT_STORAGE_KEY });
      }
    } catch {
      // Ignore
    }
  },
};
