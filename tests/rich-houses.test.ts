import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { PROP_GROUPS, PROP_RECIPES } from '../src/data/props';
import { TUNING } from '../src/data/tuning';
import { HighlandIslands } from '../src/render/models/highlandIslands';
import { buildProp, partsTriangles } from '../src/render/models/propRecipe';
import { QUALITY } from '../src/render/quality';

const homes = Object.values(PROP_RECIPES).filter((r) => r.home && !r.internal);
const args = (id: string, variant: number) => ({
  R: 1,
  style: PROP_RECIPES[id]!.style ?? 'fish',
  variant,
  shape: 0.9,
  size: 1,
});
const box = (parts: THREE.BufferGeometry[]) => {
  const b = new THREE.Box3();
  for (const g of parts)
    b.union(
      new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute),
    );
  return b;
};

describe('rich town houses (issue #500)', () => {
  it('gives every home style a rich recipe', () => {
    for (const home of homes) {
      expect(home.rich, home.id).toBeTruthy();
      expect(PROP_RECIPES[home.rich!]!.internal, home.rich).toBe(true);
    }
  });

  it('draws rich parts and the plain windows within the homes budget', () => {
    for (const home of homes)
      for (let variant = 0; variant < 6; variant++) {
        const windows = buildProp(home.id, args(home.id, variant)).filter((g) => g.userData.window);
        const rich = buildProp(home.rich!, args(home.id, variant));
        expect(
          rich.some((g) => g.userData.window),
          `${home.id} windows`,
        ).toBe(false);
        expect(
          partsTriangles(rich) + partsTriangles(windows),
          `${home.id} ${variant}`,
        ).toBeLessThanOrEqual(PROP_GROUPS.homes.budget);
      }
  });

  it('keeps the plain walls inside the rich house, so the swap changes details only', () => {
    for (const home of homes)
      for (let variant = 0; variant < 3; variant++) {
        const plain = box(buildProp(home.id, args(home.id, variant)));
        const rich = box(buildProp(home.rich!, args(home.id, variant)));
        // The plain house is as tall as its roof; the rich roof and footing add a little.
        expect(rich.min.y, home.id).toBeGreaterThanOrEqual(-0.001);
        expect(Math.abs(rich.max.x - plain.max.x), home.id).toBeLessThan(0.9);
        expect(rich.max.y - plain.max.y, home.id).toBeLessThan(0.75);
        expect(rich.max.y, home.id).toBeGreaterThan(plain.max.y * 0.8);
      }
  });

  it('swaps the towns’ homes by distance, on High and Ultra only', () => {
    const map = { ...PHASE1_MAP, terrain: [] };
    for (const level of ['low', 'high'] as const) {
      const model = new HighlandIslands(map, false, undefined, 'v1', level);
      const lods: THREE.LOD[] = [];
      model.traverse((o) => o instanceof THREE.LOD && lods.push(o));
      expect(lods.length).toBeGreaterThan(0);
      model.updateMatrixWorld(true);
      for (const lod of lods) {
        const [rich, plain] = lod.levels.map((l) => l.object);
        const camera = new THREE.PerspectiveCamera();
        camera.position.copy(lod.position);
        camera.updateMatrixWorld();
        if (lod.autoUpdate) lod.update(camera); // as the renderer does
        expect(rich!.visible, `${level} near`).toBe(QUALITY[level].richHouses);
        camera.position.x += TUNING.graphics.houses.richWithin * 3 + 200;
        camera.updateMatrixWorld();
        if (lod.autoUpdate) lod.update(camera); // as the renderer does
        expect(plain!.visible, `${level} far`).toBe(true);
        expect(rich!.visible, `${level} far`).toBe(false);
      }
      model.dispose();
    }
  });
});
