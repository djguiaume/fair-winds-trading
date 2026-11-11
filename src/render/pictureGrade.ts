import * as THREE from 'three';
import HARBOUR_VIEW from '../data/harbour-view.json';

/**
 * The harbour banner's grade (issue #464): the port's picture gets the title key art's look
 * (decision 0271, `docs/ui-refactor/v1.5/grade_cover.py`): teal pulled toward the game's blue and
 * quieted, a warm light from the top, the foreground a touch darker. Numbers in
 * `harbour-view.json` › `grade`; baked into the picture once, no CSS filters.
 */
export interface PictureGrade {
  /** The teal the grade looks for, in degrees, and how wide its band is. */
  tealHue: number;
  tealWidth: number;
  /** Degrees the teal turns toward blue; how much of its saturation and value it loses. */
  hueShift: number;
  tealDesaturate: number;
  tealDarken: number;
  /** The light's colour, red, green, blue 0 to 1 (soft light); its strength at the top, everywhere. */
  warm: readonly number[];
  light: number;
  lightBase: number;
  /** How much darker the bottom row is. */
  foreground: number;
  /** The warm light's share at night (the sea and town keep their night colours). */
  nightWarmth: number;
}

export const PICTURE_GRADE: PictureGrade = HARBOUR_VIEW.grade;

/** Grades RGBA pixels in place, top row first; `warmth` 1 by day, `nightWarmth` at night. */
export function gradePixels(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  g: PictureGrade = PICTURE_GRADE,
  warmth = 1,
): void {
  const rgb = [0, 0, 0];
  for (let row = 0; row < height; row++) {
    const y = height > 1 ? row / (height - 1) : 0;
    const light = (g.light * (1 - y) + g.lightBase) * warmth;
    const shade = 1 - g.foreground * y;
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      quietTeal(px[i]! / 255, px[i + 1]! / 255, px[i + 2]! / 255, g, rgb);
      for (let c = 0; c < 3; c++) {
        const v = rgb[c]!;
        const lit = v * (1 - light) + softLight(v, g.warm[c]!) * light;
        px[i + c] = Math.round(Math.min(1, Math.max(0, lit * shade)) * 255);
      }
    }
  }
}

/** The teal turned toward blue and quieted, written into `out` (0 to 1 each). */
function quietTeal(r: number, gr: number, b: number, g: PictureGrade, out: number[]) {
  const max = Math.max(r, gr, b);
  const min = Math.min(r, gr, b);
  const d = max - min;
  let h = 0;
  if (d > 0)
    h = max === r ? ((gr - b) / d + 6) % 6 : max === gr ? (b - r) / d + 2 : (r - gr) / d + 4;
  h *= 60;
  const teal = Math.max(0, 1 - Math.abs(h - g.tealHue) / g.tealWidth);
  if (teal === 0) {
    out[0] = r;
    out[1] = gr;
    out[2] = b;
    return;
  }
  const s = (max > 0 ? d / max : 0) * (1 - teal * g.tealDesaturate);
  const v = max * (1 - teal * g.tealDarken);
  hsvToRgb((h + teal * g.hueShift) % 360, s, v, out);
}

function hsvToRgb(h: number, s: number, v: number, out: number[]) {
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

/** The soft-light blend of `base` under `light` (the formula of `grade_cover.py`). */
function softLight(base: number, light: number): number {
  return light < 0.5
    ? 2 * base * light + base * base * (1 - 2 * light)
    : 2 * base * (1 - light) + Math.sqrt(base) * (2 * light - 1);
}

/**
 * The picture as a JPEG object URL: WebGL's bottom-up rows, drawn down to `width` x `height`
 * (the supersampling smooths it), graded. An object URL keeps the screen's markup short.
 */
export function pictureUrl(
  pixels: Uint8Array,
  source: { width: number; height: number },
  out: { width: number; height: number; quality: number },
  warmth: number,
): string {
  const { width: w, height: h } = source;
  const full = document.createElement('canvas');
  full.width = w;
  full.height = h;
  const image = full.getContext('2d')!.createImageData(w, h);
  for (let row = 0; row < h; row++)
    image.data.set(pixels.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
  full.getContext('2d')!.putImageData(image, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full, 0, 0, out.width, out.height);
  const graded = ctx.getImageData(0, 0, out.width, out.height);
  gradePixels(graded.data, out.width, out.height, PICTURE_GRADE, warmth);
  ctx.putImageData(graded, 0, 0);
  const data = atob(canvas.toDataURL('image/jpeg', out.quality).split(',')[1]!);
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
}

/**
 * The scene drawn off screen from a camera, as sRGB pixels. Its own target has depth, so it works
 * on a canvas made for Ultra, which has none (decision 0297).
 */
export function renderPicture(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): Uint8Array {
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const pixels = new Uint8Array(width * height * 4);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  return pixels;
}
