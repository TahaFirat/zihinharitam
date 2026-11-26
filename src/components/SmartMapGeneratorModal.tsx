import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Wand2,
  Plus,
  Sparkles,
  Check,
  FileText,
  Loader2,
  Eye,
  Mic,
  MicOff,
  Trash2,
  ArrowRight,
  BookOpen,
  Copy,
  FileUp,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
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
  convertLectureNoteToMindMapFormat,
  parseTextToMindMapOutline,
  type LectureNoteConversionResult,
  type LectureNoteDepth,
  type MindMapDensity,
} from '../core/smartmap/TextToMindMapParser';
import {
  attachDocumentImagesToBestBranches,
  extractDocumentForMindMap,
  type DocumentExtractionResult,
  type ExtractedDocumentImage,
} from '../core/smartmap/DocumentImportExtractor';
import { cleanIconLookupQuery } from '../core/smartmap/AcademicContentFilter';
import {
  fetchAiStatus,
  getSavedAiModePreference,
  requestAiStructuredOutline,
  saveAiModePreference,
  type AiStatusInfo,
} from '../core/smartmap/AiMindMapClient';
import {
  TopicContextIntelligence,
  type MapContextAnalysis,
} from '../core/visuals/TopicContextIntelligence';
import { VisualSearchOrchestrator } from '../core/visuals/VisualSearchOrchestrator';
import { hapticLight, hapticSuccess } from '../core/native/NativeBridge';
import {
  isDictationSupported,
  SpeechDictationController,
} from '../core/native/SpeechDictation';
import { dismissNativeKeyboard, useKeyboardInset } from '../core/native/useKeyboardInset';
import { useI18n } from '../core/i18n/i18n';

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
    label: '📝 Açıklamalı Ders Notu',
    dept: 'tip',
    text: `Kalp İletim Sistemi ve EKG Analizi
- Elektriksel Odaklar
  - Sinoatriyal (SA) Düğüm: Kalbin doğal pilidir, dakikada 60-100 kez uyarı üretir. [60-100 atım/dk]
  - Atriyoventriküler (AV) Düğüm: Kulakçıkların kasılması için 0.09 sn fizyolojik gecikme sağlar.
  - His Demeti ve Purkinje Lifleri: Uyarıyı karıncıklara hızla iletir. [Hızlı İletim]
- Klinik EKG Dalgaları
  - P Dalgası: Atriyal depolarizasyonu gösterir. [SINAV]
    Not: Normal süresi 0.08-0.12 saniyedir.
  - QRS Kompleksi: Ventriküler depolarizasyonu temsil eder. [ÖNEMLİ]
- Kapak & Oskültasyon İlişkisi
  - Mitral ve Triküspit Kapanması: S1 kalp sesini oluşturur. [S1 Sesi]`,
  },
  {
    label: '📄 Paragraftan Harita',
    dept: 'sosyal_bilimler',
    text: `Osmanlı Tımar ve Toprak Sistemi

Osmanlı Devleti'nde miri arazilerin gelirleri, hizmet karşılığı devlet görevlilerine ve askerlere dirlik olarak verilirdi. Bu sistem hem tarımsal üretimin sürekliliğini hem de hazineden para çıkmadan büyük bir atlı ordunun beslenmesini sağladı.

Dirlik Toprakları: Gelir büyüklüğüne göre Has, Zeamet ve Tımar olmak üzere üçe ayrılırdı. Tımar sahipleri her 3.000 akçe için devlete cebelü adı verilen tam donanımlı bir atlı asker yetiştirirdi.

İltizam Sistemi: 17. yüzyıldan itibaren merkez hazinenin nakit ihtiyacını karşılamak için vergi toplama hakkının açık artırmayla mültezimlere kiralanmasıyla yaygınlaştı.`,
  },
  {
    label: '🖧 E-Ticaret Mimarisi',
    dept: 'sistem_tasarimi',
    text: `Yüksek Trafikli E-Ticaret Sistem Mimarisi
- Trafik & Kenar Katmanı
  - CDN Statik Medya Dağıtımı: Görsel ve JS dosyalarını kullanıcıya en yakın noktadan sunar. [Edge PoP]
  - Yük Dengeleyici (Load Balancer): Gelen trafiği sağlıklı sunuculara dağıtır. [Port 443 • HTTPS]
  - API Gateway & Rate Limiter: Kimlik doğrulama ve hız sınırlama uygular. [OAuth2 JWT]
- Çekirdek Mikroservisler
  - Ürün Katalog & Elasticsearch: Milisaniye altı tam metin ürün araması yapar. [Full-Text]
  - Sepet Servisi & Redis Önbellek: Aktif sepetleri bellek içi tutar. [<1ms Hit]
  - Ödeme Geçidi: 3D Secure ve finansal mutabakat işlemlerini yönetir. [PCI-DSS]
- Veri & Olay Akışı
  - Veritabanı Sharding Kümesi: Sipariş verisini kullanıcı kimliğine göre böler. [Consistent Hash]
  - Kafka Sipariş Kuyruğu: Stok, kargo ve e-posta servislerini asenkron tetikler. [Async Stream]`,
  },
];

async function buildSmartMapFromOutlineText(
  rawInput: string,
  deptHint: AcademicDepartment = 'genel',
  options?: {
    density?: MindMapDensity;
    documentImages?: ExtractedDocumentImage[];
  }
): Promise<MindMapDocument> {
  const now = Date.now();
  const parsed = parseTextToMindMapOutline(rawInput, {
    density: options?.density ?? 'compact',
  });
  const rootId = parsed.rootId;

  const nodes: Record<string, MindNode> = {};
  parsed.nodes.forEach((p, idx) => {
    nodes[p.id] = {
      id: p.id,
      parentId: p.parentId,
      title: p.title,
      subtitle: p.id === rootId ? 'Akıllı Metin Haritası' : undefined,
      note: p.note,
      techBadge: p.techBadge,
      checked: p.checked,
      priorityTag: p.priorityTag,
      linkUrl: p.linkUrl,
      x: p.id === rootId ? 0 : idx % 2 === 0 ? 320 * p.level : -320 * p.level,
      y: p.id === rootId ? 0 : (idx - 2) * 120,
      branchColor: p.branchColor,
      collapsed: false,
    };
  });

  // If user uploaded a PDF / PPTX / DOCX with diagrams/photos, attach real document images to the best-matching branches first!
  if (options?.documentImages && options.documentImages.length > 0) {
    attachDocumentImagesToBestBranches(nodes, rootId, options.documentImages);
  }

  // If user only typed a 1-line topic title, expand it automatically via `TopicContextIntelligence.getProactiveSubBranches`!
  if (parsed.isSingleTopicSeed && parsed.nodes.length === 1) {
    const rootNode = nodes[rootId];
    const baseCtx = TopicContextIntelligence.analyzeMapContext(nodes, rootId, rootId, deptHint);
    const autoBranches = TopicContextIntelligence.getProactiveSubBranches(
      rootNode.title,
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
  }

  // Assign distinct, semantically accurate stickers to EVERY generated node using ALL 43,722 Offline + 546,996 Live Icons!
  // Reads BOTH `node.title` AND `node.note` (explanation box) so nodes with rich descriptions always match accurately!
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

  // Wave A: Instant parallel <50ms Offline Search across ALL nodes (reading BOTH `node.title` AND `node.note`!)
  const offlinePools = await Promise.all(
    orderedNodesForStickers.map(async (node) => {
      if (node.sticker) return { node, pool: [] as Awaited<ReturnType<typeof VisualSearchOrchestrator.searchOfflineWave>>['results'] };
      const cleanTitleQuery = cleanIconLookupQuery(node.title);
      const noteSnippet = (node.note || '')
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .slice(0, 4)
        .join(' ');
      const richQuery = [cleanTitleQuery, noteSnippet]
        .filter(Boolean)
        .join(' ');

      let pool = (
        await VisualSearchOrchestrator.searchOfflineWave(
          cleanTitleQuery,
          mapContext,
          node.branchColor,
          20
        )
      ).results;

      if ((pool.length < 3 || (pool[0]?.score ?? 0) < 0.78) && (node.note || node.techBadge)) {
        const withNote = await VisualSearchOrchestrator.searchOfflineWave(
          richQuery,
          mapContext,
          node.branchColor,
          20
        );
        pool = [...pool, ...withNote.results];
      }
      return { node, pool };
    })
  );

  // Wave B: Fast parallel live boost (hard-capped at 1200ms total) ONLY for up to 4 nodes that had weak offline hits
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const weakEntries = offlinePools
      .filter(({ node, pool }) => !node.sticker && (pool.length < 2 || (pool[0]?.score ?? 0) < 0.72))
      .slice(0, 4);
    if (weakEntries.length > 0) {
      const liveCtrl = new AbortController();
      const liveTimer = window.setTimeout(() => liveCtrl.abort(), 1200);
      try {
        await Promise.allSettled(
          weakEntries.map(async (entry) => {
            const liveFed = await VisualSearchOrchestrator.searchFederatedGallery(
              cleanIconLookupQuery(entry.node.title),
              mapContext,
              entry.node.branchColor,
              liveCtrl.signal
            );
            entry.pool = [...liveFed.results, ...entry.pool];
          })
        );
      } finally {
        window.clearTimeout(liveTimer);
      }
    }
  }

  for (const { node, pool } of offlinePools) {
    if (node.sticker) {
      usedUrls.add(node.sticker.url);
      continue;
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

  // Compute non-overlapping Radial Auto-Layout (never fabricate arbitrary cross-links between unrelated branches)
  const laidOutNodes = computeRadialAutoLayout(nodes, rootId);
  const crossLinks: CrossLink[] = [];

  return {
    id: `map_smart_${now}`,
    title: nodes[rootId].title,
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

const SAMPLE_RAW_LECTURE_NOTE = `Hücre Bölünmesi ve Mitoz Süreci

Mitoz bölünme tek bir ana hücreden genetik olarak birbirinin aynısı 2 yeni yavru hücre oluşmasını sağlar. Çok hücreli canlılarda büyüme, gelişme ve doku onarımı mitoz ile gerçekleşir.

Mitoz Evreleri: Mitoz çekirdek bölünmesi 4 temel evreden oluşur: Profaz, Metafaz, Anafaz ve Telofaz. Profaz evresinde kromatin iplikler kısalıp kalınlaşarak kromozomlara dönüşür ve çekirdek zarı erir. Metafaz evresinde kromozomlar hücrenin ekvator düzleminde tek sıra dizilir ve karyotip analizi bu evrede yapılır (sınavda çıkar). Ancak Anafaz evresinde kardeş kromatitler ayrılarak zıt kutuplara çekilir.

Sitokinez (Sitoplazma Bölünmesi): Hayvan hücrelerinde hücre zarı dıştan içe boğumlanarak bölünür. Örneğin bitki hücrelerinde ise hücre duvarı nedeniyle merkezde ara lamel (orta plak) oluşumu gerçekleşir.`;

const SAMPLE_RAW_NETWORK_NOTE = `TCP/IP Ağ Modeli ve Tünel Protokolleri

TCP/IP modeli internet üzerindeki veri iletişimini 4 temel katmanda düzenler. Uygulama Katmanı: HTTP, HTTPS, DNS ve SSH gibi son kullanıcı protokollerini barındırır (Port 443). Ancak veri paketleri şifrelenerek VPN tüneli üzerinden güvenle iletilebilir.

Taşıma Katmanı: TCP güvenilir, bağlantılı ve sıralı veri iletimi sağlarken UDP düşük gecikmeli hızlı yayınlar için kullanılır (sınavda çıkar). İnternet Katmanı: IP adresleme ve yönlendirici (router) üzerinden en uygun rota seçimini yönetir.

Ağ Erişim Katmanı: Ethernet ve Wi-Fi üzerinden fiziksel çerçeve (frame) iletimini ve MAC adresi eşleştirmesini gerçekleştirir.`;

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
  const { t, lang } = useI18n();
  const kb = useKeyboardInset();
  const [tab, setTab] = useState<'text_to_map' | 'proactive_branches'>(initialTab);
  const [inputMode, setInputMode] = useState<'outline' | 'converter' | 'document'>('outline');
  const [outlineText, setOutlineText] = useState('');
  const [rawLectureNote, setRawLectureNote] = useState('');
  const [analysisDepth, setAnalysisDepth] = useState<LectureNoteDepth>('compact');
  const [useAiMode, setUseAiMode] = useState<boolean>(() => getSavedAiModePreference());
  const [aiStatus, setAiStatus] = useState<AiStatusInfo | null>(null);
  const [isAiStructuring, setIsAiStructuring] = useState(false);
  const [aiOutlineCache, setAiOutlineCache] = useState<{
    key: string;
    outline: string;
    cached: boolean;
    provider?: string;
  } | null>(null);
  const [aiStatusNote, setAiStatusNote] = useState<string | null>(null);
  const [converterPreviewMode, setConverterPreviewMode] = useState<'text' | 'tree'>('text');
  const [docResult, setDocResult] = useState<DocumentExtractionResult | null>(null);
  const [docImages, setDocImages] = useState<ExtractedDocumentImage[]>([]);
  const [useDocImages, setUseDocImages] = useState(true);
  const [docLoading, setDocLoading] = useState<{ label: string; pct: number } | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedConverted, setCopiedConverted] = useState(false);
  const [convertFeedback, setConvertFeedback] = useState<
    LectureNoteConversionResult['stats'] | null
  >(null);
  const [deptHint, setDeptHint] = useState<AcademicDepartment>('genel');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveWikiBranches, setLiveWikiBranches] = useState<ProactiveBranchSuggestion[]>([]);
  const [loadingLiveBranches, setLoadingLiveBranches] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const dictationRef = useRef<SpeechDictationController | null>(null);
  const dictationPrefixRef = useRef('');
  const outlineTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      void dictationRef.current?.stop(false);
    };
  }, []);

  const toggleOutlineDictation = async () => {
    void hapticLight();
    setDictationError(null);
    if (!dictationRef.current) {
      dictationRef.current = new SpeechDictationController();
    }
    const ctrl = dictationRef.current;
    if (isDictating || ctrl.isListening()) {
      await ctrl.stop(true);
      setIsDictating(false);
      return;
    }
    dictationPrefixRef.current =
      inputMode === 'converter' ? rawLectureNote.trim() : outlineText.trim();
    const targetMode = inputMode;
    const applyText = (spoken: string) => {
      const clean = spoken.trim();
      if (!clean) return;
      const base = dictationPrefixRef.current;
      const merged = base ? `${base}\n${clean}` : clean;
      if (targetMode === 'converter') {
        setRawLectureNote(merged);
      } else {
        setOutlineText(merged);
      }
    };
    const ok = await ctrl.start({
      locale: 'tr-TR',
      onStateChange: (l) => setIsDictating(l),
      onPartial: applyText,
      onFinal: (txt) => {
        applyText(txt);
        void hapticSuccess();
      },
      onError: (msg) => {
        setDictationError(msg);
        window.setTimeout(() => setDictationError(null), 3500);
      },
    });
    if (!ok) setIsDictating(false);
  };

  const liveParsedPreview = useMemo(() => {
    const trimmed = outlineText.trim();
    if (!trimmed) return null;
    return parseTextToMindMapOutline(trimmed, { density: analysisDepth });
  }, [outlineText, analysisDepth]);

  // Real-time Structure Converter Preview inside the Lecture Note Analyzer tab!
  const liveConvertedPreview = useMemo(() => {
    const trimmed = rawLectureNote.trim();
    if (!trimmed) return null;
    return convertLectureNoteToMindMapFormat(trimmed, { depth: analysisDepth });
  }, [rawLectureNote, analysisDepth]);

  const liveConvertedTree = useMemo(() => {
    if (!liveConvertedPreview?.formattedOutline) return null;
    return parseTextToMindMapOutline(liveConvertedPreview.formattedOutline, {
      density: analysisDepth,
    });
  }, [liveConvertedPreview, analysisDepth]);

  const liveDocumentOutline = useMemo(() => {
    if (!docResult?.extractedText) return null;
    return convertLectureNoteToMindMapFormat(docResult.extractedText, {
      depth: analysisDepth,
    });
  }, [docResult, analysisDepth]);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setAddedIds(new Set());
      setShowLivePreview(false);
      setConvertFeedback(null);
      setDictationError(null);
      setAiStatusNote(null);
      let cancelled = false;
      void fetchAiStatus().then((st) => {
        if (!cancelled) setAiStatus(st);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, initialTab]);

  const targetTitle = activeNode?.title || mapContext.parentTitle || mapContext.label;
  // Combine title + branch note (`activeNode.note`) so proactive sub-branches understand the description inside the branch box!
  const targetContextQuery = useMemo(() => {
    const notePart = activeNode?.note?.trim();
    if (!notePart) return targetTitle;
    return `${targetTitle} ${notePart.slice(0, 90)}`;
  }, [targetTitle, activeNode?.note]);

  const baseProactiveList = useMemo(() => {
    return TopicContextIntelligence.getProactiveSubBranches(
      targetContextQuery,
      mapContext,
      existingSiblingTitles
    );
  }, [targetContextQuery, mapContext, existingSiblingTitles]);

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

  const handleCloseClean = () => {
    void dismissNativeKeyboard();
    onClose();
  };

  const resetAllInputs = () => {
    setOutlineText('');
    setRawLectureNote('');
    setDocResult(null);
    setDocImages([]);
    setUseDocImages(true);
    setDocLoading(null);
    setDocError(null);
    setConvertFeedback(null);
    setShowLivePreview(false);
    setDeptHint('genel');
    setInputMode('outline');
    setDictationError(null);
    setAiOutlineCache(null);
    setAiStatusNote(null);
  };

  const handleDocumentFileSelected = async (file: File | null | undefined) => {
    if (!file) return;
    void hapticLight();
    setDocError(null);
    setDocLoading({ label: 'Belge hazırlanıyor...', pct: 5 });
    try {
      const res = await extractDocumentForMindMap(file, (label, pct) => {
        setDocLoading({ label, pct });
      });
      setDocResult(res);
      setDocImages(res.images);
      setUseDocImages(res.images.length > 0);
      void hapticSuccess();
    } catch (err) {
      setDocResult(null);
      setDocImages([]);
      setDocError(
        err instanceof Error ? err.message : 'Dosya okunamadı. Lütfen geçerli bir PDF, DOCX, PPTX veya TXT dosyası seçin.'
      );
    } finally {
      setDocLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleDocImageSelected = (imgId: string) => {
    void hapticLight();
    setDocImages((prev) =>
      prev.map((im) => (im.id === imgId ? { ...im, selected: !im.selected } : im))
    );
  };

  const toggleAiMode = (enabled: boolean) => {
    void hapticLight();
    setUseAiMode(enabled);
    saveAiModePreference(enabled);
    setAiStatusNote(null);
  };

  const resolveAiOrLocalOutline = async (
    rawSource: string,
    localFallbackOutline: string,
    cacheTag: string
  ): Promise<string> => {
    if (!useAiMode || !aiStatus?.available) {
      return localFallbackOutline;
    }
    const reqKey = `${cacheTag}|${analysisDepth}|${lang}|${rawSource.slice(0, 120)}|${rawSource.length}`;
    if (aiOutlineCache && aiOutlineCache.key === reqKey) {
      return aiOutlineCache.outline;
    }
    setIsAiStructuring(true);
    setAiStatusNote(null);
    try {
      const res = await requestAiStructuredOutline(rawSource, {
        depth: analysisDepth,
        lang: lang === 'en' ? 'en' : 'tr',
      });
      if (typeof res.dailyRemaining === 'number') {
        setAiStatus((prev) =>
          prev
            ? {
                ...prev,
                dailyRemaining: res.dailyRemaining!,
                dailyLimit: res.dailyLimit ?? prev.dailyLimit,
              }
            : prev
        );
      }
      if (res.usedAi && res.outline) {
        setAiOutlineCache({
          key: reqKey,
          outline: res.outline,
          cached: res.cached,
          provider: res.provider,
        });
        setAiStatusNote(
          res.cached
            ? t('⚡ Ücretsiz AI önbelleğinden anında hazırlandı (0 kota)', '⚡ Served instantly from Free AI cache (0 quota)')
            : t('✨ Ücretsiz AI ile ders kavramları ve formüller çıkarıldı', '✨ Concepts & formulas extracted with Free AI')
        );
        return res.outline;
      }
      if (res.fallbackReason === 'quota_exceeded') {
        setAiStatusNote(
          t('Günlük ücretsiz AI limiti doldu — yerel çevrimdışı motorla hazırlandı.', 'Daily free AI quota reached — built with on-device engine.')
        );
      }
      return localFallbackOutline;
    } finally {
      setIsAiStructuring(false);
    }
  };

  const handleConvertLectureNote = async (andCreateMap = false) => {
    const raw = rawLectureNote.trim();
    if (!raw) return;
    void hapticSuccess();
    const localRes = convertLectureNoteToMindMapFormat(raw, { depth: analysisDepth });
    const finalOutline = await resolveAiOrLocalOutline(raw, localRes.formattedOutline, 'conv');
    const finalParsed = parseTextToMindMapOutline(finalOutline, { density: analysisDepth });
    setOutlineText(finalOutline);
    setConvertFeedback({
      totalNodes: finalParsed.stats.totalNodes,
      mainBranches: finalParsed.stats.mainBranches,
      subBranches: finalParsed.stats.subBranches,
      notedBranches: finalParsed.stats.notedBranches,
      badgesCount: localRes.stats.badgesCount,
    });
    if (andCreateMap && finalOutline.trim()) {
      void executeGenerateFromText(finalOutline);
    } else {
      setInputMode('outline');
      setShowLivePreview(true);
      window.setTimeout(() => {
        outlineTextareaRef.current?.focus();
      }, 60);
    }
  };

  const executeGenerateFromText = async (
    sourceText: string,
    overrideImages?: ExtractedDocumentImage[]
  ) => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const input = sourceText.trim() || QUICK_SAMPLE_NOTES[0].text;
      const activeImages =
        overrideImages ?? (useDocImages ? docImages.filter((i) => i.selected) : []);
      const generatedDoc = await buildSmartMapFromOutlineText(input, deptHint, {
        density: analysisDepth,
        documentImages: activeImages,
      });
      void hapticSuccess();
      void dismissNativeKeyboard();
      // Always clear ALL input boxes & document state right after map creation so reopening starts completely clean!
      resetAllInputs();
      onGenerateCompleteMap(generatedDoc);
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateSmartMap = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeGenerateFromText(outlineText);
  };

  return (
    <div
      className="fixed top-0 right-0 left-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      style={{
        bottom: `${kb.keyboardHeight}px`,
        paddingTop: 'max(14px, calc(var(--safe-top) + 10px))',
      }}
      onClick={handleCloseClean}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: kb.isKeyboardOpen ? '6px' : 'max(16px, calc(var(--safe-bottom) + 12px))',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Wand2 className="h-4.5 w-4.5" />
            </div>
            <h2 className="truncate text-sm font-extrabold sm:text-base">
              {t('Akıllı Harita', 'Smart Mind Map')}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t('Kapat', 'Close')}
            onClick={handleCloseClean}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div
          className="flex shrink-0 gap-1.5 border-b px-4 py-2 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <button
            type="button"
            onClick={() => setTab('text_to_map')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
              tab === 'text_to_map'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'hover:bg-slate-500/10'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{t('Metinden Harita', 'Text / PDF to Map')}</span>
          </button>
          {activeNode && (
            <button
              type="button"
              onClick={() => setTab('proactive_branches')}
              className={`inline-flex min-h-[38px] min-w-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
                tab === 'proactive_branches'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'hover:bg-slate-500/10'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('Alt Dal Öner', 'Suggest Branches')}</span>
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {tab === 'text_to_map' ? (
            <div className="space-y-3.5">
              {/* Sub-mode Switcher: Structured Outline vs Lecture-Note Converter vs PDF/Document Importer */}
              <div
                className="grid grid-cols-3 gap-1 rounded-2xl border p-1"
                style={{
                  backgroundColor: 'var(--hud-bg)',
                  borderColor: 'var(--hud-border)',
                }}
              >
                <button
                  type="button"
                  data-testid="smart-map-mode-outline-btn"
                  onClick={() => {
                    void hapticLight();
                    setInputMode('outline');
                  }}
                  className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-colors sm:gap-1.5 sm:px-3 sm:text-xs ${
                    inputMode === 'outline'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t('Harita Formatı', 'Outline Format')}</span>
                </button>
                <button
                  type="button"
                  data-testid="smart-map-mode-converter-btn"
                  onClick={() => {
                    void hapticLight();
                    setInputMode('converter');
                  }}
                  className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-colors sm:gap-1.5 sm:px-3 sm:text-xs ${
                    inputMode === 'converter'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs'
                      : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t('Ders Notu Çevir', 'Convert Notes')}</span>
                </button>
                <button
                  type="button"
                  data-testid="smart-map-mode-document-btn"
                  onClick={() => {
                    void hapticLight();
                    setInputMode('document');
                  }}
                  className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-colors sm:gap-1.5 sm:px-3 sm:text-xs ${
                    inputMode === 'document'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                      : 'opacity-80 hover:bg-slate-500/10 hover:opacity-100'
                  }`}
                >
                  <FileUp className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t('PDF / Dosya', 'PDF / File')}</span>
                </button>
              </div>

              {/* Compact Free AI vs On-Device Engine Switcher (PDF & Lecture Note modes) */}
              {(inputMode === 'document' || inputMode === 'converter') && (
                <div
                  data-testid="smartmap-ai-engine-bar"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/25 bg-indigo-500/6 px-3 py-2 text-[11px]"
                >
                  <div className="flex min-w-0 items-center gap-1.5 font-extrabold">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span className="truncate">
                      {useAiMode && aiStatus?.available
                        ? t(
                            `Ücretsiz AI Aktif (${aiStatus.dailyRemaining}/${aiStatus.dailyLimit} günlük hak)`,
                            `Free AI Ready (${aiStatus.dailyRemaining}/${aiStatus.dailyLimit} left today)`
                          )
                        : useAiMode
                        ? t(
                            'Akıllı Hibrit Mod (AI + Yerel Formül Motoru)',
                            'Smart Hybrid Mode (AI + On-Device Formula Engine)'
                          )
                        : t(
                            'Sadece Cihaz İçi Mod (%100 Çevrimdışı)',
                            'On-Device Only Mode (100% Offline)'
                          )}
                    </span>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-indigo-500/25 bg-white/75 p-0.5 dark:bg-slate-900/70">
                    <button
                      type="button"
                      data-testid="ai-mode-enabled-btn"
                      onClick={() => toggleAiMode(true)}
                      className={`rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold transition ${
                        useAiMode
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      ✨ {t('Ücretsiz AI', 'Free AI')}
                    </button>
                    <button
                      type="button"
                      data-testid="ai-mode-offline-btn"
                      onClick={() => toggleAiMode(false)}
                      className={`rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold transition ${
                        !useAiMode
                          ? 'bg-slate-800 text-white shadow-2xs dark:bg-slate-200 dark:text-slate-900'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      🔒 {t('Cihaz İçi', 'On-Device')}
                    </button>
                  </div>
                </div>
              )}

              {aiStatusNote && (
                <div
                  data-testid="smartmap-ai-status-note"
                  className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-bold text-indigo-800 dark:text-indigo-200"
                >
                  {aiStatusNote}
                </div>
              )}

              {inputMode === 'document' ? (
                <div className="space-y-3" data-testid="document-import-panel">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-3 text-xs leading-relaxed font-semibold">
                    <span className="min-w-0 flex-1">
                      <strong>PDF, Word (.docx), PowerPoint (.pptx) {t('veya', 'or')} TXT/MD</strong>{' '}
                      {t(
                        'dosyanı seç — uygulama metni az dallı akıcı bir zihin haritasına özetler ve belgedeki şema/fotoğrafları ilgili dallara otomatik yerleştirir.',
                        '— extracts a clean low-branch mind map offline and places real diagrams/photos directly onto matching branches.'
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-500/25 bg-white/70 p-0.5 dark:bg-slate-900/60">
                      {(
                        [
                          { id: 'compact', label: t('Az Dal', 'Compact') },
                          { id: 'balanced', label: t('Dengeli', 'Balanced') },
                          { id: 'detailed', label: t('Detaylı', 'Detailed') },
                        ] as Array<{ id: LectureNoteDepth; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`doc-depth-${opt.id}`}
                          onClick={() => {
                            void hapticLight();
                            setAnalysisDepth(opt.id);
                          }}
                          className={`rounded-lg px-2 py-1 text-[11px] font-extrabold transition ${
                            analysisDepth === opt.id
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hidden Native/Web Document Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    data-testid="document-file-input"
                    accept=".pdf,.docx,.pptx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown"
                    onChange={(e) => void handleDocumentFileSelected(e.target.files?.[0])}
                    className="hidden"
                  />

                  {/* Dropzone / File Picker Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid="document-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      const f = e.dataTransfer?.files?.[0];
                      void handleDocumentFileSelected(f);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                      isDraggingFile
                        ? 'border-emerald-500 bg-emerald-500/12'
                        : 'border-slate-400/35 hover:border-emerald-500/70 hover:bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                      {docLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <FileUp className="h-6 w-6" />
                      )}
                    </div>
                    <div className="mt-2.5 text-sm font-extrabold">
                      {docLoading
                        ? docLoading.label
                        : docResult
                        ? `${docResult.fileName} (${docResult.pageCount} ${t('sayfa', 'pages')})`
                        : t('PDF, Word, PowerPoint veya TXT Dosyası Seç', 'Select PDF, Word, PowerPoint, or TXT File')}
                    </div>
                    <p className="mt-1 text-[11px] font-semibold opacity-70">
                      {docLoading
                        ? t(
                            `%${docLoading.pct} tamamlandı • Tüm işlem cihazında çevrimdışı yapılır`,
                            `${docLoading.pct}% complete • Processed 100% offline on your device`
                          )
                        : t(
                            'Sürükleyip bırak veya dokunarak seç (Maks. 20 MB • %100 cihaz içi gizli işleme)',
                            'Drag & drop or tap to browse (Max 20 MB • 100% private on-device processing)'
                          )}
                    </p>
                    {docLoading && (
                      <div className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-500/15">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                          style={{ width: `${Math.max(8, docLoading.pct)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {docError && (
                    <div
                      data-testid="document-error-banner"
                      className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-700 dark:text-rose-300"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{docError}</span>
                    </div>
                  )}

                  {docResult && (
                    <div className="space-y-3" data-testid="document-extracted-summary">
                      {docResult.warnings.length > 0 && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                          {docResult.warnings.join(' ')}
                        </div>
                      )}

                      {/* Extracted PDF / Slide Photos Selection Strip */}
                      {docImages.length > 0 && (
                        <div
                          data-testid="document-extracted-images"
                          className="space-y-2 rounded-2xl border border-sky-500/30 bg-sky-500/6 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-extrabold">
                              <ImageIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                              <span>
                                {t(
                                  `Belgeden ${docImages.length} Görsel Çıkarıldı (${docImages.filter((i) => i.selected).length} seçili)`,
                                  `${docImages.length} Images Extracted (${docImages.filter((i) => i.selected).length} selected)`
                                )}
                              </span>
                            </div>
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-extrabold">
                              <input
                                type="checkbox"
                                checked={useDocImages}
                                onChange={(e) => setUseDocImages(e.target.checked)}
                                className="h-4 w-4 rounded accent-sky-600"
                              />
                              <span>{t('Dallara görsel olarak ekle', 'Attach images to branches')}</span>
                            </label>
                          </div>
                          <p className="text-[11px] font-medium opacity-75">
                            {t(
                              'Seçili PDF/slayt görselleri en ilgili kavram dallarına ikon yerine yerleştirilir; diğer dallar otomatik ikon alır. İstemezseniz görsele dokunup kaldırabilirsiniz.',
                              'Selected figures are placed directly onto the closest matching branch instead of a generic icon; other branches receive vector icons automatically.'
                            )}
                          </p>
                          <div className="no-scrollbar flex gap-2 overflow-x-auto pt-1 pb-0.5">
                            {docImages.map((img) => (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => toggleDocImageSelected(img.id)}
                                title={img.nearbyHeading}
                                className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition ${
                                  useDocImages && img.selected
                                    ? 'border-sky-500 shadow-xs'
                                    : 'border-slate-300 opacity-45 grayscale'
                                }`}
                              >
                                <img
                                  src={img.dataUrl}
                                  alt={img.nearbyHeading}
                                  className="h-full w-full object-contain p-0.5"
                                />
                                <span className="absolute right-0.5 bottom-0.5 rounded bg-slate-900/80 px-1 py-0.2 text-[9px] font-black text-white">
                                  {t('S.', 'P.')}{img.pageIndex}
                                </span>
                                {useDocImages && img.selected && (
                                  <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Compact Branch Preview */}
                      {liveDocumentOutline && liveDocumentOutline.formattedOutline && (
                        <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/6 p-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                            <span className="rounded-lg bg-emerald-500/18 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                              ⚡ {liveDocumentOutline.stats.totalNodes} {t('Dal (Akıcı Özet)', 'Nodes (Compact)')}
                            </span>
                            <span className="rounded-lg bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                              🌿 {liveDocumentOutline.stats.mainBranches} {t('Ana Dal', 'Main')}
                            </span>
                            <span className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300">
                              📝 {liveDocumentOutline.stats.notedBranches} {t('Detaylı Not', 'Notes')}
                            </span>
                          </div>
                          <pre
                            data-testid="document-outline-preview"
                            className="max-h-44 overflow-y-auto rounded-xl border bg-white/85 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap dark:bg-slate-950/65"
                            style={{ borderColor: 'var(--hud-border)' }}
                          >
                            {liveDocumentOutline.formattedOutline}
                          </pre>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isGenerating || isAiStructuring || !liveDocumentOutline?.formattedOutline}
                          onClick={() => {
                            void (async () => {
                              if (!docResult?.extractedText || !liveDocumentOutline?.formattedOutline) return;
                              const finalOutline = await resolveAiOrLocalOutline(
                                docResult.extractedText,
                                liveDocumentOutline.formattedOutline,
                                `doc:${docResult.fileName}`
                              );
                              const finalParsed = parseTextToMindMapOutline(finalOutline, {
                                density: analysisDepth,
                              });
                              setOutlineText(finalOutline);
                              setConvertFeedback({
                                totalNodes: finalParsed.stats.totalNodes,
                                mainBranches: finalParsed.stats.mainBranches,
                                subBranches: finalParsed.stats.subBranches,
                                notedBranches: finalParsed.stats.notedBranches,
                                badgesCount: liveDocumentOutline.stats.badgesCount,
                              });
                              setInputMode('outline');
                              setShowLivePreview(true);
                            })();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-200"
                        >
                          <ArrowRight className="h-4 w-4" />
                          <span>{t('Formatı Düzenle', 'Edit Outline')}</span>
                        </button>
                        <button
                          type="button"
                          data-testid="document-create-map-btn"
                          disabled={isGenerating || isAiStructuring || !liveDocumentOutline?.formattedOutline}
                          onClick={() => {
                            void (async () => {
                              if (!docResult?.extractedText || !liveDocumentOutline?.formattedOutline) return;
                              const finalOutline = await resolveAiOrLocalOutline(
                                docResult.extractedText,
                                liveDocumentOutline.formattedOutline,
                                `doc:${docResult.fileName}`
                              );
                              await executeGenerateFromText(
                                finalOutline,
                                useDocImages ? docImages.filter((i) => i.selected) : []
                              );
                            })();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform active:scale-95 disabled:opacity-50"
                        >
                          {isGenerating || isAiStructuring ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                          <span>
                            {isAiStructuring
                              ? t('✨ AI ile Özetleniyor...', '✨ Summarizing with AI...')
                              : isGenerating
                              ? t('Görsel Harita Hazırlanıyor...', 'Building Visual Map...')
                              : useAiMode && aiStatus?.available
                              ? t('✨ AI ile Görsel Harita Oluştur', '✨ Create Mind Map with AI')
                              : t('Belgeden Görsel Harita Oluştur', 'Create Mind Map from File')}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : inputMode === 'converter' ? (
                <div className="space-y-3" data-testid="lecture-note-converter-panel">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/8 p-3 text-xs leading-relaxed font-semibold">
                    <span className="min-w-0 flex-1">
                      {t(
                        'Ham ders notunu, PDF paragrafını veya slayt metnini yapıştır — uygulama analiz edip otomatik olarak Merkezi Konu / Ana Dal / Not yapısına çevirir.',
                        'Paste raw lecture notes, paragraphs, or slides — we analyze them offline into a clean Central Topic / Branch / Note outline.'
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-violet-500/25 bg-white/60 p-0.5 dark:bg-slate-900/60">
                      {(
                        [
                          { id: 'compact', label: t('Özet', 'Compact') },
                          { id: 'balanced', label: t('Dengeli', 'Balanced') },
                          { id: 'detailed', label: t('Detaylı', 'Detailed') },
                        ] as Array<{ id: LectureNoteDepth; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`lecture-depth-${opt.id}`}
                          onClick={() => {
                            void hapticLight();
                            setAnalysisDepth(opt.id);
                          }}
                          className={`rounded-lg px-2 py-1 text-[11px] font-extrabold transition ${
                            analysisDepth === opt.id
                              ? 'bg-violet-600 text-white shadow-2xs'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                      <label className="block text-xs font-extrabold opacity-80">
                        Ham Ders Notu / Paragraf:
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="lecture-note-sample-btn"
                          onClick={() => {
                            void hapticLight();
                            setRawLectureNote(SAMPLE_RAW_LECTURE_NOTE);
                            setDeptHint('tip');
                          }}
                          className="rounded-xl bg-violet-500/12 px-2.5 py-1 text-[11px] font-extrabold text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                        >
                          🧬 Biyoloji Örneği
                        </button>
                        <button
                          type="button"
                          data-testid="lecture-note-network-sample-btn"
                          onClick={() => {
                            void hapticLight();
                            setRawLectureNote(SAMPLE_RAW_NETWORK_NOTE);
                            setDeptHint('sistem_tasarimi');
                          }}
                          className="rounded-xl bg-sky-500/12 px-2.5 py-1 text-[11px] font-extrabold text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                        >
                          🖧 TCP/IP Örneği
                        </button>
                        {isDictationSupported() && (
                          <button
                            type="button"
                            data-testid="lecture-note-dictate-btn"
                            onClick={() => void toggleOutlineDictation()}
                            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-extrabold active:scale-95 ${
                              isDictating
                                ? 'animate-pulse bg-rose-500 text-white'
                                : 'bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                            }`}
                          >
                            {isDictating ? (
                              <>
                                <MicOff className="h-3 w-3" />
                                <span>Durdur</span>
                              </>
                            ) : (
                              <>
                                <Mic className="h-3 w-3" />
                                <span>Sesle Anlat</span>
                              </>
                            )}
                          </button>
                        )}
                        {rawLectureNote.trim().length > 0 && (
                          <button
                            type="button"
                            data-testid="lecture-note-clear-btn"
                            onClick={() => {
                              void hapticLight();
                              setRawLectureNote('');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-500/12 px-2.5 py-1 text-[11px] font-extrabold text-rose-600 hover:bg-rose-500/20 dark:text-rose-300"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Temizle</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {dictationError && (
                      <div className="mb-1.5 rounded-xl bg-rose-500/12 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                        {dictationError}
                      </div>
                    )}

                    <textarea
                      rows={kb.isKeyboardOpen ? 4 : 6}
                      value={rawLectureNote}
                      onChange={(e) => setRawLectureNote(e.target.value)}
                      data-testid="lecture-note-raw-input"
                      placeholder={`Dağınık ders notunu, kitap paragrafını veya slayt metnini buraya yapıştır...\nÖrnek: TCP/IP modeli 4 katmandan oluşur. Uygulama katmanı HTTP ve DNS protokollerini barındırır (Port 443).`}
                      className="allow-text-input w-full rounded-2xl border bg-transparent p-3.5 text-sm leading-relaxed font-semibold outline-none focus:ring-2 focus:ring-violet-500 sm:text-base"
                      style={{ borderColor: 'var(--hud-border)' }}
                    />
                  </div>

                  {/* Live Photo-6 Formatted Structure Output Box! */}
                  {liveConvertedPreview && liveConvertedPreview.formattedOutline && (
                    <div
                      data-testid="lecture-note-live-output"
                      className="space-y-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/6 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                          <span className="rounded-lg bg-emerald-500/18 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                            ✓ Harita Yapısına Dönüştürüldü
                          </span>
                          <span className="rounded-lg bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                            {liveConvertedPreview.stats.mainBranches} Ana Dal
                          </span>
                          <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-indigo-700 dark:text-indigo-300">
                            {liveConvertedPreview.stats.subBranches} Alt Kavram
                          </span>
                          {liveConvertedPreview.stats.notedBranches > 0 && (
                            <span className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300">
                              📝 {liveConvertedPreview.stats.notedBranches} Açıklama
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="inline-flex items-center rounded-xl border border-slate-500/20 bg-white/70 p-0.5 dark:bg-slate-900/70">
                            <button
                              type="button"
                              data-testid="lecture-preview-text-btn"
                              onClick={() => {
                                void hapticLight();
                                setConverterPreviewMode('text');
                              }}
                              className={`rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold transition ${
                                converterPreviewMode === 'text'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                            >
                              Format
                            </button>
                            <button
                              type="button"
                              data-testid="lecture-preview-tree-btn"
                              onClick={() => {
                                void hapticLight();
                                setConverterPreviewMode('tree');
                              }}
                              className={`rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold transition ${
                                converterPreviewMode === 'tree'
                                  ? 'bg-violet-600 text-white shadow-2xs'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                            >
                              Ağaç
                            </button>
                          </div>
                          <button
                            type="button"
                            data-testid="lecture-note-copy-btn"
                            onClick={() => {
                              void hapticLight();
                              void navigator.clipboard?.writeText(liveConvertedPreview.formattedOutline);
                              setCopiedConverted(true);
                              window.setTimeout(() => setCopiedConverted(false), 1800);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-500/12 px-2.5 py-1 text-[11px] font-extrabold hover:bg-slate-500/20"
                          >
                            {copiedConverted ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span>Kopyalandı</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Kopyala</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      {converterPreviewMode === 'tree' && liveConvertedTree ? (
                        <div
                          data-testid="lecture-note-tree-preview"
                          className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border bg-white/85 p-2.5 text-xs dark:bg-slate-950/70"
                          style={{ borderColor: 'var(--hud-border)' }}
                        >
                          {liveConvertedTree.nodes.slice(0, 48).map((n) => (
                            <div
                              key={n.id}
                              style={{
                                marginLeft: `${Math.min(n.level, 3) * 14}px`,
                                borderLeftColor: n.level === 0 ? '#0EA5E9' : n.branchColor,
                              }}
                              className={`rounded-r-lg border-l-[3px] py-0.5 pl-2.5 ${
                                n.level === 0
                                  ? 'bg-sky-500/10 py-1 font-black'
                                  : n.level === 1
                                  ? 'bg-slate-500/6 font-extrabold'
                                  : 'font-bold'
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span>{n.title}</span>
                                {n.techBadge && (
                                  <span
                                    className="rounded-md px-1.5 py-0.2 font-mono text-[9.5px] font-bold"
                                    style={{
                                      backgroundColor: `${n.branchColor}22`,
                                      color: n.branchColor,
                                    }}
                                  >
                                    {n.techBadge}
                                  </span>
                                )}
                              </div>
                              {n.note && (
                                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug font-medium opacity-75">
                                  {n.note}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre
                          data-testid="lecture-note-formatted-preview"
                          className="max-h-52 overflow-y-auto rounded-xl border bg-white/80 p-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap dark:bg-slate-950/65"
                          style={{ borderColor: 'var(--hud-border)' }}
                        >
                          {liveConvertedPreview.formattedOutline}
                        </pre>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="convert-lecture-note-btn"
                      disabled={!rawLectureNote.trim() || isGenerating || isAiStructuring}
                      onClick={() => void handleConvertLectureNote(false)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/12 px-4 py-2.5 text-xs font-extrabold text-violet-700 transition-transform hover:bg-violet-500/20 active:scale-95 disabled:opacity-45 dark:text-violet-200"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>{t('Harita Formatında Düzenle', 'Edit in Outline View')}</span>
                    </button>
                    <button
                      type="button"
                      data-testid="convert-and-create-map-btn"
                      disabled={!rawLectureNote.trim() || isGenerating || isAiStructuring}
                      onClick={() => void handleConvertLectureNote(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform active:scale-95 disabled:opacity-45"
                    >
                      {isGenerating || isAiStructuring ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      <span>
                        {isAiStructuring
                          ? t('✨ AI ile Özetleniyor...', '✨ Summarizing with AI...')
                          : isGenerating
                          ? t('Harita Oluşturuluyor...', 'Building Map...')
                          : useAiMode && aiStatus?.available
                          ? t('✨ AI ile Harita Oluştur', '✨ Generate with Free AI')
                          : t('Bu Yapıdan Harita Oluştur', 'Generate Mind Map')}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateSmartMap} className="space-y-3.5">
                  {convertFeedback && (
                    <div
                      data-testid="lecture-note-converted-banner"
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-200"
                    >
                      <span>
                        ✓ Ders notu harita formatına çevrildi: {convertFeedback.mainBranches} ana dal,{' '}
                        {convertFeedback.subBranches} alt kavram
                        {convertFeedback.badgesCount > 0 ? `, ${convertFeedback.badgesCount} rozet` : ''}.
                      </span>
                      <button
                        type="button"
                        onClick={() => setInputMode('converter')}
                        className="underline opacity-85 hover:opacity-100"
                      >
                        Ham nota dön
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold opacity-75">
                        Hızlı Örnekler &amp; Dal Yoğunluğu:
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-sky-500/25 bg-white/60 p-0.5 dark:bg-slate-900/60">
                        {(
                          [
                            { id: 'compact', label: 'Az Dal' },
                            { id: 'balanced', label: 'Dengeli' },
                            { id: 'detailed', label: 'Detaylı' },
                          ] as Array<{ id: LectureNoteDepth; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            data-testid={`outline-depth-${opt.id}`}
                            onClick={() => {
                              void hapticLight();
                              setAnalysisDepth(opt.id);
                            }}
                            className={`rounded-lg px-2 py-0.5 text-[10.5px] font-extrabold transition ${
                              analysisDepth === opt.id
                                ? 'bg-sky-500 text-white shadow-2xs'
                                : 'opacity-75 hover:opacity-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap">
                      {QUICK_SAMPLE_NOTES.map((sample) => (
                        <button
                          key={sample.label}
                          type="button"
                          onClick={() => {
                            setOutlineText(sample.text);
                            setDeptHint(sample.dept);
                            setConvertFeedback(null);
                          }}
                          className="shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-300"
                          style={{ borderColor: 'var(--hud-border)' }}
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="block text-xs font-extrabold opacity-75">
                        Harita Formatı (Konu, Dal ve Açıklamalar):
                      </label>
                      <div className="flex items-center gap-1.5">
                        {outlineText.trim().length > 0 && (
                          <button
                            type="button"
                            data-testid="smart-map-clear-btn"
                            onClick={() => {
                              void hapticLight();
                              setOutlineText('');
                              setConvertFeedback(null);
                              setShowLivePreview(false);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-500/12 px-2.5 py-1 text-[11px] font-extrabold text-rose-600 hover:bg-rose-500/20 dark:text-rose-300"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Temizle</span>
                          </button>
                        )}
                        {isDictationSupported() && (
                          <button
                            type="button"
                            data-testid="smart-map-dictate-btn"
                            onClick={() => void toggleOutlineDictation()}
                            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-extrabold active:scale-95 ${
                              isDictating
                                ? 'animate-pulse bg-rose-500 text-white'
                                : 'bg-sky-500/12 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300'
                            }`}
                          >
                            {isDictating ? (
                              <>
                                <MicOff className="h-3.5 w-3.5" />
                                <span>Durdur</span>
                              </>
                            ) : (
                              <>
                                <Mic className="h-3.5 w-3.5" />
                                <span>Sesle Anlat</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {dictationError && (
                      <div className="mb-1.5 rounded-xl bg-rose-500/12 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                        {dictationError}
                      </div>
                    )}
                    <textarea
                      ref={outlineTextareaRef}
                      rows={kb.isKeyboardOpen ? 4 : 8}
                      value={outlineText}
                      onChange={(e) => setOutlineText(e.target.value)}
                      data-testid="smart-map-outline-textarea"
                      placeholder={`Paragraf, başlık (# / 1.1) veya açıklamalı liste yazabilirsiniz. Düz ders notunuz varsa yukarıdaki "Ders Notunu Formata Çevir" sekmesini kullanın:\n\nMerkezi Konu\n- Ana Dal: Bu kısım dalın açıklama kutucuğuna otomatik eklenir [Rozet]\n  - Alt Kavram: Kısa tanım veya örnek\n    Not: Ekstra notlar da üst dalın açıklamasına eklenir`}
                      className="allow-text-input w-full rounded-2xl border bg-transparent p-3.5 text-base leading-relaxed font-semibold outline-none focus:ring-2 focus:ring-sky-500"
                      style={{ borderColor: 'var(--hud-border)' }}
                    />
                  </div>

                  {/* Live Smart Structure & Note Detection Bar */}
                  {liveParsedPreview && (
                    <div
                      data-testid="smart-map-live-preview"
                      className="rounded-2xl border p-2.5"
                      style={{
                        backgroundColor: 'var(--hud-bg)',
                        borderColor: 'var(--hud-border)',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                          <span className="rounded-lg bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                            🧠 {liveParsedPreview.stats.totalNodes} Dal
                          </span>
                          {liveParsedPreview.stats.mainBranches > 0 && (
                            <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                              🌿 {liveParsedPreview.stats.mainBranches} Ana Dal
                            </span>
                          )}
                          {liveParsedPreview.stats.subBranches > 0 && (
                            <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-indigo-700 dark:text-indigo-300">
                              📌 {liveParsedPreview.stats.subBranches} Alt Dal
                            </span>
                          )}
                          {liveParsedPreview.stats.notedBranches > 0 && (
                            <span
                              data-testid="smart-map-noted-count"
                              className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300"
                            >
                              📝 {liveParsedPreview.stats.notedBranches} Açıklamalı Kart
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLivePreview((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-1 text-[11px] font-extrabold opacity-80 hover:opacity-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{showLivePreview ? 'Gizle' : 'Önizle'}</span>
                        </button>
                      </div>

                      {showLivePreview && (
                        <div
                          className="mt-2 max-h-40 space-y-1 overflow-y-auto border-t pt-2 text-xs"
                          style={{ borderColor: 'var(--hud-border)' }}
                        >
                          {liveParsedPreview.nodes.slice(0, 18).map((n) => (
                            <div
                              key={n.id}
                              style={{ paddingLeft: `${Math.min(n.level, 3) * 14}px` }}
                              className="flex flex-col gap-0.5"
                            >
                              <div className="flex items-center gap-1.5 font-extrabold">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: n.branchColor }}
                                />
                                <span className="truncate">{n.title}</span>
                                {n.techBadge && (
                                  <span className="rounded bg-sky-500/15 px-1 text-[10px] text-sky-600 dark:text-sky-300">
                                    {n.techBadge}
                                  </span>
                                )}
                              </div>
                              {n.note && (
                                <p className="line-clamp-2 pl-3.5 text-[11px] font-medium opacity-75">
                                  📝 {n.note}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseClean}
                      className="rounded-xl px-4 py-2.5 text-xs font-bold hover:bg-slate-500/10"
                    >
                      {t('Vazgeç', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      data-testid="smart-map-submit-btn"
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      <span>
                        {isGenerating
                          ? t('İkonlar Eşleştiriliyor...', 'Matching Icons...')
                          : t('Görsel Haritayı Oluştur', 'Generate Visual Mind Map')}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
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
