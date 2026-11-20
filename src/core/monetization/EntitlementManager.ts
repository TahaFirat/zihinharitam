import { useSyncExternalStore } from 'react';
import { APP_RELEASE_CONFIG, type ProPlanTier } from '../../config/appReleaseConfig';
import type { VisualSearchResult } from '../../types/mindmap';
import {
  BillingService,
  readCachedEntitlement,
  type PurchaseResult,
  type RestoreResult,
  type StoreProductInfo,
} from './BillingService';

export interface UsageCounters {
  noteCropsUsed: number;
  smartMapsUsed: number;
  aiStickersUsed: number;
}

export interface EntitlementSnapshot {
  isLifetimePro: boolean;
  localizedPrice: string;
  plans: Record<ProPlanTier, StoreProductInfo>;
  productTitle: string;
  isBusy: boolean;
  usage: UsageCounters;
}

const USAGE_STORAGE_KEY = 'zh_v4_free_usage_counters';

function loadUsageCounters(): UsageCounters {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<UsageCounters>;
      return {
        noteCropsUsed: Number(p.noteCropsUsed) || 0,
        smartMapsUsed: Number(p.smartMapsUsed) || 0,
        aiStickersUsed: Number(p.aiStickersUsed) || 0,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return { noteCropsUsed: 0, smartMapsUsed: 0, aiStickersUsed: 0 };
}

function saveUsageCounters(usage: UsageCounters): void {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Ignore storage write errors
  }
}

function isSpecialistProVisual(item: VisualSearchResult): boolean {
  if (item.source === 'ai_pool') return true;
  if (item.isDuotoneColorizable) return true;

  const prov = (item.providerName || '').toLowerCase();
  if (
    prov.includes('systemdesign') ||
    prov.includes('healthicons') ||
    prov.includes('medical atlas') ||
    prov.includes('ibm carbon') ||
    prov.includes('phosphor duotone') ||
    prov.includes('ansiklopedik') ||
    prov.includes('tabler teknik') ||
    prov.includes('devicon') ||
    prov.includes('skill icons') ||
    prov.includes('teknoloji logosu')
  ) {
    return true;
  }

  return false;
}

class EntitlementStore {
  private snapshot: EntitlementSnapshot = {
    isLifetimePro: false,
    localizedPrice: APP_RELEASE_CONFIG.iap.defaultDisplayPriceTr,
    plans: {
      monthly: {
        id: APP_RELEASE_CONFIG.iap.monthlyProductId,
        tier: 'monthly',
        title: APP_RELEASE_CONFIG.iap.plans.monthly.titleTr,
        description: APP_RELEASE_CONFIG.iap.plans.monthly.subtextTr,
        displayPrice: APP_RELEASE_CONFIG.iap.plans.monthly.displayPriceTr,
        price: APP_RELEASE_CONFIG.iap.plans.monthly.trNumeric,
      },
      yearly: {
        id: APP_RELEASE_CONFIG.iap.yearlyProductId,
        tier: 'yearly',
        title: APP_RELEASE_CONFIG.iap.plans.yearly.titleTr,
        description: APP_RELEASE_CONFIG.iap.plans.yearly.subtextTr,
        displayPrice: APP_RELEASE_CONFIG.iap.plans.yearly.displayPriceTr,
        price: APP_RELEASE_CONFIG.iap.plans.yearly.trNumeric,
      },
      lifetime: {
        id: APP_RELEASE_CONFIG.iap.lifetimeProductId,
        tier: 'lifetime',
        title: APP_RELEASE_CONFIG.iap.plans.lifetime.titleTr,
        description: APP_RELEASE_CONFIG.iap.plans.lifetime.subtextTr,
        displayPrice: APP_RELEASE_CONFIG.iap.plans.lifetime.displayPriceTr,
        price: APP_RELEASE_CONFIG.iap.plans.lifetime.trNumeric,
      },
    },
    productTitle: 'ZihinHaritam Pro',
    isBusy: false,
    usage: loadUsageCounters(),
  };

  private listeners = new Set<() => void>();
  private initialized = false;

  constructor() {
    // Hydrate synchronous localStorage entitlement immediately so Pro users never see a single frame of Free badge
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem('zh_v4_entitlement_pro_lifetime')
        : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { unlocked?: boolean };
        if (parsed.unlocked === true) {
          this.snapshot = { ...this.snapshot, isLifetimePro: true };
        }
      }
    } catch {
      // Ignore SSR/Node environments
    }
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private update(patch: Partial<EntitlementSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit();
  }

  public getSnapshot = (): EntitlementSnapshot => this.snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const [cachedUnlocked, plans] = await Promise.all([
      BillingService.syncEntitlementsOnLaunch(),
      BillingService.fetchAllProPlans(),
    ]);

    this.update({
      isLifetimePro: cachedUnlocked || this.snapshot.isLifetimePro,
      plans,
      localizedPrice:
        plans.monthly.displayPrice || APP_RELEASE_CONFIG.iap.defaultDisplayPriceTr,
      productTitle: plans.yearly.title || 'ZihinHaritam Pro',
    });
  }

  /**
   * Free Tier Rule 1: Up to 3 active (non-trashed) maps are free.
   * Creating, duplicating, importing, or restoring a 4th active map requires Pro.
   */
  public canCreateActiveMap(activeMapsCount: number): boolean {
    if (this.snapshot.isLifetimePro) return true;
    return activeMapsCount < APP_RELEASE_CONFIG.quotas.freeActiveMapsLimit;
  }

  /**
   * Free Tier Rule 2: Up to 45 nodes per map are free; 46th node invites user to Pro.
   */
  public canAddNodeToMap(currentNodesCount: number): boolean {
    if (this.snapshot.isLifetimePro) return true;
    return currentNodesCount < APP_RELEASE_CONFIG.quotas.freeNodesPerMapLimit;
  }

  /**
   * Free Tier Rule 3:
   * - ~1,500 `tier: 'free'` starter icons + first 6 standard non-specialist results in search bar are free.
   * - 7th+ results (`indexInSearch >= 6`), 25,000+ specialist icons (`healthicons`, `SystemDesign`,
   *   `Duotone` branch-colorized, medical/law/architecture/engineering packs), and Infinite Gallery
   *   items require Lifetime Pro (`PRO` badge + live preview paywall).
   */
  public isStickerFree(
    item: VisualSearchResult,
    indexInSearch: number,
    surface: 'keyboard_bar' | 'gallery' | 'command_palette' = 'keyboard_bar'
  ): boolean {
    if (this.snapshot.isLifetimePro) return true;

    if (indexInSearch >= APP_RELEASE_CONFIG.quotas.freeSearchCarouselSlots) {
      return false;
    }

    if (isSpecialistProVisual(item)) {
      return false;
    }

    if (surface === 'gallery') {
      return item.tier === 'free';
    }

    return item.tier === 'free' || !isSpecialistProVisual(item);
  }

  public canUseNoteCrop(): boolean {
    if (this.snapshot.isLifetimePro) return true;
    return (
      this.snapshot.usage.noteCropsUsed <
      APP_RELEASE_CONFIG.quotas.freeNoteCropsLimit
    );
  }

  public recordNoteCropUsed(): void {
    if (this.snapshot.isLifetimePro) return;
    const next: UsageCounters = {
      ...this.snapshot.usage,
      noteCropsUsed: this.snapshot.usage.noteCropsUsed + 1,
    };
    saveUsageCounters(next);
    this.update({ usage: next });
  }

  public canUseSmartMap(): boolean {
    if (this.snapshot.isLifetimePro) return true;
    return (
      this.snapshot.usage.smartMapsUsed <
      APP_RELEASE_CONFIG.quotas.freeSmartMapGenerationsLimit
    );
  }

  public recordSmartMapUsed(): void {
    if (this.snapshot.isLifetimePro) return;
    const next: UsageCounters = {
      ...this.snapshot.usage,
      smartMapsUsed: this.snapshot.usage.smartMapsUsed + 1,
    };
    saveUsageCounters(next);
    this.update({ usage: next });
  }

  public canUseAiSticker(): boolean {
    if (this.snapshot.isLifetimePro) return true;
    return (
      this.snapshot.usage.aiStickersUsed <
      APP_RELEASE_CONFIG.quotas.freeAiStickerDrawsLimit
    );
  }

  public recordAiStickerUsed(): void {
    if (this.snapshot.isLifetimePro) return;
    const next: UsageCounters = {
      ...this.snapshot.usage,
      aiStickersUsed: this.snapshot.usage.aiStickersUsed + 1,
    };
    saveUsageCounters(next);
    this.update({ usage: next });
  }

  public canUseProExport(): boolean {
    return this.snapshot.isLifetimePro;
  }

  public canUseFullExamMode(): boolean {
    return this.snapshot.isLifetimePro;
  }

  public async purchasePlan(tier: ProPlanTier = 'yearly'): Promise<PurchaseResult> {
    this.update({ isBusy: true });
    try {
      const res = await BillingService.purchaseProPlan(tier);
      if (res.purchased) {
        this.update({ isLifetimePro: true, isBusy: false });
      } else {
        this.update({ isBusy: false });
      }
      return res;
    } catch (err) {
      this.update({ isBusy: false });
      return {
        purchased: false,
        errorMessage:
          err instanceof Error ? err.message : 'Satın alma başlatılamadı.',
      };
    }
  }

  public async purchaseLifetime(): Promise<PurchaseResult> {
    return this.purchasePlan('yearly');
  }

  public async restorePurchases(): Promise<RestoreResult> {
    this.update({ isBusy: true });
    try {
      const res = await BillingService.restorePurchases();
      const cached = res.isLifetimePro || (await readCachedEntitlement());
      this.update({ isLifetimePro: cached, isBusy: false });
      return { ...res, isLifetimePro: cached };
    } catch (err) {
      this.update({ isBusy: false });
      return {
        restored: false,
        isLifetimePro: this.snapshot.isLifetimePro,
        errorMessage:
          err instanceof Error ? err.message : 'Geri yükleme başarısız.',
      };
    }
  }

  public async resetForTesting(keepCloudReceiptForRestore = true): Promise<void> {
    await BillingService.resetLocalEntitlementForTesting(keepCloudReceiptForRestore);
    this.update({ isLifetimePro: false });
  }
}

export const EntitlementManager = new EntitlementStore();

if (typeof window !== 'undefined') {
  void EntitlementManager.initialize();
  // Expose lightweight QA/Verification handle for Playwright & automated App Store readiness checks
  (
    window as unknown as {
      __ZH_ENTITLEMENTS__?: EntitlementStore;
    }
  ).__ZH_ENTITLEMENTS__ = EntitlementManager;
}

export function useEntitlements(): EntitlementSnapshot {
  return useSyncExternalStore(
    EntitlementManager.subscribe,
    EntitlementManager.getSnapshot,
    EntitlementManager.getSnapshot
  );
}
