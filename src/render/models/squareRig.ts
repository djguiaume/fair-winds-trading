import * as THREE from 'three';
import type { BoatLook } from './boatLook';
import { STYLE_D as ST } from './boatStyle';
import { mergeAll, paint } from './geometry';
import { cloth, type ClothDress } from './sailCloth';
import { V, halfBeamAt, spar, type SquareMast } from './refinedRig';

/*
 * The square-rigged masts of the hauler line (decision 0079): stacked courses hang from yards
 * that brace round together. Built once; posed each frame without rebuilding any geometry.
 */

/** Square courses hang this far forward of their mast and belly up to this much further. */
export const SQUARE_FORWARD = 0.14;
export const SQUARE_BELLY = 0.3;
/** Boom angles the game draws close-hauled and dead downwind (view.ts), and the hardest brace. */
const CLOSE_BOOM = (12 * Math.PI) / 180;
const RUN_BOOM = (80 * Math.PI) / 180;
const MAX_BRACE = (40 * Math.PI) / 180;

/** A square mast placed on the deck: its foot, height and the span of each course. */
export interface PlacedSquareMast extends SquareMast {
  base: number;
  height: number;
  span: number;
}

/**
 * Stands each square mast on the deck: the mast and a fighting top above the lowest course go
 * into `parts`, the hull mesh.
 */
export function placeSquareMasts(
  masts: readonly SquareMast[],
  standAt: (z: number) => number,
  parts: THREE.BufferGeometry[],
): PlacedSquareMast[] {
  return masts.map((m) => {
    const base = standAt(m.z);
    const height = m.height * ST.mastK;
    const span = (height - 1.5) / m.courses;
    parts.push(spar(V(0, base, m.z), V(0, base + height, m.z), 0.085));
    const topY = base + 1.1 + span * 0.92 + 0.1;
    parts.push(
      paint(new THREE.CylinderGeometry(0.42, 0.3, 0.12, 6).translate(0, topY, m.z), ST.mast),
    );
    return { ...m, base, height, span };
  });
}

/** One square-rigged mast: every course hangs from its own yard; all brace round together. */
export interface SquareRig {
  turn: THREE.Group;
  sails: THREE.Mesh;
  /** Per course, in the yards' frame: yard height, foot depth below it, half foot width. */
  courses: Array<{ yard: number; drop: number; half: number }>;
  /** Yard-arm ends, where the course above sheets home. */
  yardArms: number[];
  /** The lowest course sheets home to the rail here, aft of its mast (port, starboard). */
  rail: [THREE.Vector3, THREE.Vector3];
}

/** What a square mast needs from the ship being built. */
export interface SquareRigContext {
  /** Scaled beam. */
  beam: number;
  sails: number;
  look: BoatLook;
  outline: THREE.Vector3[];
  standAt: (z: number) => number;
  /** The dress of each course from the bottom (`k` 0) up. */
  dress: (k: number) => ClothDress;
  mesh: (g: THREE.BufferGeometry, kind: 'wood' | 'canvas', name: string) => THREE.Mesh;
}

/**
 * One square mast's yards and courses. Each course hangs from its own yard, just forward of the
 * mast, and bellies toward the bow. All of one mast's courses are one mesh; furling is a morph
 * toward each course's own yard, so every head stays on its yard.
 */
export function buildSquareRig(m: PlacedSquareMast, ctx: SquareRigContext) {
  const turn = new THREE.Group();
  turn.name = `${m.name}Brace`;
  turn.position.set(0, 0, m.z + SQUARE_FORWARD);
  const shown = m.courses - (ctx.sails >= 3 ? 0 : 1);
  const pos: number[] = [];
  const furled: number[] = [];
  const colors: number[] = [];
  const glows: number[] = [];
  const markSides: number[] = [];
  const yardParts: THREE.BufferGeometry[] = [];
  const courses: SquareRig['courses'] = [];
  const yardArms: number[] = [];
  for (let k = 0; k < shown; k++) {
    const foot = m.base + 1.1 + k * m.span;
    const yard = foot + m.span * 0.92;
    const w = ctx.beam * 1.32 * (1 - 0.16 * k);
    const head = w * 0.88;
    // Authored in the cloth's own plane (luff along z), then turned square across the ship.
    const g = cloth(
      V(0, foot, -w / 2),
      V(0, foot, w / 2),
      V(0, yard, -head / 2),
      V(0, yard, head / 2),
      ctx.sails,
      SQUARE_BELLY,
      ctx.look,
      5,
      4,
      ctx.dress(k),
    ).rotateY(Math.PI / 2);
    const p = g.getAttribute('position');
    const c = g.getAttribute('color');
    const glow = g.getAttribute('glow');
    const mark = g.getAttribute('mark');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      furled.push(p.getX(i), yard + (p.getY(i) - yard) * 0.06, p.getZ(i));
      colors.push(c.getX(i), c.getY(i), c.getZ(i));
      glows.push(glow.getX(i));
      markSides.push(mark.getX(i));
    }
    g.dispose();
    yardParts.push(spar(V(-head * 0.56, yard, 0), V(head * 0.56, yard, 0), 0.05));
    courses.push({ yard, drop: yard - foot, half: w / 2 });
    yardArms.push(head * 0.56);
  }
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sailGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  sailGeo.setAttribute('glow', new THREE.Float32BufferAttribute(glows, 1));
  sailGeo.setAttribute('mark', new THREE.Float32BufferAttribute(markSides, 1));
  sailGeo.morphAttributes.position = [new THREE.Float32BufferAttribute(furled, 3)];
  sailGeo.computeVertexNormals();
  turn.add(ctx.mesh(mergeAll(yardParts), 'wood', `${m.name}Yards`));
  const sails = ctx.mesh(sailGeo, 'canvas', `${m.name}Courses`);
  sails.updateMorphTargets();
  turn.add(sails);
  const railZ = m.z - 1.4;
  const railX = halfBeamAt(ctx.outline, railZ) * 0.9;
  const railY = ctx.standAt(railZ) + 0.2;
  const rig: SquareRig = {
    turn,
    sails,
    courses,
    yardArms,
    rail: [V(-railX, railY, railZ), V(railX, railY, railZ)],
  };
  return { rig, shown };
}

/**
 * Yards brace against the boom: square when running, hard round (up to 40°) close-hauled, the
 * leeward yard-arms aft; the brace eases through zero as the boom crosses in a tack.
 */
export function braceFor(boomAngle: number) {
  const boom = Math.abs(boomAngle);
  return (
    -Math.sign(boomAngle) *
    MAX_BRACE *
    (1 - Math.min(1, Math.max(0, (boom - CLOSE_BOOM) / (RUN_BOOM - CLOSE_BOOM)))) *
    Math.min(1, boom / CLOSE_BOOM)
  );
}

/** Square sails always fill toward the bow; `fill` scales their belly, `sail` furls them. */
export function poseSquareRig(rig: SquareRig, brace: number, sail: number, fill: number) {
  rig.turn.rotation.y = brace;
  rig.turn.updateMatrix();
  rig.sails.morphTargetInfluences![0] = 1 - sail;
  rig.sails.scale.z = fill;
}

/**
 * Each course's clews sheet home to the yard-arms below it; the lowest course's to the rail.
 * `put` receives each line end in turn, in ship-local coordinates; `reef` is the furl share.
 */
export function squareSheetEnds(
  rig: SquareRig,
  reef: number,
  tmp: THREE.Vector3,
  put: (p: THREE.Vector3) => void,
) {
  rig.courses.forEach((c, k) => {
    for (const s of [-1, 1]) {
      const below = rig.courses[k - 1];
      if (below)
        put(tmp.set(s * rig.yardArms[k - 1]!, below.yard, 0).applyMatrix4(rig.turn.matrix));
      else put(rig.rail[s < 0 ? 0 : 1]);
      put(tmp.set(s * c.half, c.yard - c.drop * reef, 0).applyMatrix4(rig.turn.matrix));
    }
  });
}
