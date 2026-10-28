import * as THREE from 'three';
import TRAFFIC_BOATS from '../data/traffic-boats.json';
import { FoamStrips, type WakeHull } from './wake';

/** At most this many boats show a bow wave at once: the High traffic cap and the rival. */
const MOST = 12;

/**
 * The other boats' wakes (art rules, issue #331): a short V of bow waves on each hull, smaller than
 * the player's and with no trail astern, all in one draw. A boat lying still leaves none.
 */
export class TrafficWakes extends FoamStrips {
  private readonly hull: WakeHull = { length: 0, beam: 0 };

  constructor() {
    super(MOST * 2 * TRAFFIC_BOATS.wake.steps);
  }

  /** Starts a frame's wakes. */
  begin() {
    this.vertices = 0;
  }

  /** A boat at scene (x, z) heading (dx, dz), her drawn hull `hull`, at `speedKn`. */
  add(x: number, z: number, dx: number, dz: number, hull: WakeHull, speedKn: number, time: number) {
    const strength = THREE.MathUtils.smoothstep(Math.abs(speedKn), 0.4, 8);
    if (strength <= 0 || this.vertices >= this.geometry.attributes.position!.count) return;
    const { scale, steps, aft, spread } = TRAFFIC_BOATS.wake;
    this.hull.length = hull.length * scale;
    this.hull.beam = hull.beam * scale;
    this.bowWaves(x, z, dx, dz, this.hull, strength, steps, time, { aft, spread });
  }

  end(time: number) {
    this.finish(time);
    this.mesh.visible = this.vertices > 0;
  }
}
