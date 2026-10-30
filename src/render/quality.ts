/**
 * Quality levels (decision 0005's mobile budget). "auto" starts from a guess based on the device
 * and steps down while the frame time is too long.
 */
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';
export type QualitySetting = QualityLevel | 'auto';

export interface QualityProfile {
  /** Maximum device pixel ratio used for the canvas. */
  pixelRatioCap: number;
  /** Maximum 3D drawing-buffer area; the DOM stays at native resolution. */
  maxRenderPixels: number;
  /** Ocean grid resolution (cells per side). */
  oceanSegments: number;
  windStreaks: number;
  /** Falling rain streaks around the camera (decision 0067). */
  rainDrops: number;
  /** Real shadow map for island props; boats always use a cheap blob shadow. */
  shadows: boolean;
  /** Multisampled drawing context; costs fill rate, so the weak levels leave it off. */
  antialias: boolean;
  /** Smooth foam animation and second wave layer in the ocean shader. */
  fancyWater: boolean;
  /** Fog of war's edge on the chart blurred (decision 0156); else a cheap stepped soft rim. */
  chartFogBlur: boolean;
  /** Fresnel sky reflection and sun glint on the sea (decision 0221). */
  waterReflection: boolean;
  /** Desktop and Xbox pipeline (decision 0221): tone mapping, soft shadows, occlusion, haze. */
  ultra: boolean;
}

export const QUALITY: Record<QualityLevel, QualityProfile> = {
  low: {
    maxRenderPixels: 750_000,
    pixelRatioCap: 1,
    oceanSegments: 48,
    windStreaks: 36,
    rainDrops: 160,
    shadows: false,
    antialias: false,
    fancyWater: false,
    chartFogBlur: false,
    waterReflection: false,
    ultra: false,
  },
  medium: {
    maxRenderPixels: 1_250_000,
    pixelRatioCap: 1.25,
    oceanSegments: 80,
    windStreaks: 60,
    rainDrops: 260,
    shadows: false,
    antialias: false,
    fancyWater: true,
    chartFogBlur: false,
    waterReflection: false,
    ultra: false,
  },
  high: {
    maxRenderPixels: 2_500_000,
    pixelRatioCap: 1.5,
    oceanSegments: 120,
    windStreaks: 90,
    rainDrops: 400,
    shadows: true,
    antialias: true,
    fancyWater: true,
    chartFogBlur: true,
    waterReflection: true,
    ultra: false,
  },
  // Full resolution on a 1440p screen; a 4K one draws fewer pixels and is scaled up.
  ultra: {
    maxRenderPixels: 3_700_000,
    pixelRatioCap: 2,
    oceanSegments: 160,
    windStreaks: 90,
    rainDrops: 400,
    shadows: true,
    antialias: true,
    fancyWater: true,
    chartFogBlur: true,
    waterReflection: true,
    ultra: true,
  },
};

/** `?perf&aa=1` test aid (decision 0154): multisample on every level, to measure its cost. */
export function forceAntialias(): void {
  for (const profile of Object.values(QUALITY)) profile.antialias = true;
}

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

const ORDER: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

/** Software renderers and small laptop chips: no Ultra for them (decision 0221). */
const WEAK_GPU =
  /swiftshader|llvmpipe|software|basic render|intel\(r\) (?:u?hd|iris\(r\) (?:plus|pro)?) graphics|mali|adreno|powervr/i;

/** The GPU's name, or '' when the browser hides it. Asked once, on a throwaway context. */
let gpu: string | undefined;
function gpuName(): string {
  if (gpu !== undefined) return gpu;
  gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // No WebGL 2 here: High at most.
  }
  return gpu;
}

/** Ultra only on a desktop or an Xbox with a real graphics card (decision 0221). */
export function ultraCapable(gpu: string, cores: number): boolean {
  return gpu !== '' && !WEAK_GPU.test(gpu) && cores >= 6;
}

/**
 * First guess before any frame is measured: touch devices start lower, desktops with a real
 * graphics card on Ultra. Auto still steps down if the frames are slow.
 */
export function guessQuality(): QualityLevel {
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (touch && (cores <= 4 || (memory !== undefined && memory <= 4))) return 'low';
  if (touch) return 'medium';
  return ultraCapable(gpuName(), cores) ? 'ultra' : 'high';
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
