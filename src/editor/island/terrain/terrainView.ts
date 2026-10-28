import * as THREE from 'three';
import depthView from '../../../data/depth-view.json';
import { TUNING } from '../../../data/tuning';
import { type FieldColor, FieldSurface } from '../../../render/models/fieldGround';
import { vertexColorMaterial } from '../../../render/models/geometry';
import type { Heightfield } from '../../../sim/heightfield';
import { ISLAND_SCALE } from '../../../sim/islandUnits';
import type { Region } from '../../../sim/sculpt';
import type { Preview, TopView } from '../scene';

/** Colours by height off `depth-view.json`: the sea level and depth view. */
export function depthColor(): FieldColor {
  const { bands } = depthView;
  return (_ground, _steep, height) => (bands.find((b) => height < b.below) ?? bands.at(-1)!).color;
}

/**
 * A colour function with the ground's height read off the top-down view: lighter the higher it
 * stands, in steps of `heightShade.step` so the triangles share a few dozen colours.
 */
export function shaded(colorOf: FieldColor): FieldColor {
  const [step, from, to, lighten] = TUNING.terrain.sculpt.editor.heightShade as [
    number,
    number,
    number,
    number,
  ];
  const cache = new Map<string, string>();
  const white = new THREE.Color('#fff');
  return (ground, steep, height) => {
    const base = colorOf(ground, steep, height);
    const k = Math.min(to, Math.max(from, Math.round(height / step)));
    const key = `${base}/${k}`;
    let color = cache.get(key);
    if (!color) {
      const c = new THREE.Color(base).lerp(white, Math.max(0, k - from) * lighten);
      cache.set(key, (color = `#${c.getHexString()}`));
    }
    return color;
  };
}

/**
 * The height field drawn in both of the builder's views while the terrain tools are in use: one
 * surface (and so one set of buffers) per view, since each has its own WebGL context, kept in
 * step as a stroke changes samples. The field is in world units, the builder's scene in reference
 * units, hence the scale.
 */
export class TerrainView {
  private surfaces: FieldSurface[] = [];

  constructor(
    private readonly top: TopView,
    private readonly preview: Preview,
  ) {}

  /** Draws a field (replacing the last); `reach` is the island's extent, for framing the 3D view. */
  show(field: Heightfield, colorOf: FieldColor, reach: THREE.Sphere) {
    this.hide();
    for (const view of [this.top, this.preview]) {
      const surface = new FieldSurface(field, colorOf);
      surface.geometry.boundingSphere = reach;
      this.surfaces.push(surface);
      const mesh = new THREE.Mesh(surface.geometry, vertexColorMaterial());
      mesh.scale.setScalar(1 / ISLAND_SCALE);
      // A sphere that is the island's, not the sea margin's, so a brush at the rim is not culled.
      mesh.frustumCulled = false;
      view.setGround(mesh);
    }
  }

  recolor(colorOf: FieldColor) {
    for (const s of this.surfaces) s.recolor(colorOf);
    this.redraw();
  }

  update(region: Region | null) {
    if (!region) return;
    for (const s of this.surfaces) s.update(region);
    this.redraw();
  }

  hide() {
    for (const s of this.surfaces) s.geometry.dispose();
    this.surfaces = [];
    this.top.setGround(null);
    this.preview.setGround(null);
  }

  private redraw() {
    this.preview.render();
  }
}
