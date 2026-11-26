import React, { useEffect, useState } from 'react';
import {
  Check,
  Crown,
  Gift,
  Infinity as InfinityIcon,
  LockOpen,
  Palette,
  RefreshCw,
  Scissors,
  Sparkles,
  X,
} from 'lucide-react';
import { APP_RELEASE_CONFIG, type ProPlanTier } from '../config/appReleaseConfig';
import { BillingService } from '../core/monetization/BillingService';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import { hapticLight, hapticMedium, hapticSuccess } from '../core/native/NativeBridge';
import { useI18n } from '../core/i18n/i18n';
import type { PaywallTriggerReason, VisualSearchResult } from '../types/mindmap';

export interface LifetimePaywallModalProps {
  isOpen: boolean;
  triggerReason: PaywallTriggerReason;
  previewSticker?: VisualSearchResult | null;
  previewBranchColor?: string;
  previewNodeTitle?: string;
  onClose: () => void;
  onUnlocked?: (unlockedSticker?: VisualSearchResult | null) => void;
  onOpenLegalPage?: (page: 'privacy' | 'terms' | 'support') => void;
}

const TRIGGER_HEADERS: Record<
  PaywallTriggerReason,
  { badge: string; title: string; subtitle: string }
> = {
  map_limit: {
    badge: '2 / 2 Ücretsiz Harita Tamamlandı',
    title: '3. Haritanı Oluşturmak İçin ZihinHaritam Pro’ya Geç',
    subtitle:
      'Mevcut 2 haritan her zaman açık kalır. Sınırsız harita, 43.000+ renkli 3D ikon ve sınav modu için sana en uygun planı seç.',
  },
  node_limit: {
    badge: '60 Düğüm Sınırına Ulaşıldı',
    title: 'Dev Akademik Haritalar İçin Sınırları Kaldır',
    subtitle:
      'Harita başına sınırsız dal, alt konu ve çapraz mimari bağlantı ile tüm ders müfredatını tek posterde topla.',
  },
  pro_sticker: {
    badge: 'Pro Akademik Çıkartma Paketi',
    title: '540.000+ Akademik & 3D Çıkartmanın Kilidini Aç',
    subtitle:
      'Tıp, Tarih, Sistem Mimarisi, Hukuk, Elektronik ve Mimarlık çıkartmalarını sınırsız kullan.',
  },
  note_crop_limit: {
    badge: 'Ücretsiz Deneme Tamamlandı',
    title: 'Sınırsız Ders Notu & Şema Kesimini Aç',
    subtitle:
      'Kitaplarından, slaytlarından ve el yazısı defterinden dilediğin kadar diyagramı kırpıp çıkartmaya dönüştür.',
  },
  smart_map_limit: {
    badge: 'Ücretsiz Deneme Tamamlandı',
    title: 'Sınırsız Metinden Otomatik Zihin Haritası',
    subtitle:
      'Uzun ders özetlerini ve makale maddelerini saniyeler içinde renkli görsel zihin haritasına dönüştür.',
  },
  smart_map_ai: {
    badge: '👑 Pro Yapay Zeka Motoru',
    title: 'Yapay Zeka ile PDF & Ders Notundan Anında Harita',
    subtitle:
      'Yapay zeka slaytlarındaki gereksiz bilgileri ayıklar; yalnızca ders kavramlarını ve formülleri tek tıkla kusursuz zihin haritasına çevirir.',
  },
  ai_sticker_limit: {
    badge: 'Ücretsiz Deneme Tamamlandı',
    title: 'Sınırsız Özel Çıkartma Tasarım Stüdyosu',
    subtitle:
      'Aradığın spesifik kavram için anında die-cut konturlu özel görsel çıkartmalar üret.',
  },
  pro_export: {
    badge: 'Baskı Kalitesi Çıktı',
    title: '300 DPI Filigransız A4/A3 PDF & Vektörel SVG',
    subtitle:
      'Haritalarını sıfır kalite kaybıyla poster olarak yazdır, iPad GoodNotes/Notability içine aktar veya paylaş.',
  },
  exam_mode: {
    badge: 'Aktif Hatırlama (Active Recall)',
    title: 'Tam Sınav & Kendini Test Etme Modunu Aç',
    subtitle:
      'Dalları veya görselleri gizleyip dokunarak aç; TUS, YKS, HMGS, KPSS ve vize/final konularını kalıcı hafızaya kazı.',
  },
  header_pill: {
    badge: 'ZihinHaritam Pro Planları',
    title: 'Tüm Akademik Gücü Cihazlarında Aç',
    subtitle:
      'İster esnek Aylık, ister %50 indirimli Yıllık, istersen tek ödemeyle Ömür Boyu Pro erişimini seç.',
  },
  settings_upgrade: {
    badge: 'ZihinHaritam Pro Planları',
    title: 'Sınırsız Zihin Haritası & 540.000+ İkon',
    subtitle:
      'İhtiyacına göre Aylık, %50 avantajlı Yıllık veya tek seferlik Ömür Boyu lisans ile tüm sınırları kaldır.',
  },
};

export const LifetimePaywallModal: React.FC<LifetimePaywallModalProps> = ({
  isOpen,
  triggerReason,
  previewSticker,
  previewBranchColor = '#0EA5E9',
  previewNodeTitle,
  onClose,
  onUnlocked,
  onOpenLegalPage,
}) => {
  const { t, isEn } = useI18n();
  const { plans, isBusy, isLifetimePro } = useEntitlements();
  const [selectedTier, setSelectedTier] = useState<ProPlanTier>('yearly');
  const [showPromoBox, setShowPromoBox] = useState(false);
  const [promoDraft, setPromoDraft] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const isNativeStore = BillingService.isNativeStorePlatform();
  const isNativeIos = BillingService.isNativeIos();
  const storeName = isNativeStore
    ? isNativeIos
      ? 'App Store'
      : 'Google Play'
    : 'ZihinHaritam Web';

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      void EntitlementManager.refreshStoreProducts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copy = isEn
    ? {
        badge:
          triggerReason === 'map_limit'
            ? '2 / 2 Free Maps Used'
            : triggerReason === 'smart_map_ai'
            ? '👑 Pro AI Mind Map Engine'
            : triggerReason === 'pro_export'
            ? 'Print-Quality Export'
            : 'MindSticker Pro Plans',
        title:
          triggerReason === 'map_limit'
            ? 'Upgrade to Create Unlimited Mind Maps & Flowcharts'
            : triggerReason === 'smart_map_ai'
            ? 'Instant AI Mind Maps from PDFs & Lecture Notes'
            : 'Unlock Full Visual Mind Mapping & Flowchart Power',
        subtitle:
          triggerReason === 'smart_map_ai'
            ? 'Pro AI filters out cover slides and extracts core concepts & mathematical formulas into a clean visual map in seconds.'
            : 'Your existing 2 maps always stay open. Choose flexible Monthly, 50% off Yearly, or one-time Lifetime Pro access.',
      }
    : TRIGGER_HEADERS[triggerReason] ?? TRIGGER_HEADERS.header_pill;
  const activePlan = plans[selectedTier] ?? plans.yearly;
  const activePlanCfg = APP_RELEASE_CONFIG.iap.plans[selectedTier];
  const yearlyTrialDays =
    plans.yearly.introOffer?.eligible && plans.yearly.introOffer.freeTrialDays > 0
      ? plans.yearly.introOffer.freeTrialDays
      : 0;
  const isYearlyTrialEligible = yearlyTrialDays > 0;

  // Dynamically derive the monthly equivalent from the live store yearly price (never hardcoded mismatch!)
  const yearlyMonthlyEquiv = (() => {
    const rawYearly = Number(plans.yearly.price);
    if (!Number.isFinite(rawYearly) || rawYearly <= 0) {
      return APP_RELEASE_CONFIG.iap.plans.yearly.monthlyEquivalentTr;
    }
    const perMonth = Math.floor((rawYearly / 12) * 100) / 100;
    const isTrDisplay = plans.yearly.displayPrice.includes('₺') || plans.yearly.displayPrice.includes('TL');
    if (isTrDisplay) {
      return `${perMonth.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ₺`;
    }
    if (plans.yearly.displayPrice.includes('$')) {
      return `$${perMonth.toFixed(2)}`;
    }
    if (plans.yearly.displayPrice.includes('€')) {
      return `€${perMonth.toFixed(2)}`;
    }
    return `${perMonth.toFixed(2)}`;
  })();

  const handlePurchase = async () => {
    setFeedback(null);
    void hapticMedium();
    const expectedProductId = APP_RELEASE_CONFIG.iap.plans[selectedTier].productId;
    const res = await EntitlementManager.purchasePlan(selectedTier, expectedProductId);

    if (res.purchased) {
      void hapticSuccess();
      setFeedback({
        type: 'success',
        text: 'ZihinHaritam Pro aktif edildi! Tüm sınırlar kaldırıldı.',
      });
      const stickerToApply = previewSticker;
      setTimeout(() => {
        setFeedback(null);
        onUnlocked?.(stickerToApply);
        onClose();
      }, 320);
      return;
    }

    if (res.cancelled) {
      return;
    }

    if (res.pending) {
      setFeedback({
        type: 'info',
        text: `İşleminiz ${storeName} onayı bekliyor. Onaylandığında otomatik açılacaktır.`,
      });
      return;
    }

    if (res.errorMessage) {
      setFeedback({ type: 'error', text: res.errorMessage });
    }
  };

  const handleRestore = async () => {
    setFeedback(null);
    void hapticMedium();
    const res = await EntitlementManager.restorePurchases();

    if (res.isLifetimePro) {
      void hapticSuccess();
      setFeedback({
        type: 'success',
        text: 'Satın alımınız başarıyla geri yüklendi! ZihinHaritam Pro aktif.',
      });
      const stickerToApply = previewSticker;
      setTimeout(() => {
        setFeedback(null);
        onUnlocked?.(stickerToApply);
        onClose();
      }, 420);
    } else {
      setFeedback({
        type: 'info',
        text:
          res.errorMessage ||
          (isNativeStore
            ? 'Bu mağaza hesabına tanımlı aktif bir ZihinHaritam Pro aboneliği veya ömür boyu lisansı bulunamadı.'
            : 'Bu ZihinHaritam hesabına tanımlı aktif bir Pro paketi bulunamadı.'),
      });
    }
  };

  const openLegal = (page: 'privacy' | 'terms') => {
    if (onOpenLegalPage) {
      onOpenLegalPage(page);
      return;
    }
    const url =
      page === 'privacy'
        ? APP_RELEASE_CONFIG.legal.privacyPath
        : APP_RELEASE_CONFIG.legal.termsPath;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRedeemCodeClick = async () => {
    setFeedback(null);
    void hapticLight();
    if (isNativeIos) {
      // Apple Guideline 3.1.1 compliant: Use official native StoreKit 2 Offer Code sheet on iOS
      const res = await EntitlementManager.presentIosOfferCodeSheet();
      if (res.isLifetimePro) {
        void hapticSuccess();
        setFeedback({
          type: 'success',
          text: 'Hediye kodunuz onaylandı! ZihinHaritam Pro tüm cihazlarınızda açıldı.',
        });
        const stickerToApply = previewSticker;
        setTimeout(() => {
          setFeedback(null);
          onUnlocked?.(stickerToApply);
          onClose();
        }, 420);
      } else if (res.errorMessage) {
        setFeedback({ type: 'info', text: res.errorMessage });
      }
      return;
    }
    setShowPromoBox((v) => !v);
  };

  const handleSubmitFriendPromo = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFeedback(null);
    const res = await EntitlementManager.redeemFriendPromoCode(promoDraft);
    if (res.redeemed) {
      void hapticSuccess();
      setFeedback({
        type: 'success',
        text: `Hediye kodu (#${res.slotNumber}/30) onaylandı! ZihinHaritam Pro açıldı.`,
      });
      setPromoDraft('');
      setShowPromoBox(false);
      const stickerToApply = previewSticker;
      setTimeout(() => {
        setFeedback(null);
        onUnlocked?.(stickerToApply);
        onClose();
      }, 450);
    } else {
      setFeedback({
        type: 'error',
        text: res.errorMessage || 'Hediye kodu geçersiz.',
      });
    }
  };

  const ctaLabel =
    selectedTier === 'monthly'
      ? t(
          `Aylık Pro’yu Başlat — ${plans.monthly.displayPrice} / ay`,
          `Start Monthly Pro — ${plans.monthly.displayPrice} / mo`
        )
      : selectedTier === 'yearly'
      ? isYearlyTrialEligible
        ? t(
            `${yearlyTrialDays} Gün Ücretsiz Dene — Sonra ${plans.yearly.displayPrice} / yıl`,
            `Start ${yearlyTrialDays}-Day Free Trial — Then ${plans.yearly.displayPrice} / yr`
          )
        : t(
            `Yıllık Pro’yu Başlat — ${plans.yearly.displayPrice} / yıl`,
            `Start Yearly Pro — ${plans.yearly.displayPrice} / yr`
          )
      : t(
          `Ömür Boyu Erişimi Aç — ${plans.lifetime.displayPrice}`,
          `Unlock Lifetime Access — ${plans.lifetime.displayPrice}`
        );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-2.5 sm:p-4"
      style={{
        paddingTop: 'max(54px, calc(var(--safe-top) + 14px))',
        paddingBottom: 'max(28px, calc(var(--safe-bottom) + 18px))',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
      data-testid="lifetime-paywall-modal"
    >
      <div
        className="relative max-h-full w-full max-w-[475px] overflow-y-auto rounded-3xl border p-4 shadow-2xl sm:p-5"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button (44x44 HIG touch target) */}
        <button
          type="button"
          data-testid="paywall-close-btn"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full opacity-70 transition hover:bg-slate-500/10 hover:opacity-100"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Contextual Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-amber-600 dark:text-amber-400">
          <Crown className="h-3.5 w-3.5" />
          <span>{copy.badge}</span>
        </div>

        {/* Title & Subtitle */}
        <h2
          id="paywall-modal-title"
          className="mt-2 pr-8 text-lg leading-snug font-extrabold tracking-tight sm:text-xl"
        >
          {copy.title}
        </h2>
        <p
          className="mt-1 text-xs leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {copy.subtitle}
        </p>

        {/* Optional Live Sticker-on-Branch Preview when user tapped a PRO Sticker */}
        {previewSticker && (
          <div
            className="mt-3 flex items-center gap-3 rounded-2xl border px-3 py-2"
            style={{
              backgroundColor: 'var(--hud-bg)',
              borderColor: 'var(--hud-border)',
            }}
            data-testid="paywall-sticker-live-preview"
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/90 p-1 shadow-sm ring-2 ring-amber-400/50 dark:bg-slate-800/90">
              <img
                src={previewSticker.previewUrl}
                alt={previewSticker.title}
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                Canlı Dal Önizlemesi
              </div>
              <div className="truncate text-xs font-extrabold">
                {previewNodeTitle?.trim() || previewSticker.title}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-6 rounded-full"
                  style={{ backgroundColor: previewBranchColor }}
                />
                <span
                  className="truncate text-[10.5px] font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {previewSticker.providerName} • Kilidi açınca anında eklenir
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Core Value Bullets (Compact & High-Contrast) */}
        <div
          className="mt-3 grid grid-cols-1 gap-2 rounded-2xl border p-3 text-xs"
          style={{
            backgroundColor: 'var(--hud-bg)',
            borderColor: 'var(--hud-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sky-600 dark:text-sky-400">
              <InfinityIcon className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold">
              {t(
                'Sınırsız Zihin Haritası, Akış Diyagramı & Özel Klasör',
                'Unlimited Mind Maps, Flowcharts & Custom Folders'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Palette className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold">
              {t(
                '30.000+ Renkli 3D, El Çizimi & Akademik Atlas İkonu + 3D Stüdyo',
                '30,000+ Colorful 3D, Hand-Drawn & Academic Stickers + 3D Studio'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <Scissors className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold">
              {t(
                'Nottan Şema Kesme, Flashcard/Sunum Modu & 300 DPI PDF Poster',
                'Note Cropping, Flashcards/Pitch Mode & 300 DPI PDF Posters'
              )}
            </span>
          </div>
        </div>

        {/* 3-Tier Plan Selector: Yearly (%50 Off) | Monthly (250 TL) | Lifetime (One-Time) */}
        <div className="mt-3 space-y-2" role="radiogroup" aria-label="Pro Plan Seçimi">
          {/* 1. YEARLY PLAN (DEFAULT & MOST POPULAR) */}
          <button
            type="button"
            data-testid="plan-card-yearly"
            onClick={() => {
              void hapticLight();
              setSelectedTier('yearly');
            }}
            className={`relative flex w-full items-center justify-between rounded-2xl border-2 px-3.5 py-2.5 text-left transition active:scale-[0.99] ${
              selectedTier === 'yearly'
                ? 'border-amber-500 bg-amber-500/12 shadow-sm'
                : 'border-slate-500/20 bg-white/50 hover:border-slate-500/40 dark:bg-slate-900/40'
            }`}
          >
            <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[9.5px] font-black tracking-wide text-slate-950 shadow-xs">
              <Sparkles className="h-2.5 w-2.5" />
              {isYearlyTrialEligible
                ? t(`${yearlyTrialDays} GÜN ÜCRETSİZ • %50 AVANTAJLI`, `${yearlyTrialDays}-DAY FREE TRIAL • SAVE 50%`)
                : t('EN POPÜLER • %50 AVANTAJLI', 'MOST POPULAR • SAVE 50%')}
            </span>
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selectedTier === 'yearly'
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-400/50'
                }`}
              >
                {selectedTier === 'yearly' && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <div>
                <div className="text-xs font-extrabold sm:text-[13px]">
                  {t('Yıllık Pro Abonelik', 'Yearly Pro Subscription')}
                </div>
                <div className="text-[11px] font-semibold opacity-75">
                  {isYearlyTrialEligible
                    ? t(
                        `İlk ${yearlyTrialDays} gün ücretsiz • Aylık ${yearlyMonthlyEquiv}`,
                        `${yearlyTrialDays} days free • Then ${yearlyMonthlyEquiv}/mo`
                      )
                    : t(
                        `Aylık sadece ${yearlyMonthlyEquiv}’ye gelir • 12 ay tam erişim`,
                        `Only ${yearlyMonthlyEquiv}/mo • 12 months full access`
                      )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-amber-600 sm:text-base dark:text-amber-400">
                {plans.yearly.displayPrice}
              </div>
              <div className="text-[10px] font-bold opacity-65">{t('/ yıl', '/ yr')}</div>
            </div>
          </button>

          {/* 2. MONTHLY PLAN (250 TL / mo) */}
          <button
            type="button"
            data-testid="plan-card-monthly"
            onClick={() => {
              void hapticLight();
              setSelectedTier('monthly');
            }}
            className={`flex w-full items-center justify-between rounded-2xl border-2 px-3.5 py-2 text-left transition active:scale-[0.99] ${
              selectedTier === 'monthly'
                ? 'border-sky-500 bg-sky-500/12 shadow-sm'
                : 'border-slate-500/20 bg-white/50 hover:border-slate-500/40 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selectedTier === 'monthly'
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-slate-400/50'
                }`}
              >
                {selectedTier === 'monthly' && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <div>
                <div className="text-xs font-extrabold sm:text-[13px]">
                  {t('Aylık Pro Abonelik', 'Monthly Pro Subscription')}
                </div>
                <div className="text-[11px] font-semibold opacity-75">
                  {t('Esnek aylık plan • İstediğin zaman iptal et', 'Flexible monthly plan • Cancel anytime')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black sm:text-base">
                {plans.monthly.displayPrice}
              </div>
              <div className="text-[10px] font-bold opacity-65">{t('/ ay', '/ mo')}</div>
            </div>
          </button>

          {/* 3. LIFETIME PLAN (ONE-TIME PURCHASE) */}
          <button
            type="button"
            data-testid="plan-card-lifetime"
            onClick={() => {
              void hapticLight();
              setSelectedTier('lifetime');
            }}
            className={`relative flex w-full items-center justify-between rounded-2xl border-2 px-3.5 py-2 text-left transition active:scale-[0.99] ${
              selectedTier === 'lifetime'
                ? 'border-violet-500 bg-violet-500/12 shadow-sm'
                : 'border-slate-500/20 bg-white/50 hover:border-slate-500/40 dark:bg-slate-900/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selectedTier === 'lifetime'
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : 'border-slate-400/50'
                }`}
              >
                {selectedTier === 'lifetime' && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-extrabold sm:text-[13px]">
                  <span>{t('Ömür Boyu Pro', 'Lifetime Pro')}</span>
                  <span className="rounded-md bg-violet-500/20 px-1.5 py-0.2 text-[9.5px] font-black text-violet-600 dark:text-violet-300">
                    {t('TEK ÖDEME', 'ONE-TIME')}
                  </span>
                </div>
                <div className="text-[11px] font-semibold opacity-75">
                  {t('Abonelik yok • Tek sefer öde, sonsuza dek kullan', 'No subscription • Pay once, own forever')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-violet-600 sm:text-base dark:text-violet-400">
                {plans.lifetime.displayPrice}
              </div>
              <div className="text-[10px] font-bold opacity-65">{t('tek sefer', 'one-time')}</div>
            </div>
          </button>
        </div>

        {/* Status / Restore Feedback */}
        {feedback && (
          <div
            className={`mt-2.5 rounded-xl px-3 py-2 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
            }`}
            data-testid="paywall-feedback-banner"
          >
            {feedback.text}
          </div>
        )}

        {/* Primary Purchase CTA */}
        <button
          type="button"
          disabled={isBusy || isLifetimePro}
          onClick={() => void handlePurchase()}
          data-testid="paywall-purchase-btn"
          className="mt-3.5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60 sm:text-[15px] dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
        >
          {isLifetimePro ? (
            <>
              <Check className="h-4 w-4" />
              <span>ZihinHaritam Pro Aktif</span>
            </>
          ) : isBusy ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>{storeName} Bağlanıyor...</span>
            </>
          ) : (
            <>
              <LockOpen className="h-4 w-4" />
              <span>{ctaLabel}</span>
            </>
          )}
        </button>

        {/* Mandatory Store Auto-Renewal & Free Trial Disclosure (Apple Guideline 3.1.2) */}
        <div
          className="mt-1.5 text-center text-[10.5px] leading-snug font-medium"
          style={{ color: 'var(--text-secondary)' }}
          data-testid="paywall-renewal-disclosure"
        >
          {activePlanCfg.isSubscription
            ? selectedTier === 'yearly' && isYearlyTrialEligible
              ? t(
                  `İlk ${yearlyTrialDays} gün tamamen ücretsizdir; deneme bitmeden en az 24 saat önce iptal ederseniz hiçbir ücret alınmaz. Ardından ${activePlan.displayPrice} / yıl (aylık ${yearlyMonthlyEquiv}) olarak otomatik yenilenir. ${storeName} Abonelikler bölümünden istediğiniz an iptal edebilirsiniz.`,
                  `Free for ${yearlyTrialDays} days; cancel at least 24 hours before trial ends to avoid charges. Then automatically renews at ${activePlan.displayPrice} / year (${yearlyMonthlyEquiv}/mo). Manage or cancel anytime in ${storeName} Subscriptions.`
                )
              : t(
                  `${activePlan.title} (${activePlan.displayPrice}${activePlanCfg.periodLabelTr}): Ödeme mağaza hesabınızdan (App Store / Google Play) tahsil edilir. Dönem bitiminden en az 24 saat önce iptal edilmezse otomatik yenilenir. Hesap Abonelikleri bölümünden istediğiniz an iptal edebilirsiniz.`,
                  `${activePlan.title} (${activePlan.displayPrice}${selectedTier === 'monthly' ? ' / mo' : ' / yr'}): Payment charged to your ${storeName} account. Auto-renews unless canceled at least 24 hours before period ends.`
                )
            : t(
                `Tek seferlik ödeme (${activePlan.displayPrice}) • Otomatik yenilenen abonelik değildir, tüm cihazlarınızda ömür boyu geçerlidir.`,
                `One-time purchase (${activePlan.displayPrice}) • Not a recurring subscription; lifetime access across your devices.`
              )}
        </div>

        {/* Optional Friend Gift Code Input (Android / Web; iOS uses Apple native Offer Code Sheet!) */}
        {!isNativeIos && showPromoBox && !isLifetimePro && (
          <form
            onSubmit={(e) => void handleSubmitFriendPromo(e)}
            className="mt-2.5 flex items-center gap-1.5 rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-2"
            data-testid="paywall-promo-form"
          >
            <input
              type="text"
              value={promoDraft}
              onChange={(e) => setPromoDraft(e.target.value.toUpperCase())}
              placeholder="Hediye kodu (örn. ZHPRO-01-XXXXXX)"
              data-testid="paywall-promo-input"
              className="allow-text-input min-w-0 flex-1 rounded-xl border bg-white/90 px-2.5 py-1.5 font-mono text-base font-extrabold uppercase outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-900/90"
              style={{ borderColor: 'var(--hud-border)' }}
            />
            <button
              type="submit"
              disabled={isBusy || promoDraft.trim().length < 6}
              data-testid="paywall-promo-submit-btn"
              className="min-h-[36px] shrink-0 rounded-xl bg-emerald-600 px-3 text-xs font-extrabold text-white shadow-xs active:scale-95 disabled:opacity-50"
            >
              Onayla
            </button>
          </form>
        )}

        {/* Mandatory App Store Guideline 3.1.1 & 3.1.2 Footer Links */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 border-t border-slate-500/15 pt-2 pb-1 text-[11px] font-semibold">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleRestore()}
            data-testid="paywall-restore-btn"
            className="min-h-[32px] px-1 text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
          >
            {t('Satın Alımları Geri Yükle', 'Restore Purchases')}
          </button>
          <span className="opacity-30">•</span>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleRedeemCodeClick()}
            data-testid="paywall-redeem-code-btn"
            className="inline-flex min-h-[32px] items-center gap-1 px-1 text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
          >
            <Gift className="h-3 w-3" />
            <span>{t('Hediye Kodu', 'Redeem Code')}</span>
          </button>
          <span className="opacity-30">•</span>
          <button
            type="button"
            onClick={() => openLegal('terms')}
            className="min-h-[32px] px-1 opacity-75 underline-offset-2 hover:opacity-100 hover:underline"
          >
            {t('Kullanım Koşulları (EULA)', 'Terms of Use (EULA)')}
          </button>
          <span className="opacity-30">•</span>
          <button
            type="button"
            onClick={() => openLegal('privacy')}
            className="min-h-[32px] px-1 opacity-75 underline-offset-2 hover:opacity-100 hover:underline"
          >
            {t('Gizlilik Politikası', 'Privacy Policy')}
          </button>
        </div>
      </div>
    </div>
  );
};
