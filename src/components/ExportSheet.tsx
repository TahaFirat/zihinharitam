import React, { useState, useRef } from 'react';
import {
  X,
  FileImage,
  FileText,
  FileCode2,
  Link2,
  Check,
  Crown,
  Download,
  Upload,
  Loader2,
  Users,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import type {
  CollaboratorPresence,
  MindMapDocument,
  MindNode,
  PaywallTriggerReason,
} from '../types/mindmap';
import { renderTiledOffscreenCanvas } from '../core/canvas/CanvasMemoryGuard';
import {
  drawStaticCrossLinksForExport,
  generateCrossLinkSvgElements,
} from '../core/canvas/CrossLinkRenderer';
import {
  buildHandwritingExportSvgGroup,
  drawHandwritingToCanvas2D,
  resolveHandwritingRenderBox,
} from '../core/canvas/HandwritingSvgRenderer';
import {
  drawInkStrokesToCanvas2D,
  drawStickyNotesToCanvas2D,
  generateInkStrokesSvgElements,
  generateStickyNotesSvgElements,
} from '../core/canvas/InkStrokeEngine';
import {
  OrganicBranchRenderer,
  generateTaperedBranchSvgPath,
} from '../core/canvas/OrganicBranchRenderer';
import { computeTreeMeta } from '../core/canvas/RadialAutoLayout';
import { useEntitlements } from '../core/monetization/EntitlementManager';
import { shareOrDownloadFile, hapticSuccess } from '../core/native/NativeBridge';
import { LocalStore } from '../core/sync/LocalStore';
import { useI18n } from '../core/i18n/i18n';
import {
  exportFlowchartToMermaid,
  renderFlowchartToSvgString,
} from '../data/flowchartTemplates';

interface ExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  document: MindMapDocument;
  collaborators: CollaboratorPresence[];
  onImportDocument: (doc: MindMapDocument) => void;
  onTriggerPaywall: (reason: PaywallTriggerReason) => void;
  onExportSuccess?: () => void;
}

function buildMarkdownExport(doc: MindMapDocument): string {
  if (doc.documentType === 'flowchart' && doc.flowchart) {
    const lines = [`# ${doc.title}`, '', '```mermaid', exportFlowchartToMermaid(doc).trim(), '```', ''];
    for (const n of doc.flowchart.nodes) {
      lines.push(`- **${n.title}**${n.subtitle ? ` — ${n.subtitle}` : ''}`);
    }
    return lines.join('\n') + '\n';
  }
  const lines: string[] = [`# ${doc.title}`, ''];
  const visited = new Set<string>();
  const walk = (id: string, depth: number) => {
    if (visited.has(id)) return;
    const node = doc.nodes[id];
    if (!node) return;
    visited.add(id);
    if (depth > 0) {
      const indent = '  '.repeat(depth - 1);
      const badge = node.techBadge ? ` \`[${node.techBadge}]\`` : '';
      const sub = node.subtitle ? ` — ${node.subtitle}` : '';
      lines.push(`${indent}- **${node.title}**${badge}${sub}`);
      if (node.note?.trim()) {
        lines.push(`${indent}  > ${node.note.trim().replace(/\r?\n/g, `\n${indent}  > `)}`);
      }
      if (node.linkUrl) {
        lines.push(`${indent}  - Link: ${node.linkUrl}`);
      }
    }
    Object.values(doc.nodes)
      .filter((c) => c.parentId === id)
      .forEach((c) => walk(c.id, depth + 1));
  };
  walk(doc.rootNodeId, 0);
  return lines.join('\n') + '\n';
}

function buildOpmlExport(doc: MindMapDocument): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const visited = new Set<string>();
  const walk = (id: string, pad: string): string => {
    if (visited.has(id)) return '';
    const node = doc.nodes[id];
    if (!node) return '';
    visited.add(id);
    const kids = Object.values(doc.nodes).filter((c) => c.parentId === id);
    const noteAttr = node.note ? ` _note="${esc(node.note)}"` : node.subtitle ? ` _note="${esc(node.subtitle)}"` : '';
    if (!kids.length) {
      return `${pad}<outline text="${esc(node.title)}"${noteAttr} />\n`;
    }
    return `${pad}<outline text="${esc(node.title)}"${noteAttr}>\n${kids
      .map((k) => walk(k.id, pad + '  '))
      .join('')}${pad}</outline>\n`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>${esc(doc.title)}</title></head>\n  <body>\n${walk(doc.rootNodeId, '    ')}  </body>\n</opml>\n`;
}

function buildMindMapMermaid(doc: MindMapDocument): string {
  if (doc.documentType === 'flowchart') {
    return exportFlowchartToMermaid(doc);
  }
  const lines = ['mindmap'];
  const visited = new Set<string>();
  const clean = (s: string) => s.replace(/[()[\]{}"]/g, '').trim() || 'Topic';
  const walk = (id: string, depth: number) => {
    if (visited.has(id)) return;
    const node = doc.nodes[id];
    if (!node) return;
    visited.add(id);
    const pad = '  '.repeat(depth + 1);
    lines.push(depth === 0 ? `${pad}root((${clean(node.title)}))` : `${pad}${clean(node.title)}`);
    Object.values(doc.nodes)
      .filter((c) => c.parentId === id)
      .forEach((k) => walk(k.id, depth + 1));
  };
  walk(doc.rootNodeId, 0);
  return lines.join('\n') + '\n';
}

function buildAnkiCsvExport(doc: MindMapDocument): string {
  const q = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, '<br>')}"`;
  const rows: string[] = [];
  for (const node of Object.values(doc.nodes)) {
    if (node.id === doc.rootNodeId) continue;
    const parent = node.parentId ? doc.nodes[node.parentId]?.title : doc.title;
    const kids = Object.values(doc.nodes)
      .filter((c) => c.parentId === node.id)
      .map((c) => c.title);
    const front = `[${parent || doc.title}] ${node.title}`;
    const backParts = [
      node.subtitle,
      node.techBadge ? `(${node.techBadge})` : '',
      node.note,
      kids.length ? `Alt Dallar: ${kids.join(', ')}` : '',
    ].filter(Boolean);
    const back = backParts.join(' — ') || node.title;
    rows.push(`${q(front)};${q(back)}`);
  }
  return rows.join('\n') + '\n';
}

async function renderFlowchartToCanvas(
  doc: MindMapDocument,
  transparentBg: boolean,
  scale = 2.4
): Promise<HTMLCanvasElement> {
  const svgStr = renderFlowchartToSvgString(doc, transparentBg);
  const wMatch = svgStr.match(/width="(\d+)"/);
  const hMatch = svgStr.match(/height="(\d+)"/);
  const baseW = Math.max(480, Number(wMatch?.[1]) || 960);
  const baseH = Math.max(360, Number(hMatch?.[1]) || 640);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(baseW * scale);
  canvas.height = Math.round(baseH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadExportImage(url);
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}

function loadExportImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function resolveExportStickerSize(node: MindNode, isRoot: boolean): number {
  const preset = node.stickerSize;
  if (preset === 'sm') return isRoot ? 82 : 56;
  if (preset === 'lg') return isRoot ? 168 : 132;
  if (preset === 'xl') return isRoot ? 196 : 168;
  return isRoot ? 148 : 98;
}

function wrapCanvasTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const paragraphs = text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
        if (lines.length >= maxLines) break;
      }
    }
    if (lines.length >= maxLines) break;
    if (current) lines.push(current);
    if (lines.length >= maxLines) break;
  }
  if (lines.length === maxLines) {
    const joined = paragraphs.join(' ');
    const usedLen = lines.join(' ').length;
    if (usedLen + 3 < joined.length) {
      lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(4, lines[maxLines - 1].length - 2))}…`;
    }
  }
  return lines.slice(0, maxLines);
}

function wrapSvgTextLines(text: string, maxChars: number, maxLines: number): string[] {
  const paragraphs = text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
        if (lines.length >= maxLines) break;
      }
    }
    if (lines.length >= maxLines) break;
    if (current) lines.push(current);
    if (lines.length >= maxLines) break;
  }
  if (lines.length === maxLines) {
    const joined = paragraphs.join(' ');
    if (lines.join(' ').length + 3 < joined.length) {
      lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(4, lines[maxLines - 1].length - 2))}…`;
    }
  }
  return lines.slice(0, maxLines);
}

function getPriorityExportMeta(tag: MindNode['priorityTag']): { label: string; bg: string; fg: string } | null {
  if (tag === 'exam') return { label: 'SINAV', bg: '#FEE2E2', fg: '#B91C1C' };
  if (tag === 'important') return { label: 'ÖNEMLİ', bg: '#FEF3C7', fg: '#B45309' };
  if (tag === 'review') return { label: 'TEKRAR', bg: '#E0F2FE', fg: '#0369A1' };
  return null;
}

function computeVisibleMapWorldBounds(
  nodes: Record<string, MindNode>,
  hiddenIds: Set<string>,
  rootNodeId?: string
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of Object.values(nodes)) {
    if (hiddenIds.has(n.id)) continue;
    const isRoot = n.id === rootNodeId;
    const sSize = resolveExportStickerSize(n, isRoot);
    const extraNoteH = n.note?.trim() && !n.noteCollapsed ? 86 : 0;
    minX = Math.min(minX, n.x - 195);
    maxX = Math.max(maxX, n.x + 195);
    minY = Math.min(minY, n.y - (sSize + 76));
    maxY = Math.max(maxY, n.y + 84 + extraNoteH);
  }

  if (!Number.isFinite(minX)) {
    return { minX: -400, minY: -300, maxX: 400, maxY: 300 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Renders the full mind map using `2048x2048` tiled offscreen rendering (`CanvasMemoryGuard`)
 * so 300 DPI A4/A3 PDF and HiDPI PNG exports never exceed iOS WKWebView's 256MB memory ceiling!
 */
async function renderHighResMapCanvas(
  doc: MindMapDocument,
  transparentBg: boolean,
  pixelScale = 2.6,
  includeSubtleFreeSignature = false
): Promise<HTMLCanvasElement> {
  const meta = computeTreeMeta(doc.nodes, doc.rootNodeId);
  const bounds = computeVisibleMapWorldBounds(doc.nodes, meta.hiddenNodeIds, doc.rootNodeId);
  const pad = 95;
  const worldW = bounds.maxX - bounds.minX + pad * 2;
  const worldH = bounds.maxY - bounds.minY + pad * 2;

  const visibleNodes = Object.values(doc.nodes).filter(
    (n) => !meta.hiddenNodeIds.has(n.id)
  );
  const loadedImages = await Promise.all(
    visibleNodes.map((n) =>
      n.sticker ? loadExportImage(n.sticker.url) : Promise.resolve(null)
    )
  );

  const branchRenderer = new OrganicBranchRenderer();
  const offsetX = -bounds.minX + pad;
  const offsetY = -bounds.minY + pad;

  const canvas = renderTiledOffscreenCanvas(
    worldW,
    worldH,
    pixelScale,
    (ctx, tileWorldOffsetX, tileWorldOffsetY, effectiveScale) => {
      ctx.scale(effectiveScale, effectiveScale);
      ctx.translate(-tileWorldOffsetX, -tileWorldOffsetY);

      if (!transparentBg) {
        ctx.fillStyle = doc.darkMode ? '#0F141D' : '#FAF9F5';
        ctx.fillRect(0, 0, worldW, worldH);

        ctx.fillStyle = doc.darkMode ? '#232C3D' : '#E2E0D8';
        for (let x = 24; x < worldW; x += 28) {
          for (let y = 24; y < worldH; y += 28) {
            ctx.beginPath();
            ctx.arc(x, y, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.save();
      ctx.translate(offsetX, offsetY);

      // 1. Organic tapered Bezier branches
      for (const node of Object.values(doc.nodes)) {
        if (!node.parentId || meta.hiddenNodeIds.has(node.id)) continue;
        const parent = doc.nodes[node.parentId];
        if (!parent || meta.hiddenNodeIds.has(parent.id)) continue;
        const depth = meta.depthMap.get(node.id) ?? 1;
        branchRenderer.drawTaperedBranch(
          ctx,
          parent.x,
          parent.y,
          node.x,
          node.y,
          node.branchColor,
          depth,
          1.0
        );
      }

      // 2. Directional CrossLinks
      drawStaticCrossLinksForExport(
        ctx,
        doc.crossLinks,
        doc.nodes,
        meta.hiddenNodeIds,
        Boolean(doc.darkMode)
      );

      // 2b. Freehand Tablet/Stylus Ink Strokes & Sticky Notes
      drawInkStrokesToCanvas2D(ctx, doc.inkStrokes);
      drawStickyNotesToCanvas2D(ctx, doc.stickyNotes);

      // 3. Nodes (Stickers + Boxless Handwritten Concepts OR Wrapped Pill Cards + Priority/Checkboxes + Tech Badges + Note Boxes!)
      visibleNodes.forEach((node, idx) => {
        const isRoot = node.id === doc.rootNodeId;
        const img = loadedImages[idx];
        const stickerSize = resolveExportStickerSize(node, isRoot);
        const hasHandwriting = Boolean(node.handwriting?.strokes?.length);
        const checkPrefix =
          node.checked === true ? '☑ ' : node.checked === false ? '☐ ' : '';
        const displayTitle = `${checkPrefix}${node.title || 'Yeni Konu'}`;

        if (hasHandwriting && node.handwriting) {
          const hwBox = resolveHandwritingRenderBox(node.handwriting, isRoot);
          const hwTopY = node.y - hwBox.renderH * 0.5;
          if (img) {
            const ratio = node.sticker?.aspectRatio || 1;
            const drawW = ratio >= 1 ? stickerSize : stickerSize * ratio;
            const drawH = ratio >= 1 ? stickerSize / ratio : stickerSize;
            ctx.drawImage(img, node.x - drawW / 2, hwTopY - drawH - 8, drawW, drawH);
          }
          drawHandwritingToCanvas2D(
            ctx,
            node.handwriting,
            node.x,
            hwTopY,
            hwBox.renderW,
            hwBox.renderH,
            Boolean(doc.darkMode)
          );
          // Subtle branch-colored underline directly beneath handwriting (no box!)
          const lineW = Math.min(180, Math.max(56, hwBox.renderW * 0.72));
          ctx.save();
          ctx.strokeStyle = node.branchColor;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(node.x - lineW * 0.5, hwTopY + hwBox.renderH + 5);
          ctx.lineTo(node.x + lineW * 0.5, hwTopY + hwBox.renderH + 5);
          ctx.stroke();
          ctx.restore();
          return;
        }

        const titleFontSize = isRoot ? 18 : 14;
        ctx.font = `${isRoot ? 800 : 700} ${titleFontSize}px "Plus Jakarta Sans", sans-serif`;
        const maxCardTextW = isRoot ? 260 : 210;
        const titleLines = wrapCanvasTextLines(ctx, displayTitle, maxCardTextW, 2);
        const maxTitleLineW = Math.max(
          ...titleLines.map((l) => ctx.measureText(l).width),
          72
        );

        const subText = node.techBadge || node.subtitle || '';
        const priorityMeta = getPriorityExportMeta(node.priorityTag);

        const cleanNote = !node.noteCollapsed ? (node.note || '').trim() : '';
        ctx.font = `500 10.5px "Plus Jakarta Sans", sans-serif`;
        const noteLines = cleanNote
          ? wrapCanvasTextLines(ctx, cleanNote, maxCardTextW, 4)
          : [];
        const maxNoteLineW =
          noteLines.length > 0
            ? Math.max(...noteLines.map((l) => ctx.measureText(l).width))
            : 0;

        const titleLineH = isRoot ? 22 : 18;
        const titleBlockH = titleLines.length * titleLineH;
        const subBlockH = subText || priorityMeta ? 18 : 0;
        const noteBlockH = noteLines.length > 0 ? noteLines.length * 14 + 14 : 0;
        const pillH = Math.max(34, 14 + titleBlockH + subBlockH + noteBlockH);
        const pillW = Math.min(
          maxCardTextW + 34,
          Math.max(
            106,
            maxTitleLineW + 30,
            subText.length * 6.5 + (priorityMeta ? 64 : 26),
            maxNoteLineW + 30
          )
        );
        const cardTopY = node.y - 20;

        if (img) {
          const ratio = node.sticker?.aspectRatio || 1;
          const drawW = ratio >= 1 ? stickerSize : stickerSize * ratio;
          const drawH = ratio >= 1 ? stickerSize / ratio : stickerSize;
          ctx.drawImage(
            img,
            node.x - drawW / 2,
            cardTopY - drawH - 8,
            drawW,
            drawH
          );
        }

        ctx.save();
        ctx.fillStyle = doc.darkMode ? '#1B2333' : '#FFFFFF';
        ctx.strokeStyle = node.branchColor;
        ctx.lineWidth = isRoot ? 3.2 : 2.2;
        ctx.shadowColor = 'rgba(15,23,42,0.12)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.roundRect(node.x - pillW / 2, cardTopY, pillW, pillH, 13);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Draw Title Lines
        ctx.font = `${isRoot ? 800 : 700} ${titleFontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = doc.darkMode ? '#F8FAFC' : '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let cursorY = cardTopY + 8 + titleLineH * 0.5;
        for (const tl of titleLines) {
          ctx.fillText(tl, node.x, cursorY);
          cursorY += titleLineH;
        }

        // Draw Priority Pill & Tech Badge / Subtitle
        if (subText || priorityMeta) {
          const badgeY = cursorY + 2;
          if (priorityMeta && !subText) {
            ctx.save();
            ctx.font = '800 9.5px "Plus Jakarta Sans", sans-serif';
            const pw = ctx.measureText(priorityMeta.label).width + 12;
            ctx.fillStyle = priorityMeta.bg;
            ctx.beginPath();
            ctx.roundRect(node.x - pw / 2, badgeY - 7, pw, 14, 5);
            ctx.fill();
            ctx.fillStyle = priorityMeta.fg;
            ctx.fillText(priorityMeta.label, node.x, badgeY);
            ctx.restore();
          } else {
            const combined = priorityMeta
              ? `[${priorityMeta.label}] ${subText}`
              : subText;
            ctx.font = `700 10px "Plus Jakarta Sans", monospace`;
            ctx.fillStyle = node.techBadge
              ? '#0284C7'
              : doc.darkMode
              ? '#94A3B8'
              : '#64748B';
            ctx.fillText(
              combined.length > 34 ? `${combined.slice(0, 32)}…` : combined,
              node.x,
              badgeY
            );
          }
          cursorY += subBlockH;
        }

        // Draw Wrapped Node Note Box
        if (noteLines.length > 0) {
          const boxX = node.x - pillW / 2 + 8;
          const boxY = cursorY - 2;
          const boxW = pillW - 16;
          const boxH = noteLines.length * 14 + 8;
          ctx.save();
          ctx.fillStyle = doc.darkMode ? '#111827' : '#FFFBEB';
          ctx.strokeStyle = doc.darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(217,119,6,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 7);
          ctx.fill();
          ctx.stroke();

          ctx.font = `500 10.5px "Plus Jakarta Sans", sans-serif`;
          ctx.fillStyle = doc.darkMode ? '#CBD5E1' : '#334155';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          let ny = boxY + 11;
          for (const nl of noteLines) {
            ctx.fillText(nl, boxX + 7, ny);
            ny += 14;
          }
          ctx.restore();
        }
      });

      ctx.restore();

      // Subtle Free-tier corner signature (omitted in Lifetime Pro!)
      if (includeSubtleFreeSignature) {
        ctx.save();
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = doc.darkMode
          ? 'rgba(148,163,184,0.65)'
          : 'rgba(100,116,139,0.65)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('ZihinHaritam ile oluşturuldu', worldW - 22, worldH - 16);
        ctx.restore();
      }
    }
  );

  return canvas;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildVectorSvgBlob(doc: MindMapDocument): Blob {
  const meta = computeTreeMeta(doc.nodes, doc.rootNodeId);
  const bounds = computeVisibleMapWorldBounds(doc.nodes, meta.hiddenNodeIds, doc.rootNodeId);
  const pad = 95;
  const width = Math.round(bounds.maxX - bounds.minX + pad * 2);
  const height = Math.round(bounds.maxY - bounds.minY + pad * 2);
  const ox = -bounds.minX + pad;
  const oy = -bounds.minY + pad;

  const isDark = Boolean(doc.darkMode);
  const cardBg = isDark ? '#1B2333' : '#FFFFFF';
  const titleFill = isDark ? '#F8FAFC' : '#0F172A';
  const noteBg = isDark ? '#111827' : '#FFFBEB';
  const noteStroke = isDark ? '#334155' : '#FDE68A';
  const noteFill = isDark ? '#CBD5E1' : '#334155';

  const branchPaths: string[] = [];
  for (const node of Object.values(doc.nodes)) {
    if (!node.parentId || meta.hiddenNodeIds.has(node.id)) continue;
    const parent = doc.nodes[node.parentId];
    if (!parent || meta.hiddenNodeIds.has(parent.id)) continue;
    const depth = meta.depthMap.get(node.id) ?? 1;
    const d = generateTaperedBranchSvgPath(
      parent.x + ox,
      parent.y + oy,
      node.x + ox,
      node.y + oy,
      depth
    );
    branchPaths.push(`<path d="${d}" fill="${node.branchColor}" />`);
  }

  const crossLinkElements = generateCrossLinkSvgElements(
    doc.crossLinks,
    doc.nodes,
    meta.hiddenNodeIds,
    ox,
    oy,
    escapeXml
  );

  const nodeElements: string[] = [];
  for (const node of Object.values(doc.nodes)) {
    if (meta.hiddenNodeIds.has(node.id)) continue;
    const isRoot = node.id === doc.rootNodeId;
    const nx = node.x + ox;
    const ny = node.y + oy;
    const sSize = resolveExportStickerSize(node, isRoot);
    if (node.handwriting?.strokes?.length) {
      const hwBox = resolveHandwritingRenderBox(node.handwriting, isRoot);
      const hwTopY = ny - hwBox.renderH * 0.5;
      if (node.sticker?.url) {
        nodeElements.push(
          `<image href="${escapeXml(node.sticker.url)}" x="${nx - sSize / 2}" y="${
            hwTopY - sSize - 8
          }" width="${sSize}" height="${sSize}" preserveAspectRatio="xMidYMid meet" />`
        );
      }
      nodeElements.push(
        buildHandwritingExportSvgGroup(
          node.handwriting,
          nx,
          hwTopY,
          hwBox.renderW,
          hwBox.renderH,
          isDark
        )
      );
      const lineW = Math.min(180, Math.max(56, hwBox.renderW * 0.72));
      nodeElements.push(
        `<line x1="${(nx - lineW * 0.5).toFixed(1)}" y1="${(hwTopY + hwBox.renderH + 5).toFixed(1)}" x2="${(nx + lineW * 0.5).toFixed(1)}" y2="${(hwTopY + hwBox.renderH + 5).toFixed(1)}" stroke="${node.branchColor}" stroke-width="3.5" stroke-linecap="round" />`
      );
      continue;
    }
    const checkPrefix =
      node.checked === true ? '☑ ' : node.checked === false ? '☐ ' : '';
    const displayTitle = `${checkPrefix}${node.title || 'Yeni Konu'}`;
    const titleLines = wrapSvgTextLines(displayTitle, isRoot ? 26 : 24, 2);
    const priorityMeta = getPriorityExportMeta(node.priorityTag);
    const subText = node.techBadge || node.subtitle || '';
    const cleanNote = !node.noteCollapsed ? (node.note || '').trim() : '';
    const noteLines = cleanNote ? wrapSvgTextLines(cleanNote, 32, 4) : [];

    const titleLineH = isRoot ? 20 : 17;
    const subBlockH = subText || priorityMeta ? 17 : 0;
    const noteBlockH = noteLines.length > 0 ? noteLines.length * 14 + 14 : 0;
    const pillH = Math.max(34, 14 + titleLines.length * titleLineH + subBlockH + noteBlockH);
    const estW = Math.min(
      250,
      Math.max(
        110,
        Math.max(...titleLines.map((l) => l.length)) * (isRoot ? 9.5 : 8) + 30,
        subText.length * 6.5 + 26,
        noteLines.length > 0 ? Math.max(...noteLines.map((l) => l.length)) * 6.2 + 28 : 0
      )
    );
    const cardTopY = ny - 20;

    if (node.sticker?.url) {
      nodeElements.push(
        `<image href="${escapeXml(node.sticker.url)}" x="${nx - sSize / 2}" y="${
          cardTopY - sSize - 8
        }" width="${sSize}" height="${sSize}" preserveAspectRatio="xMidYMid meet" />`
      );
    }

    nodeElements.push(
      `<rect x="${nx - estW / 2}" y="${cardTopY}" width="${estW}" height="${pillH}" rx="12" fill="${cardBg}" stroke="${node.branchColor}" stroke-width="${
        isRoot ? 3 : 2
      }" />`
    );

    let cursorY = cardTopY + 8 + titleLineH * 0.7;
    for (const tl of titleLines) {
      nodeElements.push(
        `<text x="${nx}" y="${cursorY}" text-anchor="middle" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="700" font-size="${
          isRoot ? 15.5 : 13
        }" fill="${titleFill}">${escapeXml(tl)}</text>`
      );
      cursorY += titleLineH;
    }

    if (subText || priorityMeta) {
      const combined = priorityMeta && subText ? `[${priorityMeta.label}] ${subText}` : priorityMeta ? `[${priorityMeta.label}]` : subText;
      nodeElements.push(
        `<text x="${nx}" y="${cursorY + 2}" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" fill="${
          node.techBadge ? '#0284C7' : priorityMeta ? priorityMeta.fg : '#64748B'
        }">${escapeXml(combined.slice(0, 34))}</text>`
      );
      cursorY += subBlockH;
    }

    if (noteLines.length > 0) {
      const bx = nx - estW / 2 + 8;
      const by = cursorY - 2;
      const bw = estW - 16;
      const bh = noteLines.length * 14 + 8;
      nodeElements.push(
        `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="${noteBg}" stroke="${noteStroke}" stroke-width="1" />`
      );
      let nY = by + 13;
      for (const nl of noteLines) {
        nodeElements.push(
          `<text x="${bx + 6}" y="${nY}" text-anchor="start" font-family="Plus Jakarta Sans, Arial, sans-serif" font-size="10" fill="${noteFill}">${escapeXml(nl)}</text>`
        );
        nY += 14;
      }
    }
  }

  const inkSvgMarkup =
    generateInkStrokesSvgElements(
      (doc.inkStrokes ?? []).map((s) => ({
        ...s,
        points: s.points.map(([px, py, pr]) => [px + ox, py + oy, pr] as [number, number, number]),
      }))
    ) +
    '\n' +
    generateStickyNotesSvgElements(
      (doc.stickyNotes ?? []).map((n) => ({ ...n, x: n.x + ox, y: n.y + oy }))
    );

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${doc.darkMode ? '#0F141D' : '#FAF9F5'}" />
  <g>${branchPaths.join('\n')}</g>
  <g>${crossLinkElements.join('\n')}</g>
  <g>${inkSvgMarkup}</g>
  <g>${nodeElements.join('\n')}</g>
</svg>`;

  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export const ExportSheet: React.FC<ExportSheetProps> = ({
  isOpen,
  onClose,
  document: mindmapDoc,
  collaborators,
  onImportDocument,
  onTriggerPaywall,
  onExportSuccess,
}) => {
  const { t } = useI18n();
  const { isLifetimePro } = useEntitlements();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [paperSize, setPaperSize] = useState<'a4' | 'a3'>('a4');
  const jsonInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const safeSlug =
    mindmapDoc.title
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9ğüşıöç]+/gi, '-')
      .replace(/^-|-$/g, '') || 'zihin-haritasi';

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
    mindmapDoc.id
  )}`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      void hapticSuccess();
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      // Fallback
    }
  };

  const handleExportPng = async (transparent: boolean) => {
    if (transparent && !isLifetimePro) {
      onTriggerPaywall('pro_export');
      return;
    }

    const key = transparent ? 'png_trans' : 'png_paper';
    setBusyType(key);
    try {
      const canvas =
        mindmapDoc.documentType === 'flowchart'
          ? await renderFlowchartToCanvas(mindmapDoc, transparent, isLifetimePro ? 2.6 : 2.0)
          : await renderHighResMapCanvas(
              mindmapDoc,
              transparent,
              isLifetimePro ? 2.8 : 2.0,
              !isLifetimePro && !transparent
            );
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('PNG oluşturulamadı'))),
          'image/png'
        );
      });
      canvas.width = 1;
      canvas.height = 1;
      await shareOrDownloadFile(
        blob,
        `${safeSlug}${transparent ? '-seffaf' : '-poster'}.png`,
        'image/png',
        mindmapDoc.title
      );
      void hapticSuccess();
      onExportSuccess?.();
    } finally {
      setBusyType(null);
    }
  };

  const handleExportPdf = async () => {
    if (!isLifetimePro) {
      onTriggerPaywall('pro_export');
      return;
    }

    setBusyType('pdf');
    try {
      const canvas =
        mindmapDoc.documentType === 'flowchart'
          ? await renderFlowchartToCanvas(mindmapDoc, false, 2.8)
          : await renderHighResMapCanvas(mindmapDoc, false, 3.0, false);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const cw = canvas.width;
      const ch = canvas.height;
      canvas.width = 1;
      canvas.height = 1;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: paperSize,
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const ratio = Math.min((pageW - 16) / cw, (pageH - 16) / ch);
      const drawW = cw * ratio;
      const drawH = ch * ratio;
      const dx = (pageW - drawW) * 0.5;
      const dy = (pageH - drawH) * 0.5;

      pdf.setFillColor(
        mindmapDoc.darkMode ? 15 : 250,
        mindmapDoc.darkMode ? 20 : 249,
        mindmapDoc.darkMode ? 29 : 245
      );
      pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.addImage(imgData, 'JPEG', dx, dy, drawW, drawH);

      const pdfBlob = pdf.output('blob');
      await shareOrDownloadFile(
        pdfBlob,
        `${safeSlug}-${paperSize.toUpperCase()}-300dpi.pdf`,
        'application/pdf',
        `${mindmapDoc.title} (300 DPI Poster PDF)`
      );
      void hapticSuccess();
      onExportSuccess?.();
    } finally {
      setBusyType(null);
    }
  };

  const handleExportSvg = async () => {
    if (!isLifetimePro) {
      onTriggerPaywall('pro_export');
      return;
    }

    setBusyType('svg');
    try {
      const blob =
        mindmapDoc.documentType === 'flowchart'
          ? new Blob([renderFlowchartToSvgString(mindmapDoc, false)], {
              type: 'image/svg+xml;charset=utf-8',
            })
          : buildVectorSvgBlob(mindmapDoc);
      await shareOrDownloadFile(
        blob,
        `${safeSlug}.svg`,
        'image/svg+xml',
        mindmapDoc.title
      );
      void hapticSuccess();
      onExportSuccess?.();
    } finally {
      setBusyType(null);
    }
  };

  const handleExportTextFormat = async (kind: 'md' | 'opml' | 'mmd' | 'anki') => {
    const content =
      kind === 'md'
        ? buildMarkdownExport(mindmapDoc)
        : kind === 'opml'
        ? buildOpmlExport(mindmapDoc)
        : kind === 'mmd'
        ? buildMindMapMermaid(mindmapDoc)
        : buildAnkiCsvExport(mindmapDoc);
    const ext = kind === 'anki' ? 'csv' : kind;
    const mime =
      kind === 'opml'
        ? 'text/xml;charset=utf-8'
        : kind === 'anki'
        ? 'text/csv;charset=utf-8'
        : 'text/markdown;charset=utf-8';
    const blob = new Blob([content], { type: mime });
    await shareOrDownloadFile(blob, `${safeSlug}.${ext}`, mime, mindmapDoc.title);
    void hapticSuccess();
    onExportSuccess?.();
  };

  const handleExportZihin = async () => {
    const blob = new Blob([JSON.stringify(mindmapDoc, null, 2)], {
      type: 'application/json',
    });
    await shareOrDownloadFile(
      blob,
      `${safeSlug}.zihin`,
      'application/json',
      mindmapDoc.title
    );
  };

  const handleImportZihin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const docs = LocalStore.parseZihinImportPayload(String(reader.result));
        if (docs.length > 0) {
          onImportDocument(docs[0]);
          onClose();
        }
      } catch {
        // Ignore invalid file
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'max(22px, calc(var(--safe-bottom) + 14px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div>
            <h2 className="text-base font-extrabold">
              {t('Dışa Aktarma, Poster & Yedekleme', 'Export, Print Posters & Backup')}
            </h2>
            <p className="text-xs opacity-65">
              {t(
                '300 DPI Filigransız A4/A3 PDF, Şeffaf PNG, Vektörel SVG ve .zihin Yedek',
                '300 DPI Watermark-Free A4/A3 PDF, Transparent PNG, Vector SVG & .zihin Backup'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-500/10"
            aria-label={t('Kapat', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* 300 DPI Poster PDF (Pro) */}
          <div
            className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{
              backgroundColor: 'var(--hud-bg)',
              borderColor: 'var(--hud-border)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-extrabold">
                  <span>{t('300 DPI Baskı Poster PDF', '300 DPI Print Poster PDF')}</span>
                  {!isLifetimePro && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                      <Crown className="h-2.5 w-2.5" />
                      PRO
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-65">
                  {t(
                    'Not kutuları ve görsellerle filigransız A4/A3 poster',
                    'Watermark-free A4/A3 study poster including notes & visuals'
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as 'a4' | 'a3')}
                className="min-h-[40px] rounded-xl border bg-transparent px-2.5 py-2 text-xs font-bold"
                style={{
                  borderColor: 'var(--hud-border)',
                  backgroundColor: 'var(--canvas-bg)',
                }}
              >
                <option value="a4">{t('A4 Yatay', 'A4 Landscape')}</option>
                <option value="a3">{t('A3 Poster', 'A3 Poster')}</option>
              </select>
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={busyType !== null}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-extrabold text-white shadow-xs active:scale-95 disabled:opacity-50"
              >
                {busyType === 'pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t('PDF İndir', 'Export PDF')}
              </button>
            </div>
          </div>

          {/* PNG & SVG Formats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => void handleExportPng(false)}
              disabled={busyType !== null}
              className="relative flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-colors hover:bg-slate-500/5"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                {t('ÜCRETSİZ', 'FREE')}
              </span>
              <FileImage className="h-5 w-5 text-amber-500" />
              <div className="text-xs font-extrabold">{t('Defter Zeminli PNG', 'Paper Background PNG')}</div>
              <div className="text-[11px] opacity-65">
                {isLifetimePro
                  ? t('Filigransız sıcak kağıt poster görüntüsü', 'Watermark-free warm paper poster image')
                  : t('Standart PNG (köşede zarif uygulama imzası)', 'Standard PNG with subtle corner signature')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => void handleExportPng(true)}
              disabled={busyType !== null}
              className="relative flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-colors hover:bg-slate-500/5"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              {!isLifetimePro && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                  <Crown className="h-2.5 w-2.5" />
                  PRO
                </span>
              )}
              <FileImage className="h-5 w-5 text-emerald-500" />
              <div className="text-xs font-extrabold">{t('Şeffaf PNG (HiDPI)', 'Transparent PNG (HiDPI)')}</div>
              <div className="text-[11px] opacity-65">
                {t('GoodNotes, Notability ve sunumlara yapıştırmalık', 'Ready to paste into GoodNotes, Notability & slides')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => void handleExportSvg()}
              disabled={busyType !== null}
              className="relative flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-colors hover:bg-slate-500/5"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              {!isLifetimePro && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                  <Crown className="h-2.5 w-2.5" />
                  PRO
                </span>
              )}
              <FileCode2 className="h-5 w-5 text-violet-500" />
              <div className="text-xs font-extrabold">{t('Vektörel SVG', 'Vector SVG')}</div>
              <div className="text-[11px] opacity-65">
                {t('Sonsuz ölçeklenebilir kübik Bezier & not çıktısı', 'Infinitely scalable cubic Bezier & notes output')}
              </div>
            </button>
          </div>

          {/* Structured Text & Developer/Study Exports: Markdown, OPML, Mermaid, Anki CSV */}
          <div
            className="rounded-2xl border p-3.5"
            style={{ backgroundColor: 'var(--hud-bg)', borderColor: 'var(--hud-border)' }}
            data-testid="export-structured-formats"
          >
            <div className="mb-2 text-xs font-extrabold">
              {t('Not, Diyagram & Çalışma Formatları (Ücretsiz)', 'Notes, Diagrams & Study Formats (Free)')}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                data-testid="export-md-btn"
                onClick={() => void handleExportTextFormat('md')}
                className="rounded-xl border px-2.5 py-2 text-left text-[11px] font-extrabold transition hover:bg-slate-500/10"
                style={{ borderColor: 'var(--hud-border)', backgroundColor: 'var(--canvas-bg)' }}
              >
                <div>Markdown</div>
                <div className="text-[10px] font-semibold opacity-60">.md • Notion/Obsidian</div>
              </button>
              <button
                type="button"
                data-testid="export-mmd-btn"
                onClick={() => void handleExportTextFormat('mmd')}
                className="rounded-xl border px-2.5 py-2 text-left text-[11px] font-extrabold transition hover:bg-slate-500/10"
                style={{ borderColor: 'var(--hud-border)', backgroundColor: 'var(--canvas-bg)' }}
              >
                <div>Mermaid</div>
                <div className="text-[10px] font-semibold opacity-60">.mmd • GitHub/Docs</div>
              </button>
              <button
                type="button"
                data-testid="export-opml-btn"
                onClick={() => void handleExportTextFormat('opml')}
                className="rounded-xl border px-2.5 py-2 text-left text-[11px] font-extrabold transition hover:bg-slate-500/10"
                style={{ borderColor: 'var(--hud-border)', backgroundColor: 'var(--canvas-bg)' }}
              >
                <div>OPML</div>
                <div className="text-[10px] font-semibold opacity-60">.opml • Xmind/MindNode</div>
              </button>
              <button
                type="button"
                data-testid="export-anki-btn"
                onClick={() => void handleExportTextFormat('anki')}
                className="rounded-xl border px-2.5 py-2 text-left text-[11px] font-extrabold transition hover:bg-slate-500/10"
                style={{ borderColor: 'var(--hud-border)', backgroundColor: 'var(--canvas-bg)' }}
              >
                <div>{t('Anki Kartları', 'Anki Deck')}</div>
                <div className="text-[10px] font-semibold opacity-60">.csv • Flashcards</div>
              </button>
            </div>
          </div>

          {/* Realtime Collaboration Link (only shown on real Web origins — never broken capacitor://localhost!) */}
          {!Capacitor.isNativePlatform() && !shareUrl.startsWith('capacitor:') && (
            <div
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--hud-bg)',
                borderColor: 'var(--hud-border)',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-600 dark:text-sky-400">
                  <Users className="h-4 w-4" />
                  {t(
                    `Canlı Ortak Çalışma Odası (${collaborators.length} Katılımcı)`,
                    `Live Collaboration Room (${collaborators.length} Active)`
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="allow-text-input flex-1 truncate rounded-xl border bg-slate-500/5 px-3 py-2 text-xs font-medium outline-none"
                  style={{ borderColor: 'var(--hud-border)' }}
                />
                <button
                  type="button"
                  onClick={() => void handleCopyShareLink()}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs transition-transform active:scale-95"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {t('Kopyalandı', 'Copied')}
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" />
                      {t('Linki Kopyala', 'Copy Link')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Portable .zihin Backup Import / Export */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".zihin,.json,application/json"
              onChange={handleImportZihin}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold opacity-80 hover:bg-slate-500/10 hover:opacity-100"
            >
              <Upload className="h-3.5 w-3.5" />
              {t('.zihin Yedek İçe Aktar', 'Import .zihin Backup')}
            </button>
            <button
              type="button"
              onClick={() => void handleExportZihin()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold opacity-80 hover:bg-slate-500/10 hover:opacity-100"
            >
              <Download className="h-3.5 w-3.5" />
              {t('.zihin Yedek İndir', 'Export .zihin Backup')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
