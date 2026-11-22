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
  presentOfferCodeRedeemSheet?(): Promise<{ presented: boolean; isLifetimePro: boolean }>;
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
      try {
        const { products } = await StoreKitBilling.getProducts({
          productIds: [...ALL_PRO_PRODUCT_IDS],
        });
        for (const p of products) {
          if (!p?.displayPrice || (typeof p.price === 'number' && p.price <= 0)) continue;
          if (p.id === defaults.monthly.id) {
            defaults.monthly = { ...defaults.monthly, ...p, id: defaults.monthly.id, tier: 'monthly' };
          } else if (p.id === defaults.yearly.id) {
            defaults.yearly = { ...defaults.yearly, ...p, id: defaults.yearly.id, tier: 'yearly' };
          } else if (p.id === defaults.lifetime.id) {
            defaults.lifetime = { ...defaults.lifetime, ...p, id: defaults.lifetime.id, tier: 'lifetime' };
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
          await persistVerifiedEntitlement(true, res.transactionId, res.productId || productId);
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

    if (this.isNativeStorePlatform()) {
      try {
        const res = await StoreKitBilling.checkEntitlements();
        if (res.isLifetimePro) {
          await persistVerifiedEntitlement(true, 'launch_native_store');
          return true;
        }
      } catch {
        return cached;
      }
    }

    return cached;
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
      APP_RELEASE_CONFIG.iap.lifetimeProductId
    );
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
