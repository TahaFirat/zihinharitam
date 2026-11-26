import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Cloud,
  Crown,
  FileText,
  Keyboard,
  Layers,
  Share2,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import type { ProPlanTier } from '@app/config/appReleaseConfig';
import type { WebUser } from '../api/webApiClient';

interface LandingPageProps {
  user: WebUser | null;
  isPro: boolean;
  onNavigate: (path: string) => void;
  onSelectProPlan: (tier: ProPlanTier) => void;
}

const FEATURES = [
  {
    icon: Sparkles,
    accent: 'from-sky-500 to-indigo-600',
    title: '45.500+ Çevrimdışı Görsel İkon',
    desc: 'Tıp, mühendislik, hukuk, yazılım ve günlük konular dahil 45.500’den fazla temiz vektör ikon. Türkçe-İngilizce akıllı arama ile kavramlarını anında görselleştir.',
  },
  {
    icon: FileText,
    accent: 'from-emerald-500 to-teal-600',
    title: 'Ders Notunu Formata Çevir',
    desc: 'PDF, slayt veya uzun paragraf ders notlarını tek dokunuşla düzenli başlıklara ve renkli zihin haritasına dönüştür.',
  },
  {
    icon: Cloud,
    accent: 'from-violet-500 to-purple-600',
    title: 'Otomatik Bulut Yedekleme',
    desc: 'Ücretsiz hesabınla giriş yaptığında tüm haritaların ve akış diyagramların otomatik yedeklenir; istediğin cihazdan kaldığın yerden devam edersin.',
  },
  {
    icon: Share2,
    accent: 'from-amber-500 to-orange-600',
    title: 'Paylaşılabilir Harita Bağlantısı',
    desc: 'Haritalarını tek tıkla arkadaşlarına veya sınıf grubuna gönder. İsteğe bağlı şifre ve süre sınırı ekle, tek tıkla kopyalanmasına izin ver.',
  },
  {
    icon: Workflow,
    accent: 'from-rose-500 to-pink-600',
    title: 'Akış Diyagramı & 4 Farklı Düzen',
    desc: 'Radyal, Sağa Ağaç, Organizasyon Şeması, Zaman Çizelgesi ve 90° dik açılı Akış Diyagramı Stüdyosu tek çalışma alanında.',
  },
  {
    icon: BookOpen,
    accent: 'from-cyan-500 to-blue-600',
    title: 'Flashcards, Zen Modu & Pomodoro',
    desc: 'Aralıklı tekrar bilgi kartları, sınav hatırlama maskesi, tam ekran odak modu ve yerleşik Pomodoro sayacı ile sınavlara hazır ol.',
  },
];

const PLANS: Array<{
  tier: ProPlanTier;
  badge?: string;
  name: string;
  price: string;
  period: string;
  sub: string;
  highlight?: boolean;
  perks: string[];
}> = [
  {
    tier: 'monthly',
    name: 'Aylık Pro',
    price: '349,99 ₺',
    period: '/ ay',
    sub: 'Esnek kullanım · İstediğin zaman iptal et',
    perks: [
      'Sınırsız zihin haritası ve akış diyagramı',
      '45.500+ tüm Pro ve 3D ikonlara sınırsız erişim',
      '300 DPI filigransız PDF, SVG & Anki dışa aktarım',
      'Sınav hatırlama modu & sınırsız bulut yedekleme',
    ],
  },
  {
    tier: 'yearly',
    badge: 'EN POPÜLER · 7 GÜN ÜCRETSİZ',
    name: 'Yıllık Pro',
    price: '2.099,99 ₺',
    period: '/ yıl',
    sub: 'Aylık yalnızca 174,99 ₺ · %50 tasarruf',
    highlight: true,
    perks: [
      'İlk 7 gün tamamen ücretsiz deneme',
      'Tüm sınırsız harita, diyagram ve ikon paketleri',
      'Sınırsız ders notu dönüştürme ve şema kırpma',
      'Şifreli & süreli web paylaşım bağlantıları',
    ],
  },
  {
    tier: 'lifetime',
    badge: 'TEK ÖDEME',
    name: 'Ömür Boyu Pro',
    price: '3.499,99 ₺',
    period: 'tek sefer',
    sub: 'Abonelik yok · Bir kez öde, sonsuza dek kullan',
    perks: [
      'Tekrarlayan aylık/yıllık ücret yok',
      'Gelecek tüm Pro güncellemeleri dahil',
      'Sınırsız harita, ikon, PDF/SVG dışa aktarım',
      'Öncelikli bulut yedekleme ve paylaşım',
    ],
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  user,
  isPro,
  onNavigate,
  onSelectProPlan,
}) => {
  return (
    <div className="min-h-dvh bg-[#FAF9F5] text-slate-900">
      {/* Sticky Responsive Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#FAF9F5]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <img
              src="/app-icon.png"
              alt="ZihinHaritam"
              className="h-9 w-9 shrink-0 rounded-xl shadow-sm ring-1 ring-slate-900/10"
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                ZihinHaritam
              </span>
              <span className="hidden text-[11px] font-semibold text-slate-500 sm:block">
                Görsel Zihin Haritası &amp; Çalışma Stüdyosu
              </span>
            </div>
          </button>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#ozellikler" className="transition hover:text-slate-900">
              Özellikler
            </a>
            <a href="#kisayollar" className="transition hover:text-slate-900">
              Hızlı Çalışma
            </a>
            <a href="#fiyatlandirma" className="transition hover:text-slate-900">
              Pro Planlar
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {user ? (
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-600 sm:px-4 sm:text-sm"
              >
                <span className="max-w-[120px] truncate sm:max-w-none">
                  Stüdyoyu Aç
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('/auth?mode=login')}
                  className="min-h-[38px] rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200/70 sm:px-3.5 sm:text-sm"
                >
                  Giriş
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/auth?mode=register')}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 sm:px-4 sm:text-sm"
                >
                  <span>Kaydol</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-72 max-w-4xl rounded-full bg-gradient-to-r from-sky-200/50 via-indigo-200/50 to-emerald-200/40 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/90 px-3.5 py-1.5 text-[11px] font-bold text-indigo-700 sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>45.500+ Görsel İkon · Bulut Yedekleme · Akış Diyagramı</span>
            </div>

            <h1 className="mt-4 text-3xl leading-[1.12] font-black tracking-tight text-slate-900 sm:mt-5 sm:text-5xl lg:text-[54px]">
              Ders notlarını saniyeler içinde{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent">
                görsel zihin haritasına
              </span>{' '}
              dönüştür.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed font-medium text-slate-600 sm:mt-5 sm:text-lg">
              Karmaşık ders notlarını, sınav konularını ve proje planlarını tek tuvalde topla.
              Hesabınla bulutta sakla, tek tıkla paylaş ve her cihazda kesintisiz çalış.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => onNavigate(user ? '/app' : '/auth?mode=register')}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-600"
              >
                <Zap className="h-4 w-4 text-amber-300" />
                <span>{user ? 'Çalışma Alanına Git' : 'Ücretsiz Hesap Oluştur'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-extrabold text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50"
              >
                <Layers className="h-4 w-4 text-indigo-600" />
                <span>Hesapsız Hemen Dene</span>
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 sm:mt-7">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Kurulumsuz Anında Açılır
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Telefon, Tablet &amp; Bilgisayar Uyumlu
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> PDF / PNG / SVG / Anki Çıktı
              </span>
            </div>
          </div>

          {/* Mind Map Visual Preview Card */}
          <div className="lg:col-span-5">
            <div className="animate-web-float relative rounded-3xl border border-slate-200/90 bg-white p-4 shadow-2xl shadow-slate-900/10 sm:p-5">
              <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  Bulutta Senkronize ✓
                </span>
              </div>

              <svg viewBox="0 0 420 270" className="w-full rounded-2xl bg-[#FAF9F5] p-2">
                <defs>
                  <pattern id="heroDots" width="18" height="18" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#CBD5E1" />
                  </pattern>
                </defs>
                <rect width="420" height="270" rx="14" fill="url(#heroDots)" />
                <path d="M 210 135 C 165 135, 145 65, 96 60" fill="none" stroke="#6366F1" strokeWidth="4" strokeLinecap="round" />
                <path d="M 210 135 C 255 135, 275 65, 326 60" fill="none" stroke="#0EA5E9" strokeWidth="4" strokeLinecap="round" />
                <path d="M 210 135 C 165 135, 145 205, 96 210" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
                <path d="M 210 135 C 255 135, 275 205, 326 210" fill="none" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />

                <rect x="148" y="109" width="124" height="52" rx="16" fill="#0F172A" />
                <text x="210" y="132" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800">
                  Kardiyoloji
                </text>
                <text x="210" y="149" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="600">
                  EKG &amp; İleti Sistemi
                </text>

                <g>
                  <rect x="18" y="40" width="108" height="38" rx="12" fill="#FFFFFF" stroke="#6366F1" strokeWidth="2" />
                  <text x="72" y="63" textAnchor="middle" fill="#1E293B" fontSize="11" fontWeight="700">
                    ⚡ SA Düğümü
                  </text>
                </g>
                <g>
                  <rect x="294" y="40" width="110" height="38" rx="12" fill="#FFFFFF" stroke="#0EA5E9" strokeWidth="2" />
                  <text x="349" y="63" textAnchor="middle" fill="#1E293B" fontSize="11" fontWeight="700">
                    📈 QRS Kompleksi
                  </text>
                </g>
                <g>
                  <rect x="18" y="190" width="112" height="38" rx="12" fill="#FFFFFF" stroke="#10B981" strokeWidth="2" />
                  <text x="74" y="213" textAnchor="middle" fill="#1E293B" fontSize="11" fontWeight="700">
                    🧠 Bilgi Kartları
                  </text>
                </g>
                <g>
                  <rect x="290" y="190" width="114" height="38" rx="12" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2" />
                  <text x="347" y="213" textAnchor="middle" fill="#1E293B" fontSize="11" fontWeight="700">
                    🔗 Hızlı Paylaş
                  </text>
                </g>
              </svg>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 px-2 py-2">
                  <div className="text-sm font-black text-slate-900">45.5K+</div>
                  <div className="text-[11px] font-semibold text-slate-500">Görsel İkon</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-2">
                  <div className="text-sm font-black text-indigo-600">4 Düzen</div>
                  <div className="text-[11px] font-semibold text-slate-500">+ Diyagram</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-2">
                  <div className="text-sm font-black text-emerald-600">Bulut</div>
                  <div className="text-[11px] font-semibold text-slate-500">Otomatik Yedek</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="ozellikler" className="border-t border-slate-200/80 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <span className="text-xs font-extrabold tracking-wider text-indigo-600 uppercase">
              Öne Çıkan Özellikler
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Tek çalışma alanında uçtan uca görsel düşünme
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-slate-200/80 bg-[#FAF9F5]/70 p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-lg hover:shadow-slate-900/5 sm:p-6"
                >
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-sm`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-extrabold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Keyboard & Focus Workflow */}
      <section id="kisayollar" className="border-t border-slate-200/80 bg-[#FAF9F5] py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:gap-8 sm:p-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                <Keyboard className="h-3.5 w-3.5" />
                <span>Akıcı Masaüstü &amp; Mobil Deneyim</span>
              </div>
              <h2 className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">
                Düşündüğün hızda harita kur, tek tıkla odaklan
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Klavye kısayolları, dikkat dağıtıcı tüm araçları gizleyen Zen Odak Modu ve yerleşik
                Pomodoro çalışma sayacı ile ders ve proje akışında kal.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:col-span-5">
              {[
                { key: 'Ctrl + K', label: 'Komut & İkon Paleti' },
                { key: 'Ctrl + .', label: 'Zen Odak Modu' },
                { key: 'Ctrl + S', label: 'Anında Buluta Kaydet' },
                { key: 'Shift + ?', label: 'Kısayol Rehberi' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5"
                >
                  <kbd className="inline-block rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-extrabold text-slate-900 shadow-2xs">
                    {item.key}
                  </kbd>
                  <div className="mt-2 text-xs font-bold text-slate-600">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pro Pricing Section (Dark Editorial Contrast) */}
      <section id="fiyatlandirma" className="bg-[#0B1120] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-300">
              <Crown className="h-3.5 w-3.5" />
              <span>ZihinHaritam Pro</span>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Sınırları kaldır, tüm gücünü aç
            </h2>
            <p className="mt-2.5 text-sm font-medium text-slate-300">
              Ücretsiz planda 2 harita ve binlerce ikonla hemen başla; ihtiyacın olduğunda sana en
              uygun Pro plana geç.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.tier}
                className={`relative flex flex-col rounded-3xl border p-6 ${
                  plan.highlight
                    ? 'border-indigo-400 bg-gradient-to-b from-indigo-950/90 to-slate-900 shadow-2xl shadow-indigo-500/15'
                    : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                {plan.badge && (
                  <span
                    className={`mb-3 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ${
                      plan.highlight
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-violet-500/25 text-violet-200'
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-lg font-black text-white">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black tracking-tight text-white">{plan.price}</span>
                  <span className="text-xs font-bold text-slate-400">{plan.period}</span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-300">{plan.sub}</p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-xs font-semibold text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onSelectProPlan(plan.tier)}
                  className={`mt-6 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold transition ${
                    plan.highlight
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'bg-white text-slate-950 hover:bg-indigo-100'
                  }`}
                >
                  {isPro ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Pro Üyeliğin Aktif</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {plan.tier === 'yearly' ? '7 Gün Ücretsiz Başla' : `${plan.name} Seç`}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs font-semibold text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/app-icon.png" alt="ZihinHaritam" className="h-6 w-6 rounded-md" />
            <span className="font-bold text-slate-800">ZihinHaritam</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <a href="/privacy.html" target="_blank" rel="noreferrer" className="hover:text-slate-900">
              Gizlilik Politikası
            </a>
            <a href="/terms.html" target="_blank" rel="noreferrer" className="hover:text-slate-900">
              Kullanım Koşulları &amp; Lisanslar
            </a>
            <a href="/support.html" target="_blank" rel="noreferrer" className="hover:text-slate-900">
              Destek
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
