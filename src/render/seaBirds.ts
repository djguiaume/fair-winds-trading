import * as THREE from 'three';
import type { Rng } from '../sim/rng';
import { type BirdKind, shownCount } from '../sim/seaLife';
import { flappingMaterial, lifeModel } from './lifeModels';

/** Where a flock circles now, in sim units, or null when it has nowhere near the boat. */
export type HomeAt = (kind: BirdKind) => { x: number; y: number } | null;

/** One bird: its circle, its place in the flock, and how far it has come down (0 = gone). */
interface Bird {
  /** Its kind's id in `sea-life.json`, for the calls that follow it. */
  id: string;
  kind: BirdKind;
  /** Its place in its kind's flock: the first `shown` birds fly. */
  rank: number;
  /** Sim position of its circle's middle. */
  cx: number;
  cy: number;
  radius: number;
  height: number;
  /** +1 anticlockwise, -1 clockwise. */
  turn: number;
  angle: number;
  phase: number;
  presence: number;
}

/** Seconds a bird takes to come down from the sky, or to fly off. */
const ARRIVE_SEC = 3;
/** How high a leaving bird climbs before it is gone, units. */
const CLIMB = 45;
/** How fast a flock's circle follows a moving home (a share per second): a wake home moves. */
const FOLLOW = { harbour: 0.4, reef: 0.4, wake: 1.6 } as const;

const tmpPosition = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpMatrix = new THREE.Matrix4();

/**
 * Gulls and terns (issue #476): one instanced mesh per bird model, every bird circling its
 * flock's home (a pier head, a reef, the boat's wake). They come down from the sky when the home
 * is near and climb away when it is not, so a flock never pops in or out.
 */
export class SeaBirds {
  readonly root = new THREE.Group();
  private readonly material = flappingMaterial();
  private readonly flocks: { mesh: THREE.InstancedMesh; birds: Bird[] }[] = [];
  private readonly homes = new Map<BirdKind, { x: number; y: number } | null>();

  constructor(kinds: Readonly<Record<string, BirdKind>>, rng: Rng) {
    this.root.name = 'sea-birds';
    const byModel = new Map<string, Bird[]>();
    for (const [id, kind] of Object.entries(kinds)) {
      let birds = byModel.get(kind.model);
      if (!birds) byModel.set(kind.model, (birds = []));
      for (let rank = 0; rank < kind.count; rank++) birds.push(newBird(id, kind, rank, rng));
    }
    for (const [model, birds] of byModel) {
      const mesh = new THREE.InstancedMesh(lifeModel(model), this.material, birds.length);
      mesh.name = model;
      mesh.frustumCulled = false;
      mesh.geometry.setAttribute('aFlap', flapAttribute(birds));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.flocks.push({ mesh, birds });
      this.root.add(mesh);
    }
  }

  /** Each frame: `share` is the quality level's share (0 = none), `night` 0 to 1. */
  update(dt: number, time: number, share: number, night: number, homeAt: HomeAt) {
    this.homes.clear();
    for (const { mesh, birds } of this.flocks) {
      let drawn = 0;
      for (const bird of birds) {
        const { kind } = bird;
        if (!this.homes.has(kind)) this.homes.set(kind, homeAt(kind));
        const home = this.homes.get(kind) ?? null;
        const wanted = home && bird.rank < shownCount(kind.count, share, night, kind.night);
        stepBird(bird, dt, home, wanted ? 1 : 0);
        if (bird.presence <= 0) continue;
        mesh.setMatrixAt(drawn++, birdMatrix(bird, time));
      }
      mesh.count = drawn;
      mesh.visible = drawn > 0;
      mesh.instanceMatrix.needsUpdate = drawn > 0;
    }
  }

  /** Distance from a sim point to the nearest bird of these kinds in the air (Infinity: none). */
  distanceTo(kinds: readonly string[], x: number, y: number): number {
    let d = Infinity;
    for (const { birds } of this.flocks)
      for (const bird of birds)
        if (bird.presence > 0.5 && kinds.includes(bird.id))
          d = Math.min(d, Math.hypot(bird.cx - x, bird.cy - y));
    return d;
  }

  dispose() {
    for (const { mesh } of this.flocks) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
  }
}

function newBird(id: string, kind: BirdKind, rank: number, rng: Rng): Bird {
  const between = ([lo, hi]: [number, number]) => lo + rng() * (hi - lo);
  return {
    id,
    kind,
    rank,
    cx: 0,
    cy: 0,
    radius: between(kind.circle),
    height: between(kind.height),
    turn: rng() < 0.5 ? -1 : 1,
    angle: rng() * Math.PI * 2,
    phase: rng(),
    presence: 0,
  };
}

/** Each instance's wing beat: phase (radians), beats a second, glide share. */
function flapAttribute(birds: readonly Bird[]): THREE.InstancedBufferAttribute {
  const data = new Float32Array(birds.length * 3);
  birds.forEach((b, k) => data.set([b.phase * Math.PI * 2, b.kind.flapHz, b.kind.glide], k * 3));
  return new THREE.InstancedBufferAttribute(data, 3);
}

/** Round its circle, its circle after the home, down from the sky or away. */
function stepBird(bird: Bird, dt: number, home: { x: number; y: number } | null, wanted: number) {
  if (home) {
    if (bird.presence <= 0) {
      bird.cx = home.x;
      bird.cy = home.y;
    } else {
      const k = Math.min(1, FOLLOW[bird.kind.home] * dt);
      bird.cx += (home.x - bird.cx) * k;
      bird.cy += (home.y - bird.cy) * k;
    }
  }
  const step = dt / ARRIVE_SEC;
  bird.presence = Math.min(1, Math.max(0, bird.presence + (wanted ? step : -step)));
  // Each bird keeps its own pace a little off the kind's, so a flock never wheels as one.
  const speed = bird.kind.speed * (0.85 + 0.3 * bird.phase);
  bird.angle += (bird.turn * speed * dt) / bird.radius;
}

function birdMatrix(bird: Bird, time: number): THREE.Matrix4 {
  const { kind, angle, radius, turn, presence } = bird;
  const x = bird.cx + Math.cos(angle) * radius;
  const y = bird.cy + Math.sin(angle) * radius;
  const away = 1 - presence;
  const height = bird.height + Math.sin(time * 0.5 + bird.phase * 6.3) * 1.2 + away * away * CLIMB;
  tmpPosition.set(x, height, -y);
  // Flying along the circle: the heading of its tangent, banked into the turn.
  const heading = Math.atan2(-Math.sin(angle) * turn, Math.cos(angle) * turn);
  tmpEuler.set(0, -heading, turn * 0.32);
  tmpQuaternion.setFromEuler(tmpEuler);
  tmpScale.setScalar(kind.size * (0.4 + 0.6 * presence));
  return tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
}
