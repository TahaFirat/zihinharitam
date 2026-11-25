import {
  BRANCH_PALETTE,
  type NodePriorityTag,
} from '../../types/mindmap';

export interface ParsedOutlineNode {
  id: string;
  parentId: string | null;
  level: number;
  title: string;
  note?: string;
  techBadge?: string;
  checked?: boolean;
  priorityTag?: NodePriorityTag;
  linkUrl?: string;
  branchColor: string;
}

export interface ParsedOutlineResult {
  rootId: string;
  nodes: ParsedOutlineNode[];
  stats: {
    totalNodes: number;
    mainBranches: number;
    subBranches: number;
    notedBranches: number;
    maxDepth: number;
  };
  /** True if the user only entered a single short topic title (should auto-expand via TopicContextIntelligence) */
  isSingleTopicSeed: boolean;
}

const NOTE_PREFIX_RE =
  /^(?:not|notlar|aciklama|açıklama|detay|detaylar|ornek|örnek|tanim|tanım|formul|formül|ipucu|ozet|özet|bilgi|note|notes|desc|description|detail|example|tip|summary|info)\s*[:\-–—]\s*(.+)$/i;

const PRIORITY_EXAM_RE = /(?:^|\s)(?:\[sınav\]|\[sinav\]|\[exam\]|sınavda çıkar|sinavda cikar|🎓)/i;
const PRIORITY_IMPORTANT_RE = /(?:^|\s)(?:\(!\)|\[önemli\]|\[onemli\]|\[important\]|önemli\s*:|onemli\s*:|🔥|⭐|★)/i;
const PRIORITY_REVIEW_RE = /(?:^|\s)(?:\[tekrar\]|\[review\]|\(\?\)|❓)/i;

const URL_RE = /(https?:\/\/[^\s)\]]+)/i;

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Splits an inline `"Başlık: Uzun açıklama..."` or `"Başlık — Açıklama..."` or `"Başlık (uzun açıklama)"`
 * into a concise branch title AND a rich node `note` description!
 */
export function splitTitleAndInlineNote(rawText: string): {
  title: string;
  note?: string;
  techBadge?: string;
  checked?: boolean;
  priorityTag?: NodePriorityTag;
  linkUrl?: string;
} {
  let text = rawText.trim();
  let checked: boolean | undefined;
  let priorityTag: NodePriorityTag | undefined;
  let techBadge: string | undefined;
  let linkUrl: string | undefined;

  // 1. Extract Markdown task checkbox (`[x]` / `[ ]` / `☑️` / `☐`)
  const taskMatch = text.match(/^(?:\[([xX✓✔ ])\]|([☑✅☐⬜]))\s+(.+)$/);
  if (taskMatch) {
    const mark = (taskMatch[1] || taskMatch[2] || '').trim().toLowerCase();
    checked = mark === 'x' || mark === '✓' || mark === '✔' || mark === '☑' || mark === '✅';
    text = taskMatch[3].trim();
  }

  // 2. Extract priority markers
  if (PRIORITY_EXAM_RE.test(text)) {
    priorityTag = 'exam';
    text = text.replace(PRIORITY_EXAM_RE, ' ').trim();
  } else if (PRIORITY_IMPORTANT_RE.test(text)) {
    priorityTag = 'important';
    text = text.replace(PRIORITY_IMPORTANT_RE, ' ').trim();
  } else if (PRIORITY_REVIEW_RE.test(text)) {
    priorityTag = 'review';
    text = text.replace(PRIORITY_REVIEW_RE, ' ').trim();
  }

  // 3. Extract URL into linkUrl
  const urlMatch = text.match(URL_RE);
  if (urlMatch) {
    linkUrl = urlMatch[1].replace(/[.,;]+$/, '');
    text = text.replace(urlMatch[0], '').replace(/\(\s*\)/g, '').trim();
  }

  // 4. Extract trailing `[Teknik Rozet]`
  const bracketMatch = text.match(/^(.*?)\s*\[([^\]]{1,42})\]\s*$/);
  if (bracketMatch && bracketMatch[1].trim().length >= 2) {
    text = bracketMatch[1].trim();
    techBadge = bracketMatch[2].trim();
  }

  // Strip surrounding Markdown bold/italic wrappers (`**Başlık**` -> `Başlık`)
  const stripMd = (s: string) =>
    s
      .replace(/^\*{1,2}([^*]+)\*{1,2}/, '$1')
      .replace(/^_{1,2}([^_]+)_{1,2}/, '$1')
      .trim();

  // 4b. Split Markdown Bold Lead (`**Başlık** açıklama metni...`)
  const boldLeadMatch = text.match(/^\*\*([^*]{2,56})\*\*\s*[:\-–—]?\s+(.{6,})$/);
  if (boldLeadMatch) {
    return {
      title: boldLeadMatch[1].trim(),
      note: stripMd(boldLeadMatch[2].trim()),
      techBadge,
      checked,
      priorityTag,
      linkUrl,
    };
  }

  // 5. Split `"Başlık: Açıklama"` (ignore times like 10:30 or ratios like 1:2)
  const colonIdx = text.search(/(?<!\d):(?!\d|\/\/)/);
  if (colonIdx > 1 && colonIdx <= 68) {
    const left = stripMd(text.slice(0, colonIdx).trim());
    const right = stripMd(text.slice(colonIdx + 1).trim());
    if (left.length >= 2 && right.length >= 4) {
      return {
        title: left,
        note: right,
        techBadge,
        checked,
        priorityTag,
        linkUrl,
      };
    }
  }

  // 6. Split `"Başlık — Açıklama"` / `"Başlık – Açıklama"` / `"Başlık - Açıklama"` / `"Başlık = Açıklama"` / `"Başlık | Açıklama"`
  const dashMatch = text.match(/^(.{2,64}?)\s+(?:—|–|->|=>|=|\||-(?=\s))\s+(.{6,})$/);
  if (dashMatch) {
    const left = stripMd(dashMatch[1].trim());
    const right = stripMd(dashMatch[2].trim());
    if (left.length >= 2 && right.length >= 6) {
      return {
        title: left,
        note: right,
        techBadge,
        checked,
        priorityTag,
        linkUrl,
      };
    }
  }

  // 7. Split `"Başlık (uzun açıklama >= 22 karakter)"` — keep short acronyms like `(Load Balancer)` inside title!
  const parenMatch = text.match(/^(.{2,56}?)\s*\(([^()]{22,})\)\s*$/);
  if (parenMatch) {
    const left = stripMd(parenMatch[1].trim());
    const right = stripMd(parenMatch[2].trim());
    if (left.length >= 2) {
      return {
        title: left,
        note: right,
        techBadge,
        checked,
        priorityTag,
        linkUrl,
      };
    }
  }

  // 8. Long single sentence (> 68 chars): extract concise title + preserve full text in `note`!
  const cleaned = stripMd(text);
  if (cleaned.length > 68) {
    const firstSentenceEnd = cleaned.search(/[.!?]\s+/);
    if (firstSentenceEnd >= 10 && firstSentenceEnd <= 64) {
      return {
        title: cleaned.slice(0, firstSentenceEnd).trim(),
        note: cleaned.slice(firstSentenceEnd + 1).trim(),
        techBadge,
        checked,
        priorityTag,
        linkUrl,
      };
    }
    const commaIdx = cleaned.indexOf(',');
    if (commaIdx >= 8 && commaIdx <= 54) {
      return {
        title: cleaned.slice(0, commaIdx).trim(),
        note: cleaned,
        techBadge,
        checked,
        priorityTag,
        linkUrl,
      };
    }
    const words = cleaned.split(/\s+/);
    const shortTitle = words.slice(0, Math.min(5, words.length)).join(' ');
    return {
      title: shortTitle,
      note: cleaned,
      techBadge,
      checked,
      priorityTag,
      linkUrl,
    };
  }

  return {
    title: cleaned,
    techBadge,
    checked,
    priorityTag,
    linkUrl,
  };
}

function appendNote(existing: string | undefined, extra: string): string {
  const cleanExtra = extra.trim();
  if (!cleanExtra) return existing || '';
  if (!existing || !existing.trim()) return cleanExtra;
  return `${existing.trim()}\n${cleanExtra}`;
}

interface ClassifiedLine {
  raw: string;
  trimmed: string;
  indent: number;
  kind: 'heading' | 'numbered' | 'bullet' | 'note' | 'plain';
  headingDepth: number;
  numberedDepth: number;
  content: string;
}

function classifyLine(rawLine: string): ClassifiedLine {
  const normalizedTabs = rawLine.replace(/\t/g, '  ');
  const indent = normalizedTabs.match(/^\s*/)?.[0].length ?? 0;
  const trimmed = normalizedTabs.trim();

  // Markdown heading (`#`, `##`, `###`, `####`)
  const hMatch = trimmed.match(/^(#{1,5})\s+(.+)$/);
  if (hMatch) {
    return {
      raw: rawLine,
      trimmed,
      indent,
      kind: 'heading',
      headingDepth: hMatch[1].length,
      numberedDepth: 0,
      content: hMatch[2].trim(),
    };
  }

  // Blockquote (`> açıklama`) or explicit `Not:` / `Açıklama:` / `Örnek:` / `Tanım:`
  if (trimmed.startsWith('>') || trimmed.startsWith('//')) {
    return {
      raw: rawLine,
      trimmed,
      indent,
      kind: 'note',
      headingDepth: 0,
      numberedDepth: 0,
      content: trimmed.replace(/^(?:>|\/\/)+\s*/, '').trim(),
    };
  }

  const withoutBulletForNoteCheck = trimmed.replace(/^[-*•–—◦▪→▸►]\s+/, '').trim();
  const notePrefixMatch = withoutBulletForNoteCheck.match(NOTE_PREFIX_RE);
  if (notePrefixMatch) {
    return {
      raw: rawLine,
      trimmed,
      indent,
      kind: 'note',
      headingDepth: 0,
      numberedDepth: 0,
      content: withoutBulletForNoteCheck,
    };
  }

  // Hierarchical numeric outline (`1.`, `1.1`, `1.2.3`, `2)`)
  const numMatch = trimmed.match(/^(\d+(?:\.\d+)*)[.)]\s+(.+)$/);
  if (numMatch) {
    const depth = numMatch[1].split('.').length;
    return {
      raw: rawLine,
      trimmed,
      indent,
      kind: 'numbered',
      headingDepth: 0,
      numberedDepth: depth,
      content: numMatch[2].trim(),
    };
  }

  // Lettered sub-items (`a)`, `b)`, `a.`)
  const alphaMatch = trimmed.match(/^[a-zçğıöşüA-ZÇĞİÖŞÜ][.)]\s+(.+)$/);
  if (alphaMatch && indent >= 1) {
    return {
      raw: rawLine,
      trimmed,
      indent: Math.max(indent, 2),
      kind: 'bullet',
      headingDepth: 0,
      numberedDepth: 0,
      content: alphaMatch[1].trim(),
    };
  }

  // Standard bullet (`-`, `*`, `•`, `–`, `—`, `◦`, `▪`, `→`, `▸`)
  const bulletMatch = trimmed.match(/^[-*•–—◦▪→▸►]\s+(.+)$/);
  if (bulletMatch) {
    return {
      raw: rawLine,
      trimmed,
      indent,
      kind: 'bullet',
      headingDepth: 0,
      numberedDepth: 0,
      content: bulletMatch[1].trim(),
    };
  }

  return {
    raw: rawLine,
    trimmed,
    indent,
    kind: 'plain',
    headingDepth: 0,
    numberedDepth: 0,
    content: trimmed,
  };
}

/**
 * Extracts clean title + sub-branches + descriptions from plain prose/paragraphs
 * (e.g. copied textbook paragraphs, Wikipedia summaries, or pasted lecture notes with NO bullets!).
 */
function parseProseTextToMindMap(rawInput: string): ParsedOutlineResult {
  const paragraphs = rawInput
    .split(/\n\s*\n+/)
    .map((p) => normalizeWhitespace(p))
    .filter((p) => p.length > 0);

  const rootId = 'root';
  const nodes: ParsedOutlineNode[] = [];
  let mainBranchIdx = 0;

  // Split into sentences safely (preserve decimals like `0.09` and `1.`)
  const splitSentences = (para: string): string[] =>
    para
      .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9"“])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);

  const firstPara = paragraphs[0] || rawInput.trim();
  const firstSentences = splitSentences(firstPara);

  let rootTitle = 'Akademik Zihin Haritası';
  let rootNote: string | undefined;
  let remainingUnits: string[] = [];

  if (paragraphs.length === 1) {
    if (firstSentences.length <= 1) {
      // Single sentence / single topic title!
      const parsed = splitTitleAndInlineNote(firstPara);
      rootTitle = parsed.title || 'Zihin Haritası';
      rootNote = parsed.note;
      const isSeed = !parsed.note && firstPara.length <= 64 && !firstPara.includes(',');
      nodes.push({
        id: rootId,
        parentId: null,
        level: 0,
        title: rootTitle,
        note: rootNote,
        techBadge: parsed.techBadge,
        branchColor: BRANCH_PALETTE[0],
      });

      // If it's a long comma-separated list (`X: A, B, C`), expand items cleanly!
      if (!isSeed && parsed.note && parsed.note.includes(',')) {
        const listItems = parsed.note
          .split(/,|;|\bve\b/i)
          .map((x) => x.trim())
          .filter((x) => x.length >= 2 && x.length <= 48);
        if (listItems.length >= 2 && listItems.length <= 8) {
          listItems.forEach((item, idx) => {
            const p = splitTitleAndInlineNote(item);
            nodes.push({
              id: `prose_${idx + 1}`,
              parentId: rootId,
              level: 1,
              title: p.title,
              note: p.note,
              branchColor: BRANCH_PALETTE[idx % BRANCH_PALETTE.length],
            });
          });
          return buildStatsResult(rootId, nodes, false);
        }
      }
      return buildStatsResult(rootId, nodes, isSeed);
    }

    // Multiple sentences in a single paragraph -> 1st sentence sets Root, others become branches with full notes!
    const rootParsed = splitTitleAndInlineNote(firstSentences[0]);
    rootTitle = rootParsed.title;
    rootNote = rootParsed.note;
    remainingUnits = firstSentences.slice(1);
  } else {
    // Multiple paragraphs: if Paragraph 1 is short (< 72 chars), it's the pure Root Title!
    if (firstPara.length <= 72 && firstSentences.length === 1) {
      const rootParsed = splitTitleAndInlineNote(firstPara);
      rootTitle = rootParsed.title;
      rootNote = rootParsed.note;
      remainingUnits = paragraphs.slice(1);
    } else {
      const rootParsed = splitTitleAndInlineNote(firstSentences[0]);
      rootTitle = rootParsed.title;
      rootNote = firstSentences.slice(1).join(' ') || rootParsed.note;
      remainingUnits = paragraphs.slice(1);
    }
  }

  nodes.push({
    id: rootId,
    parentId: null,
    level: 0,
    title: rootTitle,
    note: rootNote,
    branchColor: BRANCH_PALETTE[0],
  });

  remainingUnits.slice(0, 12).forEach((unit, pIdx) => {
    const sentences = splitSentences(unit);
    const leadParsed = splitTitleAndInlineNote(sentences[0] || unit);
    const branchColor = BRANCH_PALETTE[mainBranchIdx % BRANCH_PALETTE.length];
    mainBranchIdx++;

    const branchId = `gen_p_${pIdx + 1}`;
    const restSentences = sentences.slice(1);
    const branchNote =
      restSentences.length === 1
        ? appendNote(leadParsed.note, restSentences[0])
        : leadParsed.note;

    nodes.push({
      id: branchId,
      parentId: rootId,
      level: 1,
      title: leadParsed.title,
      note: branchNote || undefined,
      techBadge: leadParsed.techBadge,
      checked: leadParsed.checked,
      priorityTag: leadParsed.priorityTag,
      linkUrl: leadParsed.linkUrl,
      branchColor,
    });

    // If paragraph has 3+ sentences, turn subsequent sentences into child branches with their own descriptions!
    if (restSentences.length >= 2) {
      restSentences.slice(0, 5).forEach((s, sIdx) => {
        const sp = splitTitleAndInlineNote(s);
        nodes.push({
          id: `gen_p_${pIdx + 1}_s_${sIdx + 1}`,
          parentId: branchId,
          level: 2,
          title: sp.title,
          note: sp.note,
          techBadge: sp.techBadge,
          checked: sp.checked,
          priorityTag: sp.priorityTag,
          linkUrl: sp.linkUrl,
          branchColor,
        });
      });
    }
  });

  return buildStatsResult(rootId, nodes, false);
}

function buildStatsResult(
  rootId: string,
  nodes: ParsedOutlineNode[],
  isSingleTopicSeed: boolean
): ParsedOutlineResult {
  let mainBranches = 0;
  let subBranches = 0;
  let notedBranches = 0;
  let maxDepth = 0;

  for (const n of nodes) {
    if (n.level === 1) mainBranches++;
    if (n.level >= 2) subBranches++;
    if (n.note && n.note.trim().length > 0) notedBranches++;
    if (n.level > maxDepth) maxDepth = n.level;
  }

  return {
    rootId,
    nodes,
    stats: {
      totalNodes: nodes.length,
      mainBranches,
      subBranches,
      notedBranches,
      maxDepth,
    },
    isSingleTopicSeed,
  };
}

/**
 * Universal Intelligent Text -> Mind Map Parser:
 * - Supports Markdown headings (`#`, `##`, `###`), multi-level bullets (`-`, `*`, `•`, `1.1.1`),
 *   inline descriptions (`Başlık: Açıklama`, `Başlık - Açıklama`, `Başlık (uzun açıklama)`),
 *   explicit note lines (`Not:`, `Açıklama:`, `Örnek:`, `>`), checkboxes (`[x]`), badges (`[...]`),
 *   priority tags (`ÖNEMLİ`, `SINAV`), URLs, AND plain unformatted paragraphs!
 */
export function parseTextToMindMapOutline(rawInput: string): ParsedOutlineResult {
  const trimmedAll = rawInput.trim();
  if (!trimmedAll) {
    return buildStatsResult(
      'root',
      [
        {
          id: 'root',
          parentId: null,
          level: 0,
          title: 'Akademik Zihin Haritası',
          branchColor: BRANCH_PALETTE[0],
        },
      ],
      true
    );
  }

  const rawLines = rawInput.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const classified = rawLines.map(classifyLine);

  // Detect whether input is structured (headings, bullets, numbered lists, note lines, or indentation)
  const hasStructure = classified.some(
    (c, idx) =>
      c.kind === 'heading' ||
      c.kind === 'bullet' ||
      c.kind === 'numbered' ||
      c.kind === 'note' ||
      (idx > 0 && c.indent >= 2)
  );

  // If plain prose (no bullets/headings/indents) and either 1 line or paragraph blocks -> use smart prose extractor
  if (!hasStructure) {
    const looksLikeShortLineList =
      rawLines.length >= 3 && rawLines.every((l) => l.trim().length <= 75);
    if (!looksLikeShortLineList) {
      return parseProseTextToMindMap(rawInput);
    }
  }

  const rootId = 'root';
  const nodes: ParsedOutlineNode[] = [];
  let mainBranchIdx = 0;

  // Determine root line: first line becomes root unless line 0 is a bullet/numbered item with multiple siblings
  const first = classified[0];
  let startIdx = 1;
  let rootParsed: ReturnType<typeof splitTitleAndInlineNote>;

  if (
    (first.kind === 'bullet' || first.kind === 'numbered') &&
    classified.length >= 2 &&
    classified[1].kind === first.kind &&
    classified[1].indent === first.indent
  ) {
    // User pasted a pure list without a title line -> synthesize clean root from first item or generic heading
    rootParsed = { title: 'Zihin Haritası Özeti' };
    startIdx = 0;
  } else {
    rootParsed = splitTitleAndInlineNote(first.content);
  }

  const rootNode: ParsedOutlineNode = {
    id: rootId,
    parentId: null,
    level: 0,
    title: rootParsed.title || 'Zihin Haritası',
    note: rootParsed.note,
    techBadge: rootParsed.techBadge,
    checked: rootParsed.checked,
    priorityTag: rootParsed.priorityTag,
    linkUrl: rootParsed.linkUrl,
    branchColor: BRANCH_PALETTE[0],
  };
  nodes.push(rootNode);

  if (classified.length === 1 && startIdx === 1) {
    const isSeed = !rootNode.note && first.content.length <= 64;
    return buildStatsResult(rootId, nodes, isSeed);
  }

  // Stack of `{ node, rank }` to support arbitrary nesting depth (1, 2, 3, 4+ levels!)
  const stack: Array<{ node: ParsedOutlineNode; rank: number }> = [
    { node: rootNode, rank: -1 },
  ];
  let lastCreatedNode: ParsedOutlineNode = rootNode;
  let activeHeadingRank = 0;

  for (let i = startIdx; i < classified.length; i++) {
    const line = classified[i];

    // 1. Explicit Note / Description line (`Not:`, `Açıklama:`, `Örnek:`, `> ...`) -> attach directly to `lastCreatedNode.note`!
    if (line.kind === 'note') {
      lastCreatedNode.note = appendNote(lastCreatedNode.note, line.content);
      continue;
    }

    // 2. Plain explanatory sentence line immediately under a heading / numbered / bullet node -> attach cleanly to `lastCreatedNode.note`!
    // Recognizes Turkish/English declarative sentences (ending in `.`/`!`, Turkish predicates like `-dir/-dır/-tir/-sağlar/-oluşur/-denir/-üretir`, or indented prose)
    const looksLikeDeclarativeExplanation =
      line.kind === 'plain' &&
      !line.content.includes(':') &&
      (line.indent >= 2 ||
        line.content.length > 54 ||
        /[.!?]$/.test(line.content) ||
        /\b(?:dir|dır|tir|tır|dur|dür|tur|tür|sağlar|saglar|oluşur|olusur|denir|verilir|bulunur|yapılır|yapilir|kullanılır|kullanilir|gösterir|gosterir|edilir|üretir|uretir|taşır|tasir|korur|düzenler|duzenler|içerir|icerir|ayrılır|ayrilir|is|are|was|were|provides|contains)\b/i.test(
          line.content
        ) ||
        /(?:dir|dır|tir|tır|dur|dür|tur|tür|mektedir|maktadır|lidir|lıdır|sidir|sıdır)[.!]?$/i.test(
          line.content
        ));

    if (looksLikeDeclarativeExplanation && lastCreatedNode.id !== rootId) {
      lastCreatedNode.note = appendNote(lastCreatedNode.note, line.content);
      continue;
    }

    const parsed = splitTitleAndInlineNote(line.content);
    if (!parsed.title) continue;

    // Compute hierarchical rank from heading depth, dotted number depth, or indentation
    let rank: number;
    if (line.kind === 'heading') {
      rank = Math.max(0, (line.headingDepth - 1) * 10);
      activeHeadingRank = rank;
    } else if (line.kind === 'numbered') {
      rank = activeHeadingRank + line.numberedDepth * 4 + Math.floor(line.indent / 2);
    } else if (line.kind === 'bullet') {
      rank = activeHeadingRank + 4 + Math.floor(line.indent / 2) * 3;
    } else {
      // Plain top-level heading/item
      rank = line.indent >= 2 ? activeHeadingRank + 6 + Math.floor(line.indent / 2) : 0;
    }

    while (stack.length > 1 && stack[stack.length - 1].rank >= rank) {
      stack.pop();
    }

    const parentEntry = stack[stack.length - 1];
    const parentNode = parentEntry.node;
    const level = parentNode.level + 1;

    let branchColor: string;
    if (parentNode.id === rootId) {
      branchColor = BRANCH_PALETTE[mainBranchIdx % BRANCH_PALETTE.length];
      mainBranchIdx++;
    } else {
      branchColor = parentNode.branchColor;
    }

    const newNode: ParsedOutlineNode = {
      id: `gen_${i}`,
      parentId: parentNode.id,
      level,
      title: parsed.title,
      note: parsed.note,
      techBadge: parsed.techBadge,
      checked: parsed.checked,
      priorityTag: parsed.priorityTag,
      linkUrl: parsed.linkUrl,
      branchColor,
    };

    nodes.push(newNode);
    stack.push({ node: newNode, rank });
    lastCreatedNode = newNode;
  }

  return buildStatsResult(rootId, nodes, false);
}

// =============================================================================
// LECTURE NOTE -> STRUCTURED MIND MAP FORMAT CONVERTER (100% Offline, TR + EN)
// Turns messy copied textbooks, PDFs, slides, or raw paragraphs into clean,
// editable ZihinHaritam outline syntax (`- Ana Dal` / `  - Alt Dal: Açıklama [Rozet]`).
// =============================================================================

export type LectureNoteDepth = 'compact' | 'balanced' | 'detailed';

export interface LectureNoteConversionOptions {
  depth?: LectureNoteDepth;
}

export interface LectureNoteConversionResult {
  formattedOutline: string;
  stats: {
    totalNodes: number;
    mainBranches: number;
    subBranches: number;
    notedBranches: number;
    badgesCount: number;
  };
}

const TURKISH_ACRONYMS = new Set([
  'EKG', 'EEG', 'EMG', 'MRI', 'MR', 'BT', 'USG', 'DNA', 'RNA', 'ATP', 'ADP', 'NADH', 'FADH',
  'SA', 'AV', 'QRS', 'ST', 'PR', 'QT', 'CO2', 'O2', 'H2O', 'PH', 'HB', 'RBC', 'WBC', 'LDL', 'HDL',
  'TUS', 'YKS', 'TYT', 'AYT', 'KPSS', 'HMGS', 'ALES', 'YDS', 'DGS', 'LGS', 'TBMM', 'TCK', 'TMK', 'HMK', 'CMK', 'AYM',
  'CPU', 'GPU', 'RAM', 'ROM', 'SSD', 'API', 'REST', 'SQL', 'NOSQL', 'HTTP', 'HTTPS', 'TCP', 'UDP', 'IP', 'OSI', 'NAT', 'VPN', 'DHCP', 'ARP', 'ICMP', 'BGP', 'MAC', 'LAN', 'WAN', 'VLAN', 'DNS', 'CDN', 'WAF', 'JWT', 'SSL', 'TLS', 'SSH', 'PLC', 'SCADA', 'FPGA', 'CNC', 'AC', 'DC', 'LED', 'MOSFET', 'CI', 'CD', 'AI', 'ML', 'LLM', 'UI', 'UX', 'PDF', 'SVG', 'PNG', 'HTML', 'CSS', 'JS', 'TS',
]);

const PAGE_NOISE_LINE_RE =
  /^(?:sayfa\s*\d+(?:\s*\/\s*\d+)?|slayt\s*\d+|s\.\s*\d+|page\s*\d+(?:\s*of\s*\d+)?|[-–—•*.\s]*\d+(?:\s*\/\s*\d+)?[-–—•*.\s]*)$/i;

const QUANT_BADGE_RE =
  /\b(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:atım\/dk|cm²|cm2|mm²|mmHg|mg\/dL|mmol\/L|mL\/dk|m\/s|km\/s|mV|kV|V|mA|kΩ|Ω|Hz|kHz|MHz|GHz|ms|sn|saniye|dakika|dk|saat|gün|yıl|yüzyıl|yy\.?|akçe|kcal|kg|gr|mg|lt|mL|DPI|GB|MB|KB|TB|bit|byte|Mbps|Gbps)|%\s*\d+(?:[.,]\d+)?|(?:Port|Katman|Layer|Madde|Md\.?)\s*\d+|pH\s*\d+(?:[.,]\d+)?|O\([^)]{1,14}\))\b/i;

const CONTEXTUAL_EXTRA_NOTE_RE =
  /^(?:not\s*:|ipucu\s*:|dikkat\s*:|unutma\s*:|örneğin\b|mesela\b|örnek\s+olarak\b|ancak\b|fakat\b|oysa\b|buna\s+karşın\b|öte\s+yandan\b|ayrıca\b|ek\s+olarak\b|istisna\s*:|normal\s+süresi\b|bu\s+sayede\b|bunun\s+sonucunda\b|for\s+example\b|note\s*:|however\b)/i;

const TR_PREDICATE_SPLIT_RE =
  /\s+(?:ise|denir|olarak\s+adlandırılır|olarak\s+bilinir|temsil\s+eder|gösterir|sağlar|oluşturur|oluşur|meydana\s+getirir|bulunur|yer\s+alır|gerçekleşir|kullanılır|görev\s+yapar|çalışır|başlar|ulaşır|yayılır|yönetir|düzenler|kontrol\s+eder|korur|taşır|üretir|içerir|kapsar|ifade\s+eder|anlamına\s+gelir|anlatır|tanımlanır|ayrılır|bölünür)\b/i;

const ENUM_TRIGGER_RE =
  /(?:olmak\s+üzere|şunlardır|başlıca|örnekleri|evreleri|aşamaları|türleri|çeşitleri|kısımları|bölümleri|katmanları|grupları|sınıfları|unsurları|ilkeleri|özellikleri|ayrılır|oluşur|bölünür)/i;

function smartTurkishCase(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  // Convert ALL-CAPS headers (e.g., "KARDİYAK İLETİM SİSTEMİ") to clean Title Case while keeping acronyms!
  const letters = clean.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  const isMostlyUpper =
    letters.length >= 4 &&
    letters === letters.toLocaleUpperCase('tr-TR');

  if (isMostlyUpper) {
    return clean
      .split(/\s+/)
      .map((w, idx) => {
        const bare = w.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/g, '');
        if (TURKISH_ACRONYMS.has(bare.toUpperCase())) return w.toUpperCase();
        const lower = w.toLocaleLowerCase('tr-TR');
        if (idx > 0 && /^(ve|veya|ile|de|da|ki|için|göre|ya)$/.test(lower)) {
          return lower;
        }
        return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
      })
      .join(' ');
  }

  return clean.charAt(0).toLocaleUpperCase('tr-TR') + clean.slice(1);
}

function cleanPdfAndRawText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Rejoin hyphenated PDF line breaks (`kardiyo-\ngrafi` -> `kardiyografi`)
    .replace(/([a-zçğıöşüA-ZÇĞİÖŞÜ])-\n([a-zçğıöşü])/g, '$1$2')
    // Normalize exotic bullets
    .replace(/^(\s*)[●○❖➢➣➤►▸▪▫◦»✓✔]\s*/gm, '$1- ')
    // Strip markdown bold/italic noise
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Remove standalone page-number lines
    .split('\n')
    .filter((line) => !PAGE_NOISE_LINE_RE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitCleanSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9"“‘(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

const TR_SUBJECT_HEAD_RE =
  /^([A-ZÇĞİÖŞÜa-zçğıöşü0-9/-]+(?:\s+\([A-ZÇĞİÖŞÜ0-9/-]{1,12}\))?(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü0-9/-]+){0,3}\s+(?:dalgası|kompleksi|düğümü|düğüm|düğümden|düğüme|sistemi|kapağı|kapak|evresi|evresinde|aşaması|aşamasında|hücreleri|hücrelerinde|hücresi|bölünmesi|bölünme|uyarısı|kanunu|mahkemesi|yapısı|katmanı|katmanında|servisi|dönemi|savaşı|antlaşması|yasası|teorisi|teoremi|denklemi|ilkesi|etkisi|süreci|merkezi|organı|dokusu|hormonu|enzimi|reaksiyonu|lifleri|demeti|toprakları|sahipleri|yöntemi|modeli|algoritması|protokolü|tüneli|yönlendiricisi|anahtarı|direnci|kondansatörü|transistörü|pistonu|türbini|kirişi|kolonu|reaktörü|molekülü|damarı|siniri|mekanizması|fonksiyonu|görevi|özelliği|kuralı|kavramı))\s+(.{8,})$/i;

const TR_PAREN_CONCEPT_RE =
  /\b([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)?\s*\([A-ZÇĞİÖŞÜ0-9]{1,8}\)\s*[a-zçğıöşüA-ZÇĞİÖŞÜ]+)/;

const ENUM_LEAD_NOISE_RE =
  /^(?:(?:başlıca|temel|genel|örneğin|bunlar|şunlardır)\s+)?(?:(?:dalgalar|evreler|aşamalar|türler|çeşitler|kısımlar|bölümler|katmanlar|gruplar|unsurlar|ilkeler|özellikler|şunlardır)\s+)?/i;

const ENUM_TAIL_NOISE_RE =
  /\s+(?:olarak\s+(?:incelenir|adlandırılır|bilinir|ayrılır|sıralanır|sınıflandırılır)|şeklinde\s+(?:sıralanır|incelenir|ayrılır|gruplanır)|gibi\s+(?:sıralanabilir|örnekler)|olmak\s+üzere.*|denir|bulunur|yer\s+alır).*$/i;

function extractBadgeAndPriority(sentence: string): {
  cleaned: string;
  badge?: string;
  priority?: 'SINAV' | 'ÖNEMLİ';
} {
  let s = sentence.trim();
  let badge: string | undefined;
  let priority: 'SINAV' | 'ÖNEMLİ' | undefined;

  const existingBracket = s.match(/\[([^\]]{1,36})\]/);
  if (existingBracket) {
    const val = existingBracket[1].trim();
    if (/^(?:sınav|sinav|exam)$/i.test(val)) {
      priority = 'SINAV';
    } else if (/^(?:önemli|onemli|important)$/i.test(val)) {
      priority = 'ÖNEMLİ';
    } else {
      badge = val;
    }
    s = s.replace(existingBracket[0], '').replace(/\s+/g, ' ').trim();
  }

  if (!priority) {
    if (/(?:sınavda\s+çıkar|sinavda\s+cikar|sınav\s+sorusu|tus'ta|yks'de|vizede\s+çıkar)/i.test(s)) {
      priority = 'SINAV';
      s = s
        .replace(/\(\s*(?:sınavda\s+çıkar|sinavda\s+cikar|sınav\s+sorusu)\s*\)/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.!?])/g, '$1')
        .trim();
    } else if (/(?:^|\b)(?:çok\s+önemli|kritik\s+nokta|dikkat\s*:|unutma\s*:)/i.test(s)) {
      priority = 'ÖNEMLİ';
      s = s
        .replace(/\(\s*(?:çok\s+önemli|kritik|dikkat)\s*\)/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.!?])/g, '$1')
        .trim();
    }
  }

  if (!badge) {
    const qm = s.match(QUANT_BADGE_RE);
    if (qm) {
      badge = qm[1].replace(/\s+/g, ' ').trim();
    }
  }

  return { cleaned: s, badge, priority };
}

function formatLineWithMeta(
  indentSpaces: number,
  title: string,
  note?: string,
  badge?: string,
  priority?: 'SINAV' | 'ÖNEMLİ'
): string {
  const pad = ' '.repeat(indentSpaces);
  const cleanTitle = smartTurkishCase(title.replace(/[:;,.–—-]+$/, '').trim());
  const cleanNote = note
    ? note
        .replace(/^[:;,\-–—\s]+/, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
  const suffixParts: string[] = [];
  if (badge && !cleanTitle.toLowerCase().includes(badge.toLowerCase())) {
    suffixParts.push(`[${badge}]`);
  }
  if (priority) {
    suffixParts.push(`[${priority}]`);
  }
  const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(' ')}` : '';
  if (cleanNote && cleanNote.toLowerCase() !== cleanTitle.toLowerCase()) {
    const capNote = cleanNote.charAt(0).toLocaleUpperCase('tr-TR') + cleanNote.slice(1);
    return `${pad}- ${cleanTitle}: ${capNote}${suffix}`;
  }
  return `${pad}- ${cleanTitle}${suffix}`;
}

/**
 * Extracts a concise 2-5 word mind-map branch title and clean explanation note from any Turkish/English sentence.
 */
function decomposeSentenceToBranch(rawSentence: string): {
  title: string;
  note?: string;
  badge?: string;
  priority?: 'SINAV' | 'ÖNEMLİ';
  enumItems?: string[];
} {
  const { cleaned, badge, priority } = extractBadgeAndPriority(rawSentence);
  const s = cleaned.replace(/^[-*•–—]\s*/, '').trim();

  // 1. Explicit `Başlık: Açıklama` or `Başlık — Açıklama`
  const colonIdx = s.search(/(?<!\d):(?!\d|\/\/)/);
  if (colonIdx >= 2 && colonIdx <= 60) {
    const left = s.slice(0, colonIdx).trim();
    const right = s.slice(colonIdx + 1).trim();
    // Check if right side is a clean list (`Profaz, Metafaz, Anafaz ve Telofaz`)
    const maybeItems = extractEnumerationItems(right);
    if (maybeItems && maybeItems.length >= 2) {
      return { title: left, badge, priority, enumItems: maybeItems };
    }
    return { title: left, note: right || undefined, badge, priority };
  }

  const dashMatch = s.match(/^(.{2,52}?)\s+(?:—|–|->|=>|-(?=\s))\s+(.{4,})$/);
  if (dashMatch) {
    const maybeItems = extractEnumerationItems(dashMatch[2].trim());
    if (maybeItems && maybeItems.length >= 2) {
      return { title: dashMatch[1].trim(), badge, priority, enumItems: maybeItems };
    }
    return { title: dashMatch[1].trim(), note: dashMatch[2].trim(), badge, priority };
  }

  // 2. Enumeration sentence (`Dirlik toprakları ... Has, Zeamet ve Tımar olmak üzere üçe ayrılır`)
  if (ENUM_TRIGGER_RE.test(s)) {
    const inlineEnum = extractInlineSentenceEnumeration(s);
    if (inlineEnum) {
      return {
        title: inlineEnum.parentTitle,
        note: inlineEnum.parentNote,
        badge,
        priority,
        enumItems: inlineEnum.items,
      };
    }
  }

  // 3. Short clean phrase (already a concise branch title)
  if (s.length <= 48 && !/[.!?]$/.test(s)) {
    return { title: s, badge, priority };
  }

  // 3b. Turkish academic subject-phrase split (`P dalgası atriyal depolarizasyonu gösterir.` -> `P Dalgası` + note!)
  const subjMatch = s.match(TR_SUBJECT_HEAD_RE);
  if (subjMatch) {
    const rawSubj = subjMatch[1].trim();
    const restNote = subjMatch[2].replace(/^(?:ise|de|da)\s+/i, '').trim();
    if (rawSubj.length >= 3 && rawSubj.length <= 44 && restNote.length >= 8) {
      const cleanSubj = rawSubj
        .replace(/\bdüğümden\b/i, 'Düğüm')
        .replace(/\bdüğüme\b/i, 'Düğüm')
        .replace(/\bevresinde\b/i, 'Evresi')
        .replace(/\başamasında\b/i, 'Aşaması');
      return {
        title: cleanSubj,
        note: restNote,
        badge,
        priority,
      };
    }
  }

  // 3c. Explicit parenthetical academic concept (`sinoatriyal (SA) düğümden` -> `Sinoatriyal (SA) Düğüm`)
  const parenConcept = s.match(TR_PAREN_CONCEPT_RE);
  if (parenConcept) {
    const conceptTitle = parenConcept[1]
      .replace(/düğümden$/i, 'Düğüm')
      .replace(/düğüme$/i, 'Düğüm')
      .replace(/düğümü$/i, 'Düğüm')
      .trim();
    if (conceptTitle.length >= 5 && conceptTitle.length <= 42) {
      return {
        title: conceptTitle,
        note: s,
        badge,
        priority,
      };
    }
  }

  // 4. Turkish Subject + Predicate split (ONLY when left side is a crisp 1-3 word subject, NEVER swallowing objects!)
  const predMatch = s.match(TR_PREDICATE_SPLIT_RE);
  if (predMatch && predMatch.index !== undefined && predMatch.index >= 4) {
    const subjectPart = s.slice(0, predMatch.index).trim();
    const subjWords = subjectPart.split(/\s+/);
    const rest = s.slice(predMatch.index).replace(/^\s*ise\s+/i, '').trim();
    if (subjWords.length >= 1 && subjWords.length <= 3 && subjectPart.length <= 34 && rest.split(/\s+/).length >= 3) {
      return {
        title: subjectPart,
        note: rest,
        badge,
        priority,
      };
    }
  }

  // 5. Comma clause lead (`17. yüzyıldan itibaren merkez hazinenin..., ...`)
  const commaIdx = s.indexOf(',');
  if (commaIdx >= 6 && commaIdx <= 44) {
    const lead = s.slice(0, commaIdx).trim();
    const tail = s.slice(commaIdx + 1).trim();
    if (lead.split(/\s+/).length <= 5 && tail.length >= 8) {
      return { title: lead, note: tail, badge, priority };
    }
  }

  // 6. Fallback: crisp 3-5 word lead phrase (never cut mid-parenthesis!) + full sentence in note
  const words = s.replace(/[.!?]+$/, '').split(/\s+/);
  if (words.length <= 5) {
    return { title: s.replace(/[.!?]+$/, ''), badge, priority };
  }
  const titleWords = words.slice(0, Math.min(4, words.length));
  // Avoid ending title on weak Turkish connector words or unclosed parenthesis
  while (
    titleWords.length > 2 &&
    (/^(ve|veya|ile|bir|bu|şu|o|için|göre|olarak|olan|ancak|fakat|daha|en|her|de|da|ki)$/i.test(
      titleWords[titleWords.length - 1]
    ) ||
      titleWords[titleWords.length - 1].includes('('))
  ) {
    titleWords.pop();
  }
  return {
    title: titleWords.join(' '),
    note: s,
    badge,
    priority,
  };
}

function extractEnumerationItems(listText: string): string[] | null {
  let clean = listText
    .replace(/[.!?]+$/, '')
    .replace(ENUM_LEAD_NOISE_RE, '')
    .replace(ENUM_TAIL_NOISE_RE, '')
    .trim();
  if (!clean.includes(',') && !clean.includes(';')) return null;
  const parts = clean
    .split(/\s*(?:,|;|\bve\b|\bveya\b)\s*/i)
    .map((p) =>
      p
        .replace(ENUM_LEAD_NOISE_RE, '')
        .replace(ENUM_TAIL_NOISE_RE, '')
        .trim()
    )
    .filter((p) => p.length >= 2 && p.length <= 40 && p.split(/\s+/).length <= 4);
  if (parts.length >= 2 && parts.length <= 8) {
    return parts;
  }
  return null;
}

function extractInlineSentenceEnumeration(sentence: string): {
  parentTitle: string;
  parentNote?: string;
  items: string[];
} | null {
  // Pattern: `... A, B ve C olmak üzere ...`
  const olmakMatch = sentence.match(/^(.+?)\b([A-ZÇĞİÖŞÜa-zçğıöşü0-9\s-]{2,36}(?:,\s*[A-ZÇĞİÖŞÜa-zçğıöşü0-9\s-]{2,36})+\s+ve\s+[A-ZÇĞİÖŞÜa-zçğıöşü0-9\s-]{2,36})\s+olmak\s+üzere/i);
  if (olmakMatch) {
    const items = extractEnumerationItems(olmakMatch[2]);
    if (items && items.length >= 2) {
      const leadWords = olmakMatch[1].trim().split(/\s+/).slice(0, 4).join(' ');
      return {
        parentTitle: leadWords || 'Temel Bileşenler',
        parentNote: sentence,
        items,
      };
    }
  }
  return null;
}

/**
 * Converts ANY raw copied Turkish/English lecture note, PDF excerpt, slide deck, or multi-paragraph text
 * into clean, structured, immediately editable ZihinHaritam outline syntax:
 * ```
 * Ana Konu
 * - Ana Dal
 *   - Alt Kavram: Kısa net açıklama [Rozet]
 * ```
 */
export function convertLectureNoteToMindMapFormat(
  rawLectureNote: string,
  options?: LectureNoteConversionOptions
): LectureNoteConversionResult {
  const depth: LectureNoteDepth = options?.depth ?? 'balanced';
  const maxSubsPerSection = depth === 'compact' ? 3 : depth === 'detailed' ? 10 : 6;
  const maxParagraphs = depth === 'compact' ? 6 : depth === 'detailed' ? 14 : 9;

  const cleaned = cleanPdfAndRawText(rawLectureNote);
  if (!cleaned) {
    return {
      formattedOutline: '',
      stats: { totalNodes: 0, mainBranches: 0, subBranches: 0, notedBranches: 0, badgesCount: 0 },
    };
  }

  const rawLines = cleaned.split('\n');
  const nonEmptyLines = rawLines.map((l) => l.trim()).filter(Boolean);

  // Detect whether input already has explicit structure (headings / numbers / bullets / `Title:` short headers)
  const classifiedLines = rawLines
    .filter((l) => l.trim().length > 0)
    .map((l) => classifyLine(l));

  const structuredLineCount = classifiedLines.filter(
    (c) =>
      c.kind === 'heading' ||
      c.kind === 'numbered' ||
      c.kind === 'bullet' ||
      c.kind === 'note' ||
      /^[IVX]+\.\s+/.test(c.trimmed)
  ).length;

  const isMostlyStructured =
    structuredLineCount >= 2 ||
    (nonEmptyLines.length >= 4 && structuredLineCount >= 1);

  const outputLines: string[] = [];
  let badgesCount = 0;

  const trackBadge = (b?: string) => {
    if (b) badgesCount++;
  };

  const emitExtraNoteLine = (indentSpaces: number, rawSent: string) => {
    const noteBody = rawSent
      .replace(/^(?:not|ipucu|dikkat|unutma|istisna|note)\s*[:\-–—]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!noteBody) return;
    const pad = ' '.repeat(Math.min(4, indentSpaces + 2));
    outputLines.push(`${pad}Not: ${noteBody}`);
  };

  if (isMostlyStructured) {
    // STRUCTURED / MIXED LECTURE NOTE MODE
    let startIdx = 0;
    const firstLine = classifiedLines[0];
    let rootTitle = 'Ders Notu Haritası';

    if (
      firstLine &&
      (firstLine.kind === 'heading' ||
        (firstLine.kind === 'plain' && firstLine.content.length <= 72))
    ) {
      const firstClean = firstLine.content.replace(/^(?:[IVX]+|\d+)[.)]\s+/, '').trim();
      const dec = decomposeSentenceToBranch(firstClean);
      rootTitle = smartTurkishCase(dec.title);
      startIdx = 1;
    } else if (firstLine) {
      const dec = decomposeSentenceToBranch(firstLine.content);
      rootTitle = smartTurkishCase(dec.title);
      startIdx = 1;
    }

    outputLines.push(rootTitle);
    let currentMainActive = false;

    for (let i = startIdx; i < classifiedLines.length; i++) {
      const line = classifiedLines[i];
      const romanMatch = line.trimmed.match(/^([IVX]+)[.)]\s+(.+)$/);

      if (line.kind === 'heading' || romanMatch) {
        const txt = romanMatch ? romanMatch[2].trim() : line.content;
        const depth = romanMatch ? 1 : Math.max(1, line.headingDepth - 1);
        const dec = decomposeSentenceToBranch(txt);
        trackBadge(dec.badge);
        const indent = depth <= 1 ? 0 : 2;
        outputLines.push(formatLineWithMeta(indent, dec.title, dec.note, dec.badge, dec.priority));
        if (dec.enumItems) {
          for (const item of dec.enumItems) {
            outputLines.push(formatLineWithMeta(indent + 2, item));
          }
        }
        currentMainActive = true;
        continue;
      }

      if (line.kind === 'numbered') {
        const dec = decomposeSentenceToBranch(line.content);
        trackBadge(dec.badge);
        const indent = line.numberedDepth <= 1 && line.indent < 2 ? 0 : Math.min(4, (line.numberedDepth - 1) * 2 + (line.indent >= 2 ? 2 : 0));
        outputLines.push(formatLineWithMeta(indent, dec.title, dec.note, dec.badge, dec.priority));
        if (dec.enumItems) {
          for (const item of dec.enumItems) {
            outputLines.push(formatLineWithMeta(Math.min(4, indent + 2), item));
          }
        }
        if (indent === 0) currentMainActive = true;
        continue;
      }

      if (line.kind === 'note') {
        const noteText = line.content.replace(/^(?:not|açıklama|detay|örnek|tanım|formül|ipucu|özet)\s*[:\-–—]\s*/i, '').trim();
        if (noteText) {
          outputLines.push(`    Not: ${noteText}`);
        }
        continue;
      }

      if (line.kind === 'bullet') {
        const sentences = splitCleanSentences(line.content);
        const indent = currentMainActive
          ? line.indent >= 4
            ? 4
            : 2
          : line.indent >= 2
          ? 2
          : 0;

        if (sentences.length <= 1) {
          const dec = decomposeSentenceToBranch(line.content);
          trackBadge(dec.badge);
          outputLines.push(formatLineWithMeta(indent, dec.title, dec.note, dec.badge, dec.priority));
          if (dec.enumItems) {
            for (const item of dec.enumItems) {
              outputLines.push(formatLineWithMeta(Math.min(4, indent + 2), item));
            }
          }
        } else {
          const lead = decomposeSentenceToBranch(sentences[0]);
          trackBadge(lead.badge);
          outputLines.push(formatLineWithMeta(indent, lead.title, lead.note, lead.badge, lead.priority));
          for (const extra of sentences.slice(1, 4)) {
            const sub = decomposeSentenceToBranch(extra);
            trackBadge(sub.badge);
            outputLines.push(formatLineWithMeta(Math.min(4, indent + 2), sub.title, sub.note, sub.badge, sub.priority));
          }
        }
        if (indent === 0) currentMainActive = true;
        continue;
      }

      // Plain line or paragraph inside a structured lecture note
      const isShortHeader =
        line.content.length <= 54 &&
        !/[.!?]$/.test(line.content) &&
        (line.content.endsWith(':') ||
          line.content === line.content.toLocaleUpperCase('tr-TR') ||
          !line.content.includes(','));

      if (isShortHeader) {
        const dec = decomposeSentenceToBranch(line.content);
        trackBadge(dec.badge);
        outputLines.push(formatLineWithMeta(0, dec.title, dec.note, dec.badge, dec.priority));
        currentMainActive = true;
      } else {
        // Multi-sentence paragraph sitting beneath a heading -> break each sentence into clean sub-branches or `Not:` extra notes!
        const sentences = splitCleanSentences(line.content);
        const indent = currentMainActive ? 2 : 0;
        for (const sent of sentences.slice(0, maxSubsPerSection)) {
          if (outputLines.length > 1 && CONTEXTUAL_EXTRA_NOTE_RE.test(sent)) {
            emitExtraNoteLine(indent, sent);
            continue;
          }
          const dec = decomposeSentenceToBranch(sent);
          trackBadge(dec.badge);
          outputLines.push(formatLineWithMeta(indent, dec.title, dec.note, dec.badge, dec.priority));
          if (dec.enumItems) {
            for (const item of dec.enumItems) {
              outputLines.push(formatLineWithMeta(Math.min(4, indent + 2), item));
            }
          }
        }
      }
    }
  } else {
    // PURE PROSE / PARAGRAPH LECTURE NOTE MODE (Zero bullets, copied straight from textbook/PDF!)
    const paragraphs = cleaned
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 1) {
      const sentences = splitCleanSentences(paragraphs[0]);
      if (sentences.length <= 1) {
        const dec = decomposeSentenceToBranch(paragraphs[0]);
        trackBadge(dec.badge);
        outputLines.push(smartTurkishCase(dec.title));
        if (dec.enumItems) {
          for (const item of dec.enumItems) {
            outputLines.push(formatLineWithMeta(0, item));
          }
        } else if (dec.note) {
          outputLines.push(formatLineWithMeta(0, dec.title, dec.note, dec.badge, dec.priority));
        }
      } else {
        const firstDec = decomposeSentenceToBranch(sentences[0]);
        trackBadge(firstDec.badge);
        outputLines.push(smartTurkishCase(firstDec.title));
        if (firstDec.note) {
          outputLines.push(formatLineWithMeta(0, 'Temel Tanım', firstDec.note, firstDec.badge, firstDec.priority));
        }
        for (const sent of sentences.slice(1, 10)) {
          const dec = decomposeSentenceToBranch(sent);
          trackBadge(dec.badge);
          outputLines.push(formatLineWithMeta(0, dec.title, dec.note, dec.badge, dec.priority));
          if (dec.enumItems) {
            for (const item of dec.enumItems) {
              outputLines.push(formatLineWithMeta(2, item));
            }
          }
        }
      }
    } else {
      // Multi-paragraph lecture note!
      const p0 = paragraphs[0];
      const p0Sentences = splitCleanSentences(p0);
      let startPara = 0;

      if (p0.length <= 74 && p0Sentences.length === 1 && !/[.!?]$/.test(p0)) {
        outputLines.push(smartTurkishCase(p0.replace(/[:–—-]+$/, '').trim()));
        startPara = 1;
      } else {
        const leadDec = decomposeSentenceToBranch(p0Sentences[0] || p0);
        outputLines.push(smartTurkishCase(leadDec.title));
        startPara = 0;
      }

      for (let pi = startPara; pi < Math.min(paragraphs.length, startPara + maxParagraphs); pi++) {
        const para = paragraphs[pi];
        const sentences = splitCleanSentences(para);
        if (sentences.length === 0) continue;

        const lead = decomposeSentenceToBranch(sentences[0]);
        trackBadge(lead.badge);

        // If paragraph has multiple sentences, first sentence's concept becomes Main Branch (`- ...`),
        // and each sentence becomes crisp Sub-Branches (`  - ...`) or contextual `    Not: ...`!
        if (sentences.length === 1) {
          outputLines.push(formatLineWithMeta(0, lead.title, lead.note, lead.badge, lead.priority));
          if (lead.enumItems) {
            for (const item of lead.enumItems) {
              outputLines.push(formatLineWithMeta(2, item));
            }
          }
        } else {
          const restSlice = sentences.slice(1, 1 + maxSubsPerSection);
          const subEntries = restSlice.map((extra) => ({
            raw: extra,
            isExtraNote: CONTEXTUAL_EXTRA_NOTE_RE.test(extra),
            dec: decomposeSentenceToBranch(extra),
          }));
          const coveredTitles = new Set(
            subEntries
              .filter((e) => !e.isExtraNote)
              .map((sd) => sd.dec.title.toLocaleLowerCase('tr-TR'))
          );

          const hasExplicitColonLead = /^[^:.]{2,48}:\s+/.test(sentences[0]);
          if (hasExplicitColonLead) {
            outputLines.push(formatLineWithMeta(0, lead.title, lead.enumItems ? undefined : lead.note, lead.badge, lead.priority));
            if (lead.enumItems) {
              for (const item of lead.enumItems) {
                const normItem = item.toLocaleLowerCase('tr-TR');
                const alreadyDescribed = Array.from(coveredTitles).some(
                  (ct) => ct === normItem || ct.startsWith(normItem) || normItem.startsWith(ct)
                );
                if (!alreadyDescribed) {
                  outputLines.push(formatLineWithMeta(2, item));
                }
              }
            }
          } else {
            outputLines.push(formatLineWithMeta(0, lead.title, lead.note, lead.badge, lead.priority));
            if (lead.enumItems) {
              for (const item of lead.enumItems) {
                const normItem = item.toLocaleLowerCase('tr-TR');
                const alreadyDescribed = Array.from(coveredTitles).some(
                  (ct) => ct === normItem || ct.startsWith(normItem) || normItem.startsWith(ct)
                );
                if (!alreadyDescribed) {
                  outputLines.push(formatLineWithMeta(2, item));
                }
              }
            }
          }

          for (const entry of subEntries) {
            if (entry.isExtraNote) {
              emitExtraNoteLine(2, entry.raw);
              continue;
            }
            const sub = entry.dec;
            trackBadge(sub.badge);
            outputLines.push(formatLineWithMeta(2, sub.title, sub.note, sub.badge, sub.priority));
            if (sub.enumItems) {
              for (const item of sub.enumItems) {
                outputLines.push(formatLineWithMeta(4, item));
              }
            }
          }
        }
      }
    }
  }

  const formattedOutline = outputLines.join('\n').trim();
  const parsedVerify = parseTextToMindMapOutline(formattedOutline);

  return {
    formattedOutline,
    stats: {
      totalNodes: parsedVerify.stats.totalNodes,
      mainBranches: parsedVerify.stats.mainBranches,
      subBranches: parsedVerify.stats.subBranches,
      notedBranches: parsedVerify.stats.notedBranches,
      badgesCount,
    },
  };
}
