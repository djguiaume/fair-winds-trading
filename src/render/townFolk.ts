import * as THREE from 'three';
import { designOf } from '../data/islands';
import { PALETTE } from '../data/props';
import { islandPoint } from '../sim/islandLayout';
import { ISLAND_SCALE } from '../sim/islandUnits';
import type { IslandDef, PortDef } from '../sim/map';
import { type Rng, createRng, range } from '../sim/rng';
import { groupShare, shownCount } from '../sim/seaLife';
import {
  type FolkKind,
  TOWN_FOLK,
  type Walk,
  alongWalk,
  splitByKind,
  townPeople,
} from '../sim/townFolk';
import { GAIT, type Gait, folkModel, walkingMaterial } from './folkModel';
import { townWalks } from './folkWalks';
import { lifeClock } from './lifeModels';
import { type Stand, propStand } from './models/townProps';
import { QUALITY_LEVELS, type QualityLevel } from './quality';

/** What the town folk read of the world: the ports, the land standing now, where the boat is. */
export interface FolkWorld {
  map: { ports: readonly PortDef[] };
  land: { islands: readonly IslandDef[]; out: ReadonlySet<string> };
  boat: { x: number; y: number };
}

/** One person: its kind, its walk, where it is along it, and its own beat. */
interface Person {
  kind: FolkKind;
  walk: Walk;
  /** Distance along the walk, radius units; +1 outward, -1 back. */
  s: number;
  dir: 1 | -1;
  /** Seconds left standing at the end of the walk. */
  rest: number;
  heading: number;
  phase: number;
  gait: Gait;
  coat: THREE.Color;
}

/** A town's people while the boat is near: made outside the town's rebuild, dropped when far. */
interface Crowd {
  island: IslandDef;
  stand: Stand;
  rng: Rng;
  people: Person[];
  /** 0 gone to 1 fully there: a crowd fades in and out, never pops. */
  presence: number;
  distance: number;
}

const SEED = 477;
/** The shaders' clock wraps after this many seconds (shared with the sea life). */
const CLOCK_WRAP_SEC = 600;

const tmpAt = { x: 0, z: 0, y: undefined as number | undefined, heading: 0 };
const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpMatrix = new THREE.Matrix4();

/**
 * People on the quays and in the towns (issue #477): one instanced mesh of tiny walkers in the
 * lanes, strollers and fishermen on the piers and dock workers by the cargo, in every town near
 * the boat, as `src/data/town-folk.json` says. Drawn only, never in the sim; Settings › Town
 * folk hides them, the quality level thins them (none on Ultra-low). A town's people are made
 * when the boat comes near, outside the town's rebuild (decision 0116), and more as it grows.
 */
export class TownFolk {
  readonly root = new THREE.Group();
  /** Settings › Town folk. */
  on = true;
  readonly mesh: THREE.InstancedMesh;
  private readonly material = walkingMaterial();
  private readonly walkAttr: THREE.InstancedBufferAttribute;
  private readonly crowds = new Map<string, Crowd>();
  private readonly coats: THREE.Color[];
  private readonly data = TOWN_FOLK;

  constructor(
    private readonly world: FolkWorld,
    private readonly level: () => QualityLevel,
    /** Town levels by port id, 0 for a site not founded yet (decision 0157). */
    private levels: Readonly<Record<string, number>>,
  ) {
    this.root.name = 'town-folk';
    const { town } = this.data;
    this.mesh = new THREE.InstancedMesh(folkModel(town.model), this.material, town.max);
    this.mesh.name = 'folk';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(town.max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.walkAttr = new THREE.InstancedBufferAttribute(new Float32Array(town.max * 3), 3);
    this.walkAttr.setUsage(THREE.DynamicDrawUsage);
    this.mesh.geometry.setAttribute('aWalk', this.walkAttr);
    const list = PALETTE.colors[town.coats];
    this.coats = (Array.isArray(list) ? list : [list ?? '#ffffff']).map((c) => new THREE.Color(c));
    this.root.add(this.mesh);
  }

  /** The quality level's share of every count; 0 on Ultra-low. */
  private share() {
    return groupShare(this.data, QUALITY_LEVELS, this.level(), QUALITY_LEVELS[0]!);
  }

  /** Whether any of it may show: switched on and not on Ultra-low. */
  get shown() {
    return this.on && this.share() > 0;
  }

  /** Towns that grew get their people again, made afresh the next time the boat is near. */
  setLevels(levels: Readonly<Record<string, number>>) {
    for (const [id, crowd] of this.crowds)
      if (levels[id] !== this.levels[id] || crowd.island !== this.islandOf(id))
        this.crowds.delete(id);
    this.levels = levels;
  }

  /** Each frame: `night` 0 to 1, the time in seconds. */
  update(dt: number, time: number, night: number) {
    this.root.visible = this.shown;
    if (!this.root.visible) return;
    lifeClock.value = time % CLOCK_WRAP_SEC;
    const share = this.share();
    const { mesh } = this;
    const { town } = this.data;
    const step = dt / town.fadeSec;
    const near: Crowd[] = [];
    for (const port of this.world.map.ports) {
      const level = this.levels[port.id] ?? 0;
      const island = this.islandOf(port.islandId);
      if (!island || level < 1 || this.world.land.out.has(island.id)) continue;
      const distance = Math.hypot(island.x - this.world.boat.x, island.y - this.world.boat.y);
      const wanted = distance - island.radius <= town.range;
      let crowd = this.crowds.get(island.id);
      if (!crowd) {
        if (!wanted) continue;
        const made = this.makeCrowd(island, level);
        if (!made) continue;
        crowd = made;
        this.crowds.set(island.id, crowd);
      }
      crowd.distance = distance;
      crowd.presence = Math.min(1, Math.max(0, crowd.presence + (wanted ? step : -step)));
      if (crowd.presence <= 0) this.crowds.delete(island.id);
      else near.push(crowd);
    }
    near.sort((a, b) => a.distance - b.distance);
    let drawn = 0;
    for (const crowd of near) {
      const shown = shownCount(crowd.people.length, share, night, town.night);
      for (let k = 0; k < shown && drawn < town.max; k++) {
        this.place(crowd, crowd.people[k]!, dt, drawn++);
      }
    }
    mesh.count = drawn;
    mesh.visible = drawn > 0;
    mesh.instanceMatrix.needsUpdate = drawn > 0;
    mesh.instanceColor!.needsUpdate = drawn > 0;
    this.walkAttr.needsUpdate = drawn > 0;
  }

  private islandOf(id: string) {
    return this.world.land.islands.find((i) => i.id === id);
  }

  /** A town's people, each on a walk of its kind (null: no town, or nowhere to go). */
  private makeCrowd(island: IslandDef, level: number): Crowd | null {
    const design = designOf(island);
    if (!design) return null;
    const R = island.radius / ISLAND_SCALE;
    const walks = townWalks(design, R, level, !!island.look?.dock, this.data.town);
    if (!walks.length) return null;
    const rng = createRng(SEED + design.seed);
    const kinds = Object.values(this.data.kinds);
    const counts = splitByKind(this.data.kinds, townPeople(this.data.town, level));
    const people: Person[] = [];
    kinds.forEach((kind, k) => {
      const own = walks.filter((w) => w.where === kind.where);
      const choices = own.length ? own : walks.filter((w) => w.where !== 'edge');
      for (let i = 0; i < counts[k]! && choices.length; i++) {
        const walk = choices[Math.floor(rng() * choices.length)]!;
        people.push({
          kind,
          walk,
          s: rng() * walk.length,
          dir: rng() < 0.5 ? -1 : 1,
          rest: 0,
          heading: walk.turn ?? 0,
          phase: rng() * Math.PI * 2,
          gait: GAIT.stand,
          coat: this.coats[Math.floor(rng() * this.coats.length)]!,
        });
      }
    });
    // Shuffled, so thinning by quality or night keeps a mix of kinds.
    people.sort(() => rng() - 0.5);
    return {
      island,
      stand: propStand(island, level),
      rng,
      people,
      presence: 0,
      distance: 0,
    };
  }

  /** Walks a person on, and writes its instance: where it stands, its coat and its gait. */
  private place(crowd: Crowd, p: Person, dt: number, index: number) {
    stepPerson(p, dt, crowd.island.radius / ISLAND_SCALE, crowd.rng);
    const at = alongWalk(p.walk, p.s, tmpAt);
    const { island } = crowd;
    const world = islandPoint(island, at.x, at.z);
    const height = at.y ?? crowd.stand(at.x, at.z);
    tmpPosition.set(world.x, height * ISLAND_SCALE, -world.y);
    // The file's heading (from +z, the harbour) turned with the island into the scene.
    const a = Math.PI - (island.look?.harbourBearing ?? 0);
    const dx = Math.sin(p.heading),
      dz = Math.cos(p.heading);
    const wx = Math.cos(a) * dx + Math.sin(a) * dz,
      wy = Math.sin(a) * dx - Math.cos(a) * dz;
    tmpEuler.set(0, Math.atan2(wx, -wy), 0);
    tmpQuaternion.setFromEuler(tmpEuler);
    tmpScale.setScalar(this.data.town.size * ISLAND_SCALE * crowd.presence);
    this.mesh.setMatrixAt(index, tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale));
    this.mesh.setColorAt(index, p.coat);
    this.walkAttr.setXYZ(index, p.phase, p.kind.stepHz, p.gait);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
  }
}

/** Along its walk and back, resting at each end; a worker carries on the way out. */
export function stepPerson(p: Person, dt: number, R: number, rng: Rng) {
  const { walk, kind } = p;
  if (walk.length === 0 || kind.speed === 0) {
    p.gait = walk.where === 'edge' ? GAIT.fish : GAIT.stand;
    return;
  }
  if (p.rest > 0) {
    p.rest -= dt;
    p.gait = GAIT.stand;
    return;
  }
  p.s += (p.dir * kind.speed * dt) / R;
  if (p.s >= walk.length || p.s <= 0) {
    p.s = Math.max(0, Math.min(walk.length, p.s));
    p.dir = p.dir === 1 ? -1 : 1;
    p.rest = range(rng, kind.pauseSec[0], kind.pauseSec[1]);
  }
  alongWalk(walk, p.s, tmpAt);
  p.heading = p.dir === 1 ? tmpAt.heading : tmpAt.heading + Math.PI;
  p.gait = walk.where === 'cargo' && p.dir === 1 ? GAIT.carry : GAIT.walk;
}
