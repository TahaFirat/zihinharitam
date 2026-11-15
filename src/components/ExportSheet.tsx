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
  OrganicBranchRenderer,
  generateTaperedBranchSvgPath,
} from '../core/canvas/OrganicBranchRenderer';
import { computeTreeMeta } from '../core/canvas/RadialAutoLayout';
import { useEntitlements } from '../core/monetization/EntitlementManager';
import { shareOrDownloadFile, hapticSuccess } from '../core/native/NativeBridge';
import { LocalStore } from '../core/sync/LocalStore';

interface ExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  document: MindMapDocument;
  collaborators: CollaboratorPresence[];
  onImportDocument: (doc: MindMapDocument) => void;
  onTriggerPaywall: (reason: PaywallTriggerReason) => void;
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

function computeVisibleMapWorldBounds(
  nodes: Record<string, MindNode>,
  hiddenIds: Set<string>
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of Object.values(nodes)) {
    if (hiddenIds.has(n.id)) continue;
    minX = Math.min(minX, n.x - 175);
    maxX = Math.max(maxX, n.x + 175);
    minY = Math.min(minY, n.y - 220);
    maxY = Math.max(maxY, n.y + 100);
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
  const bounds = computeVisibleMapWorldBounds(doc.nodes, meta.hiddenNodeIds);
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

      // 3. Nodes (Stickers + Pill Cards + Tech Badges)
      visibleNodes.forEach((node, idx) => {
        const isRoot = node.id === doc.rootNodeId;
        const img = loadedImages[idx];
        const stickerSize = isRoot ? 148 : 98;
        const displayTitle = node.title || 'Yeni Konu';

        const hasSubLine = Boolean(node.subtitle || node.techBadge);
        const labelCenterY = node.y;
        const pillH = hasSubLine ? 48 : 32;

        if (img) {
          const ratio = node.sticker?.aspectRatio || 1;
          const drawW = ratio >= 1 ? stickerSize : stickerSize * ratio;
          const drawH = ratio >= 1 ? stickerSize / ratio : stickerSize;
          ctx.drawImage(
            img,
            node.x - drawW / 2,
            labelCenterY - pillH / 2 - drawH - 6,
            drawW,
            drawH
          );
        }

        ctx.font = `${isRoot ? 800 : 700} ${isRoot ? 19 : 14.5}px "Plus Jakarta Sans", sans-serif`;
        const titleMetrics = ctx.measureText(displayTitle);
        const subText = node.techBadge || node.subtitle || '';
        const pillW = Math.max(96, titleMetrics.width + 30, subText.length * 6.8 + 26);

        ctx.save();
        ctx.fillStyle = doc.darkMode ? '#1B2333' : '#FFFFFF';
        ctx.strokeStyle = node.branchColor;
        ctx.lineWidth = isRoot ? 3.2 : 2.2;
        ctx.shadowColor = 'rgba(15,23,42,0.12)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.roundRect(node.x - pillW / 2, labelCenterY - pillH / 2, pillW, pillH, 12);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = doc.darkMode ? '#F8FAFC' : '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          displayTitle,
          node.x,
          hasSubLine ? labelCenterY - 7 : labelCenterY + 1
        );

        if (subText) {
          ctx.font = `700 10.5px "Plus Jakarta Sans", monospace`;
          ctx.fillStyle = node.techBadge
            ? '#0284C7'
            : doc.darkMode
            ? '#94A3B8'
            : '#64748B';
          ctx.fillText(subText, node.x, labelCenterY + 11);
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
  const bounds = computeVisibleMapWorldBounds(doc.nodes, meta.hiddenNodeIds);
  const pad = 95;
  const width = Math.round(bounds.maxX - bounds.minX + pad * 2);
  const height = Math.round(bounds.maxY - bounds.minY + pad * 2);
  const ox = -bounds.minX + pad;
  const oy = -bounds.minY + pad;

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
    const sSize = isRoot ? 140 : 92;
    const labelY = ny;
    const displayTitle = node.title || 'Yeni Konu';

    if (node.sticker?.url) {
      nodeElements.push(
        `<image href="${escapeXml(node.sticker.url)}" x="${nx - sSize / 2}" y="${
          labelY - 24 - sSize
        }" width="${sSize}" height="${sSize}" />`
      );
    }

    const hasBadge = Boolean(node.techBadge);
    const pillH = hasBadge ? 44 : 32;
    const estW = Math.max(
      104,
      displayTitle.length * (isRoot ? 11 : 8.5) + 30,
      (node.techBadge?.length ?? 0) * 7 + 26
    );
    nodeElements.push(
      `<rect x="${nx - estW / 2}" y="${labelY - pillH / 2}" width="${estW}" height="${pillH}" rx="11" fill="#FFFFFF" stroke="${node.branchColor}" stroke-width="${
        isRoot ? 3 : 2
      }" />`
    );
    nodeElements.push(
      `<text x="${nx}" y="${
        hasBadge ? labelY - 3 : labelY + 5
      }" text-anchor="middle" font-family="Plus Jakarta Sans, Arial, sans-serif" font-weight="700" font-size="${
        isRoot ? 16 : 13
      }" fill="#0F172A">${escapeXml(displayTitle)}</text>`
    );
    if (node.techBadge) {
      nodeElements.push(
        `<text x="${nx}" y="${
          labelY + 13
        }" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10.5" fill="#0284C7">${escapeXml(
          node.techBadge
        )}</text>`
      );
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${doc.darkMode ? '#0F141D' : '#FAF9F5'}" />
  <g>${branchPaths.join('\n')}</g>
  <g>${crossLinkElements.join('\n')}</g>
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
}) => {
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
      const canvas = await renderHighResMapCanvas(
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
      const canvas = await renderHighResMapCanvas(mindmapDoc, false, 3.0, false);
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
      const blob = buildVectorSvgBlob(mindmapDoc);
      await shareOrDownloadFile(
        blob,
        `${safeSlug}.svg`,
        'image/svg+xml',
        mindmapDoc.title
      );
      void hapticSuccess();
    } finally {
      setBusyType(null);
    }
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
          paddingBottom: 'max(12px, var(--safe-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div>
            <h2 className="text-base font-extrabold">
              Dışa Aktarma, Poster & Yedekleme
            </h2>
            <p className="text-xs opacity-65">
              300 DPI Filigransız A4/A3 PDF, Şeffaf PNG, Vektörel SVG ve .zihin Yedek
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-500/10"
            aria-label="Kapat"
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
                  <span>300 DPI Baskı Poster PDF</span>
                  {!isLifetimePro && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                      <Crown className="h-2.5 w-2.5" />
                      PRO
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-65">
                  Filigransız A4/A3 duvar çalışma posteri (Parçalı güvenli render)
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
                <option value="a4">A4 Yatay</option>
                <option value="a3">A3 Poster</option>
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
                PDF İndir
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
                ÜCRETSİZ
              </span>
              <FileImage className="h-5 w-5 text-amber-500" />
              <div className="text-xs font-extrabold">Defter Zeminli PNG</div>
              <div className="text-[11px] opacity-65">
                {isLifetimePro
                  ? 'Filigransız sıcak kağıt poster görüntüsü'
                  : 'Standart PNG (köşede zarif uygulama imzası)'}
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
              <div className="text-xs font-extrabold">Şeffaf PNG (HiDPI)</div>
              <div className="text-[11px] opacity-65">
                GoodNotes, Notability ve sunumlara yapıştırmalık
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
              <div className="text-xs font-extrabold">Vektörel SVG</div>
              <div className="text-[11px] opacity-65">
                Sonsuz ölçeklenebilir kübik Bezier & çapraz ok çıktısı
              </div>
            </button>
          </div>

          {/* Realtime Collaboration Link */}
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
                Canlı Ortak Çalışma Odası ({collaborators.length} Katılımcı)
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
                    Kopyalandı
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5" />
                    Linki Kopyala
                  </>
                )}
              </button>
            </div>
          </div>

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
              .zihin Yedek İçe Aktar
            </button>
            <button
              type="button"
              onClick={() => void handleExportZihin()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold opacity-80 hover:bg-slate-500/10 hover:opacity-100"
            >
              <Download className="h-3.5 w-3.5" />
              .zihin Yedek İndir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
