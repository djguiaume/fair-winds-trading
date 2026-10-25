import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { type Rng, createRng, range } from '../sim/rng';
import type { Crater } from './models';

/** Most puffs and lava bombs alive at once, over every volcano in sight. */
const MAX_PUFFS = 260;
const MAX_BOMBS = 60;
/** A bomb that lands leaves a puff this big, times its own size and the quiet puff's size. */
const LANDING_PUFF = 0.35;

/** One eruption: seconds since it began, and how long it holds at full strength. */
interface Eruption {
  elapsed: number;
  hold: number;
}

interface CraterState {
  crater: Crater;
  eruption: Eruption | null;
  /** Seconds until the next eruption while the boat stays near (the switch on). */
  wait: number;
  near: boolean;
  /** In sight last frame: a crater coming in sight gets its whole plume at once. */
  seen: boolean;
  /** Puffs owed, as a fraction carried between frames; seconds to the next burst of bombs. */
  puffDebt: number;
  burst: number;
}

/** What the view tells the volcanoes each frame. */
export interface VolcanoFrame {
  /** The camera's target in the scene (the boat, or the point it looks at). */
  target: THREE.Vector3;
  /** The camera's height: puffs coming close below it shrink away. */
  cameraY: number;
  /** How much night it is, 0 (day) to 1. */
  night: number;
  /** The Eruptions switch (Settings): off, they only smoke, but a story eruption still plays. */
  eruptions: boolean;
  /** Islands out of the sea for now (decision 0166): their craters are quiet and hidden. */
  out: ReadonlySet<string>;
  /** Where the wind blows to in the scene (unit vector) and its speed in units/s. */
  windX: number;
  windZ: number;
  windUnits: number;
}

/** How strong an eruption is now, 0 to 1: it builds, holds, then dies down (null when over). */
export function eruptionStrength(e: Eruption): number | null {
  const { rampSec, fadeSec } = TUNING.weather.volcano.eruptions;
  if (e.elapsed < rampSec) return e.elapsed / rampSec;
  const after = e.elapsed - rampSec - e.hold;
  if (after < 0) return 1;
  return after < fadeSec ? 1 - after / fadeSec : null;
}

/**
 * The smoke's material (decision 0178): lit like the land, plus a light of its own from each
 * puff's colour (`instanceGlow`), so a puff's faces barely differ and it reads as smoke, not rock;
 * the glow also carries an eruption's lava light on the ash at night. Opaque, one draw call.
 */
function smokeMaterial() {
  const material = new THREE.MeshLambertMaterial({ flatShading: true });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        'attribute float instanceGlow;\nvarying float vGlow;\n#include <common>',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = instanceGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', 'varying float vGlow;\n#include <common>')
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive + vColor.rgb * vGlow;',
      );
  };
  material.customProgramCacheKey = () => 'volcano-smoke';
  return material;
}

/**
 * Volcano smoke and eruptions (decision 0178). Every crater in the islands' files lets go a plume
 * of low-poly puffs: small at the vent, they climb to the plume's height, lean away with the wind
 * and grow, then shrink away; no transparency, so no sorting or overdraw on the old tablet. With
 * the Eruptions switch on, a big volcano erupts every few minutes while the boat is near: more,
 * bigger, darker ash (lava-lit from below at night), bursts of glowing lava bombs that come down
 * on the upper cone, and the lava brightens. A quest's `reward.erupt` plays one whatever the
 * switch says, as soon as the boat is in sight. Spectacle only: nothing here touches the sim.
 * Two draw calls in all.
 */
export class Volcanoes {
  readonly root = new THREE.Group();
  private readonly puffs: THREE.InstancedMesh;
  private readonly bombs: THREE.InstancedMesh;
  private readonly glow = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PUFFS), 1);
  private readonly states: CraterState[] = [];
  /** Story eruptions waiting for the boat to come in sight, with their age in seconds. */
  private readonly story: { island: string; age: number }[] = [];
  private readonly rng: Rng = createRng(7176);
  /**
   * Puffs: where they left (x, y, z), their own sideways wander, how high they level out and how
   * fast they climb, age, life, start and full size, spin, base colour, and how hot (the eruption's
   * strength when they left, for the glow at night). Their place follows from their age.
   */
  private readonly puff = {
    from: new Float32Array(MAX_PUFFS * 3),
    wander: new Float32Array(MAX_PUFFS * 2),
    top: new Float32Array(MAX_PUFFS),
    rise: new Float32Array(MAX_PUFFS),
    age: new Float32Array(MAX_PUFFS),
    life: new Float32Array(MAX_PUFFS),
    s0: new Float32Array(MAX_PUFFS),
    s1: new Float32Array(MAX_PUFFS),
    spin: new Float32Array(MAX_PUFFS),
    rgb: new Float32Array(MAX_PUFFS * 3),
    hot: new Float32Array(MAX_PUFFS),
    n: 0,
  };
  // Bombs: position, velocity, size, the crater they fly from.
  private readonly bomb = {
    p: new Float32Array(MAX_BOMBS * 3),
    v: new Float32Array(MAX_BOMBS * 3),
    size: new Float32Array(MAX_BOMBS),
    from: new Int16Array(MAX_BOMBS),
    n: 0,
  };
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly tint = new THREE.Color();
  private readonly steam = new THREE.Color();
  private readonly ash = new THREE.Color();
  private readonly hotColor = new THREE.Color();

  constructor(craters: readonly Crater[]) {
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    this.glow.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instanceGlow', this.glow);
    this.puffs = new THREE.InstancedMesh(geometry, smokeMaterial(), MAX_PUFFS);
    this.puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffs.setColorAt(0, this.tint.set('#ffffff'));
    this.puffs.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    // Lava bombs glow like the lava (unlit), and fade in the fog like everything else.
    this.bombs = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: TUNING.weather.volcano.eruptions.bombColor }),
      MAX_BOMBS,
    );
    this.bombs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (const mesh of [this.puffs, this.bombs]) {
      mesh.count = 0;
      // Bounds move every frame; the culling would need recomputing each time for two meshes.
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
    this.setCraters(craters);
  }

  /** The craters as the islands now stand (rebuilt islands keep their running eruptions). */
  setCraters(craters: readonly Crater[]) {
    // A volcano by its island; a vent (0181) by its place, so an island may have several.
    const key = (c: Crater) => (c.vent ? `${c.island}@${c.x},${c.z}` : c.island);
    const old = new Map(this.states.map((s) => [key(s.crater), s]));
    this.states.length = 0;
    for (const crater of craters) {
      const was = old.get(key(crater));
      this.states.push(
        was
          ? { ...was, crater }
          : { crater, eruption: null, wait: 0, near: false, seen: false, puffDebt: 0, burst: 0 },
      );
    }
    this.bomb.n = 0;
  }

  /**
   * A story eruption (a quest's `reward.erupt`): it plays whatever the switch says, now if the
   * island is in sight, else once the boat comes in sight (dropped after `storyWaitSec`).
   * `now` starts it at once wherever the boat is (the screenshot tool).
   */
  erupt(island: string, now = false) {
    const state = this.states.find((s) => s.crater.island === island && !s.crater.vent);
    if (!state) return false;
    if (now) this.start(state, TUNING.weather.volcano.eruptions.storyHoldSec);
    else this.story.push({ island, age: 0 });
    return true;
  }

  /** Islands whose eruption is running now. */
  erupting(): string[] {
    return this.states.filter((s) => s.eruption).map((s) => s.crater.island);
  }

  /** Steps smoke and eruptions; returns how strongly the lava glows extra, 0 to 1. */
  update(dt: number, frame: VolcanoFrame): number {
    const tuning = TUNING.weather.volcano;
    const { eruptions: e, smoke } = tuning;
    this.steam.set(smoke.color);
    this.ash.set(e.smokeColor);
    this.hotColor.set(e.hotColor);
    (this.bombs.material as THREE.MeshBasicMaterial).color.set(e.bombColor);
    const { target } = frame;
    let glow = 0;
    for (const s of this.story) s.age += dt;
    for (let i = this.story.length - 1; i >= 0; i--)
      if (this.story[i]!.age > e.storyWaitSec) this.story.splice(i, 1);
    this.states.forEach((state, index) => {
      const { crater } = state;
      if (frame.out.has(crater.island)) {
        state.eruption = null;
        state.near = false;
        return;
      }
      const dist = Math.hypot(crater.x - target.x, crater.z - target.z);
      const inSight = dist < tuning.sightUnits;
      // A story eruption waits until the volcano is in sight.
      const waiting = crater.vent ? -1 : this.story.findIndex((s) => s.island === crater.island);
      if (waiting >= 0 && inSight) {
        this.story.splice(waiting, 1);
        this.start(state, e.storyHoldSec);
      }
      // Now and then while the boat is near, with the switch on; a small vent only smokes.
      const near = frame.eruptions && !crater.vent && dist < e.nearUnits && crater.r >= e.minCrater;
      if (near && !state.near) state.wait = e.firstSec;
      state.near = near;
      if (near && !state.eruption) {
        state.wait -= dt;
        if (state.wait <= 0) {
          this.start(state, e.holdSec);
          state.wait = range(this.rng, e.everySec[0]!, e.everySec[1]!);
        }
      }
      let k = 0;
      if (state.eruption) {
        state.eruption.elapsed += dt;
        const strength = eruptionStrength(state.eruption);
        if (strength === null) state.eruption = null;
        else k = strength;
      }
      if (!inSight) {
        state.seen = false;
        return;
      }
      if (!state.seen) {
        // Its plume is already up when it comes in sight, puffs of every age.
        state.seen = true;
        const n = Math.round(smoke.perSec * smoke.lifeSec);
        for (let j = 0; j < n; j++) this.spawnPuff(crater, 0, undefined, 1, j / n);
      }
      glow = Math.max(glow, k);
      state.puffDebt += smoke.perSec * (1 + (e.smokeRate - 1) * k) * dt;
      while (state.puffDebt >= 1) {
        state.puffDebt -= 1;
        this.spawnPuff(crater, k);
      }
      // Lava bombs come in bursts, the stronger the eruption the more often.
      if (k > 0.3) {
        state.burst -= dt * k;
        if (state.burst <= 0) {
          state.burst = e.burstSec * (0.7 + this.rng() * 0.6);
          const n = Math.floor(range(this.rng, e.bombBurst[0]!, e.bombBurst[1]! + 1));
          for (let j = 0; j < n; j++) this.spawnBomb(index);
        }
      } else state.burst = 0;
    });
    this.stepPuffs(dt, frame);
    this.stepBombs(dt);
    return glow;
  }

  private start(state: CraterState, hold: number) {
    // An eruption already running holds on at full strength rather than starting over.
    if (state.eruption && eruptionStrength(state.eruption) !== null) {
      const { rampSec } = TUNING.weather.volcano.eruptions;
      state.eruption.elapsed = Math.min(state.eruption.elapsed, rampSec);
      state.eruption.hold = Math.max(state.eruption.hold, hold);
      return;
    }
    state.eruption = { elapsed: 0, hold };
  }

  /**
   * A puff from crater `c` at eruption strength `k`, or from a landing bomb `at` (`size` times the
   * quiet size); `ahead` starts it that share into its life (a plume already up).
   */
  private spawnPuff(c: Crater, k: number, at?: THREE.Vector3, size = 1, ahead = 0) {
    const P = this.puff;
    if (P.n >= MAX_PUFFS) return;
    const { smoke, eruptions: e } = TUNING.weather.volcano;
    const i = P.n++;
    const rng = this.rng;
    const a = rng() * Math.PI * 2;
    const r = at ? 0 : rng() * c.r * 0.5;
    P.from.set(
      at ? [at.x, at.y, at.z] : [c.x + Math.cos(a) * r, c.y + 0.3, c.z + Math.sin(a) * r],
      i * 3,
    );
    // A small crater's plume is smaller, lower and shorter, in proportion.
    // A steam vent (0181) has its own small scale.
    const scale = at
      ? 0.25
      : c.vent
        ? smoke.ventScale
        : Math.min(1.2, Math.max(0.25, c.r / smoke.craterRadius));
    const spread = smoke.spread * (1 + k) * scale;
    P.wander.set([(rng() - 0.5) * 2 * spread, (rng() - 0.5) * 2 * spread], i * 2);
    P.top[i] = smoke.top * (1 + (e.smokeTop - 1) * k) * scale * (0.8 + rng() * 0.4);
    P.rise[i] = smoke.rise * Math.max(scale, 0.5) * (0.8 + rng() * 0.4);
    P.life[i] =
      smoke.lifeSec * (at ? 0.3 : Math.min(1, Math.max(0.5, scale)) * (0.8 + rng() * 0.4));
    P.age[i] = Math.min(ahead, 0.98) * P.life[i]!;
    const jitter = 1 + (rng() * 2 - 1) * smoke.sizeJitter;
    const grow = (1 + (e.smokeSize - 1) * k) * size * (at ? 1 : scale) * jitter;
    P.s0[i] = smoke.size[0]! * grow;
    P.s1[i] = smoke.size[1]! * grow;
    P.spin[i] = rng() * Math.PI * 2;
    // Steam when quiet, warm ash the stronger the eruption; a bomb's puff is steam from the sea. A little variation puff to puff.
    this.tint
      .copy(this.steam)
      .lerp(this.ash, at ? 0 : k)
      .multiplyScalar(0.95 + rng() * 0.1);
    P.rgb.set([this.tint.r, this.tint.g, this.tint.b], i * 3);
    P.hot[i] = at ? 0 : k;
  }

  /** A bomb thrown up from the crater to come down on the upper cone, past the rim. */
  private spawnBomb(from: number) {
    const B = this.bomb;
    if (B.n >= MAX_BOMBS) return;
    const { eruptions: e } = TUNING.weather.volcano;
    const c = this.states[from]!.crater;
    const rng = this.rng;
    const i = B.n++;
    const a = rng() * Math.PI * 2;
    const rim = c.r / 0.8;
    const land = rim + c.r * range(rng, e.bombLand[0]!, e.bombLand[1]!);
    const up = range(rng, e.bombUp[0]!, e.bombUp[1]!);
    // Time to come down to the cone's height out there, then the sideways speed to get there.
    const drop = 0.3 + (land - rim) * c.slope;
    const t = (up + Math.sqrt(up * up + 2 * e.gravity * drop)) / e.gravity;
    const start = c.r * 0.3;
    const out = (land - start) / t;
    B.p.set([c.x + Math.cos(a) * start, c.y + 0.3, c.z + Math.sin(a) * start], i * 3);
    B.v.set([Math.cos(a) * out, up, Math.sin(a) * out], i * 3);
    B.size[i] = range(rng, e.bombSize[0]!, e.bombSize[1]!);
    B.from[i] = from;
  }

  private stepPuffs(dt: number, frame: VolcanoFrame) {
    const P = this.puff;
    const { smoke, eruptions: e } = TUNING.weather.volcano;
    const drift = smoke.drift * frame.windUnits;
    const wx = frame.windX * drift,
      wz = frame.windZ * drift;
    const ceiling = frame.cameraY - smoke.cameraGap;
    // Their own light, less at night; the ash's lava glow only at night.
    const selfLit = smoke.selfLit * (1 - frame.night * (1 - smoke.nightSelfLit));
    const color = this.puffs.instanceColor!;
    let n = 0;
    for (let i = 0; i < P.n; i++) {
      const age = P.age[i]! + dt;
      if (age >= P.life[i]!) continue;
      // Keep the live ones packed at the front.
      if (n !== i) {
        P.from.copyWithin(n * 3, i * 3, i * 3 + 3);
        P.wander.copyWithin(n * 2, i * 2, i * 2 + 2);
        P.rgb.copyWithin(n * 3, i * 3, i * 3 + 3);
        P.top[n] = P.top[i]!;
        P.rise[n] = P.rise[i]!;
        P.life[n] = P.life[i]!;
        P.s0[n] = P.s0[i]!;
        P.s1[n] = P.s1[i]!;
        P.spin[n] = P.spin[i]!;
        P.hot[n] = P.hot[i]!;
      }
      P.age[n] = age;
      const t = age / P.life[n]!;
      // It climbs fast from the vent and levels out at its top (1 - e^-age/τ); the wind takes it
      // as it gets up there, so the plume leans away downwind as one column.
      const top = P.top[n]!;
      const tau = top / P.rise[n]!;
      const up = 1 - Math.exp(-age / tau);
      const along = age - tau * up;
      const y = P.from[n * 3 + 1]! + top * up;
      const x = P.from[n * 3]! + P.wander[n * 2]! * age + wx * along;
      const z = P.from[n * 3 + 2]! + P.wander[n * 2 + 1]! * age + wz * along;
      // Small at the vent, growing as it drifts, then shrinking away so the plume thins out
      // near the island instead of drifting big past it.
      const from = smoke.shrinkFrom;
      let s = P.s0[n]! + (P.s1[n]! - P.s0[n]!) * Math.pow(Math.min(1, t / from), 0.7);
      if (t > from) s *= (1 - t) / (1 - from);
      // Never up into the lens: close below the camera it shrinks away.
      if (y + s > ceiling) s = Math.max(0, ceiling - y);
      this.euler.set(P.spin[n]!, P.spin[n]! * 1.7 + age * 0.15, 0);
      this.matrix.compose(
        this.pos.set(x, y, z),
        this.quat.setFromEuler(this.euler),
        this.scale.set(s, s * 0.8, s),
      );
      this.puffs.setMatrixAt(n, this.matrix);
      // At night an eruption's lower ash is lit by the lava, fading over its first third.
      const hot = frame.night * P.hot[n]! * e.hotMix * Math.max(0, 1 - t * 3);
      this.tint.fromArray(P.rgb, n * 3).lerp(this.hotColor, hot);
      color.setXYZ(n, this.tint.r, this.tint.g, this.tint.b);
      this.glow.setX(n, selfLit + hot * 2);
      n++;
    }
    P.n = n;
    this.puffs.count = n;
    this.puffs.instanceMatrix.needsUpdate = true;
    color.needsUpdate = true;
    this.glow.needsUpdate = true;
  }

  private stepBombs(dt: number) {
    const B = this.bomb;
    const g = TUNING.weather.volcano.eruptions.gravity;
    let n = 0;
    for (let i = 0; i < B.n; i++) {
      const c = this.states[B.from[i]!]?.crater;
      B.v[i * 3 + 1] = B.v[i * 3 + 1]! - g * dt;
      const x = B.p[i * 3]! + B.v[i * 3]! * dt;
      const y = B.p[i * 3 + 1]! + B.v[i * 3 + 1]! * dt;
      const z = B.p[i * 3 + 2]! + B.v[i * 3 + 2]! * dt;
      // Down on the cone's flank, or in the sea: a puff of steam where it hits the water. None on
      // land, where a trail of ash down the slope reads as rolling pebbles.
      const rim = c ? c.r / 0.8 : 0;
      const ground = c ? c.y - Math.max(0, Math.hypot(x - c.x, z - c.z) - rim) * c.slope : 0;
      if (!c || (B.v[i * 3 + 1]! < 0 && (y < ground || y < 0))) {
        if (c && y < 0.5) this.spawnPuff(c, 1, this.pos.set(x, 0, z), B.size[i]! * LANDING_PUFF);
        continue;
      }
      if (n !== i) {
        B.v.copyWithin(n * 3, i * 3, i * 3 + 3);
        B.size[n] = B.size[i]!;
        B.from[n] = B.from[i]!;
      }
      B.p.set([x, y, z], n * 3);
      const s = B.size[n]!;
      this.euler.set(y * 0.3, x * 0.3, 0);
      this.matrix.compose(
        this.pos.set(x, y, z),
        this.quat.setFromEuler(this.euler),
        this.scale.set(s, s, s),
      );
      this.bombs.setMatrixAt(n, this.matrix);
      n++;
    }
    B.n = n;
    this.bombs.count = n;
    this.bombs.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.puffs, this.bombs]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }
}
