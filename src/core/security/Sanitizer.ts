import type {
  AcademicDepartment,
  CanvasInkStroke,
  CanvasStickyNote,
  CrossLink,
  MindMapDocument,
  MindNode,
  PaperStyleType,
  StickerAsset,
} from '../../types/mindmap';

const SAFE_HEX_OR_RGB_RE =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/;

const ALLOWED_DEPARTMENTS = new Set<AcademicDepartment>([
  'genel',
  'sistem_tasarimi',
  'tip',
  'muhendislik',
  'hukuk',
  'mimarlik',
  'temel_bilimler',
  'sosyal_bilimler',
]);

const ALLOWED_PAPER_STYLES = new Set<PaperStyleType>([
  'dots',
  'grid',
  'lined',
  'blank',
  'warm',
]);

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizeColor(color: unknown, fallback = '#0EA5E9'): string {
  if (typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  return SAFE_HEX_OR_RGB_RE.test(trimmed) ? trimmed : fallback;
}

/**
 * Strictly validates sticker/photo URLs to block `javascript:`, `vbscript:`, `data:text/html`,
 * and any unsafe protocol injection from imported `.zihin` backups or remote payloads.
 */
export function sanitizeVisualUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2_200_000) return null;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  if (trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (/^https:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:') return trimmed;
    } catch {
      return null;
    }
  }
  if (
    /^data:image\/(?:svg\+xml|png|jpeg|jpg|webp|gif)(?:;charset=[^;,]+)?(?:;base64)?,/i.test(
      trimmed
    )
  ) {
    // Reject embedded script or event handlers inside SVG data URIs
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('<script') ||
      lower.includes('%3cscript') ||
      lower.includes('javascript:') ||
      lower.includes('<foreignobject') ||
      lower.includes('%3cforeignobject') ||
      /\bon[a-z]+\s*=/.test(lower)
    ) {
      return null;
    }
    return trimmed;
  }

  return null;
}

/**
 * Strips potentially dangerous elements and event attributes from any raw SVG markup
 * before rendering or exporting into standalone SVG/PDF files.
 */
export function sanitizeSvgMarkup(rawSvg: string): string {
  if (typeof rawSvg !== 'string' || !rawSvg) return '';
  return rawSvg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(?:iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:xlink:)?href\s*=\s*["']\s*(?:javascript:|vbscript:|data:text\/html)[^"']*["']/gi, '')
    .replace(/url\(\s*["']?\s*(?:javascript:|data:text\/html)[^)]*\)/gi, 'none');
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.slice(0, maxLen);
}

function finiteNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeStickerAsset(raw: unknown): StickerAsset | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const safeUrl = sanitizeVisualUrl(r.url);
  if (!safeUrl) return undefined;

  const mode =
    r.mode === '3d' ||
    r.mode === 'diagram' ||
    r.mode === 'illustration' ||
    r.mode === 'photo'
      ? r.mode
      : 'illustration';
  const source =
    r.source === 'library' ||
    r.source === 'ai_pool' ||
    r.source === 'note_crop' ||
    r.source === 'sketch' ||
    r.source === 'user_photo'
      ? r.source
      : 'library';

  return {
    id: clampStr(r.id, 120, `st_${Date.now()}`),
    url: safeUrl,
    mode,
    source,
    dieCutProcessed: Boolean(r.dieCutProcessed),
    aspectRatio: Math.max(0.2, Math.min(5, finiteNum(r.aspectRatio, 1))),
    label: typeof r.label === 'string' ? clampStr(r.label, 80) : undefined,
    tags: Array.isArray(r.tags)
      ? r.tags.filter((t): t is string => typeof t === 'string').slice(0, 12).map((t) => t.slice(0, 32))
      : undefined,
    badgeEmoji: typeof r.badgeEmoji === 'string' ? clampStr(r.badgeEmoji, 8) : undefined,
    isVectorSvg: Boolean(r.isVectorSvg),
    iconifyId: typeof r.iconifyId === 'string' ? clampStr(r.iconifyId, 120) : undefined,
    rawSvgBody:
      typeof r.rawSvgBody === 'string' ? sanitizeSvgMarkup(r.rawSvgBody.slice(0, 48_000)) : undefined,
    rawViewBox:
      typeof r.rawViewBox === 'string' && /^[\d.\s-]+$/.test(r.rawViewBox)
        ? r.rawViewBox.slice(0, 40)
        : undefined,
    isDuotoneColorizable: Boolean(r.isDuotoneColorizable),
  };
}

/**
 * Safely parses & validates untrusted `.zihin` JSON documents:
 * - Blocks prototype pollution (`__proto__`, `constructor`, `prototype`)
 * - Bounds node, link, ink stroke, point, and sticky-note counts to prevent DoS / OOM
 * - Sanitizes every sticker URL, SVG body, and color value
 */
export function sanitizeImportedDocument(raw: unknown): MindMapDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const doc = raw as Record<string, unknown>;
  if (!doc.nodes || typeof doc.nodes !== 'object' || Array.isArray(doc.nodes)) return null;

  const rawNodes = doc.nodes as Record<string, unknown>;
  const safeNodes: Record<string, MindNode> = {};
  let nodeCount = 0;

  for (const [key, val] of Object.entries(rawNodes)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key) || !val || typeof val !== 'object') continue;
    if (nodeCount >= 600) break;
    const n = val as Record<string, unknown>;
    const id = clampStr(n.id || key, 80);
    if (!id || FORBIDDEN_OBJECT_KEYS.has(id)) continue;

    const stickerSize =
      n.stickerSize === 'sm' ||
      n.stickerSize === 'md' ||
      n.stickerSize === 'lg' ||
      n.stickerSize === 'xl'
        ? n.stickerSize
        : undefined;
    const priorityTag =
      n.priorityTag === 'important' ||
      n.priorityTag === 'exam' ||
      n.priorityTag === 'review'
        ? n.priorityTag
        : null;

    safeNodes[id] = {
      id,
      parentId:
        typeof n.parentId === 'string' && !FORBIDDEN_OBJECT_KEYS.has(n.parentId)
          ? clampStr(n.parentId, 80)
          : null,
      title: clampStr(n.title, 240, 'Konu'),
      subtitle: typeof n.subtitle === 'string' ? clampStr(n.subtitle, 400) : undefined,
      subtitleIsTemplateDefault: Boolean(n.subtitleIsTemplateDefault),
      note: typeof n.note === 'string' ? clampStr(n.note, 8000) : undefined,
      noteCollapsed: Boolean(n.noteCollapsed),
      checked: typeof n.checked === 'boolean' ? n.checked : null,
      priorityTag,
      techBadge: typeof n.techBadge === 'string' ? clampStr(n.techBadge, 80) : undefined,
      x: Math.max(-50_000, Math.min(50_000, finiteNum(n.x, 0))),
      y: Math.max(-50_000, Math.min(50_000, finiteNum(n.y, 0))),
      branchColor: sanitizeColor(n.branchColor, '#0EA5E9'),
      collapsed: Boolean(n.collapsed),
      sticker: sanitizeStickerAsset(n.sticker),
      nodeStyle:
        n.nodeStyle === 'card' || n.nodeStyle === 'organic' ? n.nodeStyle : undefined,
      stickerSize,
      examHidden: Boolean(n.examHidden),
      stickerUpdatedAt:
        typeof n.stickerUpdatedAt === 'number' ? finiteNum(n.stickerUpdatedAt) : undefined,
    };
    nodeCount += 1;
  }

  const rootId =
    typeof doc.rootNodeId === 'string' && safeNodes[doc.rootNodeId]
      ? doc.rootNodeId
      : Object.keys(safeNodes)[0];
  if (!rootId) return null;

  const safeCrossLinks: CrossLink[] = [];
  if (Array.isArray(doc.crossLinks)) {
    for (const item of doc.crossLinks.slice(0, 400)) {
      if (!item || typeof item !== 'object') continue;
      const cl = item as Record<string, unknown>;
      const fromId = clampStr(cl.fromNodeId, 80);
      const toId = clampStr(cl.toNodeId, 80);
      if (!safeNodes[fromId] || !safeNodes[toId]) continue;
      safeCrossLinks.push({
        id: clampStr(cl.id, 80, `cl_${safeCrossLinks.length}`),
        fromNodeId: fromId,
        toNodeId: toId,
        label: clampStr(cl.label, 120),
        color: sanitizeColor(cl.color, '#0EA5E9'),
        style: cl.style === 'solid_arrow' ? 'solid_arrow' : 'dashed_flow',
      });
    }
  }

  const safeInkStrokes: CanvasInkStroke[] = [];
  if (Array.isArray(doc.inkStrokes)) {
    const validInkTools = new Set(['pen', 'pencil', 'highlighter', 'line', 'arrow', 'rect', 'ellipse']);
    for (const item of doc.inkStrokes.slice(0, 1500)) {
      if (!item || typeof item !== 'object') continue;
      const st = item as Record<string, unknown>;
      const tool = typeof st.tool === 'string' && validInkTools.has(st.tool) ? st.tool : 'pen';
      if (!Array.isArray(st.points) || st.points.length === 0) continue;
      const safePts: Array<[number, number, number]> = [];
      for (const pt of st.points.slice(0, 2500)) {
        if (Array.isArray(pt) && pt.length >= 2) {
          safePts.push([
            Math.max(-50_000, Math.min(50_000, finiteNum(pt[0], 0))),
            Math.max(-50_000, Math.min(50_000, finiteNum(pt[1], 0))),
            Math.max(0.05, Math.min(1, finiteNum(pt[2], 0.5))),
          ]);
        }
      }
      if (safePts.length === 0) continue;
      safeInkStrokes.push({
        id: clampStr(st.id, 80, `ink_${safeInkStrokes.length}`),
        tool: tool as CanvasInkStroke['tool'],
        color: sanitizeColor(st.color, '#0F172A'),
        width: Math.max(1, Math.min(60, finiteNum(st.width, 4))),
        opacity: Math.max(0.1, Math.min(1, finiteNum(st.opacity, 0.96))),
        points: safePts,
      });
    }
  }

  const safeStickies: CanvasStickyNote[] = [];
  if (Array.isArray(doc.stickyNotes)) {
    for (const item of doc.stickyNotes.slice(0, 120)) {
      if (!item || typeof item !== 'object') continue;
      const sn = item as Record<string, unknown>;
      safeStickies.push({
        id: clampStr(sn.id, 80, `sticky_${safeStickies.length}`),
        x: Math.max(-50_000, Math.min(50_000, finiteNum(sn.x, 0))),
        y: Math.max(-50_000, Math.min(50_000, finiteNum(sn.y, 0))),
        text: clampStr(sn.text, 2000),
        color: sanitizeColor(sn.color, '#FEF08A'),
        width: Math.max(140, Math.min(420, finiteNum(sn.width, 204))),
      });
    }
  }

  const dept =
    typeof doc.department === 'string' && ALLOWED_DEPARTMENTS.has(doc.department as AcademicDepartment)
      ? (doc.department as AcademicDepartment)
      : 'genel';
  const paperStyle =
    typeof doc.paperStyle === 'string' && ALLOWED_PAPER_STYLES.has(doc.paperStyle as PaperStyleType)
      ? (doc.paperStyle as PaperStyleType)
      : 'dots';

  return {
    id: clampStr(doc.id, 90, `map_${Date.now()}`),
    title: clampStr(doc.title, 200, 'İçe Aktarılan Harita'),
    department: dept,
    rootNodeId: rootId,
    nodes: safeNodes,
    crossLinks: safeCrossLinks,
    inkStrokes: safeInkStrokes,
    stickyNotes: safeStickies,
    paperStyle,
    createdAt: finiteNum(doc.createdAt, Date.now()),
    updatedAt: finiteNum(doc.updatedAt, Date.now()),
    darkMode: Boolean(doc.darkMode),
    defaultNodeStyle: doc.defaultNodeStyle === 'organic' ? 'organic' : 'card',
    folder: doc.folder === 'engineering' ? 'engineering' : 'study_exam',
    isPinned: Boolean(doc.isPinned),
    deletedAt: null,
  };
}
