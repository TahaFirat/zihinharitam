import React, { useState } from 'react';
import {
  Check,
  Crown,
  Infinity as InfinityIcon,
  LockOpen,
  Palette,
  RefreshCw,
  Scissors,
  ShieldCheck,
  X,
} from 'lucide-react';
import { APP_RELEASE_CONFIG } from '../config/appReleaseConfig';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import { hapticMedium, hapticSuccess } from '../core/native/NativeBridge';
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
    title: '4. Haritanı Oluşturmak İçin Ömür Boyu Pro’ya Geç',
    subtitle:
      'Mevcut 3 haritan her zaman senindir ve açık kalır. Sınırsız harita ve klasör için tek seferde kilidi aç.',
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
      'Tıp, Sistem Mimarisi, Hukuk, Elektronik ve Mimarlık çıkartmalarını %100 çevrimdışı ömür boyu kullan.',
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
      'Dalları veya görselleri gizleyip dokunarak aç; TUS, YKS, HMGS ve vize/final konularını kalıcı hafızaya kazı.',
  },
  header_pill: {
    badge: 'Tek Seferlik Ömür Boyu Lisans',
    title: 'ZihinHaritam Ömür Boyu Pro',
    subtitle:
      'Tüm akademik çıkartma kütüphanesi, sınırsız harita ve profesyonel PDF/SVG çıktısı tek ödemeyle sonsuza dek senin.',
  },
  settings_upgrade: {
    badge: 'Tek Seferlik Ömür Boyu Lisans',
    title: 'ZihinHaritam Ömür Boyu Pro',
    subtitle:
      'Aylık veya yıllık abonelik olmadan tüm Pro özellikleri cihazlarında ömür boyu aç.',
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
  const { localizedPrice, isBusy, isLifetimePro } = useEntitlements();
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const copy = TRIGGER_HEADERS[triggerReason] ?? TRIGGER_HEADERS.header_pill;

  const handlePurchase = async () => {
    setFeedback(null);
    void hapticMedium();
    const res = await EntitlementManager.purchaseLifetime();

    if (res.purchased) {
      void hapticSuccess();
      setFeedback({
        type: 'success',
        text: 'Ömür Boyu Pro aktif edildi! Tüm sınırlar kaldırıldı.',
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
        text: 'Satın alımınız başarıyla geri yüklendi! Ömür Boyu Pro aktif.',
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
          'Bu Apple hesabına tanımlı önceki bir Ömür Boyu Pro satın alımı bulunamadı.',
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-2.5 backdrop-blur-xs sm:items-center sm:p-4"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
      data-testid="lifetime-paywall-modal"
    >
      <div
        className="relative w-full max-w-[460px] max-h-[92dvh] overflow-y-auto rounded-3xl border p-5 shadow-2xl sm:p-6"
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
          className="absolute top-3.5 right-3.5 flex h-11 w-11 items-center justify-center rounded-full opacity-70 transition hover:bg-slate-500/10 hover:opacity-100"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Contextual Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-extrabold tracking-wide text-amber-600 dark:text-amber-400">
          <Crown className="h-3.5 w-3.5" />
          <span>{copy.badge}</span>
        </div>

        {/* Title & Subtitle */}
        <h2
          id="paywall-modal-title"
          className="mt-3 pr-8 text-xl leading-snug font-extrabold tracking-tight sm:text-[22px]"
        >
          {copy.title}
        </h2>
        <p
          className="mt-1.5 text-[13px] leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {copy.subtitle}
        </p>

        {/* Optional Live Sticker-on-Branch Preview when user tapped a PRO Sticker */}
        {previewSticker && (
          <div
            className="mt-4 flex items-center gap-3.5 rounded-2xl border px-3.5 py-3"
            style={{
              backgroundColor: 'var(--hud-bg)',
              borderColor: 'var(--hud-border)',
            }}
            data-testid="paywall-sticker-live-preview"
          >
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/90 p-1.5 shadow-sm ring-2 ring-amber-400/50 dark:bg-slate-800/90">
              <img
                src={previewSticker.previewUrl}
                alt={previewSticker.title}
                className="h-11 w-11 object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                Canlı Dal Önizlemesi
              </div>
              <div className="truncate text-sm font-extrabold">
                {previewNodeTitle?.trim() || previewSticker.title}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-8 rounded-full"
                  style={{ backgroundColor: previewBranchColor }}
                />
                <span
                  className="truncate text-[11px] font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {previewSticker.providerName} • Kilidi açınca anında eklenir
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4 Core Value Proposition Bullets */}
        <div
          className="mt-4 space-y-2.5 rounded-2xl border p-3.5"
          style={{
            backgroundColor: 'var(--hud-bg)',
            borderColor: 'var(--hud-border)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sky-600 dark:text-sky-400">
              <InfinityIcon className="h-3.5 w-3.5" />
            </div>
            <div className="text-[13px] leading-snug">
              <span className="font-bold">Sınırsız Görsel Zihin Haritası & Klasör</span>
              <span className="block text-xs opacity-75">
                3 harita sınırını kaldır; tüm derslerini ve projelerini klasörle.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Palette className="h-3.5 w-3.5" />
            </div>
            <div className="text-[13px] leading-snug">
              <span className="font-bold">
                25.000+ Akademik & Uzmanlık Çıkartması (%100 Çevrimdışı)
              </span>
              <span className="block text-xs opacity-75">
                Tıp, Sistem Mimarisi, Hukuk, Elektronik, Mimarlık ve Duotone renk uyumu.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <Scissors className="h-3.5 w-3.5" />
            </div>
            <div className="text-[13px] leading-snug">
              <span className="font-bold">
                Sınırsız Nottan Şema Kesme, Sınav Modu & 300 DPI PDF Poster
              </span>
              <span className="block text-xs opacity-75">
                Filigransız A4/A3 vektörel PDF, SVG ve şeffaf PNG dışa aktarma.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div className="text-[13px] leading-snug">
              <span className="font-bold">
                Abonelik Yok! Aylık Ücret Yok! Tek Sefer Öde, Ömür Boyu Kullan.
              </span>
              <span className="block text-xs opacity-75">
                Apple hesabınla iPhone ve iPad cihazlarında ücretsiz geri yüklenir.
              </span>
            </div>
          </div>
        </div>

        {/* Status / Restore Feedback */}
        {feedback && (
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
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

        {/* Primary Purchase CTA (Reads StoreKit localizedPrice dynamically for Guideline 3.1.1) */}
        <button
          type="button"
          disabled={isBusy || isLifetimePro}
          onClick={() => void handlePurchase()}
          data-testid="paywall-purchase-btn"
          className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[15px] font-extrabold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
        >
          {isLifetimePro ? (
            <>
              <Check className="h-4 w-4" />
              <span>Ömür Boyu Pro Aktif</span>
            </>
          ) : isBusy ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>App Store Bağlanıyor...</span>
            </>
          ) : (
            <>
              <LockOpen className="h-4 w-4" />
              <span>Ömür Boyu Erişimi Aç — {localizedPrice}</span>
            </>
          )}
        </button>

        <div
          className="mt-1.5 text-center text-[11px] font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Tek seferlik ödeme ({localizedPrice}) • Otomatik yenilenen abonelik değildir
        </div>

        {/* Mandatory App Store Guideline 3.1.1 Footer Links */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-500/15 pt-3 text-[11.5px] font-semibold">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleRestore()}
            data-testid="paywall-restore-btn"
            className="min-h-[36px] px-1.5 text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
          >
            Satın Alımları Geri Yükle
          </button>
          <span className="opacity-30">•</span>
          <button
            type="button"
            onClick={() => openLegal('terms')}
            className="min-h-[36px] px-1.5 opacity-75 underline-offset-2 hover:opacity-100 hover:underline"
          >
            Kullanım Koşulları
          </button>
          <span className="opacity-30">•</span>
          <button
            type="button"
            onClick={() => openLegal('privacy')}
            className="min-h-[36px] px-1.5 opacity-75 underline-offset-2 hover:opacity-100 hover:underline"
          >
            Gizlilik Politikası
          </button>
        </div>
      </div>
    </div>
  );
};
