import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { MindNode } from '../types/mindmap';
import { useI18n } from '../core/i18n/i18n';

interface CanvasFindBarProps {
  isOpen: boolean;
  query: string;
  nodes: Record<string, MindNode>;
  activeIndex: number;
  onQueryChange: (q: string) => void;
  onActiveIndexChange: (idx: number) => void;
  onMatchesComputed: (matchIds: string[]) => void;
  onJumpToNode: (node: MindNode) => void;
  onClose: () => void;
}

function normalizeTrSearch(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export const CanvasFindBar: React.FC<CanvasFindBarProps> = ({
  isOpen,
  query,
  nodes,
  activeIndex,
  onQueryChange,
  onActiveIndexChange,
  onMatchesComputed,
  onJumpToNode,
  onClose,
}) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo<MindNode[]>(() => {
    const q = normalizeTrSearch(query);
    if (!q) return [];
    const list: MindNode[] = [];
    for (const n of Object.values(nodes)) {
      const hay = normalizeTrSearch(
        `${n.title || ''} ${n.subtitle || ''} ${n.techBadge || ''} ${n.note || ''}`
      );
      if (hay.includes(q)) {
        list.push(n);
      }
    }
    return list;
  }, [nodes, query]);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [isOpen]);

  useEffect(() => {
    const ids = matches.map((m) => m.id);
    onMatchesComputed(ids);
  }, [matches, onMatchesComputed]);

  const safeIndex = matches.length > 0 ? ((activeIndex % matches.length) + matches.length) % matches.length : 0;

  useEffect(() => {
    if (!isOpen || matches.length === 0) return;
    const target = matches[safeIndex];
    if (target) {
      onJumpToNode(target);
    }
  }, [isOpen, matches, safeIndex, onJumpToNode]);

  if (!isOpen) return null;

  const stepMatch = (delta: number) => {
    if (matches.length === 0) return;
    const next = (safeIndex + delta + matches.length) % matches.length;
    onActiveIndexChange(next);
  };

  return (
    <div
      data-testid="canvas-find-bar"
      className="pointer-events-auto fixed top-16 left-1/2 z-40 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-1.5 rounded-2xl border px-3 py-2 shadow-xl backdrop-blur-md"
      style={{
        backgroundColor: 'var(--hud-bg)',
        borderColor: 'var(--hud-border)',
        color: 'var(--text-primary)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Search className="h-4 w-4 shrink-0 text-sky-500" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        data-testid="canvas-find-input"
        onChange={(e) => {
          onQueryChange(e.target.value);
          onActiveIndexChange(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            stepMatch(e.shiftKey ? -1 : 1);
          }
        }}
        placeholder={t(
          'Haritada başlık veya not ara... (Enter)',
          'Find in map titles or notes... (Enter)'
        )}
        className="allow-text-input min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:font-medium placeholder:opacity-55"
      />
      {query.trim().length > 0 && (
        <span
          data-testid="canvas-find-count"
          className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
            matches.length > 0
              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
          }`}
        >
          {matches.length > 0 ? `${safeIndex + 1} / ${matches.length}` : '0'}
        </span>
      )}
      <button
        type="button"
        onClick={() => stepMatch(-1)}
        disabled={matches.length < 2}
        aria-label={t('Önceki eşleşme', 'Previous match')}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-500/15 disabled:opacity-35"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => stepMatch(1)}
        disabled={matches.length < 2}
        aria-label={t('Sonraki eşleşme', 'Next match')}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-500/15 disabled:opacity-35"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        data-testid="canvas-find-close"
        onClick={onClose}
        aria-label={t('Kapat', 'Close')}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-500/15"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
