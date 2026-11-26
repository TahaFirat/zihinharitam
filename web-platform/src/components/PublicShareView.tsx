import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  Loader2,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react';
import type { MindMapDocument, MindNode } from '@app/types/mindmap';
import { ApiClientError, WebApi, type PublicShareResponse } from '../api/webApiClient';

interface PublicShareViewProps {
  slug: string;
  onNavigate: (path: string) => void;
  onCloneToWorkspace: (doc: MindMapDocument) => Promise<void>;
}

function buildMarkdownOutline(doc: MindMapDocument): string {
  const nodes = doc.nodes || {};
  const root = nodes[doc.rootNodeId];
  if (!root) return `# ${doc.title}\n`;

  const childrenByParent = new Map<string, string[]>();
  for (const n of Object.values(nodes)) {
    if (n.parentId) {
      const arr = childrenByParent.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenByParent.set(n.parentId, arr);
    }
  }

  const lines: string[] = [`# ${root.title}`];
  const visited = new Set<string>();

  function walk(nodeId: string, depth: number) {
    if (visited.has(nodeId) || depth > 12) return;
    visited.add(nodeId);
    const n = nodes[nodeId];
    if (!n) return;
    if (depth > 0) {
      const indent = '  '.repeat(depth - 1);
      const badge = n.techBadge ? ` [${n.techBadge}]` : '';
      lines.push(`${indent}- ${n.title}${badge}`);
      if (n.subtitle) lines.push(`${indent}  *${n.subtitle}*`);
      if (n.note) lines.push(`${indent}  > ${n.note}`);
    }
    for (const childId of childrenByParent.get(nodeId) || []) {
      walk(childId, depth + 1);
    }
  }
  walk(root.id, 0);
  return lines.join('\n');
}

export const PublicShareView: React.FC<PublicShareViewProps> = ({
  slug,
  onNavigate,
  onCloneToWorkspace,
}) => {
  const [data, setData] = useState<PublicShareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedMd, setCopiedMd] = useState(false);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    WebApi.fetchPublicShare(slug)
      .then((res) => setData(res))
      .catch((err) => {
        setError(err instanceof ApiClientError ? err.message : 'Paylaşım yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setError(null);
    try {
      const res = await WebApi.unlockPublicShare(slug, password);
      setData(res);
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Şifre doğrulanamadı.');
    } finally {
      setUnlocking(false);
    }
  }

  const doc = data?.document ?? null;

  const { svgNodes, svgEdges, bounds } = useMemo(() => {
    if (!doc || !doc.nodes) {
      return { svgNodes: [] as MindNode[], svgEdges: [] as Array<{ from: MindNode; to: MindNode }>, bounds: { minX: -400, minY: -300, width: 800, height: 600 } };
    }
    const list = Object.values(doc.nodes);
    const edges: Array<{ from: MindNode; to: MindNode }> = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of list) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
      if (n.parentId && doc.nodes[n.parentId]) {
        edges.push({ from: doc.nodes[n.parentId], to: n });
      }
    }
    if (!Number.isFinite(minX)) {
      minX = -320;
      minY = -220;
      maxX = 320;
      maxY = 220;
    }
    const pad = 160;
    return {
      svgNodes: list,
      svgEdges: edges,
      bounds: {
        minX: minX - pad,
        minY: minY - pad,
        width: Math.max(640, maxX - minX + pad * 2),
        height: Math.max(420, maxY - minY + pad * 2),
      },
    };
  }, [doc]);

  const filteredNodes = useMemo(() => {
    if (!doc?.nodes) return [];
    const q = search.trim().toLowerCase();
    const list = Object.values(doc.nodes);
    if (!q) return list;
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.subtitle || '').toLowerCase().includes(q) ||
        (n.note || '').toLowerCase().includes(q)
    );
  }, [doc, search]);

  return (
    <div className="min-h-dvh bg-[#FAF9F5] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ZihinHaritam</span>
            </button>
            {data && (
              <div className="min-w-0 border-l border-slate-200 pl-2.5">
                <div className="truncate text-xs font-black text-slate-900 sm:text-sm">{data.title}</div>
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 sm:text-[11px]">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {data.viewCount}
                  </span>
                  <span>· Salt Okunur</span>
                </div>
              </div>
            )}
          </div>

          {doc && (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(buildMarkdownOutline(doc));
                  setCopiedMd(true);
                  setTimeout(() => setCopiedMd(false), 2000);
                }}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 sm:px-3 sm:text-xs"
              >
                {copiedMd ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{copiedMd ? 'Kopyalandı' : 'Markdown'}</span>
              </button>
              <button
                type="button"
                disabled={cloning}
                onClick={async () => {
                  setCloning(true);
                  try {
                    await onCloneToWorkspace(doc);
                  } finally {
                    setCloning(false);
                  }
                }}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60 sm:px-3.5 sm:text-xs"
              >
                {cloning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span>Kopyala</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
            <p className="mt-3 text-xs font-bold">Paylaşılan harita yükleniyor...</p>
          </div>
        ) : error && !data ? (
          <div className="mx-auto max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-3 text-base font-black text-slate-900">Bağlantı Açılamadı</h1>
            <p className="mt-1.5 text-xs font-semibold text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-600"
            >
              ZihinHaritam Stüdyosunu Aç
            </button>
          </div>
        ) : data?.requiresPassword ? (
          <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-center text-lg font-black text-slate-900">{data.title}</h1>
            <p className="mt-1 text-center text-xs font-semibold text-slate-500">
              Bu harita şifre ile korunuyor. Görüntülemek için paylaşım şifresini girin.
            </p>
            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {error}
              </div>
            )}
            <form onSubmit={handleUnlock} className="mt-5 space-y-3">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Paylaşım şifresi"
                className="allow-text-input w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={unlocking}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Haritayı Aç</span>}
              </button>
            </form>
          </div>
        ) : doc ? (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Visual Mind Map SVG Stage */}
            <div className="lg:col-span-8">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Görsel Harita Önizlemesi
                  </span>
                  <span>{svgNodes.length} kavram dalı</span>
                </div>
                <svg
                  viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
                  className="h-[460px] w-full bg-[#FAF9F5]"
                >
                  {svgEdges.map(({ from, to }) => {
                    const mx = (from.x + to.x) / 2;
                    return (
                      <path
                        key={`${from.id}-${to.id}`}
                        d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
                        fill="none"
                        stroke={to.branchColor || '#6366F1'}
                        strokeWidth={from.id === doc.rootNodeId ? 4.5 : 3}
                        strokeLinecap="round"
                        opacity="0.82"
                      />
                    );
                  })}
                  {svgNodes.map((n) => {
                    const isRoot = n.id === doc.rootNodeId;
                    const label = n.title.length > 26 ? `${n.title.slice(0, 24)}…` : n.title;
                    const w = Math.max(120, label.length * 8.2 + 34);
                    const h = isRoot ? 50 : 38;
                    return (
                      <g key={n.id} transform={`translate(${n.x - w / 2}, ${n.y - h / 2})`}>
                        <rect
                          width={w}
                          height={h}
                          rx={isRoot ? 16 : 12}
                          fill={isRoot ? '#0F172A' : '#FFFFFF'}
                          stroke={isRoot ? '#0F172A' : n.branchColor || '#6366F1'}
                          strokeWidth={isRoot ? 0 : 2.2}
                        />
                        <text
                          x={w / 2}
                          y={h / 2 + 4.5}
                          textAnchor="middle"
                          fill={isRoot ? '#FFFFFF' : '#0F172A'}
                          fontSize={isRoot ? 14 : 12}
                          fontWeight="700"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Searchable Branch & Notes Reader */}
            <div className="lg:col-span-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Dallarda ve notlarda ara..."
                    className="allow-text-input w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {filteredNodes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: n.branchColor || '#6366F1' }}
                        />
                        <span className="text-xs font-extrabold text-slate-900">{n.title}</span>
                        {n.techBadge && (
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                            {n.techBadge}
                          </span>
                        )}
                      </div>
                      {n.subtitle && (
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{n.subtitle}</p>
                      )}
                      {n.note && (
                        <p className="mt-1.5 rounded-lg bg-white p-2 text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200/70">
                          {n.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
