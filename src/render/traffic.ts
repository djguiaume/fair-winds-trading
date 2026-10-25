import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { SHIP_FILES } from '../data/ships';
import { trueWindAngle } from '../sim/boat';
import { HULL_SCALE } from '../sim/hullShape';
import type { MapDef } from '../sim/map';
import { designOf } from '../data/islands';
import { DEG, clamp, wrapAngle } from '../sim/math';
import { noGoAngle } from '../sim/ship';
import type { TrafficBoat, TrafficKind, TrafficState } from '../sim/traffic';
import { windTo } from '../sim/wind';
import { glowTexture } from './lanterns';
import { mergeAll, vertexColorMaterial } from './models/geometry';
import { buildProp } from './models/propRecipe';
import { RefinedBoat } from './models/refinedBoat';
import { rigOf } from './models/shipModels';
import { PALETTE } from '../data/props';

/** The recipe each small kind is drawn from (src/data/props); visitors are ship models. */
const RECIPES: Partial<Record<TrafficKind, string>> = {
  fishing: 'traffic-fishing',
  coaster: 'traffic-coaster',
};

/** A drawn kind in one home style and colour: one instanced hull, one instanced mesh per sail. */
interface Batch {
  hulls: THREE.InstancedMesh;
  sails: THREE.InstancedMesh[];
  /** Where each sail's luff meets the boom, in model units, bow toward −Z. */
  pivots: THREE.Vector3[];
  /** Model units to scene units. */
  scale: number;
  /** Stern lantern and masthead light, in model units. */
  lights: THREE.Vector3[];
  count: number;
}

/** One visitor's model: at most one is drawn, the nearest (decision 0214). */
interface Visitor {
  model: RefinedBoat;
  key: string;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The other boats on the sea (decision 0214), drawn from the World's traffic, which only the
 * simulation moves. Fishing boats and coasters are instanced: one draw for every hull of a kind
 * and home colour, one for each of its sails, so the cap (Settings › Quality, `atOnce`) costs a
 * handful of draws. A far-sea visitor is the real ship model in her sea's livery, one at a time.
 * At night each shows a stern lantern and a masthead light, from one point cloud.
 */
export class TrafficView {
  readonly root = new THREE.Group();
  private readonly hullMaterial = vertexColorMaterial();
  private readonly sailMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    flatShading: true,
    emissive: '#ffffff',
    emissiveIntensity: 0.25,
  });
  private readonly batches = new Map<string, Batch>();
  private readonly styles: Map<string, string>;
  private visitor: Visitor | null = null;
  private readonly matrix = new THREE.Matrix4();
  private readonly sailMatrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly position = new THREE.Vector3();
  private readonly scaleVec = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Matrix4();
  private readonly lightPositions: Float32Array;
  private readonly lightGeometry = new THREE.BufferGeometry();
  private readonly lightMaterial: THREE.PointsMaterial;
  private readonly lightTexture = glowTexture();
  private readonly lights: THREE.Points;
  /** The most boats ever drawn at once: the High cap. */
  private readonly most: number;

  constructor(map: MapDef) {
    this.root.name = 'traffic';
    const islandStyle = new Map(map.islands.map((i) => [i.id, designOf(i)?.style ?? 'fish']));
    this.styles = new Map(map.ports.map((p) => [p.id, islandStyle.get(p.islandId) ?? 'fish']));
    this.most = Math.max(...Object.values(TUNING.seamanship.traffic.atOnce));
    this.lightPositions = new Float32Array(this.most * 2 * 3);
    this.lightGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.lightPositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    // Small warm lamps (the lit-window colour), never brighter than the player's own lantern.
    this.lightMaterial = new THREE.PointsMaterial({
      size: 1.6,
      color: PALETTE.colors.lamp as string,
      map: this.lightTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    });
    this.lights = new THREE.Points(this.lightGeometry, this.lightMaterial);
    this.lights.frustumCulled = false;
    this.lights.renderOrder = 4;
    this.root.add(this.lights);
  }

  /** The batch a boat is drawn in: her kind, in her home's style and her band colour. */
  private batchOf(b: TrafficBoat): Batch | null {
    const recipe = RECIPES[b.fleet.kind];
    if (!recipe) return null;
    const style = this.styles.get(b.fleet.home) ?? 'fish';
    const variant = b.fleetIndex % 2;
    const key = `${recipe}:${style}:${variant}`;
    let batch = this.batches.get(key);
    if (batch) return batch;
    const parts = buildProp(recipe, { R: 1, style, variant, shape: 0.5, size: 1 });
    const turn = (g: THREE.BufferGeometry) => g.rotateY(Math.PI);
    const pivots: THREE.Vector3[] = [];
    const sails: THREE.InstancedMesh[] = [];
    const hull: THREE.BufferGeometry[] = [];
    for (const g of parts) {
      const at = g.userData.sail as [number, number, number] | undefined;
      if (!at) {
        hull.push(turn(g));
        continue;
      }
      // Bow toward −Z like the ship models: the recipe's +Z turned round.
      pivots.push(new THREE.Vector3(-at[0], at[1], -at[2]));
      const sail = new THREE.InstancedMesh(turn(g), this.sailMaterial, this.most);
      sail.count = 0;
      sail.frustumCulled = false;
      sails.push(sail);
    }
    const geometry = mergeAll(hull);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const hulls = new THREE.InstancedMesh(geometry, this.hullMaterial, this.most);
    hulls.count = 0;
    hulls.frustumCulled = false;
    hulls.castShadow = true;
    const kind = TUNING.seamanship.traffic.kinds[b.fleet.kind]!;
    const top = Math.max(box.max.y, ...pivots.map((p) => p.y));
    batch = {
      hulls,
      sails,
      pivots,
      scale: HULL_SCALE * kind.scale,
      // A fishing boat shows one stern lamp; a coaster a stern lamp and a masthead pin.
      lights:
        b.fleet.kind === 'fishing'
          ? [new THREE.Vector3(0, box.max.y * 0.9, box.max.z * 0.9)]
          : [new THREE.Vector3(0, box.max.y * 0.9, box.max.z * 0.9), new THREE.Vector3(0, top, 0)],
      count: 0,
    };
    // The masthead light over the tallest mast, at its foot's distance from the bow.
    const mast = pivots.reduce((a, p) => (p.y > a.y ? p : a), pivots[0] ?? UP);
    if (batch.lights[1]) batch.lights[1].z = mast.z;
    this.root.add(hulls, ...sails);
    this.batches.set(key, batch);
    return batch;
  }

  /** A visitor's model in her livery (`liveryNorth`… in the palette), built once and kept. */
  private visitorOf(b: TrafficBoat): RefinedBoat | null {
    const ship = b.fleet.ship ?? TUNING.seamanship.traffic.kinds.visitor?.ship ?? 'fluyt';
    const livery = b.fleet.livery ?? '';
    const key = `${ship}:${livery}`;
    if (this.visitor?.key === key) return this.visitor.model;
    const file = SHIP_FILES.find((f) => f.id === ship);
    if (!file) return null;
    if (this.visitor) {
      this.root.remove(this.visitor.model.root);
      this.visitor.model.dispose();
    }
    const name = `livery${livery.charAt(0).toUpperCase()}${livery.slice(1)}`;
    const band = PALETTE.colors[name];
    const rig = rigOf(file);
    const model = new RefinedBoat(
      { ...rig, band: typeof band === 'string' ? band : rig.band },
      { upgrades: { sails: 1, hold: 2, hull: 2 }, rigging: false },
    );
    this.visitor = { model, key };
    this.root.add(model.root);
    return model;
  }

  /**
   * Draws the boats awake now. `wave` is the sea's height at a scene point; `glow` the night's
   * (and a storm's) 0..1 for the lanterns; `near` the player, whose nearest visitor is drawn.
   */
  update(
    traffic: TrafficState,
    time: number,
    wave: (x: number, z: number) => number,
    glow: number,
    near: { x: number; y: number },
  ) {
    for (const batch of this.batches.values()) batch.count = 0;
    let lights = 0;
    let shownVisitor: TrafficBoat | null = null;
    let visitorD = Infinity;
    const shown = traffic.on ? traffic.boats.filter((b) => b.awake) : [];
    for (const b of shown) {
      if (b.fleet.kind === 'visitor') {
        // The nearest one: only one big model at a time.
        const d = Math.hypot(b.boat.x - near.x, b.boat.y - near.y);
        if (!shownVisitor || d < visitorD) {
          shownVisitor = b;
          visitorD = d;
        }
        continue;
      }
      const batch = this.batchOf(b);
      if (!batch || batch.count >= this.most) continue;
      const pose = this.pose(b, wave);
      this.scaleVec.setScalar(batch.scale);
      this.matrix.compose(this.position, this.quaternion, this.scaleVec);
      const i = batch.count++;
      batch.hulls.setMatrixAt(i, this.matrix);
      batch.sails.forEach((sail, k) => {
        const pivot = batch.pivots[k]!;
        // Set and trimmed under way. Lowered (at a harbour, on the nets) she keeps it half up,
        // streaming downwind, so even a boat at rest shows the wind.
        const set = pose.sail > 0.05;
        const s = set ? 1 : 0.6;
        const boom = set ? pose.boom : pose.stream;
        this.sailMatrix.makeRotationY(boom).scale(this.tmp.setScalar(s)).setPosition(pivot);
        sail.setMatrixAt(i, this.tmp2.multiplyMatrices(this.matrix, this.sailMatrix));
      });
      for (const light of batch.lights)
        if (lights < this.most * 2)
          this.lightPositions.set(
            this.tmp.copy(light).applyMatrix4(this.matrix).toArray(),
            lights++ * 3,
          );
    }
    for (const batch of this.batches.values()) {
      batch.hulls.count = batch.count;
      batch.hulls.instanceMatrix.needsUpdate = true;
      for (const sail of batch.sails) {
        sail.count = batch.count;
        sail.instanceMatrix.needsUpdate = true;
      }
    }

    // The far-sea visitor: her real model, posed like the player's.
    const visitor = shownVisitor ? this.visitorOf(shownVisitor) : null;
    if (this.visitor) this.visitor.model.root.visible = !!visitor;
    if (visitor && shownVisitor) {
      const pose = this.pose(shownVisitor, wave);
      visitor.update({
        sail: pose.sail,
        boomAngle: pose.boom,
        luff: pose.luff,
        heel: pose.heel,
        windRelative: wrapAngle(windTo(shownVisitor.wind) - shownVisitor.boat.heading),
        time,
      });
      visitor.root.position.copy(this.position);
      visitor.root.rotation.set(pose.pitch, -shownVisitor.boat.heading, 0);
      visitor.setNightLighting?.(glow);
      if (visitor.lantern && lights < this.most * 2) {
        visitor.lantern.updateWorldMatrix(true, false);
        visitor.lantern.getWorldPosition(this.tmp);
        this.lightPositions.set(this.tmp.toArray(), lights++ * 3);
      }
    }

    this.lights.visible = glow > 0.02 && lights > 0;
    if (this.lights.visible) {
      this.lightGeometry.setDrawRange(0, lights);
      this.lightGeometry.attributes.position!.needsUpdate = true;
      this.lightMaterial.opacity = Math.min(1, glow) * (0.7 + 0.1 * Math.sin(time * 6.1));
    }
  }

  /**
   * Where a boat is drawn and how her sails set: the player's rules (view.ts) at a smaller heel,
   * leaving `position` and `quaternion` set for her hull.
   */
  private pose(b: TrafficBoat, wave: (x: number, z: number) => number) {
    const { boat } = b;
    const twa = trueWindAngle(boat.heading, b.wind);
    const abs = Math.abs(twa);
    const lee = twa > 0 ? -1 : 1;
    const noGo = noGoAngle(b.ship);
    const luff = 1 - clamp((abs - noGo * 0.8) / (noGo * 0.3), 0, 1);
    const boomMag = (12 + clamp((abs / DEG - 45) / 135, 0, 1) * 68) * DEG;
    const sail = boat.sail;
    const boom = lee * boomMag * (1 - luff * 0.7);
    // She leans away from the wind, most on a reach in a breeze, never as far as the player.
    const press = clamp(b.wind.speedKn / 20, 0, 1) * Math.sin(Math.min(abs, Math.PI / 2));
    const heel = -lee * press * sail * (1 - luff) * 12 * DEG;
    const dx = Math.sin(boat.heading) * 3;
    const dz = -Math.cos(boat.heading) * 3;
    const x = boat.x;
    const z = -boat.y;
    const front = wave(x + dx, z + dz);
    const back = wave(x - dx, z - dz);
    const pitch = Math.atan2(front - back, 6) * 0.8;
    this.position.set(x, (front + back) * 0.4, z);
    this.euler.set(pitch, -boat.heading, heel);
    this.quaternion.setFromEuler(this.euler);
    // A loose sail swings to leeward as far as the sheet lets it.
    const stream = lee * boomMag;
    return { sail, boom, luff, heel, pitch, stream };
  }

  dispose() {
    for (const batch of this.batches.values()) {
      batch.hulls.geometry.dispose();
      for (const sail of batch.sails) sail.geometry.dispose();
    }
    this.visitor?.model.dispose();
    this.hullMaterial.dispose();
    this.sailMaterial.dispose();
    this.lightGeometry.dispose();
    this.lightMaterial.dispose();
    this.lightTexture.dispose();
  }
}
