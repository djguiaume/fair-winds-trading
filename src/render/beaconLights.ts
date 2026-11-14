import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { atLevel, type PropDef, questShown } from '../data/islands';
import { PROP_RECIPES } from '../data/props';
import { TUNING } from '../data/tuning';
import { glowTexture } from './lampGlow';
import { landmarkLamps } from './landmarkLamps';

/** Light colour by the beacon prop's variant (decision 0121); variant 1 is an unlit day mark. */
const COLOR: Record<number, THREE.Color> = {
  0: new THREE.Color('#fff6e0'),
  2: new THREE.Color('#ff3a24'),
  3: new THREE.Color('#3cff7a'),
};

/**
 * Is beacon `index` lit at `time`? A group of 1-3 short flashes per period, so neighbouring
 * beacons can be told apart like real marks (Fl, Fl(2), Fl(3)).
 */
export function beaconFlash(index: number, time: number) {
  const flashes = (index % 3) + 1,
    period = 2 + flashes * 2,
    t = (((time + index * 1.7) % period) + period) % period;
  const k = Math.floor(t);
  return k < flashes && t - k < 0.45;
}

interface Lamp {
  island: IslandDef;
  prop: PropDef;
  color: THREE.Color;
}

/**
 * Flashing night lights on the beacons of the island files (decision 0121): one additive point
 * cloud, one draw call. A beacon not built yet at its island's town level stays dark.
 */
export class BeaconLights {
  readonly points: THREE.Points;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly colors: Float32Array;
  private readonly lamps: Lamp[] = [];
  private readonly standing: boolean[] = [];
  private readonly material: THREE.PointsMaterial;
  private readonly texture = glowTexture();
  /** `levels`: town level by island id, as for the lighthouse beams. */
  constructor(islands: readonly IslandDef[], levels: Record<string, number> = {}) {
    const colorOf = (prop: PropDef) => {
      const lamp = PROP_RECIPES[prop.type]?.lamp;
      return lamp ? new THREE.Color(lamp.color ?? '#fff6e0') : COLOR[prop.variant ?? 0];
    };
    const lit = landmarkLamps(islands, 'beacon').filter((l) => colorOf(l.prop));
    const positions = new Float32Array(lit.length * 3);
    lit.forEach((l, i) => {
      positions.set(l.position.toArray(), i * 3);
      this.lamps.push({ island: l.island, prop: l.prop, color: colorOf(l.prop)! });
    });
    this.colors = new Float32Array(lit.length * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.material = new THREE.PointsMaterial({
      size: TUNING.graphics.lamps.beaconSize,
      map: this.texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'beacon-lights';
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.setLevels(levels);
  }
  private levels: Record<string, number> = {};
  private done: ReadonlySet<string> = new Set();
  private out: ReadonlySet<string> = new Set();
  /** Lights only the beacons standing at each island's town level. */
  setLevels(levels: Record<string, number>) {
    this.levels = levels;
    this.lamps.forEach(({ island, prop }, i) => {
      this.standing[i] =
        !this.out.has(island.id) &&
        atLevel(prop, levels[island.id] ?? (island.look?.dock ? 1 : 4)) &&
        questShown(prop, this.done);
    });
  }
  /** Islands out of the sea for now (decision 0166): their beacons are dark. */
  setLandOut(out: ReadonlySet<string>) {
    this.out = new Set(out);
    this.setLevels(this.levels);
  }
  /** The quests done, for beacons that stand only before or after one (decision 0130). */
  setQuestsDone(done: ReadonlySet<string>) {
    this.done = new Set(done);
    this.setLevels(this.levels);
  }
  /** `glow` 0..1: night, a little in storms; `size` scales the glow (smaller on Ultra, #543). */
  update(time: number, glow: number, size = 1) {
    this.points.visible = glow > 0.02 && this.lamps.length > 0;
    if (!this.points.visible) return;
    this.material.size = TUNING.graphics.lamps.beaconSize * size;
    this.lamps.forEach(({ color }, i) => {
      const b = this.standing[i] && beaconFlash(i, time) ? Math.min(1, glow) : 0;
      this.colors.set([color.r * b, color.g * b, color.b * b], i * 3);
    });
    this.geometry.attributes.color!.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
