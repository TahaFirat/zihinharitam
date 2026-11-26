import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import type { ProPlanTier } from '@app/config/appReleaseConfig';
import {
  ApiClientError,
  WebApi,
  type BillingStatusResponse,
  type CheckoutResponse,
  type WebUser,
} from '../api/webApiClient';

interface WebCheckoutModalProps {
  isOpen: boolean;
  initialTier: ProPlanTier;
  user: WebUser | null;
  billing: BillingStatusResponse | null;
  onCancel: () => void;
  onRequireAuth: () => void;
  onSuccess: (res: CheckoutResponse) => void;
}

const PLAN_OPTIONS: Array<{
  tier: ProPlanTier;
  title: string;
  badge?: string;
  price: string;
  period: string;
  desc: string;
}> = [
  {
    tier: 'yearly',
    title: 'Yıllık Pro',
    badge: '%50 İNDİRİM',
    price: '2.099,99 ₺',
    period: '/ yıl',
    desc: 'Aylık 174,99 ₺ · İlk 7 gün ücretsiz deneme',
  },
  {
    tier: 'monthly',
    title: 'Aylık Pro',
    price: '349,99 ₺',
    period: '/ ay',
    desc: 'Esnek aylık kullanım · İstediğin an iptal',
  },
  {
    tier: 'lifetime',
    title: 'Ömür Boyu Pro',
    badge: 'TEK ÖDEME',
    price: '3.499,99 ₺',
    period: 'tek sefer',
    desc: 'Abonelik yok · Sonsuza dek tüm özellikler',
  },
];

function formatCardInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export const WebCheckoutModal: React.FC<WebCheckoutModalProps> = ({
  isOpen,
  initialTier,
  user,
  billing,
  onCancel,
  onRequireAuth,
  onSuccess,
}) => {
  const [tier, setTier] = useState<ProPlanTier>(initialTier);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CheckoutResponse | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTier(initialTier);
      setCardholderName(user?.displayName || '');
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setError(null);
      setReceipt(null);
    }
  }, [isOpen, initialTier, user?.displayName]);

  if (!isOpen) return null;

  const selectedPlan = PLAN_OPTIONS.find((p) => p.tier === tier) || PLAN_OPTIONS[0];
  const trialEligible = billing?.trialEligible ?? true;
  const isYearlyTrial = tier === 'yearly' && trialEligible;
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await WebApi.submitCheckout({
        tier,
        cardholderName: cardholderName.trim(),
        cardNumber,
        expiry,
        cvc,
      });
      setReceipt(res);
      setTimeout(() => {
        onSuccess(res);
      }, 950);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Ödeme işlemi tamamlanamadı. Lütfen bilgilerinizi kontrol edin.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 sm:text-base">
                ZihinHaritam Pro’ya Geç
              </h2>
              <p className="text-[11px] font-semibold text-slate-500">
                Anında hesabına tanımlanır · Tüm cihazlarda geçerli
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!user ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 text-center">
              <Sparkles className="mx-auto h-9 w-9 text-indigo-600" />
              <h3 className="mt-3 text-base font-black text-slate-900">
                Önce Hesabınıza Giriş Yapın
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed font-medium text-slate-600">
                Satın alacağınız Pro lisansının hesabınıza güvenle tanımlanması ve her cihazdan
                erişebilmeniz için ücretsiz hesabınızla giriş yapmanız gerekir.
              </p>
              <button
                type="button"
                onClick={() => {
                  onCancel();
                  onRequireAuth();
                }}
                className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700"
              >
                Giriş Yap / Hesap Oluştur
              </button>
            </div>
          ) : receipt ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900">
                ZihinHaritam Pro Aktif!
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {receipt.isTrial
                  ? '7 günlük ücretsiz denemeniz başlatıldı. Tüm Pro özellikler açık!'
                  : 'Ödemeniz onaylandı. Sınırsız harita ve tüm Pro özellikler açıldı!'}
              </p>
              <div className="mx-auto mt-4 max-w-xs rounded-2xl bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
                Makbuz No: <span className="font-mono text-indigo-600">{receipt.receiptNo}</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Plan selector */}
              <div className="space-y-2">
                {PLAN_OPTIONS.map((p) => {
                  const active = tier === p.tier;
                  return (
                    <button
                      key={p.tier}
                      type="button"
                      onClick={() => setTier(p.tier)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition ${
                        active
                          ? 'border-indigo-600 bg-indigo-50/60'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            active
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {active && <Check className="h-3 w-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-slate-900">
                            <span>{p.title}</span>
                            {p.badge && (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-black text-amber-800">
                                {p.badge}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[11px] font-medium text-slate-500">
                            {p.tier === 'yearly' && !trialEligible
                              ? 'Aylık 174,99 ₺ · %50 tasarruf'
                              : p.desc}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-black text-slate-900">{p.price}</div>
                        <div className="text-[10px] font-bold text-slate-500">{p.period}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Card Payment Form */}
              <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <CreditCard className="h-4 w-4 text-indigo-600" />
                    Kart Bilgileri
                  </span>
                  {isLocalhost && (
                    <button
                      type="button"
                      onClick={() => {
                        setCardholderName(user.displayName || 'Taha Firat');
                        setCardNumber('4242 4242 4242 4242');
                        setExpiry('12/29');
                        setCvc('424');
                        setError(null);
                      }}
                      className="rounded-lg bg-indigo-100 px-2 py-1 text-[10px] font-extrabold text-indigo-700 hover:bg-indigo-200"
                    >
                      Test Kartı Doldur
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Kart Üzerindeki Ad Soyad
                  </label>
                  <input
                    type="text"
                    required
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="Ad Soyad"
                    autoComplete="cc-name"
                    className="allow-text-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-medium outline-none focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600">
                    Kart Numarası
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardInput(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    autoComplete="cc-number"
                    className="allow-text-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-base font-semibold outline-none focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Son Kullanma (AA/YY)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
                      placeholder="12/29"
                      autoComplete="cc-exp"
                      className="allow-text-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-base font-semibold outline-none focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Güvenlik Kodu (CVC)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      required
                      maxLength={4}
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="•••"
                      autoComplete="cc-csc"
                      className="allow-text-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-base font-semibold outline-none focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white">
                <div>
                  <div className="text-[11px] font-semibold text-slate-300">
                    Bugün Tahsil Edilecek Tutar
                  </div>
                  <div className="text-xs font-bold text-slate-200">
                    {selectedPlan.title}
                    {isYearlyTrial ? ' (7 gün sonra 2.099,99 ₺ / yıl)' : ''}
                  </div>
                </div>
                <div className="text-lg font-black text-amber-300">
                  {isYearlyTrial ? '0,00 ₺' : selectedPlan.price}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>
                      {isYearlyTrial
                        ? '7 Günlük Ücretsiz Denemeyi Başlat'
                        : `Ödemeyi Tamamla · ${selectedPlan.price}`}
                    </span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] font-medium text-slate-400">
                Kart bilgileriniz saklanmaz. Aboneliğinizi Hesap ayarlarından istediğiniz zaman iptal
                edebilirsiniz.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
