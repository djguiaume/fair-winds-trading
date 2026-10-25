import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { type Rng, createRng, range } from '../sim/rng';
import type { Crater } from './models';

/** Most puffs and lava bombs alive at once, over every volcano in sight. */
const MAX_PUFFS = 260;
const MAX_BOMBS = 70;
/** A bomb that lands leaves a puff this big, times its own size and the quiet puff's size. */
const LANDING_PUFF = 0.25;

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
  /** Puffs and bombs owed, as fractions carried between frames. */
  puffDebt: number;
  bombDebt: number;
}

/** What the view tells the volcanoes each frame. */
export interface VolcanoFrame {
  /** The camera's target in the scene (the boat, or the point it looks at). */
  target: THREE.Vector3;
  /** The Eruptions switch (Settings): off, they only smoke, but a story eruption still plays. */
  eruptions: boolean;
  /** Islands out of the sea for now (decision 0166): their craters are quiet and hidden. */
  out: ReadonlySet<string>;
  /** Where the wind blows to in the scene (unit vector) and its speed in units/s. */
  windX: number;
  windZ: number;
  windUnits: number;
}

const color = (hex: string) => new THREE.Color(hex);

/** How strong an eruption is now, 0 to 1: it builds, holds, then dies down (null when over). */
export function eruptionStrength(e: Eruption): number | null {
  const { rampSec, fadeSec } = TUNING.weather.volcano.eruptions;
  if (e.elapsed < rampSec) return e.elapsed / rampSec;
  const after = e.elapsed - rampSec - e.hold;
  if (after < 0) return 1;
  return after < fadeSec ? 1 - after / fadeSec : null;
}

/**
 * Volcano smoke and eruptions (decision 0176). Every crater in the islands' files lets go a thin
 * plume of low-poly puffs that rise, drift with the wind and shrink away; no transparency, so no
 * sorting or overdraw on the old tablet. With the Eruptions switch on, a volcano erupts every few
 * minutes while the boat is near: darker, bigger smoke and glowing lava bombs on arcs, and the
 * lava brightens. A quest's `reward.erupt` plays one whatever the switch says, as soon as the
 * boat is in sight. Spectacle only: nothing here touches the sim. Two draw calls in all.
 */
export class Volcanoes {
  readonly root = new THREE.Group();
  private readonly puffs: THREE.InstancedMesh;
  private readonly bombs: THREE.InstancedMesh;
  private readonly states: CraterState[] = [];
  /** Story eruptions waiting for the boat to come in sight, with their age in seconds. */
  private readonly story: { island: string; age: number }[] = [];
  private readonly rng: Rng = createRng(7176);
  // Puffs: position, velocity, age, life, start and full size, spin.
  private readonly puff = {
    p: new Float32Array(MAX_PUFFS * 3),
    v: new Float32Array(MAX_PUFFS * 3),
    age: new Float32Array(MAX_PUFFS),
    life: new Float32Array(MAX_PUFFS),
    s0: new Float32Array(MAX_PUFFS),
    s1: new Float32Array(MAX_PUFFS),
    spin: new Float32Array(MAX_PUFFS),
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
  private quiet = color('#b9b2ac');
  private ash = color('#4a4240');

  constructor(craters: readonly Crater[]) {
    const puffMaterial = new THREE.MeshLambertMaterial({ flatShading: true });
    this.puffs = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      puffMaterial,
      MAX_PUFFS,
    );
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
    const old = new Map(this.states.map((s) => [s.crater.island, s]));
    this.states.length = 0;
    for (const crater of craters) {
      const was = old.get(crater.island);
      this.states.push(
        was
          ? { ...was, crater }
          : { crater, eruption: null, wait: 0, near: false, seen: false, puffDebt: 0, bombDebt: 0 },
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
    const state = this.states.find((s) => s.crater.island === island);
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
    this.quiet.set(smoke.color);
    this.ash.set(e.smokeColor);
    (this.bombs.material as THREE.MeshBasicMaterial).color.set(e.bombColor);
    const { target } = frame;
    let glow = 0;
    const story = new Set<string>();
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
      const waiting = this.story.findIndex((s) => s.island === crater.island);
      if (waiting >= 0 && inSight) {
        this.story.splice(waiting, 1);
        story.add(crater.island);
        this.start(state, e.storyHoldSec);
      }
      // Now and then while the boat is near, with the switch on.
      // Only a big crater erupts now and then; a small vent just smokes.
      const near = frame.eruptions && dist < e.nearUnits && crater.r >= e.minCrater;
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
        for (let j = 0; j < n; j++)
          this.spawnPuff(crater, 0, undefined, 1, (j / n) * smoke.lifeSec, frame);
      }
      glow = Math.max(glow, k);
      state.puffDebt += smoke.perSec * (1 + (e.smokeRate - 1) * k) * dt;
      while (state.puffDebt >= 1) {
        state.puffDebt -= 1;
        this.spawnPuff(crater, k);
      }
      state.bombDebt += e.bombsPerSec * k * dt;
      while (state.bombDebt >= 1) {
        state.bombDebt -= 1;
        this.spawnBomb(index, k);
      }
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

  /** A puff from crater `c` at eruption strength `k`, or from a landing bomb `at`; `age` ahead. */
  private spawnPuff(
    c: Crater,
    k: number,
    at?: THREE.Vector3,
    size = 1,
    age = 0,
    frame?: VolcanoFrame,
  ) {
    const P = this.puff;
    if (P.n >= MAX_PUFFS) return;
    const { smoke, eruptions: e } = TUNING.weather.volcano;
    const i = P.n++;
    const rng = this.rng;
    const a = rng() * Math.PI * 2;
    const r = at ? 0 : rng() * c.r * 0.6;
    P.p.set(
      at ? [at.x, at.y, at.z] : [c.x + Math.cos(a) * r, c.y + 0.5, c.z + Math.sin(a) * r],
      i * 3,
    );
    // A small crater's plume is smaller and lower, in proportion.
    const scale = Math.min(1.5, Math.max(0.25, c.r / smoke.craterRadius));
    const spread = smoke.spread * (1 + k) * scale;
    const rise = smoke.rise * (1 + (e.smokeRise - 1) * k) * (0.8 + rng() * 0.4) * scale;
    P.v.set(
      [(rng() - 0.5) * 2 * spread, at ? rise * 0.4 : rise, (rng() - 0.5) * 2 * spread],
      i * 3,
    );
    P.life[i] = smoke.lifeSec * (at ? 0.35 : 0.8 + rng() * 0.4);
    P.age[i] = Math.min(age, P.life[i]! * 0.98);
    if (P.age[i]! > 0) {
      // Where it would be by now: the rise slows as in stepPuffs, the wind grows with height.
      const a = P.age[i]!,
        L = P.life[i]!;
      const drift = frame ? (smoke.drift * frame.windUnits * a * a) / (2 * L) : 0;
      P.p[i * 3] = P.p[i * 3]! + P.v[i * 3]! * a + (frame?.windX ?? 0) * drift;
      P.p[i * 3 + 1] = P.p[i * 3 + 1]! + P.v[i * 3 + 1]! * (a - (0.25 * a * a) / L);
      P.p[i * 3 + 2] = P.p[i * 3 + 2]! + P.v[i * 3 + 2]! * a + (frame?.windZ ?? 0) * drift;
    }
    const grow = (1 + (e.smokeSize - 1) * k) * size * (at ? 1 : scale);
    P.s0[i] = smoke.size[0]! * grow * (0.8 + rng() * 0.4);
    P.s1[i] = smoke.size[1]! * grow * (0.8 + rng() * 0.4);
    P.spin[i] = rng() * Math.PI * 2;
    // Darker, ashier smoke the stronger the eruption; a little variation puff to puff.
    this.tint
      .copy(this.quiet)
      // A bomb's puff: ash on land, white steam where it hits the sea.
      .lerp(this.ash, at ? (at.y > 0.5 ? 0.7 : 0) : k)
      .multiplyScalar(0.92 + rng() * 0.16);
    this.puffs.setColorAt(i, this.tint);
    this.puffs.instanceColor!.needsUpdate = true;
  }

  private spawnBomb(from: number, k: number) {
    const B = this.bomb;
    if (B.n >= MAX_BOMBS) return;
    const { eruptions: e } = TUNING.weather.volcano;
    const c = this.states[from]!.crater;
    const rng = this.rng;
    const i = B.n++;
    const a = rng() * Math.PI * 2;
    const out = range(rng, e.bombOut[0]!, e.bombOut[1]!);
    B.p.set([c.x + Math.cos(a) * c.r * 0.4, c.y + 0.3, c.z + Math.sin(a) * c.r * 0.4], i * 3);
    B.v.set(
      [
        Math.cos(a) * out,
        range(rng, e.bombUp[0]!, e.bombUp[1]!) * (0.7 + 0.3 * k),
        Math.sin(a) * out,
      ],
      i * 3,
    );
    B.size[i] = range(rng, e.bombSize[0]!, e.bombSize[1]!);
    B.from[i] = from;
  }

  private stepPuffs(dt: number, frame: VolcanoFrame) {
    const P = this.puff;
    const drift = TUNING.weather.volcano.smoke.drift * frame.windUnits;
    const wx = frame.windX * drift,
      wz = frame.windZ * drift;
    let n = 0;
    for (let i = 0; i < P.n; i++) {
      const age = P.age[i]! + dt;
      if (age >= P.life[i]!) continue;
      // Keep the live ones packed at the front (their colours move with them).
      if (n !== i) {
        P.p.copyWithin(n * 3, i * 3, i * 3 + 3);
        P.v.copyWithin(n * 3, i * 3, i * 3 + 3);
        P.life[n] = P.life[i]!;
        P.s0[n] = P.s0[i]!;
        P.s1[n] = P.s1[i]!;
        P.spin[n] = P.spin[i]!;
        this.puffs.getColorAt(i, this.tint);
        this.puffs.setColorAt(n, this.tint);
        this.puffs.instanceColor!.needsUpdate = true;
      }
      P.age[n] = age;
      // Rising slows a little as the puff spreads; the wind takes it more the higher it gets.
      const t = age / P.life[n]!;
      const lift = 1 - 0.5 * t;
      P.p[n * 3] = P.p[n * 3]! + (P.v[n * 3]! + wx * t) * dt;
      P.p[n * 3 + 1] = P.p[n * 3 + 1]! + P.v[n * 3 + 1]! * lift * dt;
      P.p[n * 3 + 2] = P.p[n * 3 + 2]! + (P.v[n * 3 + 2]! + wz * t) * dt;
      // Grows fast, then shrinks away over the last quarter of its life.
      let s = P.s0[n]! + (P.s1[n]! - P.s0[n]!) * Math.sqrt(t);
      if (t > 0.75) s *= (1 - t) / 0.25;
      this.euler.set(P.spin[n]!, P.spin[n]! * 1.7 + age * 0.15, 0);
      this.matrix.compose(
        this.pos.fromArray(P.p, n * 3),
        this.quat.setFromEuler(this.euler),
        this.scale.set(s, s * 0.85, s),
      );
      this.puffs.setMatrixAt(n, this.matrix);
      n++;
    }
    P.n = n;
    this.puffs.count = n;
    this.puffs.instanceMatrix.needsUpdate = true;
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
      // Down on the cone's flank (or in the sea): a puff of ash where it lands.
      const ground = c ? c.y - Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r) * c.slope : 0;
      if (!c || (B.v[i * 3 + 1]! < 0 && (y < ground || y < 0))) {
        if (c) this.spawnPuff(c, 1, this.pos.set(x, Math.max(y, 0), z), B.size[i]! * LANDING_PUFF);
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
