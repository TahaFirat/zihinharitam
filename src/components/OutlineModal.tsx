import React, { useMemo, useState } from 'react';
import {
  X,
  ListTree,
  Plus,
  Check,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Navigation,
  Search,
} from 'lucide-react';
import type { MindNode, NodePriorityTag } from '../types/mindmap';
import { computeTreeMeta } from '../core/canvas/RadialAutoLayout';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { useKeyboardInset } from '../core/native/useKeyboardInset';

interface OutlineModalProps {
  isOpen: boolean;
  nodes: Record<string, MindNode>;
  rootNodeId: string;
  onClose: () => void;
  onUpdateNodeTitle: (nodeId: string, title: string) => void;
  onUpdateNodeNote: (nodeId: string, note: string) => void;
  onToggleNodeCheck: (nodeId: string) => void;
  onAddChildBranch: (parentId: string) => void;
  onOpenStickerPickerForNode: (nodeId: string) => void;
  onJumpToNode: (node: MindNode) => void;
}

const PRIORITY_BADGES: Record<NodePriorityTag, { emoji: string; label: string }> = {
  important: { emoji: '🔥', label: 'Önemli' },
  exam: { emoji: '🎓', label: 'Sınav' },
  review: { emoji: '❓', label: 'Tekrar' },
};

export const OutlineModal: React.FC<OutlineModalProps> = ({
  isOpen,
  nodes,
  rootNodeId,
  onClose,
  onUpdateNodeTitle,
  onUpdateNodeNote,
  onToggleNodeCheck,
  onAddChildBranch,
  onOpenStickerPickerForNode,
  onJumpToNode,
}) => {
  const kb = useKeyboardInset();
  const [filterText, setFilterText] = useState('');
  const [onlyTasks, setOnlyTasks] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());

  const flatRows = useMemo(() => {
    const meta = computeTreeMeta(nodes, rootNodeId);
    const ordered: Array<{ node: MindNode; depth: number }> = [];

    const walk = (id: string, depth: number) => {
      const n = nodes[id];
      if (!n) return;
      ordered.push({ node: n, depth });
      const kids = meta.childrenMap.get(id) ?? [];
      for (const kidId of kids) {
        walk(kidId, depth + 1);
      }
    };

    if (nodes[rootNodeId]) {
      walk(rootNodeId, 0);
    }
    return ordered;
  }, [nodes, rootNodeId]);

  const taskStats = useMemo(() => {
    const withCheck = Object.values(nodes).filter(
      (n) => typeof n.checked === 'boolean'
    );
    const done = withCheck.filter((n) => n.checked === true).length;
    return { done, total: withCheck.length };
  }, [nodes]);

  const visibleRows = useMemo(() => {
    const q = filterText.trim().toLocaleLowerCase('tr-TR');
    return flatRows.filter(({ node }) => {
      if (onlyTasks && typeof node.checked !== 'boolean' && node.id !== rootNodeId) {
        return false;
      }
      if (!q) return true;
      const inTitle = (node.title || '').toLocaleLowerCase('tr-TR').includes(q);
      const inNote = (node.note || '').toLocaleLowerCase('tr-TR').includes(q);
      return inTitle || inNote;
    });
  }, [flatRows, filterText, onlyTasks, rootNodeId]);

  if (!isOpen) return null;

  const toggleNoteOpen = (id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      style={{ paddingBottom: `${kb.keyboardHeight}px` }}
      onClick={onClose}
      data-testid="outline-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          height: kb.isKeyboardOpen
            ? `${Math.max(260, kb.viewportH - 18)}px`
            : '86dvh',
          maxHeight: `${Math.max(260, kb.viewportH - 16)}px`,
          paddingBottom: kb.isKeyboardOpen ? '4px' : 'var(--safe-bottom)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
              <ListTree className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-extrabold sm:text-base">
                  Hiyerarşik Anahat & Ders Notları ({flatRows.length} Dal)
                </h2>
                {taskStats.total > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700 dark:text-emerald-300">
                    ✓ {taskStats.done}/{taskStats.total} Görev
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] opacity-65">
                Tüm ağacı liste halinde düzenleyin, uzun açıklamalar yazın ve ikon atayın (%100 Ücretsiz)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Task Filter Bar */}
        <div
          className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 opacity-45" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Başlık veya uzun açıklamalarda ara..."
              className="allow-text-input min-h-[38px] w-full rounded-xl border bg-transparent py-1.5 pr-3 pl-8 text-base font-semibold outline-none focus:ring-2 focus:ring-indigo-500 sm:text-xs"
              style={{ borderColor: 'var(--hud-border)' }}
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyTasks((v) => !v)}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold ${
              onlyTasks
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'hover:bg-slate-500/10'
            }`}
            style={{ borderColor: onlyTasks ? undefined : 'var(--hud-border)' }}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Sadece Görevler</span>
          </button>
        </div>

        {/* Hierarchical Tree List */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4 sm:px-6">
          {visibleRows.map(({ node, depth }) => {
            const isRoot = node.id === rootNodeId;
            const hasCheck = typeof node.checked === 'boolean';
            const isDone = node.checked === true;
            const showNoteBox =
              expandedNoteIds.has(node.id) || Boolean(node.note?.trim());

            return (
              <div
                key={node.id}
                style={{
                  marginLeft: `${Math.min(depth * 18, 90)}px`,
                  borderColor: isRoot
                    ? node.branchColor
                    : 'var(--hud-border)',
                  backgroundColor: 'var(--hud-bg)',
                }}
                className="rounded-2xl border p-2.5 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  {/* Branch Color / Checkbox */}
                  {!isRoot && (
                    <button
                      type="button"
                      onClick={() => {
                        void hapticSuccess();
                        onToggleNodeCheck(node.id);
                      }}
                      title={
                        hasCheck
                          ? 'Görev durumunu değiştir'
                          : 'Bu dala görev onay kutusu ekle'
                      }
                      style={{
                        borderColor: isDone ? '#10B981' : node.branchColor,
                        backgroundColor: isDone ? '#10B981' : 'transparent',
                      }}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-white"
                    >
                      {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                    </button>
                  )}

                  {/* Sticker Thumbnail / Quick Icon Button */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStickerPickerForNode(node.id);
                    }}
                    title="İkon veya Fotoğraf Değiştir"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-slate-500/5 hover:border-violet-500"
                    style={{ borderColor: 'var(--hud-border)' }}
                  >
                    {node.sticker ? (
                      <img
                        src={node.sticker.url}
                        alt=""
                        className="h-7 w-7 object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-4 w-4 opacity-50" />
                    )}
                  </button>

                  {/* Inline Node Title Input */}
                  <input
                    type="text"
                    value={node.title}
                    onChange={(e) => onUpdateNodeTitle(node.id, e.target.value)}
                    placeholder={isRoot ? 'Ana Ağaç İsmi...' : 'Dal ismi...'}
                    className={`allow-text-input min-w-0 flex-1 bg-transparent text-base font-extrabold outline-none sm:text-sm ${
                      isDone ? 'line-through opacity-60' : ''
                    }`}
                  />

                  {node.priorityTag && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black">
                      {PRIORITY_BADGES[node.priorityTag].emoji}{' '}
                      {PRIORITY_BADGES[node.priorityTag].label}
                    </span>
                  )}

                  {/* Quick Actions */}
                  <button
                    type="button"
                    onClick={() => toggleNoteOpen(node.id)}
                    title="Uzun Açıklama Ekle / Düzenle"
                    className={`flex h-8 items-center gap-1 rounded-xl px-2 text-[11px] font-bold ${
                      showNoteBox
                        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : 'hover:bg-slate-500/10'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Not</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void hapticLight();
                      onAddChildBranch(node.id);
                    }}
                    title="Alt Dal Ekle"
                    className="flex h-8 items-center gap-1 rounded-xl bg-emerald-500/12 px-2 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onJumpToNode(node);
                      onClose();
                    }}
                    title="Haritada Bu Dala Odaklan"
                    className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
                  >
                    <Navigation className="h-3.5 w-3.5 text-sky-500" />
                  </button>
                </div>

                {showNoteBox && (
                  <div className="mt-2 pl-7">
                    <textarea
                      rows={2}
                      value={node.note ?? ''}
                      onChange={(e) => onUpdateNodeNote(node.id, e.target.value)}
                      placeholder="Bu dal için uzun açıklama veya ders notu yazın..."
                      className="allow-text-input w-full rounded-xl border bg-white/60 px-2.5 py-1.5 text-base leading-relaxed font-medium outline-none focus:ring-2 focus:ring-sky-500 sm:text-xs dark:bg-slate-900/50"
                      style={{ borderColor: 'var(--hud-border)' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
