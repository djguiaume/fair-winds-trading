import * as THREE from 'three';
import { seaIdAt } from '../audio/seaBed';
import { type Pier } from '../sim/collision';
import { createRng } from '../sim/rng';
import { type BirdKind, SEA_LIFE, nearestWithin, shoreDistance } from '../sim/seaLife';
import { FishShoals } from './fishShoals';
import { lifeClock } from './lifeModels';
import type { QualityLevel } from './quality';
import { SeaBirds } from './seaBirds';
import { Dolphins, type SwimScene, Whale } from './seaSwimmers';

/** What sea life reads of the world: where the boat is, the land, the reefs, the piers. */
export interface LifeWorld {
  piers: readonly Pier[];
  land: { islands: readonly { id: string; x: number; y: number; radius: number }[] };
  reefs: readonly { x: number; y: number }[];
  boat: { x: number; y: number; heading: number; speedKn: number };
}

/** A wake home sits this far astern of the boat, units. */
const ASTERN = 10;
/** Below this the boat leaves no wake worth following, knots. */
const WAKE_KN = 1.5;
/** Seconds between two looks for each flock's home: piers and reefs only change as she sails. */
const HOME_EVERY = 0.5;
const SEED = 476;
/** The shaders' clock wraps after this many seconds. */
const CLOCK_WRAP_SEC = 600;

/**
 * Birds and sea life (issue #476, decision 0285): gulls over the harbours and
 * her wake, terns over the reefs, dolphins that come to the boat, a whale far off and fish
 * shoals, as `src/data/sea-life.json` says. Drawn only, never in the sim; Settings › Sea life
 * hides them, the quality level thins them (none on Ultra-low).
 */
export class SeaLife {
  readonly root = new THREE.Group();
  /** Settings › Sea life. */
  on = true;
  /** The piers the harbour list was made from: the sim makes new ones when a town grows. */
  private piers: readonly Pier[] = [];
  private readonly birds: SeaBirds;
  private readonly dolphins: Dolphins;
  private readonly whale: Whale;
  private readonly shoals: FishShoals;
  private harbours: { x: number; y: number }[] = [];
  private readonly homes = new Map<BirdKind, { x: number; y: number } | null>();
  private readonly wake = { x: 0, y: 0 };
  private sinceHomes = HOME_EVERY;
  private readonly scene: SwimScene;

  constructor(
    private readonly world: LifeWorld,
    private readonly level: () => QualityLevel,
    heightAt: (x: number, z: number) => number,
  ) {
    this.root.name = 'sea-life';
    const rng = createRng(SEED);
    this.birds = new SeaBirds(SEA_LIFE.birds, rng);
    this.dolphins = new Dolphins(SEA_LIFE.dolphins, rng);
    this.whale = new Whale(SEA_LIFE.whale, rng);
    this.shoals = new FishShoals(SEA_LIFE.shoals, rng);
    this.root.add(this.birds.root, this.dolphins.mesh, this.whale.root, this.shoals.mesh);
    this.scene = {
      dt: 0,
      time: 0,
      boat: { x: 0, y: 0, heading: 0, speedKn: 0 },
      seaAt: (x, y) => seaIdAt(x, y),
      shoreAt: (x, y) => shoreDistance(this.world.land.islands, x, y),
      heightAt,
      share: 0,
    };
  }

  /** The quality level's share of every count. */
  private share() {
    return SEA_LIFE.quality[this.level()] ?? 1;
  }

  /** Whether any of it may show: switched on and not on Ultra-low (`sea-life.json` › `quality`). */
  get shown() {
    return this.on && this.share() > 0;
  }

  /** Each frame at sea: `night` 0 to 1, the time in seconds. */
  update(dt: number, time: number, night: number) {
    this.root.visible = this.shown;
    if (!this.root.visible) return;
    // Kept small: a phone's shaders lose the beat on a long voyage's large times.
    lifeClock.value = time % CLOCK_WRAP_SEC;
    const scene = this.scene;
    scene.dt = dt;
    scene.time = time;
    scene.boat = this.world.boat;
    scene.share = this.share();
    this.sinceHomes += dt;
    if (this.sinceHomes >= HOME_EVERY) {
      this.sinceHomes = 0;
      this.homes.clear();
    }
    this.birds.update(dt, time, scene.share, night, (kind) => this.homeOf(kind));
    this.dolphins.update(scene);
    this.whale.update(scene);
    this.shoals.update(scene);
  }

  /** A test aid (`npm run shots`, `?debug`): dolphins come, or the whale surfaces ahead, now. */
  callNow(what: 'dolphins' | 'whale') {
    if (what === 'dolphins') this.dolphins.comeNow();
    else this.whale.surfaceNow();
  }

  /**
   * How far the nearest bird of these kinds flies from a sim point, for the calls that follow the
   * birds; 0 while sea life is hidden, so the sea sounds as it did without it.
   */
  birdDistance(kinds: readonly string[], x: number, y: number): number {
    return this.shown ? this.birds.distanceTo(kinds, x, y) : 0;
  }

  /** A flock's home: the wake moves with her each frame, piers and reefs are looked up now and then. */
  private homeOf(kind: BirdKind): { x: number; y: number } | null {
    const { boat } = this.world;
    if (!kind.seas.includes(seaIdAt(boat.x, boat.y))) return null;
    if (kind.home === 'wake') return this.wakeHome(kind);
    if (!this.homes.has(kind)) {
      const places = kind.home === 'harbour' ? this.harboursNow() : this.world.reefs;
      const k = nearestWithin(places, boat.x, boat.y, kind.range);
      this.homes.set(kind, k < 0 ? null : places[k]!);
    }
    return this.homes.get(kind)!;
  }

  /** The pier heads the gulls circle, made again when the sim's piers change (a town grows). */
  private harboursNow() {
    if (this.piers !== this.world.piers) {
      this.piers = this.world.piers;
      this.harbours = this.piers.filter((p) => !p.boat).map((p) => ({ x: p.x1, y: p.y1 }));
    }
    return this.harbours;
  }

  /** Astern of her while she sails near a coast: gulls follow a boat in sight of land. */
  private wakeHome(kind: BirdKind) {
    const { boat } = this.world;
    if (boat.speedKn < WAKE_KN) return null;
    if (shoreDistance(this.world.land.islands, boat.x, boat.y) > kind.range) return null;
    this.wake.x = boat.x - Math.sin(boat.heading) * ASTERN;
    this.wake.y = boat.y - Math.cos(boat.heading) * ASTERN;
    return this.wake;
  }

  dispose() {
    this.birds.dispose();
    this.dolphins.dispose();
    this.whale.dispose();
    this.shoals.dispose();
  }
}
