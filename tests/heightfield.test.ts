import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GAME_MAP, PHASE0_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { designOf } from '../src/data/islands';
import {
  type Heightfield,
  fieldLod,
  heightAt,
  islandHeightfield,
  sampleIndex,
  terrainHeightfield,
} from '../src/sim/heightfield';
import { islandCoasts, islandLayout, islandPoint } from '../src/sim/islandLayout';
import { BEACH_TOP, ISLAND_SCALE } from '../src/sim/islandUnits';
import { coastDistance } from '../src/sim/coast';
import { HighlandIslands } from '../src/render/models/highlandIslands';
import { standHeight } from '../src/render/models/townProps';

/** A 3 × 2 field by hand: heights 0 1 2 on the first row, 3 4 5 on the second. */
function tiny(): Heightfield {
  return {
    x0: 10,
    y0: 20,
    cell: 2,
    w: 3,
    h: 2,
    heights: Float32Array.from([0, 1, 2, 3, 4, 5]),
    terrace: new Uint8Array(6),
    ground: new Uint8Array(6),
    grounds: [''],
    smooth: new Float32Array(6).fill(1),
    seabed: -3.5,
    seed: 1,
  };
}

const designed = GAME_MAP.islands.filter((i) => designOf(i));

describe('the shared height field', () => {
  // The raster as built, before the new look's smoothing (tests/smooth-ground.test.ts).
  const amount = TUNING.terrain.smooth.amount;
  beforeAll(() => (TUNING.terrain.smooth.amount = 0));
  afterAll(() => (TUNING.terrain.smooth.amount = amount));

  it('reads heights between samples linearly and the seabed off the grid', () => {
    const f = tiny();
    expect(heightAt(f, 10, 20)).toBe(0);
    expect(heightAt(f, 14, 22)).toBe(5);
    expect(heightAt(f, 11, 20)).toBeCloseTo(0.5);
    expect(heightAt(f, 12, 21)).toBeCloseTo(2.5);
    expect(heightAt(f, 9.9, 20)).toBe(-3.5);
    expect(heightAt(f, 14.1, 22)).toBe(-3.5);
    expect(heightAt(f, Number.NaN, 20)).toBe(-3.5);
    expect(sampleIndex(f, 13.2, 21.2)).toBe(5);
    expect(sampleIndex(f, 20, 20)).toBe(-1);
  });

  it('is the same, sample for sample, each time an island is built', () => {
    for (const island of designed.slice(0, 6)) {
      const a = islandHeightfield(island, 2);
      // A copy of the island is a new cache entry: built again from scratch.
      const b = islandHeightfield({ ...island }, 2);
      expect(b).not.toBe(a);
      expect(Array.from(b.heights)).toEqual(Array.from(a.heights));
      expect(Array.from(b.terrace)).toEqual(Array.from(a.terrace));
      expect(b.seed).toBe(designOf(island)!.seed);
    }
  });

  it('sits on the world grid at the canonical spacing, with open seabed round the coast', () => {
    const { cell, margin, seabed } = TUNING.terrain;
    for (const island of designed) {
      const f = islandHeightfield(island);
      expect(f.cell).toBe(cell);
      expect(Math.abs(f.x0 / cell - Math.round(f.x0 / cell))).toBeLessThan(1e-9);
      const coast = islandCoasts(island)!.flat();
      expect(f.x0).toBeLessThanOrEqual(Math.min(...coast.map((p) => p[0])) - margin);
      expect(f.y0).toBeLessThanOrEqual(Math.min(...coast.map((p) => p[1])) - margin);
      expect(f.x0 + (f.w - 1) * cell).toBeGreaterThanOrEqual(
        Math.max(...coast.map((p) => p[0])) + margin,
      );
      // The grid's border is all open sea.
      for (let i = 0; i < f.w; i++) {
        expect(f.heights[i]).toBe(seabed);
        expect(f.heights[(f.h - 1) * f.w + i]).toBe(seabed);
      }
    }
  });

  it('has the terraces at the heights props stand on in the classic look', () => {
    for (const island of designed) {
      const design = designOf(island)!;
      const layout = islandLayout(design, 4);
      const R = island.radius / ISLAND_SCALE;
      const f = islandHeightfield(island, 4);
      // Walk the field's terrace samples back into the island's frame.
      const a = Math.PI - (island.look?.harbourBearing ?? 0);
      // A mountain's cone stands on an ellipse in its outline; its plateau there is the classic
      // height test's, not ground anyone stands on.
      const peaks = layout.surfaces.filter((s) => s.shape === 'peak');
      let checked = 0;
      for (let k = 0; k < f.heights.length; k += 7) {
        if (!f.terrace[k]) continue;
        const dx = (f.x0 + (k % f.w) * f.cell - island.x) / island.radius,
          dy = (f.y0 + Math.floor(k / f.w) * f.cell - island.y) / island.radius;
        const x = Math.cos(a) * dx + Math.sin(a) * dy,
          z = Math.sin(a) * dx - Math.cos(a) * dy;
        if (peaks.some((s) => coastDistance(x, z, s.outline).distance < 0)) continue;
        // A sample right on an outline is inside to the field, outside to the classic test.
        const outlines = [
          ...layout.coasts,
          ...layout.surfaces.flatMap((s) => [s.outline, ...(s.holes ?? [])]),
        ];
        if (outlines.some((o) => Math.abs(coastDistance(x, z, o).distance) < 1e-9)) continue;
        const p = islandPoint(island, x, z);
        expect(p.x).toBeCloseTo(f.x0 + (k % f.w) * f.cell, 6);
        // Ground lower than the sand (a low lawn) lies under the beach: the field has the sand.
        const classic = Math.max(BEACH_TOP, standHeight(layout, x, z, R));
        expect(f.heights[k]).toBeCloseTo(classic * ISLAND_SCALE, 4);
        checked++;
      }
      expect(checked, island.id).toBeGreaterThan(0);
    }
  });

  it('keeps an island without a file to its collision circle, at beach height', () => {
    const island = PHASE0_MAP.islands[0]!;
    const f = islandHeightfield(island);
    expect(heightAt(f, island.x, island.y)).toBeCloseTo(0.3 * ISLAND_SCALE);
    expect(heightAt(f, island.x + island.radius + 2, island.y)).toBe(f.seabed);
  });

  it('gives barrier islands their tiers and sandbanks their top; reefs have no ground', () => {
    const ridge = GAME_MAP.terrain!.find((t) => t.kind === 'island')!;
    const f = terrainHeightfield(ridge, 1)!;
    const tops = TUNING.terrain.ridge.tops;
    expect(Math.max(...f.heights)).toBe(tops[tops.length - 1]);
    expect(f.terrace.some((t) => t)).toBe(true);
    const bank = GAME_MAP.terrain!.find((t) => t.kind === 'sandbank')!;
    expect(Math.max(...terrainHeightfield(bank, 1)!.heights)).toBeCloseTo(
      TUNING.terrain.sandbankTop,
    );
    expect(
      terrainHeightfield(
        GAME_MAP.terrain!.find((t) => t.kind === 'reef')!,
        1,
      ),
    ).toBeNull();
  });

  it('draws coarser copies from the field itself', () => {
    const f = islandHeightfield(designed[0]!);
    expect(fieldLod(f, 1)).toBe(f);
    const lod = fieldLod(f, 3);
    expect(lod.cell).toBe(f.cell * 3);
    for (let k = 0; k < lod.heights.length; k += 11) {
      const x = lod.x0 + (k % lod.w) * lod.cell,
        y = lod.y0 + Math.floor(k / lod.w) * lod.cell;
      expect(lod.heights[k]).toBeCloseTo(heightAt(f, x, y), 5);
    }
  });
});

describe('the new look (the default) against ?look=v1', () => {
  const ground = (islands: HighlandIslands, id: string) =>
    islands.getObjectByName(`island:${id}`)!.getObjectByName('ground') as THREE.Mesh;

  it('draws each island file from its field, harbours where the classic look has them', () => {
    const map = GAME_MAP;
    const classic = new HighlandIslands(map, false, {}, 'v1');
    const v2 = new HighlandIslands(map, false, {}, 'v2', 'high');
    expect(v2.userData.harbours).toEqual(classic.userData.harbours);
    for (const island of designed) expect(ground(v2, island.id), island.id).toBeDefined();
    expect(ground(classic, designed[0]!.id)).toBeUndefined();
    classic.dispose();
    v2.dispose();
  }, 30_000);

  it('changes only the ground mesh with the quality level, never the field', () => {
    const v2 = new HighlandIslands(GAME_MAP, false, {}, 'v2', 'high');
    const id = designed[0]!.id;
    const field = islandHeightfield(designed[0]!);
    const before = ground(v2, id).geometry.attributes.position!.count;
    v2.setQuality('low');
    expect(ground(v2, id).geometry.attributes.position!.count).toBeLessThan(before / 4);
    expect(islandHeightfield(designed[0]!)).toBe(field);
    v2.setQuality('high');
    expect(ground(v2, id).geometry.attributes.position!.count).toBe(before);
    v2.dispose();
  }, 30_000);
});
