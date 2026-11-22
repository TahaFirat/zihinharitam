import type { StickerAsset } from '../../types/mindmap';

function loadFileAsImage(file: File): Promise<{ img: HTMLImageElement; rawDataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Görsel dosyası okunamadı.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => resolve({ img, rawDataUrl });
      img.onerror = () => reject(new Error('Görsel formatı desteklenmiyor.'));
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Converts any user-selected photo/image from iPhone/iPad/Android Gallery or Desktop Files
 * into a crisp, memory-safe 512px Die-Cut Framed StickerAsset (100% Free & Offline).
 */
export async function importPhotoFileAsSticker(
  file: File,
  branchColor = '#0EA5E9'
): Promise<StickerAsset> {
  if (file.size > 18 * 1024 * 1024) {
    throw new Error('Görsel 18 MB sınırını aşıyor. Lütfen daha küçük bir fotoğraf seçin.');
  }
  const { img } = await loadFileAsImage(file);

  const maxCanvas = 512;
  const pad = 28;
  const avail = maxCanvas - pad * 2;
  const natW = Math.max(1, img.naturalWidth || img.width || 256);
  const natH = Math.max(1, img.naturalHeight || img.height || 256);
  const scale = Math.min(avail / natW, avail / natH);

  const drawW = Math.max(48, Math.round(natW * scale));
  const drawH = Math.max(48, Math.round(natH * scale));
  const canvasW = drawW + pad * 2;
  const canvasH = drawH + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas oluşturulamadı.');
  }

  const frameX = 12;
  const frameY = 12;
  const frameW = canvasW - 24;
  const frameH = canvasH - 24;
  const cornerR = Math.min(44, Math.round(Math.min(frameW, frameH) * 0.16));

  // Soft die-cut vinyl shadow + crisp white border
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, frameX, frameY, frameW, frameH, cornerR);
  ctx.fill();
  ctx.restore();

  // Clip inner photo cleanly with rounded corners
  const innerPad = 12;
  const innerX = frameX + innerPad;
  const innerY = frameY + innerPad;
  const innerW = frameW - innerPad * 2;
  const innerH = frameH - innerPad * 2;
  const innerR = Math.max(12, cornerR - innerPad);

  ctx.save();
  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, innerR);
  ctx.clip();
  ctx.drawImage(img, innerX, innerY, innerW, innerH);
  ctx.restore();

  // Subtle colored rim accent matching branch
  ctx.save();
  ctx.strokeStyle = `${branchColor}45`;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, innerR);
  ctx.stroke();
  ctx.restore();

  // Encode as compact lossless-looking WebP (~70% smaller in IndexedDB than PNG!) with PNG fallback
  let dataUrl = '';
  try {
    const webp = canvas.toDataURL('image/webp', 0.84);
    dataUrl = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  } catch {
    dataUrl = canvas.toDataURL('image/png');
  }
  const cleanLabel = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Galeri Görseli';

  return {
    id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    url: dataUrl,
    mode: 'photo',
    source: 'user_photo',
    dieCutProcessed: true,
    aspectRatio: Number((canvasW / canvasH).toFixed(3)) || 1,
    label: cleanLabel,
  };
}

/**
 * Opens native iOS / iPadOS / Android / Desktop image gallery picker in 1 tap.
 */
export function triggerGalleryPhotoPicker(
  branchColor: string,
  onPicked: (sticker: StickerAsset) => void
): void {
  if (typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.opacity = '0';
  document.body.appendChild(input);

  const cleanup = () => {
    window.setTimeout(() => {
      if (input.parentNode) input.parentNode.removeChild(input);
    }, 500);
  };

  input.onchange = async () => {
    const file = input.files?.[0];
    cleanup();
    if (!file) return;
    try {
      const sticker = await importPhotoFileAsSticker(file, branchColor);
      onPicked(sticker);
    } catch {
      // Ignore canceled or unreadable files
    }
  };

  input.click();
}
