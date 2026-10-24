import * as THREE from 'three';
import type { MapDef, SeaMarkDef } from '../sim/map';
import { questShown } from '../data/islands';
import { mergeAll, paint, place, vertexColorMaterial } from './models/geometry';
import { fishingBoat } from './models/props';
import { buildProp } from './models/propRecipe';
import { ISLAND_SCALE } from './models/highlandIslands';

/** Island props stand at this scale; Saltmere's moored boats are drawn 1.55 times a 2-unit hull. */
const BOAT_SCALE = 1.55 * ISLAND_SCALE;

/** A channel buoy (decision 0130): a can with a white band and a top mark, red or green. */
function buoy(color: string): THREE.BufferGeometry {
  return mergeAll([
    paint(place(new THREE.CylinderGeometry(0.8, 0.95, 1.0, 8), 0, 0.25, 0), color),
    paint(place(new THREE.CylinderGeometry(0.82, 0.82, 0.3, 8), 0, 0.9, 0), '#f6f1e4'),
    paint(place(new THREE.CylinderGeometry(0.6, 0.8, 0.8, 8), 0, 1.45, 0), color),
    paint(place(new THREE.ConeGeometry(0.4, 0.7, 6), 0, 2.2, 0), color),
  ]);
}

function model(type: SeaMarkDef['type']): THREE.BufferGeometry | null {
  if (type === 'buoy-red') return buoy('#d93a2b');
  if (type === 'buoy-green') return buoy('#2f9a55');
  // Cardinal danger marks (decision 0152): one recipe each in src/data/props/mark-cardinal-*.json,
  // whose `scale` stands them taller than channel buoys so their top marks read from the camera.
  if (type.startsWith('cardinal-'))
    return mergeAll(
      buildProp(`mark-${type}`, { R: 1, style: 'fish', variant: 0, shape: 0.5, size: 1 }),
    );
  if (type === 'fishing-boat')
    return mergeAll(fishingBoat()).scale(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE);
  // A harbour pilot's boat (decision 0131): the same small hull, painted black like a pilot cutter.
  if (type === 'pilot-cutter') {
    const parts = fishingBoat();
    parts[0] = paint(parts[0]!, '#26282c');
    return mergeAll(parts).scale(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE);
  }
  // A `light` is a mark on the chart only.
  return null;
}

/**
 * Buoys and boats at sea from the map's `marks` (decision 0130), bobbing on the waves. A mark
 * tagged `after:` or `before:` a quest shows or hides when the quests done change. A few dozen at
 * most, so each is its own small mesh.
 */
export class SeaMarks {
  readonly root = new THREE.Group();
  private readonly material = vertexColorMaterial();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly marks: { def: SeaMarkDef; mesh: THREE.Mesh; phase: number }[] = [];

  constructor(map: MapDef) {
    this.root.name = 'sea-marks';
    (map.marks ?? []).forEach((def, i) => {
      if (!this.geometries.has(def.type)) {
        const geometry = model(def.type);
        if (!geometry) return;
        this.geometries.set(def.type, geometry);
      }
      const mesh = new THREE.Mesh(this.geometries.get(def.type)!, this.material);
      mesh.position.set(def.x, 0, -def.y);
      // Turn: degrees clockwise from north; the models' bows face -z, which is north in the scene.
      mesh.rotation.y = -((def.turn ?? 0) * Math.PI) / 180;
      this.root.add(mesh);
      this.marks.push({ def, mesh, phase: i * 1.7 });
    });
    this.setQuestsDone(new Set());
  }

  setQuestsDone(done: ReadonlySet<string>) {
    for (const { def, mesh } of this.marks) mesh.visible = questShown(def, done);
  }

  update(time: number, waterY: (x: number, z: number) => number) {
    for (const { mesh, phase } of this.marks) {
      if (!mesh.visible) continue;
      mesh.position.y = waterY(mesh.position.x, mesh.position.z);
      mesh.rotation.x = Math.sin(time * 1.3 + phase) * 0.06;
      mesh.rotation.z = Math.cos(time * 1.1 + phase) * 0.06;
    }
  }

  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.material.dispose();
  }
}
