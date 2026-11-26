/**
 * AcademicContentFilter — Universal TR + EN Lecture Content Purifier & Formula Extractor
 *
 * Ensures PDF / PPTX / DOCX slides and copy-pasted lecture notes produce ONLY genuine
 * educational concepts, methods, definitions, and mathematical/scientific formulas:
 *  - Strips cover-slide administrative metadata (universities, faculties, departments,
 *    instructor academic titles, week/semester headers, course codes, TOC, references, thank-you slides).
 *  - Filters raw numeric data-table dumps and deprioritizes word-problem narrative filler.
 *  - Detects and preserves mathematical/scientific formulas untouched (no title-casing or `=` splitting).
 *  - Scores sections by educational density so core concepts & formulas win main branch slots.
 */

/**
 * Locale-safe Turkish lowercase normalizer: eliminates JavaScript's notorious `İ` -> `i\u0307`
 * regex mismatch so `/üniversite/` reliably matches `ERCİYES ÜNİVERSİTESİ`, `MÜHENDİSLİK`, `İÇİNDEKİLER`, etc.
 */
export function toTrLower(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
    .replace(/i\u0307/g, 'i');
}

export const COURSE_CODE_PREFIX_RE =
  /^(?:[A-ZÇĞİÖŞÜ]{2,5}\s*[-–]?\s*\d{3,4}[A-Z]?\s*[-–:|]?\s*)/u;

export const WEEK_PREFIX_RE =
  /^(?:(?:\d{1,2}\.?\s*(?:hafta|ders|ünite|bölüm|slayt|oturum))|(?:(?:hafta|week|lecture|lesson|session|module|unit|chapter|slayt|slide)\s*[-–:#.]?\s*\d{1,2}\.?))\s*[:\-–—|]?\s*/iu;

const INSTITUTION_BOILERPLATE_RE =
  /(?<![a-zçğıöşü0-9])(?:üniversite(?:si|leri|miz)?|fakülte(?:si|leri)?|anabilim\s+dalı|bilim\s+dalı|enstitü(?:sü)?|yüksekokul(?:u)?|meslek\s+yüksekokulu|rektörlüğü|dekanlığı|müdürlüğü|university|faculty\s+of|department\s+of|school\s+of|college\s+of|institute\s+of)(?![a-zçğıöşü0-9])/u;

const DEPARTMENT_LINE_RE =
  /(?:mühendisliği|bilimleri|öğretmenliği|edebiyatı|hukuku|eğitimi|tasarımı|mimarlığı|işletmesi|iktisadı|fiziği|kimyası|biyolojisi|matematiği|hemşireliği|eczacılığı|diş\s+hekimliği)\s+(?:bölümü|programı|anabilim\s+dalı)|^(?:[a-zçğıöşü\s]{2,42}\s+)?bölümü\s*$/u;

const INSTRUCTOR_TITLE_RE =
  /^(?:prof\.?\s*dr\.?|doç\.?\s*dr\.?|yrd\.?\s*doç\.?(?:\s*dr\.?)?|dr\.?\s*öğr\.?\s*üyesi|öğr\.?\s*gör\.?(?:\s*dr\.?)?|arş\.?\s*gör\.?(?:\s*dr\.?)?|okt\.?|uzm\.?\s*(?:dr\.?)?|dr\.?|hazırlayan(?:lar)?|eğitmen|ders\s+sorumlusu|dersi\s+veren|öğretim\s+üyesi|öğretim\s+görevlisi|sunan(?:lar)?|yazar(?:lar)?|öğrenci\s*(?:ad[ıi]|no|numaras[ıi])|ad[ıi]\s+soyad[ıi]|instructor|lecturer|professor|prof\.|assoc\.?\s*prof\.?|asst\.?\s*prof\.?|prepared\s+by|presented\s+by|author(?:s)?|taught\s+by)(?![a-zçğıöşü0-9])/u;

const TERM_AND_DATE_RE =
  /^(?:\d{4}\s*[-–/]\s*\d{4}(?:\s*(?:eğitim|öğretim|güz|bahar|yaz|dönemi|yarıyılı|fall|spring|academic|year).*?)?|(?:güz|bahar|yaz)\s+(?:dönemi|yarıyılı)(?:\s*\d{4})?|(?:fall|spring|summer)\s+(?:semester|term)\s*\d{0,4}|ders\s+kodu\b.*|kredi\s*[:\d].*|akts\s*[:\d].*|ects\s*[:\d].*|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|(?:ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})$/u;

const NON_CONTENT_SLIDE_HEADING_RE =
  /^(?:içindekiler|ders\s+planı|ders\s+akışı|sunum\s+planı|sunum\s+akışı|konu\s+başlıkları|dersin\s+amacı|dersin\s+içeriği|öğrenme\s+çıktıları|ders\s+hedefleri|kaynakça|kaynaklar|referanslar|yararlanılan\s+kaynaklar|ileri\s+okuma|teşekkür(?:ler|\s+ederim|\s+ederiz)?|dinlediğiniz\s+için\s+teşekkür(?:ler|\s+ederim|\s+ederiz)?|katılımınız\s+için\s+teşekkür(?:ler|\s+ederim|\s+ederiz)?|soru(?:lar)?\s*\??|soru\s*(?:&|ve|-|\/)\s*cevap|table\s+of\s+contents|outline|agenda|course\s+objectives|learning\s+outcomes|references|bibliography|further\s+reading|thank\s+you(?:\s+for\s+(?:listening|watching|your\s+attention))?|thanks\s+for\s+(?:listening|watching)|questions\s*\??|q\s*&\s*a|the\s+end|son)\s*[!?.:]*$/u;

const CONTACT_OR_COPYRIGHT_RE =
  /(?:^https?:\/\/\S+$|^www\.\S+$|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|^©|copyright\s*\d{0,4}|tüm\s+hakları\s+saklıdır|all\s+rights\s+reserved|araştırma\s+üniversitesi)/u;

const PAGE_COUNTER_RE =
  /^(?:sayfa\s*\d+(?:\s*\/\s*\d+)?|slayt\s*\d+(?:\s*\/\s*\d+)?|s\.\s*\d+|page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|slide\s*\d+(?:\s*(?:of|\/)\s*\d+)?|[-–—•*.\s]*\d+(?:\s*\/\s*\d+)?[-–—•*.\s]*)$/u;

const WORD_PROBLEM_LEAD_RE =
  /^(?:örnek\s*\d*\s*[:.-]?|soru\s*\d*\s*[:.-]?|problem\s*\d*\s*[:.-]?|alıştırma\s*\d*\s*[:.-]?|uygulama\s+örneği\s*\d*\s*[:.-]?|example\s*\d*\s*[:.-]?|exercise\s*\d*\s*[:.-]?|bir\s+deneysel\s+çalışma|bir\s+deney(?:de|sel)?|aşağıdaki\s+tablo(?:da|ya)?\s+verilen|yukarıdaki\s+tablo(?:da|ya)?\s+verilen|verilen\s+değerler(?:e|i)?\s+(?:göre|kullanarak)|farklı\s+öğrenciler\s+tarafından|ölçülerek\s+aşağıdaki)/u;

const EDUCATIONAL_CONCEPT_SIGNAL_RE =
  /(?<![a-zçğıöşü0-9])(?:yöntem(?:i|leri)?|regresyon|enterpolasyon|interpolasyon|uydurma|doğrusallaştırma|polinom|üstel|logaritmik|lineer|doğrusal|en\s+küçük\s+kareler|hata|sapma|korelasyon|determinasyon|varyans|standart|türev|integral|matris|vektör|denklem(?:i|leri)?|formül(?:ü|leri)?|teorem(?:i)?|kanun(?:u)?|yasası|ilkesi|algoritma(?:sı)?|analiz(?:i)?|model(?:i|leme)?|yaklaşım(?:ı)?|dönüşüm(?:ü)?|fonksiyon(?:u)?|sistem(?:i)?|katman(?:ı)?|protokol(?:ü)?|evre(?:si)?|aşama(?:sı)?|mekanizma(?:sı)?|yapı(?:sı)?|tanım(?:ı)?|özellik(?:leri)?|kural(?:ı)?|metod|method|regression|interpolation|polynomial|exponential|linear|equation|formula|theorem|algorithm|analysis|model)(?![a-zçğıöşü0-9])/u;

const PROSE_CONNECTOR_IN_FORMULA_RE =
  /(?<![a-zçğıöşü])(?:dönüşümü|ile|olarak|elde|edilir|kullanılır|bulunur|yazılır|verilir|olup|için|şeklinde|değeri|artar|azalır|yaklaştıkça|where|with|gives|becomes|yields)(?![a-zçğıöşü])/u;

const MATH_UNICODE_SYMBOL_RE = /[∑∫∏∂∇√±∞≈≤≥≠≡∝ΔλμσπθαβγΩω²³⁴ⁿ⁻¹·×÷]/;

const MATH_FUNC_RE =
  /(?<![A-Za-z])(?:ln|log|log10|exp|sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|sqrt|abs|lim|det|min|max|sum|avg|var|cov|std|erf)\s*\(/i;

/**
 * Returns true if `rawText` is a mathematical/scientific formula or equation that MUST be
 * preserved untouched (never title-cased, never split on `=`, and prioritized in mind maps).
 */
export function isFormulaExpression(rawText: string): boolean {
  const s = rawText.trim();
  if (s.length < 3 || s.length > 200) return false;
  if (/^https?:\/\//i.test(s)) return false;

  // Reject natural Turkish/English prose sentences that merely embed a formula inline!
  if (PROSE_CONNECTOR_IN_FORMULA_RE.test(toTrLower(s))) return false;

  const hasEqualsOrRel = /[=≈≤≥∝≡]/.test(s);
  const hasMathUnicode = MATH_UNICODE_SYMBOL_RE.test(s);
  const hasMathFunc = MATH_FUNC_RE.test(s);

  // Pure expression with strong math unicode symbols (e.g. `∑(y_i - a0 - a1x_i)^2` or `∫ f(x) dx`)
  if (hasMathUnicode && (hasEqualsOrRel || /[+\-*/^()]/.test(s))) {
    const longWords = s.match(/[\p{L}]{5,}/gu) || [];
    if (longWords.length <= 2) return true;
  }

  if (!hasEqualsOrRel) return false;

  // Reject HTML attributes / query strings / prose sentences with many long words
  if (/\b(?:http|www|class|style|href|src|width|height|color)\s*=/i.test(s)) return false;
  const longProseWords = (s.match(/[\p{L}]{5,}/gu) || []).filter(
    (w) => !/^(?:sin|cos|tan|log|exp|sqrt|lim|max|min|sum|var|cov|std|det|abs)$/i.test(w)
  );
  if (longProseWords.length >= 3) return false;

  // Check algebraic structure around `=`
  const eqIdx = s.search(/[=≈≤≥∝≡]/);
  if (eqIdx <= 0) return false;
  const lhs = s.slice(0, eqIdx).trim();
  const rhs = s.slice(eqIdx + 1).trim();
  if (!lhs || !rhs) return false;

  // LHS should look like a math variable, function, derivative, or short expression (e.g. `y`, `Y`, `f(x)`, `a1`, `S_r`, `dy/dx`, `R²`, `PV`)
  const lhsLooksMath =
    lhs.length <= 28 &&
    (/^[A-Za-zα-ωΑ-ΩΔ∑∫∂][A-Za-z0-9_'\^*()\[\],.\s/+\-·×²³]*$/.test(lhs) ||
      /^[A-Za-zÇĞİÖŞÜçğıöşü]{1,4}_[A-Za-z0-9]+$/.test(lhs));

  // RHS should contain math operators, numbers, variables, fractions, powers, or math functions
  const rhsLooksMath =
    hasMathUnicode ||
    hasMathFunc ||
    /[+\-*/^·×÷()]/.test(rhs) ||
    /\b[a-zA-Z]\d\b/.test(rhs) ||
    /\d\s*\/\s*[a-zA-Z0-9]/.test(rhs) ||
    /^[A-Za-z0-9_.,\s+\-*/^()·×÷]+$/.test(rhs);

  if (lhsLooksMath && rhsLooksMath) {
    const isTrivialSingleScalar =
      /^[A-Za-z0-9_]{1,4}\s*=\s*-?\d+(?:[.,]\d+)?\s*$/.test(s);
    if (isTrivialSingleScalar) return false;
    return true;
  }

  return false;
}

/**
 * Extracts a clean, compact formula expression (<= 44 chars) either from a pure formula line
 * or embedded inside a short explanatory sentence (e.g. `"Üstel Model: y = a * e^(b*x) dönüşümü ile ln(y) = ln(a) + b*x"` -> `"ln(y) = ln(a) + b*x"` or `"y = a * e^(b*x)"`).
 */
export function extractCompactFormula(rawText: string, maxLen = 44): string | null {
  const s = rawText.replace(/\s+/g, ' ').trim();
  if (!s) return null;

  if (isFormulaExpression(s)) {
    return s.length <= maxLen ? s : `${s.slice(0, maxLen - 1).trim()}…`;
  }

  // Look after `:` (e.g. `Doğrusal Regresyon Modeli: y = a0 + a1x`)
  const colonIdx = s.search(/(?<!\d):(?!\d|\/\/)/);
  if (colonIdx > 1 && colonIdx < s.length - 3) {
    const rhs = s.slice(colonIdx + 1).replace(/[.!?;]+$/, '').trim();
    if (isFormulaExpression(rhs)) {
      return rhs.length <= maxLen ? rhs : `${rhs.slice(0, maxLen - 1).trim()}…`;
    }
  }

  // Look for an inline equation segment inside prose (stopping cleanly before prose connectors!)
  const inlineMatch = s.match(
    /(?<![\p{L}\p{N}])((?:(?:ln|log|exp|sin|cos|tan)\s*\([^)]{1,12}\)|[A-Za-zα-ωΑ-ΩΔ][A-Za-z0-9_'\^²³()]{0,10})\s*[=≈]\s*(?:[∑∫√±(]*[A-Za-z0-9α-ωΑ-ΩΔ_'\^²³·×÷+\-*/().,\s]{2,34}?))(?=(?:\s+(?:dönüşümü|ile|ve|veya|olarak|olup|için|şeklinde|denklemi|formülü|elde|edilir|olur|bulunur|yazılır|verilir|where|with|and|for)\b|[;.]|$))/u
  );
  if (inlineMatch) {
    const candidate = inlineMatch[1].replace(/[.,;:\s]+$/, '').trim();
    if (candidate.length >= 5 && isFormulaExpression(candidate)) {
      return candidate.length <= maxLen ? candidate : `${candidate.slice(0, maxLen - 1).trim()}…`;
    }
  }

  return null;
}

/**
 * Strips leading university course codes (`BZ 204 Sayısal Yöntemler` -> `Sayısal Yöntemler`).
 */
export function stripCourseCodePrefix(rawText: string): string {
  const cleaned = rawText.replace(COURSE_CODE_PREFIX_RE, '').trim();
  return cleaned.length >= 3 ? cleaned : rawText.trim();
}

/**
 * Strips leading week/lecture prefixes (`7. Hafta: Eğri Uydurma` -> `Eğri Uydurma`).
 * Returns `''` if the line was ONLY a week marker (`7. Hafta`).
 */
export function stripWeekPrefix(rawText: string): string {
  const trimmed = rawText.trim();
  if (!WEEK_PREFIX_RE.test(trimmed)) return trimmed;
  return trimmed.replace(WEEK_PREFIX_RE, '').trim();
}

/**
 * Detects raw numeric table / coordinate dump lines copied from engineering/science PDFs
 * (e.g. `10 20 30 40 50 60`, `20.5 32.7 51.0 73.2 95.7`, `T (°C) 20.5 32.7 51.0 73.2`).
 */
export function isRawNumericTableLine(rawLine: string): boolean {
  const s = rawLine.trim();
  if (!s || isFormulaExpression(s)) return false;

  const numTokens = s.match(/-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/gi) || [];
  if (numTokens.length < 3) return false;

  const alphaWords = (s.match(/[\p{L}]{3,}/gu) || []).filter(
    (w) => !/^(?:deg|ohm|min|max|sin|cos|tan|log|exp|sec|rpm|mhz|khz|ghz)$/i.test(w)
  );
  // If >= 4 numbers and <= 2 real words -> raw data table row!
  if (numTokens.length >= 4 && alphaWords.length <= 2) return true;

  const noSpace = s.replace(/\s+/g, '');
  const numericChars = (noSpace.match(/[0-9.,+\-–—/()%°Ωµ±|]/g) || []).length;
  if (noSpace.length >= 6 && numericChars / noSpace.length >= 0.58 && alphaWords.length <= 2) {
    return true;
  }
  return false;
}

/**
 * Detects non-educational academic / slide administrative boilerplate lines:
 * universities, faculties, departments, instructor titles, bare week/date/term labels,
 * TOC/agenda/references/thank-you headers, emails, URLs, copyrights, and page numbers.
 */
export function isAcademicBoilerplateLine(rawLine: string): boolean {
  const s = rawLine.replace(/^#{1,5}\s+/, '').replace(/^[-*•–—]\s+/, '').trim();
  if (!s) return true;
  if (isFormulaExpression(s)) return false;

  const low = toTrLower(s);
  if (PAGE_COUNTER_RE.test(low)) return true;
  if (CONTACT_OR_COPYRIGHT_RE.test(low)) return true;
  if (NON_CONTENT_SLIDE_HEADING_RE.test(low)) return true;
  if (TERM_AND_DATE_RE.test(low)) return true;
  if (INSTRUCTOR_TITLE_RE.test(low)) return true;

  // Bare week/slide label (`7. Hafta`, `Week 4`)
  if (WEEK_PREFIX_RE.test(s) && stripWeekPrefix(s).length < 3) return true;

  // Institutional / faculty / department headers (typically short cover/footer lines)
  if (s.length <= 125 && (INSTITUTION_BOILERPLATE_RE.test(low) || DEPARTMENT_LINE_RE.test(low))) {
    return true;
  }

  // Pure standalone course code (`BZ 204`, `CS-101`, `MAT102`)
  if (/^[A-ZÇĞİÖŞÜ]{2,5}\s*[-–]?\s*\d{3,4}[A-Z]?$/u.test(s)) {
    return true;
  }

  // Raw numeric table rows
  if (isRawNumericTableLine(s)) return true;

  // Bibliographic citation lines (`Chapra, S. C., & Canale, R. P. (2015). Numerical Methods...`)
  if (
    /^[A-ZÇĞİÖŞÜ][\p{L}-]+,\s+[A-ZÇĞİÖŞÜ]\.(?:\s*[A-ZÇĞİÖŞÜ]\.)?.*\(\d{4}\)/u.test(s) ||
    /^(?:\[\d+\]\s+[A-ZÇĞİÖŞÜ][\p{L}-]+,\s+[A-ZÇĞİÖŞÜ]\.)/u.test(s)
  ) {
    return true;
  }

  return false;
}

/**
 * Cleans an academic line by stripping boilerplate, week prefixes (`7. Hafta: Eğri Uydurma` -> `Eğri Uydurma`),
 * trailing slide counters (`2 / 7`), and course codes when appropriate. Returns `''` if the line should be dropped.
 */
export function filterAndCleanAcademicLine(rawLine: string): string {
  const mdPrefix = rawLine.match(/^(\s*(?:#{1,5}\s+|[-*•–—]\s+))/)?.[1] ?? '';
  let body = rawLine.slice(mdPrefix.length).trim();
  if (!body) return '';
  if (isFormulaExpression(body)) return rawLine.trim();

  // Strip trailing slide page counters glued onto footer lines (`BZ 204 Sayısal Yöntemler 2 / 7`)
  body = body.replace(/\s+\d{1,3}\s*\/\s*\d{1,3}\s*$/, '').trim();
  if (!body || isAcademicBoilerplateLine(body)) return '';

  // Strip `7. Hafta: ` prefix while keeping the actual lecture topic after it!
  if (WEEK_PREFIX_RE.test(body)) {
    const topicPart = stripWeekPrefix(body);
    if (topicPart.length < 3 || isAcademicBoilerplateLine(topicPart)) return '';
    return `${mdPrefix}${topicPart}`.trim();
  }

  // Strip leading course code on standalone heading lines (`## BZ 204 Sayısal Yöntemler` -> `## Sayısal Yöntemler`)
  if (COURSE_CODE_PREFIX_RE.test(body) && body.length <= 72) {
    const cleanTopic = stripCourseCodePrefix(body);
    if (cleanTopic.length >= 3 && !isAcademicBoilerplateLine(cleanTopic)) {
      return `${mdPrefix}${cleanTopic}`.trim();
    }
  }

  return `${mdPrefix}${body}`.trim();
}

export function isWordProblemOrExampleFiller(rawText: string): boolean {
  const s = rawText.trim();
  if (!s) return false;
  const low = toTrLower(s);
  if (WORD_PROBLEM_LEAD_RE.test(low)) return true;
  if (
    /(?:aşağıdaki\s+tablo(?:da|ya)?\s+verilen|yukarıdaki\s+tablo(?:da|ya)?\s+verilen|deneysel\s+çalışma\s+sırasında|farklı\s+öğrenciler\s+tarafından\s+ölçülerek)/u.test(
      low
    )
  ) {
    return true;
  }
  return false;
}

export interface PageClassification {
  isCoverSlide: boolean;
  isNonContentSlide: boolean;
  inferredTopicTitle?: string;
  inferredCourseTitle?: string;
}

/**
 * Classifies a PDF/PPTX slide page as a Cover Slide, References/Thank-You/TOC slide,
 * or real Educational Content page — and extracts the cleanest lecture topic title from Cover Slides.
 */
export function classifySlidePage(
  pageLines: string[],
  pageIndex: number,
  totalPages: number
): PageClassification {
  const trimmedLines = pageLines.map((l) => l.trim()).filter(Boolean);
  if (trimmedLines.length === 0) {
    return { isCoverSlide: false, isNonContentSlide: true };
  }

  let coverSignalCount = 0;
  let nonContentHeadingHits = 0;
  let formulaHits = 0;
  let nonMetaBodyChars = 0;
  let courseTitle: string | undefined;
  let topicCandidates: string[] = [];

  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i];
    if (isFormulaExpression(line)) {
      formulaHits++;
      nonMetaBodyChars += line.length;
      continue;
    }

    const low = toTrLower(line);
    const isInst = INSTITUTION_BOILERPLATE_RE.test(low) || DEPARTMENT_LINE_RE.test(low);
    const isInstr = INSTRUCTOR_TITLE_RE.test(low);
    const isTerm = TERM_AND_DATE_RE.test(low);
    const isWeek = WEEK_PREFIX_RE.test(line);
    const isCourseCoded = COURSE_CODE_PREFIX_RE.test(line) && line.length <= 72;
    const isNonContentHdr = NON_CONTENT_SLIDE_HEADING_RE.test(low);

    if (isNonContentHdr) nonContentHeadingHits++;
    if (isInst || isInstr || isTerm || isWeek || isCourseCoded) {
      coverSignalCount++;
    }

    if (isCourseCoded) {
      const stripped = stripCourseCodePrefix(line);
      if (stripped.length >= 3 && !isAcademicBoilerplateLine(stripped)) {
        courseTitle = stripped;
      }
      continue;
    }

    if (isWeek) {
      const afterWeek = stripWeekPrefix(line);
      if (afterWeek.length >= 3 && !isAcademicBoilerplateLine(afterWeek)) {
        topicCandidates.push(afterWeek);
      }
      continue;
    }

    if (isInst || isInstr || isTerm || isNonContentHdr || PAGE_COUNTER_RE.test(low) || CONTACT_OR_COPYRIGHT_RE.test(low)) {
      continue;
    }

    // Skip standalone Turkish author/instructor `Ad SOYAD` line (e.g. `Nesibe YALÇIN`) right on cover slides
    if (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,18}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,18})?\s+[A-ZÇĞİÖŞÜ]{2,22}$/u.test(line)) {
      coverSignalCount++;
      continue;
    }

    // Remaining non-metadata text on this slide
    if (line.length >= 3 && line.length <= 68 && !/[.!?]$/.test(line)) {
      topicCandidates.push(line);
    }
    nonMetaBodyChars += line.length;
  }

  // Page 1 Cover Slide detection (when document has >= 2 pages)
  const isCoverSlide =
    pageIndex === 1 &&
    totalPages >= 2 &&
    formulaHits === 0 &&
    ((coverSignalCount >= 1 && nonMetaBodyChars < 170) ||
      (coverSignalCount >= 2 && trimmedLines.length <= 12 && nonMetaBodyChars < 260));

  // References / Thank-You / TOC slide detection (any page, especially first 2 or last 2 slides)
  const firstLineLow = toTrLower(trimmedLines[0] || '');
  const isClosingOrTocSlide =
    formulaHits === 0 &&
    (NON_CONTENT_SLIDE_HEADING_RE.test(firstLineLow) ||
      (nonContentHeadingHits >= 1 && nonMetaBodyChars < 240));

  // Pure word-problem / numeric measurement table slide with ZERO formulas (e.g. `Örnek 1: Deneysel Ölçüm Tablosu`)
  const hasWordProblemLead =
    formulaHits === 0 &&
    trimmedLines.some((l) => isWordProblemOrExampleFiller(l)) &&
    trimmedLines.some((l) => isRawNumericTableLine(l));

  // Detect pure bibliography pages where majority of lines are citations or URLs
  const citationLines = trimmedLines.filter((l) => isAcademicBoilerplateLine(l)).length;
  const isAllBoilerplate =
    trimmedLines.length >= 1 && citationLines === trimmedLines.length && topicCandidates.length === 0;

  const inferredTopicTitle = topicCandidates.find(
    (t) => t.length >= 3 && t.length <= 64 && !isWordProblemOrExampleFiller(t)
  );

  return {
    isCoverSlide,
    isNonContentSlide: isCoverSlide || isClosingOrTocSlide || hasWordProblemLead || isAllBoilerplate,
    inferredTopicTitle,
    inferredCourseTitle: courseTitle,
  };
}

/**
 * Scores a mind-map main branch by genuine educational value so real lecture concepts,
 * methods, definitions, and mathematical formulas ALWAYS beat boilerplate, TOC items,
 * and word-problem filler when compacting to 5-7 crisp branches.
 */
export function scoreEducationalBranchValue(input: {
  title: string;
  note?: string;
  techBadge?: string;
  priorityTag?: string;
  childSummaries: Array<{ title: string; note?: string; techBadge?: string }>;
}): number {
  const title = input.title.trim();
  const note = (input.note || '').trim();
  const badge = (input.techBadge || '').trim();
  const combined = `${title} ${badge} ${note}`;

  if (isAcademicBoilerplateLine(title)) return -100;
  if (/^(?:diğer\s+önemli\s+konular|genel\s+bilgiler|giriş\s+slaytı)$/iu.test(title)) return -30;

  let score = 0;

  // Huge boost for mathematical/scientific formulas!
  if (isFormulaExpression(title) || isFormulaExpression(badge)) score += 16;
  if (extractCompactFormula(combined)) score += 12;
  let childFormulaHits = 0;
  for (const ch of input.childSummaries) {
    if (
      isFormulaExpression(ch.title) ||
      isFormulaExpression(ch.techBadge || '') ||
      Boolean(extractCompactFormula(`${ch.title} ${ch.note || ''}`))
    ) {
      childFormulaHits++;
    }
  }
  score += Math.min(24, childFormulaHits * 10);

  // Boost genuine educational concepts/methods/theorems/models
  const titleLow = toTrLower(title);
  const noteLow = toTrLower(note);
  if (EDUCATIONAL_CONCEPT_SIGNAL_RE.test(titleLow)) score += 9;
  if (EDUCATIONAL_CONCEPT_SIGNAL_RE.test(noteLow)) score += 4;

  // Priority tags & structured richness
  if (input.priorityTag === 'exam') score += 9;
  if (input.priorityTag === 'important') score += 6;
  if (badge) score += 4;
  if (note.length >= 20) score += 4;
  score += Math.min(15, input.childSummaries.length * 3.5);

  // Penalize word-problem / exercise narration so it doesn't crowd out real theory/formulas
  if (isWordProblemOrExampleFiller(title) || isWordProblemOrExampleFiller(note)) {
    score -= 14;
  }

  // Penalize overly long raw sentence titles
  if (title.length > 62) score -= 5;

  return score;
}

/**
 * Strips course codes & formula noise when preparing a query for icon/sticker lookup
 * so nodes like `BZ 204 Sayısal Yöntemler` or `Doğrusal Regresyon [y = a0 + a1x]` match
 * crisp subject icons cleanly instead of falling back to random pictograms.
 */
export function cleanIconLookupQuery(rawTitle: string): string {
  let q = stripCourseCodePrefix(rawTitle);
  q = stripWeekPrefix(q);
  // If title itself is a pure math formula, map to math formula/equation icon query!
  if (isFormulaExpression(q)) {
    return 'matematik formül denklem grafik';
  }
  // Remove inline equation tails from icon search query
  q = q.replace(/[=≈≤≥∑∫∂√±^]+[^\s]*/g, ' ').replace(/\s+/g, ' ').trim();
  return q || rawTitle.trim();
}
