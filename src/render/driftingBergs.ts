import * as THREE from 'three';
import type { MapDef } from '../sim/map';
import { bergFields, bergsAt, prepareField } from '../sim/bergs';
import { mergeAll, vertexColorMaterial } from './models/geometry';
import { buildProp } from './models/propRecipe';

/** The `iceberg` recipe is about this wide (radius) at size 1. */
const MODEL_RADIUS = 1.6;

/**
 * Drifting icebergs (decision 0170): one mesh per berg, built once from the `iceberg` recipe
 * (flat-topped or pointed) and moved each frame to where the simulation has it, at the world's
 * time, so what she sees is what she hits. Hidden with Settings › Drifting icebergs off.
 */
export class DriftingBergs {
  readonly root = new THREE.Group();
  private readonly material = vertexColorMaterial();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly models = new Map<string, THREE.BufferGeometry>();

  constructor(private readonly map: MapDef) {
    this.root.name = 'drifting-bergs';
    bergFields(map).forEach((def, index) => {
      for (const path of prepareField(def, index).bergs) {
        const variant = path.variant % 2;
        const size = path.r / MODEL_RADIUS;
        const key = `${variant}:${size.toFixed(2)}`;
        let geometry = this.models.get(key);
        if (!geometry) {
          geometry = mergeAll(
            buildProp('iceberg', { R: 1, style: 'ice', variant, shape: 0.5, size }),
          );
          this.models.set(key, geometry);
        }
        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.matrixAutoUpdate = true;
        this.meshes.push(mesh);
        this.root.add(mesh);
      }
    });
  }

  update(time: number, on: boolean, wave: (x: number, z: number) => number) {
    this.root.visible = on && this.meshes.length > 0;
    if (!this.root.visible) return;
    bergsAt(this.map, time).forEach((berg, i) => {
      const mesh = this.meshes[i];
      if (!mesh) return;
      mesh.position.set(berg.x, wave(berg.x, -berg.y) * 0.3 - 0.2, -berg.y);
      mesh.rotation.y = berg.turn;
    });
  }

  dispose() {
    for (const g of this.models.values()) g.dispose();
    this.material.dispose();
  }
}
