import { unzipSync, strFromU8 } from 'fflate';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { MindNode, StickerAsset } from '../../types/mindmap';
import {
  classifySlidePage,
  filterAndCleanAcademicLine,
  isAcademicBoilerplateLine,
  isFormulaExpression,
  stripCourseCodePrefix,
} from './AcademicContentFilter';

export interface ExtractedDocumentImage {
  id: string;
  pageIndex: number; // 1-based page or slide number
  dataUrl: string;
  aspectRatio: number;
  width: number;
  height: number;
  nearbyHeading: string;
  nearbyText: string;
  selected: boolean;
}

export interface DocumentExtractionResult {
  fileName: string;
  fileType: 'pdf' | 'docx' | 'pptx' | 'text';
  pageCount: number;
  extractedText: string;
  images: ExtractedDocumentImage[];
  warnings: string[];
  isScannedLikely: boolean;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB safety guard
const MAX_ZIP_UNCOMPRESSED_BYTES = 45 * 1024 * 1024; // Zip-bomb defense
const MAX_PDF_PAGES = 35;
const MAX_EXTRACTED_IMAGES = 12;
const TARGET_IMAGE_MAX_EDGE = 360;

const TR_STOPWORDS = new Set([
  've', 'veya', 'ile', 'bir', 'bu', 'su', 'o', 'da', 'de', 'ki', 'icin', 'gibi', 'daha', 'cok',
  'olarak', 'olan', 'olanlar', 'her', 'hem', 'ya', 'ne', 'ama', 'fakat', 'ancak', 'gore', 'kadar',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'into', 'about',
]);

function normalizeTokens(text: string): string[] {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TR_STOPWORDS.has(w));
}

function stripFileExtension(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inspects a rendered canvas to reject blank boxes, solid color rectangles, and compute a fast 64-bit average hash
 * so repeated university logos / slide watermarks across 3+ pages can be filtered out automatically.
 */
function analyzeCanvasImage(canvas: HTMLCanvasElement): {
  isMeaningful: boolean;
  aHash: string;
} {
  const thumb = document.createElement('canvas');
  thumb.width = 8;
  thumb.height = 8;
  const tctx = thumb.getContext('2d', { willReadFrequently: true });
  if (!tctx) return { isMeaningful: true, aHash: '' };

  tctx.fillStyle = '#FFFFFF';
  tctx.fillRect(0, 0, 8, 8);
  tctx.drawImage(canvas, 0, 0, 8, 8);
  const pixels = tctx.getImageData(0, 0, 8, 8).data;

  const lums: number[] = [];
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    lums.push(lum);
    sum += lum;
  }
  const mean = sum / lums.length;
  let variance = 0;
  for (const l of lums) {
    const diff = l - mean;
    variance += diff * diff;
  }
  const stdDev = Math.sqrt(variance / lums.length);

  // Reject blank white boxes, solid colored banners, or near-empty backgrounds
  if (stdDev < 14) {
    return { isMeaningful: false, aHash: '' };
  }

  let hashBits = '';
  for (const l of lums) {
    hashBits += l >= mean ? '1' : '0';
  }
  return { isMeaningful: true, aHash: hashBits };
}

function compressCanvasToDataUrl(sourceCanvas: HTMLCanvasElement): {
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
} {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const scale = Math.min(1, TARGET_IMAGE_MAX_EDGE / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  if (!ctx) {
    return {
      dataUrl: sourceCanvas.toDataURL('image/jpeg', 0.82),
      width: srcW,
      height: srcH,
      aspectRatio: srcW / Math.max(1, srcH),
    };
  }
  // Crisp white backdrop so transparent PNG textbook diagrams look clean on both light & dark cards
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, outW, outH);

  return {
    dataUrl: out.toDataURL('image/jpeg', 0.82),
    width: outW,
    height: outH,
    aspectRatio: Number((outW / Math.max(1, outH)).toFixed(3)),
  };
}

interface RawCandidateImage {
  pageIndex: number;
  dataUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  aHash: string;
  nearbyHeading: string;
  nearbyText: string;
}

function hammingDistance64(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

function filterRepeatedLogosAndCap(
  candidates: RawCandidateImage[],
  pageCount: number
): ExtractedDocumentImage[] {
  // Cluster perceptually near-identical images (Hamming distance <= 4) across pages
  // so repeated university logos / slide headers / footers are reliably eliminated!
  const clusters: Array<{ repHash: string; pages: Set<number> }> = [];
  const candidateClusterIdx: number[] = [];

  for (const c of candidates) {
    if (!c.aHash) {
      candidateClusterIdx.push(-1);
      continue;
    }
    let matchedIdx = -1;
    for (let i = 0; i < clusters.length; i++) {
      if (hammingDistance64(clusters[i].repHash, c.aHash) <= 4) {
        matchedIdx = i;
        break;
      }
    }
    if (matchedIdx >= 0) {
      clusters[matchedIdx].pages.add(c.pageIndex);
      candidateClusterIdx.push(matchedIdx);
    } else {
      clusters.push({ repHash: c.aHash, pages: new Set([c.pageIndex]) });
      candidateClusterIdx.push(clusters.length - 1);
    }
  }

  const seenClusterIds = new Set<number>();
  const kept: ExtractedDocumentImage[] = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const c = candidates[idx];
    const clusterIdx = candidateClusterIdx[idx];
    if (clusterIdx >= 0) {
      const pageHits = clusters[clusterIdx].pages.size;
      // In multi-slide decks (>= 3 pages), ANY graphic repeated across >= 2 slides is a template logo/watermark!
      if (pageCount >= 3 && pageHits >= 2) {
        continue;
      }
      if (seenClusterIds.has(clusterIdx)) continue;
      seenClusterIds.add(clusterIdx);
    }

    kept.push({
      id: `docimg_p${c.pageIndex}_${kept.length + 1}`,
      pageIndex: c.pageIndex,
      dataUrl: c.dataUrl,
      aspectRatio: c.aspectRatio,
      width: c.width,
      height: c.height,
      nearbyHeading: c.nearbyHeading,
      nearbyText: c.nearbyText,
      selected: true,
    });

    if (kept.length >= MAX_EXTRACTED_IMAGES) break;
  }

  return kept;
}

async function decodeImageBlobToCandidate(
  bytes: Uint8Array,
  mime: string,
  pageIndex: number,
  nearbyHeading: string,
  nearbyText: string
): Promise<RawCandidateImage | null> {
  if (bytes.byteLength < 1200 || bytes.byteLength > 8 * 1024 * 1024) return null;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime });
  const objUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const timer = window.setTimeout(() => reject(new Error('Image decode timeout')), 2500);
      el.onload = () => {
        window.clearTimeout(timer);
        resolve(el);
      };
      el.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Image decode error'));
      };
      el.src = objUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < 92 || h < 92) return null;
    const ar = w / Math.max(1, h);
    if (ar > 3.8 || ar < 0.26) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);

    const analysis = analyzeCanvasImage(canvas);
    if (!analysis.isMeaningful) return null;

    const compressed = compressCanvasToDataUrl(canvas);
    return {
      pageIndex,
      dataUrl: compressed.dataUrl,
      width: compressed.width,
      height: compressed.height,
      aspectRatio: compressed.aspectRatio,
      aHash: analysis.aHash,
      nearbyHeading,
      nearbyText,
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

interface PdfRawImgObject {
  width?: number;
  height?: number;
  bitmap?: ImageBitmap;
  data?: Uint8ClampedArray | Uint8Array;
  kind?: number;
}

async function resolvePdfObjSafe(
  store: { has?: (k: string) => boolean; get: (k: string, cb?: (v: unknown) => void) => unknown },
  name: string
): Promise<PdfRawImgObject | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 900);
    try {
      if (typeof store.has === 'function' && store.has(name)) {
        const direct = store.get(name);
        if (direct) {
          window.clearTimeout(timer);
          resolve(direct as PdfRawImgObject);
          return;
        }
      }
      store.get(name, (obj: unknown) => {
        window.clearTimeout(timer);
        resolve((obj as PdfRawImgObject) || null);
      });
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

function pdfImageObjToCanvas(
  imgObj: PdfRawImgObject,
  imageKind: { GRAYSCALE_1BPP?: number; RGB_24BPP?: number; RGBA_32BPP?: number }
): HTMLCanvasElement | null {
  const w = Number(imgObj.width || imgObj.bitmap?.width || 0);
  const h = Number(imgObj.height || imgObj.bitmap?.height || 0);
  if (w < 92 || h < 92) return null;
  const ar = w / Math.max(1, h);
  if (ar > 3.8 || ar < 0.26) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (imgObj.bitmap) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imgObj.bitmap, 0, 0, w, h);
    return canvas;
  }

  const raw = imgObj.data;
  if (!raw || raw.length === 0) return null;

  const rgba = ctx.createImageData(w, h);
  const dst = rgba.data;
  const pixelCount = w * h;

  if (imgObj.kind === imageKind.RGBA_32BPP || raw.length === pixelCount * 4) {
    dst.set(raw.subarray(0, pixelCount * 4));
    ctx.putImageData(rgba, 0, 0);
    return canvas;
  }

  if (imgObj.kind === imageKind.RGB_24BPP || raw.length === pixelCount * 3) {
    let s = 0;
    let d = 0;
    for (let p = 0; p < pixelCount; p++) {
      dst[d++] = raw[s++];
      dst[d++] = raw[s++];
      dst[d++] = raw[s++];
      dst[d++] = 255;
    }
    ctx.putImageData(rgba, 0, 0);
    return canvas;
  }

  // Skip 1-bit stencil masks (almost always text masks/transparency masks, not photos)
  return null;
}

async function extractPdfDocument(
  file: File,
  onProgress?: (label: string, pct: number) => void
): Promise<DocumentExtractionResult> {
  onProgress?.('PDF motoru hazırlanıyor...', 8);
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pagesToRead = Math.min(totalPages, MAX_PDF_PAGES);
  const warnings: string[] = [];
  if (totalPages > MAX_PDF_PAGES) {
    warnings.push(
      `PDF ${totalPages} sayfa içeriyor; yüksek hız için ilk ${MAX_PDF_PAGES} sayfa analiz edildi.`
    );
  }

  interface PageLine {
    text: string;
    fontSize: number;
    y: number;
  }
  const pagesLines: Array<{
    pageIndex: number;
    lines: PageLine[];
    isCoverSlide: boolean;
    isNonContentSlide: boolean;
    inferredTopicTitle?: string;
    inferredCourseTitle?: string;
  }> = [];
  const allFontSizes: number[] = [];
  const rawImageCandidates: RawCandidateImage[] = [];
  let lastContentHeading = '';

  for (let p = 1; p <= pagesToRead; p++) {
    onProgress?.(
      `PDF sayfa ${p}/${pagesToRead} okunuyor ve görseller taranıyor...`,
      12 + Math.round((p / pagesToRead) * 76)
    );
    const page = await pdfDoc.getPage(p);

    // 1. Reconstruct lines sorted in true top-to-bottom, left-to-right visual reading order
    //    (prevents PowerPoint PDF z-order scrambling where footers/instructor names appear before titles!)
    const textContent = await page.getTextContent();
    const rawItems = (textContent.items || []) as Array<{
      str?: string;
      transform?: number[];
      hasEOL?: boolean;
    }>;

    const lineBuckets: Array<{
      y: number;
      chunks: Array<{ x: number; str: string }>;
      maxFont: number;
    }> = [];
    for (const item of rawItems) {
      const str = (item.str || '').replace(/\s+/g, ' ');
      if (!str.trim()) continue;
      const tr = item.transform || [12, 0, 0, 12, 0, 0];
      const fontSize = Math.round(Math.hypot(tr[0] || 0, tr[1] || 0) * 10) / 10 || 11;
      const x = Number(tr[4] || 0);
      const y = Math.round((tr[5] || 0) / 3) * 3;
      if (str.trim().length >= 4) allFontSizes.push(fontSize);

      const existing = lineBuckets.find((b) => Math.abs(b.y - y) <= 5);
      if (existing) {
        existing.chunks.push({ x, str });
        if (fontSize > existing.maxFont) existing.maxFont = fontSize;
      } else {
        lineBuckets.push({ y, chunks: [{ x, str }], maxFont: fontSize });
      }
    }

    // PDF Y coordinates grow upward -> sort descending for top-to-bottom visual reading order
    lineBuckets.sort((a, b) => b.y - a.y);

    const lines: PageLine[] = lineBuckets
      .map((b) => {
        b.chunks.sort((c1, c2) => c1.x - c2.x);
        return {
          text: b.chunks
            .map((c) => c.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
          fontSize: b.maxFont,
          y: b.y,
        };
      })
      .filter((l) => l.text.length > 0);

    const pageClass = classifySlidePage(
      lines.map((l) => l.text),
      p,
      pagesToRead
    );

    pagesLines.push({
      pageIndex: p,
      lines,
      isCoverSlide: pageClass.isCoverSlide,
      isNonContentSlide: pageClass.isNonContentSlide,
      inferredTopicTitle: pageClass.inferredTopicTitle,
      inferredCourseTitle: pageClass.inferredCourseTitle,
    });

    // Skip ALL images on Cover Slides (university logos/emblems), Thank-You slides, TOC & References slides!
    if (pageClass.isNonContentSlide) {
      page.cleanup();
      continue;
    }

    const cleanedContentLines = lines
      .map((l) => filterAndCleanAcademicLine(l.text))
      .filter((t) => t.length > 0);

    const pageCleanHeading =
      cleanedContentLines.find(
        (t) =>
          t.length >= 3 &&
          t.length <= 75 &&
          !isFormulaExpression(t) &&
          !/[.!?]$/.test(t)
      ) ||
      lastContentHeading ||
      `Sayfa ${p}`;

    if (pageCleanHeading && !/^Sayfa\s+\d+$/i.test(pageCleanHeading)) {
      lastContentHeading = pageCleanHeading;
    }

    const pageCleanBody = cleanedContentLines.join(' ');

    // 2. Scan embedded images on real educational content pages via getOperatorList()
    try {
      const opList = await page.getOperatorList();
      const seenNamesOnPage = new Set<string>();
      const OPS = pdfjs.OPS as Record<string, number>;
      const IMG_OPS = new Set<number>(
        [
          OPS.paintImageXObject,
          OPS.paintJpegXObject,
          OPS.paintInlineImageXObject,
          OPS.paintImageXObjectRepeat,
        ].filter((v): v is number => typeof v === 'number')
      );

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        if (!IMG_OPS.has(fn)) continue;
        const args = opList.argsArray[i];
        if (!args || !args[0]) continue;

        let imgObj: PdfRawImgObject | null = null;
        if (fn === OPS.paintInlineImageXObject && typeof args[0] === 'object') {
          imgObj = args[0] as PdfRawImgObject;
        } else if (typeof args[0] === 'string') {
          const objName = args[0];
          if (seenNamesOnPage.has(objName)) continue;
          seenNamesOnPage.add(objName);
          imgObj = objName.startsWith('g_')
            ? await resolvePdfObjSafe(page.commonObjs as unknown as Parameters<typeof resolvePdfObjSafe>[0], objName)
            : await resolvePdfObjSafe(page.objs as unknown as Parameters<typeof resolvePdfObjSafe>[0], objName);
        }

        if (!imgObj) continue;
        const canvas = pdfImageObjToCanvas(
          imgObj,
          pdfjs.ImageKind as { GRAYSCALE_1BPP?: number; RGB_24BPP?: number; RGBA_32BPP?: number }
        );
        if (!canvas) continue;

        const analysis = analyzeCanvasImage(canvas);
        if (!analysis.isMeaningful) continue;

        const compressed = compressCanvasToDataUrl(canvas);
        rawImageCandidates.push({
          pageIndex: p,
          dataUrl: compressed.dataUrl,
          width: compressed.width,
          height: compressed.height,
          aspectRatio: compressed.aspectRatio,
          aHash: analysis.aHash,
          nearbyHeading: pageCleanHeading,
          nearbyText: pageCleanBody.slice(0, 650),
        });
      }
    } catch {
      // Non-fatal: continue text extraction even if one page has an unsupported image stream
    }

    page.cleanup();
  }

  // Detect recurring slide headers/footers repeated across >= 3 pages (stripping trailing page numbers like `2 / 7`!)
  const normalizeForRunningLine = (txt: string) =>
    txt
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLocaleLowerCase('tr-TR')
      .replace(/i\u0307/g, 'i')
      .replace(/\s+\d{1,3}(?:\s*\/\s*\d{1,3})?\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

  const linePageCounts = new Map<string, Set<number>>();
  for (const pg of pagesLines) {
    if (pg.isNonContentSlide) continue;
    for (const l of pg.lines) {
      const key = normalizeForRunningLine(l.text);
      if (key.length < 3 || key.length > 90 || isFormulaExpression(l.text)) continue;
      const set = linePageCounts.get(key) ?? new Set<number>();
      set.add(pg.pageIndex);
      linePageCounts.set(key, set);
    }
  }
  const repeatedRunningLines = new Set<string>();
  const contentPageCount = pagesLines.filter((pg) => !pg.isNonContentSlide).length;
  if (contentPageCount >= 3) {
    for (const [normKey, pSet] of linePageCounts.entries()) {
      if (pSet.size >= 3 && pSet.size / contentPageCount >= 0.45) {
        repeatedRunningLines.add(normKey);
      }
    }
  }

  // Compute median body font size across content pages so headings are tagged cleanly with `## `
  const contentFonts: number[] = [];
  for (const pg of pagesLines) {
    if (pg.isNonContentSlide) continue;
    for (const l of pg.lines) {
      if (l.text.length >= 4) contentFonts.push(l.fontSize);
    }
  }
  const sortedFonts = (contentFonts.length > 0 ? contentFonts : allFontSizes).sort((a, b) => a - b);
  const medianFont = sortedFonts.length > 0 ? sortedFonts[Math.floor(sortedFonts.length * 0.5)] : 11;
  const headingThreshold = medianFont * 1.18;

  // Infer cleanest lecture title from Cover Slide (preferring topic title like `Eğri Uydurma` over `BZ 204`)
  const coverPage = pagesLines.find((pg) => pg.isCoverSlide);
  const inferredTitle =
    coverPage?.inferredTopicTitle ||
    coverPage?.inferredCourseTitle ||
    stripCourseCodePrefix(stripFileExtension(file.name)) ||
    'PDF Ders Notu';

  const formattedPages: string[] = [];
  let totalRawTextChars = 0;

  for (const pg of pagesLines) {
    for (const line of pg.lines) {
      totalRawTextChars += line.text.length;
    }
    if (pg.isNonContentSlide) continue;

    const outLines: string[] = [];
    for (const line of pg.lines) {
      const normKey = normalizeForRunningLine(line.text);
      if (repeatedRunningLines.has(normKey)) continue;

      const cleaned = filterAndCleanAcademicLine(line.text);
      if (!cleaned) continue;

      const isFormula = isFormulaExpression(cleaned);
      const isHeadingLine =
        !isFormula &&
        line.fontSize >= headingThreshold &&
        cleaned.length >= 3 &&
        cleaned.length <= 82 &&
        !/[.!?]$/.test(cleaned);

      if (isHeadingLine) {
        outLines.push(`## ${cleaned}`);
      } else {
        // Rejoin wrapped PDF body continuation line (e.g. line 1 ends mid-clause, line 2 starts lowercase `edilir.` / `doğrusal forma indirgenir.`)
        const prevIdx = outLines.length - 1;
        const prev = prevIdx >= 0 ? outLines[prevIdx] : '';
        if (
          prev &&
          !prev.startsWith('## ') &&
          !isFormula &&
          !isFormulaExpression(prev) &&
          !/[.!?:]$/.test(prev) &&
          /^[a-zçğıöşü]/.test(cleaned)
        ) {
          outLines[prevIdx] = `${prev} ${cleaned}`;
        } else {
          outLines.push(cleaned);
        }
      }
    }
    if (outLines.length > 0) {
      formattedPages.push(outLines.join('\n'));
    }
  }

  const isScannedLikely = totalRawTextChars < 80;
  let extractedText = formattedPages.join('\n\n').trim();
  if (!extractedText) {
    extractedText = `${inferredTitle}\n- Ana Konular\n- Önemli Kavramlar\n- Temel Formüller`;
    warnings.push(
      'Bu PDF metin katmanı içermeyen taranmış görsel olabilir. İçindeki görseller çıkarıldı; dilerseniz ana başlıkları metin kutusundan düzenleyebilirsiniz.'
    );
  } else {
    // Always lead with the clean inferred lecture topic title (not an admin cover line!)
    const firstLinePlain = extractedText.split('\n')[0].replace(/^#{1,5}\s+/, '').trim();
    const sameAsFirst =
      firstLinePlain.toLocaleLowerCase('tr-TR') === inferredTitle.toLocaleLowerCase('tr-TR');
    if (coverPage && !sameAsFirst) {
      extractedText = `${inferredTitle}\n\n${extractedText}`;
    } else if (!extractedText.startsWith('#') && firstLinePlain.length > 72) {
      extractedText = `${inferredTitle}\n\n${extractedText}`;
    }
  }

  const images = filterRepeatedLogosAndCap(rawImageCandidates, Math.max(1, contentPageCount));
  await loadingTask.destroy();
  onProgress?.('PDF analizi tamamlandı', 100);

  return {
    fileName: file.name,
    fileType: 'pdf',
    pageCount: totalPages,
    extractedText,
    images,
    warnings,
    isScannedLikely,
  };
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function safeUnzipOfficeArchive(bytes: Uint8Array): Record<string, Uint8Array> {
  let totalUncompressed = 0;
  const entries = unzipSync(bytes, {
    filter(file) {
      totalUncompressed += file.originalSize;
      if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
        throw new Error('Belge içeriği güvenlik boyut sınırını aşıyor.');
      }
      return /^(?:word\/|ppt\/)/i.test(file.name);
    },
  });
  return entries;
}

function guessImageMime(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

async function extractDocxDocument(
  file: File,
  onProgress?: (label: string, pct: number) => void
): Promise<DocumentExtractionResult> {
  onProgress?.('Word belgesi (.docx) açılıyor...', 20);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = safeUnzipOfficeArchive(bytes);
  const docXmlBytes = files['word/document.xml'];
  if (!docXmlBytes) {
    throw new Error('Geçersiz Word (.docx) dosyası: belge içeriği bulunamadı.');
  }

  const xml = strFromU8(docXmlBytes);
  const paragraphs: string[] = [];
  const paraRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;

  while ((m = paraRe.exec(xml)) !== null) {
    const pBody = m[1];
    const isHeading =
      /<w:pStyle\b[^>]*w:val="(?:Heading|Title|Subtitle|Ba[şs]l[ıi]k)[^"]*"/i.test(pBody);
    const texts: string[] = [];
    const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(pBody)) !== null) {
      texts.push(decodeXmlEntities(tm[1]));
    }
    const line = texts.join('').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const cleaned = filterAndCleanAcademicLine(line);
    if (!cleaned) continue;
    const isFormula = isFormulaExpression(cleaned);
    paragraphs.push(isHeading && !isFormula && cleaned.length <= 85 ? `## ${cleaned}` : cleaned);
  }

  onProgress?.('Word içindeki görseller taranıyor...', 65);
  const rawCandidates: RawCandidateImage[] = [];
  const mediaKeys = Object.keys(files).filter((k) => k.startsWith('word/media/'));
  const docSnippet = paragraphs.slice(0, 12).join(' ').slice(0, 500);
  const docTitle = stripFileExtension(file.name) || 'Word Belgesi';

  for (let i = 0; i < mediaKeys.length && rawCandidates.length < MAX_EXTRACTED_IMAGES * 2; i++) {
    const k = mediaKeys[i];
    const mime = guessImageMime(k);
    if (!mime) continue;
    const cand = await decodeImageBlobToCandidate(files[k], mime, i + 1, docTitle, docSnippet);
    if (cand) rawCandidates.push(cand);
  }

  const images = filterRepeatedLogosAndCap(rawCandidates, Math.max(1, Math.ceil(paragraphs.length / 8)));
  const bodyText = paragraphs.join('\n').trim();
  const extractedText = bodyText
    ? bodyText.startsWith('#') || (paragraphs[0]?.length ?? 0) <= 68
      ? bodyText
      : `${docTitle}\n\n${bodyText}`
    : `${docTitle}\n- Ana Başlıklar`;

  onProgress?.('Word belgesi hazır', 100);
  return {
    fileName: file.name,
    fileType: 'docx',
    pageCount: Math.max(1, Math.ceil(paragraphs.length / 18)),
    extractedText,
    images,
    warnings: [],
    isScannedLikely: bodyText.length < 40,
  };
}

async function extractPptxDocument(
  file: File,
  onProgress?: (label: string, pct: number) => void
): Promise<DocumentExtractionResult> {
  onProgress?.('PowerPoint sunumu (.pptx) açılıyor...', 18);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = safeUnzipOfficeArchive(bytes);

  const slideKeys = Object.keys(files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return na - nb;
    });

  if (slideKeys.length === 0) {
    throw new Error('Geçersiz PowerPoint (.pptx) dosyası: slayt bulunamadı.');
  }

  const slidesToRead = slideKeys.slice(0, MAX_PDF_PAGES);
  const warnings: string[] = [];
  if (slideKeys.length > MAX_PDF_PAGES) {
    warnings.push(`Sunum ${slideKeys.length} slayt içeriyor; ilk ${MAX_PDF_PAGES} slayt analiz edildi.`);
  }

  const slideBlocks: string[] = [];
  const rawCandidates: RawCandidateImage[] = [];
  let pptCoverTitle: string | undefined;
  let lastPptHeading = '';
  let pptContentSlides = 0;

  for (let idx = 0; idx < slidesToRead.length; idx++) {
    const slideNum = idx + 1;
    onProgress?.(
      `Slayt ${slideNum}/${slidesToRead.length} okunuyor...`,
      20 + Math.round((slideNum / slidesToRead.length) * 72)
    );
    const xml = strFromU8(files[slidesToRead[idx]]);
    const paras: string[] = [];
    const pRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(xml)) !== null) {
      const texts: string[] = [];
      const tRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
      let tm: RegExpExecArray | null;
      while ((tm = tRe.exec(pm[1])) !== null) {
        texts.push(decodeXmlEntities(tm[1]));
      }
      const line = texts.join('').replace(/\s+/g, ' ').trim();
      if (line) paras.push(line);
    }

    const slideClass = classifySlidePage(paras, slideNum, slidesToRead.length);
    if (slideClass.isCoverSlide && !pptCoverTitle) {
      pptCoverTitle = slideClass.inferredTopicTitle || slideClass.inferredCourseTitle;
    }
    if (slideClass.isNonContentSlide) {
      continue;
    }

    const cleanedParas = paras
      .map((p) => filterAndCleanAcademicLine(p))
      .filter((p) => p.length > 0);
    if (cleanedParas.length === 0) continue;

    pptContentSlides++;
    const firstIsFormula = isFormulaExpression(cleanedParas[0]);
    const slideHeading =
      (!firstIsFormula && cleanedParas[0].length <= 82 ? cleanedParas[0] : lastPptHeading) ||
      `Slayt ${slideNum}`;
    if (!firstIsFormula && cleanedParas[0].length <= 82) {
      lastPptHeading = cleanedParas[0];
    }

    const lines = firstIsFormula
      ? cleanedParas.map((p) => `- ${p}`)
      : [`## ${cleanedParas[0]}`, ...cleanedParas.slice(1).map((p) => `- ${p}`)];
    slideBlocks.push(lines.join('\n'));

    // Parse slide relationships to map slide images directly to this exact slide number!
    const slideFileName = slidesToRead[idx].split('/').pop() || '';
    const relsKey = `ppt/slides/_rels/${slideFileName}.rels`;
    const relsBytes = files[relsKey];
    if (relsBytes) {
      const relsXml = strFromU8(relsBytes);
      const targetRe = /Target="([^"]*media\/[^"]+)"/gi;
      let rm: RegExpExecArray | null;
      while ((rm = targetRe.exec(relsXml)) !== null) {
        const mediaName = rm[1].split('/').pop() || '';
        const mediaPath = `ppt/media/${mediaName}`;
        const mediaBytes = files[mediaPath];
        const mime = guessImageMime(mediaPath);
        if (!mediaBytes || !mime) continue;
        const cand = await decodeImageBlobToCandidate(
          mediaBytes,
          mime,
          slideNum,
          slideHeading,
          cleanedParas.join(' ').slice(0, 600)
        );
        if (cand) rawCandidates.push(cand);
      }
    }
  }

  const images = filterRepeatedLogosAndCap(rawCandidates, Math.max(1, pptContentSlides));
  const deckTitle =
    pptCoverTitle || stripCourseCodePrefix(stripFileExtension(file.name)) || 'Sunum Haritası';
  const extractedText = `${deckTitle}\n\n${slideBlocks.join('\n\n')}`.trim();
  onProgress?.('Sunum analizi tamamlandı', 100);

  return {
    fileName: file.name,
    fileType: 'pptx',
    pageCount: slideKeys.length,
    extractedText,
    images,
    warnings,
    isScannedLikely: slideBlocks.length === 0,
  };
}

export async function extractDocumentForMindMap(
  file: File,
  onProgress?: (label: string, pct: number) => void
): Promise<DocumentExtractionResult> {
  if (!file) {
    throw new Error('Dosya seçilmedi.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Dosya boyutu çok büyük (maksimum 20 MB desteklenir).');
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    return extractPdfDocument(file, onProgress);
  }
  if (
    lower.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return extractDocxDocument(file, onProgress);
  }
  if (
    lower.endsWith('.pptx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return extractPptxDocument(file, onProgress);
  }
  if (
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.csv') ||
    file.type.startsWith('text/')
  ) {
    onProgress?.('Metin dosyası okunuyor...', 50);
    const text = (await file.text()).trim();
    const title = stripFileExtension(file.name) || 'Belge Haritası';
    const extractedText =
      text.length === 0
        ? title
        : text.split(/\r?\n/)[0].length <= 72
        ? text
        : `${title}\n\n${text}`;
    onProgress?.('Belge hazır', 100);
    return {
      fileName: file.name,
      fileType: 'text',
      pageCount: 1,
      extractedText,
      images: [],
      warnings: [],
      isScannedLikely: false,
    };
  }

  throw new Error('Desteklenmeyen dosya türü. PDF, Word (.docx), PowerPoint (.pptx), TXT veya MD seçin.');
}

/**
 * Matches extracted PDF / Slide / Word photos to the most semantically relevant mind-map branches
 * (using Turkish-normalized token overlap against nearby heading & page text, plus document order affinity).
 * Each photo is assigned to AT MOST ONE best-matching branch so no duplicate photos clutter the map;
 * all remaining branches keep receiving crisp vector icons from our 45,500+ offline catalog!
 */
export function attachDocumentImagesToBestBranches(
  nodes: Record<string, MindNode>,
  rootId: string,
  images: ExtractedDocumentImage[]
): number {
  const activeImages = images.filter((img) => img.selected && img.dataUrl);
  if (activeImages.length === 0) return 0;

  const candidateNodes = Object.values(nodes).filter((n) => n.id !== rootId && !n.sticker);
  if (candidateNodes.length === 0) return 0;

  const totalNodes = candidateNodes.length;
  const maxPage = Math.max(...activeImages.map((i) => i.pageIndex), 1);

  interface MatchPair {
    node: MindNode;
    image: ExtractedDocumentImage;
    score: number;
    headingHits: number;
    bodyHits: number;
    orderAffinity: number;
  }
  const pairs: MatchPair[] = [];

  candidateNodes.forEach((node, nodeIdx) => {
    if (isAcademicBoilerplateLine(node.title)) return;
    const nodeTokens = new Set(normalizeTokens(`${node.title} ${node.note || ''} ${node.techBadge || ''}`));
    const nodeRelPos = nodeIdx / Math.max(1, totalNodes - 1);
    const nodeHasFormula =
      isFormulaExpression(node.title) ||
      isFormulaExpression(node.techBadge || '') ||
      /formül|denklem|regresyon|model|grafik|eğri/iu.test(`${node.title} ${node.note || ''}`);

    for (const img of activeImages) {
      const headingTokens = normalizeTokens(img.nearbyHeading);
      const bodyTokens = normalizeTokens(img.nearbyText);

      let headingHits = 0;
      for (const t of headingTokens) {
        if (nodeTokens.has(t)) headingHits++;
      }
      let bodyHits = 0;
      for (const t of bodyTokens) {
        if (nodeTokens.has(t)) bodyHits++;
      }

      const imgRelPos = (img.pageIndex - 1) / Math.max(1, maxPage - 1);
      const orderAffinity = Math.max(0, 1 - Math.abs(nodeRelPos - imgRelPos));
      const isMainBranchBonus = node.parentId === rootId ? 0.35 : 0;
      const formulaAffinity =
        nodeHasFormula && /[=∑∫^]|formül|denklem|grafik|eğri|regresyon/iu.test(`${img.nearbyHeading} ${img.nearbyText}`)
          ? 0.45
          : 0;

      const score =
        headingHits * 3.2 +
        Math.min(5, bodyHits) * 1.05 +
        orderAffinity * 0.75 +
        isMainBranchBonus +
        formulaAffinity;
      pairs.push({ node, image: img, score, headingHits, bodyHits, orderAffinity });
    }
  });

  pairs.sort((a, b) => b.score - a.score);

  const usedNodeIds = new Set<string>();
  const usedImageIds = new Set<string>();
  let attachedCount = 0;

  // Cap how many branches get document photos so icons & document figures stay balanced
  const maxPhotoBranches = Math.min(activeImages.length, Math.max(1, Math.ceil(candidateNodes.length * 0.65)));

  for (const pair of pairs) {
    if (attachedCount >= maxPhotoBranches) break;
    if (usedNodeIds.has(pair.node.id) || usedImageIds.has(pair.image.id)) continue;
    // STRICT SEMANTIC GATE: NEVER slap a PDF image onto an unrelated branch with zero keyword overlap!
    const hasRealSemanticMatch =
      pair.headingHits >= 1 ||
      pair.bodyHits >= 2 ||
      (pair.bodyHits >= 1 && pair.orderAffinity >= 0.45);
    if (!hasRealSemanticMatch || pair.score < 1.55) continue;

    const sticker: StickerAsset = {
      id: `docphoto_${pair.image.id}`,
      url: pair.image.dataUrl,
      mode: 'photo',
      source: 'user_photo',
      dieCutProcessed: false,
      aspectRatio: pair.image.aspectRatio,
      label: `Belge Görseli (S.${pair.image.pageIndex})`,
      badgeEmoji: '📄',
    };
    pair.node.sticker = sticker;
    usedNodeIds.add(pair.node.id);
    usedImageIds.add(pair.image.id);
    attachedCount += 1;
  }

  return attachedCount;
}
