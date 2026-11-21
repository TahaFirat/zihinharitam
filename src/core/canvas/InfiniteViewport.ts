import type { ViewportTransform } from '../../types/mindmap';

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 4.0;

export class InfiniteViewport {
  private transform: ViewportTransform = { x: 0, y: 0, scale: 1 };
  private velocityX = 0;
  private velocityY = 0;
  private lastStepTime = 0;
  private targetAnimation: {
    startX: number;
    startY: number;
    startScale: number;
    endX: number;
    endY: number;
    endScale: number;
    startTime: number;
    duration: number;
  } | null = null;

  constructor(initial?: Partial<ViewportTransform>) {
    if (initial) {
      this.transform = {
        x: initial.x ?? 0,
        y: initial.y ?? 0,
        scale: this.clampScale(initial.scale ?? 1),
      };
    }
  }

  public clampScale(scale: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  }

  public getTransform(): ViewportTransform {
    return { ...this.transform };
  }

  public setTransform(next: ViewportTransform): void {
    this.transform = {
      x: next.x,
      y: next.y,
      scale: this.clampScale(next.scale),
    };
  }

  public stopMomentum(): void {
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastStepTime = 0;
    this.targetAnimation = null;
  }

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.transform.x) / this.transform.scale,
      y: (screenY - this.transform.y) / this.transform.scale,
    };
  }

  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.transform.scale + this.transform.x,
      y: worldY * this.transform.scale + this.transform.y,
    };
  }

  public panBy(dx: number, dy: number): void {
    this.targetAnimation = null;
    this.transform.x += dx;
    this.transform.y += dy;
  }

  public setInertia(vx: number, vy: number): void {
    const maxSpeed = 62;
    this.velocityX = Math.max(-maxSpeed, Math.min(maxSpeed, vx));
    this.velocityY = Math.max(-maxSpeed, Math.min(maxSpeed, vy));
    this.lastStepTime = performance.now();
  }

  public zoomAtScreenPoint(nextScale: number, screenX: number, screenY: number): void {
    this.targetAnimation = null;
    this.velocityX = 0;
    this.velocityY = 0;

    const clamped = this.clampScale(nextScale);
    const worldBefore = this.screenToWorld(screenX, screenY);

    this.transform.scale = clamped;
    this.transform.x = screenX - worldBefore.x * clamped;
    this.transform.y = screenY - worldBefore.y * clamped;
  }

  public animateTo(target: ViewportTransform, durationMs = 340): void {
    this.velocityX = 0;
    this.velocityY = 0;
    this.targetAnimation = {
      startX: this.transform.x,
      startY: this.transform.y,
      startScale: this.transform.scale,
      endX: target.x,
      endY: target.y,
      endScale: this.clampScale(target.scale),
      startTime: performance.now(),
      duration: Math.max(120, durationMs),
    };
  }

  public centerWorldPoint(
    worldX: number,
    worldY: number,
    viewportWidth: number,
    viewportHeight: number,
    targetScale?: number,
    durationMs = 320
  ): void {
    const scale = this.clampScale(targetScale ?? this.transform.scale);
    const endX = viewportWidth * 0.5 - worldX * scale;
    const endY = viewportHeight * 0.5 - worldY * scale;
    this.animateTo({ x: endX, y: endY, scale }, durationMs);
  }

  public fitBounds(
    bounds: WorldBounds,
    viewportWidth: number,
    viewportHeight: number,
    paddingPx = 84,
    durationMs = 380
  ): void {
    const contentWidth = Math.max(220, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(220, bounds.maxY - bounds.minY);
    const availW = Math.max(160, viewportWidth - paddingPx * 2);
    const availH = Math.max(160, viewportHeight - paddingPx * 2);

    const scale = this.clampScale(Math.min(1.25, Math.min(availW / contentWidth, availH / contentHeight)));
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;

    const endX = viewportWidth * 0.5 - centerX * scale;
    const endY = viewportHeight * 0.5 - centerY * scale;

    this.animateTo({ x: endX, y: endY, scale }, durationMs);
  }

  private dotPatternCache: {
    step: number;
    radius: number;
    darkMode: boolean;
    pattern: CanvasPattern | null;
  } | null = null;

  public isAnimating(): boolean {
    return (
      this.targetAnimation !== null ||
      Math.abs(this.velocityX) > 0.14 ||
      Math.abs(this.velocityY) > 0.14
    );
  }

  /**
   * Advances inertial momentum or smooth camera transition.
   * Returns true if viewport changed on this frame.
   */
  public step(now: number): boolean {
    if (this.targetAnimation) {
      const anim = this.targetAnimation;
      const elapsed = now - anim.startTime;
      const rawT = Math.min(1, elapsed / anim.duration);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - rawT, 3);

      this.transform.x = anim.startX + (anim.endX - anim.startX) * ease;
      this.transform.y = anim.startY + (anim.endY - anim.startY) * ease;
      this.transform.scale = anim.startScale + (anim.endScale - anim.startScale) * ease;

      if (rawT >= 1) {
        this.targetAnimation = null;
      }
      return true;
    }

    if (Math.abs(this.velocityX) > 0.14 || Math.abs(this.velocityY) > 0.14) {
      const dtMs = this.lastStepTime > 0 ? Math.max(4, Math.min(42, now - this.lastStepTime)) : 16.667;
      this.lastStepTime = now;
      const dtNorm = dtMs / 16.667;

      this.transform.x += this.velocityX * dtNorm;
      this.transform.y += this.velocityY * dtNorm;

      // Frame-rate independent exponential decay so 60Hz, 90Hz, and 120Hz tablets glide identical silky distances!
      const decay = Math.pow(0.915, dtNorm);
      this.velocityX *= decay;
      this.velocityY *= decay;
      if (Math.abs(this.velocityX) <= 0.14) this.velocityX = 0;
      if (Math.abs(this.velocityY) <= 0.14) this.velocityY = 0;
      return true;
    }

    this.lastStepTime = 0;
    return false;
  }

  public getVisibleWorldBounds(
    screenWidth: number,
    screenHeight: number,
    worldMargin = 260
  ): WorldBounds {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(screenWidth, screenHeight);
    return {
      minX: topLeft.x - worldMargin,
      minY: topLeft.y - worldMargin,
      maxX: bottomRight.x + worldMargin,
      maxY: bottomRight.y + worldMargin,
    };
  }

  /**
   * Renders the warm paper-textured dot grid in a SINGLE GPU draw call using a
   * cached offscreen tiled CanvasPattern (replaces 1,200+ per-frame `ctx.arc` calls!).
   */
  public renderPaperDotGrid(
    ctx: CanvasRenderingContext2D,
    screenWidth: number,
    screenHeight: number,
    darkMode: boolean
  ): void {
    const bgColor = darkMode ? '#12161F' : '#FAF9F5';
    const dotColor = darkMode ? '#262D3D' : '#E2E0D8';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    const { x: offsetX, y: offsetY, scale } = this.transform;

    // Adaptive LOD spacing so dots never become overly dense when zoomed out to 0.15x
    let baseSpacing = 28;
    if (scale < 0.32) {
      baseSpacing = 112;
    } else if (scale < 0.65) {
      baseSpacing = 56;
    }

    const screenStep = baseSpacing * scale;
    if (screenStep < 10) {
      return;
    }

    const tileStep = Math.max(10, Math.round(screenStep));
    const dotRadius = Math.round(Math.max(1.05, Math.min(2.2, 1.45 * Math.sqrt(scale))) * 4) / 4;

    if (
      !this.dotPatternCache ||
      this.dotPatternCache.step !== tileStep ||
      this.dotPatternCache.radius !== dotRadius ||
      this.dotPatternCache.darkMode !== darkMode
    ) {
      const tile = document.createElement('canvas');
      tile.width = tileStep;
      tile.height = tileStep;
      const tctx = tile.getContext('2d');
      if (tctx) {
        tctx.fillStyle = dotColor;
        tctx.beginPath();
        tctx.arc(tileStep * 0.5, tileStep * 0.5, dotRadius, 0, Math.PI * 2);
        tctx.fill();
      }
      this.dotPatternCache = {
        step: tileStep,
        radius: dotRadius,
        darkMode,
        pattern: ctx.createPattern(tile, 'repeat'),
      };
    }

    const pattern = this.dotPatternCache.pattern;
    if (!pattern) return;

    const startX = ((offsetX % tileStep) + tileStep) % tileStep - tileStep * 0.5;
    const startY = ((offsetY % tileStep) + tileStep) % tileStep - tileStep * 0.5;

    ctx.save();
    ctx.translate(startX, startY);
    ctx.fillStyle = pattern;
    ctx.fillRect(-startX, -startY, screenWidth + tileStep, screenHeight + tileStep);
    ctx.restore();
  }
}
