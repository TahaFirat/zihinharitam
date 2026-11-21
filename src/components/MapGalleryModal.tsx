import React, { useState } from 'react';
import { X, Plus, Trash2, FolderOpen, Sparkles, Wand2 } from 'lucide-react';
import {
  DEPARTMENT_LABELS,
  type AcademicDepartment,
  type MindMapDocument,
} from '../types/mindmap';
import { ACADEMIC_TEMPLATES } from '../data/academicTemplates';

interface MapGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedMaps: MindMapDocument[];
  activeMapId: string;
  onSelectMap: (doc: MindMapDocument) => void;
  onCreateBlankMap: (title: string, dept: AcademicDepartment) => void;
  onDeleteMap: (id: string) => void;
  onOpenSmartGenerator: () => void;
}

export const MapGalleryModal: React.FC<MapGalleryModalProps> = ({
  isOpen,
  onClose,
  savedMaps,
  activeMapId,
  onSelectMap,
  onCreateBlankMap,
  onDeleteMap,
  onOpenSmartGenerator,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState<AcademicDepartment>('genel');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || 'Yeni Görsel Zihin Haritası';
    onCreateBlankMap(title, newDept);
    setNewTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'max(22px, calc(var(--safe-bottom) + 14px))',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div>
            <h2 className="text-base font-extrabold sm:text-lg">
              Görsel Zihin Haritalarım & Amiral Gemi Şablonlar
            </h2>
            <p className="text-xs opacity-65">
              Sistem Tasarımı (`systemdesign.io`), Tıp, Elektronik, Hukuk ve Mimarlık şablonları
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSmartGenerator();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs active:scale-95"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Metinden Üret</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 sm:p-6">
          {/* Create New Blank Mind Map */}
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-2xl border p-3.5 sm:p-4"
            style={{
              backgroundColor: 'var(--hud-bg)',
              borderColor: 'var(--hud-border)',
            }}
          >
            <div className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              + Sıfırdan Yeni Harita Oluştur (Otonom Bağlam Algılamalı)
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Merkezi konuyu yazın (ör. Sistem Tasarımı, Mitral Kapak, Osmanlı Tımar...)"
                className="allow-text-input flex-1 rounded-xl border bg-transparent px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500"
                style={{ borderColor: 'var(--hud-border)' }}
              />
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value as AcademicDepartment)}
                className="rounded-xl border bg-transparent px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                style={{
                  borderColor: 'var(--hud-border)',
                  backgroundColor: 'var(--canvas-bg)',
                }}
              >
                {Object.entries(DEPARTMENT_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.emoji} {val.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-transform hover:bg-sky-600 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Oluştur
              </button>
            </div>
          </form>

          {/* Ready-Made Rich Academic & System Design Templates */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider opacity-70">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Hazır Mühendislik & Akademik Bölüm Şablonları (5 Amiral Gemi Harita)
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACADEMIC_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onSelectMap(tpl.build());
                    onClose();
                  }}
                  className="group flex flex-col items-start rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                  style={{
                    backgroundColor: 'var(--hud-bg)',
                    borderColor: 'var(--hud-border)',
                  }}
                >
                  <span
                    className="mb-2 inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: tpl.accentColor }}
                  >
                    {tpl.badge}
                  </span>
                  <div className="text-sm font-extrabold group-hover:text-sky-500">
                    {tpl.title}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed opacity-70">
                    {tpl.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Offline-First Saved Maps in IndexedDB */}
          {savedMaps.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider opacity-70">
                <FolderOpen className="h-3.5 w-3.5 text-emerald-500" />
                Cihazda Kayıtlı Haritalar ({savedMaps.length})
              </div>
              <div className="space-y-2">
                {savedMaps.map((m) => {
                  const isCurrent = m.id === activeMapId;
                  const deptInfo =
                    DEPARTMENT_LABELS[m.department] ?? DEPARTMENT_LABELS.genel;
                  const count = Object.keys(m.nodes).length;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 transition-colors ${
                        isCurrent ? 'ring-2 ring-sky-500' : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--hud-bg)',
                        borderColor: 'var(--hud-border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMap(m);
                          onClose();
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span>{deptInfo.emoji}</span>
                          <span className="truncate text-sm font-bold">{m.title}</span>
                          {isCurrent && (
                            <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-300">
                              Açık
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] opacity-60">
                          {count} dal • {(m.crossLinks ?? []).length} çapraz ilişki • Son:{' '}
                          {new Date(m.updatedAt).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </button>

                      {savedMaps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteMap(m.id)}
                          title="Haritayı Sil"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
