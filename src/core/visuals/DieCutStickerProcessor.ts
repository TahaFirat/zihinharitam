import { LocalStore } from '../sync/LocalStore';
import { isVectorSvgSource } from './PureVectorStickerizer';
import type {
  StickerWorkerRequest,
  StickerWorkerResponse,
  WorkerBgMode,
} from '../../workers/stickerProcessor.worker';

export type BackgroundProcessMode = 'none' | 'auto_clean' | 'diagram_enhance' | 'neural';

export interface DieCutOptions {
  cacheKey?: string;
  backgroundMode?: BackgroundProcessMode;
  contourRadius?: number;
  maxSize?: number;
  rotationDeg?: number;
}

export interface DieCutResult {
  url: string;
  blob: Blob;
  aspectRatio: number;
}

let stickerWorker: Worker | null = null;
let workerJobCounter = 0;
const pendingJobs = new Map<
  number,
  {
    resolve: (res: StickerWorkerResponse) => void;
    reject: (err: Error) => void;
  }
>();

function getOrCreateStickerWorker(): Worker | null {
  if (stickerWorker) return stickerWorker;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }
  try {
    stickerWorker = new Worker(
      new URL('../../workers/stickerProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );
    stickerWorker.onmessage = (ev: MessageEvent<StickerWorkerResponse>) => {
      const msg = ev.data;
      if (!msg) return;
      const waiter = pendingJobs.get(msg.id);
      if (waiter) {
        pendingJobs.delete(msg.id);
        waiter.resolve(msg);
      }
    };
    return stickerWorker;
  } catch {
    return null;
  }
}

async function decodeRasterToImageBitmap(
  source: string | HTMLCanvasElement
): Promise<ImageBitmap> {
  if (typeof source !== 'string') {
    return createImageBitmap(source);
  }
  const resp = await fetch(source, { mode: 'cors' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return createImageBitmap(blob);
}

export class DieCutStickerProcessor {
  /**
   * V3 OffscreenCanvas Web Worker Raster Sticker Processor:
   *  1. HARD GUARD: Vector SVGs NEVER enter pixel processing!
   *  2. Raster photos, note crops, and AI outputs run 100% off main thread in `stickerProcessor.worker.ts`.
   *  3. Technical diagrams/schematics automatically receive a non-destructive Rounded White Paper Sticker Card
   *     instead of Flood-Fill so fine interior lines and whites are NEVER chewed!
   */
  public static async processImageToSticker(
    source: string | HTMLCanvasElement,
    options: DieCutOptions = {}
  ): Promise<DieCutResult> {
    const {
      cacheKey,
      backgroundMode = 'auto_clean',
      contourRadius = 7,
      maxSize = 360,
      rotationDeg = 0,
    } = options;

    // HARD RULE (Module 2.3 & Module 4): Never rasterize or pixel-dilate vector SVGs!
    if (typeof source === 'string' && isVectorSvgSource(source)) {
      const blob = new Blob([source], { type: 'text/plain' });
      return { url: source, blob, aspectRatio: 1 };
    }

    if (cacheKey) {
      const cached = await LocalStore.getCachedStickerUrl(cacheKey);
      if (cached) {
        try {
          const resp = await fetch(cached.url);
          const blob = await resp.blob();
          return { url: cached.url, blob, aspectRatio: cached.aspectRatio };
        } catch {
          // Stale object URL; re-process cleanly
        }
      }
    }

    let finalSource: string | HTMLCanvasElement = source;
    if (typeof source === 'string' && backgroundMode === 'neural') {
      try {
        const { removeBackground } = await import('@imgly/background-removal');
        const neuralBlob = await removeBackground(source);
        finalSource = URL.createObjectURL(neuralBlob);
      } catch {
        // Fallback cleanly to worker BFS
      }
    }

    const bitmap = await decodeRasterToImageBitmap(finalSource);
    const worker = getOrCreateStickerWorker();

    if (worker) {
      const jobId = ++workerJobCounter;
      const workerMode: WorkerBgMode =
        backgroundMode === 'diagram_enhance'
          ? 'diagram_enhance'
          : backgroundMode === 'none'
          ? 'none'
          : 'auto_clean';

      const res = await new Promise<StickerWorkerResponse>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pendingJobs.delete(jobId);
          reject(new Error('Sticker worker timed out'));
        }, 6000);

        pendingJobs.set(jobId, {
          resolve: (r) => {
            clearTimeout(timer);
            resolve(r);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });

        const payload: StickerWorkerRequest = {
          id: jobId,
          bitmap,
          backgroundMode: workerMode,
          contourRadius,
          maxSize,
          rotationDeg,
        };
        worker.postMessage(payload, [bitmap]);
      });

      if (res.ok && res.blob) {
        const aspectRatio = res.aspectRatio ?? 1;
        if (cacheKey) {
          await LocalStore.putCachedStickerBlob(cacheKey, res.blob, aspectRatio);
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error('DataURL read error'));
          reader.onerror = () => reject(new Error('DataURL read error'));
          reader.readAsDataURL(res.blob!);
        });
        return { url: dataUrl, blob: res.blob, aspectRatio };
      }
    }

    // Safe fallback if OffscreenCanvas unavailable
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 256;
    fallbackCanvas.height = 256;
    const blob = await new Promise<Blob>((resolve, reject) =>
      fallbackCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Blob error'))), 'image/png')
    );
    const url = typeof source === 'string' ? source : URL.createObjectURL(blob);
    return { url, blob, aspectRatio: 1 };
  }
}
