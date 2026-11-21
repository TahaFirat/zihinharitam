/**
 * Central Commercial Release, StoreKit 2 Subscriptions + Lifetime IAP & App Store Configuration (V4)
 * Single source of truth across Web, Capacitor iOS, Legal Pages & Verification Gates.
 */
export type ProPlanTier = 'monthly' | 'yearly' | 'lifetime';

export const APP_RELEASE_CONFIG = {
  appName: 'ZihinHaritam',
  appSubtitle: 'Görsel Zihin Haritası & Not',
  version: '1.0.2',
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
    defaultDisplayPriceTr: '250 ₺',
    appStorePriceTierTr: '₺249,99',
    appStoreReferenceUsd: '$4.99',
    plans: {
      monthly: {
        tier: 'monthly' as const,
        productId: 'com.tahafirat.zihinharitam.pro_monthly',
        titleTr: 'Aylık Pro',
        titleEn: 'Monthly Pro',
        displayPriceTr: '250 ₺',
        periodLabelTr: '/ ay',
        subtextTr: 'Esnek aylık abonelik • İstediğin an iptal et',
        appStorePriceTierTr: '249.99',
        appStoreReferenceUsd: '$4.99',
        usdNumeric: 4.99,
        trNumeric: 249.99,
        isSubscription: true,
      },
      yearly: {
        tier: 'yearly' as const,
        productId: 'com.tahafirat.zihinharitam.pro_yearly',
        titleTr: 'Yıllık Pro',
        titleEn: 'Yearly Pro',
        displayPriceTr: '1.499 ₺',
        periodLabelTr: '/ yıl',
        monthlyEquivalentTr: '125 ₺ / ay',
        badgeTr: 'EN POPÜLER • %50 AVANTAJLI',
        subtextTr: 'Aylık 125 ₺’ye gelir • 6 ay fiyatına tam 12 ay',
        appStorePriceTierTr: '1499.99',
        appStoreReferenceUsd: '$29.99',
        usdNumeric: 29.99,
        trNumeric: 1499.99,
        isSubscription: true,
      },
      lifetime: {
        tier: 'lifetime' as const,
        productId: 'com.tahafirat.zihinharitam.lifetime_pro',
        titleTr: 'Ömür Boyu Pro',
        titleEn: 'Lifetime Pro',
        displayPriceTr: '2.499 ₺',
        periodLabelTr: 'tek sefer',
        badgeTr: 'ABONELİKSİZ • ÖMÜR BOYU',
        subtextTr: 'Tek sefer öde, bir daha aidat olmadan sonsuza dek kullan',
        appStorePriceTierTr: '2499.99',
        appStoreReferenceUsd: '$49.99',
        usdNumeric: 49.99,
        trNumeric: 2499.99,
        isSubscription: false,
      },
    },
  },

  quotas: {
    freeActiveMapsLimit: 3,
    freeNodesPerMapLimit: 45,
    freeSearchCarouselSlots: 6,
    freeNoteCropsLimit: 3,
    freeSmartMapGenerationsLimit: 1,
    freeAiStickerDrawsLimit: 1,
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
