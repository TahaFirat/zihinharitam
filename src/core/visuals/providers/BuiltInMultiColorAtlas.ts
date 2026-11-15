import type { DisciplineProfile, GalleryCategoryFilter } from '../../../types/mindmap';
import { encodeSvgToDataUri } from '../PureVectorStickerizer';
import { SYSTEM_DESIGN_AND_ATLAS_PACK } from './SystemDesignVisualPack';

export interface BespokeVisualEntry {
  id: string;
  titleTr: string;
  discipline: DisciplineProfile;
  category: Exclude<GalleryCategoryFilter, 'all'>;
  keywords: string[];
  svgDataUri: string;
}

function wrapAtlasSvg(innerMarkup: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="160" height="160">
    <rect x="7" y="7" width="114" height="114" rx="30" fill="#FFFFFF" stroke="#0F172A" stroke-opacity="0.10" stroke-width="1.6"/>
    ${innerMarkup}
  </svg>`;
  return encodeSvgToDataUri(svg);
}

export const EXTRA_MULTI_COLOR_ATLAS: BespokeVisualEntry[] = [
  // =========================================================================
  // MİKROBİYOLOJİ & BİYOLOJİ (20 ÖZEL ÇOK RENKLİ İLLÜSTRASYON)
  // =========================================================================
  {
    id: 'bio_bacteria_bacillus',
    titleTr: 'Kamçılı Bakteri (Basil)',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mikroorganizma', 'bakteri', 'mikrop', 'basil', 'prokaryot', 'flagella', 'bacteria', 'microbe', 'bacillus', 'microorganism'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFDF5"/>
      <path d="M84 48 C100 36, 108 44, 114 34 M88 58 C104 54, 110 64, 116 58 M84 70 C98 76, 106 86, 114 82" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
      <rect x="24" y="42" width="64" height="38" rx="19" transform="rotate(-14 56 61)" fill="#10B981" stroke="#065F46" stroke-width="3.2"/>
      <rect x="31" y="48" width="50" height="26" rx="13" transform="rotate(-14 56 61)" fill="#6EE7B7"/>
      <path d="M40 63 C47 54, 55 68, 63 57 C68 51, 72 62, 75 58" fill="none" stroke="#7C3AED" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="42" cy="54" r="2.6" fill="#F59E0B"/><circle cx="68" cy="64" r="2.6" fill="#F59E0B"/><circle cx="54" cy="68" r="2.2" fill="#0EA5E9"/>
    `),
  },
  {
    id: 'bio_cocci_colony',
    titleTr: 'Kok Bakteri Kolonisi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mikroorganizma', 'bakteri', 'kok', 'stafilokok', 'streptokok', 'koloni', 'mikrop', 'cocci', 'staphylococcus', 'bacteria'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <g stroke="#92400E" stroke-width="2.8">
        <circle cx="52" cy="48" r="12" fill="#F59E0B"/><circle cx="72" cy="46" r="11" fill="#FBBF24"/>
        <circle cx="42" cy="66" r="11" fill="#FBBF24"/><circle cx="62" cy="64" r="13" fill="#F59E0B"/>
        <circle cx="82" cy="64" r="11" fill="#FBBF24"/><circle cx="54" cy="82" r="11" fill="#F59E0B"/>
        <circle cx="73" cy="81" r="10.5" fill="#FCD34D"/>
      </g>
      <circle cx="49" cy="44" r="3" fill="#FFFBEB"/><circle cx="59" cy="60" r="3.5" fill="#FFFBEB"/><circle cx="79" cy="61" r="2.8" fill="#FFFBEB"/>
    `),
  },
  {
    id: 'bio_virus_capsid',
    titleTr: 'Virüs Kapsidi & Spike Proteinleri',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mikroorganizma', 'virus', 'virüs', 'koronavirus', 'patojen', 'kapsid', 'salgin', 'enfeksiyon', 'viral', 'pathogen'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFE4E6"/>
      <g stroke="#BE123C" stroke-width="3" stroke-linecap="round">
        <line x1="64" y1="20" x2="64" y2="34"/><circle cx="64" cy="18" r="4.5" fill="#FB7185"/>
        <line x1="64" y1="94" x2="64" y2="108"/><circle cx="64" cy="110" r="4.5" fill="#FB7185"/>
        <line x1="20" y1="64" x2="34" y2="64"/><circle cx="18" cy="64" r="4.5" fill="#FB7185"/>
        <line x1="94" y1="64" x2="108" y2="64"/><circle cx="110" cy="64" r="4.5" fill="#FB7185"/>
        <line x1="33" y1="33" x2="43" y2="43"/><circle cx="31" cy="31" r="4.2" fill="#FB7185"/>
        <line x1="95" y1="33" x2="85" y2="43"/><circle cx="97" cy="31" r="4.2" fill="#FB7185"/>
        <line x1="33" y1="95" x2="43" y2="85"/><circle cx="31" cy="97" r="4.2" fill="#FB7185"/>
        <line x1="95" y1="95" x2="85" y2="85"/><circle cx="97" cy="97" r="4.2" fill="#FB7185"/>
      </g>
      <circle cx="64" cy="64" r="28" fill="#F43F5E" stroke="#9F1239" stroke-width="3.2"/>
      <path d="M50 64 C55 52, 62 76, 68 56 C72 48, 76 70, 79 62" fill="none" stroke="#FEF08A" stroke-width="3.4" stroke-linecap="round"/>
    `),
  },
  {
    id: 'bio_bacteriophage',
    titleTr: 'Bakteriyofaj (T4 Faj Virüsü)',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['bakteriyofaj', 'faj', 'virus', 'virüs', 'mikroorganizma', 'mikrobiyoloji', 'bacteriophage', 'phage', 'virology'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EDE9FE"/>
      <polygon points="64,20 84,34 80,56 48,56 44,34" fill="#8B5CF6" stroke="#4C1D95" stroke-width="3"/>
      <polygon points="64,25 78,36 74,51 54,51 50,36" fill="#C4B5FD"/>
      <rect x="59" y="56" width="10" height="26" rx="3" fill="#38BDF8" stroke="#0369A1" stroke-width="2.6"/>
      <line x1="59" y1="63" x2="69" y2="63" stroke="#0369A1" stroke-width="2"/><line x1="59" y1="70" x2="69" y2="70" stroke="#0369A1" stroke-width="2"/>
      <rect x="52" y="82" width="24" height="6" rx="3" fill="#4C1D95"/>
      <path d="M54 86 L34 98 L28 108 M58 88 L44 102 L40 110 M74 86 L94 98 L100 108 M70 88 L84 102 L88 110" fill="none" stroke="#4C1D95" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'bio_petri_culture',
    titleTr: 'Petri Kabı & Agar Kültürü',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['petri', 'kultur', 'kültür', 'agar', 'mikroorganizma', 'bakteri', 'mikrobiyoloji', 'laboratuvar', 'petri-dish', 'colony'],
    svgDataUri: wrapAtlasSvg(`
      <ellipse cx="64" cy="70" rx="46" ry="30" fill="#CBD5E1" stroke="#334155" stroke-width="3"/>
      <ellipse cx="64" cy="64" rx="46" ry="30" fill="#FDE68A" stroke="#0F172A" stroke-width="3"/>
      <ellipse cx="64" cy="64" rx="40" ry="24" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1.8"/>
      <path d="M36 58 Q56 46 82 54 Q46 64 86 68 Q52 76 76 80" fill="none" stroke="#EF4444" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="46" cy="56" r="4" fill="#F43F5E"/><circle cx="78" cy="56" r="3.5" fill="#10B981"/>
      <circle cx="54" cy="72" r="4.5" fill="#F43F5E"/><circle cx="72" cy="74" r="3" fill="#8B5CF6"/><circle cx="86" cy="64" r="3.2" fill="#10B981"/>
    `),
  },
  {
    id: 'bio_microscope_lab',
    titleTr: 'Optik Laboratuvar Mikroskobu',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mikroskop', 'mikroorganizma', 'mikrobiyoloji', 'biyoloji', 'laboratuvar', 'inceleme', 'mercek', 'microscope', 'optics'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#E0F2FE"/>
      <rect x="30" y="98" width="68" height="10" rx="5" fill="#1E293B"/>
      <path d="M74 42 C92 48, 94 78, 76 98" fill="none" stroke="#475569" stroke-width="9" stroke-linecap="round"/>
      <rect x="48" y="20" width="14" height="34" rx="4" transform="rotate(18 55 37)" fill="#0EA5E9" stroke="#0F172A" stroke-width="2.8"/>
      <rect x="52" y="14" width="10" height="8" rx="2" transform="rotate(18 57 18)" fill="#0F172A"/>
      <rect x="36" y="72" width="38" height="6" rx="3" fill="#0F172A"/>
      <rect x="44" y="68" width="20" height="4" rx="1.5" fill="#38BDF8"/>
      <circle cx="54" cy="86" r="6" fill="#FBBF24" stroke="#92400E" stroke-width="2.2"/>
      <circle cx="78" cy="66" r="6" fill="#94A3B8" stroke="#1E293B" stroke-width="2.4"/>
    `),
  },
  {
    id: 'bio_eukaryote_cell',
    titleTr: 'Ökaryot Hücre & Organeller',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['hucre', 'hücre', 'okaryot', 'organel', 'cekirdek', 'sitoplazma', 'biyoloji', 'mikroorganizma', 'cell', 'nucleus', 'organelle'],
    svgDataUri: wrapAtlasSvg(`
      <ellipse cx="64" cy="64" rx="46" ry="38" fill="#CCFBF1" stroke="#0D9488" stroke-width="3.5"/>
      <ellipse cx="64" cy="64" rx="40" ry="32" fill="#E6FFFA"/>
      <circle cx="58" cy="62" r="15" fill="#A78BFA" stroke="#5B21B6" stroke-width="2.8"/>
      <circle cx="56" cy="60" r="6" fill="#5B21B6"/>
      <ellipse cx="86" cy="54" rx="8" ry="5" transform="rotate(25 86 54)" fill="#FB923C" stroke="#9A3412" stroke-width="2"/>
      <ellipse cx="40" cy="80" rx="8" ry="4.5" transform="rotate(-20 40 80)" fill="#FB923C" stroke="#9A3412" stroke-width="2"/>
      <path d="M36 46 C42 40, 50 40, 56 44 M38 51 C44 45, 50 46, 54 48" fill="none" stroke="#0284C7" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="78" cy="78" r="4" fill="#34D399" stroke="#059669" stroke-width="1.8"/>
    `),
  },
  {
    id: 'bio_mitochondria_atp',
    titleTr: 'Mitokondri & ATP Üretimi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mitokondri', 'atp', 'solunum', 'enerji', 'organel', 'hucre', 'krebs', 'mitochondria', 'cellular-respiration'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFEDD5"/>
      <rect x="20" y="38" width="88" height="52" rx="26" transform="rotate(-12 64 64)" fill="#F97316" stroke="#9A3412" stroke-width="3.2"/>
      <path d="M30 66 C36 48, 42 80, 50 50 C58 80, 66 46, 74 76 C82 48, 88 76, 96 58" fill="none" stroke="#FEF08A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="66,24 58,38 65,38 61,50 73,34 66,34" fill="#EAB308" stroke="#854D0E" stroke-width="1.6"/>
    `),
  },
  {
    id: 'bio_chloroplast',
    titleTr: 'Kloroplast & Fotosentez',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['kloroplast', 'fotosentez', 'bitki', 'klorofil', 'tilakoit', 'granum', 'chloroplast', 'photosynthesis', 'plant-cell'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#DCFCE7"/>
      <ellipse cx="64" cy="64" rx="44" ry="28" fill="#22C55E" stroke="#14532D" stroke-width="3.2"/>
      <ellipse cx="64" cy="64" rx="38" ry="22" fill="#86EFAC"/>
      <g fill="#15803D" stroke="#14532D" stroke-width="1.5">
        <rect x="36" y="50" width="14" height="5" rx="2.5"/><rect x="36" y="57" width="14" height="5" rx="2.5"/><rect x="36" y="64" width="14" height="5" rx="2.5"/>
        <rect x="57" y="54" width="14" height="5" rx="2.5"/><rect x="57" y="61" width="14" height="5" rx="2.5"/><rect x="57" y="68" width="14" height="5" rx="2.5"/>
        <rect x="78" y="50" width="14" height="5" rx="2.5"/><rect x="78" y="57" width="14" height="5" rx="2.5"/>
      </g>
      <line x1="50" y1="59" x2="57" y2="63" stroke="#14532D" stroke-width="2.2"/><line x1="71" y1="63" x2="78" y2="59" stroke="#14532D" stroke-width="2.2"/>
    `),
  },
  {
    id: 'bio_dna_helix',
    titleTr: 'DNA Çift Sarmalı & Gen',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['dna', 'gen', 'genetik', 'kalitim', 'nukleotid', 'sarmal', 'kromozom', 'molekuler', 'helix', 'genetics', 'genome'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0F9FF"/>
      <line x1="46" y1="30" x2="82" y2="30" stroke="#F43F5E" stroke-width="3.2"/><line x1="42" y1="42" x2="86" y2="42" stroke="#10B981" stroke-width="3.2"/>
      <line x1="50" y1="64" x2="78" y2="64" stroke="#F59E0B" stroke-width="3.2"/><line x1="42" y1="86" x2="86" y2="86" stroke="#8B5CF6" stroke-width="3.2"/>
      <line x1="46" y1="98" x2="82" y2="98" stroke="#0EA5E9" stroke-width="3.2"/>
      <path d="M42 20 C88 42, 40 86, 86 108" fill="none" stroke="#0284C7" stroke-width="5" stroke-linecap="round"/>
      <path d="M86 20 C40 42, 88 86, 42 108" fill="none" stroke="#7C3AED" stroke-width="5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'bio_rna_strand',
    titleTr: 'mRNA & Protein Sentezi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['rna', 'mrna', 'trna', 'ribozom', 'protein', 'kodon', 'transkripsiyon', 'translasyon', 'ribosome'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FDF4FF"/>
      <ellipse cx="64" cy="70" rx="28" ry="18" fill="#E879F9" stroke="#86198F" stroke-width="2.8"/>
      <ellipse cx="64" cy="52" rx="20" ry="12" fill="#F0ABFC" stroke="#86198F" stroke-width="2.6"/>
      <path d="M22 62 C38 56, 52 66, 64 62 C78 58, 92 66, 106 60" fill="none" stroke="#0EA5E9" stroke-width="4.2" stroke-linecap="round"/>
      <circle cx="52" cy="34" r="5" fill="#F59E0B"/><circle cx="63" cy="28" r="5" fill="#10B981"/><circle cx="75" cy="24" r="5" fill="#F43F5E"/>
    `),
  },
  {
    id: 'bio_amoeba_protozoa',
    titleTr: 'Amip & Tek Hücreli Protozoa',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['amip', 'protozoa', 'tek hucreli', 'öglena', 'paramesyum', 'mikroorganizma', 'yalanci ayak', 'amoeba', 'protist'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFEFF"/>
      <path d="M44 30 C56 22, 74 34, 88 28 C102 24, 102 48, 90 58 C104 72, 96 94, 78 92 C66 90, 58 104, 42 96 C26 88, 34 72, 24 60 C16 48, 32 38, 44 30 Z" fill="#67E8F9" stroke="#0E7490" stroke-width="3.2"/>
      <circle cx="62" cy="60" r="12" fill="#8B5CF6" stroke="#4C1D95" stroke-width="2.6"/>
      <circle cx="44" cy="72" r="5.5" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
      <circle cx="78" cy="48" r="3.5" fill="#10B981"/>
    `),
  },
  {
    id: 'bio_fungi_yeast',
    titleTr: 'Mantar, Küf & Maya Hücresi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mantar', 'maya', 'kuf', 'küf', 'mikoz', 'spor', 'hif', 'fermantasyon', 'mikroorganizma', 'fungi', 'yeast', 'mycology'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF9C3"/>
      <path d="M36 58 C36 32, 92 32, 92 58 Z" fill="#EF4444" stroke="#7F1D1D" stroke-width="3"/>
      <circle cx="52" cy="46" r="4" fill="#FFFFFF"/><circle cx="68" cy="40" r="4.5" fill="#FFFFFF"/><circle cx="78" cy="50" r="3.5" fill="#FFFFFF"/>
      <rect x="55" y="58" width="18" height="32" rx="8" fill="#FEF3C7" stroke="#78350F" stroke-width="2.8"/>
      <circle cx="88" cy="78" r="9" fill="#FBBF24" stroke="#92400E" stroke-width="2.4"/><circle cx="95" cy="70" r="5" fill="#FDE68A" stroke="#92400E" stroke-width="2"/>
    `),
  },
  {
    id: 'bio_parasite_helminth',
    titleTr: 'Parazitoloji & Mikroskobik Etken',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['parazit', 'parazitoloji', 'plazmodyum', 'sitma', 'enfeksiyon', 'mikroorganizma', 'parasite', 'protozoon'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FCE7F3"/>
      <circle cx="64" cy="64" r="34" fill="#FFFFFF" stroke="#9D174D" stroke-width="3"/>
      <path d="M38 72 C42 44, 66 42, 68 64 C70 84, 90 78, 90 54" fill="none" stroke="#DB2777" stroke-width="6.5" stroke-linecap="round"/>
      <circle cx="46" cy="52" r="4" fill="#F59E0B"/><circle cx="80" cy="48" r="3.5" fill="#0EA5E9"/>
    `),
  },
  {
    id: 'bio_antibody_immune',
    titleTr: 'Antikor (IgG) & İmmünoloji',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['antikor', 'bagisiklik', 'bağışıklık', 'immunoloji', 'immünoloji', 'antijen', 'lenfosit', 'igg', 'antibody', 'immune'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EFF6FF"/>
      <path d="M64 100 L64 62 M64 62 L38 36 M64 62 L90 36" fill="none" stroke="#2563EB" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M30 44 L44 30 M98 44 L84 30" fill="none" stroke="#38BDF8" stroke-width="6" stroke-linecap="round"/>
      <circle cx="34" cy="28" r="6" fill="#F43F5E"/><circle cx="94" cy="28" r="6" fill="#F43F5E"/>
    `),
  },
  {
    id: 'bio_test_tubes',
    titleTr: 'Biyokimya Deney Tüpleri',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['deney tupu', 'tüp', 'biyokimya', 'numune', 'tahlil', 'seroloji', 'test-tube', 'laboratory'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F8FAFC"/>
      <rect x="34" y="28" width="16" height="64" rx="8" fill="#E0F2FE" stroke="#0369A1" stroke-width="2.8"/>
      <rect x="36" y="58" width="12" height="32" rx="6" fill="#38BDF8"/>
      <rect x="56" y="24" width="16" height="68" rx="8" fill="#FCE7F3" stroke="#BE123C" stroke-width="2.8"/>
      <rect x="58" y="50" width="12" height="40" rx="6" fill="#F43F5E"/>
      <rect x="78" y="28" width="16" height="64" rx="8" fill="#DCFCE7" stroke="#15803D" stroke-width="2.8"/>
      <rect x="80" y="62" width="12" height="28" rx="6" fill="#22C55E"/>
      <rect x="26" y="88" width="76" height="8" rx="4" fill="#334155"/>
    `),
  },
  {
    id: 'bio_erlenmeyer_flask',
    titleTr: 'Erlenmayer & Kültür Çözeltisi',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    keywords: ['erlenmayer', 'beher', 'cozelti', 'çözelti', 'kimya', 'reaksiyon', 'deney', 'flask', 'chemistry'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFDF5"/>
      <path d="M52 24 H76 M56 24 V48 L30 94 C28 98, 31 102, 36 102 H92 C97 102, 100 98, 98 94 L72 48 V24" fill="#E0F2FE" stroke="#0F172A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 76 L88 76 L96 92 C97 96, 95 99, 90 99 H38 C33 99, 31 96, 32 92 Z" fill="#10B981"/>
      <circle cx="58" cy="86" r="3.5" fill="#A7F3D0"/><circle cx="70" cy="66" r="3" fill="#10B981"/><circle cx="62" cy="56" r="2.5" fill="#34D399"/>
    `),
  },
  {
    id: 'bio_pipette_assay',
    titleTr: 'Mikropipet & PCR Testi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['pipet', 'pcr', 'elisa', 'molekuler', 'numune', 'damla', 'pipette', 'assay'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0F9FF"/>
      <g transform="rotate(28 64 58)">
        <rect x="57" y="18" width="14" height="44" rx="5" fill="#6366F1" stroke="#312E81" stroke-width="2.8"/>
        <polygon points="59,62 69,62 66,92 62,92" fill="#BAE6FD" stroke="#0369A1" stroke-width="2.4"/>
      </g>
      <path d="M45 96 C45 90, 50 86, 50 86 C50 86, 55 90, 55 96 A5 5 0 1 1 45 96 Z" fill="#F43F5E"/>
    `),
  },
  {
    id: 'bio_enzyme_substrate',
    titleTr: 'Enzim & Substrat Kompleksi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['enzim', 'substrat', 'katalizor', 'aktif bolge', 'biyokimya', 'metabolizma', 'enzyme', 'substrate'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <path d="M26 64 A34 34 0 1 0 90 48 L72 58 L62 44 L48 56 Z" fill="#8B5CF6" stroke="#4C1D95" stroke-width="3"/>
      <polygon points="52,48 62,38 72,52 90,42 78,26 52,30" fill="#F59E0B" stroke="#92400E" stroke-width="2.8"/>
    `),
  },
  {
    id: 'bio_chromosome_gene',
    titleTr: 'Kromozom & Mitoz/Mayoz',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['kromozom', 'mitoz', 'mayoz', 'genetik', 'kromatit', 'sentromer', 'chromosome', 'mitosis'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FCE7F3"/>
      <path d="M44 26 C56 52, 56 76, 44 102 M84 26 C72 52, 72 76, 84 102" fill="none" stroke="#EC4899" stroke-width="12" stroke-linecap="round"/>
      <circle cx="64" cy="64" r="8" fill="#FDE047" stroke="#A16207" stroke-width="2.6"/>
    `),
  },

  // =========================================================================
  // TIP, KARDİYOLOJİ & ANATOMİ (18 ÖZEL ÇOK RENKLİ İLLÜSTRASYON)
  // =========================================================================
  {
    id: 'med_echo_ultrasound',
    titleTr: 'Ekokardiyografi (Ultrason & Eko)',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['ekokardiyografi', 'eko', 'ultrason', 'doppler', 'kardiyoloji', 'kalp goruntuleme', 'echocardiography', 'echocardiogram', 'ultrasound'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EFF6FF"/>
      <path d="M64 30 L26 96 A48 48 0 0 0 102 96 Z" fill="#0F172A" stroke="#1E40AF" stroke-width="2.8"/>
      <path d="M46 66 A24 24 0 0 0 82 66 M38 82 A38 38 0 0 0 90 82" fill="none" stroke="#38BDF8" stroke-width="2" stroke-dasharray="4 3"/>
      <path d="M64 78 C55 70, 50 62, 55 56 C59 52, 64 56, 64 59 C64 56, 69 52, 73 56 C78 62, 73 70, 64 78 Z" fill="#F43F5E"/>
      <rect x="55" y="16" width="18" height="16" rx="5" fill="#0EA5E9" stroke="#0F172A" stroke-width="2.6"/>
    `),
  },
  {
    id: 'med_heart_chambers',
    titleTr: 'Kalp Odacıkları & Mitral Kapak',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mitral kapak', 'mitral', 'trikuspit', 'aort', 'kalp', 'atriyum', 'ventrikul', 'kardiyoloji', 'heart-valve', 'cardiology'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFE4E6"/>
      <path d="M64 102 C32 82, 24 54, 38 38 C48 28, 60 34, 64 44 C68 34, 80 28, 90 38 C104 54, 96 82, 64 102 Z" fill="#F43F5E" stroke="#881337" stroke-width="3.2"/>
      <path d="M64 42 L64 96" stroke="#881337" stroke-width="3"/>
      <path d="M36 62 L58 66 M92 62 L70 66" stroke="#FEF08A" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M52 24 L52 38 M74 22 L74 38" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_ecg_monitor',
    titleTr: 'EKG Dalga Monitörü (P-QRS-T)',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['ekg', 'elektrokardiyografi', 'ritim', 'aritmi', 'nabiz', 'qrs', 'kardiyoloji', 'ecg', 'cardiogram'],
    svgDataUri: wrapAtlasSvg(`
      <rect x="18" y="26" width="92" height="72" rx="14" fill="#0F172A" stroke="#334155" stroke-width="3.2"/>
      <path d="M24 66 H40 L45 58 L50 66 H56 L60 36 L66 86 L72 52 L77 66 H84 C88 56, 94 56, 98 66 H104" fill="none" stroke="#10B981" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="96" cy="38" r="4" fill="#F43F5E"/>
    `),
  },
  {
    id: 'med_auscultation_steth',
    titleTr: 'Oskültasyon & Klinik Stetoskop',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['oskultasyon', 'oskültasyon', 'stetoskop', 'ufurum', 'üfürüm', 'muayene', 'kalp sesi', 'stethoscope', 'auscultation'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0F9FF"/>
      <path d="M40 26 V52 C40 68, 72 68, 72 52 V26" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
      <path d="M56 66 V84 C56 98, 88 98, 88 78" fill="none" stroke="#0EA5E9" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="88" cy="72" r="11" fill="#F59E0B" stroke="#0F172A" stroke-width="3"/>
      <circle cx="88" cy="72" r="4.5" fill="#FEF3C7"/>
    `),
  },
  {
    id: 'med_sa_conduction',
    titleTr: 'Sinoatriyal Düğüm & İleti Sistemi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['sinoatriyal', 'sa dugumu', 'av dugumu', 'purkinje', 'his demeti', 'pacemaker', 'kalp iletim'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFF1F2"/>
      <path d="M64 100 C34 80, 26 54, 40 38 C50 28, 60 34, 64 44 C68 34, 78 28, 88 38 C102 54, 94 80, 64 100 Z" fill="#FB7185" stroke="#9F1239" stroke-width="3"/>
      <circle cx="46" cy="48" r="6.5" fill="#FACC15" stroke="#854D0E" stroke-width="2"/>
      <circle cx="62" cy="60" r="5" fill="#FACC15" stroke="#854D0E" stroke-width="2"/>
      <path d="M46 48 L62 60 L64 74 M64 74 L48 86 M64 74 L80 86" fill="none" stroke="#FEF08A" stroke-width="3.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_alveoli_gas',
    titleTr: 'Akciğerler & Alveol Gaz Değişimi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['akciger', 'akciğer', 'alveol', 'solunum', 'brons', 'oksijen', 'pulmoner', 'dispne', 'lungs', 'respiratory'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFEFF"/>
      <path d="M64 22 V52 M64 46 L48 58 M64 46 L80 58" fill="none" stroke="#0284C7" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M56 38 C32 38, 24 66, 28 88 C30 96, 54 94, 56 82 Z" fill="#FDA4AF" stroke="#BE123C" stroke-width="2.8"/>
      <path d="M72 38 C96 38, 104 66, 100 88 C98 96, 74 94, 72 82 Z" fill="#FDA4AF" stroke="#BE123C" stroke-width="2.8"/>
    `),
  },
  {
    id: 'med_kidney_nephron_v3',
    titleTr: 'Böbrek & Nefron Glomerül',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['bobrek', 'böbrek', 'nefron', 'glomerul', 'renal', 'bosaltim', 'diyaliz', 'kidney', 'nephron'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF2F2"/>
      <path d="M48 28 C26 30, 22 96, 48 98 C64 98, 62 76, 54 64 C62 52, 64 28, 48 28 Z" fill="#DC2626" stroke="#7F1D1D" stroke-width="3"/>
      <path d="M80 28 C102 30, 106 96, 80 98 C64 98, 66 76, 74 64 C66 52, 64 28, 80 28 Z" fill="#DC2626" stroke="#7F1D1D" stroke-width="3"/>
      <path d="M54 64 L62 104 M74 64 L66 104" fill="none" stroke="#FBBF24" stroke-width="3.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_brain_cortex',
    titleTr: 'Beyin Lobları & Nöroloji',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['beyin', 'noroloji', 'nöroloji', 'korteks', 'sinir sistemi', 'psikoloji', 'bilis', 'brain', 'neurology'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FAF5FF"/>
      <path d="M30 68 C24 50, 38 32, 58 32 C68 28, 88 32, 96 48 C104 62, 96 80, 80 84 L74 96 L58 86 C42 88, 32 80, 30 68 Z" fill="#F472B6" stroke="#831843" stroke-width="3"/>
      <path d="M44 50 C54 44, 66 54, 78 48 M42 66 C56 60, 68 70, 84 64" fill="none" stroke="#831843" stroke-width="2.6" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_synapse_neuro',
    titleTr: 'Nöron & Sinaptik İletim',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['noron', 'nöron', 'sinaps', 'akson', 'dendrit', 'norotransmitter', 'aksiyon potansiyeli', 'neuron', 'synapse'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F5F3FF"/>
      <circle cx="42" cy="54" r="16" fill="#8B5CF6" stroke="#4C1D95" stroke-width="2.8"/>
      <circle cx="42" cy="54" r="6" fill="#FDE047"/>
      <path d="M56 60 L96 82" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
      <path d="M30 42 L20 30 M42 38 L42 24 M26 56 L16 60 M32 68 L24 80" stroke="#6D28D9" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="84" r="5" fill="#10B981"/><circle cx="94" cy="92" r="4" fill="#10B981"/>
    `),
  },
  {
    id: 'med_liver_biliary',
    titleTr: 'Karaciğer & Safra Sistemi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['karaciger', 'karaciğer', 'safra', 'hepatoloji', 'hepatit', 'metabolizma', 'liver', 'hepatic'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF2F2"/>
      <path d="M26 52 C26 36, 62 34, 98 44 C102 52, 92 72, 64 78 C42 84, 26 76, 26 52 Z" fill="#B91C1C" stroke="#450A0A" stroke-width="3"/>
      <ellipse cx="66" cy="82" rx="9" ry="6" fill="#22C55E" stroke="#14532D" stroke-width="2.4"/>
    `),
  },
  {
    id: 'med_stomach_gi',
    titleTr: 'Mide & Sindirim Sistemi',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['mide', 'sindirim', 'gastroenteroloji', 'bagirsak', 'bağırsak', 'gastrit', 'stomach', 'digestive'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFF7ED"/>
      <path d="M54 24 V40 C38 42, 30 64, 42 84 C54 100, 86 96, 90 74 C92 58, 78 50, 68 54 C62 56, 62 42, 62 24" fill="#FB7185" stroke="#881337" stroke-width="3" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_bone_osteon',
    titleTr: 'Kemik, İskelet & Eklem',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['kemik', 'iskelet', 'eklem', 'ortopedi', 'kikirdak', 'anatomi', 'bone', 'joint', 'skeleton'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F8FAFC"/>
      <g transform="rotate(-35 64 64)">
        <rect x="34" y="56" width="60" height="16" rx="6" fill="#FEFCE8" stroke="#475569" stroke-width="3"/>
        <circle cx="32" cy="56" r="9" fill="#FEFCE8" stroke="#475569" stroke-width="3"/>
        <circle cx="32" cy="72" r="9" fill="#FEFCE8" stroke="#475569" stroke-width="3"/>
        <circle cx="96" cy="56" r="9" fill="#FEFCE8" stroke="#475569" stroke-width="3"/>
        <circle cx="96" cy="72" r="9" fill="#FEFCE8" stroke="#475569" stroke-width="3"/>
      </g>
    `),
  },
  {
    id: 'med_eye_retina',
    titleTr: 'Göz Anatomisi & Retina',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['goz', 'göz', 'retina', 'kornea', 'mercek', 'oftalmoloji', 'gorme', 'eye', 'ophthalmology'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0F9FF"/>
      <path d="M20 64 C36 36, 92 36, 108 64 C92 92, 36 92, 20 64 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="3.2"/>
      <circle cx="64" cy="64" r="16" fill="#0EA5E9" stroke="#0369A1" stroke-width="2.6"/>
      <circle cx="64" cy="64" r="7" fill="#0F172A"/>
      <circle cx="59" cy="59" r="3" fill="#FFFFFF"/>
    `),
  },
  {
    id: 'med_ear_cochlea',
    titleTr: 'Kulak & Koklea İşitme',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['kulak', 'koklea', 'isitme', 'işitme', 'kbb', 'denge', 'vestibuler', 'ear', 'cochlea'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFF7ED"/>
      <path d="M46 42 C46 24, 86 24, 86 54 C86 74, 70 80, 66 92 C62 100, 48 98, 48 88" fill="none" stroke="#EA580C" stroke-width="6" stroke-linecap="round"/>
      <path d="M58 56 C58 46, 72 46, 72 58 C72 68, 60 70, 60 62" fill="none" stroke="#0EA5E9" stroke-width="4" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_blood_vessel',
    titleTr: 'Kan Damarı & Alyuvarlar',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['damar', 'arter', 'ven', 'kan', 'alyuvar', 'eritrosit', 'hematoloji', 'dolasim', 'blood', 'erythrocyte'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFE4E6"/>
      <rect x="20" y="44" width="88" height="40" rx="20" fill="#991B1B" stroke="#450A0A" stroke-width="3"/>
      <ellipse cx="44" cy="62" rx="10" ry="7" fill="#F87171"/><ellipse cx="66" cy="68" rx="10" ry="7" fill="#EF4444"/><ellipse cx="86" cy="60" rx="9" ry="6.5" fill="#FCA5A5"/>
    `),
  },
  {
    id: 'med_vaccine_syringe',
    titleTr: 'Aşı & Enjektör Uygulaması',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['asi', 'aşı', 'enjektor', 'şırınga', 'bagisiklama', 'tedavi', 'vaccine', 'syringe'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFEFF"/>
      <g transform="rotate(-45 64 64)">
        <rect x="42" y="48" width="44" height="24" rx="4" fill="#E0F2FE" stroke="#0F172A" stroke-width="2.8"/>
        <rect x="46" y="52" width="24" height="16" fill="#06B6D4"/>
        <line x1="86" y1="60" x2="108" y2="60" stroke="#475569" stroke-width="2.8"/>
        <line x1="24" y1="60" x2="42" y2="60" stroke="#0F172A" stroke-width="4"/><line x1="24" y1="52" x2="24" y2="68" stroke="#0F172A" stroke-width="4"/>
      </g>
    `),
  },
  {
    id: 'med_pharma_capsule',
    titleTr: 'Farmakoloji & İlaç Kapsülü',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['ilac', 'ilaç', 'farmakoloji', 'kapsul', 'antibiyotik', 'doz', 'tedavi', 'pill', 'pharmacology'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0FDF4"/>
      <g transform="rotate(-35 64 64)">
        <rect x="26" y="48" width="76" height="32" rx="16" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
        <path d="M64 48 H86 A16 16 0 0 1 86 80 H64 Z" fill="#F43F5E"/>
      </g>
    `),
  },
  {
    id: 'med_xray_imaging',
    titleTr: 'Radyoloji, Röntgen & MR',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    keywords: ['rontgen', 'röntgen', 'radyoloji', 'mr', 'tomografi', 'goruntuleme', 'xray', 'radiology'],
    svgDataUri: wrapAtlasSvg(`
      <rect x="24" y="20" width="80" height="88" rx="12" fill="#0F172A" stroke="#38BDF8" stroke-width="3"/>
      <line x1="64" y1="30" x2="64" y2="96" stroke="#BAE6FD" stroke-width="4" stroke-linecap="round"/>
      <path d="M44 42 Q64 36 84 42 M40 56 Q64 50 88 56 M42 70 Q64 64 86 70 M48 84 Q64 78 80 84" fill="none" stroke="#7DD3FC" stroke-width="3.2" stroke-linecap="round"/>
    `),
  },

  // =========================================================================
  // ELEKTRONİK, MİKROÇİP & GÖMÜLÜ DONANIM (16 ÖZEL ÇOK RENKLİ İLLÜSTRASYON)
  // =========================================================================
  {
    id: 'elec_microchip_cpu',
    titleTr: 'Mikroçip & CPU İşlemci (Çip)',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['cip', 'çip', 'mikrocip', 'mikroçip', 'islemci', 'işlemci', 'cpu', 'tumdevre', 'entegre devre', 'yariiletken', 'silikon', 'donanim', 'microchip', 'processor', 'ic-chip'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="48" fill="#EFF6FF"/>
      <g stroke="#F59E0B" stroke-width="4" stroke-linecap="round">
        <line x1="44" y1="20" x2="44" y2="34"/><line x1="64" y1="20" x2="64" y2="34"/><line x1="84" y1="20" x2="84" y2="34"/>
        <line x1="44" y1="94" x2="44" y2="108"/><line x1="64" y1="94" x2="64" y2="108"/><line x1="84" y1="94" x2="84" y2="108"/>
        <line x1="20" y1="44" x2="34" y2="44"/><line x1="20" y1="64" x2="34" y2="64"/><line x1="20" y1="84" x2="34" y2="84"/>
        <line x1="94" y1="44" x2="108" y2="44"/><line x1="94" y1="64" x2="108" y2="64"/><line x1="94" y1="84" x2="108" y2="84"/>
      </g>
      <rect x="32" y="32" width="64" height="64" rx="12" fill="#1E293B" stroke="#0F172A" stroke-width="3.2"/>
      <rect x="44" y="44" width="40" height="40" rx="6" fill="#0EA5E9" stroke="#BAE6FD" stroke-width="2"/>
      <path d="M52 56 H76 M52 64 H70 M52 72 H76" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="39" cy="39" r="2.6" fill="#FBBF24"/>
    `),
  },
  {
    id: 'elec_silicon_wafer',
    titleTr: 'Silikon Wafer & Yarıiletken Die',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['silikon', 'wafer', 'yariiletken', 'yarıiletken', 'cip', 'çip', 'litografi', 'nanoteknoloji', 'semiconductor', 'silicon'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="44" fill="#38BDF8" stroke="#0369A1" stroke-width="3.2"/>
      <path d="M32 48 H96 M24 64 H104 M32 80 H96 M48 32 V96 M64 24 V104 M80 32 V96" stroke="#E0F2FE" stroke-width="1.8"/>
      <rect x="48" y="48" width="16" height="16" fill="#8B5CF6"/><rect x="64" y="64" width="16" height="16" fill="#10B981"/>
    `),
  },
  {
    id: 'elec_pcb_circuit',
    titleTr: 'Baskı Devre Kartı (PCB)',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['pcb', 'baski devre', 'devre karti', 'elektronik', 'cip', 'çip', 'anakart', 'circuit-board', 'motherboard'],
    svgDataUri: wrapAtlasSvg(`
      <rect x="22" y="26" width="84" height="76" rx="12" fill="#059669" stroke="#064E3B" stroke-width="3.2"/>
      <path d="M34 42 H54 L64 52 H92 M34 78 H56 L68 66 H90" fill="none" stroke="#FCD34D" stroke-width="3" stroke-linecap="round"/>
      <circle cx="34" cy="42" r="4" fill="#FBBF24"/><circle cx="92" cy="52" r="4" fill="#FBBF24"/>
      <circle cx="34" cy="78" r="4" fill="#FBBF24"/><circle cx="90" cy="66" r="4" fill="#FBBF24"/>
      <rect x="50" y="48" width="24" height="24" rx="4" fill="#1E293B" stroke="#E2E8F0" stroke-width="1.8"/>
    `),
  },
  {
    id: 'elec_dip_ic',
    titleTr: 'Entegre Devre (DIP Tümdevre)',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['entegre', 'tumdevre', 'tümdevre', 'ic', 'cip', 'çip', 'mikrodenetleyici', 'integrated-circuit'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F1F5F9"/>
      <g stroke="#64748B" stroke-width="4" stroke-linecap="round">
        <line x1="36" y1="34" x2="36" y2="94"/><line x1="54" y1="34" x2="54" y2="94"/>
        <line x1="74" y1="34" x2="74" y2="94"/><line x1="92" y1="34" x2="92" y2="94"/>
      </g>
      <rect x="24" y="42" width="80" height="44" rx="8" fill="#1E293B" stroke="#0F172A" stroke-width="3"/>
      <path d="M24 58 A6 6 0 0 1 24 70" fill="#F59E0B"/>
      <text x="64" y="68" text-anchor="middle" font-family="monospace" font-size="13" font-weight="bold" fill="#38BDF8">IC-555</text>
    `),
  },
  {
    id: 'elec_opamp_triangle',
    titleTr: 'İşlemsel Yükselteç (Op-Amp)',
    discipline: 'electronics_robotics',
    category: 'diagram',
    keywords: ['op-amp', 'opamp', 'yükselteç', 'yukseltec', 'eviren', 'analog', 'kazanc', 'operational-amplifier', 'amplifier'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFFBEB"/>
      <polygon points="36,30 98,64 36,98" fill="#FEF3C7" stroke="#D97706" stroke-width="3.6" stroke-linejoin="round"/>
      <line x1="18" y1="48" x2="36" y2="48" stroke="#0F172A" stroke-width="3.2"/><line x1="18" y1="80" x2="36" y2="80" stroke="#0F172A" stroke-width="3.2"/>
      <line x1="98" y1="64" x2="112" y2="64" stroke="#0EA5E9" stroke-width="3.6"/>
      <text x="43" y="53" font-family="monospace" font-size="16" font-weight="bold" fill="#DC2626">-</text>
      <text x="42" y="85" font-family="monospace" font-size="15" font-weight="bold" fill="#059669">+</text>
    `),
  },
  {
    id: 'elec_oscilloscope',
    titleTr: 'Osiloskop & Sinyal Analizi',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['osiloskop', 'sinyal', 'frekans', 'dalga', 'sinus', 'olcum', 'oscilloscope', 'waveform'],
    svgDataUri: wrapAtlasSvg(`
      <rect x="18" y="28" width="92" height="72" rx="12" fill="#1E293B" stroke="#0F172A" stroke-width="3"/>
      <rect x="26" y="36" width="56" height="56" rx="6" fill="#064E3B"/>
      <path d="M30 64 C38 40, 46 40, 54 64 C62 88, 70 88, 78 64" fill="none" stroke="#34D399" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="94" cy="48" r="6" fill="#38BDF8"/><circle cx="94" cy="68" r="6" fill="#F59E0B"/>
    `),
  },
  {
    id: 'elec_lithium_bms',
    titleTr: 'Pil, Batarya & BMS Güç Paketi',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['pil', 'batarya', 'lityum', 'bms', 'akü', 'aku', 'sarj', 'enerji depolama', 'battery', 'lithium'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFDF5"/>
      <rect x="52" y="20" width="24" height="8" rx="3" fill="#475569"/>
      <rect x="36" y="28" width="56" height="76" rx="12" fill="#10B981" stroke="#064E3B" stroke-width="3.2"/>
      <rect x="44" y="38" width="40" height="16" rx="4" fill="#6EE7B7"/>
      <polygon points="68,54 54,74 64,74 58,92 76,68 65,68" fill="#FEF08A" stroke="#854D0E" stroke-width="1.6"/>
    `),
  },
  {
    id: 'elec_mosfet_transistor',
    titleTr: 'Transistör (MOSFET / BJT)',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['transistor', 'transistör', 'mosfet', 'bjt', 'anahtarlama', 'yariiletken', 'elektronik'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F8FAFC"/>
      <rect x="42" y="28" width="44" height="42" rx="8" fill="#334155" stroke="#0F172A" stroke-width="3"/>
      <circle cx="64" cy="40" r="5" fill="#94A3B8"/>
      <line x1="48" y1="70" x2="48" y2="102" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="64" y1="70" x2="64" y2="102" stroke="#0EA5E9" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="80" y1="70" x2="80" y2="102" stroke="#10B981" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'elec_rlc_filter',
    titleTr: 'Direnç, Kondansatör & Bobin (RLC)',
    discipline: 'electronics_robotics',
    category: 'diagram',
    keywords: ['direnc', 'direnç', 'kondansator', 'kondansatör', 'kapasitor', 'bobin', 'induktor', 'rlc', 'filtre', 'resistor', 'capacitor'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFF7ED"/>
      <rect x="34" y="34" width="60" height="20" rx="8" fill="#FDE68A" stroke="#92400E" stroke-width="2.8"/>
      <rect x="46" y="34" width="6" height="20" fill="#EF4444"/><rect x="58" y="34" width="6" height="20" fill="#8B5CF6"/><rect x="72" y="34" width="6" height="20" fill="#F59E0B"/>
      <line x1="20" y1="44" x2="34" y2="44" stroke="#334155" stroke-width="3"/><line x1="94" y1="44" x2="108" y2="44" stroke="#334155" stroke-width="3"/>
      <line x1="26" y1="82" x2="56" y2="82" stroke="#0284C7" stroke-width="3.2"/><line x1="72" y1="82" x2="102" y2="82" stroke="#0284C7" stroke-width="3.2"/>
      <line x1="56" y1="68" x2="56" y2="96" stroke="#0EA5E9" stroke-width="5" stroke-linecap="round"/><line x1="72" y1="68" x2="72" y2="96" stroke="#0EA5E9" stroke-width="5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'elec_logic_gates_ic',
    titleTr: 'Mantık Kapıları (AND / OR / XOR)',
    discipline: 'electronics_robotics',
    category: 'diagram',
    keywords: ['mantik kapisi', 'mantık kapıları', 'dijital tasarim', 'and kapisi', 'nand', 'xor', 'boolean', 'logic-gate'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EEF2FF"/>
      <path d="M36 38 H62 A26 26 0 0 1 62 90 H36 Z" fill="#818CF8" stroke="#312E81" stroke-width="3.2"/>
      <circle cx="94" cy="64" r="5.5" fill="#FBBF24" stroke="#92400E" stroke-width="2.5"/>
      <line x1="18" y1="52" x2="36" y2="52" stroke="#312E81" stroke-width="3.2"/><line x1="18" y1="76" x2="36" y2="76" stroke="#312E81" stroke-width="3.2"/>
      <line x1="100" y1="64" x2="112" y2="64" stroke="#312E81" stroke-width="3.2"/>
    `),
  },
  {
    id: 'elec_led_diode',
    titleTr: 'LED & Yarıiletken Diyot',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['led', 'diyot', 'isik yayan', 'optoelektronik', 'dogrultucu', 'diode'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF2F2"/>
      <path d="M44 68 V46 A20 20 0 0 1 84 46 V68 Z" fill="#EF4444" stroke="#7F1D1D" stroke-width="3"/>
      <rect x="40" y="68" width="48" height="8" rx="3" fill="#FCA5A5" stroke="#7F1D1D" stroke-width="2.4"/>
      <line x1="54" y1="76" x2="54" y2="104" stroke="#475569" stroke-width="4"/><line x1="74" y1="76" x2="74" y2="98" stroke="#475569" stroke-width="4"/>
    `),
  },
  {
    id: 'elec_sensor_iot',
    titleTr: 'Akıllı Sensör & IoT Modülü',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['sensor', 'sensör', 'iot', 'algilayici', 'adc', 'telemetri', 'gomulu'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFEFF"/>
      <rect x="34" y="48" width="60" height="44" rx="10" fill="#0EA5E9" stroke="#0C4A6E" stroke-width="3"/>
      <circle cx="52" cy="70" r="9" fill="#E0F2FE" stroke="#0C4A6E" stroke-width="2.4"/>
      <circle cx="76" cy="70" r="9" fill="#E0F2FE" stroke="#0C4A6E" stroke-width="2.4"/>
      <path d="M46 34 C56 24, 72 24, 82 34 M52 41 C60 35, 68 35, 76 41" fill="none" stroke="#10B981" stroke-width="3.2" stroke-linecap="round"/>
    `),
  },
  {
    id: 'elec_rf_antenna',
    titleTr: 'RF Anten & Kablosuz Haberleşme',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['anten', 'rf', 'kablosuz', 'telekom', 'radyo dalgasi', '5g', 'wifi', 'antenna', 'wireless'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0F9FF"/>
      <polygon points="64,46 46,102 82,102" fill="#475569" stroke="#0F172A" stroke-width="2.8"/>
      <circle cx="64" cy="42" r="7" fill="#F43F5E"/>
      <path d="M42 28 C32 38, 32 50, 42 60 M86 28 C96 38, 96 50, 86 60" fill="none" stroke="#0EA5E9" stroke-width="3.6" stroke-linecap="round"/>
    `),
  },
  {
    id: 'elec_power_transformer',
    titleTr: 'Trafo & Güç Elektroniği',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['trafo', 'transformator', 'guc kaynagi', 'voltaj', 'invertor', 'transformer', 'power-supply'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <rect x="34" y="34" width="60" height="60" rx="8" fill="#94A3B8" stroke="#1E293B" stroke-width="3"/>
      <rect x="46" y="44" width="36" height="40" rx="4" fill="#FEF3C7"/>
      <path d="M34 44 C26 48, 26 54, 34 58 C26 62, 26 68, 34 72" fill="none" stroke="#D97706" stroke-width="4"/>
      <path d="M94 44 C102 48, 102 54, 94 58 C102 62, 102 68, 94 72" fill="none" stroke="#0284C7" stroke-width="4"/>
    `),
  },
  {
    id: 'elec_servo_robotics',
    titleTr: 'Robotik Kol & Mekatronik',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['robot', 'robotik', 'mekatronik', 'servo', 'aktuator', 'otomasyon', 'robotics'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFF7ED"/>
      <rect x="34" y="92" width="60" height="10" rx="5" fill="#334155"/>
      <path d="M52 92 L44 60 L74 38" fill="none" stroke="#F97316" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="44" cy="60" r="7" fill="#1E293B"/><circle cx="74" cy="38" r="7" fill="#1E293B"/>
      <path d="M78 32 L92 26 M80 42 L94 44" stroke="#0EA5E9" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'elec_ram_memory',
    titleTr: 'RAM Bellek Modülü (DRAM)',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    keywords: ['ram', 'bellek', 'dram', 'sram', 'hafiza', 'donanim', 'memory-module'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFDF5"/>
      <rect x="18" y="44" width="92" height="38" rx="6" fill="#10B981" stroke="#064E3B" stroke-width="3"/>
      <rect x="28" y="52" width="16" height="18" rx="2" fill="#1E293B"/><rect x="56" y="52" width="16" height="18" rx="2" fill="#1E293B"/><rect x="84" y="52" width="16" height="18" rx="2" fill="#1E293B"/>
      <line x1="26" y1="82" x2="102" y2="82" stroke="#FBBF24" stroke-width="5" stroke-dasharray="6 4"/>
    `),
  },

  // =========================================================================
  // HUKUK & KAMU YÖNETİMİ (11 ÖZEL ÇOK RENKLİ İLLÜSTRASYON)
  // =========================================================================
  {
    id: 'law_justice_scales_v3',
    titleTr: 'Adalet Terazisi & Hakkaniyet',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['hukuk', 'adalet', 'terazi', 'hakkaniyet', 'yargi', 'istinaf', 'temyiz', 'justice', 'scales'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F5F3FF"/>
      <rect x="46" y="96" width="36" height="8" rx="4" fill="#78350F"/>
      <line x1="64" y1="26" x2="64" y2="96" stroke="#D97706" stroke-width="5" stroke-linecap="round"/>
      <line x1="30" y1="40" x2="98" y2="40" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M30 40 L20 66 H40 Z M98 40 L88 66 H108 Z" fill="none" stroke="#92400E" stroke-width="2.4"/>
      <path d="M18 66 A12 8 0 0 0 42 66 Z M86 66 A12 8 0 0 0 110 66 Z" fill="#FBBF24" stroke="#92400E" stroke-width="2.4"/>
    `),
  },
  {
    id: 'law_gavel_block',
    titleTr: 'Hakim Tokmağı & Duruşma',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['tokmak', 'hakim', 'mahkeme', 'durusma', 'duruşma', 'hukum', 'karar', 'gavel', 'judge'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <rect x="28" y="88" width="52" height="12" rx="5" fill="#78350F" stroke="#451A03" stroke-width="2.6"/>
      <g transform="rotate(-32 64 56)">
        <rect x="44" y="32" width="36" height="18" rx="5" fill="#B45309" stroke="#451A03" stroke-width="2.8"/>
        <rect x="59" y="50" width="8" height="40" rx="4" fill="#92400E"/>
      </g>
    `),
  },
  {
    id: 'law_constitution_book',
    titleTr: 'Anayasa & Kanun Külliyatı',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['anayasa', 'kanun', 'mevzuat', 'medeni kanun', 'ceza kanunu', 'tck', 'tbk', 'hmk', 'constitution', 'statute'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EDE9FE"/>
      <rect x="34" y="24" width="60" height="80" rx="8" fill="#7C3AED" stroke="#3B0764" stroke-width="3.2"/>
      <rect x="40" y="24" width="54" height="80" rx="6" fill="#8B5CF6"/>
      <circle cx="67" cy="56" r="13" fill="#FDE047" stroke="#A16207" stroke-width="2.2"/>
      <line x1="52" y1="80" x2="82" y2="80" stroke="#DDD6FE" stroke-width="3.2" stroke-linecap="round"/>
    `),
  },
  {
    id: 'law_sealed_verdict',
    titleTr: 'Mühürlü İlâm & Kesin Hüküm',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['ilam', 'ferman', 'muhur', 'mühür', 'kesin hukum', 'karar', 'noter', 'verdict', 'decree'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFFBEB"/>
      <rect x="34" y="22" width="60" height="82" rx="8" fill="#FEF3C7" stroke="#92400E" stroke-width="2.8"/>
      <path d="M44 40 H84 M44 52 H84 M44 64 H72" stroke="#78350F" stroke-width="3" stroke-linecap="round"/>
      <circle cx="76" cy="82" r="11" fill="#EF4444" stroke="#991B1B" stroke-width="2.4"/>
    `),
  },
  {
    id: 'law_courthouse_facade',
    titleTr: 'İstinaf & Yüksek Mahkeme Binası',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['istinaf', 'istinaf mahkemesi', 'yargitay', 'danistay', 'adliye', 'bam', 'yuksek mahkeme', 'courthouse'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F1F5F9"/>
      <polygon points="64,22 24,46 104,46" fill="#CBD5E1" stroke="#1E293B" stroke-width="3"/>
      <rect x="32" y="46" width="10" height="42" fill="#E2E8F0" stroke="#334155" stroke-width="2.2"/>
      <rect x="59" y="46" width="10" height="42" fill="#E2E8F0" stroke="#334155" stroke-width="2.2"/>
      <rect x="86" y="46" width="10" height="42" fill="#E2E8F0" stroke="#334155" stroke-width="2.2"/>
      <rect x="22" y="88" width="84" height="10" rx="3" fill="#475569"/>
    `),
  },
  {
    id: 'law_case_dossier',
    titleTr: 'Dava Dosyası & Delil Tespiti',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['dava dosyasi', 'delil', 'sorusturma', 'iddianame', 'bilirkisi', 'evidence', 'dossier'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <path d="M26 40 H52 L60 48 H102 V94 H26 Z" fill="#FBBF24" stroke="#92400E" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="76" cy="72" r="12" fill="#E0F2FE" stroke="#0369A1" stroke-width="3"/>
      <line x1="85" y1="81" x2="96" y2="92" stroke="#0369A1" stroke-width="4" stroke-linecap="round"/>
    `),
  },
  {
    id: 'law_signed_contract',
    titleTr: 'Sözleşme Hukuku & Islak İmza',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['sozlesme', 'sözleşme', 'borclar hukuku', 'akit', 'imza', 'taahhut', 'contract'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EFF6FF"/>
      <rect x="30" y="24" width="58" height="80" rx="6" fill="#FFFFFF" stroke="#334155" stroke-width="2.8"/>
      <path d="M40 42 H76 M40 54 H76 M40 84 C48 76, 56 88, 68 78" fill="none" stroke="#2563EB" stroke-width="3" stroke-linecap="round"/>
      <line x1="72" y1="74" x2="98" y2="42" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
    `),
  },
  {
    id: 'law_three_powers',
    titleTr: 'Kuvvetler Ayrılığı (Yasama-Yürütme-Yargı)',
    discipline: 'law_governance',
    category: 'diagram',
    keywords: ['kuvvetler ayriligi', 'yasama', 'yurutme', 'yargi', 'devlet', 'kamu hukuku', 'separation-of-powers'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F8FAFC"/>
      <rect x="26" y="34" width="76" height="12" rx="4" fill="#8B5CF6"/>
      <rect x="30" y="50" width="16" height="40" rx="4" fill="#0EA5E9"/>
      <rect x="56" y="50" width="16" height="40" rx="4" fill="#10B981"/>
      <rect x="82" y="50" width="16" height="40" rx="4" fill="#F59E0B"/>
      <rect x="24" y="92" width="80" height="8" rx="4" fill="#334155"/>
    `),
  },
  {
    id: 'law_petition_clock',
    titleTr: 'Dilekçe & Hak Düşürücü Süre',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['dilekce', 'dilekçe', 'sure', 'zamanaşımı', 'tebligat', 'basvuru'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0F9FF"/>
      <rect x="28" y="26" width="52" height="68" rx="6" fill="#FFFFFF" stroke="#334155" stroke-width="2.8"/>
      <circle cx="82" cy="78" r="18" fill="#FEF08A" stroke="#CA8A04" stroke-width="3"/>
      <path d="M82 68 V78 L90 82" fill="none" stroke="#854D0E" stroke-width="3" stroke-linecap="round"/>
    `),
  },
  {
    id: 'law_enforcement_stamp',
    titleTr: 'İcra & İflas Hukuku Mührü',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['icra', 'iflas', 'haciz', 'takip', 'odeme emri'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFE4E6"/>
      <rect x="34" y="76" width="60" height="14" rx="5" fill="#DC2626" stroke="#7F1D1D" stroke-width="2.8"/>
      <path d="M54 76 L58 44 A8 8 0 1 1 70 44 L74 76" fill="#475569" stroke="#0F172A" stroke-width="2.8"/>
    `),
  },
  {
    id: 'law_ballot_public',
    titleTr: 'Demokrasi & Seçim Hukuku',
    discipline: 'law_governance',
    category: 'hand_drawn',
    keywords: ['secim', 'demokrasi', 'meclis', 'oy', 'idare hukuku'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFDF5"/>
      <rect x="30" y="54" width="68" height="44" rx="8" fill="#0EA5E9" stroke="#0369A1" stroke-width="3"/>
      <rect x="48" y="28" width="32" height="34" rx="4" fill="#FFFFFF" stroke="#334155" stroke-width="2.6"/>
      <line x1="42" y1="54" x2="86" y2="54" stroke="#0F172A" stroke-width="4"/>
    `),
  },

  // =========================================================================
  // MİMARLIK, İNŞAAT & TARİH (10 ÖZEL ÇOK RENKLİ İLLÜSTRASYON)
  // =========================================================================
  {
    id: 'arch_voussoir_arch',
    titleTr: 'Kemer, Tonoz & Kilit Taşı',
    discipline: 'architecture_civil',
    category: 'hand_drawn',
    keywords: ['kemer', 'tonoz', 'kemer tonoz', 'kilit tasi', 'kagir', 'tasiyici sistem', 'mimarlik', 'arch', 'vault', 'keystone'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFFBEB"/>
      <path d="M24 98 V62 A40 40 0 0 1 104 62 V98 H84 V62 A20 20 0 0 0 44 62 V98 Z" fill="#FCD34D" stroke="#92400E" stroke-width="3.2" stroke-linejoin="round"/>
      <polygon points="55,22 73,22 69,43 59,43" fill="#EA580C" stroke="#7C2D12" stroke-width="2.4"/>
    `),
  },
  {
    id: 'arch_groin_vault',
    titleTr: 'Çapraz Tonoz & Kaburgalı Örtü',
    discipline: 'architecture_civil',
    category: 'diagram',
    keywords: ['tonoz', 'capraz tonoz', 'besik tonoz', 'kaburgali tonoz', 'kemer tonoz', 'gotik', 'vault'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <path d="M26 92 C26 42, 102 42, 102 92" fill="#FDE68A" stroke="#92400E" stroke-width="3"/>
      <path d="M26 92 Q64 38 102 92 M44 92 Q64 46 84 92" fill="none" stroke="#D97706" stroke-width="3"/>
    `),
  },
  {
    id: 'arch_gothic_buttress',
    titleTr: 'Gotik Uçan Payanda (Flying Buttress)',
    discipline: 'architecture_civil',
    category: 'diagram',
    keywords: ['ucan payanda', 'uçan payanda', 'payanda', 'gotik', 'katedral', 'yanal itki', 'flying-buttress', 'buttress'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FFF7ED"/>
      <rect x="30" y="28" width="26" height="72" rx="3" fill="#FDBA74" stroke="#9A3412" stroke-width="3"/>
      <rect x="82" y="48" width="18" height="52" rx="3" fill="#FED7AA" stroke="#9A3412" stroke-width="3"/>
      <path d="M56 44 Q74 44 82 60 M56 64 Q74 64 82 78" fill="none" stroke="#EA580C" stroke-width="6" stroke-linecap="round"/>
    `),
  },
  {
    id: 'arch_corinthian_cap',
    titleTr: 'Klasik Sütun (Dor / İyon / Korint)',
    discipline: 'architecture_civil',
    category: 'hand_drawn',
    keywords: ['sutun', 'sütun', 'korint', 'iyon', 'dor', 'antik mimari', 'kolon', 'column', 'corinthian'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F8FAFC"/>
      <rect x="34" y="24" width="60" height="12" rx="4" fill="#E2E8F0" stroke="#334155" stroke-width="2.8"/>
      <circle cx="40" cy="38" r="7" fill="#FDE68A" stroke="#92400E" stroke-width="2.4"/>
      <circle cx="88" cy="38" r="7" fill="#FDE68A" stroke="#92400E" stroke-width="2.4"/>
      <rect x="46" y="38" width="36" height="62" fill="#F1F5F9" stroke="#334155" stroke-width="2.8"/>
      <line x1="56" y1="42" x2="56" y2="96" stroke="#94A3B8" stroke-width="2.4"/><line x1="64" y1="42" x2="64" y2="96" stroke="#94A3B8" stroke-width="2.4"/><line x1="72" y1="42" x2="72" y2="96" stroke="#94A3B8" stroke-width="2.4"/>
    `),
  },
  {
    id: 'arch_dome_section',
    titleTr: 'Kubbe & Pandantif Kesiti',
    discipline: 'architecture_civil',
    category: 'hand_drawn',
    keywords: ['kubbe', 'ayasofya', 'sinan', 'osmanli mimarisi', 'jeodezik', 'dome'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#E0F2FE"/>
      <path d="M26 72 A38 38 0 0 1 102 72 Z" fill="#38BDF8" stroke="#0369A1" stroke-width="3.2"/>
      <line x1="64" y1="20" x2="64" y2="34" stroke="#D97706" stroke-width="3.5"/>
      <rect x="24" y="72" width="80" height="26" rx="4" fill="#FDE68A" stroke="#92400E" stroke-width="2.8"/>
    `),
  },
  {
    id: 'arch_stone_viaduct',
    titleTr: 'Kemerli Taş Köprü & Su Kemeri',
    discipline: 'architecture_civil',
    category: 'hand_drawn',
    keywords: ['kopru', 'köprü', 'tas kopru', 'viyaduk', 'su kemeri', 'kemer kopru', 'bridge', 'aqueduct'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFEFF"/>
      <path d="M18 50 H110 V84 H96 A14 14 0 0 0 68 84 H60 A14 14 0 0 0 32 84 H18 Z" fill="#FBBF24" stroke="#92400E" stroke-width="3"/>
      <path d="M20 92 Q42 86 64 92 T108 92" fill="none" stroke="#0EA5E9" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'arch_suspension_bridge',
    titleTr: 'Çelik Asma Köprü Statiği',
    discipline: 'architecture_civil',
    category: 'hand_drawn',
    keywords: ['asma kopru', 'bogaz koprusu', 'celik yapi', 'kablo', 'insaat muhendisligi', 'suspension-bridge'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F0F9FF"/>
      <line x1="38" y1="30" x2="38" y2="94" stroke="#EF4444" stroke-width="5"/><line x1="90" y1="30" x2="90" y2="94" stroke="#EF4444" stroke-width="5"/>
      <path d="M18 58 Q38 34 38 34 Q64 68 90 34 Q90 34 110 58" fill="none" stroke="#334155" stroke-width="3"/>
      <line x1="16" y1="74" x2="112" y2="74" stroke="#1E293B" stroke-width="4.5"/>
    `),
  },
  {
    id: 'arch_drafting_set',
    titleTr: 'Mimari Plan, Pergel & Gönye',
    discipline: 'architecture_civil',
    category: 'hand_drawn',
    keywords: ['mimari plan', 'kesit', 'rolove', 'gonye', 'pergel', 'olcek', 'blueprint', 'compass'],
    svgDataUri: wrapAtlasSvg(`
      <rect x="22" y="26" width="84" height="76" rx="10" fill="#1D4ED8" stroke="#1E3A8A" stroke-width="3"/>
      <rect x="32" y="38" width="64" height="52" fill="none" stroke="#93C5FD" stroke-width="2" stroke-dasharray="4 3"/>
      <polygon points="40,84 86,84 40,44" fill="#FDE047" fill-opacity="0.88" stroke="#854D0E" stroke-width="2.4"/>
    `),
  },
  {
    id: 'arch_seismic_fault',
    titleTr: 'Deprem, Fay Hattı & Sismoloji',
    discipline: 'exact_sciences',
    category: 'diagram',
    keywords: ['deprem', 'fay', 'sismik', 'sismograf', 'jeoloji', 'richter', 'afet', 'earthquake', 'seismic'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF2F2"/>
      <path d="M22 72 L56 72 L68 58 L106 58 L106 94 L22 94 Z" fill="#D97706" stroke="#78350F" stroke-width="2.8"/>
      <path d="M56 72 L68 58 L62 94" fill="none" stroke="#EF4444" stroke-width="4" stroke-linecap="round"/>
      <path d="M26 38 H46 L52 24 L58 50 L64 20 L70 46 L76 38 H102" fill="none" stroke="#DC2626" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'hist_ottoman_timar',
    titleTr: 'Osmanlı Devleti, Ferman & Tımar',
    discipline: 'humanities_social',
    category: 'hand_drawn',
    keywords: ['osmanli', 'osmanlı', 'timar', 'tımar', 'iltizam', 'divan', 'ferman', 'padişah', 'tarih', 'imparatorluk', 'ottoman', 'empire'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <rect x="30" y="26" width="68" height="76" rx="10" fill="#FFFBEB" stroke="#B45309" stroke-width="3"/>
      <path d="M48 54 C48 40, 72 38, 76 52 C66 50, 62 64, 78 62" fill="none" stroke="#B91C1C" stroke-width="3.8" stroke-linecap="round"/>
      <circle cx="64" cy="82" r="9" fill="#10B981" stroke="#065F46" stroke-width="2.4"/>
    `),
  },

  // =========================================================================
  // TEMEL BİLİMLER, FİZİK, KİMYA, MATEMATİK & YAPAY ZEKÂ (10 İLLÜSTRASYON)
  // =========================================================================
  {
    id: 'sci_atom_orbital_v3',
    titleTr: 'Atom Çekirdeği & Elektron Orbitalleri',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    keywords: ['atom', 'elektron', 'proton', 'notron', 'kuantum', 'nukleer', 'fizik', 'atomic', 'quantum'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EFF6FF"/>
      <ellipse cx="64" cy="64" rx="42" ry="16" transform="rotate(30 64 64)" fill="none" stroke="#0EA5E9" stroke-width="3"/>
      <ellipse cx="64" cy="64" rx="42" ry="16" transform="rotate(-30 64 64)" fill="none" stroke="#8B5CF6" stroke-width="3"/>
      <ellipse cx="64" cy="64" rx="42" ry="16" transform="rotate(90 64 64)" fill="none" stroke="#10B981" stroke-width="3"/>
      <circle cx="64" cy="64" r="9" fill="#F43F5E"/>
    `),
  },
  {
    id: 'sci_prism_spectrum_v3',
    titleTr: 'Optik Prizma & Işık Kırılması',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    keywords: ['optik', 'prizma', 'isik', 'ışık', 'tayf', 'foton', 'kirilma', 'prism', 'optics'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#0F172A"/>
      <line x1="18" y1="68" x2="50" y2="58" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
      <line x1="74" y1="54" x2="108" y2="44" stroke="#EF4444" stroke-width="3.5"/>
      <line x1="76" y1="60" x2="108" y2="56" stroke="#FACC15" stroke-width="3.5"/>
      <line x1="78" y1="66" x2="108" y2="68" stroke="#22C55E" stroke-width="3.5"/>
      <line x1="80" y1="72" x2="108" y2="80" stroke="#38BDF8" stroke-width="3.5"/>
      <polygon points="64,30 38,84 90,84" fill="#E0F2FE" fill-opacity="0.85" stroke="#BAE6FD" stroke-width="2.8"/>
    `),
  },
  {
    id: 'sci_magnet_flux',
    titleTr: 'Mıknatıs & Manyetik Alan Akısı',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    keywords: ['miknatis', 'mıknatıs', 'manyetizma', 'elektromanyetik', 'kutup', 'tesla', 'magnet'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F8FAFC"/>
      <path d="M38 34 V68 A26 26 0 0 0 90 68 V34" fill="none" stroke="#EF4444" stroke-width="14" stroke-linecap="butt"/>
      <rect x="31" y="28" width="14" height="14" fill="#3B82F6"/><rect x="83" y="28" width="14" height="14" fill="#3B82F6"/>
    `),
  },
  {
    id: 'sci_pendulum_wave',
    titleTr: 'Mekanik, Kuvvet & Harmonik Hareket',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    keywords: ['mekanik', 'sarkac', 'kuvvet', 'enerji', 'ivme', 'newton', 'kinematik', 'pendulum'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FEF3C7"/>
      <line x1="36" y1="28" x2="92" y2="28" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
      <line x1="64" y1="28" x2="84" y2="76" stroke="#475569" stroke-width="3"/>
      <circle cx="84" cy="80" r="12" fill="#F59E0B" stroke="#92400E" stroke-width="2.8"/>
      <path d="M44 82 A32 32 0 0 0 84 82" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-dasharray="4 3"/>
    `),
  },
  {
    id: 'sci_molecule_bonds',
    titleTr: 'Moleküler Yapı & Kimyasal Bağ',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    keywords: ['molekul', 'molekül', 'kimyasal bag', 'kovalent', 'organik kimya', 'element', 'molecule'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFEFF"/>
      <line x1="64" y1="58" x2="36" y2="82" stroke="#334155" stroke-width="5"/>
      <line x1="64" y1="58" x2="92" y2="82" stroke="#334155" stroke-width="5"/>
      <line x1="64" y1="58" x2="64" y2="28" stroke="#334155" stroke-width="5"/>
      <circle cx="64" cy="58" r="14" fill="#0EA5E9" stroke="#0369A1" stroke-width="2.8"/>
      <circle cx="36" cy="82" r="10" fill="#F43F5E"/><circle cx="92" cy="82" r="10" fill="#10B981"/><circle cx="64" cy="28" r="9" fill="#F59E0B"/>
    `),
  },
  {
    id: 'sci_titration_acid',
    titleTr: 'Asit-Baz & pH Dengesi',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    keywords: ['asit', 'baz', 'ph', 'titrasyon', 'tuz', 'kimya'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#FDF2F8"/>
      <rect x="26" y="54" width="76" height="18" rx="9" fill="#FBBF24"/>
      <rect x="26" y="54" width="26" height="18" rx="9" fill="#EF4444"/>
      <rect x="76" y="54" width="26" height="18" rx="9" fill="#3B82F6"/>
    `),
  },
  {
    id: 'sci_calculus_integral',
    titleTr: 'Kalkülüs: Türev & İntegral',
    discipline: 'exact_sciences',
    category: 'diagram',
    keywords: ['matematik', 'integral', 'turev', 'türev', 'fonksiyon', 'analiz', 'limit', 'calculus'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#EEF2FF"/>
      <path d="M30 88 H98 M36 94 V30" stroke="#334155" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M42 88 L42 66 C56 44, 72 52, 88 38 L88 88 Z" fill="#818CF8" fill-opacity="0.45"/>
      <path d="M38 72 C56 42, 72 54, 92 34" fill="none" stroke="#4F46E5" stroke-width="3.8" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sci_gauss_bell',
    titleTr: 'Olasılık & İstatistik Çan Eğrisi',
    discipline: 'exact_sciences',
    category: 'diagram',
    keywords: ['istatistik', 'olasilik', 'olasılık', 'veri bilimi', 'standart sapma', 'gauss', 'statistics'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#ECFDF5"/>
      <path d="M24 88 C42 88, 48 34, 64 34 C80 34, 86 88, 104 88 Z" fill="#34D399" fill-opacity="0.45" stroke="#059669" stroke-width="3.4"/>
      <line x1="64" y1="34" x2="64" y2="88" stroke="#065F46" stroke-width="2.2" stroke-dasharray="4 3"/>
    `),
  },
  {
    id: 'sci_neural_net_ai',
    titleTr: 'Yapay Sinir Ağı & Derin Öğrenme',
    discipline: 'system_design_cs',
    category: 'system_arch',
    keywords: ['yapay sinir agi', 'yapay sinir ağı', 'yapay zeka', 'derin ogrenme', 'makine ogrenmesi', 'llm', 'transformer', 'neural-network', 'deep-learning', 'ai'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="46" fill="#F5F3FF"/>
      <g stroke="#94A3B8" stroke-width="2">
        <line x1="34" y1="42" x2="64" y2="34"/><line x1="34" y1="42" x2="64" y2="64"/><line x1="34" y1="86" x2="64" y2="64"/><line x1="34" y1="86" x2="64" y2="94"/>
        <line x1="64" y1="34" x2="94" y2="52"/><line x1="64" y1="64" x2="94" y2="52"/><line x1="64" y1="64" x2="94" y2="78"/><line x1="64" y1="94" x2="94" y2="78"/>
      </g>
      <circle cx="34" cy="42" r="7" fill="#0EA5E9"/><circle cx="34" cy="86" r="7" fill="#0EA5E9"/>
      <circle cx="64" cy="34" r="7" fill="#8B5CF6"/><circle cx="64" cy="64" r="8" fill="#8B5CF6"/><circle cx="64" cy="94" r="7" fill="#8B5CF6"/>
      <circle cx="94" cy="52" r="7" fill="#10B981"/><circle cx="94" cy="78" r="7" fill="#10B981"/>
    `),
  },
  {
    id: 'sci_earth_tectonics',
    titleTr: 'Yerküre, Coğrafya & İklim',
    discipline: 'humanities_social',
    category: 'medical_academic',
    keywords: ['cografya', 'coğrafya', 'dunya', 'dünya', 'iklim', 'ekoloji', 'kita', 'jeoloji', 'globe', 'geography'],
    svgDataUri: wrapAtlasSvg(`
      <circle cx="64" cy="64" r="42" fill="#0EA5E9" stroke="#0369A1" stroke-width="3.2"/>
      <path d="M40 42 C52 36, 62 46, 58 60 C54 72, 42 78, 36 66 Z M72 48 C84 44, 94 56, 88 74 C82 86, 70 82, 72 68 Z" fill="#22C55E"/>
    `),
  },
];

/**
 * Unified 152+ Bespoke Multi-Color Sticker Atlas (`SystemDesignVisualPack` + `EXTRA_MULTI_COLOR_ATLAS`)
 */
export const BUILT_IN_MULTI_COLOR_ATLAS: BespokeVisualEntry[] = [
  ...EXTRA_MULTI_COLOR_ATLAS,
  ...SYSTEM_DESIGN_AND_ATLAS_PACK.map(
    (p): BespokeVisualEntry => ({
      id: p.id,
      titleTr: p.titleTr,
      discipline: p.discipline,
      category: p.category,
      keywords: [...p.tagsTr, ...p.tagsEn, p.titleTr, p.titleEn],
      svgDataUri: p.svgDataUri,
    })
  ),
];

export function getAtlasStickerById(id: string): BespokeVisualEntry | undefined {
  return BUILT_IN_MULTI_COLOR_ATLAS.find((entry) => entry.id === id);
}

import {
  expandSemanticQueryV3,
  mapDisciplineToOfflineDomain,
  normalizeTrToken,
  stemTurkishSafe,
} from '../SemanticTaxonomyTR';

export interface ScoredAtlasMatch {
  entry: BespokeVisualEntry;
  score: number;
}

/**
 * V3 Strict Relevance Built-In Multi-Color Atlas Search (`<1ms`, Zero Fallback Contamination).
 * - When `query` is empty: returns starter visuals for the active `discipline`.
 * - When `query` is non-empty: returns ONLY genuinely matching atlas entries (never pads with unrelated items!).
 */
export function searchBuiltInAtlasV3(
  query: string,
  discipline: DisciplineProfile = 'system_design_cs',
  limit = 28
): ScoredAtlasMatch[] {
  const clean = query.trim();
  if (!clean) {
    const primary = BUILT_IN_MULTI_COLOR_ATLAS.filter((e) => e.discipline === discipline);
    const secondary = BUILT_IN_MULTI_COLOR_ATLAS.filter((e) => e.discipline !== discipline);
    return [...primary, ...secondary.slice(0, 8)].slice(0, limit).map((entry, idx) => ({
      entry,
      score: Math.max(0.72, 0.94 - idx * 0.008),
    }));
  }

  const offlineDomain = mapDisciplineToOfflineDomain(discipline);
  const expanded = expandSemanticQueryV3(clean, offlineDomain);
  const normFull = expanded.normalizedQuery;
  const queryTokens = normFull.split(/\s+/).filter((t) => t.length >= 2);
  const queryStems = queryTokens
    .map((t) => stemTurkishSafe(t))
    .filter((s) => s.length >= 4);

  const expandedEnSet = new Set(
    expanded.expandedEnTokens.map((t) => normalizeTrToken(t))
  );
  const expandedTrSet = new Set(
    expanded.expandedTrTokens.map((t) => normalizeTrToken(t))
  );
  const blockedSet = new Set(
    expanded.blockedTokens.map((t) => normalizeTrToken(t))
  );

  const matches: { entry: BespokeVisualEntry; rawScore: number }[] = [];

  for (const entry of BUILT_IN_MULTI_COLOR_ATLAS) {
    const kwNormalized = entry.keywords.map((k) => normalizeTrToken(k));
    const titleWords = normalizeTrToken(entry.titleTr)
      .split(/[\s()•/,-]+/)
      .filter(Boolean);
    const allPhraseSet = new Set<string>([...kwNormalized]);
    const allWordTokens = new Set<string>(titleWords);
    for (const kw of kwNormalized) {
      allWordTokens.add(kw);
      for (const part of kw.split(/[\s_-]+/)) {
        if (part.length >= 2) allWordTokens.add(part);
      }
    }

    // Hard negative block check (e.g., chip vs potato-chip, microbe vs microchip)
    let isBlocked = false;
    for (const b of blockedSet) {
      if (allPhraseSet.has(b) || allWordTokens.has(b)) {
        isBlocked = true;
        break;
      }
    }
    if (isBlocked) continue;

    let rawScore = 0;

    // 1. Exact full query match against keyword phrase
    if (allPhraseSet.has(normFull)) {
      rawScore += 65;
    }

    // 2. Exact token matches against user's query tokens
    for (const qt of queryTokens) {
      if (allPhraseSet.has(qt) || allWordTokens.has(qt)) {
        rawScore += 32;
      }
    }

    // 3. Safe Turkish stem match (strictly bounded length delta <= 3 to prevent 'mikro-' or 'eko-' collisions)
    for (const stem of queryStems) {
      if (stem === 'mikro' || stem === 'ekono' || stem === 'ucan') continue;
      for (const wt of allWordTokens) {
        if (wt.length >= 4 && wt.startsWith(stem) && wt.length - stem.length <= 3) {
          rawScore += 18;
          break;
        }
      }
    }

    // 4. Expanded semantic English & Turkish concept tokens
    for (const enTok of expandedEnSet) {
      if (allPhraseSet.has(enTok) || allWordTokens.has(enTok)) {
        rawScore += 22;
      }
    }
    for (const trTok of expandedTrSet) {
      if (allPhraseSet.has(trTok) || allWordTokens.has(trTok)) {
        rawScore += 24;
      }
    }

    if (rawScore < 20) continue;

    // 5. Context Tie-Breaker ONLY on genuine matches (1.18x for homonyms, 1.05x same discipline)
    if (expanded.isHomonym && entry.discipline === discipline) {
      rawScore *= 1.18;
    } else if (entry.discipline === discipline) {
      rawScore *= 1.05;
    }

    matches.push({ entry, rawScore });
  }

  matches.sort((a, b) => b.rawScore - a.rawScore);
  const topRaw = matches[0]?.rawScore || 100;

  return matches.slice(0, limit).map((m, idx) => ({
    entry: m.entry,
    score: Math.min(0.995, Math.max(0.76, 0.85 + (m.rawScore / topRaw) * 0.14 - idx * 0.003)),
  }));
}

export type { DisciplineProfile, GalleryCategoryFilter };
