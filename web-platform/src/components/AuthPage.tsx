import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import { ApiClientError, WebApi, type WebUser } from '../api/webApiClient';

interface AuthPageProps {
  initialMode: 'login' | 'register';
  onAuthSuccess: (user: WebUser) => void;
  onNavigate: (path: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode,
  onAuthSuccess,
  onNavigate,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwChecks = useMemo(
    () => [
      { label: 'En az 10 karakter', ok: password.length >= 10 },
      { label: 'Büyük harf (A-Z)', ok: /[A-ZÇĞİÖŞÜ]/.test(password) },
      { label: 'Küçük harf (a-z)', ok: /[a-zçğıöşü]/.test(password) },
      { label: 'Rakam (0-9)', ok: /\d/.test(password) },
      { label: 'Özel karakter (!@#$)', ok: /[^A-Za-z0-9ÇĞİÖŞÜçğıöşü\s]/.test(password) },
    ],
    [password]
  );

  const pwScore = pwChecks.filter((c) => c.ok).length;
  const allPwOk = pwScore === pwChecks.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && !allPwOk) {
      setError('Lütfen tüm şifre kurallarını karşılayan güçlü bir şifre belirleyin.');
      return;
    }

    setSubmitting(true);
    try {
      const res =
        mode === 'register'
          ? await WebApi.register(displayName.trim(), email.trim(), password)
          : await WebApi.login(email.trim(), password);
      if (res.user) {
        onAuthSuccess(res.user);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAF9F5] px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Ana Sayfaya Dön</span>
        </button>

        <div className="mt-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-8">
          <div className="flex items-center gap-3">
            <img
              src="/app-icon.png"
              alt="ZihinHaritam"
              className="h-11 w-11 shrink-0 rounded-2xl shadow-sm ring-1 ring-slate-900/10"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                {mode === 'register' ? 'Ücretsiz Hesap Oluştur' : 'ZihinHaritam’a Giriş Yap'}
              </h1>
              <p className="text-xs font-semibold text-slate-500">
                Haritalarını bulutta yedekle ve tüm cihazlarından eriş
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`min-h-[38px] rounded-xl py-2 text-xs font-extrabold transition ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Hesap Oluştur
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`min-h-[38px] rounded-xl py-2 text-xs font-extrabold transition ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Giriş Yap
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Ad Soyad
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={64}
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Örn: Taha Fırat"
                    className="allow-text-input w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-3.5 pl-10 text-base font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 sm:text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                E-posta Adresi
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@eposta.com"
                  className="allow-text-input w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-3.5 pl-10 text-base font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Şifre</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 10 : 1}
                  maxLength={128}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'En az 10 karakter güçlü şifre' : '••••••••••'}
                  className="allow-text-input w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-11 pl-10 text-base font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute top-1/2 right-2.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {mode === 'register' && (
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/90 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-600">Şifre Gücü</span>
                    <span
                      className={
                        pwScore >= 5
                          ? 'text-emerald-600'
                          : pwScore >= 3
                            ? 'text-amber-600'
                            : 'text-slate-400'
                      }
                    >
                      {pwScore}/5
                    </span>
                  </div>
                  <div className="mb-2.5 grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-colors ${
                          pwScore >= idx
                            ? pwScore === 5
                              ? 'bg-emerald-500'
                              : pwScore >= 3
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {pwChecks.map((c) => (
                      <div
                        key={c.label}
                        className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                          c.ok ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        <Check className={`h-3 w-3 shrink-0 ${c.ok ? 'opacity-100' : 'opacity-30'}`} />
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white shadow-md shadow-slate-900/10 transition hover:bg-indigo-600 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'register' ? 'Hesabı Oluştur & Başla' : 'Giriş Yap'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50/70 px-3 py-2 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>Verileriniz gizli tutulur ve yalnızca size özeldir.</span>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 text-center">
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="min-h-[36px] text-xs font-bold text-slate-500 transition hover:text-indigo-600"
            >
              Hesap açmadan misafir olarak dene →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
