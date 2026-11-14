import * as THREE from 'three';
import { TUNING } from '../data/tuning';

/** Colour stops the glow is drawn with: enough for a smooth falloff on a 64 px texture. */
const STOPS = 12;

/**
 * How opaque a lamp's glow is at `t` (0 at the lamp, 1 at the sprite's edge): a small solid core,
 * then a quick fall, so the lamp itself reads inside a soft glow instead of a flat disc (#543).
 */
export function glowAlpha(t: number): number {
  const { core, falloff, peak } = TUNING.graphics.lamps;
  if (t <= core) return 1;
  if (t >= 1) return 0;
  return peak * Math.exp(-(t - core) / falloff);
}

/**
 * The round glow every night lamp shares (lanterns, beacons, other boats' lamps), drawn once into
 * a small canvas texture. White, so each lamp tints it with its own colour.
 */
export function glowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    for (let i = 0; i <= STOPS; i++) {
      const t = i / STOPS;
      grad.addColorStop(t, `rgba(255, 255, 255, ${glowAlpha(t).toFixed(3)})`);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}
