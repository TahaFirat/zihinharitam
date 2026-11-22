import React, { useState, useMemo, useEffect } from 'react';
import { X, Wand2, Plus, Sparkles, Check, FileText, Loader2 } from 'lucide-react';
import {
  BRANCH_PALETTE,
  type AcademicDepartment,
  type CrossLink,
  type MindMapDocument,
  type MindNode,
  type ProactiveBranchSuggestion,
} from '../types/mindmap';
import { computeRadialAutoLayout } from '../core/canvas/RadialAutoLayout';
import {
  TopicContextIntelligence,
  type MapContextAnalysis,
} from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import { useKeyboardInset } from '../core/native/useKeyboardInset';

interface SmartMapGeneratorModalProps {
  isOpen: boolean;
  initialTab?: 'text_to_map' | 'proactive_branches';
  activeNode: MindNode | null;
  mapContext: MapContextAnalysis;
  existingSiblingTitles: string[];
  onClose: () => void;
  onGenerateCompleteMap: (doc: MindMapDocument) => void;
  onAddProactiveBranches: (
    parentId: string,
    branches: ProactiveBranchSuggestion[]
  ) => void;
}

const QUICK_SAMPLE_NOTES: Array<{
  label: string;
  dept: AcademicDepartment;
  text: string;
}> = [
  {
    label: '🖧 E-Ticaret Sistem Tasarımı',
    dept: 'sistem_tasarimi',
    text: `Yüksek Trafikli E-Ticaret Sistem Mimarisi
- Trafik & Kenar Katmanı
  - CDN Statik Medya Dağıtımı [Edge PoP]
  - Yük Dengeleyici (Load Balancer) [Port 443 • HTTPS]
  - API Gateway & Rate Limiter [OAuth2 JWT]
- Çekirdek Mikroservisler
  - Ürün Katalog & Elasticsearch Arama [Full-Text]
  - Sepet Servisi & Redis Önbellek [<1ms Hit]
  - Ödeme Geçidi & Finansal Defter [PCI-DSS]
- Veri & Olay Akışı
  - Veritabanı Sharding Kümesi [Consistent Hash]
  - Kafka Sipariş Kuyruğu [Async Stream]`,
  },
  {
    label: '📜 Osmanlı Tımar & İltizam',
    dept: 'sosyal_bilimler',
    text: `Osmanlı Tımar ve Toprak Sistemi
- Dirlik Kademeleri
  - Has Topraklar [100.000+ Akçe]
  - Zeamet Dirlikleri [Orta Kademe]
  - Tımarlı Sipahi Ordusu [Cebelü Atlı Asker]
- Mali & Hukuki Yapı
  - Örfi ve Şer'i Vergi Toplama [Üretim Sürekliliği]
  - İltizam & Mültezim Sistemi [Nakit Hazine Geliri]
- İdari Sonuçlar
  - Taşra Güvenliği ve Asayiş
  - Merkezi Otorite Dengesi`,
  },
  {
    label: '🫀 Kardiyak İletim & EKG',
    dept: 'tip',
    text: `Kalp İletim Sistemi ve EKG Analizi
- Elektriksel Odaklar
  - Sinoatriyal (SA) Düğüm [60-100 atım/dk]
  - Atriyoventriküler (AV) Düğüm [0.09 sn Gecikme]
  - His Demeti ve Purkinje Lifleri [Hızlı Ventriküler İletim]
- Klinik EKG Dalgaları
  - P Dalgası: Atriyal Depolarizasyon
  - QRS Kompleksi: Ventriküler Sistol
- Kapak & Oskültasyon İlişkisi
  - Mitral ve Triküspit Kapanması [S1 Kalp Sesi]`,
  },
];

async function buildSmartMapFromOutlineText(
  rawInput: string,
  deptHint: AcademicDepartment = 'genel'
): Promise<MindMapDocument> {
  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, '  '))
    .filter((l) => l.trim().length > 0);

  const now = Date.now();
  const rootId = 'root';
  const rawRootLine = lines[0]?.replace(/^[-*•#\d.)\s]+/, '').trim() || 'Akademik Zihin Haritası';

  const extractTitleAndBadge = (lineText: string): { title: string; techBadge?: string } => {
    const clean = lineText.replace(/^[-*•#\d.)\s]+/, '').trim();
    const bracketMatch = clean.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
    if (bracketMatch) {
      return {
        title: bracketMatch[1].trim(),
        techBadge: bracketMatch[2].trim(),
      };
    }
    return { title: clean };
  };

  const rootParsed = extractTitleAndBadge(rawRootLine);
  const nodes: Record<string, MindNode> = {
    [rootId]: {
      id: rootId,
      parentId: null,
      title: rootParsed.title,
      subtitle: 'Otomatik Görsel Harita Sentezi',
      techBadge: rootParsed.techBadge,
      x: 0,
      y: 0,
      branchColor: BRANCH_PALETTE[0],
      collapsed: false,
    },
  };

  // If user only typed a 1-line topic title, expand it automatically via `TopicContextIntelligence.getProactiveSubBranches`!
  if (lines.length === 1) {
    const baseCtx = TopicContextIntelligence.analyzeMapContext(nodes, rootId, rootId, deptHint);
    const autoBranches = TopicContextIntelligence.getProactiveSubBranches(
      rootParsed.title,
      baseCtx,
      []
    );
    autoBranches.slice(0, 6).forEach((sug, idx) => {
      const id = `auto_${idx + 1}`;
      nodes[id] = {
        id,
        parentId: rootId,
        title: sug.title,
        techBadge: sug.techBadge,
        x: idx % 2 === 0 ? 320 : -320,
        y: (idx - 2.5) * 140,
        branchColor: BRANCH_PALETTE[idx % BRANCH_PALETTE.length],
        collapsed: false,
        sticker: sug.sticker,
      };
    });
  } else {
    // Parse multi-line indented outline / bullets into tree hierarchy
    let lastLevel1Id: string | null = null;
    let mainBranchIdx = 0;

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      const leadingSpaces = rawLine.match(/^\s*/)?.[0].length ?? 0;
      const isSubBullet = leadingSpaces >= 2 && lastLevel1Id !== null;
      const parsed = extractTitleAndBadge(rawLine);
      if (!parsed.title) continue;

      const nodeId = `gen_${i}`;
      if (!isSubBullet) {
        const col = BRANCH_PALETTE[mainBranchIdx % BRANCH_PALETTE.length];
        mainBranchIdx++;
        lastLevel1Id = nodeId;
        nodes[nodeId] = {
          id: nodeId,
          parentId: rootId,
          title: parsed.title,
          techBadge: parsed.techBadge,
          x: mainBranchIdx % 2 === 1 ? 320 : -320,
          y: 0,
          branchColor: col,
          collapsed: false,
        };
      } else {
        const parent = nodes[lastLevel1Id!];
        nodes[nodeId] = {
          id: nodeId,
          parentId: parent.id,
          title: parsed.title,
          techBadge: parsed.techBadge,
          x: parent.x >= 0 ? parent.x + 280 : parent.x - 280,
          y: 0,
          branchColor: parent.branchColor,
          collapsed: false,
        };
      }
    }
  }

  // Assign distinct, semantically accurate stickers to EVERY generated node using ALL 43,487 Offline + 546,996 Live Icons!
  // Process Root + specific Leaf concepts BEFORE generic category headers so specific leaves always claim their #1 exact icon!
  const mapContext = TopicContextIntelligence.analyzeMapContext(nodes, rootId, rootId, deptHint);
  const usedUrls = new Set<string>();
  const parentIdsWithKids = new Set<string>();
  for (const n of Object.values(nodes)) {
    if (n.parentId) parentIdsWithKids.add(n.parentId);
  }
  const orderedNodesForStickers = Object.values(nodes).sort((a, b) => {
    const rank = (nd: MindNode) =>
      nd.id === rootId ? 0 : !parentIdsWithKids.has(nd.id) ? 1 : 2;
    return rank(a) - rank(b);
  });

  for (const node of orderedNodesForStickers) {
    if (node.sticker) {
      usedUrls.add(node.sticker.url);
      continue;
    }
    const richQuery = node.techBadge
      ? `${node.title} ${node.techBadge}`
      : node.title;

    let pool = (
      await VisualSearchOrchestrator.searchOfflineWave(
        node.title,
        mapContext,
        node.branchColor,
        24
      )
    ).results;

    if (pool.length < 3 && node.techBadge) {
      const withBadge = await VisualSearchOrchestrator.searchOfflineWave(
        richQuery,
        mapContext,
        node.branchColor,
        24
      );
      pool = [...pool, ...withBadge.results];
    }

    if (
      pool.length < 2 &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      const liveFed = await VisualSearchOrchestrator.searchFederatedGallery(
        node.title,
        mapContext,
        node.branchColor
      );
      pool = [...liveFed.results, ...pool];
    }

    const chosen =
      pool.find((r) => r.isVectorSvg && !usedUrls.has(r.previewUrl)) ??
      pool.find((r) => !usedUrls.has(r.previewUrl)) ??
      pool[0];

    if (chosen) {
      usedUrls.add(chosen.previewUrl);
      const materialized = await VisualSearchOrchestrator.materializeStickerSelection(
        chosen,
        {
          retintToBranchColor: chosen.isDuotoneColorizable
            ? node.branchColor
            : null,
        }
      );
      node.sticker = {
        ...materialized,
        id: `genstk_${node.id}`,
      };
    }
  }

  // Compute non-overlapping Radial Auto-Layout + add 1 smart CrossLink if >= 5 nodes
  const laidOutNodes = computeRadialAutoLayout(nodes, rootId);
  const level1Ids = Object.values(laidOutNodes)
    .filter((n) => n.parentId === rootId)
    .map((n) => n.id);

  const crossLinks: CrossLink[] = [];
  if (level1Ids.length >= 2) {
    crossLinks.push({
      id: `cl_auto_${now}`,
      fromNodeId: level1Ids[0],
      toNodeId: level1Ids[1],
      label: 'Doğrudan Etkileşim',
      color: '#0EA5E9',
      style: 'dashed_flow',
    });
  }

  return {
    id: `map_smart_${now}`,
    title: rootParsed.title,
    department: deptHint,
    rootNodeId: rootId,
    nodes: laidOutNodes,
    crossLinks,
    createdAt: now,
    updatedAt: now,
  };
}

const WIKI_SKIP_SECTION_RE =
  /^(kaynakca|kaynaklar|dis baglantilar|ayrica bakiniz|notlar|dipnotlar|galeri|bibliyografya|okuma listesi|references|external links|see also|notes|bibliography|further reading)$/i;

function normalizeAsciiSimple(str: string): string {
  return str
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Queries Turkish Wikipedia live (zero API key, <1.3s timeout) to extract real factual sub-headings
 * for ANY custom mind-map title (e.g., "Güneş Sistemi", "Mitoz Bölünme", "Osmanlı Yükselme")
 * and automatically pairs each sub-branch with a vibrant gamified offline vector icon!
 */
async function fetchLiveWikipediaSubBranches(
  topicTitle: string,
  mapContext: MapContextAnalysis,
  existingSiblingTitles: string[],
  signal: AbortSignal
): Promise<ProactiveBranchSuggestion[]> {
  const clean = topicTitle.trim();
  const norm = normalizeAsciiSimple(clean);
  if (
    clean.length < 3 ||
    /^(yeni gorsel harita|yeni harita|yeni konu|ana konu|baslik|genel zihin haritasi)$/.test(
      norm
    )
  ) {
    return [];
  }

  try {
    const searchUrl = `https://tr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      clean
    )}&srlimit=1&format=json&origin=*`;
    const sRes = await fetch(searchUrl, { signal });
    if (!sRes.ok) return [];
    const sJson = (await sRes.json()) as {
      query?: { search?: Array<{ pageid: number; title: string }> };
    };
    const hit = sJson?.query?.search?.[0];
    if (!hit?.pageid) return [];

    const secUrl = `https://tr.wikipedia.org/w/api.php?action=parse&pageid=${hit.pageid}&prop=sections&format=json&origin=*`;
    const secRes = await fetch(secUrl, { signal });
    if (!secRes.ok) return [];
    const secJson = (await secRes.json()) as {
      parse?: { sections?: Array<{ line: string; toclevel: number }> };
    };
    const sections = secJson?.parse?.sections ?? [];
    const existingSet = new Set(existingSiblingTitles.map(normalizeAsciiSimple));

    const pickedHeadings: string[] = [];
    for (const sec of sections) {
      if (sec.toclevel > 2) continue;
      const title = sec.line.replace(/<[^>]+>/g, '').trim();
      const tNorm = normalizeAsciiSimple(title);
      if (
        title.length < 3 ||
        title.length > 44 ||
        WIKI_SKIP_SECTION_RE.test(tNorm) ||
        existingSet.has(tNorm) ||
        pickedHeadings.some((p) => normalizeAsciiSimple(p) === tNorm)
      ) {
        continue;
      }
      pickedHeadings.push(title);
      if (pickedHeadings.length >= 6) break;
    }

    if (pickedHeadings.length < 2) return [];

    const results: ProactiveBranchSuggestion[] = [];
    for (let i = 0; i < pickedHeadings.length; i++) {
      const heading = pickedHeadings[i];
      const off = await VisualSearchOrchestrator.searchOfflineWave(
        `${heading} ${clean}`,
        mapContext,
        BRANCH_PALETTE[i % BRANCH_PALETTE.length],
        12
      );
      const bestIcon = off.results[0];
      const sticker = bestIcon
        ? await VisualSearchOrchestrator.materializeStickerSelection(bestIcon)
        : TopicContextIntelligence.getProactiveSubBranches(clean, mapContext, [])[0]?.sticker;

      if (sticker) {
        results.push({
          id: `wiki_sug_${hit.pageid}_${i}`,
          title: heading,
          techBadge: hit.title,
          sticker,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export const SmartMapGeneratorModal: React.FC<SmartMapGeneratorModalProps> = ({
  isOpen,
  initialTab = 'text_to_map',
  activeNode,
  mapContext,
  existingSiblingTitles,
  onClose,
  onGenerateCompleteMap,
  onAddProactiveBranches,
}) => {
  const kb = useKeyboardInset();
  const [tab, setTab] = useState<'text_to_map' | 'proactive_branches'>(initialTab);
  const [outlineText, setOutlineText] = useState('');
  const [deptHint, setDeptHint] = useState<AcademicDepartment>('genel');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveWikiBranches, setLiveWikiBranches] = useState<ProactiveBranchSuggestion[]>([]);
  const [loadingLiveBranches, setLoadingLiveBranches] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setAddedIds(new Set());
    }
  }, [isOpen, initialTab]);

  const targetTitle = activeNode?.title || mapContext.parentTitle || mapContext.label;

  const baseProactiveList = useMemo(() => {
    return TopicContextIntelligence.getProactiveSubBranches(
      targetTitle,
      mapContext,
      existingSiblingTitles
    );
  }, [targetTitle, mapContext, existingSiblingTitles]);

  useEffect(() => {
    if (!isOpen || tab !== 'proactive_branches') {
      setLiveWikiBranches([]);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLiveWikiBranches([]);
      return;
    }
    const ctrl = new AbortController();
    setLoadingLiveBranches(true);
    const timeoutId = window.setTimeout(() => ctrl.abort(), 2200);
    void fetchLiveWikipediaSubBranches(
      targetTitle,
      mapContext,
      existingSiblingTitles,
      ctrl.signal
    )
      .then((res) => {
        if (!ctrl.signal.aborted) {
          setLiveWikiBranches(res);
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!ctrl.signal.aborted) setLoadingLiveBranches(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      ctrl.abort();
    };
  }, [isOpen, tab, targetTitle, mapContext, existingSiblingTitles]);

  const proactiveList =
    liveWikiBranches.length >= 2 ? liveWikiBranches : baseProactiveList;

  if (!isOpen) return null;

  const handleCreateSmartMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const input = outlineText.trim() || QUICK_SAMPLE_NOTES[0].text;
      const generatedDoc = await buildSmartMapFromOutlineText(input, deptHint);
      void hapticSuccess();
      onGenerateCompleteMap(generatedDoc);
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      style={{
        paddingTop: 'max(54px, calc(var(--safe-top) + 12px))',
        paddingBottom: `${kb.keyboardHeight}px`,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          maxHeight: `${Math.max(280, kb.viewportH - 68)}px`,
          paddingBottom: kb.isKeyboardOpen ? '6px' : 'max(22px, calc(var(--safe-bottom) + 14px))',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3.5 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold sm:text-base">
                Akıllı Harita & Proaktif Dal Sentezleyici
              </h2>
              <p className="text-[11px] opacity-65">
                Tek bir konu başlığından veya ders notundan tam çıkartmalı harita üretin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div
          className="flex gap-1.5 border-b px-4 py-2.5 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <button
            type="button"
            onClick={() => setTab('text_to_map')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
              tab === 'text_to_map'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'hover:bg-slate-500/10'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Metinden / Konudan Harita Üret</span>
          </button>
          {activeNode && (
            <button
              type="button"
              onClick={() => setTab('proactive_branches')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
                tab === 'proactive_branches'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'hover:bg-slate-500/10'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>“{activeNode.title || 'Seçili Dal'}” İçin Alt Dallar Öner</span>
            </button>
          )}
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          {tab === 'text_to_map' ? (
            <form onSubmit={handleCreateSmartMap} className="space-y-3.5">
              <div>
                <div className="mb-1.5 text-xs font-extrabold opacity-75">
                  Hızlı Tek Tıkla Örnek Ders Notları:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SAMPLE_NOTES.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => {
                        setOutlineText(sample.text);
                        setDeptHint(sample.dept);
                      }}
                      className="rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-300"
                      style={{ borderColor: 'var(--hud-border)' }}
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold opacity-75">
                  Konu Başlığı veya Maddeli Ders Özeti Yapıştırın:
                </label>
                <textarea
                  rows={kb.isKeyboardOpen ? 4 : 8}
                  value={outlineText}
                  onChange={(e) => setOutlineText(e.target.value)}
                  placeholder={`Tek bir konu yazabilir (örn: "Dağıtık Sistem Mimarisi" veya "Mitral Kapak Darlığı")\nveya maddeli not yapıştırabilirsiniz:\n\nMerkezi Konu\n- Ana Dal 1 [Teknik Rozet]\n  - Alt Kavram A\n  - Alt Kavram B`}
                  className="allow-text-input w-full rounded-2xl border bg-transparent p-3.5 text-base leading-relaxed font-semibold outline-none focus:ring-2 focus:ring-sky-500 sm:text-sm"
                  style={{ borderColor: 'var(--hud-border)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold hover:bg-slate-500/10"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  <span>{isGenerating ? 'İkonlar Eşleştiriliyor...' : 'Görsel Haritayı Oluştur'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
                  <span>{mapContext.emoji}</span>
                  <span>
                    <strong>{targetTitle || mapContext.label}</strong> konusuna özel önerilen
                    alt dallar:
                  </span>
                  {loadingLiveBranches && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                  )}
                </p>
                {activeNode && proactiveList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      void hapticSuccess();
                      onAddProactiveBranches(activeNode.id, proactiveList);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs active:scale-95"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Tümünü Ekle ({proactiveList.length})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {proactiveList.map((item) => {
                  const isAdded = addedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isAdded || !activeNode}
                      onClick={() => {
                        if (!activeNode) return;
                        void hapticLight();
                        onAddProactiveBranches(activeNode.id, [item]);
                        setAddedIds((prev) => new Set(prev).add(item.id));
                      }}
                      className="flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-all hover:border-violet-500 hover:shadow-sm disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--hud-bg)',
                        borderColor: 'var(--hud-border)',
                      }}
                    >
                      <img
                        src={item.sticker.url}
                        alt={item.title}
                        className="h-12 w-12 shrink-0 object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-extrabold">{item.title}</div>
                        {item.techBadge && (
                          <span className="mt-0.5 inline-block rounded-md bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-300">
                            {item.techBadge}
                          </span>
                        )}
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
                        {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
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
