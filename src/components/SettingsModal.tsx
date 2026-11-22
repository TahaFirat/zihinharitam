import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Crown,
  Download,
  ExternalLink,
  FileCheck2,
  Gift,
  History,
  Layers,
  Mail,
  Moon,
  RefreshCw,
  Shield,
  Smartphone,
  Sun,
  Upload,
  Vibrate,
  X,
} from 'lucide-react';
import { APP_RELEASE_CONFIG } from '../config/appReleaseConfig';
import { BillingService } from '../core/monetization/BillingService';
import {
  EntitlementManager,
  useEntitlements,
} from '../core/monetization/EntitlementManager';
import {
  getHapticsEnabled,
  hapticLight,
  hapticSuccess,
  setHapticsEnabled,
  shareOrDownloadFile,
} from '../core/native/NativeBridge';
import { LocalStore, type MapRecoverySnapshot } from '../core/sync/LocalStore';
import type {
  MindMapDocument,
  NodeVisualStyle,
  PaywallTriggerReason,
} from '../types/mindmap';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themePref: ThemePreference;
  onChangeThemePref: (pref: ThemePreference) => void;
  defaultNodeStyle: NodeVisualStyle;
  onChangeDefaultNodeStyle: (style: NodeVisualStyle) => void;
  activeMap: MindMapDocument;
  onRestoreMapSnapshot: (doc: MindMapDocument) => void;
  onImportBackupMaps: (docs: MindMapDocument[]) => Promise<void>;
  onTriggerPaywall: (reason: PaywallTriggerReason) => void;
  initialLegalDoc?: 'privacy' | 'terms' | 'support' | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  themePref,
  onChangeThemePref,
  defaultNodeStyle,
  onChangeDefaultNodeStyle,
  activeMap,
  onRestoreMapSnapshot,
  onImportBackupMaps,
  onTriggerPaywall,
  initialLegalDoc = null,
}) => {
  const { isLifetimePro, localizedPrice, isBusy } = useEntitlements();
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => getHapticsEnabled());
  const [snapshots, setSnapshots] = useState<MapRecoverySnapshot[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showPromoBox, setShowPromoBox] = useState(false);
  const [promoDraft, setPromoDraft] = useState('');
  const isNativeIos = BillingService.isNativeIos();
  const [activeLegalView, setActiveLegalView] = useState<
    'privacy' | 'terms' | 'support' | null
  >(initialLegalDoc);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveLegalView(initialLegalDoc);
  }, [initialLegalDoc, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage(null);
    void LocalStore.getRecoverySnapshots(activeMap.id).then(setSnapshots);
  }, [isOpen, activeMap.id]);

  if (!isOpen) return null;

  const handleRestorePurchases = async () => {
    setStatusMessage(null);
    void hapticLight();
    const res = await EntitlementManager.restorePurchases();
    if (res.isLifetimePro) {
      void hapticSuccess();
      setStatusMessage('Ömür Boyu Pro lisansınız başarıyla geri yüklendi.');
    } else {
      setStatusMessage(
        res.errorMessage ||
          'Bu Apple hesabına tanımlı önceki bir Ömür Boyu Pro satın alımı bulunamadı.'
      );
    }
  };

  const handleExportFullBackup = async () => {
    const bundle = await LocalStore.exportWorkspaceBackupBundle();
    const dateSlug = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    await shareOrDownloadFile(
      blob,
      `zihinharitam-tam-yedek-${dateSlug}.zihin`,
      'application/json',
      'ZihinHaritam Tam Yedek'
    );
    void hapticSuccess();
    setStatusMessage(`${bundle.maps.length} aktif harita .zihin paketi olarak yedeklendi.`);
  };

  const handleImportFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const docs = LocalStore.parseZihinImportPayload(String(reader.result));
        if (docs.length > 0) {
          await onImportBackupMaps(docs);
          void hapticSuccess();
          setStatusMessage(`${docs.length} harita başarıyla içe aktarıldı.`);
        } else {
          setStatusMessage('Seçilen dosyada geçerli bir harita verisi bulunamadı.');
        }
      } catch {
        setStatusMessage('Yedek dosyası okunamadı. Lütfen geçerli bir .zihin dosyası seçin.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const legalIframeSrc =
    activeLegalView === 'privacy'
      ? APP_RELEASE_CONFIG.legal.privacyPath
      : activeLegalView === 'terms'
      ? APP_RELEASE_CONFIG.legal.termsPath
      : activeLegalView === 'support'
      ? APP_RELEASE_CONFIG.legal.supportPath
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="settings-modal"
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          color: 'var(--text-primary)',
          paddingBottom: 'max(22px, calc(var(--safe-bottom) + 14px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div>
            <h2 className="text-base font-extrabold">
              {activeLegalView === 'privacy'
                ? 'Gizlilik Politikası'
                : activeLegalView === 'terms'
                ? 'Kullanım Koşulları (EULA)'
                : activeLegalView === 'support'
                ? 'İletişim & Destek Merkezi'
                : 'Ayarlar, Yedekleme & Lisans'}
            </h2>
            <p className="text-xs opacity-65">
              {APP_RELEASE_CONFIG.appName} v{APP_RELEASE_CONFIG.version} • %100 Çevrimdışı Öncelikli Mimari
            </p>
          </div>

          <div className="flex items-center gap-1">
            {activeLegalView && (
              <button
                type="button"
                onClick={() => setActiveLegalView(null)}
                className="min-h-[40px] rounded-xl px-3 text-xs font-extrabold text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
              >
                ← Ayarlara Dön
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-500/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Embedded In-App Legal Page Reader */}
        {legalIframeSrc ? (
          <div className="flex h-[70dvh] flex-col">
            <iframe
              src={legalIframeSrc}
              title="Yasal Belge"
              className="h-full w-full flex-1 border-0 bg-white"
            />
            <div
              className="flex items-center justify-between border-t px-5 py-2.5 text-xs"
              style={{ borderColor: 'var(--hud-border)' }}
            >
              <span className="opacity-70">
                Sorularınız için: {APP_RELEASE_CONFIG.legal.supportEmail}
              </span>
              <a
                href={legalIframeSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-sky-600 hover:underline dark:text-sky-400"
              >
                <span>Tarayıcıda Aç</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto p-5">
            {/* 1. Pro Entitlement & Mandatory Restore Purchases */}
            <div
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold">
                      {isLifetimePro
                        ? 'ZihinHaritam Pro Lisansı Aktif'
                        : 'Ücretsiz Başlangıç Planı (2 Harita)'}
                    </div>
                    <div className="text-xs opacity-70">
                      {isLifetimePro
                        ? 'Sınırsız harita, 30.000+ renkli 3D ikon ve 300 DPI PDF açık.'
                        : `Aylık ${localizedPrice}, %50 avantajlı Yıllık veya Ömür Boyu Pro ile sınırları kaldırın.`}
                    </div>
                  </div>
                </div>

                {!isLifetimePro ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onTriggerPaywall('settings_upgrade');
                    }}
                    className="min-h-[42px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white shadow-xs active:scale-95 dark:bg-amber-500 dark:text-slate-950"
                  >
                    Pro’ya Geç • {localizedPrice}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Ömür Boyu Açık
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-500/10 pt-3">
                <span className="text-[11.5px] opacity-70">
                  Daha önce satın aldıysanız Apple kimliğinizle ücretsiz geri yükleyin:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {!isLifetimePro && (
                    <button
                      type="button"
                      disabled={isBusy}
                      data-testid="settings-redeem-code-btn"
                      onClick={async () => {
                        setStatusMessage(null);
                        void hapticLight();
                        if (isNativeIos) {
                          const res = await EntitlementManager.presentIosOfferCodeSheet();
                          if (res.isLifetimePro) {
                            void hapticSuccess();
                            setStatusMessage('Hediye / teklif kodunuz onaylandı! ZihinHaritam Pro açıldı.');
                          } else if (res.errorMessage) {
                            setStatusMessage(res.errorMessage);
                          }
                          return;
                        }
                        setShowPromoBox((v) => !v);
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                    >
                      <Gift className="h-3.5 w-3.5" />
                      <span>Hediye Kodu</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleRestorePurchases()}
                    data-testid="settings-restore-purchases-btn"
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
                    style={{ borderColor: 'var(--hud-border)' }}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                    <span>Satın Alımları Geri Yükle</span>
                  </button>
                </div>
              </div>

              {!isNativeIos && showPromoBox && !isLifetimePro && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setStatusMessage(null);
                    const res = await EntitlementManager.redeemFriendPromoCode(promoDraft);
                    if (res.redeemed) {
                      void hapticSuccess();
                      setPromoDraft('');
                      setShowPromoBox(false);
                      setStatusMessage(`Hediye kodu (#${res.slotNumber}/30) onaylandı! ZihinHaritam Pro açıldı.`);
                    } else {
                      setStatusMessage(res.errorMessage || 'Hediye kodu geçersiz.');
                    }
                  }}
                  className="mt-2.5 flex items-center gap-1.5 rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-2"
                  data-testid="settings-promo-form"
                >
                  <input
                    type="text"
                    value={promoDraft}
                    onChange={(e) => setPromoDraft(e.target.value.toUpperCase())}
                    placeholder="Hediye kodu (örn. ZHPRO-01-XXXXXX)"
                    data-testid="settings-promo-input"
                    className="allow-text-input min-w-0 flex-1 rounded-xl border bg-white/90 px-2.5 py-1.5 font-mono text-xs font-extrabold uppercase outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-900/90"
                    style={{ borderColor: 'var(--hud-border)' }}
                  />
                  <button
                    type="submit"
                    disabled={isBusy || promoDraft.trim().length < 6}
                    data-testid="settings-promo-submit-btn"
                    className="min-h-[36px] shrink-0 rounded-xl bg-emerald-600 px-3 text-xs font-extrabold text-white shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    Onayla
                  </button>
                </form>
              )}
            </div>

            {statusMessage && (
              <div
                className="rounded-xl bg-sky-500/15 px-3.5 py-2.5 text-xs font-bold text-sky-700 dark:text-sky-300"
                data-testid="settings-status-banner"
              >
                {statusMessage}
              </div>
            )}

            {/* 2. Theme, Node Style & Haptics */}
            <div
              className="space-y-3.5 rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <div>
                <div className="mb-2 text-xs font-extrabold">Çalışma Teması</div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'light', label: 'Açık Defter', icon: Sun },
                      { id: 'dark', label: 'Koyu Çalışma', icon: Moon },
                      { id: 'system', label: 'Sistem', icon: Smartphone },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = themePref === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          void hapticLight();
                          onChangeThemePref(opt.id);
                        }}
                        className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold ${
                          active
                            ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            : 'hover:bg-slate-500/5'
                        }`}
                        style={{ borderColor: active ? undefined : 'var(--hud-border)' }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-extrabold">Varsayılan Düğüm Stili</div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'card', label: 'Modern Kart' },
                      { id: 'organic', label: 'Organik Çıkartma' },
                    ] as const
                  ).map((st) => {
                    const active = defaultNodeStyle === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          void hapticLight();
                          onChangeDefaultNodeStyle(st.id);
                        }}
                        className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${
                          active
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'hover:bg-slate-500/5'
                        }`}
                        style={{ borderColor: active ? undefined : 'var(--hud-border)' }}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Vibrate className="h-4 w-4 opacity-70" />
                  <span>Haptik Dokunma Titreşimi</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hapticsOn}
                  onClick={() => {
                    const next = !hapticsOn;
                    setHapticsEnabled(next);
                    setHapticsOn(next);
                    if (next) void hapticLight();
                  }}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    hapticsOn ? 'bg-emerald-500' : 'bg-slate-400/40'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-xs transition-transform ${
                      hapticsOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 3. Full .zihin Backup & 5-Point Crash Recovery */}
            <div
              className="space-y-3 rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <div>
                <div className="text-xs font-extrabold">
                  Cihazlar Arası Tam Veri Yedekleme (.zihin)
                </div>
                <p className="mt-0.5 text-[11.5px] opacity-70">
                  Tüm haritalarınız cihazınızda çevrimdışı saklanır. Telefon/iPad değiştirirken tek dosyayla dışa veya içe aktarın.
                </p>
              </div>

              <input
                ref={backupInputRef}
                type="file"
                accept=".zihin,.json,application/json"
                onChange={handleImportFullBackup}
                className="hidden"
              />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleExportFullBackup()}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold hover:bg-slate-500/5"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <Download className="h-4 w-4 text-sky-500" />
                  <span>Tüm Verileri Yedekle (.zihin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => backupInputRef.current?.click()}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold hover:bg-slate-500/5"
                  style={{ borderColor: 'var(--hud-border)' }}
                >
                  <Upload className="h-4 w-4 text-emerald-500" />
                  <span>.zihin Yedeği İçe Aktar</span>
                </button>
              </div>

              {snapshots.length > 0 && (
                <div className="border-t border-slate-500/10 pt-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold opacity-75">
                    <History className="h-3.5 w-3.5" />
                    <span>Son Otomatik Kurtarma Noktaları ({snapshots.length}/5)</span>
                  </div>
                  <div className="space-y-1">
                    {snapshots.slice(0, 3).map((snap) => (
                      <div
                        key={snap.id}
                        className="flex items-center justify-between rounded-xl bg-slate-500/5 px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="truncate font-semibold">
                          {snap.title} ({snap.nodeCount} dal) •{' '}
                          {new Date(snap.savedAt).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const restored = JSON.parse(
                                snap.serializedDoc
                              ) as MindMapDocument;
                              onRestoreMapSnapshot(restored);
                              setStatusMessage('Kurtarma noktası başarıyla yüklendi.');
                            } catch {
                              // Ignore
                            }
                          }}
                          className="ml-2 shrink-0 font-extrabold text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Yükle
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Legal & Support Links */}
            <div
              className="grid grid-cols-1 gap-2 rounded-2xl border p-3 sm:grid-cols-3"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveLegalView('privacy')}
                data-testid="settings-privacy-link"
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold hover:bg-slate-500/10"
              >
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                <span>Gizlilik Politikası</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveLegalView('terms')}
                data-testid="settings-terms-link"
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold hover:bg-slate-500/10"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-sky-500" />
                <span>Kullanım Koşulları</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveLegalView('support')}
                data-testid="settings-support-link"
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold hover:bg-slate-500/10"
              >
                <Mail className="h-3.5 w-3.5 text-amber-500" />
                <span>İletişim & Destek</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
