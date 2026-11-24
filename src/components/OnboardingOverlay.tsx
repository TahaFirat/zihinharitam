import React, { useEffect, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { ArrowRight, Check } from 'lucide-react';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';

export const ONBOARDING_STORAGE_KEY = 'onboarding_v4_done';

export function hasCompletedOnboardingSync(): boolean {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

export function persistOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    // Ignore storage write errors
  }
  void Preferences.set({ key: ONBOARDING_STORAGE_KEY, value: '1' }).catch(() => {
    // Ignore native preference fallback errors on web
  });
}

export async function checkNativeOnboardingCompleted(): Promise<boolean> {
  if (hasCompletedOnboardingSync()) {
    persistOnboardingCompleted();
    return true;
  }
  try {
    const res = await Preferences.get({ key: ONBOARDING_STORAGE_KEY });
    if (res.value === '1' || res.value === 'true') {
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
      } catch {
        // Ignore
      }
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

interface OnboardingOverlayProps {
  onComplete: () => void;
}

const STEPS = [
  {
    step: '1 / 4',
    title: 'Dalı Parmağınla Çek & Yaz',
    desc: 'Merkez konunun yanındaki + noktasından parmağınla veya kalemle çekerek organik renkli dallar oluştur. Sesle dikte de desteklenir!',
    renderArt: () => (
      <svg viewBox="0 0 280 140" className="h-32 w-full">
        <rect width="280" height="140" rx="20" fill="#F4F2EA" />
        <path
          d="M 88 72 C 132 72, 146 38, 194 38"
          stroke="#0EA5E9"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 88 72 C 132 72, 146 104, 194 104"
          stroke="#F59E0B"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="6 6"
          fill="none"
        />
        <rect x="24" y="52" width="76" height="40" rx="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
        <rect x="38" y="69" width="48" height="6" rx="3" fill="#0F172A" />
        <rect x="184" y="20" width="72" height="36" rx="11" fill="#FFFFFF" stroke="#0EA5E9" strokeWidth="2.5" />
        <rect x="198" y="35" width="44" height="6" rx="3" fill="#0284C7" />
        <circle cx="198" cy="104" r="14" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="3" />
        <path d="M198 98 v12 M192 104 h12" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: '2 / 4',
    title: 'Yazarken Renkli Oyunlaştırılmış İkonları Seç',
    desc: 'Türkçe veya İngilizce yazdığın anda 43.000+ çevrimdışı ve 540.000+ canlı renkli 3D ikon saniyeler içinde karşına gelir.',
    renderArt: () => (
      <svg viewBox="0 0 280 140" className="h-32 w-full">
        <rect width="280" height="140" rx="20" fill="#F4F2EA" />
        <g transform="translate(36, 26)">
          <rect width="60" height="60" rx="16" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
          <circle cx="30" cy="30" r="16" fill="#F43F5E" opacity="0.18" />
          <path
            d="M30 41 C20 33, 17 24, 23 19 C27 16, 30 20, 30 22 C30 20, 33 16, 37 19 C43 24, 40 33, 30 41 Z"
            fill="#F43F5E"
          />
        </g>
        <g transform="translate(110, 18)">
          <rect width="64" height="64" rx="18" fill="#FFFFFF" stroke="#0EA5E9" strokeWidth="2.5" />
          <rect x="16" y="16" width="32" height="11" rx="4" fill="#0EA5E9" />
          <rect x="16" y="31" width="32" height="11" rx="4" fill="#38BDF8" />
          <circle cx="22" cy="21.5" r="2" fill="#FFF" />
          <circle cx="22" cy="36.5" r="2" fill="#FFF" />
        </g>
        <g transform="translate(188, 26)">
          <rect width="60" height="60" rx="16" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
          <circle cx="30" cy="30" r="16" fill="#10B981" opacity="0.18" />
          <path d="M22 36 L30 20 L38 36 Z" fill="#10B981" />
        </g>
        <rect x="56" y="98" width="168" height="24" rx="12" fill="#0F172A" />
        <rect x="86" y="107" width="108" height="6" rx="3" fill="#F8FAFC" />
      </svg>
    ),
  },
  {
    step: '3 / 4',
    title: 'Akış Diyagramı, Kalem & Aralıklı Tekrar',
    desc: 'Ayrı Akış Diyagramı stüdyosuyla süreç şemaları kur; S-Pen / Apple Pencil ile kalem, fosforlu, oto-şekil (basılı tut) ve silgi kullan, haritanı Flashcard ve Sunum moduna çevir!',
    renderArt: () => (
      <svg viewBox="0 0 280 140" className="h-32 w-full">
        <rect width="280" height="140" rx="20" fill="#F4F2EA" />
        <rect x="34" y="24" width="84" height="72" rx="14" fill="#FEF08A" stroke="#EAB308" strokeWidth="2" />
        <rect x="46" y="42" width="56" height="5" rx="2.5" fill="#713F12" />
        <rect x="46" y="56" width="42" height="5" rx="2.5" fill="#A16207" />
        <path d="M138 92 C164 40, 198 112, 240 42" stroke="#0EA5E9" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M138 66 L236 66" stroke="#FACC15" strokeOpacity="0.45" strokeWidth="14" strokeLinecap="round" />
        <circle cx="238" cy="42" r="9" fill="#F43F5E" opacity="0.85" />
      </svg>
    ),
  },
  {
    step: '4 / 4',
    title: 'Sınav Moduyla Hatırla & 300 DPI Poster Paylaş',
    desc: 'Üstteki "Çalış" sekmesinden Sınav Modunu, Odaklanmayı veya Kronometreyi aç; haritanı çizimlerinle birlikte 300 DPI PDF poster olarak paylaş.',
    renderArt: () => (
      <svg viewBox="0 0 280 140" className="h-32 w-full">
        <rect width="280" height="140" rx="20" fill="#F4F2EA" />
        <rect x="42" y="22" width="196" height="96" rx="14" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
        <path d="M96 70 C122 70, 130 46, 158 46" stroke="#8B5CF6" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M96 70 C122 70, 130 94, 158 94" stroke="#10B981" strokeWidth="5" strokeLinecap="round" fill="none" />
        <rect x="54" y="56" width="48" height="28" rx="9" fill="#0F172A" />
        <rect x="154" y="32" width="68" height="28" rx="9" fill="#EDE9FE" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4 3" />
        <text x="188" y="50" textAnchor="middle" fontSize="11" fontWeight="800" fill="#6D28D9">
          ? Dokun Aç
        </text>
        <rect x="154" y="80" width="68" height="28" rx="9" fill="#ECFDF5" stroke="#10B981" strokeWidth="2" />
        <path d="M178 94 l5 5 l11 -11" stroke="#059669" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
];

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete }) => {
  const [idx, setIdx] = useState(0);

  // Persist after initial mount settles so even if user closes app without clicking Atla, it never re-opens on next launch
  useEffect(() => {
    const timer = window.setTimeout(() => {
      persistOnboardingCompleted();
    }, 800);
    return () => window.clearTimeout(timer);
  }, []);

  const finish = () => {
    persistOnboardingCompleted();
    void hapticSuccess();
    onComplete();
  };

  const cur = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      data-testid="onboarding-overlay"
    >
      <div
        className="relative w-full max-w-[420px] rounded-3xl border p-5 shadow-2xl sm:p-6"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-[11px] font-extrabold opacity-75">
            {cur.step}
          </span>
          <button
            type="button"
            onClick={finish}
            data-testid="onboarding-skip-btn"
            className="min-h-[44px] rounded-xl px-3 text-xs font-extrabold opacity-70 transition hover:bg-slate-500/10 hover:opacity-100"
          >
            Atla
          </button>
        </div>

        <div className="mt-2 overflow-hidden rounded-2xl">{cur.renderArt()}</div>

        <h2 className="mt-4 text-lg leading-snug font-extrabold tracking-tight sm:text-xl">
          {cur.title}
        </h2>
        <p
          className="mt-1.5 text-[13.5px] leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {cur.desc}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === idx ? 'w-6 bg-slate-900 dark:bg-amber-400' : 'w-2 bg-slate-400/40'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              void hapticLight();
              if (isLast) finish();
              else setIdx((n) => n + 1);
            }}
            data-testid="onboarding-next-btn"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm active:scale-95 dark:bg-amber-500 dark:text-slate-950"
          >
            {isLast ? (
              <>
                <Check className="h-4 w-4" />
                <span>Haritaya Başla</span>
              </>
            ) : (
              <>
                <span>Devam Et</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
