import type { StickerAsset } from '../../types/mindmap';
import { DieCutStickerProcessor } from './DieCutStickerProcessor';

export interface SketchStrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface SketchStroke {
  color: string;
  width: number;
  points: SketchStrokePoint[];
  isEraser?: boolean;
}

export class SketchToSticker {
  /**
   * Renders smoothed Catmull-Rom / quadratic spline strokes onto an offscreen canvas
   * and converts the drawing into a crisp white-contoured Die-Cut Sticker.
   */
  public static async convertCanvasSketchToDieCutSticker(
    sourceCanvas: HTMLCanvasElement,
    label?: string
  ): Promise<StickerAsset> {
    const id = `sketch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const processed = await DieCutStickerProcessor.processImageToSticker(sourceCanvas, {
      cacheKey: `diecut_${id}`,
      backgroundMode: 'none',
      contourRadius: 9,
      maxSize: 360,
    });

    return {
      id,
      url: processed.url,
      mode: 'illustration',
      source: 'sketch',
      dieCutProcessed: true,
      aspectRatio: processed.aspectRatio,
      label: label || 'Kalem Çizimi',
    };
  }
}
