import type {
  DisciplineProfile,
  GalleryCategoryFilter,
  VisualSearchResult,
} from '../../../types/mindmap';
import { LocalStore } from '../../sync/LocalStore';
import { normalizeTrAscii } from '../AcademicOntologyTR';
import {
  buildDuotoneStickerDataUri,
  DUOTONE_HARMONY_PALETTE,
} from '../DuotoneStickerColorizer';

const CHANNEL_A_MULTICOLOR_PREFIXES =
  'openmoji,fluent-emoji,fluent-emoji-flat,noto,twemoji,icon-park,flat-color-icons,fxemoji,streamline-emojis,logos,devicon,skill-icons,vscode-icons';

const CHANNEL_B_SPECIALIST_PREFIXES =
  'healthicons,game-icons,carbon,ph,lucide,tabler,mdi';

interface BuiltInSpecialistVector {
  id: string;
  titleTr: string;
  discipline: DisciplineProfile;
  tags: string[];
  body: string; // 24x24 clean vector path markup
}

/**
 * 42 Built-in Specialist Vector Icons (Healthicons / Carbon / Lucide style)
 * Colorized dynamically via `DuotoneStickerColorizer` in 0ms!
 */
const BUILTIN_SPECIALIST_VECTORS: BuiltInSpecialistVector[] = [
  // System Design & Cloud
  {
    id: 'sp_server_stack',
    titleTr: 'Sunucu Kümesi Katmanı',
    discipline: 'system_design_cs',
    tags: ['server', 'load', 'cluster', 'sunucu', 'yuk', 'node'],
    body: `<rect x="2" y="3" width="20" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="14" width="20" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="6.5" r="1.2" fill="currentColor"/><circle cx="6" cy="17.5" r="1.2" fill="currentColor"/><line x1="11" y1="6.5" x2="18" y2="6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="17.5" x2="18" y2="17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_git_fork_lb',
    titleTr: 'Trafik Dağıtım Çatalı',
    discipline: 'system_design_cs',
    tags: ['balancer', 'load', 'routing', 'yuk dengeleyici', 'proxy', 'gateway'],
    body: `<circle cx="12" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 9v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9M12 13v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_db_cylinder',
    titleTr: 'Veri Depolama Silindiri',
    discipline: 'system_design_cs',
    tags: ['database', 'sql', 'sharding', 'veritabani', 'storage', 'replica'],
    body: `<ellipse cx="12" cy="5" rx="9" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: 'sp_cloud_sync',
    titleTr: 'Bulut Senkronizasyon Ağı',
    discipline: 'system_design_cs',
    tags: ['cloud', 'cdn', 'vpc', 'bulut', 'sync', 'network'],
    body: `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_shield_check',
    titleTr: 'Güvenlik Duvarı & Doğrulama',
    discipline: 'system_design_cs',
    tags: ['shield', 'security', 'waf', 'auth', 'guvenlik', 'oauth', 'jwt'],
    body: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_zap_cache',
    titleTr: 'Bellek İçi Hızlandırıcı',
    discipline: 'system_design_cs',
    tags: ['cache', 'redis', 'fast', 'lightning', 'onbellek', 'serverless'],
    body: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_layers_shard',
    titleTr: 'Yatay Bölümleme Katmanları',
    discipline: 'system_design_cs',
    tags: ['sharding', 'partition', 'layers', 'katman', 'microservice', 'docker'],
    body: `<polygon points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><polyline points="2 17 12 22 22 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="2 12 12 17 22 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_workflow_queue',
    titleTr: 'Asenkron Kuyruk Akışı',
    discipline: 'system_design_cs',
    tags: ['queue', 'kafka', 'pipeline', 'kuyruk', 'stream', 'event'],
    body: `<rect x="3" y="3" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="15" y="3" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="15" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 9v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9M12 14v1" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: 'sp_network_switch',
    titleTr: 'Ağ Anahtarlayıcı & Köprü',
    discipline: 'system_design_cs',
    tags: ['switch', 'bridge', 'router', 'ethernet', 'kopru', 'port'],
    body: `<rect x="2" y="7" width="20" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="11" x2="6" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="11" x2="10" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="11" x2="14" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>`,
  },
  {
    id: 'sp_globe_cdn',
    titleTr: 'Küresel Kenar Dağıtımı',
    discipline: 'system_design_cs',
    tags: ['globe', 'cdn', 'dns', 'edge', 'world', 'domain'],
    body: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },

  // Electronics & Robotics
  {
    id: 'sp_cpu_chip',
    titleTr: 'Mikroişlemci Çekirdeği',
    discipline: 'electronics_robotics',
    tags: ['microchip', 'cpu', 'arduino', 'fpga', 'opamp', 'elektronik'],
    body: `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="9" width="6" height="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_sine_wave',
    titleTr: 'Analog Osiloskop Sinyali',
    discipline: 'electronics_robotics',
    tags: ['wave', 'signal', 'amplifier', 'op-amp', 'yukseltec', 'frekans'],
    body: `<path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="2" y1="19" x2="22" y2="19" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/>`,
  },
  {
    id: 'sp_radio_rf',
    titleTr: 'RF Haberleşme Anteni',
    discipline: 'electronics_robotics',
    tags: ['antenna', 'rf', 'wireless', 'sensor', 'iot', 'dalga'],
    body: `<circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_battery_charging',
    titleTr: 'Güç Elektroniği & Batarya',
    discipline: 'electronics_robotics',
    tags: ['battery', 'power', 'bms', 'pil', 'voltaj', 'akim'],
    body: `<rect x="2" y="7" width="16" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="22" y1="11" x2="22" y2="13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M11 7l-3 5h4l-3 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_cog_robotics',
    titleTr: 'Mekatronik Dişli & Kontrol',
    discipline: 'electronics_robotics',
    tags: ['gear', 'motor', 'servo', 'robot', 'pid', 'mekanik'],
    body: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
  },

  // Medicine, Cardiology & Biology
  {
    id: 'sp_heart_pulse',
    titleTr: 'Kardiyak Atım & Kapak',
    discipline: 'medicine_biology',
    tags: ['heart', 'mitral', 'kalp', 'kapak', 'cardiology', 'pulse'],
    body: `<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><polyline points="7 12 10 12 11.5 9.5 13.5 14.5 15 12 17 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_activity_ecg',
    titleTr: 'EKG Elektrokardiyografi Ritmi',
    discipline: 'medicine_biology',
    tags: ['ecg', 'ekg', 'heartbeat', 'monitor', 'sinoatriyal', 'ritim'],
    body: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_stethoscope_med',
    titleTr: 'Klinik Oskültasyon Tamburu',
    discipline: 'medicine_biology',
    tags: ['stethoscope', 'doctor', 'klinik', 'muayene', 'oskultasyon', 'tip'],
    body: `<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: 'sp_dna_strand',
    titleTr: 'Moleküler DNA Sarmalı',
    discipline: 'medicine_biology',
    tags: ['dna', 'genetics', 'genetik', 'rna', 'kromozom', 'hucre'],
    body: `<path d="M2 15c6.667-6 13.333 0 20-6M9 22c1.798-1.998 2.518-3.995 2.807-5.993M15 2c-1.798 1.998-2.518 3.995-2.807 5.993M17 6l-2.5-2.5M14 8l-1-1M7 18l2.5 2.5M3.5 14.5l.5.5M20 9l.5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_brain_mind',
    titleTr: 'Nörolojik Korteks Haritası',
    discipline: 'medicine_biology',
    tags: ['brain', 'neuron', 'beyin', 'sinir', 'noron', 'sinaps'],
    body: `<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: 'sp_microscope_bio',
    titleTr: 'Histoloji & Patoloji Mikroskobu',
    discipline: 'medicine_biology',
    tags: ['microscope', 'mikroskop', 'lab', 'bakteri', 'hucre', 'biyoloji'],
    body: `<path d="M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1M9 14h2M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // Law & Governance
  {
    id: 'sp_scale_justice',
    titleTr: 'Yargı & İstinaf Terazisi',
    discipline: 'law_governance',
    tags: ['scale', 'justice', 'istinaf', 'temyiz', 'hukuk', 'mahkeme', 'adalet'],
    body: `<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_gavel_verdict',
    titleTr: 'Duruşma & Hüküm Tokmağı',
    discipline: 'law_governance',
    tags: ['gavel', 'verdict', 'karar', 'bozma', 'onama', 'hakim', 'ceza'],
    body: `<path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_landmark_court',
    titleTr: 'Yüksek Mahkeme & Anayasa',
    discipline: 'law_governance',
    tags: ['courthouse', 'parliament', 'yargitay', 'anayasa', 'bam', 'devlet'],
    body: `<line x1="3" y1="22" x2="21" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="18" x2="6" y2="11" stroke="currentColor" stroke-width="2"/><line x1="10" y1="18" x2="10" y2="11" stroke="currentColor" stroke-width="2"/><line x1="14" y1="18" x2="14" y2="11" stroke="currentColor" stroke-width="2"/><line x1="18" y1="18" x2="18" y2="11" stroke="currentColor" stroke-width="2"/><polygon points="12 2 20 7 4 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_scroll_decree',
    titleTr: 'Kanun Metni & Dilekçe Rulosu',
    discipline: 'law_governance',
    tags: ['scroll', 'contract', 'kanun', 'sozlesme', 'dilekce', 'ferman', 'timar'],
    body: `<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 17V5a2 2 0 0 0-2-2H4" fill="none" stroke="currentColor" stroke-width="2"/><line x1="11" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_file_search_evidence',
    titleTr: 'Adli Delil & Dosya İnceleme',
    discipline: 'law_governance',
    tags: ['evidence', 'delil', 'sorusturma', 'bilirkisi', 'ispat', 'document'],
    body: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="11.5" cy="14.5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13.3 16.3 15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },

  // Architecture & Civil Engineering
  {
    id: 'sp_arch_cathedral',
    titleTr: 'Gotik Kemer & Payanda Kesiti',
    discipline: 'architecture_civil',
    tags: ['arch', 'cathedral', 'buttress', 'payanda', 'kemer', 'tonoz', 'gotik'],
    body: `<path d="M6 21V9a6 6 0 0 1 12 0v12M2 21h20M6 13H3v8M18 13h3v8M12 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_pillar_column',
    titleTr: 'Klasik Taşıyıcı Sütun Düzeni',
    discipline: 'architecture_civil',
    tags: ['column', 'pillar', 'sutun', 'korint', 'antik', 'mimarlik'],
    body: `<rect x="5" y="3" width="14" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="18" width="14" height="3" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" stroke-width="2"/><line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" stroke-width="2"/><line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: 'sp_bridge_span',
    titleTr: 'Kemer & Asma Köprü Açıklığı',
    discipline: 'architecture_civil',
    tags: ['bridge', 'viaduct', 'asma kopru', 'tas kopru', 'insaat', 'statik'],
    body: `<path d="M2 15h20M5 8v12M19 8v12M5 9c3.5 4.5 10.5 4.5 14 0M2 19c3-3 7-3 10 0s7 3 10 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    id: 'sp_compass_drafting',
    titleTr: 'Mimari Pergel & Ölçek Çizimi',
    discipline: 'architecture_civil',
    tags: ['blueprint', 'compass', 'ruler', 'plan', 'kesit', 'rolove'],
    body: `<circle cx="12" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m3 21 8.02-14.26M21 21l-8.02-14.26M6 15h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },

  // Exact Sciences, History & Economics
  {
    id: 'sp_atom_physics',
    titleTr: 'Kuantum Atom Çekirdeği',
    discipline: 'exact_sciences',
    tags: ['atom', 'physics', 'quantum', 'fizik', 'kuantum', 'elektron'],
    body: `<circle cx="12" cy="12" r="2" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)" fill="none" stroke="currentColor" stroke-width="2"/>`,
  },
  {
    id: 'sp_flask_chem',
    titleTr: 'Kimyasal Sentez Balonu',
    discipline: 'exact_sciences',
    tags: ['flask', 'chemistry', 'test tube', 'kimya', 'reaksiyon', 'deney'],
    body: `<path d="M10 2v7.31l-4.89 8.15A2 2 0 0 0 6.83 20.5h10.34a2 2 0 0 0 1.72-3.04L14 9.31V2M8.5 2h7M7 16h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_crown_empire',
    titleTr: 'İmparatorluk & Hanedan Simgesi',
    discipline: 'humanities_social',
    tags: ['crown', 'ottoman', 'empire', 'osmanli', 'tarih', 'timar', 'padisah'],
    body: `<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_swords_cavalry',
    titleTr: 'Tımarlı Sipahi & Sefer Gücü',
    discipline: 'humanities_social',
    tags: ['swords', 'shield', 'cavalry', 'timar', 'sipahi', 'savas', 'ordu'],
    body: `<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><line x1="13" y1="19" x2="19" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="16" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_book_open',
    titleTr: 'Akademik Külliyat & Literatür',
    discipline: 'humanities_social',
    tags: ['books', 'literature', 'edebiyat', 'felsefe', 'sosyoloji', 'kitap'],
    body: `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_trending_econ',
    titleTr: 'Büyüme & Piyasa Eğrisi',
    discipline: 'business_economics',
    tags: ['chart', 'economics', 'iktisat', 'ekonomi', 'finans', 'borsa', 'enflasyon'],
    body: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 7 22 7 22 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'sp_coins_treasury',
    titleTr: 'Hazine, Vergi & Sermaye',
    discipline: 'business_economics',
    tags: ['coins', 'money', 'tax', 'hazine', 'iltizam', 'vergi', 'odeme'],
    body: `<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  },
];

/**
 * Instant (`0ms` offline) specialist duotone stickers harmonized with `branchColor` & palette!
 */
export function getInstantDuotoneSpecialistResults(
  query: string,
  englishTerms: string[],
  activeDiscipline: DisciplineProfile,
  branchColor = '#0EA5E9'
): VisualSearchResult[] {
  const qNorm = normalizeTrAscii(query);
  const tokenPool = [qNorm, ...englishTerms.map((e) => e.toLowerCase())].filter(Boolean);

  const scored = BUILTIN_SPECIALIST_VECTORS.map((vec, idx) => {
    let score = vec.discipline === activeDiscipline ? 0.72 : 0.48;
    for (const tag of vec.tags) {
      if (tokenPool.some((tok) => tok.includes(tag) || tag.includes(tok))) {
        score = Math.max(score, 0.89);
      }
    }
    return { vec, score, idx };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 18).map(({ vec, score, idx }, rankIdx) => {
    const colorHex =
      rankIdx % 3 === 0
        ? branchColor
        : DUOTONE_HARMONY_PALETTE[(idx + rankIdx) % DUOTONE_HARMONY_PALETTE.length];

    const dataUri = buildDuotoneStickerDataUri(vec.body, 24, 24, colorHex, rankIdx);
    const category: Exclude<GalleryCategoryFilter, 'all'> =
      vec.discipline === 'system_design_cs' || vec.discipline === 'electronics_robotics'
        ? 'system_arch'
        : 'medical_academic';

    return {
      id: `duotone_local_${vec.id}`,
      title: vec.titleTr,
      previewUrl: dataUri,
      rawUrl: dataUri,
      mode: 'illustration',
      category,
      source: 'library',
      needsDieCut: false,
      aspectRatio: 1,
      score: score - rankIdx * 0.005,
      providerName: 'Duotone Vektör Stüdyo',
      isDuotoneColorizable: true,
      rawSvgMarkup: `<svg viewBox="0 0 24 24">${vec.body}</svg>`,
    };
  });
}

/**
 * Channel A + Channel B Live Federated Iconify Search (200,000+ vectors)
 * - Channel A: Multi-color SVG stickers (`openmoji`, `fluent-emoji`, `noto`, `icon-park`, `flat-color-icons`, `logos`, `devicon`, `skill-icons`)
 * - Channel B: Specialist academic vectors (`healthicons`, `game-icons`, `carbon`, `ph`, `lucide`) -> Batch-fetched & transformed via `DuotoneStickerColorizer`!
 */
export async function searchIconifyFederated(
  englishTerms: string[],
  branchColor = '#0EA5E9',
  signal?: AbortSignal
): Promise<VisualSearchResult[]> {
  const uniqueTerms = Array.from(
    new Set(englishTerms.map((t) => t.trim()).filter((t) => t.length >= 2))
  ).slice(0, 3);

  if (uniqueTerms.length === 0) return [];

  // 1. Channel A: Multi-Color Collections (Parallel across top 2 terms)
  const channelAPromise = Promise.allSettled(
    uniqueTerms.slice(0, 2).map(async (term, tIdx) => {
      const url = `https://api.iconify.design/search?query=${encodeURIComponent(
        term
      )}&prefixes=${encodeURIComponent(CHANNEL_A_MULTICOLOR_PREFIXES)}&limit=36`;
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const json = (await res.json()) as { icons?: string[] };
      return (json.icons ?? []).map((iconId, iIdx): VisualSearchResult => {
        const [prefix, name] = iconId.split(':');
        const svgUrl = `https://api.iconify.design/${prefix}/${name}.svg?height=160`;
        const isTechLogo =
          prefix === 'logos' ||
          prefix === 'devicon' ||
          prefix === 'skill-icons' ||
          prefix === 'vscode-icons';
        const isHandDrawn = prefix === 'openmoji' || prefix === 'streamline-emojis';

        return {
          id: `ic_mc_${iconId}`,
          title: (name || term).replace(/[-_]+/g, ' '),
          previewUrl: svgUrl,
          rawUrl: svgUrl,
          mode: isTechLogo ? 'illustration' : '3d',
          category: isTechLogo ? 'system_arch' : isHandDrawn ? 'hand_drawn' : '3d_color',
          source: 'library',
          needsDieCut: true,
          aspectRatio: 1,
          score: 0.91 - tIdx * 0.03 - iIdx * 0.005,
          providerName: `Iconify (${prefix})`,
          iconifyId: iconId,
        };
      });
    })
  );

  // 2. Channel B: Specialist Collections -> Batch JSON fetch -> `DuotoneStickerColorizer`!
  const channelBPromise = (async (): Promise<VisualSearchResult[]> => {
    const primaryTerm = uniqueTerms[0];
    const searchUrl = `https://api.iconify.design/search?query=${encodeURIComponent(
      primaryTerm
    )}&prefixes=${encodeURIComponent(CHANNEL_B_SPECIALIST_PREFIXES)}&limit=32`;

    const res = await fetch(searchUrl, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { icons?: string[] };
    const iconIds = (data.icons ?? []).slice(0, 28);
    if (iconIds.length === 0) return [];

    // Group by prefix for single-request JSON batching (`https://api.iconify.design/{prefix}.json?icons=a,b,c`)
    const byPrefix = new Map<string, string[]>();
    for (const id of iconIds) {
      const [prefix, name] = id.split(':');
      if (!prefix || !name) continue;
      const arr = byPrefix.get(prefix) ?? [];
      arr.push(name);
      byPrefix.set(prefix, arr);
    }

    const colorizedResults: VisualSearchResult[] = [];
    const toCacheBatch: Array<{ iconId: string; svgMarkup: string }> = [];

    await Promise.allSettled(
      Array.from(byPrefix.entries()).map(async ([prefix, names]) => {
        const batchUrl = `https://api.iconify.design/${prefix}.json?icons=${encodeURIComponent(
          names.join(',')
        )}`;
        const bRes = await fetch(batchUrl, { signal });
        if (!bRes.ok) return;
        const bJson = (await bRes.json()) as {
          width?: number;
          height?: number;
          icons?: Record<string, { body?: string; width?: number; height?: number }>;
        };

        const defaultW = bJson.width || 24;
        const defaultH = bJson.height || 24;

        names.forEach((name, idx) => {
          const iconData = bJson.icons?.[name];
          if (!iconData?.body) return;
          const w = iconData.width || defaultW;
          const h = iconData.height || defaultH;
          const paletteHex =
            idx % 2 === 0
              ? branchColor
              : DUOTONE_HARMONY_PALETTE[idx % DUOTONE_HARMONY_PALETTE.length];

          const duotoneUri = buildDuotoneStickerDataUri(
            iconData.body,
            w,
            h,
            paletteHex,
            idx
          );
          const rawSvgMarkup = `<svg viewBox="0 0 ${w} ${h}">${iconData.body}</svg>`;
          const fullId = `${prefix}:${name}`;
          toCacheBatch.push({ iconId: fullId, svgMarkup: rawSvgMarkup });

          colorizedResults.push({
            id: `ic_duo_${fullId}`,
            title: name.replace(/[-_]+/g, ' '),
            previewUrl: duotoneUri,
            rawUrl: duotoneUri,
            mode: 'illustration',
            category: prefix === 'carbon' ? 'system_arch' : 'medical_academic',
            source: 'library',
            needsDieCut: false,
            aspectRatio: 1,
            score: 0.86 - idx * 0.006,
            providerName: `Duotone (${prefix})`,
            isDuotoneColorizable: true,
            rawSvgMarkup,
            iconifyId: fullId,
          });
        });
      })
    );

    if (toCacheBatch.length > 0) {
      void LocalStore.putSvgMarkupsBatch(toCacheBatch).catch(() => undefined);
    }

    return colorizedResults;
  })();

  const [settledA, settledB] = await Promise.all([
    channelAPromise,
    channelBPromise.catch(() => [] as VisualSearchResult[]),
  ]);

  const out: VisualSearchResult[] = [];
  for (const s of settledA) {
    if (s.status === 'fulfilled') {
      out.push(...s.value);
    }
  }
  out.push(...settledB);
  return out;
}

/**
 * Source 5: Microsoft Fluent 3D Clay / Volumetric Asset Catalog (38 Verified High-Res 3D PNGs)
 */
const FLUENT_3D_ITEMS: Array<{ keywords: string[]; label: string; path: string }> = [
  { keywords: ['heart', 'kalp', 'mitral', 'cardio'], label: '3D Anatomik Kalp', path: 'Anatomical%20heart/3D/anatomical_heart_3d.png' },
  { keywords: ['lungs', 'akciger', 'solunum'], label: '3D Akciğer', path: 'Lungs/3D/lungs_3d.png' },
  { keywords: ['brain', 'beyin', 'noron', 'neural', 'ai'], label: '3D Beyin', path: 'Brain/3D/brain_3d.png' },
  { keywords: ['dna', 'genetik', 'biyoloji'], label: '3D DNA Sarmalı', path: 'Dna/3D/dna_3d.png' },
  { keywords: ['microscope', 'mikroskop', 'hucre', 'lab'], label: '3D Mikroskop', path: 'Microscope/3D/microscope_3d.png' },
  { keywords: ['stethoscope', 'stetoskop', 'tip', 'klinik'], label: '3D Stetoskop', path: 'Stethoscope/3D/stethoscope_3d.png' },
  { keywords: ['bone', 'kemik', 'iskelet', 'anatomi'], label: '3D Kemik', path: 'Bone/3D/bone_3d.png' },
  { keywords: ['pill', 'ilac', 'farmakoloji'], label: '3D Kapsül', path: 'Pill/3D/pill_3d.png' },
  { keywords: ['test', 'flask', 'kimya', 'reaksiyon'], label: '3D Deney Tüpü', path: 'Test%20tube/3D/test_tube_3d.png' },
  { keywords: ['petri', 'bakteri', 'mikrobiyoloji'], label: '3D Petri Kabı', path: 'Petri%20dish/3D/petri_dish_3d.png' },
  { keywords: ['scale', 'adalet', 'hukuk', 'istinaf', 'balancer'], label: '3D Denge Terazisi', path: 'Balance%20scale/3D/balance_scale_3d.png' },
  { keywords: ['scroll', 'anayasa', 'tarih', 'ferman', 'timar', 'contract'], label: '3D Ferman / Belge', path: 'Scroll/3D/scroll_3d.png' },
  { keywords: ['building', 'courthouse', 'mimarlik', 'kemer', 'sutun', 'mahkeme'], label: '3D Klasik Yapı', path: 'Classical%20building/3D/classical_building_3d.png' },
  { keywords: ['ruler', 'blueprint', 'plan', 'kesit', 'geometri'], label: '3D Mimari Gönye', path: 'Triangular%20ruler/3D/triangular_ruler_3d.png' },
  { keywords: ['gear', 'muhendislik', 'worker', 'microservice', 'sistem'], label: '3D Mekanik Dişli', path: 'Gear/3D/gear_3d.png' },
  { keywords: ['plug', 'elektronik', 'opamp', 'api', 'websocket'], label: '3D Bağlantı Fişi', path: 'Electric%20plug/3D/electric_plug_3d.png' },
  { keywords: ['battery', 'bms', 'voltaj', 'guc', 'pil'], label: '3D Güç Bataryası', path: 'Battery/3D/battery_3d.png' },
  { keywords: ['robot', 'yapay', 'llm', 'otomasyon', 'worker'], label: '3D Otonom Robot', path: 'Robot/3D/robot_3d.png' },
  { keywords: ['laptop', 'computer', 'client', 'yazilim', 'sunucu'], label: '3D İstemci Bilgisayar', path: 'Laptop/3D/laptop_3d.png' },
  { keywords: ['shield', 'security', 'waf', 'firewall', 'guvenlik'], label: '3D Güvenlik Kalkanı', path: 'Shield/3D/shield_3d.png' },
  { keywords: ['lock', 'auth', 'jwt', 'sifreli', 'kilit'], label: '3D Kripto Kilit', path: 'Locked/3D/locked_3d.png' },
  { keywords: ['key', 'anahtar', 'token', 'oauth'], label: '3D Yetki Anahtarı', path: 'Key/3D/key_3d.png' },
  { keywords: ['lightning', 'zap', 'redis', 'cache', 'hizli', 'serverless'], label: '3D Yıldırım Hızı', path: 'High%20voltage/3D/high_voltage_3d.png' },
  { keywords: ['satellite', 'antenna', 'rf', 'cdn', 'iot'], label: '3D Uydu Anteni', path: 'Satellite%20antenna/3D/satellite_antenna_3d.png' },
  { keywords: ['package', 'docker', 'container', 'storage', 's3'], label: '3D Konteyner Paketi', path: 'Package/3D/package_3d.png' },
  { keywords: ['magnifying', 'search', 'elastic', 'delil', 'arama'], label: '3D Büyüteç İnceleme', path: 'Magnifying%20glass%20tilted%20left/3D/magnifying_glass_tilted_left_3d.png' },
  { keywords: ['bell', 'notification', 'bildirim', 'alarm'], label: '3D Bildirim Çanı', path: 'Bell/3D/bell_3d.png' },
  { keywords: ['chart', 'ekonomi', 'iktisat', 'analytics', 'warehouse'], label: '3D Analitik Grafik', path: 'Chart%20increasing/3D/chart_increasing_3d.png' },
  { keywords: ['abacus', 'matematik', 'karmasik', 'hesap'], label: '3D Matematik Abaküs', path: 'Abacus/3D/abacus_3d.png' },
  { keywords: ['books', 'edebiyat', 'kitap', 'akademik'], label: '3D Akademik Kitaplar', path: 'Books/3D/books_3d.png' },
  { keywords: ['bulb', 'fikir', 'optik', 'isik', 'fizik'], label: '3D Işık & Fikir', path: 'Light%20bulb/3D/light_bulb_3d.png' },
  { keywords: ['globe', 'cografya', 'cdn', 'dns', 'dunya'], label: '3D Küresel Ağ', path: 'Globe%20showing%20Europe-Africa/3D/globe_showing_europe-africa_3d.png' },
  { keywords: ['rocket', 'uzay', 'performans', 'deploy'], label: '3D Roket İvmesi', path: 'Rocket/3D/rocket_3d.png' },
  { keywords: ['magnet', 'manyetik', 'alan', 'fizik'], label: '3D Mıknatıs', path: 'Magnet/3D/magnet_3d.png' },
  { keywords: ['compass', 'pusula', 'router', 'yonlendirme'], label: '3D Yön Pusulası', path: 'Compass/3D/compass_3d.png' },
  { keywords: ['crown', 'osmanli', 'imparatorluk', 'tarih'], label: '3D Hükümdar Tacı', path: 'Crown/3D/crown_3d.png' },
];

export function searchFluent3DEmojiCatalog(
  query: string,
  englishTerms: string[]
): VisualSearchResult[] {
  const base = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';
  const tokens = [normalizeTrAscii(query), ...englishTerms.map((t) => t.toLowerCase())].filter(
    Boolean
  );

  const scored = FLUENT_3D_ITEMS.map((item, idx) => {
    let score = 0.62 - idx * 0.003;
    for (const kw of item.keywords) {
      if (tokens.some((tok) => tok.includes(kw) || kw.includes(tok))) {
        score = 0.92;
        break;
      }
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 14).map(({ item, score }) => {
    const url = `${base}/${item.path}`;
    return {
      id: `fluent3d_${item.path}`,
      title: item.label,
      previewUrl: url,
      rawUrl: url,
      mode: '3d',
      category: '3d_color',
      source: 'library',
      needsDieCut: true,
      aspectRatio: 1,
      score,
      providerName: 'Microsoft Fluent 3D',
    };
  });
}
