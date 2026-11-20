import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { APP_RELEASE_CONFIG } from '../../config/appReleaseConfig';

export interface StoreProductInfo {
  id: string;
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

async function persistVerifiedEntitlement(unlocked: boolean, txId?: string): Promise<void> {
  const payload = JSON.stringify({
    entitlementId: APP_RELEASE_CONFIG.iap.entitlementId,
    productId: APP_RELEASE_CONFIG.iap.lifetimeProductId,
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

/**
 * Unified Billing Adapter:
 * - On iOS (`Capacitor.getPlatform() === 'ios'`): Strictly uses Apple StoreKit 2 (`StoreKitPlugin.swift`).
 *   Never displays external payment links (100% Apple App Review Guideline 3.1.1 compliant).
 * - On Web / Dev Preview: Uses realistic local StoreKit Sandbox receipts so purchase & Restore Purchases
 *   can be tested end-to-end offline and in automated verification suites.
 */
export const BillingService = {
  isNativeIos(): boolean {
    return Capacitor.getPlatform() === 'ios';
  },

  async fetchLifetimeProduct(): Promise<StoreProductInfo> {
    const productId = APP_RELEASE_CONFIG.iap.lifetimeProductId;

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        const { products } = await StoreKitBilling.getProducts({
          productIds: [productId],
        });
        const match = products.find((p) => p.id === productId) ?? products[0];
        if (match && match.displayPrice) {
          return match;
        }
      } catch {
        // Fallback to offline default display price when Airplane mode is active
      }
    }

    const isTrLocale =
      typeof navigator === 'undefined' ||
      (navigator.language || 'tr').toLowerCase().startsWith('tr');

    return {
      id: productId,
      title: 'ZihinHaritam Ömür Boyu Pro',
      description:
        'Sınırsız zihin haritası, 25.000+ akademik çıkartma, nottan şema kesme ve 300 DPI PDF çıktısı.',
      displayPrice: isTrLocale
        ? APP_RELEASE_CONFIG.iap.defaultDisplayPriceTr
        : APP_RELEASE_CONFIG.iap.appStoreReferenceUsd,
      price: isTrLocale ? 499.99 : 9.99,
    };
  },

  async purchaseLifetimePro(): Promise<PurchaseResult> {
    const productId = APP_RELEASE_CONFIG.iap.lifetimeProductId;

    // 1. Native Apple StoreKit 2 JWS-verified In-App Purchase
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        const res = await StoreKitBilling.purchaseLifetime({ productId });
        if (res.purchased) {
          await persistVerifiedEntitlement(true, res.transactionId);
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

    // 2. Web / Desktop Sandbox StoreKit Simulator (persists separate cloud-sync receipt so Restore Purchases works!)
    const txId = `sk2_sandbox_${Date.now()}`;
    try {
      const receiptPayload = JSON.stringify({
        productId,
        transactionId: txId,
        purchasedAt: Date.now(),
      });
      localStorage.setItem(SANDBOX_RECEIPT_STORAGE_KEY, receiptPayload);
      await Preferences.set({ key: SANDBOX_RECEIPT_STORAGE_KEY, value: receiptPayload });
    } catch {
      // Ignore storage quota issues
    }

    await persistVerifiedEntitlement(true, txId);
    return {
      purchased: true,
      productId,
      transactionId: txId,
    };
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

    // 2. Web / Desktop Sandbox Restore: recovers from sandbox receipt store even if local active state was cleared
    try {
      const localReceipt = localStorage.getItem(SANDBOX_RECEIPT_STORAGE_KEY);
      const prefReceipt = (await Preferences.get({ key: SANDBOX_RECEIPT_STORAGE_KEY })).value;
      const rawReceipt = localReceipt || prefReceipt;
      if (rawReceipt) {
        const parsed = JSON.parse(rawReceipt) as { productId?: string; transactionId?: string };
        if (parsed.productId === APP_RELEASE_CONFIG.iap.lifetimeProductId) {
          await persistVerifiedEntitlement(true, parsed.transactionId ?? 'restored_sandbox');
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

  /**
   * Used only in automated QA / developer testing to verify Free <-> Restore flows.
   * Keeps sandbox cloud receipt intact if `keepCloudReceiptForRestore` is true.
   */
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
