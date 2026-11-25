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
