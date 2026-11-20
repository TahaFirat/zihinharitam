/**
 * Central Commercial Release, StoreKit 2 IAP & App Store Configuration (V4)
 * Single source of truth across Web, Capacitor iOS, Legal Pages & Verification Gates.
 */
export const APP_RELEASE_CONFIG = {
  appName: 'ZihinHaritam',
  appSubtitle: 'Görsel Zihin Haritası & Not',
  version: '1.0.1',
  bundleId: 'com.tahafirat.zihinharitam',

  appStore: {
    trTitle: 'ZihinHaritam: Görsel Not & İkon',
    trSubtitle: 'Renkli Zihin Haritası & Sınav',
    enTitle: 'MindSticker: Visual Mind Maps',
    enSubtitle: 'Study Notes, Diagrams & Icons',
    primaryCategory: 'Education',
    secondaryCategory: 'Productivity',
    ageRating: '4+',
  },

  iap: {
    lifetimeProductId: 'com.tahafirat.zihinharitam.lifetime_pro',
    entitlementId: 'pro_lifetime_unlock',
    productType: 'Non-Consumable' as const,
    defaultDisplayPriceTr: '499 ₺',
    appStorePriceTierTr: '₺499,99',
    appStoreReferenceUsd: '$9.99',
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
