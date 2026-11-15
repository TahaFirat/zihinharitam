import {
  DISCIPLINE_LABELS,
  type AcademicDepartment,
  type DisciplineProfile,
  type MetaphorChip,
  type MindNode,
  type ProactiveBranchSuggestion,
  type StickerAsset,
} from '../../types/mindmap';
import {
  FAST_WORD_TRANSLATION_MAP,
  PARSED_ONTOLOGY,
  buildMetaphorChipsForConcept,
  normalizeTrAscii,
  stemTurkishWord,
} from './AcademicOntologyTR';
import { getPackStickerById, SYSTEM_DESIGN_AND_ATLAS_PACK } from './providers/SystemDesignVisualPack';

export interface MapContextAnalysis {
  discipline: DisciplineProfile;
  label: string;
  emoji: string;
  accent: string;
  ancestorTitles: string[];
  parentTitle: string;
}

export interface ExpandedVisualQuery {
  originalQuery: string;
  activeDiscipline: DisciplineProfile;
  primaryEnglishSubject: string; // Concrete subject for AI Sticker Art Director!
  englishSearchTerms: string[]; // Ranked concrete English search tokens for Iconify/Openverse/Wikimedia
  turkishSearchTerms: string[]; // Clean Turkish tokens for ARASAAC TR
  matchedPackIds: string[]; // Direct hits in SystemDesignVisualPack
  metaphorChips: MetaphorChip[];
}

const DEPARTMENT_TO_DISCIPLINE_HINT: Record<AcademicDepartment, DisciplineProfile | null> = {
  genel: null,
  sistem_tasarimi: 'system_design_cs',
  tip: 'medicine_biology',
  muhendislik: 'electronics_robotics',
  hukuk: 'law_governance',
  mimarlik: 'architecture_civil',
  temel_bilimler: 'exact_sciences',
  sosyal_bilimler: 'humanities_social',
};

const DISCIPLINE_SIGNAL_WORDS: Record<DisciplineProfile, string[]> = {
  system_design_cs: [
    'sistem tasarimi', 'system design', 'load balancer', 'yuk dengeleyici', 'api', 'gateway',
    'redis', 'onbellek', 'cache', 'kafka', 'kuyruk', 'sharding', 'veritabani', 'sql', 'nosql',
    'mikroservis', 'microservice', 'docker', 'kubernetes', 'bulut', 'cloud', 'cdn', 'dns',
    'yazilim', 'algoritma', 'sunucu', 'client', 'grpc', 'websocket', 'yapay zeka', 'llm',
  ],
  electronics_robotics: [
    'op-amp', 'opamp', 'yukseltec', 'elektronik', 'devre', 'mikrodenetleyici', 'arduino',
    'stm32', 'bms', 'batarya', 'direnc', 'kondansator', 'mantik kapilari', 'lojik', 'pcb',
    'sensor', 'rf', 'anten', 'robot', 'servo', 'motor', 'iha', 'drone', 'gomulu',
  ],
  medicine_biology: [
    'kalp', 'mitral', 'kardiyoloji', 'aort', 'ventrikul', 'atriyum', 'akciger', 'solunum',
    'beyin', 'noron', 'sinaps', 'bobrek', 'nefron', 'dna', 'rna', 'hucre', 'mitokondri',
    'anatomi', 'fizyoloji', 'klinik', 'oskultasyon', 'stetoskop', 'tip', 'hastalik', 'ilac',
  ],
  law_governance: [
    'hukuk', 'istinaf', 'temyiz', 'yargitay', 'danistay', 'mahkeme', 'kanun', 'anayasa',
    'hakim', 'savci', 'avukat', 'dava', 'hukum', 'karar', 'delil', 'sozlesme', 'borclar',
    'ceza', 'medeni', 'kuvvetler ayriligi', 'yasama', 'yargi', 'icra',
  ],
  architecture_civil: [
    'mimarlik', 'mimari', 'ucan payanda', 'payanda', 'kemer', 'tonoz', 'kubbe', 'sutun',
    'korint', 'gotik', 'katedral', 'plan', 'kesit', 'rolove', 'tasiyici', 'statik',
    'betonarme', 'insaat', 'cephe', 'perspektif', 'jeodezik',
  ],
  exact_sciences: [
    'fizik', 'kimya', 'matematik', 'atom', 'molekul', 'kuantum', 'optik', 'prizma',
    'reaksiyon', 'asit', 'baz', 'karmasik sayilar', 'kutupsal', 'turev', 'integral',
    'matris', 'vektor', 'termodinamik', 'olasilik',
  ],
  humanities_social: [
    'tarih', 'osmanli', 'timar', 'iltizam', 'ferman', 'imparatorluk', 'edebiyat', 'roman',
    'siir', 'felsefe', 'sosyoloji', 'psikoloji', 'kultur', 'cografya', 'iklim',
  ],
  business_economics: [
    'iktisat', 'ekonomi', 'enflasyon', 'arz talep', 'merkez bankasi', 'faiz', 'finans',
    'borsa', 'yatirim', 'isletme', 'pazarlama', 'maliyet', 'butce', 'odeme', 'ticaret',
  ],
};

// Contextual Homonym Disambiguation Table (Module 2 Section 2.2)
const HOMONYM_RULES: Record<
  string,
  Partial<Record<DisciplineProfile | 'default', { enSubject: string; proxies: string[]; packId?: string }>>
> = {
  kopru: {
    system_design_cs: {
      enSubject: 'ethernet network switch bridge device with ports',
      proxies: ['network switch', 'router', 'ethernet port', 'hub'],
      packId: 'sd_network_bridge',
    },
    electronics_robotics: {
      enSubject: 'wheatstone diode rectifier circuit bridge',
      proxies: ['electronic circuit', 'diode bridge', 'microchip'],
      packId: 'eng_pcb_circuit',
    },
    architecture_civil: {
      enSubject: 'stone arch and suspension bridge over river',
      proxies: ['suspension bridge', 'arch bridge', 'viaduct'],
      packId: 'arch_structural_bridge',
    },
    medicine_biology: {
      enSubject: 'brainstem pons anatomy and dental bridge',
      proxies: ['brain', 'tooth', 'anatomy'],
      packId: 'med_brain_cortex',
    },
    default: {
      enSubject: 'architectural bridge over water',
      proxies: ['bridge', 'arch bridge'],
      packId: 'arch_structural_bridge',
    },
  },
  kapak: {
    medicine_biology: {
      enSubject: 'anatomical heart mitral valve leaflets',
      proxies: ['anatomical heart', 'heart valve', 'cardiology'],
      packId: 'med_heart_mitral',
    },
    electronics_robotics: {
      enSubject: 'mechanical pressure control valve',
      proxies: ['valve', 'gauge', 'gear'],
    },
    default: {
      enSubject: 'book cover and lid',
      proxies: ['book', 'box'],
    },
  },
  kemer: {
    architecture_civil: {
      enSubject: 'classical stone keystone arch architecture',
      proxies: ['stone arch', 'classical building', 'pillars', 'cathedral'],
      packId: 'arch_geodesic_dome',
    },
    default: {
      enSubject: 'architectural stone arch',
      proxies: ['arch', 'classical building'],
    },
  },
  ag: {
    system_design_cs: {
      enSubject: 'cloud computer network router topology',
      proxies: ['computer network', 'router', 'cloud', 'server'],
      packId: 'sd_core_router',
    },
    medicine_biology: {
      enSubject: 'neural synapse biological network',
      proxies: ['neuron', 'brain', 'capillary'],
      packId: 'med_neuron_synapse',
    },
    default: {
      enSubject: 'connected network nodes',
      proxies: ['network', 'globe'],
    },
  },
  hucre: {
    medicine_biology: {
      enSubject: 'eukaryotic biological cell with nucleus and mitochondria',
      proxies: ['biological cell', 'microscope', 'dna'],
      packId: 'med_cell_mitochondria',
    },
    electronics_robotics: {
      enSubject: 'lithium battery power cell',
      proxies: ['battery', 'lightning'],
      packId: 'eng_bms_battery',
    },
    default: {
      enSubject: 'biological cell',
      proxies: ['cell', 'hexagon'],
    },
  },
  kuyruk: {
    system_design_cs: {
      enSubject: 'distributed message queue pipeline with data packets',
      proxies: ['message queue', 'envelope', 'pipeline', 'arrows'],
      packId: 'sd_kafka_queue',
    },
    default: {
      enSubject: 'queue line sequence',
      proxies: ['queue', 'arrows'],
    },
  },
  yuk: {
    system_design_cs: {
      enSubject: 'server traffic load balancer distribution',
      proxies: ['load balancer', 'server', 'speedometer'],
      packId: 'sd_load_balancer',
    },
    architecture_civil: {
      enSubject: 'structural load force vectors on building',
      proxies: ['pillars', 'weight', 'crane'],
      packId: 'arch_flying_buttress',
    },
    electronics_robotics: {
      enSubject: 'electrical load impedance resistor',
      proxies: ['resistor', 'battery', 'circuit'],
      packId: 'eng_passive_rlc',
    },
    default: {
      enSubject: 'weight balance load',
      proxies: ['balance scale', 'box'],
    },
  },
  dalga: {
    electronics_robotics: {
      enSubject: 'oscilloscope sine signal wave and rf antenna',
      proxies: ['sine wave', 'antenna', 'radio'],
      packId: 'eng_iot_sensor_rf',
    },
    exact_sciences: {
      enSubject: 'electromagnetic light spectrum wave',
      proxies: ['wave', 'prism', 'rainbow'],
      packId: 'sci_optical_prism',
    },
    default: {
      enSubject: 'ocean water wave',
      proxies: ['water wave', 'pulse'],
    },
  },
};

export class TopicContextIntelligence {
  /**
   * Analyzes Root -> Ancestors -> Siblings -> Active Node to detect the map's true academic/engineering discipline.
   */
  public static analyzeMapContext(
    nodes: Record<string, MindNode>,
    rootNodeId: string,
    activeNodeId?: string | null,
    departmentHint: AcademicDepartment = 'genel'
  ): MapContextAnalysis {
    const scores: Record<DisciplineProfile, number> = {
      system_design_cs: 0,
      electronics_robotics: 0,
      medicine_biology: 0,
      law_governance: 0,
      architecture_civil: 0,
      exact_sciences: 0,
      humanities_social: 0,
      business_economics: 0,
    };

    const hinted = DEPARTMENT_TO_DISCIPLINE_HINT[departmentHint];
    if (hinted) {
      scores[hinted] += 2.2;
    }

    // Build ancestor chain from activeNode up to root
    const ancestorIds: string[] = [];
    let cursor: MindNode | undefined = activeNodeId
      ? nodes[activeNodeId]
      : nodes[rootNodeId];
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id);
      ancestorIds.push(cursor.id);
      cursor = cursor.parentId ? nodes[cursor.parentId] : undefined;
    }

    const scoreText = (rawText: string, weight: number) => {
      const norm = normalizeTrAscii(rawText);
      if (!norm) return;
      for (const [disc, keywords] of Object.entries(DISCIPLINE_SIGNAL_WORDS) as Array<
        [DisciplineProfile, string[]]
      >) {
        for (const kw of keywords) {
          if (norm.includes(kw)) {
            scores[disc] += weight * (kw.includes(' ') ? 1.6 : 1.0);
          }
        }
      }
    };

    // Score all nodes lightly, ancestor chain heavily!
    for (const n of Object.values(nodes)) {
      const isActive = n.id === activeNodeId;
      const isRoot = n.id === rootNodeId;
      const isAncestor = ancestorIds.includes(n.id);
      const weight = isActive ? 3.6 : isRoot ? 3.2 : isAncestor ? 2.6 : 0.65;
      scoreText(n.title, weight);
      if (n.subtitle) scoreText(n.subtitle, weight * 0.5);
    }

    let bestDisc: DisciplineProfile = hinted ?? 'system_design_cs';
    let bestScore = -1;
    for (const [disc, sc] of Object.entries(scores) as Array<[DisciplineProfile, number]>) {
      if (sc > bestScore) {
        bestScore = sc;
        bestDisc = disc;
      }
    }

    const activeNode = activeNodeId ? nodes[activeNodeId] : null;
    const parentNode =
      activeNode?.parentId && nodes[activeNode.parentId]
        ? nodes[activeNode.parentId]
        : nodes[rootNodeId];

    const ancestorTitles = ancestorIds
      .slice()
      .reverse()
      .map((id) => nodes[id]?.title ?? '')
      .filter(Boolean);

    const meta = DISCIPLINE_LABELS[bestDisc];
    return {
      discipline: bestDisc,
      label: meta.label,
      emoji: meta.emoji,
      accent: meta.accent,
      ancestorTitles,
      parentTitle: parentNode?.title ?? '',
    };
  }

  /**
   * Expands any Turkish/English node title into concrete English search queries,
   * visual proxies, homonym disambiguation, and pack sticker matches.
   */
  public static expandQueryWithContext(
    rawQuery: string,
    context: MapContextAnalysis,
    wikiEnglishOverride?: string
  ): ExpandedVisualQuery {
    const effectiveInput = rawQuery.trim() || context.parentTitle || context.label;
    const norm = normalizeTrAscii(effectiveInput);
    const words = norm.split(' ').filter((w) => w.length >= 2);
    const wordStems = words.flatMap((w) => stemTurkishWord(w));

    const englishSearchSet = new Set<string>();
    const visualProxies: string[] = [];
    const matchedPackIds = new Set<string>();
    let primaryEnglishSubject = wikiEnglishOverride || '';

    // 1. Check Contextual Homonym Disambiguation first (`"Köprü"`, `"Kapak"`, `"Kemer"`, `"Ağ"`, `"Hücre"`, `"Kuyruk"`, `"Yük"`, `"Dalga"`)
    for (const st of [norm, ...wordStems]) {
      const homonym = HOMONYM_RULES[st];
      if (homonym) {
        const branchRule = homonym[context.discipline] ?? homonym.default;
        if (branchRule) {
          if (!primaryEnglishSubject) primaryEnglishSubject = branchRule.enSubject;
          branchRule.proxies.forEach((p) => {
            englishSearchSet.add(p);
            visualProxies.push(p);
          });
          if (branchRule.packId) matchedPackIds.add(branchRule.packId);
        }
      }
    }

    // 2. Match against 850+ Academic Ontology TR
    const scoredConcepts: Array<{ entry: (typeof PARSED_ONTOLOGY)[number]; score: number }> = [];
    for (const entry of PARSED_ONTOLOGY) {
      let score = 0;
      for (const trTerm of entry.tr) {
        const tNorm = normalizeTrAscii(trTerm);
        if (tNorm === norm) {
          score = Math.max(score, 1.0);
        } else if (norm.includes(tNorm) || (norm.length >= 4 && tNorm.includes(norm))) {
          score = Math.max(score, 0.86);
        } else {
          for (const st of wordStems) {
            if (st.length >= 3 && tNorm.split(' ').some((tw) => tw.startsWith(st) || st.startsWith(tw))) {
              score = Math.max(score, 0.68);
            }
          }
        }
      }
      if (score > 0 && entry.discipline === context.discipline) {
        score += 0.14;
      }
      if (score > 0) {
        scoredConcepts.push({ entry, score });
      }
    }
    scoredConcepts.sort((a, b) => b.score - a.score);

    for (const sc of scoredConcepts.slice(0, 4)) {
      if (!primaryEnglishSubject) {
        primaryEnglishSubject = sc.entry.enPrimary;
      }
      englishSearchSet.add(sc.entry.enPrimary);
      for (const vp of sc.entry.visualProxies) {
        englishSearchSet.add(vp);
        visualProxies.push(vp);
      }
      if (sc.entry.packId) {
        matchedPackIds.add(sc.entry.packId);
      }
    }

    // 3. Direct search across `SYSTEM_DESIGN_AND_ATLAS_PACK` tags
    for (const item of SYSTEM_DESIGN_AND_ATLAS_PACK) {
      const allTags = [...item.tagsTr, ...item.tagsEn].map(normalizeTrAscii);
      const hit = allTags.some(
        (t) =>
          t === norm ||
          (norm.length >= 3 && (t.includes(norm) || norm.includes(t))) ||
          wordStems.some((st) => st.length >= 4 && t.includes(st))
      );
      if (hit) {
        // Respect homonym discipline priority (e.g., "köprü" in architecture shouldn't put network bridge first)
        if (norm === 'kopru' && item.discipline !== context.discipline) {
          continue;
        }
        matchedPackIds.add(item.id);
        englishSearchSet.add(item.titleEn.toLowerCase());
      }
    }

    // 4. Live Wikipedia English override if provided
    if (wikiEnglishOverride) {
      englishSearchSet.add(wikiEnglishOverride.toLowerCase());
    }

    // 5. Fast Stem-by-Stem Translation Fallback so raw Turkish NEVER reaches English icon APIs!
    const translatedWords: string[] = [];
    for (const w of words) {
      const stems = stemTurkishWord(w);
      let foundEn: string | null = null;
      for (const s of stems) {
        if (FAST_WORD_TRANSLATION_MAP[s]) {
          foundEn = FAST_WORD_TRANSLATION_MAP[s];
          break;
        }
      }
      // Keep word if it looks like an international tech/Latin word (redis, api, mitral, opamp, sql)
      if (foundEn) {
        translatedWords.push(foundEn);
        englishSearchSet.add(foundEn);
      } else if (/^[a-z0-9-]+$/.test(w) && w.length >= 3) {
        translatedWords.push(w);
      }
    }

    if (!primaryEnglishSubject) {
      primaryEnglishSubject =
        translatedWords.join(' ') ||
        DISCIPLINE_CONCRETE_FALLBACKS[context.discipline][0];
    }

    if (translatedWords.length > 0) {
      englishSearchSet.add(translatedWords.join(' '));
    }

    // Add 2 discipline-faithful visual anchor terms at the tail so every search always yields 40-100+ items
    for (const anchor of DISCIPLINE_CONCRETE_FALLBACKS[context.discipline]) {
      englishSearchSet.add(anchor);
    }

    const turkishSearchTerms = [
      effectiveInput.trim(),
      ...words.filter((w) => w.length >= 3),
    ].slice(0, 3);

    const metaphorChips = buildMetaphorChipsForConcept(
      visualProxies.length > 0
        ? visualProxies
        : DISCIPLINE_CONCRETE_FALLBACKS[context.discipline],
      primaryEnglishSubject
    );

    return {
      originalQuery: rawQuery,
      activeDiscipline: context.discipline,
      primaryEnglishSubject,
      englishSearchTerms: Array.from(englishSearchSet).slice(0, 8),
      turkishSearchTerms,
      matchedPackIds: Array.from(matchedPackIds),
      metaphorChips,
    };
  }

  /**
   * Proactive Zero-Keystroke Sub-Branch Predictor (Module 2 Section 2.4 & Module 4 `🪄`).
   * Suggests 6–8 ready-to-add sub-branches WITH matched colorful stickers BEFORE the user types a single character!
   */
  public static getProactiveSubBranches(
    parentTitle: string,
    context: MapContextAnalysis,
    existingSiblingTitles: string[] = []
  ): ProactiveBranchSuggestion[] {
    const pNorm = normalizeTrAscii(parentTitle);
    const existingNorms = new Set(existingSiblingTitles.map(normalizeTrAscii));

    const makeSticker = (packId: string, label: string): StickerAsset => {
      const pack = getPackStickerById(packId) ?? SYSTEM_DESIGN_AND_ATLAS_PACK[0];
      return {
        id: `proactive_${pack.id}`,
        url: pack.svgDataUri,
        mode: 'illustration',
        source: 'library',
        dieCutProcessed: true,
        aspectRatio: 1,
        label,
      };
    };

    type PresetItem = [title: string, packId: string, techBadge?: string];
    let items: PresetItem[] = [];

    if (pNorm.includes('kalp') || pNorm.includes('mitral') || pNorm.includes('kardiy')) {
      items = [
        ['Mitral Kapak Anatomisi', 'med_heart_mitral', 'Sol Atriyum → Sol Ventrikül'],
        ['Sinoatriyal Düğüm & EKG', 'med_sa_node_ecg', '60-100 atım/dk Pacemaker'],
        ['Pulmoner Arter & Akciğer', 'med_lungs_alveoli', 'Küçük Dolaşım'],
        ['Klinik Oskültasyon & Ekokardiyografi', 'med_stethoscope_clinic', 'Apeks Odak'],
        ['Aort & Sistemik Dolaşım', 'med_heart_mitral', 'Yüksek Basınç'],
        ['Otonom Sinir Regülasyonu', 'med_neuron_synapse', 'N. Vagus & Sempatik'],
      ];
    } else if (pNorm.includes('op-amp') || pNorm.includes('yukseltec') || pNorm.includes('elektronik')) {
      items = [
        ['Eviren Yükselteç Topolojisi', 'eng_opamp_inverting', 'Av = -Rf / Rin'],
        ['Pasif RLC Filtre Katmanı', 'eng_passive_rlc', 'fc = 1 / (2πRC)'],
        ['Mikrodenetleyici ADC Örnekleme', 'eng_mcu_arduino', '12-bit SAR ADC'],
        ['Lityum Batarya & BMS Besleme', 'eng_bms_battery', '±12V Simetrik Güç'],
        ['PCB Bakır Yol & Topraklama', 'eng_pcb_circuit', 'Star Ground'],
        ['RF Telemetri Çıkışı', 'eng_iot_sensor_rf', '433 MHz / 2.4 GHz'],
      ];
    } else if (pNorm.includes('istinaf') || pNorm.includes('kanun yol') || pNorm.includes('hukuk') || pNorm.includes('yargi')) {
      items = [
        ['Bölge Adliye Mahkemesi (İstinaf)', 'law_istinaf_scales', 'HMK m.341 • CMK m.272'],
        ['Yargıtay Temyiz Denetimi', 'law_separation_powers', 'Hukuka Uygunluk'],
        ['Bozma, Onama & Esastan Ret', 'law_judge_gavel', 'Duruşmalı İnceleme'],
        ['Delil Tespiti & Bilirkişi', 'law_evidence_discovery', 'Vakıa Denetimi'],
        ['Başvuru Süresi & Dilekçe', 'law_contract_seal', 'Tebliğden 2 Hafta'],
        ['Kuvvetler Ayrılığı & Anayasa', 'law_separation_powers', 'Yargı Bağımsızlığı'],
      ];
    } else if (pNorm.includes('mimar') || pNorm.includes('gotik') || pNorm.includes('payanda') || pNorm.includes('kemer') || pNorm.includes('tasiyici')) {
      items = [
        ['Uçan Payanda (Flying Buttress)', 'arch_flying_buttress', 'Yanal İtki Aktarımı'],
        ['Korint Sütunu & Klasik Düzen', 'arch_corinthian_column', 'Düşey Yük Taşıyıcı'],
        ['Jeodezik Kubbe & Tonoz', 'arch_geodesic_dome', 'Basınç Kemeri'],
        ['Asma & Taş Kemer Köprü', 'arch_structural_bridge', 'Açıklık Geçme'],
        ['Mimari Plan, Kesit & Rölöve', 'arch_blueprint_compass', '1:50 Ölçek'],
      ];
    } else if (pNorm.includes('osmanli') || pNorm.includes('timar') || pNorm.includes('tarih')) {
      items = [
        ['Osmanlı Tımar & Dirlik Sistemi', 'hist_ottoman_timar', 'Tımarlı Sipahi'],
        ['Merkezi Hazine & İltizam', 'econ_supply_demand', 'Mültezim Vergi'],
        ['Divan-ı Hümayun & Kanunname', 'law_contract_seal', 'Örfi & Şer’i Hukuk'],
        ['Eyalet & Sancak İdaresi', 'law_separation_powers', 'Taşra Teşkilatı'],
        ['Tarihsel Kaynak & Kronoloji', 'hum_books_literature', 'Arşiv Belgeleri'],
      ];
    } else if (context.discipline === 'medicine_biology') {
      items = [
        ['Hücresel Yapı & Mitokondri', 'med_cell_mitochondria', 'ATP Sentezi'],
        ['Nöron & Sinaptik İletim', 'med_neuron_synapse', 'Aksiyon Potansiyeli'],
        ['Böbrek Nefron Filtrasyonu', 'med_kidney_nephron', 'GFR Homeostaz'],
        ['DNA Genetik Ekspresyon', 'med_dna_cell', 'Transkripsiyon'],
        ['Mikroskobik Histoloji', 'med_microscope_lab', 'Doku Analizi'],
        ['Klinik Muayene Bulguları', 'med_stethoscope_clinic', 'Semiyoloji'],
      ];
    } else if (context.discipline === 'electronics_robotics') {
      items = [
        ['İşlemsel Yükselteç (Op-Amp)', 'eng_opamp_inverting', 'Analog Sinyal'],
        ['Sayısal Mantık Kapıları', 'eng_logic_gates', 'FPGA / CMOS'],
        ['Mikrodenetleyici Birimi', 'eng_mcu_arduino', 'ARM Cortex-M'],
        ['Sensör & RF Haberleşme', 'eng_iot_sensor_rf', 'SPI / I2C / LoRa'],
        ['Servo Eyleyici & PID', 'eng_servo_actuator', 'Kapalı Çevrim'],
        ['Batarya Yönetim Sistemi (BMS)', 'eng_bms_battery', 'Li-Ion Koruma'],
      ];
    } else if (context.discipline === 'law_governance') {
      items = [
        ['İstinaf & Üst Derece Denetimi', 'law_istinaf_scales', 'Maddi + Hukuki'],
        ['Mahkeme Hükmü & Karar', 'law_judge_gavel', 'Gerekçeli Karar'],
        ['Delil Tespiti & İspat Yükü', 'law_evidence_discovery', 'HMK m.190'],
        ['Sözleşme & Borç İlişkisi', 'law_contract_seal', 'TBK Hükümleri'],
        ['Anayasal Kuvvetler Ayrılığı', 'law_separation_powers', 'Normlar Hiyerarşisi'],
      ];
    } else if (context.discipline === 'architecture_civil') {
      items = [
        ['Gotik Uçan Payanda', 'arch_flying_buttress', 'Yanal Destek'],
        ['Kemer, Tonoz & Kubbe', 'arch_geodesic_dome', 'Kagir Strüktür'],
        ['Klasik Sütun & Başlık', 'arch_corinthian_column', 'Taşıyıcı Eleman'],
        ['Yapısal Köprü & Açıklık', 'arch_structural_bridge', 'Çekme / Basınç'],
        ['Plan, Kesit & Perspektif', 'arch_blueprint_compass', 'Mimari Anlatım'],
      ];
    } else if (context.discipline === 'exact_sciences') {
      items = [
        ['Atom & Kuantum Orbitalleri', 'sci_atom_quantum', 'Schrödinger'],
        ['Kimyasal Reaksiyon & Denge', 'sci_chemistry_flask', 'ΔG = ΔH - TΔS'],
        ['Optik Prizma & Dalga Boyu', 'sci_optical_prism', 'Snell Yasası'],
        ['Kutupsal Gösterim & Vektörler', 'sci_polar_unit_circle', 'z = r·e^(iθ)'],
      ];
    } else if (context.discipline === 'business_economics') {
      items = [
        ['Arz-Talep Piyasa Dengesi', 'econ_supply_demand', 'Esneklik Analizi'],
        ['Ödeme Geçidi & Finansal Akış', 'sd_payment_ledger', 'Nakit Akışı'],
        ['Veri Analitiği & Büyüme', 'sd_data_warehouse', 'KPI & ROI'],
        ['Regülasyon & Sözleşme Hukuku', 'law_contract_seal', 'Ticari Uyum'],
      ];
    } else {
      // Default Flagship: System Design & Distributed Cloud Architecture
      items = [
        ['Yük Dengeleyici (Load Balancer)', 'sd_load_balancer', 'L7 Round-Robin'],
        ['API Gateway & Rate Limiter', 'sd_api_gateway', 'Port 443 • HTTPS'],
        ['Redis Bellek İçi Önbellek', 'sd_redis_cache', 'Sub-ms Cache Hit'],
        ['Veritabanı Sharding Kümesi', 'sd_db_sharding', 'Consistent Hashing'],
        ['Kafka Olay Kuyruğu (Event Stream)', 'sd_kafka_queue', 'Async Pub/Sub'],
        ['CDN Kenar Dağıtım Ağı', 'sd_cdn_edge', 'Edge PoP'],
        ['Mikroservis & Kubernetes Kümesi', 'sd_kubernetes', 'Auto-Scaling Pods'],
        ['WAF Güvenlik & OAuth2 JWT', 'sd_waf_firewall', 'Zero-Trust'],
      ];
    }

    return items
      .filter(([title]) => !existingNorms.has(normalizeTrAscii(title)))
      .slice(0, 7)
      .map(([title, packId, techBadge], i) => ({
        id: `sug_${packId}_${i}`,
        title,
        techBadge,
        sticker: makeSticker(packId, title),
      }));
  }
}

const DISCIPLINE_CONCRETE_FALLBACKS: Record<DisciplineProfile, string[]> = {
  system_design_cs: ['server', 'database', 'cloud network', 'microchip', 'shield'],
  electronics_robotics: ['circuit', 'microchip', 'battery', 'gear', 'antenna'],
  medicine_biology: ['anatomical heart', 'microscope', 'dna', 'brain', 'stethoscope'],
  law_governance: ['balance scale', 'gavel', 'courthouse', 'scroll', 'book'],
  architecture_civil: ['classical building', 'arch', 'bridge', 'blueprint', 'dome'],
  exact_sciences: ['atom', 'test tube', 'compass', 'chart', 'prism'],
  humanities_social: ['scroll', 'books', 'globe', 'crown', 'feather'],
  business_economics: ['chart increasing', 'coins', 'bank', 'briefcase', 'credit card'],
};
