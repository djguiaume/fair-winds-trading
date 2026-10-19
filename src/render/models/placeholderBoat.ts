import * as THREE from 'three';
import { PALETTE } from '../palette';
import { mergeAll, paint, place, vertexColorMaterial } from './geometry';
import type { BoatModel, BoatModelFactory, BoatPose } from './types';

/** Hull outline seen from above; bow at y = -3.2 becomes -Z after rotation. */
function hullShape(scale = 1): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -3.2 * scale);
  s.quadraticCurveTo(1.3 * scale, -1.2 * scale, 1.05 * scale, 2.4 * scale);
  s.lineTo(-1.05 * scale, 2.4 * scale);
  s.quadraticCurveTo(-1.3 * scale, -1.2 * scale, 0, -3.2 * scale);
  return s;
}

/** Shape extruded downward from y = 0 (rotateX(π/2) maps shape y → +Z, depth → -Y). */
function slab(shape: THREE.Shape, depth: number) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 }).rotateX(
    Math.PI / 2,
  );
}

/** A triangle sail; `belly` vertex is pushed sideways via the mesh's scale.x to look filled. */
function sailGeometry(head: number[], tack: number[], clew: number[], belly: number[]) {
  const g = new THREE.BufferGeometry();
  const v = [...head, ...tack, ...belly, ...tack, ...clew, ...belly, ...clew, ...head, ...belly];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Placeholder sloop built from primitives (Phase 0). Hull, deck, cabin and mast are one merged
 * mesh; the mainsail swings on its boom, the jib follows, and a pennant shows the wind.
 */
class PlaceholderSloop implements BoatModel {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly boom = new THREE.Group();
  private readonly main: THREE.Mesh;
  private readonly jib: THREE.Mesh;
  private readonly pennant = new THREE.Group();
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor() {
    const parts = [
      paint(place(slab(hullShape(), 1.05), 0, 0.62, 0), PALETTE.hull),
      paint(place(slab(hullShape(0.9), 0.06), 0, 0.68, 0.05), PALETTE.deck),
      paint(place(new THREE.BoxGeometry(1.2, 0.55, 1.3), 0, 0.95, 1.2), PALETTE.wood),
      paint(place(new THREE.BoxGeometry(1.35, 0.12, 1.45), 0, 1.27, 1.2), PALETTE.mast),
      paint(place(new THREE.BoxGeometry(0.45, 0.4, 0.45), -0.35, 0.88, -1.6, 0.3), '#b98a4a'),
      paint(place(new THREE.BoxGeometry(0.4, 0.35, 0.4), 0.3, 0.86, -1.9, -0.2), '#b98a4a'),
      paint(place(new THREE.CylinderGeometry(0.07, 0.11, 5.4, 6), 0, 3.3, -0.6), PALETTE.mast),
    ];
    const hullGeo = mergeAll(parts);
    const hullMat = vertexColorMaterial();
    this.disposables.push(hullGeo, hullMat);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.castShadow = true;
    this.body.add(hull);

    const sailMat = new THREE.MeshLambertMaterial({
      color: PALETTE.sail,
      emissive: PALETTE.sail,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const woodMat = new THREE.MeshLambertMaterial({ color: PALETTE.mast, flatShading: true });
    this.disposables.push(sailMat, woodMat);

    // Boom pivots on the mast; the sail is drawn in boom space (aft = +Z).
    this.boom.position.set(0, 1.45, -0.6);
    const boomGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.9, 5).rotateX(Math.PI / 2);
    boomGeo.translate(0, 0, 1.45);
    const mainGeo = sailGeometry([0, 4.1, 0.05], [0, 0.08, 0.05], [0, 0.08, 2.8], [0.55, 1.5, 1.1]);
    this.disposables.push(boomGeo, mainGeo);
    this.boom.add(new THREE.Mesh(boomGeo, woodMat));
    this.main = new THREE.Mesh(mainGeo, sailMat);
    this.main.castShadow = true;
    this.boom.add(this.main);
    this.body.add(this.boom);

    // Jib from the bow to high on the mast, drawn relative to its tack at the bow.
    const jibGeo = sailGeometry([0, 3.6, 2.45], [0, 0, 0], [0, 0.3, 2.1], [0.4, 1.0, 1.4]);
    this.disposables.push(jibGeo);
    this.jib = new THREE.Mesh(jibGeo, sailMat);
    this.jib.position.set(0, 0.8, -3.05);
    this.jib.castShadow = true;
    this.body.add(this.jib);

    // Pennant at the masthead.
    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0.2, 0, 0, -0.2, 0, 0, 0, 1.1], 3),
    );
    flagGeo.computeVertexNormals();
    const flagMat = new THREE.MeshBasicMaterial({ color: '#d8432f', side: THREE.DoubleSide });
    this.disposables.push(flagGeo, flagMat);
    this.pennant.add(new THREE.Mesh(flagGeo, flagMat));
    this.pennant.position.set(0, 6.0, -0.6);
    this.body.add(this.pennant);

    // Primitives above are drawn for a ~5.6 m hull; boats are drawn chunky (~11 m), like the
    // reference ad, so they read well from the high camera.
    this.body.scale.setScalar(2);
    this.root.add(this.body);
  }

  update(p: BoatPose): void {
    this.body.rotation.z = p.heel;
    this.boom.rotation.y = p.boomAngle;
    const side = p.boomAngle < 0 ? -1 : 1;
    const flutter = p.luff * Math.sin(p.time * 26) * 0.6;
    const fill = side * Math.max(0.08, 1 - p.luff) + flutter;
    const reef = 0.06 + 0.94 * p.sail;
    this.main.scale.set(fill, reef, 1);
    this.main.visible = p.sail > 0.02;
    this.jib.rotation.y = p.boomAngle * 0.6;
    this.jib.scale.set(fill, Math.max(0.05, p.sail), Math.max(0.3, p.sail));
    this.jib.visible = p.sail > 0.05;
    this.pennant.rotation.y = Math.PI - p.windRelative + Math.sin(p.time * 9) * 0.12;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

export const createPlaceholderBoat: BoatModelFactory = () => new PlaceholderSloop();
