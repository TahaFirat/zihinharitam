import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { APP_RELEASE_CONFIG, type ProPlanTier } from '../../config/appReleaseConfig';

export interface StoreProductInfo {
  id: string;
  tier?: ProPlanTier;
  title: string;
  description: string;
  displayPrice: string;
  price: number;
}

export interface PurchaseResult {
  purchased: boolean;
  cancelled?: boolean;
  pending?: boolean;
  productId?: string;
  transactionId?: string;
  errorMessage?: string;
}

export interface RestoreResult {
  restored: boolean;
  isLifetimePro: boolean;
  errorMessage?: string;
}

interface StoreKitBillingPlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreProductInfo[] }>;
  purchaseLifetime(options: { productId: string }): Promise<PurchaseResult>;
  restorePurchases(): Promise<{ restored: boolean; isLifetimePro: boolean }>;
  checkEntitlements(): Promise<{ isLifetimePro: boolean }>;
}

const StoreKitBilling = registerPlugin<StoreKitBillingPlugin>('StoreKitBilling');

const ENTITLEMENT_STORAGE_KEY = 'zh_v4_entitlement_pro_lifetime';
const SANDBOX_RECEIPT_STORAGE_KEY = 'zh_v4_sandbox_cloud_receipt';

const ALL_PRO_PRODUCT_IDS: readonly string[] = [
  APP_RELEASE_CONFIG.iap.monthlyProductId,
  APP_RELEASE_CONFIG.iap.yearlyProductId,
  APP_RELEASE_CONFIG.iap.lifetimeProductId,
];

async function persistVerifiedEntitlement(
  unlocked: boolean,
  txId?: string,
  productId?: string
): Promise<void> {
  const payload = JSON.stringify({
    entitlementId: APP_RELEASE_CONFIG.iap.entitlementId,
    productId: productId ?? APP_RELEASE_CONFIG.iap.yearlyProductId,
    unlocked,
    txId: txId ?? 'verified',
    verifiedAt: Date.now(),
  });

  try {
    localStorage.setItem(ENTITLEMENT_STORAGE_KEY, payload);
  } catch {
    // Ignore private-mode storage errors
  }

  try {
    await Preferences.set({ key: ENTITLEMENT_STORAGE_KEY, value: payload });
  } catch {
    // Ignore Preferences fallback errors on non-native environments
  }
}

export async function readCachedEntitlement(): Promise<boolean> {
  try {
    const localRaw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    if (localRaw) {
      const parsed = JSON.parse(localRaw) as { unlocked?: boolean };
      if (parsed.unlocked === true) return true;
    }
  } catch {
    // Continue to Preferences check
  }

  try {
    const pref = await Preferences.get({ key: ENTITLEMENT_STORAGE_KEY });
    if (pref.value) {
      const parsed = JSON.parse(pref.value) as { unlocked?: boolean };
      return parsed.unlocked === true;
    }
  } catch {
    // Ignore
  }

  return false;
}

function getDefaultPlansMap(): Record<ProPlanTier, StoreProductInfo> {
  const isTrLocale =
    typeof navigator === 'undefined' ||
    (navigator.language || 'tr').toLowerCase().startsWith('tr');
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
 * Unified Billing Adapter (Supports Monthly, Yearly & Lifetime Pro via StoreKit 2):
 * - On iOS (`Capacitor.getPlatform() === 'ios'`): Strictly uses Apple StoreKit 2 (`StoreKitPlugin.swift`).
 *   Never displays external payment links (100% Apple App Review Guideline 3.1.1 & 3.1.2 compliant).
 * - On Web / Dev Preview: Uses realistic local StoreKit Sandbox receipts so purchase & Restore Purchases
 *   can be tested end-to-end offline and in automated verification suites.
 */
export const BillingService = {
  isNativeIos(): boolean {
    return Capacitor.getPlatform() === 'ios';
  },

  async fetchAllProPlans(): Promise<Record<ProPlanTier, StoreProductInfo>> {
    const defaults = getDefaultPlansMap();

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        const { products } = await StoreKitBilling.getProducts({
          productIds: [...ALL_PRO_PRODUCT_IDS],
        });
        for (const p of products) {
          if (!p?.displayPrice) continue;
          if (p.id === defaults.monthly.id) {
            defaults.monthly = { ...defaults.monthly, ...p, tier: 'monthly' };
          } else if (p.id === defaults.yearly.id) {
            defaults.yearly = { ...defaults.yearly, ...p, tier: 'yearly' };
          } else if (p.id === defaults.lifetime.id) {
            defaults.lifetime = { ...defaults.lifetime, ...p, tier: 'lifetime' };
          }
        }
      } catch {
        // Fallback to localized regional prices when offline / Airplane mode
      }
    }

    return defaults;
  },

  async fetchLifetimeProduct(): Promise<StoreProductInfo> {
    const plans = await this.fetchAllProPlans();
    return plans.monthly;
  },

  async purchaseProPlan(tier: ProPlanTier = 'yearly'): Promise<PurchaseResult> {
    const planCfg = APP_RELEASE_CONFIG.iap.plans[tier] ?? APP_RELEASE_CONFIG.iap.plans.yearly;
    const productId = planCfg.productId;

    // 1. Native Apple StoreKit 2 JWS-verified Purchase (Subscription or Non-Consumable)
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        const res = await StoreKitBilling.purchaseLifetime({ productId });
        if (res.purchased) {
          await persistVerifiedEntitlement(true, res.transactionId, productId);
        }
        return res;
      } catch (err) {
        return {
          purchased: false,
          errorMessage:
            err instanceof Error
              ? err.message
              : 'App Store satın alma işlemi tamamlanamadı.',
        };
      }
    }

    // 2. Web / Desktop Sandbox StoreKit Simulator
    const txId = `sk2_sandbox_${tier}_${Date.now()}`;
    try {
      const receiptPayload = JSON.stringify({
        productId,
        tier,
        transactionId: txId,
        purchasedAt: Date.now(),
      });
      localStorage.setItem(SANDBOX_RECEIPT_STORAGE_KEY, receiptPayload);
      await Preferences.set({ key: SANDBOX_RECEIPT_STORAGE_KEY, value: receiptPayload });
    } catch {
      // Ignore storage quota issues
    }

    await persistVerifiedEntitlement(true, txId, productId);
    return {
      purchased: true,
      productId,
      transactionId: txId,
    };
  },

  async purchaseLifetimePro(): Promise<PurchaseResult> {
    return this.purchaseProPlan('yearly');
  },

  async restorePurchases(): Promise<RestoreResult> {
    // 1. Native Apple StoreKit 2 `AppStore.sync()` + `Transaction.currentEntitlements`
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        const res = await StoreKitBilling.restorePurchases();
        if (res.isLifetimePro) {
          await persistVerifiedEntitlement(true, 'restored_storekit2');
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
              : 'App Store satın alımları eşitlenemedi.',
        };
      }
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
    const cached = await readCachedEntitlement();

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        const res = await StoreKitBilling.checkEntitlements();
        if (res.isLifetimePro) {
          await persistVerifiedEntitlement(true, 'launch_storekit2');
          return true;
        }
      } catch {
        return cached;
      }
    }

    return cached;
  },

  async resetLocalEntitlementForTesting(keepCloudReceiptForRestore = true): Promise<void> {
    try {
      localStorage.removeItem(ENTITLEMENT_STORAGE_KEY);
      await Preferences.remove({ key: ENTITLEMENT_STORAGE_KEY });
      if (!keepCloudReceiptForRestore) {
        localStorage.removeItem(SANDBOX_RECEIPT_STORAGE_KEY);
        await Preferences.remove({ key: SANDBOX_RECEIPT_STORAGE_KEY });
      }
    } catch {
      // Ignore
    }
  },
};
