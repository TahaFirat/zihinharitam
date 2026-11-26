import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GROUPS = [
  {
    title: 'Web Platformu & Odak',
    items: [
      { keys: ['Ctrl', '.'], desc: 'Zen Odak Modu (tüm üst çubukları gizle/göster)' },
      { keys: ['Ctrl', 'S'], desc: 'Haritaları anında Bulut Kasasına eşitle' },
      { keys: ['Ctrl', 'Shift', 'L'], desc: 'Güvenli Paylaşım Bağlantısı penceresini aç' },
      { keys: ['?'], desc: 'Bu Klavye Kısayolları rehberini aç/kapat' },
    ],
  },
  {
    title: 'Hızlı Zihin Haritası Düzenleme',
    items: [
      { keys: ['Ctrl', 'K'], desc: 'Komut & 45.500+ İkon Arama Paleti' },
      { keys: ['Tab'], desc: 'Seçili dala yeni Alt Dal ekle' },
      { keys: ['Enter'], desc: 'Seçili dalın yanına Kardeş Dal ekle' },
      { keys: ['Delete'], desc: 'Seçili dalı veya bağlantıyı kaldır' },
      { keys: ['Ctrl', 'Z'], desc: 'Son işlemi geri al (Undo)' },
      { keys: ['Ctrl', 'Shift', 'Z'], desc: 'İleri al (Redo)' },
    ],
  },
  {
    title: 'Tuval & Navigasyon',
    items: [
      { keys: ['Space', 'Sürükle'], desc: 'Sonsuz tuvali serbestçe kaydır' },
      { keys: ['Ctrl', 'Tekerlek'], desc: 'İmleç odağına yumuşak yakınlaştır / uzaklaştır' },
      { keys: ['Esc'], desc: 'Seçimi veya açık pencereyi kapat' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Klavye Kısayolları</h2>
              <p className="text-[11px] font-semibold text-slate-500">
                Fareye dokunmadan ışık hızında haritalama
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

        <div className="max-h-[68dvh] space-y-5 overflow-y-auto p-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-[11px] font-extrabold tracking-wider text-slate-400 uppercase">
                {g.title}
              </h3>
              <div className="space-y-1.5">
                {g.items.map((item) => (
                  <div
                    key={item.desc}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/90 px-3 py-2"
                  >
                    <span className="text-xs font-semibold text-slate-700">{item.desc}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-extrabold text-slate-800 shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
