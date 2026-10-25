import * as THREE from 'three';
import { mergeAll, paint, place, vertexColorMaterial } from './models/geometry';
import { WINDOWS_AT_NIGHT, WINDOWS_BY_DAY } from './atmosphere';

const NAVY = '#1e3550';
const BRASS = '#e8c46a';
const CREAM = '#f4ede0';
const LAMP = '#ffd98a';
/** Drawn this much larger than its parts' sizes so it reads at the sailing camera's distance. */
const SCALE = 1.8;

/**
 * The spot a course leads to at sea (decision 0212): a small floating spar, about a lobster-pot
 * float on a 2-unit pole, with a pennant in the chart's colours (brass for the quest's place,
 * cream for her own mark) and a lamp on top that lights like the town windows at night.
 */
export class CourseSpar {
  readonly root = new THREE.Group();
  private readonly spar: THREE.Group = new THREE.Group();
  private readonly quest: THREE.Mesh;
  private readonly mark: THREE.Mesh;
  private readonly lampMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor() {
    this.root.name = 'course-spar';
    const body = mergeAll([
      paint(place(new THREE.CylinderGeometry(0.75, 0.95, 0.8, 8), 0, 0.15, 0), NAVY),
      paint(place(new THREE.CylinderGeometry(0.55, 0.75, 0.3, 8), 0, 0.7, 0), CREAM),
      paint(place(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 5), 0, 1.95, 0), NAVY),
    ]);
    const bodyMaterial = vertexColorMaterial();
    const float = new THREE.Mesh(body, bodyMaterial);
    float.castShadow = true;
    // A pennant off the pole's head: two crossed triangles, so it reads from any heading.
    const pennant = new THREE.BufferGeometry().setFromPoints(
      [
        [0, 3.0, 0],
        [0, 1.9, 0],
        [0, 2.45, 1.7],
        [0, 3.0, 0],
        [0, 1.9, 0],
        [1.7, 2.45, 0],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    pennant.computeVertexNormals();
    const questMaterial = new THREE.MeshLambertMaterial({ color: BRASS, side: THREE.DoubleSide });
    const markMaterial = new THREE.MeshLambertMaterial({ color: CREAM, side: THREE.DoubleSide });
    this.quest = new THREE.Mesh(pennant, questMaterial);
    this.mark = new THREE.Mesh(pennant, markMaterial);
    const lampGeometry = paint(new THREE.OctahedronGeometry(0.48, 0).translate(0, 3.4, 0), LAMP);
    const lamp = new THREE.Mesh(lampGeometry, this.lampMaterial);
    this.disposables.push(
      body,
      bodyMaterial,
      pennant,
      questMaterial,
      markMaterial,
      lampGeometry,
      this.lampMaterial,
    );
    this.spar.add(float, this.quest, this.mark, lamp);
    this.spar.scale.setScalar(SCALE);
    this.root.add(this.spar);
    this.root.visible = false;
  }

  /** Show it at `at` for a quest's place or her mark, or hide it (null: no course out at sea). */
  update(
    at: { x: number; y: number; kind: 'quest' | 'mark' } | null,
    time: number,
    waterY: (x: number, z: number) => number,
    glow: number,
  ) {
    this.root.visible = !!at;
    if (!at) return;
    this.root.position.set(at.x, 0, -at.y);
    this.spar.position.y = waterY(at.x, -at.y) - 0.1;
    this.spar.rotation.set(Math.sin(time * 1.3) * 0.08, 0, Math.sin(time * 1.1 + 1) * 0.08);
    this.quest.visible = at.kind === 'quest';
    this.mark.visible = at.kind === 'mark';
    this.lampMaterial.color.copy(WINDOWS_BY_DAY).lerp(WINDOWS_AT_NIGHT, glow);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
