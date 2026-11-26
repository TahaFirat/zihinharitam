import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Crown,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Receipt,
  RefreshCw,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { ProPlanTier } from '@app/config/appReleaseConfig';
import {
  ApiClientError,
  WebApi,
  type ActiveSessionItem,
  type BillingStatusResponse,
  type SecurityAuditLogItem,
  type WebUser,
} from '../api/webApiClient';

interface AccountSecurityModalProps {
  isOpen: boolean;
  user: WebUser;
  billing: BillingStatusResponse | null;
  cloudMapCount: number;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  onClose: () => void;
  onUserUpdated: (user: WebUser) => void;
  onBillingUpdated: (billing: BillingStatusResponse) => void;
  onOpenCheckout: (tier: ProPlanTier) => void;
  onSyncNow: () => Promise<void>;
  onLoggedOut: () => void;
}

type TabKey = 'profile' | 'billing' | 'password' | 'sessions' | 'audit';

const EVENT_LABELS: Record<string, string> = {
  REGISTER: 'Hesap Oluşturuldu',
  LOGIN_SUCCESS: 'Giriş Yapıldı',
  LOGIN_FAILED: 'Hatalı Şifre Denemesi',
  ACCOUNT_LOCKED: 'Geçici Hesap Kilidi',
  LOGIN_BLOCKED_LOCKOUT: 'Kilitli Giriş Engellendi',
  LOGOUT: 'Oturum Kapatıldı',
  PROFILE_UPDATED: 'Profil Güncellendi',
  PASSWORD_CHANGED: 'Şifre Değiştirildi',
  PASSWORD_CHANGE_FAILED: 'Şifre Doğrulanamadı',
  SESSION_REVOKED: 'Oturum Sonlandırıldı',
  SESSIONS_REVOKED_OTHERS: 'Diğer Cihazlar Kapatıldı',
  SHARE_CREATED: 'Paylaşım Linki Oluşturuldu',
  SHARE_REVOKED: 'Paylaşım Linki İptal Edildi',
  CLOUD_MAP_DELETED: 'Bulut Haritası Silindi',
  BILLING_PURCHASE: 'Pro Üyelik Etkinleştirildi',
  BILLING_CANCELED: 'Abonelik İptal Planlandı',
  PROMO_REDEEMED: 'Hediye Kodu Kullanıldı',
};

const TIER_NAMES: Record<string, string> = {
  free: 'Ücretsiz Plan',
  monthly: 'Aylık Pro',
  yearly: 'Yıllık Pro',
  lifetime: 'Ömür Boyu Pro',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  user,
  billing,
  cloudMapCount,
  lastSyncedAt,
  isSyncing,
  onClose,
  onUserUpdated,
  onBillingUpdated,
  onOpenCheckout,
  onSyncNow,
  onLoggedOut,
}) => {
  const [tab, setTab] = useState<TabKey>('profile');
  const [displayName, setDisplayName] = useState(user.displayName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [logs, setLogs] = useState<SecurityAuditLogItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setDisplayName(user.displayName);
  }, [user.displayName]);

  useEffect(() => {
    if (!isOpen) return;
    setNotice(null);
    if (tab === 'sessions') {
      setLoadingList(true);
      WebApi.listSessions()
        .then((res) => setSessions(res.sessions))
        .catch(() => {})
        .finally(() => setLoadingList(false));
    } else if (tab === 'audit') {
      setLoadingList(true);
      WebApi.listAuditLogs()
        .then((res) => setLogs(res.logs))
        .catch(() => {})
        .finally(() => setLoadingList(false));
    } else if (tab === 'billing') {
      WebApi.getBillingStatus()
        .then((res) => onBillingUpdated(res))
        .catch(() => {});
    }
  }, [isOpen, tab, onBillingUpdated]);

  if (!isOpen) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await WebApi.updateProfile(displayName.trim());
      onUserUpdated(res.user);
      setNotice({ type: 'ok', text: 'Profil adı güncellendi.' });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Güncellenemedi.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await WebApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNotice({
        type: 'ok',
        text: 'Şifreniz güncellendi ve diğer cihazlardaki oturumlar kapatıldı.',
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Şifre değiştirilemedi.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSubscription() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await WebApi.cancelSubscription();
      onBillingUpdated(res.billing);
      setNotice({
        type: 'ok',
        text: 'Aboneliğiniz dönem sonunda yenilenmeyecek şekilde iptal edildi.',
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'İptal işlemi tamamlanamadı.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setBusy(true);
    setNotice(null);
    try {
      await WebApi.revokeSession(sessionId);
      const res = await WebApi.listSessions();
      setSessions(res.sessions);
      setNotice({ type: 'ok', text: 'Seçilen oturum sonlandırıldı.' });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Oturum kapatılamadı.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeOthers() {
    setBusy(true);
    setNotice(null);
    try {
      await WebApi.revokeOtherSessions();
      const res = await WebApi.listSessions();
      setSessions(res.sessions);
      setNotice({ type: 'ok', text: 'Diğer tüm cihazlardaki oturumlar sonlandırıldı.' });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'İşlem başarısız.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await WebApi.deleteAccount(deletePassword);
      onLoggedOut();
      onClose();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Hesap silinemedi.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-black text-white">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-900 sm:text-base">
                Hesap Ayarları
              </h2>
              <p className="truncate text-xs font-semibold text-slate-500">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Horizontally scrollable mobile-friendly tabs */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/70 px-4 py-2">
          {[
            { id: 'profile' as TabKey, label: 'Profil & Bulut', icon: User },
            { id: 'billing' as TabKey, label: 'Abonelik', icon: Crown },
            { id: 'password' as TabKey, label: 'Şifre', icon: KeyRound },
            { id: 'sessions' as TabKey, label: 'Cihazlar', icon: Monitor },
            { id: 'audit' as TabKey, label: 'Etkinlik', icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setNotice(null);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {notice && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-bold ${
                notice.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {notice.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
          )}

          {tab === 'profile' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      Bulut Yedekleme · {cloudMapCount} Harita
                    </div>
                    <div className="text-xs font-semibold text-slate-600">
                      {lastSyncedAt
                        ? `Son eşitleme: ${formatTime(lastSyncedAt)}`
                        : 'Henüz eşitlenmedi'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => void onSyncNow()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Şimdi Eşitle</span>
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-700">Görünen Ad</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={64}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="allow-text-input flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base font-medium outline-none focus:border-indigo-500 focus:bg-white sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[42px] rounded-xl bg-slate-900 px-5 py-2 text-xs font-extrabold text-white hover:bg-indigo-600 disabled:opacity-60"
                  >
                    Kaydet
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={async () => {
                    await WebApi.logout();
                    onLoggedOut();
                    onClose();
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Çıkış Yap</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm((v) => !v)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hesabı Kalıcı Sil</span>
                </button>
              </div>

              {showDeleteConfirm && (
                <form
                  onSubmit={handleDeleteAccount}
                  className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4"
                >
                  <div className="text-xs font-bold text-rose-800">
                    Dikkat: Bu işlem hesabınızı ve buluttaki haritalarınızı kalıcı olarak siler.
                    Onaylamak için şifrenizi girin:
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Mevcut şifreniz"
                      className="allow-text-input flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-base font-semibold outline-none sm:text-xs"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[40px] rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700"
                    >
                      Kalıcı Sil
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'billing' && (
            <div className="space-y-5">
              <div
                className={`rounded-2xl border p-4 ${
                  billing?.isPro
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-slate-200 bg-slate-50/80'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                      <Crown
                        className={`h-4 w-4 ${billing?.isPro ? 'text-amber-500' : 'text-slate-400'}`}
                      />
                      <span>{TIER_NAMES[billing?.planTier || 'free'] || 'Ücretsiz Plan'}</span>
                      {billing?.isPro && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                          {billing.status === 'trialing' ? '7 Gün Deneme' : 'Aktif'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {billing?.isPro
                        ? billing.planTier === 'lifetime'
                          ? 'Ömür boyu tüm Pro özellikler açık.'
                          : billing.cancelAtPeriodEnd
                            ? `İptal edildi · ${billing.currentPeriodEnd ? formatTime(billing.currentPeriodEnd) : ''} tarihine kadar açık.`
                            : `Sonraki yenileme: ${billing.currentPeriodEnd ? formatTime(billing.currentPeriodEnd) : '-'}`
                        : 'Sınırsız harita, 45.500+ Pro ikon ve PDF/SVG dışa aktarım için Pro’ya geçin.'}
                    </p>
                  </div>

                  {!billing?.isPro ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCheckout('yearly');
                      }}
                      className="min-h-[40px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-600"
                    >
                      Pro’ya Geç
                    </button>
                  ) : billing.planTier !== 'lifetime' && !billing.cancelAtPeriodEnd ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancelSubscription()}
                      className="min-h-[38px] rounded-xl border border-rose-200 bg-white px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Aboneliği İptal Et
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                  <Receipt className="h-3.5 w-3.5 text-slate-400" />
                  <span>Ödeme Geçmişi &amp; Makbuzlar</span>
                </h3>
                {!billing?.orders || billing.orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-xs font-semibold text-slate-400">
                    Henüz ödeme kaydı bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {billing.orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-slate-900">
                            {TIER_NAMES[ord.plan_tier] || ord.plan_tier} ·{' '}
                            <span className="font-mono text-indigo-600">{ord.receipt_no}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            {ord.card_brand} •••• {ord.card_last4} · {formatTime(ord.created_at)}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-black text-slate-900">
                          {ord.amount_try === 0
                            ? '0,00 ₺'
                            : `${ord.amount_try.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-3.5 text-xs font-semibold text-slate-600">
                Şifrenizi güncellediğinizde diğer tüm cihazlardaki oturumlarınız otomatik olarak
                kapatılır.
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Mevcut Şifre</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="allow-text-input w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base outline-none focus:border-indigo-500 focus:bg-white sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Yeni Güçlü Şifre (en az 10 karakter, büyük/küçük harf, rakam ve sembol)
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="allow-text-input w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base outline-none focus:border-indigo-500 focus:bg-white sm:text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                <Shield className="h-4 w-4" />
                <span>Şifreyi Güncelle</span>
              </button>
            </form>
          )}

          {tab === 'sessions' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600">
                  Aktif Oturumlar ({sessions.length})
                </span>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRevokeOthers}
                    className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Diğer Cihazları Kapat
                  </button>
                )}
              </div>

              {loadingList ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.sessionId}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-900">
                        <span className="truncate">{s.device}</span>
                        {s.isCurrent && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            Bu Cihaz
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                        Son etkinlik: {formatTime(s.lastSeenAt)}
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRevokeSession(s.sessionId)}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Kapat
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-600">Son Hesap Etkinlikleriniz</div>
              {loadingList ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </div>
              ) : logs.length === 0 ? (
                <div className="py-8 text-center text-xs font-semibold text-slate-400">
                  Henüz etkinlik kaydı yok.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900">
                        {EVENT_LABELS[log.event_type] || log.event_type}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-600">
                        {log.detail}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-slate-400">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
