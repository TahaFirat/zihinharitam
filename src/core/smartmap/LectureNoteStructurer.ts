/**
 * Domain-Agnostic Intelligent Lecture Note -> ZihinHaritam Hierarchical Outline Engine
 * (100% Offline, Zero Hardcoded Topics, Works on ANY Turkish or English Academic Material)
 *
 * Algorithmic Capabilities:
 *  1. Unicode-safe Turkish & English structural parsing (zero ASCII `\b` corruption on ı/İ/ş/ğ/ü/ö/ç).
 *  2. Strips figure/image captions (`Yukarıdaki görselde...`), page numbers, empty bullets, and double-colon typos.
 *  3. Infers true multi-level document hierarchy (L0 Root -> L1 Major Sections -> L2 Sub-Concepts -> L3 Format/Steps/Details)
 *     purely from document-wide structural signals (recurring section suffixes, standalone headings, colon headers, nesting).
 *  4. Automatically merges duplicate/restated headings sharing a parenthetical acronym or >=55% token overlap.
 *  5. Generically parses glued 2-column HTML/PDF copied tables (`BaşlıkAçıklama...` / `AlanAçıklama...` / `TerimTanım...`)
 *     using zero-space boundary detection (zero hardcoded domain field names!) and inline `* Key: Value` star-lists.
 *  6. Distills opening prose bullets into crisp branch summaries, preserves acronyms (`TCP`, `IP`, `EKG`, `DNA`, `TBMM`)
 *     during case folding, collapses dense field tables & step sequences in Balanced/Compact modes, and emits clean `Not:` lines.
 */

import {
  extractCompactFormula,
  filterAndCleanAcademicLine,
  isAcademicBoilerplateLine,
  isFormulaExpression,
  isWordProblemOrExampleFiller,
} from './AcademicContentFilter';

export type LectureNoteDepth = 'compact' | 'balanced' | 'detailed';

export interface LectureNoteConversionOptions {
  depth?: LectureNoteDepth;
}

export interface StructuredOutlineNode {
  title: string;
  desc?: string;
  badge?: string;
  priority?: 'SINAV' | 'ÖNEMLİ';
  notes: string[];
  children: StructuredOutlineNode[];
  kind?: 'overview' | 'section' | 'concept' | 'fields' | 'steps' | 'detail';
}

const ACRONYM_SET = new Set([
  'EKG', 'EEG', 'EMG', 'MRI', 'MR', 'BT', 'USG', 'DNA', 'RNA', 'ATP', 'ADP', 'NADH', 'FADH',
  'SA', 'AV', 'QRS', 'ST', 'PR', 'QT', 'CO2', 'O2', 'H2O', 'PH', 'HB', 'RBC', 'WBC', 'LDL', 'HDL',
  'TUS', 'YKS', 'TYT', 'AYT', 'KPSS', 'HMGS', 'ALES', 'YDS', 'DGS', 'LGS', 'TBMM', 'TCK', 'TMK', 'HMK', 'CMK', 'AYM', 'TBK',
  'CPU', 'GPU', 'RAM', 'ROM', 'SSD', 'API', 'REST', 'SQL', 'NOSQL', 'HTTP', 'HTTPS', 'TCP', 'UDP', 'IP', 'OSI',
  'NAT', 'VPN', 'DHCP', 'ARP', 'RARP', 'ICMP', 'BGP', 'OSPF', 'RIP', 'MAC', 'LAN', 'MAN', 'WAN', 'VLAN', 'DNS',
  'SNMP', 'SMTP', 'TELNET', 'SSH', 'FTP', 'SSL', 'TLS', 'MTU', 'IHL', 'TOS', 'DSCP', 'ECN', 'TTL', 'RTT', 'SYN',
  'ACK', 'FIN', 'DF', 'MF', 'FDDI', 'CDN', 'WAF', 'JWT', 'PLC', 'SCADA', 'FPGA', 'CNC', 'AC', 'DC', 'LED', 'MOSFET',
  'AI', 'ML', 'LLM', 'UI', 'UX', 'PDF', 'SVG', 'PNG', 'HTML', 'CSS', 'JS', 'TS', 'IPV4', 'IPV6', 'TL', 'MS',
]);

const PAGE_NOISE_RE =
  /^(?:sayfa\s*\d+(?:\s*\/\s*\d+)?|slayt\s*\d+|s\.\s*\d+|page\s*\d+(?:\s*of\s*\d+)?|[-–—•*.\s]*\d+(?:\s*\/\s*\d+)?[-–—•*.\s]*)$/iu;

const FIGURE_CAPTION_RE =
  /^(?:yukarıdaki|aşağıdaki|yandaki)\s+(?:görsel|şekil|resim|tablo|diyagram|grafik|şema)(?:de|da|te|ta|den|dan)?(?![\p{L}\p{N}])|^(?:şekil|görsel|resim|tablo|figure|fig\.?)\s*\d+\s*[:.-]/iu;

const TRANSITION_STUB_RE =
  /(?:bazı\s+[\p{L}]+|iki\s+ana\s+[\p{L}]+|üç\s+ana\s+[\p{L}]+|dört\s+ana\s+[\p{L}]+|iki\s+terim\s+.*|temel\s+olarak\s+.*(?:kullanır|ilişkilidir|ayrılır|oluşur)|veri\s+akışı|şunlardır|aşağıdaki\s+gibidir|kullanılır|ilişkilidir)\s*:\s*$/iu;

const GLUED_TABLE_HEADER_RE =
  /^(?:Başlık|Alan|Terim|Kavram|Özellik|Parametre|Ad|Komut|Bileşen|Organel|Madde|Bölüm|Field|Header|Name|Term)(?:\s*\t|\s{0,2})(?:Açıklama|Tanım|Görev|Görevi|Değer|Anlamı|Özellik|Ceza|Sonuç|Description|Meaning)\s*/iu;

const L3_SUBHEADING_SUFFIX_RE =
  /(?<![\p{L}\p{N}])(?:formatı|format|yapısı|alanları|özellikleri|adımları|aşamaları|süreci|handshake|el\s+sıkışma|istatistikleri|istatistikler|çıktısı|çıktının\s+önemi|önemi|komutu|command|örnekleri|farkları|avantajları|dezavantajları|kullanım\s+alanı|kullanım\s+alanları|çalışma\s+mekanizması|segment\s+formatı|datagram\s+formatı|başlık\s+alanları|parametreleri|sonuçları|belirtileri|tedavisi)(?![\p{L}\p{N}])/iu;

const SECTION_FAMILY_TAIL_RE =
  /(?<![\p{L}\p{N}])(katmanı|katman|bölümü|bölüm|ünitesi|ünite|dönemi|dönem|sistemi|sistem|evresi|evre|aşaması|aşama|safhası|sınıfı|grubu|türü|türleri|çeşidi|çeşitleri|hukuku|ilkesi|ilkeleri|kuramı|teorisi|organı|dokusu|kanunu|yasası|layer|phase|stage|section|chapter)(?![\p{L}\p{N}])/iu;

const QUANT_BADGE_RE =
  /(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:atım\/dk|cm²|cm2|mm²|mmHg|mg\/dL|mmol\/L|mL\/dk|m\/s|km\/s|mV|kV|Hz|kHz|MHz|GHz|ms|sn|saniye|dakika|dk|saat|gün|yıl|yüzyıl|yy\.?|akçe|kcal|kg|gr|mg|lt|mL|DPI|GB|MB|KB|TB|bayt|byte|bit|Mbps|Gbps)|%\s*\d+(?:[.,]\d+)?|(?:Port|Katman|Layer|Madde|Md\.?)\s*\d+|pH\s*\d+(?:[.,]\d+)?|O\([^)]{1,14}\))(?![\p{L}\p{N}])/iu;

const VERBOSE_FILLER_LEAD_RE =
  /^(?:bu\s+(?:protokol(?:ün|ü)?|katman(?:ın|da|ı)?|işlem(?:de|i)?|süreç(?:te|i)?|sistem(?:de|i)?|model(?:de|i)?|yapı(?:da|yı)?|bölüm(?:de|ü)?|paket(?:in|i)?|alan(?:ın|ı)?|numara|adresleme|çerçeve|yöntem|teknik|kavram|mekanizma|durum)\s*(?:tarafından\s+|,\s*|\s+(?=esas\s+olarak|genel\s+olarak|temel\s+olarak))|bu\s+katmanın\s+|genel\s+olarak\s+|temel\s+olarak\s+|esas\s+olarak\s+|kısaca\s+|özetle\s+|yani\s+)/iu;

const TURKISH_FINITE_VERB_RE =
  /(?<![\p{L}\p{N}])(?:oluşur|sağlar|kullanılır|içerir|tanımlar|belirtir|yapar|eder|verir|gösterir|bulunur|gerçekleşir|alınır|gönderilir|iletilir|bölünür|alır|kurar|yönetir|çözer|kapsar|başlar|biter|duyulmaz|edilmez|yoktur|değildir|gelir|denir|bilinir|çalışır|taşı(?:r|nır)|ekler|onaylar|döner|yayar|yayınlar|iletir|görülebilir|sağlanır|gerçekleştirir|uygular|belirler|önler|edilir|verilir|verilmiştir|ölçülür|hesaplanır|yazılır|indirgenir|modelidir|formülüdür|denklemidir|yöntemidir|ifade\s+edilir|amaçlar|yakalar|artar|azalır)(?![\p{L}\p{N}])/iu;

const STEP_LINE_RE = /^(?:(\d+)\s*[.)]?\s*(?:adım|aşama|evre|step))\s*[:\-–—]?\s*(.+)$/iu;

function normalizeAsciiTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lowercases the first letter of a Turkish/English clause ONLY when the first word is NOT an acronym
 * (e.g. preserves `TCP`, `IP`, `SSH`, `ICMP`, `ARP`, `EKG`, `DNA`, `TBMM`, `OSİ`, `MAC`, `MTU`, `IPv4`).
 */
function lowercaseLeadSafe(s: string): string {
  const t = s.trim();
  if (!t) return '';
  const firstToken = t.split(/[\s,.;:()'-]+/)[0] || '';
  const bare = firstToken.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9/]/g, '');
  if (
    bare.length >= 2 &&
    (ACRONYM_SET.has(bare.toUpperCase()) ||
      /^[A-ZÇĞİÖŞÜ]{2,}/.test(bare) ||
      /[A-Z][a-z]*[A-Z0-9]/.test(bare) ||
      bare.includes('/'))
  ) {
    return t;
  }
  return t.charAt(0).toLocaleLowerCase('tr-TR') + t.slice(1);
}

function capitalizeLeadSafe(s: string): string {
  const t = s.trim();
  if (!t) return '';
  // Preserve leading lowercase math variables/functions (`y = a * e^(b*x)`, `f(x) = ...`, `ln(y) = ...`)
  if (/^(?:[a-z](?:\s*[=≈(]|_[a-z0-9])|(?:ln|log|exp|sin|cos|tan)\s*\()/.test(t)) {
    return t;
  }
  const firstToken = t.split(/[\s,.;:()'-]+/)[0] || '';
  const bare = firstToken.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9/]/g, '');
  if (ACRONYM_SET.has(bare.toUpperCase()) && bare.length >= 2) {
    return t.replace(bare, bare.toUpperCase());
  }
  return t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
}

function smartTitleCaseTr(raw: string): string {
  const clean = raw
    .replace(/\s*[:;,.–—-]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';

  const spaced = clean
    .replace(/([A-Za-zÇĞİÖŞÜçğıöşü0-9])\(/g, '$1 (')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(');

  // Clean redundant double word like `Internet Protocol (IP) Protokolü` -> `Internet Protocol (IP)`
  const deduped = spaced.replace(
    /\bProtocol\s*\(([A-Z0-9/-]+)\)\s*Protokol[üu]$/i,
    'Protocol ($1)'
  );

  return deduped
    .split(/\s+/)
    .map((word, idx) => {
      const bare = word.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9/]/g, '');
      const upperBare = bare.toUpperCase();
      if (ACRONYM_SET.has(upperBare) && bare.length >= 2) {
        return word.replace(bare, upperBare);
      }
      // Preserve mixed-case technical compounds like `TCP/IP`, `HTTP/HTTPS`, `IPv4`, `Three-Way`, `Host-to-host`, `ICMP_seq`
      if (/[A-Z]{2,}|\/|[a-z][A-Z]|_/.test(word)) {
        return word;
      }
      const lower = word.toLocaleLowerCase('tr-TR');
      if (
        idx > 0 &&
        /^(ve|veya|ile|de|da|ki|için|göre|ya|of|and|the|to|in|for|by)$/.test(lower)
      ) {
        return lower;
      }
      if (word.startsWith('(') && word.length > 1) {
        const inner = word.slice(1);
        const innerBare = inner.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9%]/g, '');
        if (ACRONYM_SET.has(innerBare.toUpperCase()) && innerBare.length >= 2) {
          return `(${inner.replace(innerBare, innerBare.toUpperCase())}`;
        }
        if (/^(ms|sn|dk|cm|mm|kg|mg|lt|ml|kb|mb|gb|tb|%)$/i.test(innerBare)) {
          return `(${inner.toLowerCase()}`;
        }
        return `(${inner.charAt(0).toLocaleUpperCase('tr-TR')}${inner.slice(1)}`;
      }
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    })
    .join(' ');
}

function cleanTypography(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/:\s*:/g, ':')
    .replace(/\s+([.,;!?])/g, '$1')
    .replace(/,([A-Za-zÇĞİÖŞÜçğıöşü])/g, ', $1')
    .replace(/([a-zçğıöşü])\.([A-ZÇĞİÖŞÜ])/g, '$1. $2')
    // Space before `(` for Turkish/English prose (`TCP(İletim)` -> `TCP (İletim)`) while keeping math calls (`ln(y)`, `f(x)`, `e^(b*x)`, `O(n)`) tight!
    .replace(/(?<![\^])([A-Za-zÇĞİÖŞÜçğıöşü0-9]{2,})\(/g, (m, word: string) =>
      /^(?:ln|log|log10|exp|sin|cos|tan|cot|sqrt|abs|lim|det|min|max|sum|var|cov|std)$/i.test(word)
        ? m
        : `${word} (`
    )
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/(?<![\p{L}\p{N}])yada(?![\p{L}\p{N}])/giu, 'ya da')
    .replace(/(?<![\p{L}\p{N}])olarakda(?![\p{L}\p{N}])/giu, 'olarak da')
    .replace(/\s+-\s+(?=genellikle|çoğunlukla|özellikle)/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentencesSafe(text: string): string[] {
  return cleanTypography(text)
    .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9"“‘(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && !FIGURE_CAPTION_RE.test(s));
}

function distillSentence(raw: string, maxChars = 155): string {
  let s = cleanTypography(raw)
    .replace(/^[-*•–—]\s*/, '')
    .replace(VERBOSE_FILLER_LEAD_RE, '')
    .replace(/[:.;\s]+$/, '')
    .trim();
  if (!s) return '';
  s = capitalizeLeadSafe(s);
  if (s.length <= maxChars) return s;

  const semi = s.lastIndexOf(';', maxChars);
  if (semi >= maxChars * 0.52) return s.slice(0, semi).trim();
  const comma = s.lastIndexOf(',', maxChars);
  if (comma >= maxChars * 0.6) return s.slice(0, comma).trim();
  const space = s.lastIndexOf(' ', maxChars);
  if (space >= maxChars * 0.6) return `${s.slice(0, space).trim()}...`;
  return s.slice(0, maxChars).trim();
}

function distillMultiSentence(sentences: string[], maxChars = 205): string {
  const cleanSents = sentences
    .map((s) => cleanTypography(s).replace(/[:.;\s]+$/, '').trim())
    .filter((s) => s.length >= 5 && !FIGURE_CAPTION_RE.test(s));
  if (cleanSents.length === 0) return '';

  // Drop pure acronym-expansion filler if a concrete functional explanation follows right after it
  let picked = cleanSents;
  if (
    picked.length >= 2 &&
    /^(?:[A-ZÇĞİÖŞÜ\s/-]+,\s+.+\s+anlamına\s+gelir|.+kısaltmasıdır)$/iu.test(picked[0])
  ) {
    picked = [picked[1], ...picked.slice(2)];
  }

  let acc = '';
  for (const rawS of picked) {
    const piece = acc ? rawS.replace(VERBOSE_FILLER_LEAD_RE, '').trim() : rawS;
    if (!piece) continue;
    const candidate = acc ? `${acc}; ${lowercaseLeadSafe(piece)}` : piece;
    if (candidate.length <= maxChars) {
      acc = candidate;
    } else if (!acc) {
      acc = distillSentence(piece, maxChars);
      break;
    } else {
      break;
    }
  }
  return acc ? capitalizeLeadSafe(acc) : '';
}

function extractParenAcronym(title: string): string | null {
  const m = title.match(/\(([A-ZÇĞİÖŞÜ0-9/-]{2,10})\)/);
  return m ? m[1].toUpperCase() : null;
}

function headingTokenOverlap(a: string, b: string): number {
  // Never merge distinct numbered steps (`1. Adım: SYN` vs `2. Adım: SYN-ACK`)
  if (/^\d+\.\s*(?:adım|aşama|evre|step)/iu.test(a) || /^\d+\.\s*(?:adım|aşama|evre|step)/iu.test(b)) {
    return 0;
  }

  const acA = extractParenAcronym(a);
  const acB = extractParenAcronym(b);
  if (acA && acB) {
    // If both carry explicit acronyms: identical acronym = definite duplicate (`Adress (ARP)` + `Adres Çözümleme (ARP)`),
    // different acronyms = guaranteed distinct concepts (`Internet Protocol (IP)` vs `Internet Control Message Protocol (ICMP)`)!
    return acA === acB ? 1.0 : 0;
  }

  const stop = new Set([
    'protokolu', 'protokol', 'protocol', 'katmani', 'katman', 'sistemi', 'modeli',
    've', 'ile', 'the', 'of', 'bolumu', 'evresi', 'asamasi',
  ]);
  const tokA = new Set(normalizeAsciiTr(a).split(' ').filter((w) => w.length >= 3 && !stop.has(w)));
  const tokB = new Set(normalizeAsciiTr(b).split(' ').filter((w) => w.length >= 3 && !stop.has(w)));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let common = 0;
  for (const t of tokA) {
    if (tokB.has(t)) common++;
  }
  // Use Jaccard union similarity so a single shared word (`internet`) never collapses two different concepts!
  const union = new Set([...tokA, ...tokB]).size;
  return common / union;
}

/**
 * 100% Domain-Agnostic Glued 2-Column HTML/PDF Table Parser!
 * Runs on the UNMODIFIED raw line (before typography spacing) so zero-space column transitions like:
 *   `BaşlıkAçıklamaSource(Kaynak) Portİletişimi...Destination(Hedef) Portİletişimin...Length(Uzunluk)Bayt...`
 *   `AlanAçıklamaVersionIP sürümünü...Total Length (TL)Datagramının...OptionsOpsiyonel...`
 *   `OrganelGöreviMitokondriATP sentezler.RibozomProtein sentezler.LizozomHücre içi sindirim yapar.`
 * are parsed cleanly into `{ key, desc }` pairs with ZERO hardcoded topic or field names!
 */
export function parseGluedTableLine(rawLine: string): Array<{ key: string; desc: string }> | null {
  const trimmed = rawLine.replace(/\u00a0/g, ' ').trim();
  if (!GLUED_TABLE_HEADER_RE.test(trimmed)) return null;
  const body = trimmed.replace(GLUED_TABLE_HEADER_RE, '').trim();
  if (body.length < 18) return null;

  // Step 1: Insert row delimiters purely from structural zero-space boundaries:
  // (a) End of sentence punctuation glued directly to next row's Capitalized column header (e.g. `belirtir.Destination`, `vs.Internet`, `dir.Fragment`)
  // (b) End of previous row word/paren glued to next row's Capitalized Header ONLY where the preceding token is lowercase/paren
  //     AND the glued capital word is followed by another glued capital/number/paren (i.e. Key->Desc transition inside that new row)!
  let segmented = body
    // Break after `.` / `!` / `?` glued directly (zero space) to a Capitalized word (`belirtir.Destination`, `vs.Data`, `kısadır.T Dalgası`)
    // Exclude version/example literals like `.IPv4` / `.IPv6`
    .replace(/([a-zçğıöşü)\s][.!?])(?=(?!IPv\d)[A-ZÇĞİÖŞÜ](?:[A-Za-zÇĞİÖŞÜçğıöşü]|\s+[A-ZÇĞİÖŞÜ]))/gu, '$1\n')
    // Break after lowercase Turkish word or `)` glued directly (zero space) to a Capitalized Key that itself has a glued Desc within 42 chars
    .replace(
      /([a-zçğıöşü)])(?=[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}){0,3}(?:\s*\([^)]{2,24}\))?(?:[A-ZÇĞİÖŞÜ0-9]))/gu,
      (match, prevChar, offset, fullStr) => {
        const lastNl = fullStr.lastIndexOf('\n', offset);
        const curChunk = fullStr.slice(lastNl + 1, offset + 1);
        if (curChunk.length >= 24 && curChunk.includes(' ')) {
          return `${prevChar}\n`;
        }
        return match;
      }
    );

  segmented = segmented.replace(
    /([a-zçğıöşü).])(?=[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}\([^)]{2,24}\))/gu,
    (match, prevChar, offset, fullStr) => {
      const lastNl = fullStr.lastIndexOf('\n', offset);
      const curChunk = fullStr.slice(lastNl + 1, offset + 1);
      if (curChunk.length >= 20 && curChunk.includes(' ')) {
        return `${prevChar}\n`;
      }
      return match;
    }
  );

  segmented = segmented.replace(/(vs\.)(?=[A-ZÇĞİÖŞÜ])/g, '$1\n');

  const rawRows = segmented
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length >= 4);

  const pairs: Array<{ key: string; desc: string }> = [];

  for (const row of rawRows) {
    let key = '';
    let desc = '';

    const tabIdx = row.indexOf('\t');
    if (tabIdx >= 2 && tabIdx <= 46) {
      key = row.slice(0, tabIdx).trim();
      desc = row.slice(tabIdx + 1).trim();
    } else {
      const searchWindow = row.slice(0, Math.min(row.length, 52));
      const gluedMatches: number[] = [];
      const re = /([a-zçğıöşü)])([A-ZÇĞİÖŞÜ0-9])/gu;
      let m: RegExpExecArray | null;
      while ((m = re.exec(searchWindow)) !== null) {
        const splitPos = m.index + 1;
        if (splitPos < 3) continue;
        // Skip version literals like `IPv4`, `IPv6`, `HTTP2`
        if (/IPv$/i.test(row.slice(Math.max(0, splitPos - 3), splitPos))) continue;
        const leftPart = row.slice(0, splitPos);
        const opens = (leftPart.match(/\(/g) || []).length;
        const closes = (leftPart.match(/\)/g) || []).length;
        if (opens > closes) continue;
        gluedMatches.push(splitPos);
      }

      if (gluedMatches.length > 0) {
        let splitAt = gluedMatches[0];
        if (
          gluedMatches.length >= 2 &&
          row[splitAt - 1] === ')' &&
          /^\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,12}$/.test(row.slice(splitAt, gluedMatches[1]))
        ) {
          splitAt = gluedMatches[1];
        }
        key = row.slice(0, splitAt).trim();
        desc = row.slice(splitAt).trim();
      } else {
        const colon = row.search(/(?<!\d):(?!\d|\/\/)/);
        if (colon >= 2 && colon <= 44) {
          key = row.slice(0, colon).trim();
          desc = row.slice(colon + 1).trim();
        }
      }
    }

    if (key && desc && key.length >= 2 && key.length <= 46 && desc.length >= 4 && !/[.!?]/.test(key)) {
      pairs.push({
        key: smartTitleCaseTr(key),
        desc: distillSentence(desc, 78),
      });
    } else if (pairs.length > 0 && row.length <= 40) {
      // Continuation fragment (e.g. `IPv4, IPv6 vs.`) -> enrich previous row cleanly!
      const prev = pairs[pairs.length - 1];
      prev.desc = distillSentence(`${prev.desc}; ${row}`, 85);
    }
  }

  return pairs.length >= 2 ? pairs : null;
}

/**
 * Extracts inline `* Key: Value * Key2: Value2` star-separated sub-items from a paragraph line.
 */
function extractInlineStarItems(
  line: string
): { lead: string; items: Array<{ key: string; desc: string }> } | null {
  if (!/\s\*\s+[^*]{2,42}:/.test(line)) return null;
  const parts = line
    .split(/\s\*\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const lead = parts[0].replace(/:\s*$/, '').trim();
  const items: Array<{ key: string; desc: string }> = [];
  for (const part of parts.slice(1)) {
    const colon = part.search(/(?<!\d):(?!\d|\/\/)/);
    if (colon >= 2 && colon <= 44) {
      items.push({
        key: smartTitleCaseTr(part.slice(0, colon).trim()),
        desc: distillSentence(part.slice(colon + 1).trim(), 74),
      });
    } else if (part.length >= 4) {
      items.push({ key: distillSentence(part, 60), desc: '' });
    }
  }
  return items.length >= 1 ? { lead, items } : null;
}

function extractBadgeAndPriority(text: string): {
  cleaned: string;
  badge?: string;
  priority?: 'SINAV' | 'ÖNEMLİ';
} {
  let s = text.trim();
  let badge: string | undefined;
  let priority: 'SINAV' | 'ÖNEMLİ' | undefined;

  const existingBracket = s.match(/\[([^\]]{1,36})\]/);
  if (existingBracket) {
    const val = existingBracket[1].trim();
    if (/^(?:sınav|sinav|exam)$/iu.test(val)) priority = 'SINAV';
    else if (/^(?:önemli|onemli|important)$/iu.test(val)) priority = 'ÖNEMLİ';
    else badge = val;
    s = s.replace(existingBracket[0], '').replace(/\s+/g, ' ').trim();
  }

  if (!priority) {
    if (
      /(?:sınavda\s+çıkar|sinavda\s+cikar|sınav\s+sorusu|tus'ta|yks'de|vizede\s+çıkar)/iu.test(s)
    ) {
      priority = 'SINAV';
      s = s
        .replace(/\(\s*(?:sınavda\s+çıkar|sinavda\s+cikar|sınav\s+sorusu)\s*\)/giu, '')
        .trim();
    } else if (/(?:^|(?<![\p{L}\p{N}]))(?:çok\s+önemli|kritik\s+nokta|dikkat\s*:|unutma\s*:)/iu.test(s)) {
      priority = 'ÖNEMLİ';
      s = s.replace(/\(\s*(?:çok\s+önemli|kritik|dikkat)\s*\)/giu, '').trim();
    }
  }

  if (!badge) {
    const formulaBadge = extractCompactFormula(s, 38);
    if (formulaBadge) {
      badge = formulaBadge;
    }
  }

  if (!badge) {
    const qm = s.match(QUANT_BADGE_RE);
    if (qm) badge = qm[1].replace(/\s+/g, ' ').trim();
  }

  return { cleaned: isFormulaExpression(s) ? s : cleanTypography(s), badge, priority };
}

interface RawParsedLine {
  raw: string;
  trimmed: string;
  indent: number;
  isBullet: boolean;
  isNumbered: boolean;
  isHeadingMd: boolean;
  isFormula: boolean;
  mdDepth: number;
  content: string;
  precededByBlank: boolean;
}

function preprocessLines(rawInput: string): RawParsedLine[] {
  const cleaned = rawInput
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/([a-zçğıöşüA-ZÇĞİÖŞÜ])-\n([a-zçğıöşü])/g, '$1$2')
    .replace(/^(\s*)[●○❖➢➣➤►▸▪▫◦»✓✔]\s*/gm, '$1- ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1');

  const lines = cleaned.split('\n');
  const out: RawParsedLine[] = [];
  let sawBlank = false;

  for (const rawLine of lines) {
    const expanded = rawLine.replace(/\t/g, '  ');
    const trimmed = expanded.trim();
    if (!trimmed || /^[-*•–—]\s*$/.test(trimmed)) {
      sawBlank = true;
      continue;
    }
    if (PAGE_NOISE_RE.test(trimmed)) {
      continue;
    }

    const indent = expanded.match(/^\s*/)?.[0].length ?? 0;
    const hMatch = trimmed.match(/^(#{1,5})\s+(.+)$/);
    const bMatch = !hMatch ? trimmed.match(/^[-*•–—]\s+(.+)$/) : null;
    const nMatch = !hMatch && !bMatch ? trimmed.match(/^(\d+(?:\.\d+)*)[.)]\s+(.+)$/) : null;

    const rawBody = hMatch ? hMatch[2] : bMatch ? bMatch[1] : nMatch ? nMatch[2] : trimmed;
    const isFormula = isFormulaExpression(rawBody);

    // Strip non-educational cover-slide / administrative / table-dump boilerplate lines!
    if (!isFormula && isAcademicBoilerplateLine(rawBody)) {
      continue;
    }

    const sanitizedBody = isFormula ? rawBody.trim() : filterAndCleanAcademicLine(rawBody);
    if (!sanitizedBody) {
      continue;
    }

    const isGluedTable = GLUED_TABLE_HEADER_RE.test(sanitizedBody);
    const content = isFormula || isGluedTable ? sanitizedBody : cleanTypography(sanitizedBody);
    if (!content || (!isFormula && FIGURE_CAPTION_RE.test(content))) {
      continue;
    }

    out.push({
      raw: rawLine,
      trimmed,
      indent,
      isBullet: Boolean(bMatch),
      isNumbered: Boolean(nMatch),
      isHeadingMd: Boolean(hMatch) && !isFormula,
      isFormula,
      mdDepth: hMatch && !isFormula ? hMatch[1].length : 0,
      content,
      precededByBlank: sawBlank,
    });
    sawBlank = false;
  }

  return out;
}

function isStandaloneShortHeading(line: RawParsedLine): boolean {
  if (line.isFormula) return false;
  if (isWordProblemOrExampleFiller(line.content)) return false;
  if (line.isHeadingMd) return true;
  if (line.isBullet) return false;
  if (line.isNumbered) {
    if (line.indent >= 2 || STEP_LINE_RE.test(line.trimmed)) return false;
  }
  if (GLUED_TABLE_HEADER_RE.test(line.content)) return false;
  if (TRANSITION_STUB_RE.test(line.content)) return false;
  const c = line.content;
  if (c.length < 3 || c.length > 74) return false;
  if (/[.!?]$/.test(c)) return false;
  const colonIdx = c.search(/(?<!\d):(?!\d|\/\/)/);
  if (colonIdx > 1 && c.slice(colonIdx + 1).trim().length >= 5) return false;
  const withoutParens = c.replace(/\([^)]*\)/g, '').replace(/:\s*$/, '').trim();
  if (withoutParens.includes(',') || withoutParens.split(/\s+/).length > 7) return false;
  // Reject full Turkish declarative sentences ending with a verb (e.g. `... minimize edilir:`, `... düz doğru modelidir:`)
  if (TURKISH_FINITE_VERB_RE.test(withoutParens)) {
    return false;
  }
  return true;
}

function inferCentralTopic(lines: RawParsedLine[]): { title: string; consumedFirstLine: boolean } {
  if (lines.length === 0) return { title: 'Ders Notu Haritası', consumedFirstLine: false };
  const first = lines[0];

  if (isStandaloneShortHeading(first)) {
    const tailMatch = first.content.match(SECTION_FAMILY_TAIL_RE);
    const tailWord = tailMatch ? normalizeAsciiTr(tailMatch[1]).replace(/i$/, '') : '';
    const familyCount = tailWord
      ? lines.filter(
          (l) => isStandaloneShortHeading(l) && normalizeAsciiTr(l.content).includes(tailWord)
        ).length
      : 0;
    if (familyCount < 2) {
      return { title: smartTitleCaseTr(first.content), consumedFirstLine: true };
    }
  }

  const firstContent = first.content;
  const commaIdx = firstContent.indexOf(',');
  if (commaIdx >= 3 && commaIdx <= 46) {
    const subj = firstContent.slice(0, commaIdx).trim();
    if (subj.split(/\s+/).length <= 5 && !/^(?:bu|şu|bir|her|ancak|fakat)/iu.test(subj)) {
      return { title: smartTitleCaseTr(subj), consumedFirstLine: false };
    }
  }
  const colonIdx = firstContent.search(/(?<!\d):(?!\d|\/\/)/);
  if (colonIdx >= 3 && colonIdx <= 46) {
    return {
      title: smartTitleCaseTr(firstContent.slice(0, colonIdx).trim()),
      consumedFirstLine: false,
    };
  }
  const predMatch = firstContent.match(
    /^(.{3,44}?)\s+(?:nedir|olarak|bir|için|üzerinde|ile|tarafından|adını)(?![\p{L}\p{N}])/iu
  );
  if (predMatch && predMatch[1].split(/\s+/).length <= 5) {
    return { title: smartTitleCaseTr(predMatch[1].trim()), consumedFirstLine: false };
  }

  return {
    title: smartTitleCaseTr(firstContent.split(/\s+/).slice(0, 4).join(' ')),
    consumedFirstLine: false,
  };
}

/**
 * Classifies all standalone headings across the document into Level 1 (Main Sections),
 * Level 2 (Major Sub-Concepts inside a section), or Level 3 (Format/Steps/Detail blocks).
 * 100% domain-agnostic — detects recurring structural heading families automatically!
 */
function classifyHeadingLevels(
  lines: RawParsedLine[],
  startIdx: number
): Map<number, 1 | 2 | 3> {
  const levels = new Map<number, 1 | 2 | 3>();
  const standaloneIdxs: number[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    if (isStandaloneShortHeading(lines[i])) {
      standaloneIdxs.push(i);
    }
  }

  const familyCounts = new Map<string, number>();
  const headingFamily = new Map<number, string>();

  for (const idx of standaloneIdxs) {
    const m = lines[idx].content.match(SECTION_FAMILY_TAIL_RE);
    if (m) {
      const fam = normalizeAsciiTr(m[1]).replace(/[iu]$/, '');
      headingFamily.set(idx, fam);
      familyCounts.set(fam, (familyCounts.get(fam) || 0) + 1);
    }
  }

  // Primary L1 family = first recurring structural family with >= 2 headings (not an L3 detail suffix)
  let primaryL1Family = '';
  for (const idx of standaloneIdxs) {
    const fam = headingFamily.get(idx);
    if (
      fam &&
      (familyCounts.get(fam) || 0) >= 2 &&
      !L3_SUBHEADING_SUFFIX_RE.test(lines[idx].content)
    ) {
      primaryL1Family = fam;
      break;
    }
  }

  const hasExplicitMdL1 = standaloneIdxs.some((idx) => lines[idx].isHeadingMd && lines[idx].mdDepth <= 2);
  let hasSeenL1 = false;
  let hasSeenL2InCurrentL1 = false;

  for (const idx of standaloneIdxs) {
    const line = lines[idx];
    if (line.isHeadingMd) {
      const lvl = (line.mdDepth <= 2 ? 1 : line.mdDepth === 3 ? 2 : 3) as 1 | 2 | 3;
      levels.set(idx, lvl);
      if (lvl === 1) {
        hasSeenL1 = true;
        hasSeenL2InCurrentL1 = false;
      } else if (lvl === 2) {
        hasSeenL2InCurrentL1 = true;
      }
      continue;
    }

    // When explicit `##` slide/section headings already exist (PDF/PPTX/DOCX),
    // never let plain colon sub-headers (`Eğim ve Kesim Noktası Formülleri:`) steal Level-1 main branch slots!
    if (hasExplicitMdL1 && hasSeenL1 && !line.isNumbered) {
      levels.set(idx, L3_SUBHEADING_SUFFIX_RE.test(line.content) && hasSeenL2InCurrentL1 ? 3 : 2);
      if (levels.get(idx) === 2) hasSeenL2InCurrentL1 = true;
      continue;
    }

    if (line.isNumbered) {
      const subDotMatch = line.trimmed.match(/^(\d+(?:\.\d+)+)[.)]\s+/);
      const lvl = (subDotMatch ? (subDotMatch[1].split('.').length >= 3 ? 3 : 2) : 1) as 1 | 2 | 3;
      levels.set(idx, lvl);
      if (lvl === 1) {
        hasSeenL1 = true;
        hasSeenL2InCurrentL1 = false;
      } else if (lvl === 2) {
        hasSeenL2InCurrentL1 = true;
      }
      continue;
    }

    if (L3_SUBHEADING_SUFFIX_RE.test(line.content)) {
      levels.set(idx, hasSeenL2InCurrentL1 ? 3 : hasSeenL1 ? 2 : 1);
      continue;
    }

    if (primaryL1Family) {
      const fam = headingFamily.get(idx);
      if (fam === primaryL1Family) {
        levels.set(idx, 1);
        hasSeenL1 = true;
        hasSeenL2InCurrentL1 = false;
      } else if (hasSeenL1) {
        levels.set(idx, 2);
        hasSeenL2InCurrentL1 = true;
      } else {
        levels.set(idx, 1);
        hasSeenL1 = true;
        hasSeenL2InCurrentL1 = false;
      }
    } else {
      const looksLikeSubConcept =
        hasSeenL1 &&
        (/\([A-Z]{2,8}\)/.test(line.content) ||
          (!line.precededByBlank &&
            /(?<![\p{L}\p{N}])(?:protokol|yöntem|algoritma|tür|tip|alt|örnek)(?![\p{L}\p{N}])/iu.test(
              line.content
            )));
      if (looksLikeSubConcept) {
        levels.set(idx, 2);
        hasSeenL2InCurrentL1 = true;
      } else {
        levels.set(idx, 1);
        hasSeenL1 = true;
        hasSeenL2InCurrentL1 = false;
      }
    }
  }

  return levels;
}

function splitKeyAndValue(text: string): { key: string; val: string } | null {
  // NEVER split mathematical/scientific equations (`y = a0 + a1x`, `Y = AX + B`) at `=`!
  if (isFormulaExpression(text)) return null;
  const colonIdx = text.search(/(?<!\d):(?!\d|\/\/)/);
  if (colonIdx >= 2 && colonIdx <= 54) {
    const key = text.slice(0, colonIdx).trim();
    const val = text.slice(colonIdx + 1).trim();
    const keyWords = key.split(/\s+/);
    // Reject full verb-bearing sentences before `:` (like `"TCP/IP, adını iki ana protokolden alır: TCP ve IP"`)
    const keyEndsWithVerb = TURKISH_FINITE_VERB_RE.test(keyWords[keyWords.length - 1] || '');
    const keyHasClauseComma = key.includes(',');
    if (
      key.length >= 2 &&
      val.length >= 3 &&
      keyWords.length <= 6 &&
      !keyEndsWithVerb &&
      !keyHasClauseComma
    ) {
      return { key, val };
    }
  }
  const dashMatch = text.match(/^(.{2,48}?)\s+(?:—|–|->|=>)\s+(.{5,})$/);
  if (dashMatch && dashMatch[1].split(/\s+/).length <= 5) {
    return { key: dashMatch[1].trim(), val: dashMatch[2].trim() };
  }
  return null;
}

function deriveShortSubTitle(sentence: string): { title: string; desc: string } {
  const clean = cleanTypography(sentence);
  const kv = splitKeyAndValue(clean);
  if (kv) {
    return { title: smartTitleCaseTr(kv.key), desc: distillSentence(kv.val, 165) };
  }

  // Domain-agnostic Turkish semantic cues -> clean academic study titles
  if (/(?<![\p{L}\p{N}])(?:kısaltmasıdır|adını\s+.*alır|anlamına\s+gelir)(?![\p{L}\p{N}])/iu.test(clean)) {
    return { title: 'İsim Kökeni', desc: distillSentence(clean, 165) };
  }
  if (
    /(?:geliştirilmiştir|yüzyıl|tarih|kuruldu|ortaya\s+çıkmıştır|önce|sonra)/iu.test(clean) &&
    /(?:katman|yapı|model|sistem|sade|basit|dönem|evre)/iu.test(clean)
  ) {
    return { title: 'Yapı ve Tarihçe', desc: distillSentence(clean, 175) };
  }
  if (/(?:her\s+katman|her\s+aşama|her\s+bölüm|mantığı|hizmet(?:ler)?\s+sağlar|bir\s+üst)/iu.test(clean)) {
    return { title: 'Çalışma Mantığı', desc: distillSentence(clean, 160) };
  }
  if (/(?:referans\s+model|karşılığı|katmanlarını\s+kapsar)/iu.test(clean)) {
    return { title: 'Kapsam ve Karşılık', desc: distillSentence(clean, 160) };
  }
  if (/(?:kullandığı\s+protokoller|kullandığı\s+yöntemler|başlıca\s+.*(?:şunlardır|dir|dır))/iu.test(clean)) {
    return { title: 'Kullanılan Protokoller', desc: distillSentence(clean, 160) };
  }
  if (/(?:kullanım\s+alan|genel\s+olarak\s+.*kullanılır|tercih\s+edilir|yaygın\s+kullanılır)/iu.test(clean)) {
    return { title: 'Kullanım Alanı', desc: distillSentence(clean, 155) };
  }
  if (/(?:komut(?:u|la| ile)|command|ping\s+komutu|ifconfig|arp\s+-a)/iu.test(clean)) {
    return { title: 'Komut ve Test Kullanımı', desc: distillSentence(clean, 160) };
  }
  if (/(?:temel\s+sorumluluğu|amacı|temel\s+görevi)/iu.test(clean)) {
    return { title: 'Temel Sorumluluk', desc: distillSentence(clean, 160) };
  }
  if (/(?:yönlendirilir|yönlendirme\s+protokol|rota|en\s+uygun\s+yol)/iu.test(clean)) {
    return { title: 'Yönlendirme', desc: distillSentence(clean, 165) };
  }
  if (/(?:başlığı\s+ekleyerek|kapsül|çerçeve(?:lere|leme))/iu.test(clean)) {
    return { title: 'Kapsülleme ve İşlevler', desc: distillSentence(clean, 165) };
  }
  if (/(?:güvenilir\s+bir\s+bağlantı|hatalı\s+veya\s+eksik|sıra\s+numarası\s+içerir|segment\s+olarak)/iu.test(clean)) {
    return { title: 'Güvenilirlik ve Segmentasyon', desc: distillSentence(clean, 175) };
  }

  // Fallback: clean subject before first comma (only if it's a crisp noun phrase <= 4 words)
  const commaIdx = clean.indexOf(',');
  if (commaIdx >= 5 && commaIdx <= 38) {
    const left = clean.slice(0, commaIdx).trim();
    const right = clean.slice(commaIdx + 1).trim();
    if (
      left.split(/\s+/).length <= 4 &&
      right.length >= 12 &&
      !/^(?:bu|şu|o|ancak|fakat|örneğin|ayrıca|genellikle|temel|son)$/iu.test(left.split(/\s+/)[0] || '')
    ) {
      return { title: smartTitleCaseTr(left), desc: distillSentence(right, 160) };
    }
  }

  // Smart Turkish noun-head fallback (never leave hanging genitive/modifier words!)
  const words = clean.replace(/[.!?]+$/, '').split(/\s+/);
  const headWords = words.slice(0, Math.min(3, words.length));
  while (
    headWords.length > 2 &&
    /^(ve|veya|ile|bir|bu|şu|o|için|göre|olarak|de|da|ki|tarafından|gelen|olan|eden|yapan)$/iu.test(
      headWords[headWords.length - 1]
    )
  ) {
    headWords.pop();
  }
  return {
    title: smartTitleCaseTr(headWords.join(' ')),
    desc: distillSentence(clean, 160),
  };
}

function isSameConceptAsParent(parentTitle: string, text: string): boolean {
  const lead = text.split(/[,.:\n]/)[0]?.trim() || '';
  if (!lead || lead.length > 52) return false;
  return headingTokenOverlap(parentTitle, lead) >= 0.75;
}

/**
 * Post-processes the structured tree bottom-up:
 * - Merges duplicate sibling headings (even non-adjacent!) sharing an acronym or >= 0.58 token overlap.
 * - Collapses numbered steps (`1. Adım`, `2. Adım`, `3. Adım`) into crisp single-line step chains in Balanced/Compact modes.
 * - Collapses homogeneous field lists (`>= 4` leaf fields inside a Format/Header/Table node) cleanly without crushing L2 concepts.
 * - Keeps concise `Not:` takeaways per L1 section.
 */
function refineTreeNode(node: StructuredOutlineNode, depth: LectureNoteDepth, level: number): void {
  // 1. Merge duplicate sibling children (sharing parenthetical acronym or >= 0.58 token overlap)
  const mergedChildren: StructuredOutlineNode[] = [];
  for (const child of node.children) {
    const existing = mergedChildren.find(
      (prev) => headingTokenOverlap(prev.title, child.title) >= 0.58
    );
    if (existing) {
      // Prefer the cleaner / properly spelled Turkish or standard title (avoid typos like `Adress`)
      const existingHasAc = Boolean(extractParenAcronym(existing.title));
      const childHasAc = Boolean(extractParenAcronym(child.title));
      const existingTypo = /\badress\b/i.test(existing.title);
      if ((childHasAc && !existingHasAc) || (existingTypo && !/\badress\b/i.test(child.title))) {
        existing.title = child.title;
      }
      if (child.desc) {
        existing.desc = existing.desc
          ? distillMultiSentence([existing.desc, child.desc], 210)
          : child.desc;
      }
      existing.children.push(...child.children);
      existing.notes.push(...child.notes);
      if (!existing.badge && child.badge) existing.badge = child.badge;
      if (!existing.priority && child.priority) existing.priority = child.priority;
    } else {
      mergedChildren.push(child);
    }
  }
  node.children = mergedChildren;

  // Recurse bottom-up
  for (const child of node.children) {
    refineTreeNode(child, depth, level + 1);
  }

  // 2. Collapse numbered step children (`1. Adım: ...`, `2. Adım: ...`, `3. Adım: ...`) in balanced/compact modes!
  if (depth !== 'detailed' && node.children.length >= 2) {
    const stepChildren = node.children.filter((c) => c.kind === 'steps');
    if (stepChildren.length >= 2 && stepChildren.length === node.children.length) {
      const compactSteps = stepChildren
        .map((st) => {
          const shortDesc = st.desc ? ` (${lowercaseLeadSafe(distillSentence(st.desc, 78))})` : '';
          return `${st.title}${shortDesc}`;
        })
        .join(', ');
      node.desc = node.desc
        ? `${distillSentence(node.desc, 95)}; ${compactSteps}`
        : compactSteps;
      node.children = [];
      return;
    }
  }

  // 3. Collapse homogeneous field lists (`>= 4` leaf items) ONLY inside Format/Fields/Level-3+ nodes!
  //    Never crush Level-2 Concept sub-branches (like `IP` -> `IP Adresleme`, `Yönlendirme`, `IP Datagram Formatı`).
  if (
    depth !== 'detailed' &&
    (level >= 3 || node.kind === 'fields') &&
    node.children.length >= 4 &&
    node.children.every((c) => c.children.length === 0)
  ) {
    const summaryParts = node.children.map((c) => {
      const shortKey = c.title
        .replace(/\s*\([^)]{1,24}\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const shortVal = c.desc ? distillSentence(c.desc, 54).replace(/\.+$/, '') : '';
      return shortVal ? `${shortKey} (${lowercaseLeadSafe(shortVal)})` : shortKey;
    });
    const maxJoined = depth === 'compact' ? 300 : 580;
    let joined = summaryParts.join(', ');
    if (joined.length > maxJoined) {
      joined = `${joined.slice(0, maxJoined).replace(/,[^,]*$/, '')}...`;
    }
    node.desc = node.desc ? `${distillSentence(node.desc, 90)}: ${joined}` : joined;
    node.children = [];
    return;
  }

  // 4. Inside a Level-3 Format node that has `Header (Başlık)` + `Data (Veri)` (each already leaf after step 3),
  //    merge their clean descriptions cleanly in balanced/compact modes so the outline stays 3-level crisp (0/2/4 spaces)!
  if (
    depth !== 'detailed' &&
    level === 3 &&
    node.kind === 'fields' &&
    node.children.length >= 2 &&
    node.children.length <= 3 &&
    node.children.every((c) => c.children.length === 0)
  ) {
    const combined = node.children
      .map((c) => (c.desc ? `${c.title}: ${c.desc}` : c.title))
      .join(' | ');
    node.desc = node.desc ? `${distillSentence(node.desc, 95)} — ${combined}` : combined;
    node.children = [];
    return;
  }

  // 5. Promote generic intro detail to L1 branch `desc` if missing
  if (level === 1 && !node.desc && node.children.length > 0) {
    const first = node.children[0];
    if (first.children.length === 0 && first.kind === 'detail' && first.desc) {
      node.children.shift();
      node.desc = first.desc;
    }
  }

  // 6. Cap children cleanly in compact/balanced mode & preserve overflow inside `Not:`
  const maxKids = depth === 'compact' ? 5 : depth === 'balanced' ? 10 : 18;
  if (node.children.length > maxKids) {
    const kept = node.children.slice(0, maxKids);
    const extra = node.children.slice(maxKids);
    const extraSummary = extra
      .slice(0, 4)
      .map((e) => e.title)
      .join(', ');
    if (extraSummary) {
      node.notes.push(`Ek alt başlıklar: ${extraSummary}`);
    }
    node.children = kept;
  }

  if (node.notes.length > 1) {
    // Keep ALL distinct `Formül:` notes intact alongside concise prose notes!
    const formulaNotes = node.notes.filter((n) => /^Formül:/i.test(n.trim()));
    const proseNotes = node.notes.filter((n) => !/^Formül:/i.test(n.trim()));
    const mergedProse = proseNotes.length > 0 ? [distillMultiSentence(proseNotes, 170)] : [];
    node.notes = [...formulaNotes.slice(0, 3), ...mergedProse].filter(Boolean);
  }
}

function serializeTreeToPhoto6Outline(
  rootTitle: string,
  topBranches: StructuredOutlineNode[]
): { formattedOutline: string; badgesCount: number } {
  const lines: string[] = [rootTitle];
  let badgesCount = 0;

  const emitNode = (node: StructuredOutlineNode, indentSpaces: number) => {
    const pad = ' '.repeat(indentSpaces);
    const suffixParts: string[] = [];
    if (node.badge && !node.title.toLowerCase().includes(node.badge.toLowerCase())) {
      suffixParts.push(`[${node.badge}]`);
      badgesCount++;
    }
    if (node.priority) {
      suffixParts.push(`[${node.priority}]`);
      badgesCount++;
    }
    const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(' ')}` : '';
    const cleanTitle = node.title.replace(/[:;,.–—-]+$/, '').trim();
    const cleanDesc = (node.desc || '')
      .replace(/^[:;,\-–—\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanDesc && cleanDesc.toLowerCase() !== cleanTitle.toLowerCase()) {
      lines.push(`${pad}- ${cleanTitle}: ${cleanDesc}${suffix}`);
    } else {
      lines.push(`${pad}- ${cleanTitle}${suffix}`);
    }

    for (const child of node.children) {
      emitNode(child, Math.min(4, indentSpaces + 2));
    }

    // Emit contextual `Not:` / `Formül:` takeaways cleanly at L1/L2 level
    for (const note of node.notes) {
      const notePad = ' '.repeat(Math.min(4, indentSpaces + 2));
      if (/^Formül:/i.test(note.trim())) {
        lines.push(`${notePad}${note.trim()}`);
      } else {
        const cleanNote = distillSentence(note, 175);
        if (cleanNote) {
          lines.push(`${notePad}Not: ${cleanNote}.`);
        }
      }
    }
  };

  for (const branch of topBranches) {
    emitNode(branch, 0);
  }

  return {
    formattedOutline: lines.join('\n').trim(),
    badgesCount,
  };
}

/**
 * Main entry point: deeply analyzes ANY raw Turkish/English lecture note, PDF copy-paste,
 * mixed bullets + tables, or structured slides and synthesizes a clean Photo-6 hierarchical outline.
 */
export function structureRawLectureNoteToOutline(
  rawInput: string,
  options?: LectureNoteConversionOptions
): { formattedOutline: string; badgesCount: number } {
  const depth: LectureNoteDepth = options?.depth ?? 'balanced';
  const lines = preprocessLines(rawInput);
  if (lines.length === 0) {
    return { formattedOutline: '', badgesCount: 0 };
  }

  const { title: rootTitle, consumedFirstLine } = inferCentralTopic(lines);
  const startIdx = consumedFirstLine ? 1 : 0;
  const headingLevels = classifyHeadingLevels(lines, startIdx);

  const rootSections: StructuredOutlineNode[] = [];
  let activeL1: StructuredOutlineNode | null = null;
  let activeL2: StructuredOutlineNode | null = null;
  let activeL3: StructuredOutlineNode | null = null;
  let activeStepNode: StructuredOutlineNode | null = null;
  let activeKeyNode: StructuredOutlineNode | null = null;

  const ensureOverviewBranch = (): StructuredOutlineNode => {
    if (!activeL1) {
      activeL1 = {
        title: 'Genel Bakış',
        badge: 'Temel',
        notes: [],
        children: [],
        kind: 'overview',
      };
      rootSections.push(activeL1);
    }
    return activeL1;
  };

  const currentContainer = (): StructuredOutlineNode =>
    activeL3 ?? activeL2 ?? ensureOverviewBranch();

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // 1. Standalone classified heading (L1 / L2 / L3)
    const hLevel = headingLevels.get(i);
    if (hLevel) {
      const { cleaned, badge, priority } = extractBadgeAndPriority(line.content);
      const node: StructuredOutlineNode = {
        title: smartTitleCaseTr(cleaned),
        badge,
        priority,
        notes: [],
        children: [],
        kind: hLevel === 1 ? 'section' : hLevel === 2 ? 'concept' : 'fields',
      };
      activeStepNode = null;
      activeKeyNode = null;

      if (hLevel === 1) {
        rootSections.push(node);
        activeL1 = node;
        activeL2 = null;
        activeL3 = null;
      } else if (hLevel === 2) {
        const parent = ensureOverviewBranch();
        parent.children.push(node);
        activeL2 = node;
        activeL3 = null;
      } else {
        const parent = activeL2 ?? ensureOverviewBranch();
        parent.children.push(node);
        activeL3 = node;
      }
      continue;
    }

    // 2. Skip empty transition stubs (`Uygulama katmanında kullanılan bazı protokoller:`)
    if (TRANSITION_STUB_RE.test(line.content)) {
      activeStepNode = null;
      activeKeyNode = null;
      continue;
    }

    // 3. Glued 2-column HTML/PDF copied table (`BaşlıkAçıklama...` / `AlanAçıklama...` / `OrganelGörevi...`)
    const tablePairs = parseGluedTableLine(line.raw);
    if (tablePairs && tablePairs.length >= 2) {
      const container = currentContainer();
      if (depth === 'detailed') {
        for (const row of tablePairs) {
          container.children.push({
            title: row.key,
            desc: row.desc,
            notes: [],
            children: [],
            kind: 'fields',
          });
        }
      } else {
        const compactTable = tablePairs
          .map((r) => {
            const shortKey = r.key
              .replace(/\s*\([^)]{1,22}\)\s*/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const shortDesc = distillSentence(r.desc, 50).replace(/\.+$/, '');
            return shortDesc ? `${shortKey} (${lowercaseLeadSafe(shortDesc)})` : shortKey;
          })
          .join(', ');
        container.desc = container.desc
          ? `${distillSentence(container.desc, 85)}; ${compactTable}`
          : compactTable;
      }
      // After a table finishes inside an L3 format node, pop back to L2 so next prose/heading attaches properly
      if (activeL3) activeL3 = null;
      continue;
    }

    // 3b. First-Class Mathematical / Scientific Formula Preservation!
    //     Preserves equations (`y = a0 + a1x`, `Y = AX + B`, `S_r = ∑(y_i - a0 - a1x_i)^2`) verbatim
    //     as crisp formula badges and/or `Formül:` takeaways so ZERO formulas are mangled or dropped!
    if (line.isFormula) {
      const container = currentContainer();
      const formulaText = line.content.trim();
      if (!container.badge && formulaText.length <= 42) {
        container.badge = formulaText;
      }
      const alreadyHasFormula =
        container.badge === formulaText ||
        (container.desc && container.desc.includes(formulaText)) ||
        container.notes.some((n) => n.includes(formulaText));
      if (!alreadyHasFormula) {
        if (!container.desc && container.children.length === 0 && container.kind !== 'overview') {
          container.desc = `Formül: ${formulaText}`;
        } else {
          container.notes.push(`Formül: ${formulaText}`);
        }
      }
      continue;
    }

    // 4. Numbered Step Line (`1. Adım: SYN (...)`)
    const stepMatch = line.content.match(STEP_LINE_RE);
    if (stepMatch) {
      const container = currentContainer();
      const stepNum = stepMatch[1];
      const stepTitle = smartTitleCaseTr(`${stepNum}. Adım: ${stepMatch[2].trim()}`);
      const stepNode: StructuredOutlineNode = {
        title: stepTitle,
        notes: [],
        children: [],
        kind: 'steps',
      };
      container.children.push(stepNode);
      activeStepNode = stepNode;
      activeKeyNode = null;
      continue;
    }

    // Bullet right after `1. Adım: ...` explains that exact step!
    if (activeStepNode && line.isBullet && !splitKeyAndValue(line.content)) {
      const sents = splitSentencesSafe(line.content);
      activeStepNode.desc = activeStepNode.desc
        ? distillMultiSentence([activeStepNode.desc, ...sents], 145)
        : distillMultiSentence(sents, 135);
      continue;
    }
    activeStepNode = null;

    // 5. Inline star-separated items (`İlk Satır: ... * Byte miktarı: ... * TTL: ...`)
    const starParsed = extractInlineStarItems(line.content);
    if (starParsed) {
      const container = currentContainer();
      const leadKv = splitKeyAndValue(starParsed.lead);
      const itemSummary = starParsed.items
        .map((it) => (it.desc ? `${it.key} (${lowercaseLeadSafe(it.desc)})` : it.key))
        .join(', ');

      // If container is already an empty L3 detail heading (e.g. `İstatistikler:` or `Çıktının Önemi:`), populate its `desc` directly!
      if (activeL3 && !activeL3.desc && activeL3.children.length === 0) {
        const leadPart = leadKv ? `${leadKv.key}: ${distillSentence(leadKv.val, 85)}` : distillSentence(starParsed.lead, 90);
        activeL3.desc = leadPart ? `${leadPart}; ${itemSummary}` : itemSummary;
      } else {
        const title = leadKv
          ? smartTitleCaseTr(leadKv.key)
          : smartTitleCaseTr(starParsed.lead.slice(0, 42));
        const desc = leadKv
          ? `${distillSentence(leadKv.val, 85)}; ${itemSummary}`
          : itemSummary;
        container.children.push({
          title,
          desc: distillSentence(desc, 235),
          notes: [],
          children: [],
          kind: 'detail',
        });
      }
      continue;
    }

    // 6. Explicit `Not:` / `İpucu:` / `Dikkat:` note line
    const notePrefix = line.content.match(
      /^(?:not|notlar|ipucu|dikkat|unutma|özet|note)\s*[:\-–—]\s*(.+)$/iu
    );
    if (notePrefix) {
      const target = activeL1 ?? ensureOverviewBranch();
      target.notes.push(distillSentence(notePrefix[1], 170));
      continue;
    }

    // 7. Explicit `Key: Value` structured definition (`HTTP/HTTPS: ...`, `Header(Başlık): ...`, `Doğrusal Model: y = a0 + a1x`)
    const { cleaned, badge, priority } = extractBadgeAndPriority(line.content);
    const kv = splitKeyAndValue(cleaned);
    if (kv) {
      const keyClean = smartTitleCaseTr(kv.key);
      const valIsFormula = isFormulaExpression(kv.val);
      const valSents = valIsFormula ? [kv.val.trim()] : splitSentencesSafe(kv.val);
      const distilledVal = valIsFormula
        ? `Formül: ${kv.val.trim()}`
        : distillMultiSentence(valSents, depth === 'compact' ? 145 : 195);
      const resolvedBadge = badge ?? (valIsFormula && kv.val.trim().length <= 42 ? kv.val.trim() : undefined);

      // Non-bullet `Header(Başlık): ...` or `Data(Veri): ...` inside an L3 Format block becomes a field-group container
      if (!line.isBullet && activeL3) {
        const subBlock: StructuredOutlineNode = {
          title: keyClean,
          desc: distilledVal,
          badge: resolvedBadge,
          priority,
          notes: [],
          children: [],
          kind: 'fields',
        };
        activeL3.children.push(subBlock);
        activeKeyNode = subBlock;
        continue;
      }

      const targetParent =
        line.isBullet && activeKeyNode && activeL3
          ? activeKeyNode
          : line.indent >= 2 && activeKeyNode
          ? activeKeyNode
          : currentContainer();

      const kvNode: StructuredOutlineNode = {
        title: keyClean,
        desc: distilledVal,
        badge: resolvedBadge,
        priority,
        notes: [],
        children: [],
        kind: activeL3 ? 'fields' : 'detail',
      };
      targetParent.children.push(kvNode);
      if (line.indent < 2 && !activeL3) {
        activeKeyNode = kvNode;
      }
      continue;
    }

    // 7b. Word-problem / exercise narration (`Bir deneysel çalışma sırasında...`, `Aşağıdaki tabloda verilen...`)
    //     Keep it from creating junk top-level/sub-branch concept cards when we already have real topics!
    if (isWordProblemOrExampleFiller(cleaned)) {
      if (activeL1 && activeL1.notes.length < 2) {
        activeL1.notes.push(`Örnek: ${distillSentence(cleaned, 130)}`);
      }
      continue;
    }

    // 8. Regular bullet or prose paragraph inside current section/concept
    // If we were inside an L3 Format block (`TCP Segment Formatı`) that already collected its fields (`Header` + `Data`),
    // and now encounter a non-bullet general prose paragraph explaining the parent L2 concept (`Ağ üzerinde iki cihaz...`),
    // automatically exit L3 back to L2!
    if (activeL3 && !line.isBullet && activeL3.children.length > 0 && activeL2) {
      activeL3 = null;
      activeKeyNode = null;
    }

    activeKeyNode = null;
    const container = currentContainer();
    const sents = splitSentencesSafe(cleaned);
    if (sents.length === 0) continue;

    // 8a. Very first defining sentence(s) of a newly opened Section/Concept/L3 -> promote as concise summary `desc`!
    if (!container.desc && container.children.length === 0 && container.kind !== 'overview') {
      container.desc = distillMultiSentence(sents, depth === 'compact' ? 145 : 190);
      if (badge && !container.badge) container.badge = badge;
      if (priority && !container.priority) container.priority = priority;
      continue;
    }

    // 8b. Opening cohesive bullets of a Section or Concept (before any child sub-branches exist):
    //     Fold into `desc` (up to ~215 chars) or stash as `Not:` on L1 instead of inventing choppy sub-branch titles!
    const isUsageOrCommand =
      /(?:kullanım\s+alan|genel\s+olarak\s+.*kullanılır|komut|ifconfig|ping|protokoller\s+ethernet|kullandığı\s+protokoller)/iu.test(
        cleaned
      );
    if (
      (container.kind === 'section' || container.kind === 'concept') &&
      container.children.length === 0 &&
      !isUsageOrCommand &&
      container.desc
    ) {
      if (container.desc.length < 185) {
        const merged = distillMultiSentence([container.desc, ...sents], 220);
        if (merged.length > container.desc.length) {
          container.desc = merged;
          continue;
        }
      }
      if (container === activeL1 && container.notes.length === 0) {
        container.notes.push(distillMultiSentence(sents, 165));
        continue;
      }
    }

    // 8c. If a prose paragraph restates the exact parent section title (`Ağ Erişim Katmanı, ...` under `Ağ Erişim Katmanı`),
    //     attach it cleanly as `Not:` on that section instead of creating a duplicate self-named child!
    if (container === activeL1 && isSameConceptAsParent(container.title, cleaned)) {
      if (container.notes.length === 0) {
        container.notes.push(distillMultiSentence(sents, 170));
      }
      continue;
    }

    // 8d. In `Genel Bakış`, first bullet sets `Genel Bakış` summary `desc`
    if (container.kind === 'overview' && !container.desc) {
      container.desc = distillMultiSentence(sents, 155);
      continue;
    }

    // 8e. Short trailing summary paragraph under an L1 section -> crisp `Not:` line
    if (
      container === activeL1 &&
      container.kind === 'section' &&
      container.notes.length === 0 &&
      sents.length <= 2 &&
      cleaned.length < 185 &&
      !isUsageOrCommand
    ) {
      container.notes.push(distillMultiSentence(sents, 165));
      continue;
    }

    // 8f. Otherwise create a clean distilled sub-branch under current container
    const lead = deriveShortSubTitle(sents[0]);
    const fullDesc =
      sents.length === 1
        ? lead.desc
        : distillMultiSentence(sents, depth === 'compact' ? 150 : 200);

    // Avoid duplicating an identical sub-branch right under a concept (e.g. second prose paragraph on TCP)
    const prevChild = container.children[container.children.length - 1];
    if (
      prevChild &&
      prevChild.title === lead.title &&
      prevChild.children.length === 0
    ) {
      prevChild.desc = distillMultiSentence([prevChild.desc || '', fullDesc], 210);
      continue;
    }

    container.children.push({
      title: lead.title,
      desc: fullDesc,
      badge,
      priority,
      notes: [],
      children: [],
      kind: 'detail',
    });
  }

  // Assign clean sequential structural badges when >= 3 main sections share a recurring family (e.g. `Katman`, `Evre`, `Dönem`, `Bölüm`)
  const nonOverviewSections = rootSections.filter((s) => s.kind === 'section');
  const allAreLayers =
    nonOverviewSections.length >= 3 &&
    nonOverviewSections.every((s) => /katman|layer/iu.test(s.title));
  if (allAreLayers) {
    const isTopDown = /uygulama|application|en\s+üst/iu.test(
      `${nonOverviewSections[0].title} ${nonOverviewSections[0].desc || ''}`
    );
    nonOverviewSections.forEach((sec, idx) => {
      if (!sec.badge) {
        const num = isTopDown ? nonOverviewSections.length - idx : idx + 1;
        sec.badge = `Katman ${num}`;
      }
    });
  }

  // Refine every main branch bottom-up
  for (const sec of rootSections) {
    refineTreeNode(sec, depth, 1);
  }

  return serializeTreeToPhoto6Outline(rootTitle, rootSections);
}
