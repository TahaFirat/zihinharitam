/// <reference lib="webworker" />

export type WorkerBgMode = 'none' | 'auto_clean' | 'diagram_enhance';

export interface StickerWorkerRequest {
  id: number;
  bitmap: ImageBitmap;
  backgroundMode: WorkerBgMode;
  contourRadius: number;
  maxSize: number;
  rotationDeg: number;
}

export interface StickerWorkerResponse {
  id: number;
  ok: boolean;
  blob?: Blob;
  aspectRatio?: number;
  detectedDiagramCard?: boolean;
  error?: string;
}

function perceptualDeltaE(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const rMean = (r1 + r2) * 0.5;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  const wR = 2 + rMean / 256;
  const wG = 4.0;
  const wB = 2 + (255 - rMean) / 256;
  return Math.sqrt(wR * dr * dr + wG * dg * dg + wB * db * db) / 7.65;
}

/**
 * Smart Content Type Detector (Module 4.2):
 * Detects fine-line schematics, circuit diagrams, ECGs, blueprints, and text-labeled plates
 * by measuring bright paper interior ratio + rapid high-frequency stroke transitions.
 * Schematics MUST NEVER undergo Flood-Fill (which chews open fine-line interiors!).
 */
function isTechnicalDiagramOrSchematic(imageData: ImageData): boolean {
  const { width, height, data } = imageData;
  if (width < 24 || height < 24) return false;

  const x0 = Math.floor(width * 0.14);
  const x1 = Math.ceil(width * 0.86);
  const y0 = Math.floor(height * 0.14);
  const y1 = Math.ceil(height * 0.86);

  let sampleCount = 0;
  let brightPaperPixels = 0;
  let sharpStrokeTransitions = 0;
  let transparentPixels = 0;

  for (let y = y0; y < y1; y += 2) {
    let prevLum = -1;
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      sampleCount++;
      if (a < 32) {
        transparentPixels++;
        prevLum = 255;
        continue;
      }
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

      if (lum > 212 && sat < 0.14) {
        brightPaperPixels++;
      }
      if (prevLum >= 0 && Math.abs(lum - prevLum) > 78) {
        sharpStrokeTransitions++;
      }
      prevLum = lum;
    }
  }

  if (sampleCount === 0) return false;
  // Already transparent PNG icon with sparse lines -> treat as schematic if thin strokes dominate
  const transparentRatio = transparentPixels / sampleCount;
  const brightRatio = brightPaperPixels / sampleCount;
  const edgeDensity = sharpStrokeTransitions / sampleCount;

  if (transparentRatio > 0.45 && edgeDensity > 0.06) {
    return true;
  }
  return brightRatio > 0.50 && edgeDensity > 0.048;
}

function enhanceSchematicContrastInPlace(imageData: ImageData): void {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 16) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum < 175) {
      data[i] = Math.max(0, Math.min(255, Math.round((r - 128) * 1.26 + 114)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 128) * 1.26 + 114)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 128) * 1.26 + 114)));
    } else if (lum > 238) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
}

function stripBackgroundPerimeterBFS(imageData: ImageData, maxDeltaE = 26): void {
  const { width, height, data } = imageData;
  const total = width * height;
  if (total === 0) return;

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let opaqueSamples = 0;

  for (const [cx, cy] of corners) {
    const idx = (cy * width + cx) * 4;
    if (data[idx + 3] < 24) continue;
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
    opaqueSamples++;
  }

  if (opaqueSamples < 2) return;

  const bgR = sumR / opaqueSamples;
  const bgG = sumG / opaqueSamples;
  const bgB = sumB / opaqueSamples;

  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (data[i + 3] === 0) {
      visited[p] = 1;
      queue[tail++] = p;
      return;
    }
    const dE = perceptualDeltaE(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB);
    if (dE <= maxDeltaE) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    if (x + 1 < width) tryEnqueue(x + 1, y);
    if (x - 1 >= 0) tryEnqueue(x - 1, y);
    if (y + 1 < height) tryEnqueue(x, y + 1);
    if (y - 1 >= 0) tryEnqueue(x, y - 1);
  }

  // Soft 1.5px boundary feathering
  const featherLimit = maxDeltaE * 1.48;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (visited[p]) continue;
      if (visited[p - 1] || visited[p + 1] || visited[p - width] || visited[p + width]) {
        const i = p * 4;
        const dE = perceptualDeltaE(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB);
        if (dE < featherLimit) {
          const ratio = Math.max(0.18, (dE - maxDeltaE * 0.5) / (featherLimit - maxDeltaE * 0.5));
          data[i + 3] = Math.round(data[i + 3] * Math.min(1, ratio));
        }
      }
    }
  }
}

function findAlphaBoundingBox(imageData: ImageData): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

function drawRoundedRectPath(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

self.onmessage = async (ev: MessageEvent<StickerWorkerRequest>) => {
  const { id, bitmap, backgroundMode, contourRadius, maxSize, rotationDeg } = ev.data;

  try {
    const srcW = bitmap.width || 256;
    const srcH = bitmap.height || 256;
    const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
    const drawW = Math.max(32, Math.round(srcW * scale));
    const drawH = Math.max(32, Math.round(srcH * scale));

    const rotRad = (rotationDeg * Math.PI) / 180;
    const padRot = rotationDeg !== 0 ? Math.ceil(Math.hypot(drawW, drawH) * 0.15) : 0;

    const subjectCanvas = new OffscreenCanvas(drawW + padRot * 2, drawH + padRot * 2);
    const sCtx = subjectCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) throw new Error('OffscreenCanvas 2D context unavailable');

    sCtx.save();
    sCtx.translate(subjectCanvas.width / 2, subjectCanvas.height / 2);
    if (rotRad !== 0) sCtx.rotate(rotRad);
    sCtx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
    sCtx.restore();
    bitmap.close();

    const imgData = sCtx.getImageData(0, 0, subjectCanvas.width, subjectCanvas.height);

    // Check if image is a technical diagram/schematic/note-crop -> NEVER apply destructive Flood-Fill!
    const useSafePaperCard =
      backgroundMode === 'diagram_enhance' ||
      (backgroundMode === 'auto_clean' && isTechnicalDiagramOrSchematic(imgData));

    if (useSafePaperCard) {
      enhanceSchematicContrastInPlace(imgData);
      sCtx.putImageData(imgData, 0, 0);

      const padCard = 14;
      const shadowPad = 18;
      const cardW = subjectCanvas.width + padCard * 2;
      const cardH = subjectCanvas.height + padCard * 2;
      const outW = cardW + shadowPad * 2;
      const outH = cardH + shadowPad * 2;

      const finalCanvas = new OffscreenCanvas(outW, outH);
      const fCtx = finalCanvas.getContext('2d')!;

      // Rounded White Die-Cut Paper Sticker Card + Crisp Shadow
      fCtx.save();
      fCtx.shadowColor = 'rgba(15, 23, 42, 0.15)';
      fCtx.shadowBlur = 14;
      fCtx.shadowOffsetY = 5;
      drawRoundedRectPath(fCtx, shadowPad, shadowPad, cardW, cardH, 22);
      fCtx.fillStyle = '#FFFFFF';
      fCtx.fill();
      fCtx.restore();

      drawRoundedRectPath(fCtx, shadowPad, shadowPad, cardW, cardH, 22);
      fCtx.strokeStyle = 'rgba(15, 23, 42, 0.11)';
      fCtx.lineWidth = 1.5;
      fCtx.stroke();

      // Clip interior cleanly inside rounded paper card
      fCtx.save();
      drawRoundedRectPath(
        fCtx,
        shadowPad + 6,
        shadowPad + 6,
        cardW - 12,
        cardH - 12,
        16
      );
      fCtx.clip();
      fCtx.fillStyle = '#FFFFFF';
      fCtx.fillRect(shadowPad + 6, shadowPad + 6, cardW - 12, cardH - 12);
      fCtx.drawImage(subjectCanvas, shadowPad + padCard, shadowPad + padCard);
      fCtx.restore();

      const blob = await finalCanvas.convertToBlob({ type: 'image/webp', quality: 0.92 }).catch(() =>
        finalCanvas.convertToBlob({ type: 'image/png' })
      );

      self.postMessage({
        id,
        ok: true,
        blob,
        aspectRatio: Number((outW / outH).toFixed(3)),
        detectedDiagramCard: true,
      } satisfies StickerWorkerResponse);
      return;
    }

    // Isolated Object / Photo Path: 4-Corner Perimeter BFS Flood-Fill + Smooth #FFFFFF Contour
    if (backgroundMode === 'auto_clean') {
      stripBackgroundPerimeterBFS(imgData, 26);
      sCtx.putImageData(imgData, 0, 0);
    }

    const bbox = findAlphaBoundingBox(imgData) ?? {
      minX: 0,
      minY: 0,
      maxX: subjectCanvas.width - 1,
      maxY: subjectCanvas.height - 1,
    };

    const cropW = Math.max(24, bbox.maxX - bbox.minX + 1);
    const cropH = Math.max(24, bbox.maxY - bbox.minY + 1);

    const cropped = new OffscreenCanvas(cropW, cropH);
    const cropCtx = cropped.getContext('2d')!;
    cropCtx.drawImage(
      subjectCanvas,
      bbox.minX,
      bbox.minY,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH
    );

    const whiteMask = new OffscreenCanvas(cropW, cropH);
    const wmCtx = whiteMask.getContext('2d')!;
    wmCtx.drawImage(cropped, 0, 0);
    wmCtx.globalCompositeOperation = 'source-in';
    wmCtx.fillStyle = '#FFFFFF';
    wmCtx.fillRect(0, 0, cropW, cropH);

    const cutMask = new OffscreenCanvas(cropW, cropH);
    const cmCtx = cutMask.getContext('2d')!;
    cmCtx.drawImage(cropped, 0, 0);
    cmCtx.globalCompositeOperation = 'source-in';
    cmCtx.fillStyle = 'rgba(15, 23, 42, 0.11)';
    cmCtx.fillRect(0, 0, cropW, cropH);

    const shadowPad = 18;
    const rContour = Math.max(4, Math.min(10, contourRadius));
    const margin = rContour + shadowPad;
    const outW = cropW + margin * 2;
    const outH = cropH + margin * 2;

    const dilatedLayer = new OffscreenCanvas(outW, outH);
    const dlCtx = dilatedLayer.getContext('2d')!;

    const angleSteps = 20;
    const outerR = rContour + 1;
    for (let i = 0; i < angleSteps; i++) {
      const th = (i / angleSteps) * Math.PI * 2;
      dlCtx.drawImage(
        cutMask,
        margin + Math.cos(th) * outerR,
        margin + Math.sin(th) * outerR
      );
    }

    for (const r of [rContour, rContour * 0.6, rContour * 0.28, 0]) {
      if (r === 0) {
        dlCtx.drawImage(whiteMask, margin, margin);
        continue;
      }
      for (let i = 0; i < angleSteps; i++) {
        const th = (i / angleSteps) * Math.PI * 2;
        dlCtx.drawImage(whiteMask, margin + Math.cos(th) * r, margin + Math.sin(th) * r);
      }
    }

    const finalCanvas = new OffscreenCanvas(outW, outH);
    const fCtx = finalCanvas.getContext('2d')!;
    fCtx.save();
    fCtx.shadowColor = 'rgba(15, 23, 42, 0.14)';
    fCtx.shadowBlur = 13;
    fCtx.shadowOffsetY = 5;
    fCtx.drawImage(dilatedLayer, 0, 0);
    fCtx.restore();

    fCtx.drawImage(dilatedLayer, 0, 0);
    fCtx.drawImage(cropped, margin, margin);

    const blob = await finalCanvas.convertToBlob({ type: 'image/webp', quality: 0.92 }).catch(() =>
      finalCanvas.convertToBlob({ type: 'image/png' })
    );

    self.postMessage({
      id,
      ok: true,
      blob,
      aspectRatio: Number((outW / outH).toFixed(3)),
      detectedDiagramCard: false,
    } satisfies StickerWorkerResponse);
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : 'Worker sticker processing failed',
    } satisfies StickerWorkerResponse);
  }
};
