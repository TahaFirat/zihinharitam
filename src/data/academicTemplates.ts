import {
  BRANCH_PALETTE,
  type AcademicDepartment,
  type MindMapDocument,
  type StickerAsset,
} from '../types/mindmap';
import { TopicContextIntelligence } from '../core/visuals/TopicContextIntelligence';
import {
  getBuiltInDiagramSticker,
  getBuiltInIllustrationSticker,
} from '../core/visuals/providers/AcademicStickerArtwork';
import {
  BUILT_IN_MULTI_COLOR_ATLAS,
  getAtlasStickerById,
  searchBuiltInAtlasV3,
} from '../core/visuals/providers/BuiltInMultiColorAtlas';
import {
  getPackStickerById,
  SYSTEM_DESIGN_AND_ATLAS_PACK,
} from '../core/visuals/providers/SystemDesignVisualPack';

function packSticker(id: string, packId: string, label: string): StickerAsset {
  const found =
    getAtlasStickerById(packId) ??
    getPackStickerById(packId) ??
    SYSTEM_DESIGN_AND_ATLAS_PACK[0];
  return {
    id,
    url: found.svgDataUri,
    mode: 'illustration',
    source: 'library',
    dieCutProcessed: true,
    aspectRatio: 1,
    label,
    isVectorSvg: true,
  };
}

function illSticker(id: string, key: string, label: string): StickerAsset {
  return {
    id,
    url: getBuiltInIllustrationSticker(key),
    mode: 'illustration',
    source: 'library',
    dieCutProcessed: true,
    aspectRatio: 1,
    label,
    isVectorSvg: true,
  };
}

function diagSticker(id: string, key: string, label: string): StickerAsset {
  return {
    id,
    url: getBuiltInDiagramSticker(key),
    mode: 'diagram',
    source: 'library',
    dieCutProcessed: true,
    aspectRatio: 1,
    label,
    isVectorSvg: true,
  };
}

export function resolveStarterStickerForConcept(
  title: string,
  department: AcademicDepartment = 'genel'
): StickerAsset {
  const dummyNodes = {
    root: {
      id: 'root',
      parentId: null,
      title,
      x: 0,
      y: 0,
      branchColor: BRANCH_PALETTE[0],
      collapsed: false,
    },
  };
  const ctx = TopicContextIntelligence.analyzeMapContext(
    dummyNodes,
    'root',
    'root',
    department
  );
  const atlasHits = searchBuiltInAtlasV3(title, ctx.discipline, 3);
  const firstPack =
    atlasHits[0]?.entry ??
    BUILT_IN_MULTI_COLOR_ATLAS.find((p) => p.discipline === ctx.discipline) ??
    BUILT_IN_MULTI_COLOR_ATLAS[0];

  return {
    id: `starter_${firstPack.id}_${Date.now()}`,
    url: firstPack.svgDataUri,
    mode: firstPack.category === 'diagram' ? 'diagram' : 'illustration',
    source: 'library',
    dieCutProcessed: true,
    aspectRatio: 1,
    label: firstPack.titleTr,
    isVectorSvg: true,
  };
}

function stampTemplateNodeFlags(doc: MindMapDocument): MindMapDocument {
  for (const node of Object.values(doc.nodes)) {
    if (node.subtitle) {
      node.subtitleIsTemplateDefault = true;
    }
  }
  return doc;
}

export interface TemplateDescriptor {
  id: string;
  badge: string;
  department: AcademicDepartment;
  title: string;
  description: string;
  accentColor: string;
  build: () => MindMapDocument;
}

export function createBlankMindMap(
  customTitle = 'Merkezi Konu',
  department: AcademicDepartment = 'genel'
): MindMapDocument {
  const now = Date.now();
  const mapId = `map_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const rootId = 'root';

  return {
    id: mapId,
    title: customTitle,
    department,
    rootNodeId: rootId,
    crossLinks: [],
    createdAt: now,
    updatedAt: now,
    nodes: {
      [rootId]: {
        id: rootId,
        parentId: null,
        title: customTitle,
        subtitle: 'Dal eklemek için + tutamacını sürükleyin',
        subtitleIsTemplateDefault: true,
        x: 0,
        y: 0,
        branchColor: BRANCH_PALETTE[0],
        collapsed: false,
        sticker: resolveStarterStickerForConcept(customTitle, department),
      },
    },
  };
}

const RAW_ACADEMIC_TEMPLATES: TemplateDescriptor[] = [
  // =========================================================================
  // 1. SİSTEM TASARIMI & BULUT MİMARİSİ (`systemdesign.io` Flagship)
  // =========================================================================
  {
    id: 'tpl_sistem_tasarimi',
    badge: '🖧 Sistem Tasarımı',
    department: 'sistem_tasarimi',
    title: 'Dağıtık Sistem Mimarisi (System Design)',
    description:
      'Load Balancer, API Gateway, Redis Önbellek, Veritabanı Sharding, Kafka Olay Kuyruğu ve canlı veri akış okları.',
    accentColor: '#0EA5E9',
    build: () => {
      const now = Date.now();
      return {
        id: 'tpl_sistem_tasarimi',
        title: 'Dağıtık Sistem Mimarisi (System Design)',
        department: 'sistem_tasarimi',
        rootNodeId: 'root',
        createdAt: now,
        updatedAt: now,
        crossLinks: [
          {
            id: 'cl_sd_1',
            fromNodeId: 's_redis',
            toNodeId: 's_shard',
            label: 'Cache Miss → Read-Through',
            color: '#F59E0B',
            style: 'dashed_flow',
          },
          {
            id: 'cl_sd_2',
            fromNodeId: 's_gw',
            toNodeId: 's_kafka',
            label: 'Asenkron Olay Yayını',
            color: '#8B5CF6',
            style: 'dashed_flow',
          },
        ],
        nodes: {
          root: {
            id: 'root',
            parentId: null,
            title: 'Dağıtık Bulut & Sistem Mimarisi',
            subtitle: 'Yüksek Erişilebilirlik • Ölçeklenebilir Altyapı',
            techBadge: '99.99% SLA • Multi-AZ',
            x: 0,
            y: 0,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('st_sd_root', 'sd_vpc_cloud', 'Dağıtık Bulut Kümesi'),
          },
          s_lb: {
            id: 's_lb',
            parentId: 'root',
            title: 'Yük Dengeleyici (Load Balancer)',
            subtitle: 'Trafik Dağıtımı & Sağlık Kontrolü',
            techBadge: 'Port 443 • L7 Round-Robin',
            x: 350,
            y: -205,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('st_sd_lb', 'sd_load_balancer', 'Load Balancer'),
          },
          s_cdn: {
            id: 's_cdn',
            parentId: 's_lb',
            title: 'CDN Kenar Ağı & WAF Kalkanı',
            techBadge: 'Edge PoP • DDoS Koruma',
            x: 680,
            y: -335,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('st_sd_cdn', 'sd_cdn_edge', 'CDN Edge'),
          },
          s_gw: {
            id: 's_gw',
            parentId: 's_lb',
            title: 'API Gateway & Rate Limiter',
            techBadge: 'OAuth2 JWT • Token Bucket',
            x: 680,
            y: -105,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('st_sd_gw', 'sd_api_gateway', 'API Gateway'),
          },
          s_data: {
            id: 's_data',
            parentId: 'root',
            title: 'Veri Katmanı & Önbellekleme',
            subtitle: 'Düşük Gecikme + Yatay Bölümleme',
            techBadge: 'Sub-ms Okuma • ACID',
            x: 350,
            y: 205,
            branchColor: '#10B981',
            collapsed: false,
            sticker: packSticker('st_sd_sql', 'sd_sql_primary', 'Birincil Veritabanı'),
          },
          s_redis: {
            id: 's_redis',
            parentId: 's_data',
            title: 'Redis Bellek İçi Önbellek',
            techBadge: '< 1ms Cache Hit • LRU',
            x: 680,
            y: 120,
            branchColor: '#10B981',
            collapsed: false,
            sticker: packSticker('st_sd_redis', 'sd_redis_cache', 'Redis Önbellek'),
          },
          s_shard: {
            id: 's_shard',
            parentId: 's_data',
            title: 'Veritabanı Sharding Kümesi',
            techBadge: 'Consistent Hashing • O(1)',
            x: 680,
            y: 350,
            branchColor: '#10B981',
            collapsed: false,
            sticker: packSticker('st_sd_shard', 'sd_db_sharding', 'DB Sharding'),
          },
          s_async: {
            id: 's_async',
            parentId: 'root',
            title: 'Asenkron Mesajlaşma & İşçiler',
            subtitle: 'Gevşek Bağlı Olay Mimarisi',
            techBadge: 'Event-Driven • Pub/Sub',
            x: -350,
            y: -200,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: packSticker('st_sd_ms', 'sd_microservice', 'Mikroservis'),
          },
          s_kafka: {
            id: 's_kafka',
            parentId: 's_async',
            title: 'Kafka Olay Kuyruğu (Event Stream)',
            techBadge: '1M+ msg/sn • Partitioned',
            x: -680,
            y: -330,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: packSticker('st_sd_kafka', 'sd_kafka_queue', 'Kafka Kuyruk'),
          },
          s_k8s: {
            id: 's_k8s',
            parentId: 's_async',
            title: 'Kubernetes & Otomatik Ölçekleme',
            techBadge: 'HPA • Container Pods',
            x: -680,
            y: -95,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: packSticker('st_sd_k8s', 'sd_kubernetes', 'Kubernetes'),
          },
          s_obs: {
            id: 's_obs',
            parentId: 'root',
            title: 'Gözlemlenebilirlik & Hata Toleransı',
            subtitle: 'Metrik, İzleme ve Devre Kesici',
            techBadge: 'Prometheus • OpenTelemetry',
            x: -350,
            y: 205,
            branchColor: '#F59E0B',
            collapsed: false,
            sticker: packSticker('st_sd_obs', 'sd_observability', 'Gözlemlenebilirlik'),
          },
          s_cb: {
            id: 's_cb',
            parentId: 's_obs',
            title: 'Devre Kesici (Circuit Breaker)',
            techBadge: 'Failover & Graceful Retry',
            x: -680,
            y: 205,
            branchColor: '#F59E0B',
            collapsed: false,
            sticker: packSticker('st_sd_cb', 'sd_circuit_breaker', 'Devre Kesici'),
          },
        },
      };
    },
  },

  // =========================================================================
  // 2. TIP FAKÜLTESİ — Kalp Anatomisi & Mitral Kapak Fizyopatolojisi
  // =========================================================================
  {
    id: 'tpl_tip_kardiyoloji',
    badge: '🩺 Tıp Fakültesi',
    department: 'tip',
    title: 'Kalp Kapakları & Mitral Kapak',
    description:
      'Sol kalp odacıkları, mitral kapak anatomisi, oskültasyon bulguları ve pulmoner hemodinami.',
    accentColor: '#F43F5E',
    build: () => {
      const now = Date.now();
      return {
        id: 'tpl_tip_kardiyoloji',
        title: 'Kalp Kapakları & Mitral Kapak',
        department: 'tip',
        rootNodeId: 'root',
        createdAt: now,
        updatedAt: now,
        crossLinks: [
          {
            id: 'cl_med_1',
            fromNodeId: 'm1',
            toNodeId: 'm3',
            label: 'Darlıkta Sol Atriyal Basınç Artışı',
            color: '#F43F5E',
            style: 'dashed_flow',
          },
        ],
        nodes: {
          root: {
            id: 'root',
            parentId: null,
            title: 'Kardiyak Kapaklar & Mitral Sistem',
            subtitle: 'Kardiyoloji Ders Özeti',
            techBadge: 'Diyastolik Dolum • S1/S2',
            x: 0,
            y: 0,
            branchColor: '#F43F5E',
            collapsed: false,
            sticker: packSticker('s_root_heart', 'med_heart_mitral', 'Kalp & Mitral Kapak'),
          },
          m1: {
            id: 'm1',
            parentId: 'root',
            title: 'Mitral Kapak Anatomisi',
            subtitle: 'Sol Atriyum → Sol Ventrikül',
            techBadge: 'Normal Alan: 4–6 cm²',
            x: 325,
            y: -165,
            branchColor: '#F43F5E',
            collapsed: false,
            sticker: diagSticker('s_mitral_diag', 'mitral_valve_schema', 'Mitral Kapak Şeması'),
          },
          m1_1: {
            id: 'm1_1',
            parentId: 'm1',
            title: 'Anterior & Posterior Yaprakçıklar',
            x: 610,
            y: -260,
            branchColor: '#F43F5E',
            collapsed: false,
            sticker: packSticker('s_cell_1', 'med_cell_mitochondria', 'Endokard Dokusu'),
          },
          m1_2: {
            id: 'm1_2',
            parentId: 'm1',
            title: 'Korda Tendinea & Papiller Kaslar',
            x: 610,
            y: -70,
            branchColor: '#F43F5E',
            collapsed: false,
            sticker: illSticker('s_bone_1', 'bone_joint', 'Papiller Tutunma'),
          },
          m2: {
            id: 'm2',
            parentId: 'root',
            title: 'Klinik Muayene & Oskültasyon',
            subtitle: 'Apekste Diyastolik Rulman',
            techBadge: '5. İKA Midklaviküler Hat',
            x: 325,
            y: 165,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('s_stetho', 'med_stethoscope_clinic', 'Stetoskop'),
          },
          m2_1: {
            id: 'm2_1',
            parentId: 'm2',
            title: 'Ekokardiyografi & EKG Ritmi',
            techBadge: 'P Mitrale • AF Riski',
            x: 610,
            y: 165,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('s_eko', 'med_sa_node_ecg', 'EKG Dalga'),
          },
          m3: {
            id: 'm3',
            parentId: 'root',
            title: 'Pulmoner Dolaşım Etkisi',
            subtitle: 'Akciğer Konjesyonu & Dispne',
            techBadge: 'PCWP > 18 mmHg',
            x: -325,
            y: -155,
            branchColor: '#10B981',
            collapsed: false,
            sticker: packSticker('s_lungs', 'med_lungs_alveoli', 'Akciğer Dolaşımı'),
          },
          m4: {
            id: 'm4',
            parentId: 'root',
            title: 'Otonom Sinir Regülasyonu',
            subtitle: 'Sempatik & Parasempatik Tonus',
            techBadge: 'N. Vagus (CN X)',
            x: -325,
            y: 165,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: packSticker('s_brain', 'med_neuron_synapse', 'Sinaptik İletim'),
          },
        },
      };
    },
  },

  // =========================================================================
  // 3. MÜHENDİSLİK FAKÜLTESİ — İşlemsel Yükselteçler (Op-Amp) & Gömülü Sistemler
  // =========================================================================
  {
    id: 'tpl_muh_opamp',
    badge: '⚙️ Elektronik & Gömülü',
    department: 'muhendislik',
    title: 'İşlemsel Yükselteçler (Op-Amp)',
    description:
      'Eviren yükselteç, geri besleme topolojileri, pasif RLC filtreler ve mikrodenetleyici ADC arayüzü.',
    accentColor: '#F59E0B',
    build: () => {
      const now = Date.now();
      return {
        id: 'tpl_muh_opamp',
        title: 'İşlemsel Yükselteçler (Op-Amp)',
        department: 'muhendislik',
        rootNodeId: 'root',
        createdAt: now,
        updatedAt: now,
        crossLinks: [
          {
            id: 'cl_eng_1',
            fromNodeId: 'e2',
            toNodeId: 'e3',
            label: 'Anti-Aliasing Filtreli Sinyal',
            color: '#10B981',
            style: 'dashed_flow',
          },
        ],
        nodes: {
          root: {
            id: 'root',
            parentId: null,
            title: 'İşlemsel Yükselteçler (Op-Amp)',
            subtitle: 'Analog Elektronik & Sinyal İşleme',
            techBadge: 'Zin → ∞ • Zout → 0',
            x: 0,
            y: 0,
            branchColor: '#F59E0B',
            collapsed: false,
            sticker: packSticker('e_root', 'eng_opamp_inverting', 'Op-Amp Sembolü'),
          },
          e1: {
            id: 'e1',
            parentId: 'root',
            title: 'Eviren Yükselteç',
            subtitle: 'Negatif Geri Besleme',
            techBadge: 'Av = -Rf / Rin',
            x: 325,
            y: -160,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: diagSticker('e_inv_diag', 'opamp_inverting_schema', 'Eviren Yükselteç Şeması'),
          },
          e1_1: {
            id: 'e1_1',
            parentId: 'e1',
            title: '180° Faz Terslemesi & Sanal Toprak',
            techBadge: 'V+ ≈ V- ≈ 0V',
            x: 610,
            y: -160,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('e_polar', 'sci_polar_unit_circle', 'Faz Açısı'),
          },
          e2: {
            id: 'e2',
            parentId: 'root',
            title: 'Pasif Elemanlar & Aktif Filtreler',
            subtitle: 'RC Alçak ve Yüksek Geçiren',
            techBadge: 'fc = 1 / (2πRC)',
            x: 325,
            y: 165,
            branchColor: '#F59E0B',
            collapsed: false,
            sticker: packSticker('e_comp', 'eng_passive_rlc', 'Direnç ve Kondansatör'),
          },
          e3: {
            id: 'e3',
            parentId: 'root',
            title: 'ADC & Mikrodenetleyici Arayüzü',
            subtitle: 'Sensör Sinyal Koşullandırma',
            techBadge: '12-bit SAR ADC • 3.3V',
            x: -325,
            y: -150,
            branchColor: '#10B981',
            collapsed: false,
            sticker: packSticker('e_mcu', 'eng_mcu_arduino', 'Mikrodenetleyici'),
          },
          e4: {
            id: 'e4',
            parentId: 'root',
            title: 'Servo Sürücü & BMS Besleme',
            subtitle: 'Simetrik Güç & Kapalı Çevrim PID',
            techBadge: '±12V Ray • PWM',
            x: -325,
            y: 165,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: packSticker('e_bms', 'eng_bms_battery', 'BMS Güç Katmanı'),
          },
        },
      };
    },
  },

  // =========================================================================
  // 4. HUKUK FAKÜLTESİ — Kanun Yolları: İstinaf ve Temyiz
  // =========================================================================
  {
    id: 'tpl_hukuk_istinaf',
    badge: '⚖️ Hukuk Fakültesi',
    department: 'hukuk',
    title: 'Kanun Yolları: İstinaf & Temyiz',
    description:
      'İlk derece mahkemeleri, Bölge Adliye Mahkemesi (İstinaf), Yargıtay denetimi ve bozma akışı.',
    accentColor: '#8B5CF6',
    build: () => {
      const now = Date.now();
      return {
        id: 'tpl_hukuk_istinaf',
        title: 'Kanun Yolları: İstinaf & Temyiz',
        department: 'hukuk',
        rootNodeId: 'root',
        createdAt: now,
        updatedAt: now,
        crossLinks: [
          {
            id: 'cl_law_1',
            fromNodeId: 'l2',
            toNodeId: 'l1',
            label: 'Bozma Üzerine Dosya İadesi',
            color: '#F59E0B',
            style: 'dashed_flow',
          },
        ],
        nodes: {
          root: {
            id: 'root',
            parentId: null,
            title: 'Olağan Kanun Yolları',
            subtitle: 'Medeni & Ceza Muhakemesi Hukuku',
            techBadge: 'HMK m.341 • CMK m.272',
            x: 0,
            y: 0,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: packSticker('l_scales', 'law_istinaf_scales', 'Adalet Terazisi'),
          },
          l1: {
            id: 'l1',
            parentId: 'root',
            title: 'İstinaf Mahkemesi (BAM)',
            subtitle: 'Maddi Vakıa + Hukuki Denetim',
            techBadge: '2. Derece Yargılama',
            x: 325,
            y: -155,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: diagSticker('l_hier', 'judicial_hierarchy_schema', 'Yargı Basamakları'),
          },
          l1_1: {
            id: 'l1_1',
            parentId: 'l1',
            title: 'Delil Tespiti & Yeniden Duruşma',
            x: 610,
            y: -155,
            branchColor: '#8B5CF6',
            collapsed: false,
            sticker: packSticker('l_evid', 'law_evidence_discovery', 'Delil İnceleme'),
          },
          l2: {
            id: 'l2',
            parentId: 'root',
            title: 'Temyiz İncelemesi (Yargıtay)',
            subtitle: 'Yalnızca Hukuka Uygunluk Denetimi',
            techBadge: 'HMK m.361 • İçtihat',
            x: 325,
            y: 165,
            branchColor: '#F59E0B',
            collapsed: false,
            sticker: packSticker('l_const', 'law_separation_powers', 'Yüksek Mahkeme'),
          },
          l3: {
            id: 'l3',
            parentId: 'root',
            title: 'Başvuru Süreleri & Dilekçe',
            subtitle: 'Tebliğden İtibaren Hak Düşürücü Süre',
            techBadge: '2 Hafta Kesin Süre',
            x: -325,
            y: -145,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('l_sure', 'law_contract_seal', 'Mühürlü Dilekçe'),
          },
          l4: {
            id: 'l4',
            parentId: 'root',
            title: 'Hükmün Kesinleşmesi & İcra',
            subtitle: 'Şekli ve Maddi Kesin Hüküm',
            techBadge: 'İlamlı İcra Takibi',
            x: -325,
            y: 155,
            branchColor: '#10B981',
            collapsed: false,
            sticker: packSticker('l_gavel2', 'law_judge_gavel', 'Kesin Hüküm'),
          },
        },
      };
    },
  },

  // =========================================================================
  // 5. MİMARLIK FAKÜLTESİ — Tarihi Taşıyıcı Sistemler: Kemer, Tonoz & Uçan Payanda
  // =========================================================================
  {
    id: 'tpl_mim_gotik',
    badge: '🏛️ Mimarlık',
    department: 'mimarlik',
    title: 'Kemer, Tonoz & Uçan Payanda',
    description:
      'Tarihi yapılarda yük aktarımı, sivri kemerler, kaburgalı tonozlar ve Gotik uçan payandalar.',
    accentColor: '#D97706',
    build: () => {
      const now = Date.now();
      return {
        id: 'tpl_mim_gotik',
        title: 'Kemer, Tonoz & Uçan Payanda',
        department: 'mimarlik',
        rootNodeId: 'root',
        createdAt: now,
        updatedAt: now,
        crossLinks: [
          {
            id: 'cl_arch_1',
            fromNodeId: 'a2',
            toNodeId: 'a1',
            label: 'Yanal Tonoz İtkisi Aktarımı',
            color: '#F43F5E',
            style: 'dashed_flow',
          },
        ],
        nodes: {
          root: {
            id: 'root',
            parentId: null,
            title: 'Kagir & Gotik Taşıyıcı Sistemler',
            subtitle: 'Mimarlık Tarihi ve Yapı Statiği',
            techBadge: 'Basınç & İtki Dengesi',
            x: 0,
            y: 0,
            branchColor: '#F59E0B',
            collapsed: false,
            sticker: packSticker('a_root', 'arch_flying_buttress', 'Gotik Uçan Payanda'),
          },
          a1: {
            id: 'a1',
            parentId: 'root',
            title: 'Uçan Payanda (Flying Buttress)',
            subtitle: 'Yanal İtkiyi Dış Ayaklara Aktarma',
            techBadge: 'Boşluklu Kemer Destek',
            x: 325,
            y: -155,
            branchColor: '#F59E0B',
            collapsed: false,
            sticker: diagSticker('a_fb_diag', 'flying_buttress_schema', 'Yük Aktarım Diyagramı'),
          },
          a2: {
            id: 'a2',
            parentId: 'root',
            title: 'Kemer, Tonoz & Jeodezik Kubbe',
            subtitle: 'Basınç Gerilmeleri ve Kilit Taşı',
            techBadge: 'Çekmesiz Kagir Açıklık',
            x: 325,
            y: 165,
            branchColor: '#0EA5E9',
            collapsed: false,
            sticker: packSticker('a_dome', 'arch_geodesic_dome', 'Kubbe ve Kemer'),
          },
          a3: {
            id: 'a3',
            parentId: 'root',
            title: 'Plan, Kesit & Rölöve Analizi',
            subtitle: 'Nef, Apsis ve Transept Kurgusu',
            techBadge: '1:50 Mimari Ölçek',
            x: -325,
            y: -145,
            branchColor: '#10B981',
            collapsed: false,
            sticker: packSticker('a_plan', 'arch_blueprint_compass', 'Mimari Plan'),
          },
          a4: {
            id: 'a4',
            parentId: 'root',
            title: 'Klasik Sütun & Düşey Ayaklar',
            subtitle: 'Dor, İyon ve Korint Düzenleri',
            techBadge: 'Eksenel Basınç Elemanı',
            x: -325,
            y: 155,
            branchColor: '#F43F5E',
            collapsed: false,
            sticker: packSticker('a_col', 'arch_corinthian_column', 'Korint Sütunu'),
          },
        },
      };
    },
  },
];

export const ACADEMIC_TEMPLATES: TemplateDescriptor[] = RAW_ACADEMIC_TEMPLATES.map((tpl) => ({
  ...tpl,
  build: () => stampTemplateNodeFlags(tpl.build()),
}));

export const KNOWN_TEMPLATE_SUBTITLES: ReadonlySet<string> = (() => {
  const s = new Set<string>(['Dal eklemek için + tutamacını sürükleyin']);
  for (const tpl of RAW_ACADEMIC_TEMPLATES) {
    const doc = tpl.build();
    for (const node of Object.values(doc.nodes)) {
      if (node.subtitle) s.add(node.subtitle.trim());
    }
  }
  return s;
})();

export const KNOWN_TEMPLATE_TECH_BADGES: ReadonlySet<string> = (() => {
  const s = new Set<string>();
  for (const tpl of RAW_ACADEMIC_TEMPLATES) {
    const doc = tpl.build();
    for (const node of Object.values(doc.nodes)) {
      if (node.techBadge) s.add(node.techBadge.trim());
    }
  }
  return s;
})();
