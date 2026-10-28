import type * as THREE from 'three';
import { TUNING } from '../data/tuning';
import type { ZoneVisual } from '../sim/windZones';

/**
 * The veil over the screen inside a haze (decision 0169): clear round the boat, the haze's colour
 * toward the edges. Touched only when its opacity or colour changes, so open sea costs nothing.
 */
export class HazeVeil {
  private opacity = -1;
  private color = '';

  constructor(private readonly element: HTMLElement | null) {}

  update(haze: ZoneVisual, color: THREE.Color) {
    if (!this.element) return;
    const opacity = haze.kind ? Math.round(haze.haze * 50) / 50 : 0;
    if (opacity !== this.opacity) {
      this.opacity = opacity;
      this.element.style.opacity = String(opacity);
    }
    if (opacity <= 0) return;
    const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
    // The look changes with the colour or the `?tune` panel's veil numbers.
    const key = `${rgb}|${JSON.stringify(TUNING.weather.sight)}`;
    if (key === this.color) return;
    this.color = key;
    const v = TUNING.weather.sight;
    this.element.style.background =
      `radial-gradient(ellipse 70% 65% at 50% 52%, rgba(${rgb},0) ${v.veilClear * 100}%, ` +
      `rgba(${rgb},${v.veilMidAlpha}) ${v.veilMid * 100}%, rgba(${rgb},${v.veilEdgeAlpha}) 100%)`;
  }
}
