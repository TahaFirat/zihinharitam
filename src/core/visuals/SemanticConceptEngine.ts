import type { AcademicDepartment } from '../../types/mindmap';

export interface AcademicConceptEntry {
  id: string;
  department: AcademicDepartment;
  trTerms: string[];
  enTerms: string[];
  wikimediaQuery: string;
  iconifyQuery: string;
  fluent3dUrl?: string;
  builtInIllustrationKey: string;
  builtInDiagramKey?: string;
}

const FLUENT_3D_BASE =
  'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

/**
 * Curated Multilingual Academic Ontology (Turkish <-> English/Latin)
 * Powers <5ms local vector search + cross-lingual open library queries.
 */
export const ACADEMIC_CONCEPT_LEXICON: AcademicConceptEntry[] = [
  // ======================== TIP, BİYOLOJİ & SAĞLIK ========================
  {
    id: 'med_heart_mitral',
    department: 'tip',
    trTerms: ['mitral kapak', 'kalp', 'kardiyoloji', 'biküspit kapak', 'aort', 'ventrikül', 'atriyum', 'kalp kapakları', 'dolaşım sistemi', 'miyokard'],
    enTerms: ['mitral valve', 'anatomical heart', 'cardiology', 'heart chambers', 'aorta'],
    wikimediaQuery: 'Mitral valve heart anatomy',
    iconifyQuery: 'heart organ cardiology',
    fluent3dUrl: `${FLUENT_3D_BASE}/Anatomical%20heart/3D/anatomical_heart_3d.png`,
    builtInIllustrationKey: 'heart_anatomy',
    builtInDiagramKey: 'mitral_valve_schema',
  },
  {
    id: 'med_lungs',
    department: 'tip',
    trTerms: ['akciğer', 'solunum', 'alveol', 'bronş', 'diyafram', 'toraks', 'pnömoni', 'oksijen değişimi'],
    enTerms: ['lungs', 'respiratory system', 'alveoli', 'bronchi', 'pulmonary'],
    wikimediaQuery: 'Human lungs anatomy',
    iconifyQuery: 'lungs respiratory',
    fluent3dUrl: `${FLUENT_3D_BASE}/Lungs/3D/lungs_3d.png`,
    builtInIllustrationKey: 'lungs_anatomy',
    builtInDiagramKey: 'respiratory_schema',
  },
  {
    id: 'med_brain_neuron',
    department: 'tip',
    trTerms: ['beyin', 'nöron', 'sinaps', 'sinir sistemi', 'nöroloji', 'korteks', 'akson', 'dendrit', 'aksiyon potansiyeli'],
    enTerms: ['brain', 'neuron', 'synapse', 'nervous system', 'neurology', 'action potential'],
    wikimediaQuery: 'Neuron synapse anatomy',
    iconifyQuery: 'brain neuron',
    fluent3dUrl: `${FLUENT_3D_BASE}/Brain/3D/brain_3d.png`,
    builtInIllustrationKey: 'brain_neuron',
    builtInDiagramKey: 'neuron_synapse_schema',
  },
  {
    id: 'med_dna_genetics',
    department: 'tip',
    trTerms: ['dna', 'rna', 'genetik', 'kromozom', 'nükleotid', 'replikasyon', 'genom', 'heliks', 'mutasyon', 'protein sentezi'],
    enTerms: ['dna double helix', 'genetics', 'chromosome', 'rna transcription'],
    wikimediaQuery: 'DNA double helix structure',
    iconifyQuery: 'dna helix genetics',
    fluent3dUrl: `${FLUENT_3D_BASE}/Dna/3D/dna_3d.png`,
    builtInIllustrationKey: 'dna_helix',
    builtInDiagramKey: 'dna_schema',
  },
  {
    id: 'med_cell_micro',
    department: 'tip',
    trTerms: ['hücre', 'mitokondri', 'ribozom', 'organel', 'mikroskop', 'bakteri', 'virüs', 'bağışıklık', 'antikor', 'reseptör', 'enzim'],
    enTerms: ['biological cell', 'mitochondria', 'microscope', 'microbiology', 'organelle'],
    wikimediaQuery: 'Animal cell structure',
    iconifyQuery: 'microscope cell bacteria',
    fluent3dUrl: `${FLUENT_3D_BASE}/Microscope/3D/microscope_3d.png`,
    builtInIllustrationKey: 'cell_biology',
    builtInDiagramKey: 'cell_organelle_schema',
  },
  {
    id: 'med_clinical_exam',
    department: 'tip',
    trTerms: ['oskültasyon', 'stetoskop', 'üfürüm', 'ekokardiyografi', 'ekg', 'muayene', 'tanı', 'semptom', 'klinik', 'ilaç', 'farmakoloji'],
    enTerms: ['stethoscope', 'echocardiography', 'clinical diagnosis', 'auscultation', 'ecg'],
    wikimediaQuery: 'Stethoscope clinical examination',
    iconifyQuery: 'stethoscope medical pulse',
    fluent3dUrl: `${FLUENT_3D_BASE}/Stethoscope/3D/stethoscope_3d.png`,
    builtInIllustrationKey: 'stethoscope_clinic',
    builtInDiagramKey: 'ecg_waveform_schema',
  },
  {
    id: 'med_bone_anatomy',
    department: 'tip',
    trTerms: ['iskelet', 'kemik', 'eklem', 'anatomi', 'kafatası', 'omurga', 'ortopedi', 'kas'],
    enTerms: ['skeleton bone', 'orthopedics', 'human anatomy joint', 'spine'],
    wikimediaQuery: 'Human skeleton joint anatomy',
    iconifyQuery: 'bone skeleton anatomy',
    fluent3dUrl: `${FLUENT_3D_BASE}/Bone/3D/bone_3d.png`,
    builtInIllustrationKey: 'bone_joint',
  },

  // ======================== MÜHENDİSLİK & TEKNOLOJİ ========================
  {
    id: 'eng_opamp_circuit',
    department: 'muhendislik',
    trTerms: ['eviren yükselteç', 'op-amp', 'işlemsel yükselteç', 'evirmeyen yükselteç', 'geri besleme', 'kazanç', 'elektronik devre', 'analog elektronik', 'filtre', 'osilatör'],
    enTerms: ['operational amplifier', 'inverting amplifier', 'op-amp circuit', 'feedback electronics'],
    wikimediaQuery: 'Operational amplifier inverting circuit',
    iconifyQuery: 'circuit amplifier electronics',
    fluent3dUrl: `${FLUENT_3D_BASE}/Electric%20plug/3D/electric_plug_3d.png`,
    builtInIllustrationKey: 'opamp_electronics',
    builtInDiagramKey: 'opamp_inverting_schema',
  },
  {
    id: 'eng_microcontroller_cpu',
    department: 'muhendislik',
    trTerms: ['mikrodenetleyici', 'işlemci', 'cpu', 'gömülü sistem', 'arduino', 'fpga', 'transistör', 'yarı iletken', 'mantık kapıları', 'donanım'],
    enTerms: ['microcontroller', 'microprocessor chip', 'integrated circuit', 'semiconductor'],
    wikimediaQuery: 'Microcontroller integrated circuit',
    iconifyQuery: 'cpu microchip processor',
    fluent3dUrl: `${FLUENT_3D_BASE}/Desktop%20computer/3D/desktop_computer_3d.png`,
    builtInIllustrationKey: 'microchip_cpu',
    builtInDiagramKey: 'logic_circuit_schema',
  },
  {
    id: 'eng_passive_components',
    department: 'muhendislik',
    trTerms: ['direnç', 'kondansatör', 'bobin', 'indüktör', 'diyot', 'empedans', 'voltaj', 'akım', 'ohm kanunu', 'kirchhoff', 'sensör'],
    enTerms: ['resistor capacitor inductor', 'electronic components', 'voltage current'],
    wikimediaQuery: 'Electronic components resistor capacitor',
    iconifyQuery: 'resistor capacitor battery',
    fluent3dUrl: `${FLUENT_3D_BASE}/Battery/3D/battery_3d.png`,
    builtInIllustrationKey: 'circuit_components',
    builtInDiagramKey: 'rlc_circuit_schema',
  },
  {
    id: 'eng_mechanical_gears',
    department: 'muhendislik',
    trTerms: ['makine', 'dişli', 'tork', 'mekanik', 'termodinamik', 'akışkanlar', 'motor', 'dinamik', 'mukavemet', 'robotik'],
    enTerms: ['mechanical gear', 'torque engine', 'thermodynamics', 'robotics'],
    wikimediaQuery: 'Mechanical gears transmission',
    iconifyQuery: 'gear mechanical engine robot',
    fluent3dUrl: `${FLUENT_3D_BASE}/Gear/3D/gear_3d.png`,
    builtInIllustrationKey: 'mechanical_gears',
    builtInDiagramKey: 'force_torque_schema',
  },
  {
    id: 'eng_software_ai',
    department: 'muhendislik',
    trTerms: ['algoritma', 'yapay zeka', 'veri yapısı', 'sinir ağı', 'makine öğrenmesi', 'yazılım', 'veritabanı', 'ağ', 'bulut', 'kodlama'],
    enTerms: ['algorithm', 'neural network', 'artificial intelligence', 'data structure'],
    wikimediaQuery: 'Artificial neural network diagram',
    iconifyQuery: 'network algorithm code ai',
    fluent3dUrl: `${FLUENT_3D_BASE}/Robot/3D/robot_3d.png`,
    builtInIllustrationKey: 'ai_network',
    builtInDiagramKey: 'neural_net_schema',
  },

  // ======================== HUKUK & KAMU ========================
  {
    id: 'law_appellate_court',
    department: 'hukuk',
    trTerms: ['istinaf', 'istinaf mahkemesi', 'bölge adliye mahkemesi', 'temyiz', 'yargıtay', 'danıştay', 'kanun yolları', 'yargı', 'mahkeme', 'üst derece mahkemesi'],
    enTerms: ['appellate court', 'court of appeals', 'scales of justice', 'judiciary hierarchy'],
    wikimediaQuery: 'Scales of justice courthouse',
    iconifyQuery: 'scales justice court law',
    fluent3dUrl: `${FLUENT_3D_BASE}/Balance%20scale/3D/balance_scale_3d.png`,
    builtInIllustrationKey: 'justice_scales',
    builtInDiagramKey: 'judicial_hierarchy_schema',
  },
  {
    id: 'law_judge_verdict',
    department: 'hukuk',
    trTerms: ['hüküm', 'karar', 'hakim', 'yargıç', 'duruşma', 'ceza hukuku', 'medeni usul', 'kesinleşme', 'bozma kararı', 'kabul', 'ret'],
    enTerms: ['judge gavel', 'legal verdict', 'courtroom trial', 'criminal law'],
    wikimediaQuery: 'Judge gavel courtroom',
    iconifyQuery: 'gavel judge hammer',
    fluent3dUrl: `${FLUENT_3D_BASE}/Hammer/3D/hammer_3d.png`,
    builtInIllustrationKey: 'judge_gavel',
  },
  {
    id: 'law_constitution_code',
    department: 'hukuk',
    trTerms: ['anayasa', 'kanun', 'mevzuat', 'sözleşme', 'borçlar hukuku', 'medeni hukuk', 'idare hukuku', 'dilekçe', 'hak', 'mülkiyet', 'delil'],
    enTerms: ['constitution law book', 'legal contract', 'statute legislation'],
    wikimediaQuery: 'Law books legal code',
    iconifyQuery: 'law book contract scroll',
    fluent3dUrl: `${FLUENT_3D_BASE}/Scroll/3D/scroll_3d.png`,
    builtInIllustrationKey: 'law_constitution',
  },

  // ======================== MİMARLIK & SANAT TARİHİ ========================
  {
    id: 'arch_flying_buttress',
    department: 'mimarlik',
    trTerms: ['uçan payanda', 'payanda', 'gotik mimari', 'kaburgalı tonoz', 'sivri kemer', 'katedral', 'yanal itki', 'taşıyıcı sistem'],
    enTerms: ['flying buttress', 'gothic architecture vault', 'pointed arch structure'],
    wikimediaQuery: 'Flying buttress gothic architecture',
    iconifyQuery: 'arch cathedral pillar',
    fluent3dUrl: `${FLUENT_3D_BASE}/Classical%20building/3D/classical_building_3d.png`,
    builtInIllustrationKey: 'flying_buttress',
    builtInDiagramKey: 'flying_buttress_schema',
  },
  {
    id: 'arch_arch_vault_dome',
    department: 'mimarlik',
    trTerms: ['kemer', 'tonoz', 'kubbe', 'beşik tonoz', 'çapraz tonoz', 'pandantif', 'kasnak', 'sütun', 'kilit taşı', 'antik mimari'],
    enTerms: ['architectural arch vault dome', 'keystone', 'roman barrel vault', 'column'],
    wikimediaQuery: 'Barrel vault keystone arch architecture',
    iconifyQuery: 'dome arch column temple',
    fluent3dUrl: `${FLUENT_3D_BASE}/Classical%20building/3D/classical_building_3d.png`,
    builtInIllustrationKey: 'dome_arch_vault',
    builtInDiagramKey: 'arch_vault_schema',
  },
  {
    id: 'arch_plan_section',
    department: 'mimarlik',
    trTerms: ['plan', 'kesit', 'görünüş', 'perspektif', 'ölçek', 'eskiz', 'akustik', 'ışık', 'mekan', 'cephe', 'tasarım', 'şehircilik'],
    enTerms: ['architectural blueprint plan', 'building section elevation', 'drafting compass'],
    wikimediaQuery: 'Architectural plan section drawing',
    iconifyQuery: 'blueprint compass ruler architecture',
    fluent3dUrl: `${FLUENT_3D_BASE}/Triangular%20ruler/3D/triangular_ruler_3d.png`,
    builtInIllustrationKey: 'architect_blueprint',
    builtInDiagramKey: 'section_elevation_schema',
  },

  // ======================== TEMEL BİLİMLER (MATEMATİK, FİZİK, KİMYA) ========================
  {
    id: 'sci_complex_polar',
    department: 'temel_bilimler',
    trTerms: ['karmaşık sayılar', 'kutupsal gösterim', 'euler formülü', 'birim çember', 'vektör', 'trigonometri', 'türev', 'integral', 'matris', 'fonksiyon', 'matematik'],
    enTerms: ['complex plane polar coordinates', 'unit circle euler', 'mathematics graph'],
    wikimediaQuery: 'Complex number polar coordinates',
    iconifyQuery: 'math function coordinate graph',
    fluent3dUrl: `${FLUENT_3D_BASE}/Abacus/3D/abacus_3d.png`,
    builtInIllustrationKey: 'polar_math',
    builtInDiagramKey: 'polar_complex_schema',
  },
  {
    id: 'sci_chemistry_atom',
    department: 'temel_bilimler',
    trTerms: ['atom', 'molekül', 'kimyasal bağ', 'periyodik tablo', 'asit', 'baz', 'reaksiyon', 'orbital', 'kuantum', 'termokimya', 'deney'],
    enTerms: ['atom orbital', 'chemistry flask molecule', 'chemical reaction'],
    wikimediaQuery: 'Atom orbital molecule chemistry',
    iconifyQuery: 'atom flask chemistry molecule',
    fluent3dUrl: `${FLUENT_3D_BASE}/Test%20tube/3D/test_tube_3d.png`,
    builtInIllustrationKey: 'chemistry_atom',
    builtInDiagramKey: 'atomic_orbital_schema',
  },

  // ======================== SOSYAL BİLİMLER (TARİH, İKTİSAT, EDEBİYAT) ========================
  {
    id: 'soc_ottoman_history',
    department: 'sosyal_bilimler',
    trTerms: ['iltizam', 'iltizam sistemi', 'tımar', 'osmanlı', 'mültezim', 'hazine', 'vergi', 'tarih', 'imparatorluk', 'ferman', 'divan'],
    enTerms: ['ottoman empire history', 'historical scroll treasury', 'tax farming'],
    wikimediaQuery: 'Ottoman miniature manuscript',
    iconifyQuery: 'scroll crown treasure castle',
    fluent3dUrl: `${FLUENT_3D_BASE}/Scroll/3D/scroll_3d.png`,
    builtInIllustrationKey: 'ottoman_iltizam',
    builtInDiagramKey: 'iltizam_flow_schema',
  },
  {
    id: 'soc_economics_market',
    department: 'sosyal_bilimler',
    trTerms: ['arz talep', 'enflasyon', 'iktisat', 'ekonomi', 'merkez bankası', 'faiz', 'piyasa dengesi', 'gsyih', 'finans', 'maliyet'],
    enTerms: ['supply and demand', 'macroeconomics', 'market equilibrium chart'],
    wikimediaQuery: 'Supply and demand equilibrium',
    iconifyQuery: 'chart finance economy coin',
    fluent3dUrl: `${FLUENT_3D_BASE}/Chart%20increasing/3D/chart_increasing_3d.png`,
    builtInIllustrationKey: 'economics_supply',
    builtInDiagramKey: 'supply_demand_schema',
  },
  {
    id: 'soc_literature_book',
    department: 'sosyal_bilimler',
    trTerms: ['edebiyat', 'roman', 'şiir', 'felsefe', 'psikoloji', 'sosyoloji', 'dilbilim', 'kavram', 'kuram', 'makale', 'tez'],
    enTerms: ['literature books', 'philosophy quill', 'academic study'],
    wikimediaQuery: 'Open book quill literature',
    iconifyQuery: 'books feather study idea',
    fluent3dUrl: `${FLUENT_3D_BASE}/Books/3D/books_3d.png`,
    builtInIllustrationKey: 'academic_books',
  },
];

/**
 * Normalizes Turkish & Latin characters and strips common agglutinative suffixes
 * so queries like "Mitral kapağın", "İstinafta", "Yükselteçler" match accurately.
 */
export function normalizeTurkishAcademicText(input: string): string {
  const lower = input
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return lower
    .split(' ')
    .map((word) => {
      if (word.length <= 4) return word;
      return word.replace(
        /(lari|leri|lar|ler|nin|nun|dan|den|tan|ten|nda|nde|lik|luk|sel|sal|in|un|da|de|ta|te)$/,
        ''
      );
    })
    .join(' ');
}

/**
 * Deterministic 384-dimensional multilingual character n-gram + semantic anchor embedding (<2ms).
 * Used for local IndexedDB `shared_stickers` cosine deduplication and `pgvector` compatibility.
 */
export function computeMultilingualEmbedding(text: string): number[] {
  const dim = 384;
  const vec = new Float32Array(dim);
  const norm = normalizeTurkishAcademicText(text);

  // Enrich vector with matched ontology English anchors so Turkish & English share vector space!
  const matched = findSemanticAcademicMatches(text, 2);
  const combined = [
    norm,
    ...matched.flatMap((m) => m.entry.enTerms.map((e) => normalizeTurkishAcademicText(e))),
  ].join(' ');

  const padded = `  ${combined}  `;
  for (let i = 0; i < padded.length - 2; i++) {
    const trigram = padded.slice(i, i + 3);
    let h1 = 2166136261;
    for (let c = 0; c < trigram.length; c++) {
      h1 ^= trigram.charCodeAt(c);
      h1 = Math.imul(h1, 16777619);
    }
    const idx = Math.abs(h1) % dim;
    const sign = (h1 & 1) === 0 ? 1 : -1;
    vec[idx] += sign * 1.0;
  }

  let magSq = 0;
  for (let i = 0; i < dim; i++) magSq += vec[i] * vec[i];
  const mag = Math.sqrt(magSq) || 1;
  const out = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    out[i] = Number((vec[i] / mag).toFixed(5));
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export interface ScoredConceptMatch {
  entry: AcademicConceptEntry;
  score: number;
}

export function findSemanticAcademicMatches(
  query: string,
  limit = 6,
  preferredDepartment?: AcademicDepartment
): ScoredConceptMatch[] {
  const qNorm = normalizeTurkishAcademicText(query);
  if (!qNorm) {
    // Return diverse top academic entries prioritized by department
    return ACADEMIC_CONCEPT_LEXICON.filter(
      (e) => !preferredDepartment || preferredDepartment === 'genel' || e.department === preferredDepartment
    )
      .slice(0, limit)
      .map((entry, idx) => ({ entry, score: 0.7 - idx * 0.03 }));
  }

  const qTokens = qNorm.split(' ').filter((t) => t.length >= 2);
  const scored: ScoredConceptMatch[] = [];

  for (const entry of ACADEMIC_CONCEPT_LEXICON) {
    let bestScore = 0;
    const allTerms = [...entry.trTerms, ...entry.enTerms];

    for (const rawTerm of allTerms) {
      const tNorm = normalizeTurkishAcademicText(rawTerm);
      if (tNorm === qNorm) {
        bestScore = Math.max(bestScore, 1.0);
      } else if (tNorm.includes(qNorm) || qNorm.includes(tNorm)) {
        bestScore = Math.max(bestScore, 0.88);
      } else {
        for (const qt of qTokens) {
          if (qt.length >= 3 && tNorm.includes(qt)) {
            bestScore = Math.max(bestScore, 0.72);
          }
        }
      }
    }

    if (bestScore > 0 && preferredDepartment && entry.department === preferredDepartment) {
      bestScore = Math.min(1, bestScore + 0.06);
    }

    if (bestScore > 0) {
      scored.push({ entry, score: bestScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Translates/expands any Turkish academic query into global English/scientific search terms.
 */
export function expandQueryToGlobalTerms(
  query: string,
  department: AcademicDepartment = 'genel'
): {
  primaryEnglish: string;
  iconifyQuery: string;
  wikimediaQuery: string;
  matches: ScoredConceptMatch[];
} {
  const clean = query.trim();
  const matches = findSemanticAcademicMatches(clean, 4, department);

  if (matches.length > 0 && matches[0].score >= 0.68) {
    const top = matches[0].entry;
    return {
      primaryEnglish: top.enTerms[0],
      iconifyQuery: top.iconifyQuery,
      wikimediaQuery: top.wikimediaQuery,
      matches,
    };
  }

  // Fallback dictionary word-level translation for composite unseen Turkish queries
  const wordMap: Record<string, string> = {
    sistem: 'system',
    kuram: 'theory',
    teori: 'theory',
    analiz: 'analysis',
    yapi: 'structure',
    enerji: 'energy',
    isik: 'light',
    dalga: 'wave',
    hareket: 'motion',
    kuvvet: 'force',
    basinc: 'pressure',
    sicaklik: 'temperature',
    su: 'water',
    toprak: 'earth',
    bitki: 'plant',
    hayvan: 'animal',
    ekoloji: 'ecology',
    iklim: 'climate',
    uzay: 'space',
    gezegen: 'planet',
    yildiz: 'star',
    harita: 'map',
    devlet: 'state',
    toplum: 'society',
    kultur: 'culture',
    sanat: 'art',
    muzik: 'music',
    egitim: 'education',
    sinav: 'exam',
    proje: 'project',
    arastirma: 'research',
  };

  const normTokens = normalizeTurkishAcademicText(clean).split(' ').filter(Boolean);
  const translatedTokens = normTokens.map((tok) => wordMap[tok] ?? tok);
  const fallbackEn = translatedTokens.join(' ') || clean || 'academic concept';

  return {
    primaryEnglish: fallbackEn,
    iconifyQuery: fallbackEn,
    wikimediaQuery: clean || fallbackEn,
    matches,
  };
}
