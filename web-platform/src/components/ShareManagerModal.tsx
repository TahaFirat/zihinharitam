import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Loader2,
  Lock,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type { MindMapDocument } from '@app/types/mindmap';
import {
  ApiClientError,
  WebApi,
  type SharedLinkItem,
  type WebUser,
} from '../api/webApiClient';

interface ShareManagerModalProps {
  isOpen: boolean;
  user: WebUser | null;
  localMaps: MindMapDocument[];
  onClose: () => void;
  onRequireAuth: () => void;
}

export const ShareManagerModal: React.FC<ShareManagerModalProps> = ({
  isOpen,
  user,
  localMaps,
  onClose,
  onRequireAuth,
}) => {
  const [selectedMapId, setSelectedMapId] = useState('');
  const [expiry, setExpiry] = useState<'24h' | '7d' | '30d' | 'never'>('7d');
  const [password, setPassword] = useState('');
  const [shares, setShares] = useState<SharedLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const activeMaps = localMaps.filter((m) => !m.deletedAt);
    if (activeMaps.length > 0 && !selectedMapId) {
      setSelectedMapId(activeMaps[0].id);
    }
    if (user) {
      setLoading(true);
      WebApi.listShares()
        .then((res) => setShares(res.shares))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, user, localMaps, selectedMapId]);

  if (!isOpen) return null;

  const activeMaps = localMaps.filter((m) => !m.deletedAt);

  function buildShareUrl(slug: string): string {
    return `${window.location.origin}/s/${slug}`;
  }

  async function handleCopy(slug: string) {
    try {
      await navigator.clipboard.writeText(buildShareUrl(slug));
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  async function handleCreateShare(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const doc = activeMaps.find((m) => m.id === selectedMapId) || activeMaps[0];
    if (!doc) {
      setError('Paylaşılacak harita bulunamadı.');
      return;
    }
    setCreating(true);
    try {
      const res = await WebApi.createShare(doc, expiry, password.trim() || undefined);
      setShares((prev) => [res.share, ...prev]);
      setPassword('');
      await handleCopy(res.share.slug);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Bağlantı oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(slug: string) {
    try {
      await WebApi.revokeShare(slug);
      setShares((prev) => prev.filter((s) => s.slug !== slug));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Bağlantı iptal edilemedi.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Güvenli Web Paylaşım Bağlantısı</h2>
              <p className="text-[11px] font-semibold text-slate-500">
                Salt-okunur canlı görünüm · isteğe bağlı şifre ve süre sınırı
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!user ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 text-center">
              <Lock className="mx-auto h-8 w-8 text-indigo-600" />
              <h3 className="mt-3 text-sm font-extrabold text-slate-900">
                Paylaşım Linki İçin Ücretsiz Hesap Oluşturun
              </h3>
              <p className="mt-1.5 text-xs font-medium text-slate-600">
                Haritalarınızı şifreli veya süreli web bağlantısıyla paylaşmak, görüntülenme
                sayısını görmek ve istediğiniz anda iptal etmek için oturum açın.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequireAuth();
                }}
                className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-700"
              >
                Giriş Yap / Hesap Oluştur
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateShare} className="space-y-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Paylaşılacak Harita
                  </label>
                  <select
                    value={selectedMapId}
                    onChange={(e) => setSelectedMapId(e.target.value)}
                    className="allow-text-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                  >
                    {activeMaps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({Object.keys(m.nodes || {}).length} dal)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Geçerlilik Süresi
                    </label>
                    <select
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value as '24h' | '7d' | '30d' | 'never')}
                      className="allow-text-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
                    >
                      <option value="24h">24 Saat</option>
                      <option value="7d">7 Gün (Önerilen)</option>
                      <option value="30d">30 Gün</option>
                      <option value="never">Süresiz</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      İsteğe Bağlı Şifre (min 6 krk)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Boş bırakılırsa herkese açık"
                      className="allow-text-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating || activeMaps.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-600 disabled:opacity-60"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      <span>Güvenli Link Oluştur &amp; Kopyala</span>
                    </>
                  )}
                </button>
              </form>

              <div>
                <h3 className="mb-2.5 text-xs font-extrabold text-slate-700">
                  Aktif Paylaşım Linkleriniz ({shares.length})
                </h3>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  </div>
                ) : shares.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-xs font-semibold text-slate-400">
                    Henüz aktif paylaşım bağlantısı oluşturmadınız.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shares.map((s) => (
                      <div
                        key={s.slug}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate text-xs font-extrabold text-slate-900">
                            {s.hasPassword && <Lock className="h-3 w-3 shrink-0 text-amber-600" />}
                            <span className="truncate">{s.title}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {s.viewCount} görüntülenme
                            </span>
                            <span>·</span>
                            <span>
                              {s.expiresAt
                                ? `Bitiş: ${new Date(s.expiresAt).toLocaleDateString('tr-TR')}`
                                : 'Süresiz'}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleCopy(s.slug)}
                            title="Bağlantıyı Kopyala"
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            {copiedSlug === s.slug ? (
                              <>
                                <Check className="h-3 w-3" /> Kopyalandı
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Kopyala
                              </>
                            )}
                          </button>
                          <a
                            href={buildShareUrl(s.slug)}
                            target="_blank"
                            rel="noreferrer"
                            title="Yeni sekmede aç"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(s.slug)}
                            title="Bağlantıyı İptal Et"
                            className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
