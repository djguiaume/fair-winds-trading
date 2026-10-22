/**
 * Quality levels (decision 0005's mobile budget). "auto" starts from a guess based on the device
 * and steps down while the frame time is too long.
 */
export type QualityLevel = 'low' | 'medium' | 'high';
export type QualitySetting = QualityLevel | 'auto';

export interface QualityProfile {
  /** Maximum device pixel ratio used for the canvas. */
  pixelRatioCap: number;
  /** Maximum 3D drawing-buffer area; the DOM stays at native resolution. */
  maxRenderPixels: number;
  /** Ocean grid resolution (cells per side). */
  oceanSegments: number;
  windStreaks: number;
  /** Falling rain streaks around the camera (decision 0066). */
  rainDrops: number;
  /** Real shadow map for island props; boats always use a cheap blob shadow. */
  shadows: boolean;
  /** Smooth foam animation and second wave layer in the ocean shader. */
  fancyWater: boolean;
}

export const QUALITY: Record<QualityLevel, QualityProfile> = {
  low: {
    maxRenderPixels: 750_000,
    pixelRatioCap: 1,
    oceanSegments: 48,
    windStreaks: 36,
    rainDrops: 160,
    shadows: false,
    fancyWater: false,
  },
  medium: {
    maxRenderPixels: 1_250_000,
    pixelRatioCap: 1.25,
    oceanSegments: 80,
    windStreaks: 60,
    rainDrops: 260,
    shadows: false,
    fancyWater: true,
  },
  high: {
    maxRenderPixels: 2_500_000,
    pixelRatioCap: 1.5,
    oceanSegments: 120,
    windStreaks: 90,
    rainDrops: 400,
    shadows: true,
    fancyWater: true,
  },
};

/** Can fall below 1 on large tablets to keep fill-rate bounded. */
export function renderPixelRatio(
  width: number,
  height: number,
  deviceRatio: number,
  profile: QualityProfile,
): number {
  const area = Math.max(1, width) * Math.max(1, height);
  return Math.min(
    deviceRatio || 1,
    profile.pixelRatioCap,
    Math.sqrt(profile.maxRenderPixels / area),
  );
}

const ORDER: QualityLevel[] = ['low', 'medium', 'high'];

/** First guess before any frame is measured: touch devices start lower. */
export function guessQuality(): QualityLevel {
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (touch && (cores <= 4 || (memory !== undefined && memory <= 4))) return 'low';
  if (touch) return 'medium';
  return 'high';
}

export function lowerQuality(q: QualityLevel): QualityLevel {
  return ORDER[Math.max(0, ORDER.indexOf(q) - 1)]!;
}

/**
 * Watches frame times. Returns true from `sample` when the average over the window is too slow
 * (below ~40 fps), at most once per cooldown, so "auto" quality can step down.
 */
export class FrameMonitor {
  private sum = 0;
  private count = 0;
  private cooldown = 2;
  fps = 60;

  sample(dt: number): boolean {
    this.cooldown -= dt;
    this.sum += dt;
    this.count++;
    if (this.sum < 1.5) return false;
    const avg = this.sum / this.count;
    this.fps = 1 / avg;
    this.sum = 0;
    this.count = 0;
    if (this.cooldown <= 0 && avg > 1 / 40) {
      this.cooldown = 4;
      return true;
    }
    return false;
  }
}
