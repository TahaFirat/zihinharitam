import React, { useState } from 'react';
import {
  Check,
  Crown,
  Infinity as InfinityIcon,
  LockOpen,
  Palette,
  RefreshCw,
  Scissors,
  Sparkles,
  X,
} from 'lucide-react';
import { APP_RELEASE_CONFIG, type ProPlanTier } from '../config/appReleaseConfig';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import { hapticLight, hapticMedium, hapticSuccess } from '../core/native/NativeBridge';
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
    badge: '3 / 3 Ücretsiz Harita Tamamlandı',
    title: '4. Haritanı Oluşturmak İçin ZihinHaritam Pro’ya Geç',
    subtitle:
      'Mevcut 3 haritan her zaman açık kalır. Sınırsız harita, 25.000+ ikon ve sınav modu için sana en uygun planı seç.',
  },
  node_limit: {
    badge: '45 Düğüm Sınırına Ulaşıldı',
    title: 'Dev Akademik Haritalar İçin Sınırları Kaldır',
    subtitle:
      'Harita başına sınırsız dal, alt konu ve çapraz mimari bağlantı ile tüm ders müfredatını tek posterde topla.',
  },
  pro_sticker: {
    badge: 'Pro Akademik Çıkartma Paketi',
    title: '25.000+ Akademik Çıkartmanın Kilidini Aç',
    subtitle:
      'Tıp, Sistem Mimarisi, Hukuk, Elektronik ve Mimarlık çıkartmalarını %100 çevrimdışı sınırsız kullan.',
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
    title: 'Sınırsız Zihin Haritası & 25.000+ İkon',
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
  const { plans, isBusy, isLifetimePro } = useEntitlements();
  const [selectedTier, setSelectedTier] = useState<ProPlanTier>('yearly');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const copy = TRIGGER_HEADERS[triggerReason] ?? TRIGGER_HEADERS.header_pill;
  const activePlan = plans[selectedTier] ?? plans.yearly;
  const activePlanCfg = APP_RELEASE_CONFIG.iap.plans[selectedTier];

  const handlePurchase = async () => {
    setFeedback(null);
    void hapticMedium();
    const res = await EntitlementManager.purchasePlan(selectedTier);

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
        text: 'İşleminiz App Store onayı bekliyor. Onaylandığında otomatik açılacaktır.',
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
          'Bu Apple hesabına tanımlı aktif bir ZihinHaritam Pro aboneliği veya ömür boyu lisansı bulunamadı.',
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

  const ctaLabel =
    selectedTier === 'monthly'
      ? `Aylık Pro’yu Başlat — ${plans.monthly.displayPrice} / ay`
      : selectedTier === 'yearly'
      ? `Yıllık Pro’yu Başlat — ${plans.yearly.displayPrice} / yıl`
      : `Ömür Boyu Erişimi Aç — ${plans.lifetime.displayPrice}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-2 sm:items-center sm:p-4"
      style={{
        paddingTop: 'max(12px, var(--safe-top))',
        paddingBottom: 'max(20px, calc(var(--safe-bottom) + 14px))',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
      data-testid="lifetime-paywall-modal"
    >
      <div
        className="relative w-full max-w-[475px] max-h-[93dvh] overflow-y-auto rounded-3xl border p-4 shadow-2xl sm:p-5"
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
              Sınırsız Zihin Haritası, Klasör & Sınırsız Alt Dal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Palette className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold">
              43.000+ Çevrimdışı & 540.000+ Online İkon + 3D Stüdyo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <Scissors className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold">
              Nottan Şema Kesme, Sınav Modu & 300 DPI A4/A3 PDF Poster
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
              EN POPÜLER • %50 AVANTAJLI
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
                  Yıllık Pro Abonelik
                </div>
                <div className="text-[11px] font-semibold opacity-75">
                  Aylık sadece <strong>250 ₺</strong>’ye gelir • 12 ay tam erişim
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-amber-600 sm:text-base dark:text-amber-400">
                {plans.yearly.displayPrice}
              </div>
              <div className="text-[10px] font-bold opacity-65">/ yıl</div>
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
                  Aylık Pro Abonelik
                </div>
                <div className="text-[11px] font-semibold opacity-75">
                  Esnek aylık plan • İstediğin zaman iptal et
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black sm:text-base">
                {plans.monthly.displayPrice}
              </div>
              <div className="text-[10px] font-bold opacity-65">/ ay</div>
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
                  <span>Ömür Boyu Pro</span>
                  <span className="rounded-md bg-violet-500/20 px-1.5 py-0.2 text-[9.5px] font-black text-violet-600 dark:text-violet-300">
                    TEK ÖDEME
                  </span>
                </div>
                <div className="text-[11px] font-semibold opacity-75">
                  Abonelik yok • Tek sefer öde, sonsuza dek kullan
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-violet-600 sm:text-base dark:text-violet-400">
                {plans.lifetime.displayPrice}
              </div>
              <div className="text-[10px] font-bold opacity-65">tek sefer</div>
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
              <span>App Store Bağlanıyor...</span>
            </>
          ) : (
            <>
              <LockOpen className="h-4 w-4" />
              <span>{ctaLabel}</span>
            </>
          )}
        </button>

        {/* Mandatory Store Auto-Renewal & Plan Disclosure */}
        <div
          className="mt-1.5 text-center text-[10.5px] leading-snug font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {activePlanCfg.isSubscription
            ? `${activePlan.title} (${activePlan.displayPrice}${activePlanCfg.periodLabelTr}): Ödeme mağaza hesabınızdan (App Store / Google Play) tahsil edilir. Dönem bitiminden en az 24 saat önce iptal edilmezse otomatik yenilenir. Hesap Abonelikleri bölümünden istediğiniz an iptal edebilirsiniz.`
            : `Tek seferlik ödeme (${activePlan.displayPrice}) • Otomatik yenilenen abonelik değildir, tüm cihazlarınızda ömür boyu geçerlidir.`}
        </div>

        {/* Mandatory App Store Guideline 3.1.1 & 3.1.2 Footer Links */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-500/15 pt-2 text-[11px] font-semibold">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleRestore()}
            data-testid="paywall-restore-btn"
            className="min-h-[32px] px-1 text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
          >
            Satın Alımları Geri Yükle
          </button>
          <span className="opacity-30">•</span>
          <button
            type="button"
            onClick={() => openLegal('terms')}
            className="min-h-[32px] px-1 opacity-75 underline-offset-2 hover:opacity-100 hover:underline"
          >
            Kullanım Koşulları (EULA)
          </button>
          <span className="opacity-30">•</span>
          <button
            type="button"
            onClick={() => openLegal('privacy')}
            className="min-h-[32px] px-1 opacity-75 underline-offset-2 hover:opacity-100 hover:underline"
          >
            Gizlilik Politikası
          </button>
        </div>
      </div>
    </div>
  );
};
