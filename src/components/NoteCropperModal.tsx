import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  Image as ImageIcon,
  ClipboardPaste,
  FileText,
  Check,
  RotateCw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { StickerAsset } from '../types/mindmap';
import {
  DieCutStickerProcessor,
  type BackgroundProcessMode,
} from '../core/visuals/DieCutStickerProcessor';
import { capturePhotoNative, hapticSuccess } from '../core/native/NativeBridge';

interface NoteCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySticker: (sticker: StickerAsset) => void;
}

interface CropRect {
  x: number; // 0..1 normalized
  y: number;
  w: number;
  h: number;
}

/**
 * Generates a realistic lined-notebook lecture diagram so users can test
 * cropping & paper background stripping immediately even without uploading a photo.
 */
function generateSampleLectureNoteDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 440;
  const ctx = canvas.getContext('2d')!;

  // Warm notebook paper background + blue ruled lines + red margin
  ctx.fillStyle = '#F7F4EB';
  ctx.fillRect(0, 0, 640, 440);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  for (let y = 44; y < 440; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#FCA5A5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(68, 0);
  ctx.lineTo(68, 440);
  ctx.stroke();

  // Drawn colorful Op-Amp / Feedback Diagram in the middle of the notebook
  ctx.strokeStyle = '#0F172A';
  ctx.fillStyle = '#BAE6FD';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(250, 145);
  ctx.lineTo(250, 315);
  ctx.lineTo(415, 230);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Feedback resistor loop
  ctx.strokeStyle = '#7C3AED';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(215, 190);
  ctx.lineTo(215, 98);
  ctx.lineTo(290, 98);
  ctx.lineTo(300, 82);
  ctx.lineTo(318, 114);
  ctx.lineTo(336, 82);
  ctx.lineTo(354, 114);
  ctx.lineTo(364, 98);
  ctx.lineTo(445, 98);
  ctx.lineTo(445, 230);
  ctx.stroke();

  // Input / Output terminals
  ctx.strokeStyle = '#E11D48';
  ctx.beginPath();
  ctx.moveTo(155, 190);
  ctx.lineTo(250, 190);
  ctx.stroke();

  ctx.strokeStyle = '#10B981';
  ctx.beginPath();
  ctx.moveTo(185, 270);
  ctx.lineTo(250, 270);
  ctx.stroke();

  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(415, 230);
  ctx.lineTo(495, 230);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export const NoteCropperModal: React.FC<NoteCropperModalProps> = ({
  isOpen,
  onClose,
  onApplySticker,
}) => {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0.16, y: 0.14, w: 0.68, h: 0.72 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [processMode, setProcessMode] = useState<BackgroundProcessMode>('diagram_enhance');
  const [previewStickerUrl, setPreviewStickerUrl] = useState<string | null>(null);
  const [previewAspect, setPreviewAspect] = useState(1);
  const [processing, setProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const dragStateRef = useRef<{
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    initialCrop: CropRect;
  } | null>(null);

  // Support Ctrl+V clipboard image paste while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => setSourceUrl(String(reader.result));
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const buildPreview = useCallback(async () => {
    if (!sourceUrl) return;
    setProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('Yükleme hatası'));
        img.src = sourceUrl;
      });
      imgRef.current = img;

      const natW = img.naturalWidth || 600;
      const natH = img.naturalHeight || 400;
      const sx = Math.round(crop.x * natW);
      const sy = Math.round(crop.y * natH);
      const sw = Math.max(24, Math.round(crop.w * natW));
      const sh = Math.max(24, Math.round(crop.h * natH));

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      const cCtx = cropCanvas.getContext('2d')!;
      cCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const dieCut = await DieCutStickerProcessor.processImageToSticker(cropCanvas, {
        backgroundMode: processMode,
        contourRadius: 8,
        rotationDeg,
        maxSize: 380,
      });

      setPreviewStickerUrl(dieCut.url);
      setPreviewAspect(dieCut.aspectRatio);
    } catch {
      // Ignore transient crop error
    } finally {
      setProcessing(false);
    }
  }, [sourceUrl, crop, rotationDeg, processMode]);

  useEffect(() => {
    if (!sourceUrl) return;
    const timer = window.setTimeout(() => {
      void buildPreview();
    }, 180);
    return () => clearTimeout(timer);
  }, [sourceUrl, crop, rotationDeg, processMode, buildPreview]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSourceUrl(String(reader.result));
      setCrop({ x: 0.12, y: 0.12, w: 0.76, h: 0.76 });
    };
    reader.readAsDataURL(file);
  };

  const handleCameraClick = async () => {
    const nativePhoto = await capturePhotoNative();
    if (nativePhoto) {
      setSourceUrl(nativePhoto);
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleClipboardButton = async () => {
    try {
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const reader = new FileReader();
            reader.onload = () => setSourceUrl(String(reader.result));
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      // Fallback sample if clipboard has no image
      setSourceUrl(generateSampleLectureNoteDataUrl());
    } catch {
      setSourceUrl(generateSampleLectureNoteDataUrl());
    }
  };

  const startCropDrag = (
    e: React.PointerEvent,
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialCrop: { ...crop },
    };
  };

  const moveCropDrag = (e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!drag || !rect || rect.width < 20 || rect.height < 20) return;

    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const ic = drag.initialCrop;

    if (drag.mode === 'move') {
      const nx = Math.max(0, Math.min(1 - ic.w, ic.x + dx));
      const ny = Math.max(0, Math.min(1 - ic.h, ic.y + dy));
      setCrop({ ...ic, x: nx, y: ny });
    } else if (drag.mode === 'se') {
      const nw = Math.max(0.12, Math.min(1 - ic.x, ic.w + dx));
      const nh = Math.max(0.12, Math.min(1 - ic.y, ic.h + dy));
      setCrop({ ...ic, w: nw, h: nh });
    } else if (drag.mode === 'nw') {
      const nx = Math.max(0, Math.min(ic.x + ic.w - 0.12, ic.x + dx));
      const ny = Math.max(0, Math.min(ic.y + ic.h - 0.12, ic.y + dy));
      setCrop({
        x: nx,
        y: ny,
        w: ic.w - (nx - ic.x),
        h: ic.h - (ny - ic.y),
      });
    } else if (drag.mode === 'ne') {
      const ny = Math.max(0, Math.min(ic.y + ic.h - 0.12, ic.y + dy));
      const nw = Math.max(0.12, Math.min(1 - ic.x, ic.w + dx));
      setCrop({
        x: ic.x,
        y: ny,
        w: nw,
        h: ic.h - (ny - ic.y),
      });
    } else if (drag.mode === 'sw') {
      const nx = Math.max(0, Math.min(ic.x + ic.w - 0.12, ic.x + dx));
      const nh = Math.max(0.12, Math.min(1 - ic.y, ic.h + dy));
      setCrop({
        x: nx,
        y: ic.y,
        w: ic.w - (nx - ic.x),
        h: nh,
      });
    }
  };

  const endCropDrag = () => {
    dragStateRef.current = null;
  };

  const handleConfirm = () => {
    if (!previewStickerUrl) return;
    void hapticSuccess();
    onApplySticker({
      id: `notecrop_${Date.now()}`,
      url: previewStickerUrl,
      mode: 'diagram',
      source: 'note_crop',
      dieCutProcessed: true,
      aspectRatio: previewAspect,
      label: 'Ders Notu Şeması',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--canvas-bg)',
          borderColor: 'var(--hud-border)',
          paddingBottom: 'max(22px, calc(var(--safe-bottom) + 14px))',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3.5 sm:px-6"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div>
            <h2 className="text-base font-extrabold">
              📷 Ders Notundan & Kitaptan Şema Kesici
            </h2>
            <p className="text-xs opacity-65">
              Defter/slayt şemasını kırpın, kağıt zeminini silip beyaz konturlu çıkartmaya dönüştürün
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-500/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Hidden Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="overflow-y-auto p-4 sm:p-6">
          {!sourceUrl ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCameraClick}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-500/40 bg-sky-500/5 p-6 text-center transition-colors hover:bg-sky-500/10"
              >
                <Camera className="h-8 w-8 text-sky-500" />
                <div className="text-sm font-extrabold">Kamerayla Çek</div>
                <div className="text-xs opacity-65">
                  Ders kitabındaki veya tahtadaki şemayı çekin
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-6 text-center transition-colors hover:bg-emerald-500/10"
              >
                <ImageIcon className="h-8 w-8 text-emerald-500" />
                <div className="text-sm font-extrabold">Galeriden / Dosyadan Seç</div>
                <div className="text-xs opacity-65">
                  PDF ekran görüntüsü veya ders slaytı yükleyin
                </div>
              </button>

              <button
                type="button"
                onClick={handleClipboardButton}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center transition-colors hover:bg-slate-500/5"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <ClipboardPaste className="h-6 w-6 text-violet-500" />
                <div className="text-xs font-extrabold">Panodan Yapıştır (Ctrl+V)</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceUrl(generateSampleLectureNoteDataUrl());
                  setCrop({ x: 0.2, y: 0.14, w: 0.62, h: 0.68 });
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center transition-colors hover:bg-amber-500/10"
                style={{ borderColor: 'var(--hud-border)' }}
              >
                <FileText className="h-6 w-6 text-amber-500" />
                <div className="text-xs font-extrabold">
                  Örnek Defter Şeması ile Hemen Dene
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Crop & Live Sticker Preview Split Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                {/* Interactive Crop Stage */}
                <div className="md:col-span-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-bold opacity-75">
                    <span>1. Şema Alanını Kırpın</span>
                    <button
                      type="button"
                      onClick={() => setSourceUrl(null)}
                      className="text-sky-500 hover:underline"
                    >
                      Başka Görsel Seç
                    </button>
                  </div>

                  <div
                    ref={stageRef}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    className="canvas-touch-lock relative mx-auto overflow-hidden rounded-2xl border bg-slate-900 select-none"
                    style={{ borderColor: 'var(--hud-border)' }}
                  >
                    <img
                      src={sourceUrl}
                      alt="Ders Notu"
                      className="block max-h-68 w-full object-fill pointer-events-none"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-slate-950/45" />

                    {/* Active Crop Window */}
                    <div
                      onPointerDown={(e) => startCropDrag(e, 'move')}
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.w * 100}%`,
                        height: `${crop.h * 100}%`,
                      }}
                      className="absolute cursor-move border-2 border-sky-400 bg-white/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]"
                    >
                      {/* 4 Corner Handles */}
                      {(
                        [
                          ['nw', '-top-2 -left-2 cursor-nwse-resize'],
                          ['ne', '-top-2 -right-2 cursor-nesw-resize'],
                          ['sw', '-bottom-2 -left-2 cursor-nesw-resize'],
                          ['se', '-bottom-2 -right-2 cursor-nwse-resize'],
                        ] as const
                      ).map(([corner, posCls]) => (
                        <div
                          key={corner}
                          onPointerDown={(e) => startCropDrag(e, corner)}
                          className={`absolute h-5 w-5 rounded-full border-2 border-white bg-sky-500 shadow-md ${posCls}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Die-Cut Sticker Result Preview */}
                <div className="flex flex-col md:col-span-2">
                  <div className="mb-1.5 text-xs font-bold opacity-75">
                    2. Çıkartma Önizlemesi (Die-Cut)
                  </div>
                  <div
                    className="relative flex min-h-48 flex-1 items-center justify-center rounded-2xl border p-4"
                    style={{
                      backgroundColor: 'var(--canvas-bg)',
                      backgroundImage:
                        'radial-gradient(var(--canvas-dot) 1.5px, transparent 1.5px)',
                      backgroundSize: '20px 20px',
                      borderColor: 'var(--hud-border)',
                    }}
                  >
                    {previewStickerUrl ? (
                      <img
                        src={previewStickerUrl}
                        alt="Çıkartma Önizleme"
                        className="max-h-44 max-w-full object-contain"
                      />
                    ) : null}
                    {processing && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/25 backdrop-blur-[1px]">
                        <Loader2 className="h-7 w-7 animate-spin text-sky-500" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Filter & Perspective Straighten Controls */}
              <div className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--hud-border)' }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'diagram_enhance', label: '📐 Şema Netleştir (Kağıdı Sil)' },
                      { id: 'auto_clean', label: '📷 Arka Plan Sil' },
                      { id: 'neural', label: '✨ Derin AI Silgi' },
                      { id: 'none', label: '🖼️ Orijinal Kesit' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setProcessMode(m.id)}
                      className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
                        processMode === m.id
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-500/10 hover:bg-slate-500/20'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <RotateCw className="h-3.5 w-3.5 opacity-70" />
                  <span>Açı: {rotationDeg}°</span>
                  <input
                    type="range"
                    min={-15}
                    max={15}
                    step={1}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(Number(e.target.value))}
                    className="w-24 accent-sky-500"
                  />
                </div>
              </div>

              {/* Confirm Button */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold hover:bg-slate-500/10"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!previewStickerUrl || processing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition-transform hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Dala Çıkartma Olarak Yapıştır
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
