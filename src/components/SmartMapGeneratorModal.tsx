import React, { useState, useMemo } from 'react';
import { X, Wand2, Plus, Sparkles, Check, FileText } from 'lucide-react';
import {
  BRANCH_PALETTE,
  type AcademicDepartment,
  type CrossLink,
  type MindMapDocument,
  type MindNode,
  type ProactiveBranchSuggestion,
  type StickerAsset,
} from '../types/mindmap';
import { computeRadialAutoLayout } from '../core/canvas/RadialAutoLayout';
import {
  TopicContextIntelligence,
  type MapContextAnalysis,
} from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';

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

function buildSmartMapFromOutlineText(
  rawInput: string,
  deptHint: AcademicDepartment = 'genel'
): MindMapDocument {
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

  // Assign distinct, semantically accurate multi-color stickers to every generated node!
  const mapContext = TopicContextIntelligence.analyzeMapContext(nodes, rootId, rootId, deptHint);
  const usedUrls = new Set<string>();

  for (const node of Object.values(nodes)) {
    if (node.sticker) {
      usedUrls.add(node.sticker.url);
      continue;
    }
    const wave1 = VisualSearchOrchestrator.getInstantWave1Results(
      node.title,
      mapContext,
      node.branchColor
    );
    const chosen =
      wave1.results.find((r) => !usedUrls.has(r.previewUrl)) ?? wave1.results[0];
    if (chosen) {
      usedUrls.add(chosen.previewUrl);
      const stk: StickerAsset = {
        id: `genstk_${node.id}`,
        url: chosen.previewUrl,
        mode: chosen.mode,
        source: 'library',
        dieCutProcessed: !chosen.needsDieCut,
        aspectRatio: 1,
        label: chosen.title,
      };
      node.sticker = stk;
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
  const [tab, setTab] = useState<'text_to_map' | 'proactive_branches'>(initialTab);
  const [outlineText, setOutlineText] = useState('');
  const [deptHint, setDeptHint] = useState<AcademicDepartment>('genel');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const proactiveList = useMemo(() => {
    const targetTitle = activeNode?.title || mapContext.parentTitle || mapContext.label;
    return TopicContextIntelligence.getProactiveSubBranches(
      targetTitle,
      mapContext,
      existingSiblingTitles
    );
  }, [activeNode?.title, mapContext, existingSiblingTitles]);

  if (!isOpen) return null;

  const handleCreateSmartMap = (e: React.FormEvent) => {
    e.preventDefault();
    const input = outlineText.trim() || QUICK_SAMPLE_NOTES[0].text;
    void hapticSuccess();
    const generatedDoc = buildSmartMapFromOutlineText(input, deptHint);
    onGenerateCompleteMap(generatedDoc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'var(--safe-bottom)',
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
                  rows={8}
                  value={outlineText}
                  onChange={(e) => setOutlineText(e.target.value)}
                  placeholder={`Tek bir konu yazabilir (örn: "Dağıtık Sistem Mimarisi" veya "Mitral Kapak Darlığı")\nveya maddeli not yapıştırabilirsiniz:\n\nMerkezi Konu\n- Ana Dal 1 [Teknik Rozet]\n  - Alt Kavram A\n  - Alt Kavram B`}
                  className="allow-text-input w-full rounded-2xl border bg-transparent p-3.5 text-xs leading-relaxed font-semibold outline-none focus:ring-2 focus:ring-sky-500 sm:text-sm"
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform active:scale-95"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>Görsel Haritayı Oluştur</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold opacity-75">
                  {mapContext.emoji} <strong>{mapContext.label}</strong> bağlamına göre
                  önerilen hazır alt dallar:
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
