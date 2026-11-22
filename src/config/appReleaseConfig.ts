/**
 * Central Commercial Release, StoreKit 2 Subscriptions + Lifetime IAP & App Store Configuration (V4)
 * Single source of truth across Web, Capacitor iOS, Legal Pages & Verification Gates.
 */
export type ProPlanTier = 'monthly' | 'yearly' | 'lifetime';

export const APP_RELEASE_CONFIG = {
  appName: 'ZihinHaritam',
  appSubtitle: 'Görsel Zihin Haritası & Not',
  version: '1.0.3',
  bundleId: 'com.tahafirat.zihinharitam',

  appStore: {
    trTitle: 'Zihin Haritası: ZihinHaritam',
    trSubtitle: 'Kavram Haritası & Görsel Not',
    enTitle: 'Mind Map: MindSticker Notes',
    enSubtitle: 'Concept Map, Diagrams & Icons',
    primaryCategory: 'Education',
    secondaryCategory: 'Productivity',
    ageRating: '4+',
  },

  iap: {
    subscriptionGroupName: 'ZihinHaritam Pro',
    monthlyProductId: 'com.tahafirat.zihinharitam.pro_monthly',
    yearlyProductId: 'com.tahafirat.zihinharitam.pro_yearly',
    lifetimeProductId: 'com.tahafirat.zihinharitam.lifetime_pro',
    entitlementId: 'pro_lifetime_unlock',
    productType: 'Auto-Renewable & Non-Consumable' as const,
    defaultDisplayPriceTr: '499 ₺',
    appStorePriceTierTr: '₺499,99',
    appStoreReferenceUsd: '$9.99',
    plans: {
      monthly: {
        tier: 'monthly' as const,
        productId: 'com.tahafirat.zihinharitam.pro_monthly',
        titleTr: 'Aylık Pro',
        titleEn: 'Monthly Pro',
        displayPriceTr: '499 ₺',
        periodLabelTr: '/ ay',
        subtextTr: 'Esnek aylık abonelik • İstediğin an iptal et',
        appStorePriceTierTr: '499.99',
        appStoreReferenceUsd: '$9.99',
        usdNumeric: 9.99,
        trNumeric: 499.99,
        isSubscription: true,
      },
      yearly: {
        tier: 'yearly' as const,
        productId: 'com.tahafirat.zihinharitam.pro_yearly',
        titleTr: 'Yıllık Pro',
        titleEn: 'Yearly Pro',
        displayPriceTr: '2.999 ₺',
        periodLabelTr: '/ yıl',
        monthlyEquivalentTr: '249 ₺ / ay',
        badgeTr: 'EN POPÜLER • %50 AVANTAJLI',
        subtextTr: 'Aylık 249 ₺’ye gelir • 6 ay fiyatına tam 12 ay',
        appStorePriceTierTr: '2999.99',
        appStoreReferenceUsd: '$59.99',
        usdNumeric: 59.99,
        trNumeric: 2999.99,
        isSubscription: true,
      },
      lifetime: {
        tier: 'lifetime' as const,
        productId: 'com.tahafirat.zihinharitam.lifetime_pro',
        titleTr: 'Ömür Boyu Pro',
        titleEn: 'Lifetime Pro',
        displayPriceTr: '4.999 ₺',
        periodLabelTr: 'tek sefer',
        badgeTr: 'ABONELİKSİZ • ÖMÜR BOYU',
        subtextTr: 'Tek sefer öde, bir daha aidat olmadan sonsuza dek kullan',
        appStorePriceTierTr: '4999.99',
        appStoreReferenceUsd: '$99.99',
        usdNumeric: 99.99,
        trNumeric: 4999.99,
        isSubscription: false,
      },
    },
  },

  quotas: {
    freeActiveMapsLimit: 2,
    freeNodesPerMapLimit: 60,
    freeSearchCarouselSlots: 10,
    freeNoteCropsLimit: 5,
    freeSmartMapGenerationsLimit: 2,
    freeAiStickerDrawsLimit: 999,
    trashRetentionDays: 30,
  },

  legal: {
    privacyPath: '/privacy.html',
    termsPath: '/terms.html',
    supportPath: '/support.html',
    supportEmail: 'tafifirat@gmail.com',
    developerName: 'Taha Fırat',
  },
} as const;
