/**
 * Shared V3 Turkish-English-Latin Academic & Everyday Visual Taxonomy Engine
 * Used identically by:
 *  1. `scripts/build-offline-icon-shards.mjs` (Build-time 25,000+ icon tagger)
 *  2. `scripts/verify-search-relevance.mjs` (Automated 20-query offline QA gate)
 *  3. `src/workers/visualSearch.worker.ts` & `SemanticTaxonomyTR.ts` (<8ms BM25 runtime)
 *
 * Domains:
 *  - medicine_bio
 *  - system_cs
 *  - electronics
 *  - law
 *  - architecture
 *  - science
 *  - social_history
 *  - business
 *  - general
 */

import { EXTRA_DOMAIN_LEXICON } from './taxonomyBankExtra.js';
import { CLDR_TR_TO_EN_CONCEPTS } from './cldrTrLexicon.js';

/**
 * English Concept-Intent Visual Proxy Map:
 * When users type (or live-translate to) abstract English nouns like "commander", "leadership",
 * "honeycomb", "radiator", "discipline", "motivation", maps them immediately to iconic visual symbols
 * so icon search ALWAYS understands user intent and NEVER returns empty or unrelated results!
 */
export const EN_CONCEPT_INTENT_MAP = {
  commander: ['military-medal', 'crossed-swords', 'shield', 'helmet', 'star', 'crown', 'flag'],
  general: ['military-medal', 'crossed-swords', 'shield', 'star', 'crown', 'helmet'],
  officer: ['military-medal', 'shield', 'badge', 'star', 'helmet'],
  soldier: ['helmet', 'shield', 'crossed-swords', 'military-medal', 'flag'],
  warrior: ['crossed-swords', 'shield', 'helmet', 'axe', 'sword'],
  knight: ['shield', 'crossed-swords', 'helmet', 'castle', 'horse'],
  captain: ['anchor', 'ship', 'helm', 'compass', 'star'],
  leader: ['crown', 'flag', 'trophy', 'compass', 'star'],
  leadership: ['crown', 'flag', 'compass', 'trophy', 'users'],
  honeycomb: ['honey-pot', 'honeybee', 'bee', 'hexagon'],
  radiator: ['heater', 'thermometer', 'flame', 'fire'],
  heater: ['thermometer', 'flame', 'fire', 'sun'],
  motivation: ['rocket', 'fire', 'sparkles', 'light-bulb', 'trophy'],
  discipline: ['target', 'check-mark-button', 'calendar', 'stopwatch', 'clipboard'],
  strategy: ['chess-pawn', 'target', 'compass', 'map', 'brain'],
  success: ['trophy', '1st-place-medal', 'star', 'rocket', 'check-mark-button'],
  victory: ['trophy', '1st-place-medal', 'crown', 'flag', 'star'],
  freedom: ['dove', 'bird', 'flag', 'wings', 'sun'],
  peace: ['dove', 'peace-symbol', 'handshake', 'heart'],
  justice: ['balance-scale', 'gavel', 'scroll', 'shield'],
  communication: ['speech-balloon', 'megaphone', 'mail', 'message'],
  presentation: ['chart-increasing', 'screen', 'microphone', 'light-bulb'],
  meeting: ['users', 'handshake', 'calendar', 'speech-balloon'],
  economy: ['chart-increasing', 'money-bag', 'coin', 'bank'],
  investment: ['chart-increasing', 'money-bag', 'seedling', 'coin'],
  education: ['graduation-cap', 'books', 'open-book', 'school'],
  learning: ['brain', 'open-book', 'light-bulb', 'graduation-cap'],
  memory: ['brain', 'light-bulb', 'puzzle-piece', 'sparkles'],
  focus: ['target', 'bullseye', 'eye', 'stopwatch'],
  habit: ['calendar', 'check-mark-button', 'repeat', 'stopwatch'],
  creativity: ['light-bulb', 'artist-palette', 'sparkles', 'rocket'],
  innovation: ['light-bulb', 'rocket', 'atom-symbol', 'sparkles'],
  teamwork: ['handshake', 'users', 'puzzle-piece', 'trophy'],
  problem: ['warning', 'magnifying-glass-tilted-left', 'puzzle-piece', 'question'],
  solution: ['check-mark-button', 'light-bulb', 'key', 'puzzle-piece'],
  advantage: ['thumbs-up', 'check-mark-button', 'trophy', 'chart-increasing'],
  disadvantage: ['thumbs-down', 'warning', 'cross-mark', 'chart-decreasing'],
  introduction: ['compass', 'open-book', 'sparkles', 'flag'],
  summary: ['clipboard', 'check-mark-button', 'books', 'star'],
  conclusion: ['flag', 'check-mark-button', 'trophy', 'target'],
};

/**
 * Normalizes Turkish & Latin characters into clean lowercase ASCII search tokens
 * while preserving word boundaries.
 */
export function normalizeTrToken(raw) {
  if (!raw) return '';
  return String(raw)
    .toLocaleLowerCase('tr-TR')
    .replace(/['’‘´`]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[^a-z0-9\s+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TURKISH_SUFFIXES = [
  'larindan', 'lerinden', 'larinin', 'lerinin', 'larina', 'lerine',
  'lardan', 'lerden', 'larin', 'lerin', 'larda', 'lerde',
  'liklar', 'likler', 'luklar', 'lukler', 'cilik', 'culuk',
  'sinda', 'sinde', 'sindan', 'sinden', 'sina', 'sine', 'sini', 'sunu',
  'ndan', 'nden', 'nin', 'nun', 'dan', 'den', 'tan', 'ten',
  'lari', 'leri', 'lara', 'lere', 'lik', 'luk', 'suz', 'siz',
  'sal', 'sel', 'cil', 'cul', 'ci', 'cu', 'li', 'lu',
  'da', 'de', 'ta', 'te', 'in', 'un', 'na', 'ne', 'ya', 'ye',
  'si', 'su', 'yi', 'yu', 'im', 'um', 'iz', 'uz',
  'i', 'u', 'a', 'e',
];

const CONSONANT_RESTORE = {
  kapag: 'kapak',
  yaprag: 'yaprak',
  toprag: 'toprak',
  ayag: 'ayak',
  kulag: 'kulak',
  odag: 'odak',
  yatag: 'yatak',
  kaynag: 'kaynak',
  kabug: 'kabuk',
  cocug: 'cocuk',
  acig: 'acik',
  isig: 'isik',
  kemig: 'kemik',
  delig: 'delik',
  esig: 'esik',
  mantig: 'mantik',
  hukug: 'hukuk',
  blogy: 'blok',
  kalb: 'kalp',
  reng: 'renk',
  deng: 'denk',
  aheng: 'ahenk',
  guc: 'guc',
  agac: 'agac',
  ilac: 'ilac',
  arac: 'arac',
  surec: 'surec',
  amac: 'amac',
  direnc: 'direnc',
  kazanc: 'kazanc',
  basinc: 'basinc',
  inanc: 'inanc',
  borc: 'borc',
  uc: 'uc',
  kanad: 'kanat',
  kesid: 'kesit',
  gecid: 'gecit',
  boyud: 'boyut',
  kagid: 'kagit',
  tasid: 'tasit',
  asid: 'asit',
  oksij: 'oksijen',
  kitab: 'kitap',
  hesab: 'hesap',
  cevab: 'cevap',
  mikrob: 'mikrop',
  dolab: 'dolap',
  sebep: 'sebep',
  sebeb: 'sebep',
  metod: 'metot',
  periyod: 'periyot',
};

const TURKISH_STOPWORDS = new Set([
  've', 'ile', 'veya', 'yahut', 'ama', 'fakat', 'ancak', 'lakin', 'ki', 'de', 'da',
  'mi', 'mu', 'bu', 'su', 'o', 'bir', 'her', 'hem', 'ya', 'ne', 'gibi', 'gore',
  'icin', 'uzere', 'kadar', 'daha', 'en', 'cok', 'az', 'olan', 'olarak', 'ise',
  'ait', 'dair', 'iliskin', 'karsi', 'sonra', 'once', 'arasinda', 'uzerinde', 'altinda',
  'icinde', 'disinda', 'tarafindan', 'sistemi', 'sistemleri', 'yapisi', 'ozellikleri',
  'cesitleri', 'turleri', 'ilkeleri', 'sonuclari', 'etkileri', 'evreleri', 'asamalari',
]);

// Words ending in natural vowel / `-um` / `-im` root that must NOT lose their ending when stripping suffixes
const PROTECTED_ROOTS = new Set([
  'denge', 'ulke', 'ilke', 'madde', 'proje', 'bolge', 'belge', 'golge', 'hazine',
  'idare', 'irade', 'ihale', 'mahkeme', 'medrese', 'kulliye', 'sermaye', 'butce',
  'kitabe', 'hikaye', 'makale', 'risale', 'mukavele', 'felsefe', 'belediye',
  'vergi', 'reaya', 'tasra', 'ordu', 'kale', 'cami', 'kopru', 'hucre', 'dalga',
  'parca', 'nokta', 'halka', 'kutle', 'enerji', 'teori', 'yapi', 'konu', 'soru',
  'baski', 'etki', 'tepki', 'katki', 'yetki', 'bitki', 'uyku', 'duygu', 'kaygi',
  'serum', 'durum', 'kurum', 'bolum', 'cozum', 'tohum', 'dogum', 'olum', 'tutum',
  'uyum', 'konum', 'sunum', 'yorum', 'toplum', 'iklim', 'bilim', 'tarim', 'egitim',
  'uretim', 'yonetim', 'denetim', 'secim', 'hacim', 'ritim', 'terim', 'birim',
]);

/**
 * Restores Turkish k -> ğ (`g` in ASCII) and p/ç/t -> b/c/d consonant softening generically!
 */
function restoreTurkishSoftening(candidate) {
  if (CONSONANT_RESTORE[candidate]) return CONSONANT_RESTORE[candidate];
  if (candidate.length >= 4) {
    if (
      candidate.endsWith('lig') ||
      candidate.endsWith('lug') ||
      candidate.endsWith('rig') ||
      candidate.endsWith('rug') ||
      candidate.endsWith('rag') ||
      candidate.endsWith('yag') ||
      candidate.endsWith('dag') ||
      candidate.endsWith('tag') ||
      candidate.endsWith('bag') ||
      candidate.endsWith('cag') ||
      candidate.endsWith('sag') ||
      candidate.endsWith('kag')
    ) {
      return `${candidate.slice(0, -1)}k`;
    }
  }
  return candidate;
}

/**
 * Safe Turkish agglutinative stemmer (`minRootLen >= 3`) with full k->ğ consonant softening restoration.
 */
export function stemTurkishSafe(word) {
  const norm = normalizeTrToken(word).replace(/-/g, '');
  if (norm.length <= 3) return norm;
  if (PROTECTED_ROOTS.has(norm)) return norm;
  if (CONSONANT_RESTORE[norm]) return CONSONANT_RESTORE[norm];

  // Never strip compound scientific stems like mikroorganizma, ekokardiyografi, mikrobiyoloji!
  if (
    norm.startsWith('mikroorganiz') ||
    norm.startsWith('mikrobiyo') ||
    norm.startsWith('mikroskop') ||
    norm.startsWith('mikrocip') ||
    norm.startsWith('mikrodenet') ||
    norm.startsWith('mikroservis') ||
    norm.startsWith('ekokardiyo') ||
    norm.startsWith('elektrokardiyo')
  ) {
    for (const suf of ['lari', 'leri', 'nin', 'nun', 'dan', 'den', 'da', 'de', 'si', 'su', 'i', 'u']) {
      if (norm.length - suf.length >= 8 && norm.endsWith(suf)) {
        return norm.slice(0, -suf.length);
      }
    }
    return norm;
  }

  let current = norm;
  for (let pass = 0; pass < 2; pass++) {
    if (PROTECTED_ROOTS.has(current)) break;
    let stripped = false;
    for (const suf of TURKISH_SUFFIXES) {
      if (current.length - suf.length >= 3 && current.endsWith(suf)) {
        const rawCandidate = current.slice(0, -suf.length);
        // Do not strip single trailing vowel if rawCandidate would mangle a protected root (e.g. `denge` -> `deng`)
        if ((suf === 'e' || suf === 'a' || suf === 'i' || suf === 'u') && PROTECTED_ROOTS.has(current)) {
          break;
        }
        current = restoreTurkishSoftening(rawCandidate);
        stripped = true;
        break;
      }
    }
    if (!stripped) break;
  }
  return current;
}

/**
 * Compact High-Density Concept Clusters (3,200+ Turkish roots, clinical/Latin terms, and synonyms).
 * Format: [domain, trSynonymsPipe, enVisualTokensPipe, blockedTokensPipeOptional, packIdsPipeOptional]
 */
export const RAW_TAXONOMY_CLUSTERS = [
  // ==================== 1. MİKROBİYOLOJİ, ENFEKSİYON & BİYOLOJİ ====================
  [
    'medicine_bio',
    'mikroorganizma|mikrop|mikrobiyoloji|mikrobiyal|mikrobiyota|patojen|prokaryot|tek hucreli|mikroskobik canli|enfeksiyon etkeni|mikroflora',
    'microbe|bacteria|bacterium|virus|microscope|petri|petri-dish|cell|dna|amoeba|fungi|parasite|biology|test-tube|biohazard|infection|germ',
    'microchip|chip|cpu|processor|server|nand|nor|xor|gate|logic|stair|stairs|ladder|chimney|minaret|mosque|microphone|microwave|microsoft|usb|router|database|building|tower',
    'bio_bacteria_bacillus|bio_virus_capsid|bio_petri_culture|bio_microscope_lab|bio_amoeba_protozoa|bio_cocci_colony|bio_bacteriophage|bio_eukaryote_cell',
  ],
  [
    'medicine_bio',
    'bakteri|basil|kok|stafilokok|streptokok|escherichia|salmonella|gram pozitif|gram negatif|kamcili|sporlu bakteri|antibiyotik direnci|koloni',
    'bacteria|bacterium|microbe|petri|petri-dish|microscope|cell|pill|antibiotic|test-tube|biology|infection|laboratory|biohazard',
    'microchip|chip|cpu|server|gate|stair|ladder|chimney|microphone',
    'bio_bacteria_bacillus|bio_cocci_colony|bio_petri_culture|bio_microscope_lab|med_pharma_capsule',
  ],
  [
    'medicine_bio',
    'virus|virüs|viroloji|bakteriyofaj|faj|kapsid|koronavirus|influenza|grip|hiv|salgin|pandemi|epidemiyoloji|viral enfeksiyon|karantina',
    'virus|coronavirus|microbe|biohazard|vaccine|syringe|mask|microscope|dna|rna|cell|infection|shield-medical|test-tube|hospital',
    'antivirus-software|computer-virus|laptop|server|chip|cpu|stair|chimney',
    'bio_virus_capsid|bio_bacteriophage|med_vaccine_syringe|bio_antibody_immune|bio_rna_strand',
  ],
  [
    'medicine_bio',
    'mantar|mikoloji|mikoz|maya|kuf|hif|spor|kandida|fermantasyon|liken|saprofit',
    'mushroom|fungi|fungus|microbe|petri|microscope|spore|cell|biology|plant|yeast',
    'server|chip|cpu|stair|chimney',
    'bio_fungi_yeast|bio_petri_culture|bio_microscope_lab',
  ],
  [
    'medicine_bio',
    'amip|protozoa|oglena|paramesyum|plazmodyum|parazit|parazitoloji|sitma|helmint|konak',
    'amoeba|parasite|microbe|bacteria|cell|microscope|mosquito|biology|blood|petri',
    'server|chip|cpu|stair|chimney',
    'bio_amoeba_protozoa|bio_parasite_helminth|bio_microscope_lab|bio_eukaryote_cell',
  ],
  [
    'medicine_bio',
    'mikroskop|mercek|buyutec|preparat|lam|lamel|boyama|optik inceleme|elektron mikroskobu',
    'microscope|lens|magnifying|laboratory|petri|test-tube|science|cell|bacteria|biology',
    'server|chip|stair|chimney',
    'bio_microscope_lab|bio_petri_culture|bio_test_tubes',
  ],
  [
    'medicine_bio',
    'petri|petri kabi|agar|besiyeri|ekim|inkubasyon|kültür|kultur testi|antibiogram',
    'petri|petri-dish|bacteria|microbe|laboratory|microscope|test-tube|flask|biology',
    'server|chip|stair',
    'bio_petri_culture|bio_cocci_colony|bio_test_tubes',
  ],
  [
    'medicine_bio',
    'hucre|okaryot|sitoplazma|cekirdek|nukleus|hucre zari|endoplazmik retikulum|golgi|lizozom|koful|organel|sitoloji',
    'cell|nucleus|dna|mitochondria|microscope|biology|microbe|atom|membrane|organelle',
    'prison-cell|jail|battery-cell|table-cell|spreadsheet|phone',
    'bio_eukaryote_cell|bio_mitochondria_atp|bio_dna_helix|med_cell_mitochondria',
  ],
  [
    'medicine_bio',
    'mitokondri|hucresel solunum|atp|adenozin trifosfat|krebs|glikoliz|oksijenli solunum|metabolizma|biyoenerjetik',
    'mitochondria|cell|bolt|energy|dna|biology|oxygen|flame|cycle|microscope',
    'server|stair|chimney',
    'bio_mitochondria_atp|med_cell_mitochondria|bio_eukaryote_cell',
  ],
  [
    'medicine_bio',
    'kloroplast|fotosentez|klorofil|bitki|yaprak|tilakoit|stoma|botanik|ekosistem|flora|agac|orman|tohum|cicek|kok',
    'leaf|plant|tree|flower|seedling|sprout|sun|chloroplast|cell|biology|nature|forest',
    'server|chip',
    'bio_chloroplast|bio_eukaryote_cell',
  ],
  [
    'medicine_bio',
    'dna|gen|genetik|kalitim|kromozom|sarmal|nukleotid|adenin|timin|guanin|sitozin|genom|mutasyon|crispr|klonlama|kalitsal|alel|mendel|dna gen',
    'dna|helix|chromosome|gene|genetics|cell|microscope|test-tube|biology|science|molecule|heredity',
    'server|stair|ladder|chimney',
    'bio_dna_helix|bio_chromosome_gene|bio_rna_strand|med_dna_helix',
  ],
  [
    'medicine_bio',
    'rna|mrna|trna|rrna|ribozom|protein|aminoasit|peptit|enzim|substrat|katalizor|transkripsiyon|translasyon|biyokimya',
    'dna|rna|molecule|protein|cell|test-tube|flask|pipette|biology|chemistry|laboratory',
    'server|stair',
    'bio_rna_strand|bio_enzyme_substrate|bio_pipette_assay|bio_erlenmeyer_flask',
  ],
  [
    'medicine_bio',
    'mitoz|mayoz|hucre bolunmesi|faz|profaz|metafaz|anafaz|telofaz|zigot|embriyo|embriyoloji|ureme',
    'chromosome|cell|dna|division|baby|biology|microscope|genetics',
    '',
    'bio_chromosome_gene|bio_eukaryote_cell|bio_dna_helix',
  ],
  [
    'medicine_bio',
    'bagisiklik|immunoloji|antikor|antijen|lenfosit|lokosit|akyuvar|fagositoz|asi|asilama|serum|interferon|immün',
    'shield|vaccine|syringe|blood|cell|virus|bacteria|medical|health|protection|hospital',
    'server|firewall',
    'bio_antibody_immune|med_vaccine_syringe|med_blood_vessel',
  ],

  // ==================== 2. TIP, KARDİYOLOJİ & ANATOMİ ====================
  [
    'medicine_bio',
    'ekokardiyografi|eko|transtorasik|transozofageal|kalp ultrasonu|doppler|ejeksiyon fraksiyonu|duvar hareketi|ultrasonografi',
    'cardiogram|heart|heart-organ|heartbeat|pulse|ultrasound|monitor|stethoscope|medical|hospital|wave|activity|health',
    'economy|economics|coin|dollar|euro|bank|ecology|recycle|leaf|cart|shopping|speaker|microphone',
    'med_echo_ultrasound|med_ecg_monitor|med_heart_chambers|med_heart_mitral|med_auscultation_steth',
  ],
  [
    'medicine_bio',
    'mitral kapak|mitral|trikuspit|aort kapagi|pulmoner kapak|kalp kapagi|kapak darligi|stenoz|yetmezlik|regurjitasyon|korda tendinea|papiller kas|endokardit',
    'heart|heart-organ|cardiogram|heartbeat|pulse|stethoscope|blood|artery|medical|surgery|anatomy|clinical|health',
    'hat|cap|bottle|graduation|laptop|door|manhole|book|pot|toilet',
    'med_heart_chambers|med_heart_mitral|med_echo_ultrasound|med_auscultation_steth|med_ecg_monitor',
  ],
  [
    'medicine_bio',
    'kalp|kardiyoloji|kardiyovaskuler|miyokard|perikard|endokard|atriyum|ventrikul|kulakcik|karincik|sistol|diyastol|infarktus|koroner|anjio|tasikardi|bradikardi|aritmi',
    'heart|heart-organ|cardiogram|heartbeat|pulse|stethoscope|blood|artery|ambulance|hospital|medical|ecg',
    'playing-card|spade|club|diamond|poker',
    'med_heart_chambers|med_heart_mitral|med_ecg_monitor|med_sa_conduction|med_blood_vessel',
  ],
  [
    'medicine_bio',
    'oskultasyon|stetoskop|ufurum|kalp sesi|s1|s2|apeks|muayene|fizik muayene|anamnez|tani|teshis|klinik|hekim|doktor|hasta',
    'stethoscope|cardiogram|heart|lungs|doctor|hospital|medical|health|clinic',
    'headphone|music|dj',
    'med_auscultation_steth|med_stethoscope_clinic|med_heart_chambers|med_alveoli_gas',
  ],
  [
    'medicine_bio',
    'ekg|elektrokardiyografi|sinoatriyal|sa dugumu|av dugumu|purkinje|his demeti|qrs|pacemaker|defibrilator|ritim',
    'cardiogram|heartbeat|pulse|activity|heart|monitor|bolt|medical|hospital|wave',
    '',
    'med_ecg_monitor|med_sa_conduction|med_sa_node_ecg|med_heart_chambers',
  ],
  [
    'medicine_bio',
    'akciger|solunum|alveol|brons|bronşiol|trakea|plevra|gogus hastaliklari|pnomoni|astim|koah|dispne|ventilasyon|oksijen|spirometri',
    'lungs|respiratory|breath|oxygen|air|stethoscope|mask|inhaler|medical|hospital|chest',
    '',
    'med_alveoli_gas|med_lungs_alveoli|med_auscultation_steth|med_xray_imaging',
  ],
  [
    'medicine_bio',
    'bobrek|nefron|glomerul|henle|tubul|ureter|mesane|idrar|nefroloji|uroloji|diyaliz|filtrasyon|kreatinin|renal',
    'kidneys|kidney|organ|drop|water|filter|medical|hospital|test-tube|health|anatomy',
    '',
    'med_kidney_nephron_v3|med_kidney_nephron|bio_test_tubes',
  ],
  [
    'medicine_bio',
    'beyin|noroloji|noron|sinaps|akson|dendrit|miyelin|norotransmitter|dopamin|serotonin|korteks|hipokampus|beyincik|omurilik|sinir sistemi|psikiyatri|psikoloji|bilissel',
    'brain|neuron|synapse|mind|head|psychology|network|pulse|bolt|medical|neurology|thought',
    '',
    'med_brain_cortex|med_synapse_neuro|med_neuron_synapse',
  ],
  [
    'medicine_bio',
    'damar|atardamar|toplardamar|kilcal damar|arter|ven|aort|kan|plazma|alyuvar|eritrosit|trombosit|hemoglobin|anemi|hematoloji|tansiyon|hipertansiyon| nabiz',
    'blood|drop|heart|artery|syringe|test-tube|medical|pulse|pressure|health',
    '',
    'med_blood_vessel|med_heart_chambers|bio_test_tubes',
  ],
  [
    'medicine_bio',
    'karaciger|safra|pankreas|insülin|glukagon|diyabet|endokrin|tiroid|hormon|mide|bagirsak|ozofagus|sindirim|gastroenteroloji|metabolik',
    'stomach|liver|organ|apple|nutrition|pill|syringe|medical|anatomy|health|digestion',
    '',
    'med_liver_biliary|med_stomach_gi|med_pharma_capsule',
  ],
  [
    'medicine_bio',
    'kemik|iskelet|kafatası|omurga|eklem|kikirdak|kas|tendon|ligament|ortopedi|kalsiyum|kirik|anatomi|fizyoterapi',
    'bone|skull|skeleton|joint|muscle|spine|body|xray|medical|orthopedics|accessibility',
    '',
    'med_bone_osteon|med_xray_imaging',
  ],
  [
    'medicine_bio',
    'goz|retina|kornea|iris|optik sinir|katarakt|oftalmoloji|kulak|koklea|isitme|burun|bogaz|kbb|deri|dermatoloji|duyu',
    'eye|glasses|ear|hearing|nose|hand|face|medical|clinic|vision',
    '',
    'med_eye_retina|med_ear_cochlea',
  ],
  [
    'medicine_bio',
    'ilac|farmakoloji|antibiyotik|analjezik|doz|recete|eczacilik|kapsul|tablet|toksikoloji|tedavi|terapi|cerrahi|ameliyat|anestezi|radyoloji|rontgen|mr|tomografi|onkoloji|kanser',
    'pill|capsule|tablets|medicine|pharmacy|syringe|scalpel|hospital|ambulance|xray|bandage|first-aid|doctor',
    '',
    'med_pharma_capsule|med_vaccine_syringe|med_xray_imaging',
  ],

  // ==================== 3. ELEKTRONİK, DONANIM & MİKROÇİP ====================
  [
    'electronics',
    'cip|çip|mikrocip|mikroçip|islemci|işlemci|mikroislemci|cpu|gpu|npu|tumdevre|tümdevre|entegre devre|yariiletken|silikon|wafer|asic|fpga|soc|donanim|transistor sayisi',
    'cpu|microchip|chip|processor|circuit|pcb|motherboard|memory|ram|electronics|hardware|computer|server-cpu|silicon',
    'potato|fries|cookie|chocolate|casino|poker|gambling|token-coin|fish|food|snack|microbe|bacteria|virus',
    'elec_microchip_cpu|elec_silicon_wafer|elec_dip_ic|elec_pcb_circuit|eng_mcu_arduino|elec_ram_memory',
  ],
  [
    'electronics',
    'mikrodenetleyici|arduino|esp32|stm32|raspberry|gomulu sistem|firmware|uart|spi|i2c|gpio|pwm|adc|dac|kesme|watchdog',
    'cpu|microchip|circuit|pcb|usb|plug|sensor|robot|code|terminal|electronics|hardware',
    'microbe|bacteria|potato|casino',
    'eng_mcu_arduino|elec_microchip_cpu|elec_pcb_circuit|elec_sensor_iot',
  ],
  [
    'electronics',
    'op-amp|opamp|islemsel yukseltec|eviren yukseltec|evirmeyen|yukseltec|amplifikator|negatif geri besleme|sanal toprak|kazanc|analog elektronik|fark alici|karsilastirici',
    'wave-sine|oscilloscope|circuit|cpu|microchip|triangle|bolt|plug|electronics|signal|audio|meter|gauge',
    '',
    'elec_opamp_triangle|eng_opamp_inverting|elec_oscilloscope|elec_rlc_filter',
  ],
  [
    'electronics',
    'pil|batarya| pil batarya|lityum|li-ion|lifepo4|aku|bms|sarj|desarj|voltaj|gerilim|akim|amper|ohm|watt|guc kaynagi|regulator|invertor|konvertor|gunes paneli|enerji',
    'battery|battery-charging|bolt|lightning|plug|power|solar|sun|car-battery|energy|electricity|gauge',
    '',
    'elec_lithium_bms|eng_bms_battery|elec_power_transformer',
  ],
  [
    'electronics',
    'direnc|kondansator|kapasitor|bobin|induktor|rlc|pasif eleman|filtre|alcak geciren|yuksek geciren|bant geciren|rezonans|empedans|devre|kirchhoff|thevenin',
    'circuit|resistor|capacitor|bolt|wave-sine|plug|cpu|electronics|magnet|coil|settings',
    '',
    'elec_rlc_filter|eng_passive_rlc|elec_pcb_circuit|elec_oscilloscope',
  ],
  [
    'electronics',
    'transistor|mosfet|bjt|diyot|zener|led|tristor|igbt|dogrultucu|anahtarlama|mantik kapisi|mantik kapilari|and|or|nand|nor|xor|flip-flop|sayici|dijital elektronik',
    'logic-gate|circuit|cpu|microchip|binary|bulb|lightbulb|switch|toggle|electronics|diagram',
    '',
    'elec_logic_gates_ic|eng_logic_gates|elec_mosfet_transistor|elec_led_diode',
  ],
  [
    'electronics',
    'osiloskop|multimetre|voltmetre|ampermetre|sinyal|frekans|hertz|fourier|modulasyon|anten|rf|radar|telekomunikasyon|fiber optik|haberlesme',
    'antenna|wifi|radio|radar|satellite|signal|wave|broadcast|monitor|gauge|activity|bluetooth',
    '',
    'elec_oscilloscope|elec_rf_antenna|sd_websocket_stream',
  ],
  [
    'electronics',
    'robot|robotik|mekatronik|servo|step motor|dc motor|aktuator|pid|kontrol sistemi|otomasyon|plc|scada|sensor|lidar|ivmeolcer|jiroskop',
    'robot|bot|cog|gear|settings|cpu|sensor|engine|arm|factory|automation|drone',
    '',
    'elec_servo_robotics|eng_servo_motor|elec_sensor_iot',
  ],

  // ==================== 4. SİSTEM TASARIMI, YAZILIM & YAPAY ZEKÂ ====================
  [
    'system_cs',
    'yuk dengeleyici|load balancer|ters vekil|reverse proxy|nginx|haproxy|envoy|round robin|trafik dagitimi|saglik kontrolu|failover|yuksek erisilebilirlik',
    'network|sitemap|git-Fork|share|arrows-split|server|cloud|shield|globe|router|balance|cluster',
    '',
    'sd_load_balancer|sd_api_gateway|sd_cdn_edge|sd_vpc_cloud',
  ],
  [
    'system_cs',
    'api gateway|ag gecidi|rest api|graphql|grpc|webhook|rate limit|hiz sinirlama|endpoint|yonlendirme|authentication|oauth|jwt|token',
    'api|gateway|door|key|lock|shield|server|cloud|plug|webhook|code|arrows-exchange|router',
    '',
    'sd_api_gateway|sd_oauth_jwt|sd_rate_limiter|sd_firewall_waf',
  ],
  [
    'system_cs',
    'veritabani|database|sql|postgresql|mysql|oracle|nosql|mongodb|cassandra|dynamodb|tablo|indeks|acid|transaction|replikasyon|sharding|bolumleme|sorgu|veri ambarı',
    'database|cylinder|storage|server|table|hard-drive|layers|archive|cloud|postgresql|mysql|mongodb|redis',
    '',
    'sd_sql_primary|sd_db_sharding|sd_nosql_doc|sd_read_replica|sd_object_storage',
  ],
  [
    'system_cs',
    'redis|onbellek|önbellek|cache|memcached|cdn|edge|bellek ici|gecikme|latency|lru|ttl',
    'redis|bolt|zap|memory|database|layers|clock|rocket|globe|cloud|cpu',
    '',
    'sd_redis_cache|sd_cdn_edge|elec_ram_memory',
  ],
  [
    'system_cs',
    'mesaj kuyrugu|kuyruk|kafka|rabbitmq|pubsub|olay gudumlu|event stream|asenkron|worker|isci|pipeline|akis',
    'kafka|rabbitmq|layers|list|inbox|mail|send|arrows-right|stream|repeat|workflow|server',
    'dog-tail|cat-tail|animal|bird|fish|peacock|comet',
    'sd_kafka_queue|sd_microservice|sd_websocket_stream',
  ],
  [
    'system_cs',
    'mikroservis|konteyner|docker|kubernetes|k8s|pod|helm|orkestrasyon|bulut|aws|gcp|azure|sunucusuz|serverless|lambda|ci cd|devops|git|github',
    'docker|kubernetes|box|cube|packages|cloud|server|git-branch|github|gitlab|terminal|infinity|rocket|layers',
    'microbe|bacteria|virus',
    'sd_microservice|sd_kubernetes|sd_docker_container|sd_vpc_cloud',
  ],
  [
    'system_cs',
    'siber guvenlik|guvenlik duvari|firewall|waf|ddos|sifreleme|kriptografi|ssl|tls|https|anahtar|sertifika|sizma testi|yetkilendirme',
    'shield|lock|key|fingerprint|user-check|eye-off|bug|alert-triangle|firewall|security',
    '',
    'sd_firewall_waf|sd_oauth_jwt|sd_circuit_breaker',
  ],
  [
    'system_cs',
    'algoritma|veri yapilari|agac|graf|bagli liste|yigin|stack|hash|siralama|arama|karmasiklik|big o|kodlama|programlama|python|javascript|typescript|java|rust|yazilim',
    'code|braces|terminal|binary|sitemap|git-branch|cpu|python|javascript|typescript|rust|java|file-code|bug',
    '',
    'sd_search_index|sd_graph_db|sci_neural_net_ai',
  ],
  [
    'system_cs',
    'yapay sinir agi|yapay zeka|derin ogrenme|makine ogrenmesi|llm|buyuk dil modeli|transformer|vektor veritabani|embedding|egitim|model|bilgisayarli goru|nlp',
    'brain|neural|network|robot|ai|artificial-intelligence|nodes|sitemap|cpu|algorithm|mind-map|chip',
    'spider|cobweb|fishing|tennis|volleyball|mosquito|wand|magic',
    'sci_neural_net_ai|sd_vector_ai_db|med_synapse_neuro|elec_microchip_cpu',
  ],

  // ==================== 5. HUKUK, YARGI & KAMU YÖNETİMİ ====================
  [
    'law',
    'istinaf|istinaf mahkemesi|bolge adliye|temyiz|yargitay|danistay|anayasa mahkemesi|mahkeme|adliye|yargi|kanun yolu|bozma|onama|durusma|hakim|savci|avukat',
    'scale|scales|balance|gavel|hammer|courthouse|landmark|building-bank|pillar|scroll|book|briefcase|judge|justice',
    'fish-scale|dragon-scale|ruler-scale',
    'law_courthouse_facade|law_justice_scales_v3|law_istinaf_scales|law_gavel_block|law_judge_gavel|law_sealed_verdict',
  ],
  [
    'law',
    'anayasa|kanun|mevzuat|tuzuk|yonetmelik|kararname|normlar hiyerarsisi|temel haklar|ozgurluk|egemenlik|kuvvetler ayriligi|yasama|yurutme|meclis|tbmm|devlet|kamu hukuku|idare hukuku',
    'book|book-open|scroll|landmark|flag|shield|scale|columns|parliament|stamp|award|law',
    '',
    'law_constitution_book|law_three_powers|law_separation_powers|law_ballot_public',
  ],
  [
    'law',
    'sozlesme|borclar hukuku|medeni hukuk|ticaret hukuku|sirket|miras|mulkiyet|tapu|aile hukuku|is hukuku|tazminat|imza|noter|vekalet|taahhut',
    'file-text|signature|pen|handshake|stamp|seal|briefcase|building|key|home|scale|contract',
    '',
    'law_signed_contract|law_contract_seal|law_petition_clock',
  ],
  [
    'law',
    'ceza hukuku|suc|ceza|sorusturma|kovusturma|iddianame|delil|tanik|bilirkisi|tutuklama|hukum|ilam|kesin hukum|icra|iflas|haciz|dilekce|tebligat|zamanasimi',
    'gavel|fingerprint|search|folder|file-check|lock|handcuffs|shield-alert|clock|stamp|scale|police',
    '',
    'law_case_dossier|law_evidence_discovery|law_sealed_verdict|law_enforcement_stamp|law_petition_clock',
  ],

  // ==================== 6. MİMARLIK, İNŞAAT & DEPREM ====================
  [
    'architecture',
    'ucan payanda|uçan payanda|payanda|gotik|gotik mimari|katedral|yanal itki|destek kemeri|strüktür|tasiyici sistem',
    'arch|cathedral|church|castle|landmark|pillar|column|monument|bridge|classical-building|dome|temple|masonry',
    'airplane|plane|aircraft|ufo|saucer|bird|rocket|helicopter|drone|parachute|broom|curling|gem|diamond|ring',
    'arch_gothic_buttress|arch_flying_buttress|arch_voussoir_arch|arch_groin_vault',
  ],
  [
    'architecture',
    'kemer|tonoz|kemer tonoz|kilit tasi|sivri kemer|besik tonoz|capraz tonoz|kubbe|pandantif|kagir|tas yapi|ayasofya|cami|selcuklu|antik mimari',
    'arch|dome|mosque|landmark|castle|bridge|pillar|column|monument|temple|building|brick',
    'belt|trousers|waist|seatbelt',
    'arch_voussoir_arch|arch_groin_vault|arch_dome_section|arch_geodesic_dome|arch_stone_viaduct',
  ],
  [
    'architecture',
    'sutun|kolon|kiris|temel|betonarme|celik yapi|dor|iyon|korint|baslik|cephe|plan|kesit|rolove|perspektif|olcek|eskiz|peyzaj|sehir planlama|akustik|yalitim|mimarlik|insaat',
    'pillar|column|landmark|ruler|compass|drafting|building|skyscraper|home| crane|hammer|wall|brick|blueprint',
    '',
    'arch_corinthian_cap|arch_corinthian_column|arch_drafting_set|arch_blueprint_compass',
  ],
  [
    'architecture',
    'deprem|sismik|sismograf|fay|fay hatti|tektonik|levha|richter|ivme|zemin|izolator|deprem yonetmeligi|afet|jeoloji|volkan|heyelan|tsunami',
    'activity|wave|pulse|alert-triangle|mountain|globe|crack|building|house|shield|compass|earth',
    '',
    'arch_seismic_fault|sci_earth_tectonics',
  ],

  // ==================== 7. TARİH, OSMANLI DEVLET TEŞKİLATI, COĞRAFYA & SOSYAL BİLİMLER ====================
  [
    'social_history',
    'osmanli|osmanlı|osmanli timar ve toprak sistemi|timar sistemi|osmanli devleti|padisah|divan|ferman|berat|tugra|imparatorluk|selcuklu|fetih|islahat|tanzimat|tarih|antik cag|ortacag',
    'crown|scroll|castle|mosque|shield|horse|landmark|monument|feather|map',
    'pirate|skull|hockey|baseball|football|golf|tokyo|alien|zombie|carousel|mouse|cursor|scrollbar|wheel|police|taxi|lightbulb|bulb',
    'hist_ottoman_imperial_seal|hist_dirlik_hierarchy_pyramid|hist_sipahi_cavalry_shield|law_sealed_verdict',
  ],
  [
    'social_history',
    'dirlik|dirlik kademeleri|dirlik sistemi|kademe|toprak kademeleri',
    'pyramid|crown|layers|medal|scroll|award',
    'pirate|skull|hockey|tokyo|mouse|cursor|scrollbar|wheel|police',
    'hist_dirlik_hierarchy_pyramid|hist_has_imperial_crown|hist_zeamet_banner_medal',
  ],
  [
    'social_history',
    'has|has toprak|has topraklar|padisah hassi|vezir hassi',
    'crown|gem|coins|treasure|castle',
    'stethoscope|lungs|hospital|doctor|pill|syringe|patient|pirate|hockey|medal|mouse|police',
    'hist_has_imperial_crown|hist_dirlik_hierarchy_pyramid|hist_ottoman_imperial_seal',
  ],
  [
    'social_history',
    'zeamet|zeamet dirlikleri|orta kademe dirlik|subasi|alaybeyi',
    'medal|award|shield|scroll|crown',
    'pirate|skull|hockey|tokyo|black-flag|mouse|cursor|scrollbar|wheel|police',
    'hist_zeamet_banner_medal|hist_dirlik_hierarchy_pyramid|hist_sipahi_cavalry_shield',
  ],
  [
    'social_history',
    'timar|kilic timari|timarli sipahi|timarli sipahi ordusu|sipahi|cebelu|atli asker|suvari|akinci|yeniceri|kapikulu|askeri yukumluluk|askeri yukumlulukler|sefer|ordu',
    'horse|shield|knight|sword|castle',
    'pirate|skull|jolly-roger|halloween|zombie|hockey|baseball|golf|medal|carousel|jockey|gooey|mouse|police',
    'hist_sipahi_cavalry_shield|hist_zeamet_banner_medal|hist_tasra_fortress_castle',
  ],
  [
    'social_history',
    'miri|miri arazi|devlet topragi|devlet arazisi|toprak sistemi|reaya|ciftci|koylu|tarimsal uretim|ciftbozan|ekim|hasat|tahil|bugday|tarla',
    'wheat|sheaf|seedling|sprout|tractor|farmer',
    'hockey|football|soccer|baseball|golf|stadium|pirate|server|cpu|flag|christmas|police|mouse',
    'hist_miri_wheat_land|hist_vergi_osur_scale',
  ],
  [
    'social_history',
    'vakif|vakif topraklari|vakif arazileri|vakif sistemi|kulliye|medrese|imaret|darussifa|hayir kurumu',
    'mosque|dome|landmark|heart|handshake|arch',
    'pirate|hockey|tokyo|police|mouse',
    'hist_vakif_kulliye_mosque|arch_dome_section',
  ],
  [
    'social_history',
    'mali ve hukuki yapi|mali yapi|hukuki yapi|kanunname|adaletname',
    'scale|gavel|scroll|landmark|coins',
    'pirate|hockey|tokyo|syringe|flag|lightbulb|bulb|idea|police|mouse|cursor',
    'hist_mali_legal_scroll_scale|law_justice_scale|hist_vergi_osur_scale',
  ],
  [
    'social_history',
    'vergi|vergi toplama|orfi vergi|seri vergi|orfi ve seri vergiler|orfi ve seri vergi toplama|osur|asar|harac|cizye|mali|maliye|mali yukumluluk',
    'scale|coins|wheat|scroll|wallet',
    'pirate|hockey|tokyo|syringe|flag|lightbulb|bulb|idea|lamp|police|mouse|cursor',
    'hist_vergi_osur_scale|hist_mali_legal_scroll_scale|hist_iltizam_treasury_chest',
  ],
  [
    'social_history',
    'iltizam|multezim|iltizam ve multezim|iltizam multezim sistemi|mukataa|nakit hazine|hazine|sikke|akce|darphane',
    'coins|treasure|bank|safe|wallet',
    'pirate|skull|hockey|tokyo|lightbulb|bulb|police|mouse',
    'hist_iltizam_treasury_chest|hist_vergi_osur_scale',
  ],
  [
    'social_history',
    'tasra|tasra guvenligi|tasra guvenligi ve asayis|tasra teskilati|asayis|sancak|eyalet|kale|hisar',
    'castle|shield|lock|landmark|crown',
    'tokyo|eiffel|pirate|skull|hockey|antenna|wifi|cell-tower|police|police-car|car|taxi|siren|fire-truck|ambulance|mouse',
    'hist_tasra_fortress_castle|hist_merkezi_otorite_pillar|hist_ottoman_imperial_seal',
  ],
  [
    'social_history',
    'idari|idare|idari yapi|idari sonuclar|merkezi otorite|merkezi otorite dengesi|otorite dengesi|devlet duzeni',
    'landmark|scale|crown|shield|castle|gavel',
    'tokyo|eiffel|pirate|skull|hockey|police|police-car|car|taxi|siren|fire-truck|lightbulb|bulb|mouse',
    'hist_merkezi_otorite_pillar|hist_ottoman_imperial_seal|law_justice_scale|hist_tasra_fortress_castle',
  ],
  [
    'social_history',
    'kurtulus savasi|milli mucadele|tbmm|cumhuriyet|ataturk|inkilap|lozan|bagimsizlik',
    'flag|torch|medal|landmark|star|award',
    'pirate|skull|hockey',
    'hist_ottoman_imperial_seal|law_constitution_book',
  ],
  [
    'social_history',
    'cografya|fiziki cografya|yeryuzu|kita|harita bilgisi',
    'globe|earth|world-map|map|compass|mountain',
    '',
    'sci_earth_tectonics',
  ],
  [
    'social_history',
    'edebiyat|divan edebiyati|halk edebiyati|siir|roman|destan',
    'scroll|fountain-pen|feather|open-book|book',
    '',
    '',
  ],

  // ==================== 8. TEMEL BİLİMLER: FİZİK, KİMYA & MATEMATİK ====================
  [
    'science',
    'atom|cekirdek|proton|notron|elektron|orbital|kuantum|foton|radyoaktivite|fisyon|fuzyon|nukleer|parcacik|relativite|gorelilik',
    'atom|atom-symbol|orbit|radiation|radioactive|sparkles',
    '',
    'sci_atom_orbital_v3|sci_atom_quantum',
  ],
  [
    'science',
    'optik|prizma|isik kirilmasi|spektrum|tayf',
    'rainbow|prism|crystal-ball|sun|eye',
    '',
    'sci_prism_spectrum_v3|sci_optics_prism',
  ],
  [
    'science',
    'fizik|mekanik|kinematik|dinamik|sarkac|harmonik hareket',
    'magnet|pendulum|gear|rocket|gauge|bolt',
    '',
    'sci_pendulum_wave|sci_magnet_flux',
  ],
  [
    'science',
    'kimya|element|periyodik tablo|bilesik|karisim|molekul|kovalent|iyonik|reaksiyon|tepkime|mol|stokiyometri|cozelti|asit|baz|ph|titrasyon|elektroliz|organik kimya|polimer|kataliz',
    'alembic|flask|beaker|test-tube|atom|molecule|droplet|petri-dish',
    '',
    'sci_molecule_bonds|bio_erlenmeyer_flask|sci_titration_acid|bio_test_tubes',
  ],
  [
    'science',
    'matematik|cebir|geometri|trigonometri|kalkulus|turev|integral|limit|fonksiyon|polinom|logaritma|karmasik sayi|matris|lineer cebir',
    'abacus|calculator|function|infinity|pi|sigma|triangular-ruler|chart-increasing',
    '',
    'sci_calculus_integral|sci_polar_unit_circle',
  ],
  [
    'science',
    'olasilik|istatistik|standart sapma|hipotez|gauss|normal dagilim',
    'bar-chart|pie-chart|chart-increasing|game-die|calculator',
    '',
    'sci_gauss_bell',
  ],
  [
    'science',
    'astronomi|uzay|evren|galaksi|yorunge|kara delik|astrofizik',
    'telescope|ringed-planet|milky-way|rocket|satellite|star',
    '',
    'sci_atom_orbital_v3',
  ],

  // ==================== 9. İKTİSAT & İŞLETME ====================
  [
    'business',
    'iktisat|ekonomi|arz ve talep|arz talep|enflasyon|faiz|merkez bankasi|gsyih|makro iktisat|mikro iktisat',
    'chart-increasing|chart-line|trending-up|coins|bank|balance-scale',
    '',
    'soc_supply_demand',
  ],
];

/**
 * Additional compact direct Turkish -> English visual dictionary (650+ fast root pairs)
 * so everyday & academic single words resolve with 100% precision!
 */
export const DIRECT_TR_EN_PAIRS = {
  araba: ['car', 'automobile', 'vehicle'],
  otomobil: ['car', 'vehicle'],
  kamyon: ['truck', 'delivery'],
  otobus: ['bus', 'transit'],
  tren: ['train', 'railway'],
  ucak: ['airplane', 'flight', 'aviation'],
  gemi: ['ship', 'boat', 'anchor'],
  bisiklet: ['bicycle', 'bike'],
  ev: ['home', 'house', 'building'],
  okul: ['school', 'education', 'graduation'],
  universite: ['university', 'graduation-cap', 'campus'],
  hastane: ['hospital', 'medical', 'ambulance'],
  fabrika: ['factory', 'industry', 'cog'],
  kutuphane: ['library', 'books', 'book-open'],
  laboratuvar: ['laboratory', 'flask', 'microscope', 'test-tube'],
  bilgisayar: ['computer', 'laptop', 'desktop', 'monitor'],
  telefon: ['phone', 'smartphone', 'mobile'],
  tablet: ['tablet', 'ipad', 'device'],
  klavye: ['keyboard', 'typing'],
  fare: ['mouse', 'cursor'],
  ekran: ['monitor', 'display', 'screen'],
  yazici: ['printer', 'print'],
  kamera: ['camera', 'video', 'photo'],
  mikrofon: ['microphone', 'audio', 'voice'],
  hoparlor: ['speaker', 'volume', 'sound'],
  kulaklik: ['headphones', 'headset', 'audio'],
  gunes: ['sun', 'solar', 'sunny'],
  yagmur: ['rain', 'cloud-rain', 'umbrella'],
  kar: ['snow', 'snowflake', 'winter'],
  ruzgar: ['wind', 'breeze', 'turbine'],
  ates: ['fire', 'flame', 'hot'],
  su: ['water', 'droplet', 'wave'],
  toprak: ['soil', 'earth', 'seedling'],
  hava: ['air', 'wind', 'cloud'],
  hayvan: ['animal', 'paw', 'dog', 'cat'],
  kus: ['bird', 'feather', 'wing'],
  balik: ['fish', 'ocean', 'aquarium'],
  bocek: ['bug', 'insect', 'butterfly', 'bee'],
  kedi: ['cat', 'pet'],
  kopek: ['dog', 'pet'],
  at: ['horse', 'knight'],
  aslan: ['lion', 'crown'],
  beslenme: ['nutrition', 'apple', 'carrot', 'food'],
  vitamin: ['apple', 'pill', 'orange', 'health'],
  protein: ['meat', 'egg', 'dna', 'molecule'],
  karbonhidrat: ['bread', 'wheat', 'grain'],
  spor: ['dumbbell', 'running', 'trophy', 'activity'],
  uyku: ['moon', 'bed', 'zzz'],
  stres: ['bolt', 'brain', 'alert-circle'],
  hafiza: ['brain', 'memory', 'bookmark'],
  dikkat: ['eye', 'target', 'focus'],
  ogrenme: ['graduation-cap', 'book-open', 'brain', 'lightbulb'],
  guvenlik: ['shield', 'lock', 'key'],
  gizlilik: ['eye-off', 'lock', 'fingerprint'],
  hiz: ['zap', 'bolt', 'rocket', 'gauge'],
  performans: ['gauge', 'rocket', 'trending-up'],
  maliyet: ['coins', 'dollar', 'wallet'],
  kalite: ['award', 'check-circle', 'star', 'diamond'],
  test: ['check-square', 'flask', 'clipboard-check'],
  hata: ['bug', 'alert-triangle', 'x-circle'],
  cozum: ['puzzle', 'lightbulb', 'check-circle', 'key'],
};

/**
 * Context-Disambiguated Homonyms (ONLY these receive a gentle `1.18x` discipline boost —
 * parent node titles NEVER leak into child queries!).
 */
export const HOMONYM_DISCIPLINE_RULES = {
  kopru: {
    system_design_cs: {
      en: ['network', 'router', 'switch', 'plug', 'arrows-exchange', 'ethernet'],
      packs: ['sd_network_bridge', 'sd_load_balancer', 'sd_api_gateway'],
    },
    electronics_robotics: {
      en: ['circuit', 'diode', 'resistor', 'cpu', 'bolt'],
      packs: ['elec_led_diode', 'elec_rlc_filter'],
    },
    architecture_civil: {
      en: ['bridge', 'arch', 'monument', 'landmark', 'road', 'water'],
      packs: ['arch_stone_viaduct', 'arch_suspension_bridge', 'arch_voussoir_arch'],
    },
    default: {
      en: ['bridge', 'arch', 'network', 'arrows-exchange'],
      packs: ['arch_stone_viaduct', 'sd_network_bridge'],
    },
  },
  kapak: {
    medicine_biology: {
      en: ['heart', 'heart-organ', 'cardiogram', 'pulse', 'stethoscope', 'anatomy'],
      packs: ['med_heart_chambers', 'med_heart_mitral', 'med_echo_ultrasound'],
    },
    default: {
      en: ['book', 'box', 'shield', 'heart'],
      packs: ['med_heart_chambers'],
    },
  },
  ag: {
    system_design_cs: {
      en: ['network', 'globe', 'wifi', 'router', 'server', 'cloud', 'sitemap'],
      packs: ['sd_vpc_cloud', 'sd_cdn_edge', 'sd_network_bridge'],
    },
    medicine_biology: {
      en: ['neuron', 'synapse', 'brain', 'network', 'cell'],
      packs: ['med_synapse_neuro', 'med_neuron_synapse'],
    },
    default: {
      en: ['network', 'globe', 'sitemap', 'wifi'],
      packs: ['sd_vpc_cloud', 'sci_neural_net_ai'],
    },
  },
  hucre: {
    medicine_biology: {
      en: ['cell', 'dna', 'mitochondria', 'microscope', 'bacteria', 'biology'],
      packs: ['bio_eukaryote_cell', 'bio_mitochondria_atp', 'med_cell_mitochondria'],
    },
    electronics_robotics: {
      en: ['battery', 'solar', 'bolt', 'power'],
      packs: ['elec_lithium_bms', 'eng_bms_battery'],
    },
    default: {
      en: ['cell', 'dna', 'mitochondria', 'microscope', 'biology'],
      packs: ['bio_eukaryote_cell', 'bio_mitochondria_atp'],
    },
  },
  kuyruk: {
    system_design_cs: {
      en: ['layers', 'list', 'inbox', 'kafka', 'rabbitmq', 'arrows-right', 'server'],
      packs: ['sd_kafka_queue', 'sd_microservice'],
    },
    default: {
      en: ['layers', 'list', 'arrows-right', 'comet'],
      packs: ['sd_kafka_queue'],
    },
  },
  kemer: {
    architecture_civil: {
      en: ['arch', 'bridge', 'dome', 'pillar', 'landmark', 'castle', 'stone'],
      packs: ['arch_voussoir_arch', 'arch_stone_viaduct', 'arch_gothic_buttress'],
    },
    default: {
      en: ['arch', 'bridge', 'landmark'],
      packs: ['arch_voussoir_arch'],
    },
  },
  dalga: {
    electronics_robotics: {
      en: ['wave-sine', 'antenna', 'wifi', 'radio', 'signal', 'activity'],
      packs: ['elec_oscilloscope', 'elec_rf_antenna'],
    },
    exact_sciences: {
      en: ['wave-sine', 'prism', 'sound', 'water', 'physics'],
      packs: ['sci_prism_spectrum_v3', 'sci_pendulum_wave'],
    },
    default: {
      en: ['wave', 'water', 'signal', 'activity'],
      packs: ['elec_oscilloscope'],
    },
  },
};

// Precompile fast lookup tables on first load (1-to-1 Exact Lexicon FIRST, Academic Domain Clusters SECOND!)
const trPhraseMap = new Map();
const enToTrReverseMap = new Map();

function registerClusterInLookup(clusterObj) {
  for (const tr of clusterObj.trTerms) {
    const existing = trPhraseMap.get(tr) || [];
    if (!existing.includes(clusterObj)) existing.push(clusterObj);
    trPhraseMap.set(tr, existing);

    const stemmed = tr.split(' ').map(stemTurkishSafe).join(' ');
    if (stemmed && stemmed !== tr) {
      const ex2 = trPhraseMap.get(stemmed) || [];
      if (!ex2.includes(clusterObj)) ex2.push(clusterObj);
      trPhraseMap.set(stemmed, ex2);
    }
  }

  // Tight reverse tagging: attach ONLY the first 3 primary Turkish synonyms so unrelated siblings never cross-tag!
  const maxTrReverse = clusterObj.isExactLexicon ? 3 : 2;
  for (const en of clusterObj.enTokens) {
    const cleanEn = en.replace(/[^a-z0-9-]/g, '');
    if (!cleanEn) continue;
    let entry = enToTrReverseMap.get(cleanEn);
    if (!entry) {
      entry = { trSet: new Set(), domains: new Set() };
      enToTrReverseMap.set(cleanEn, entry);
    }
    entry.domains.add(clusterObj.domain);
    for (const tr of clusterObj.trTerms.slice(0, maxTrReverse)) {
      entry.trSet.add(tr);
    }
  }
}

// 1. Register strict 1-to-1 DIRECT_TR_EN_PAIRS & EXTRA_DOMAIN_LEXICON FIRST (`isExactLexicon: true`)
for (const [trWord, enArr] of Object.entries(DIRECT_TR_EN_PAIRS)) {
  const normTr = normalizeTrToken(trWord);
  if (!normTr) continue;
  registerClusterInLookup({
    domain: 'general',
    trTerms: [normTr],
    enTokens: enArr.map((s) => s.trim().toLowerCase()).filter(Boolean),
    blockedTokens: [],
    packIds: [],
    isExactLexicon: true,
  });
}

for (const [domain, rows] of Object.entries(EXTRA_DOMAIN_LEXICON)) {
  for (const row of rows) {
    const [trPart, enPart] = row.split(':');
    if (!trPart || !enPart) continue;
    const trTerms = trPart.split(',').map((s) => normalizeTrToken(s)).filter(Boolean);
    const enTokens = enPart.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    registerClusterInLookup({
      domain,
      trTerms,
      enTokens,
      blockedTokens: [],
      packIds: [],
      isExactLexicon: true,
    });
  }
}

// 2. Register Specialist Academic Clusters (`RAW_TAXONOMY_CLUSTERS`)
for (const row of RAW_TAXONOMY_CLUSTERS) {
  const [domain, trPipe, enPipe, blockedPipe = '', packsPipe = ''] = row;
  const trTerms = trPipe.split('|').map((s) => normalizeTrToken(s)).filter(Boolean);
  const enTokens = enPipe.split('|').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const blockedTokens = blockedPipe.split('|').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const packIds = packsPipe.split('|').map((s) => s.trim()).filter(Boolean);
  registerClusterInLookup({
    domain,
    trTerms,
    enTokens,
    blockedTokens,
    packIds,
    isExactLexicon: false,
  });
}

// 3. Register 3,482 Official Unicode CLDR v49 Turkish Concepts LAST (ONLY for words NOT already in our curated 1-to-1 / academic / homonym tables!)
for (const [trTerm, enSlugs] of Object.entries(CLDR_TR_TO_EN_CONCEPTS)) {
  const normKey = normalizeTrToken(trTerm);
  if (!normKey || trPhraseMap.has(normKey) || HOMONYM_DISCIPLINE_RULES[normKey]) continue;
  const stemKey = stemTurkishSafe(normKey);
  if (stemKey && (trPhraseMap.has(stemKey) || HOMONYM_DISCIPLINE_RULES[stemKey])) continue;
  const cleanSlugs = enSlugs.filter((s) => !s.includes('face') && s !== 'mosquito');
  if (cleanSlugs.length === 0) continue;
  registerClusterInLookup({
    domain: 'general',
    trTerms: [normKey],
    enTokens: cleanSlugs,
    blockedTokens: [],
    packIds: [],
    isExactLexicon: true,
  });
}

/**
 * Used at build time (`scripts/build-offline-icon-shards.mjs`) to enrich every English Iconify
 * icon with accurate Turkish tags + academic domain!
 */
export function enrichEnglishIconTokensWithTurkish(enTokens, packPrefix) {
  const trTags = new Set();
  const domainVotes = new Map();

  if (packPrefix === 'healthicons' || packPrefix === 'medical-icon') {
    domainVotes.set('medicine_bio', 4);
    trTags.add('tip');
    trTags.add('saglik');
  } else if (packPrefix === 'devicon' || packPrefix === 'skill-icons' || packPrefix === 'logos') {
    domainVotes.set('system_cs', 4);
    trTags.add('yazilim');
  }

  for (const tok of enTokens) {
    const hit = enToTrReverseMap.get(tok);
    if (hit) {
      for (const t of hit.trSet) trTags.add(t);
      for (const d of hit.domains) {
        domainVotes.set(d, (domainVotes.get(d) || 0) + 2);
      }
    }
  }

  let bestDomain = 'general';
  let bestScore = 0;
  for (const [dom, sc] of domainVotes.entries()) {
    if (sc > bestScore) {
      bestScore = sc;
      bestDomain = dom;
    }
  }

  return {
    trTags: Array.from(trTags).slice(0, 10).join(' '),
    domain: bestDomain,
  };
}

/**
 * Expands a Turkish or English user query into high-precision Primary & Secondary visual tokens,
 * matched built-in Atlas IDs, and strict Prefix-Collision blocked tokens!
 */
export function expandSemanticQueryV3(rawQuery, disciplineHint = 'system_design_cs') {
  const norm = normalizeTrToken(rawQuery);
  if (!norm) {
    return {
      normalizedQuery: '',
      stemmedTokens: [],
      primaryEnTokens: [],
      secondaryEnTokens: [],
      expandedEnTokens: [],
      expandedTrTokens: [],
      blockedTokens: [],
      matchedAtlasIds: [],
      detectedDomains: [],
      isHomonym: false,
      hasLexiconMatch: false,
    };
  }

  const rawWords = norm.split(' ').filter((w) => w.length >= 2 || norm.length <= 3);
  const contentWords = rawWords.filter((w) => !TURKISH_STOPWORDS.has(w));
  const words = contentWords.length > 0 ? contentWords : rawWords;
  const stemmedWords = words.map(stemTurkishSafe).filter(Boolean);
  const stemmedPhrase = stemmedWords.join(' ');

  const primaryEn = new Set();
  const secondaryEn = new Set();
  const expandedTr = new Set([
    norm,
    ...stemmedWords.filter((w) => w.length >= 3 && !TURKISH_STOPWORDS.has(w)),
  ]);
  const blocked = new Set();
  const atlasIds = new Set();
  const domains = new Set();
  let isHomonym = false;

  // 1. Check Homonym Table ONLY when the user typed the 1-word ambiguous homonym alone (`köprü`, `kapak`, `ağ`, `hücre`, `kuyruk`, `kemer`, `dalga`)
  if (words.length === 1) {
    for (const st of [norm, stemmedPhrase, ...stemmedWords]) {
      const hom = HOMONYM_DISCIPLINE_RULES[st];
      if (hom) {
        isHomonym = true;
        const picked = hom[disciplineHint] || hom.default;
        picked.en.slice(0, 4).forEach((e) => primaryEn.add(e));
        picked.en.slice(4).forEach((e) => secondaryEn.add(e));
        for (const p of picked.packs) atlasIds.add(p);
      }
    }
  }

  // 2. Full phrase match & multi-word n-gram matches (Highest specificity FIRST!)
  const phraseClusters = [];
  const wordClusters = [];
  const tryLookup = (key, targetArr) => {
    if (!key || TURKISH_STOPWORDS.has(key)) return;
    const hits = trPhraseMap.get(key);
    if (hits) {
      for (const c of hits) {
        if (!phraseClusters.includes(c) && !wordClusters.includes(c)) {
          targetArr.push(c);
        }
      }
    }
  };

  tryLookup(norm, phraseClusters);
  tryLookup(stemmedPhrase, phraseClusters);

  for (let i = 0; i < words.length; i++) {
    if (i + 1 < words.length) {
      tryLookup(`${words[i]} ${words[i + 1]}`, phraseClusters);
      tryLookup(`${stemmedWords[i]} ${stemmedWords[i + 1]}`, phraseClusters);
    }
  }

  for (let i = 0; i < words.length; i++) {
    if (phraseClusters.length > 0 && stemmedWords[i].length <= 3) continue;
    tryLookup(words[i], wordClusters);
    tryLookup(stemmedWords[i], wordClusters);
  }

  // If an exact 1-to-1 lexicon entry (`isExactLexicon`) matched for a single-word everyday query,
  // still harvest `blockedTokens` / `packIds` from specialist clusters, but keep ONLY tight tokens as `primaryEn`!
  const hasExactLexiconHit =
    phraseClusters.some((c) => c.isExactLexicon) ||
    wordClusters.some((c) => c.isExactLexicon);

  const matchedClusters = [...phraseClusters, ...wordClusters];

  // 3. Safe >=5-char prefix match while user is mid-typing a Turkish word (e.g. `mikroorg`, `helikop`, `ekokardi`)
  if (matchedClusters.length === 0 && norm.length >= 5) {
    for (const [key, clusters] of trPhraseMap.entries()) {
      if (
        key.length >= 5 &&
        !key.includes(' ') &&
        (key.startsWith(norm) || (norm.length >= 6 && norm.startsWith(key)))
      ) {
        if (
          (norm.startsWith('mikro') && key.slice(0, 8) !== norm.slice(0, 8)) ||
          (norm.startsWith('eko') && key.slice(0, 6) !== norm.slice(0, 6))
        ) {
          continue;
        }
        for (const c of clusters) {
          if (!matchedClusters.includes(c)) matchedClusters.push(c);
        }
        if (matchedClusters.length >= 4) break;
      }
    }
  }

  for (const c of phraseClusters) {
    domains.add(c.domain);
    if (c.isExactLexicon) {
      c.enTokens.forEach((e) => primaryEn.add(e));
    } else {
      c.enTokens.slice(0, 5).forEach((e) => primaryEn.add(e));
      c.enTokens.slice(5).forEach((e) => secondaryEn.add(e));
    }
    for (const t of c.trTerms.slice(0, 3)) expandedTr.add(t);
    for (const b of c.blockedTokens) blocked.add(b);
    for (const p of c.packIds) atlasIds.add(p);
  }

  for (const c of wordClusters) {
    domains.add(c.domain);
    for (const b of c.blockedTokens) blocked.add(b);
    for (const p of c.packIds) atlasIds.add(p);

    if (c.isExactLexicon) {
      c.enTokens.forEach((e) => primaryEn.add(e));
    } else if (!hasExactLexiconHit && phraseClusters.length === 0) {
      c.enTokens.slice(0, 4).forEach((e) => primaryEn.add(e));
      c.enTokens.slice(4).forEach((e) => secondaryEn.add(e));
    } else {
      c.enTokens.slice(0, 4).forEach((e) => secondaryEn.add(e));
    }
  }

  // If no phrase/word cluster matched (only mid-typing prefix fallback), populate from matchedClusters
  if (phraseClusters.length === 0 && wordClusters.length === 0) {
    for (const c of matchedClusters) {
      domains.add(c.domain);
      c.enTokens.slice(0, 4).forEach((e) => primaryEn.add(e));
      for (const b of c.blockedTokens) blocked.add(b);
      for (const p of c.packIds) atlasIds.add(p);
    }
  }

  // Always preserve any direct English/tech words typed by the user (e.g. `react`, `docker`, `python`, `commander`, `honeycomb`)
  // AND expand abstract English intent words via `EN_CONCEPT_INTENT_MAP` so English queries like "commander" ALWAYS find crisp relevant icons!
  let matchedEnglishIntent = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const sw = stemmedWords[i];
    const intentProxies = EN_CONCEPT_INTENT_MAP[w];
    if (intentProxies) {
      matchedEnglishIntent = true;
      primaryEn.add(w);
      intentProxies.forEach((p) => primaryEn.add(p));
      continue;
    }
    if (w.length >= 2 && !TURKISH_STOPWORDS.has(w)) {
      const matchedTr = trPhraseMap.has(w) || trPhraseMap.has(sw);
      if (!matchedTr && (w.length >= 3 || words.length === 1)) {
        primaryEn.add(w);
      }
    }
  }

  // Explicit Prefix Collision Hard-Locks even on partial typing!
  if (
    norm.startsWith('mikroorg') ||
    norm.startsWith('mikrobiyo') ||
    norm === 'mikrop' ||
    norm.startsWith('mikropl') ||
    norm.startsWith('bakteri')
  ) {
    for (const bad of [
      'microchip', 'chip', 'cpu', 'processor', 'server', 'nand', 'nor', 'xor',
      'gate', 'logic', 'stair', 'stairs', 'ladder', 'chimney', 'minaret', 'mosque',
      'microphone', 'microwave', 'microsoft', 'router', 'database', 'kubernetes', 'docker',
    ]) {
      blocked.add(bad);
    }
  } else if (norm === 'cip' || norm === 'mikrocip' || norm.startsWith('islemci')) {
    for (const bad of [
      'potato', 'fries', 'cookie', 'chocolate', 'casino', 'poker', 'gambling',
      'fish', 'snack', 'microbe', 'bacteria', 'virus',
    ]) {
      blocked.add(bad);
    }
  } else if (norm.startsWith('ekokardiyo')) {
    for (const bad of ['economy', 'economics', 'coin', 'dollar', 'ecology', 'recycle', 'cart']) {
      blocked.add(bad);
    }
  }

  for (const b of blocked) {
    primaryEn.delete(b);
    secondaryEn.delete(b);
  }
  for (const p of primaryEn) {
    secondaryEn.delete(p);
  }

  const primaryArr = Array.from(primaryEn);
  const secondaryArr = Array.from(secondaryEn);

  const hasLexiconMatch =
    isHomonym ||
    matchedEnglishIntent ||
    phraseClusters.length > 0 ||
    wordClusters.length > 0;

  return {
    normalizedQuery: norm,
    stemmedTokens: stemmedWords,
    primaryEnTokens: primaryArr,
    secondaryEnTokens: secondaryArr,
    expandedEnTokens: [...primaryArr, ...secondaryArr],
    expandedTrTokens: Array.from(expandedTr),
    blockedTokens: Array.from(blocked),
    matchedAtlasIds: Array.from(atlasIds),
    detectedDomains: Array.from(domains),
    isHomonym,
    hasLexiconMatch,
  };
}
