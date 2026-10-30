import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TUNING } from '../src/data/tuning';
import palette from '../src/data/palette.json';
import grown from '../src/data/seas/grown.json';
import { GAME_MAP } from '../src/data/maps';
import type { Heightfield } from '../src/sim/heightfield';
import type { TerrainDef } from '../src/sim/map';
import { type SeabedDepth, bakeSeabedDepth } from '../src/render/seabedDepth';
import { SeabedTextureCache, drawnFields } from '../src/render/seabedTexture';
import { SEA_RAMPS, liftToFloor, newRamp, seaRampAt } from '../src/render/seaWater';
import { Ocean } from '../src/render/ocean';
import { QUALITY } from '../src/render/quality';

const SEABED = TUNING.terrain.seabed;

/** A square island of land (height 1) of half-width `half`, in a field with `margin` of seabed. */
function square(half: number, margin: number, cell = 1): Heightfield {
  const n = Math.round((2 * (half + margin)) / cell) + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -half - margin + i * cell,
        y = -half - margin + j * cell;
      heights[j * n + i] = Math.abs(x) <= half && Math.abs(y) <= half ? 1 : SEABED;
    }
  return {
    x0: -half - margin,
    y0: -half - margin,
    cell,
    w: n,
    h: n,
    heights,
    terrace: new Uint8Array(n * n),
    ground: new Uint8Array(n * n),
    smooth: new Float32Array(n * n).fill(1),
    grounds: [''],
    seabed: SEABED,
    seed: 1,
  };
}

/** The baked depth (0..255) at a map point. */
function depthAt(bake: SeabedDepth, x: number, y: number): number {
  const i = Math.floor((x - bake.x0) / bake.cell),
    j = Math.floor((-y - bake.z0) / bake.cell);
  return bake.depth[j * bake.w + i]!;
}

describe('seabed depth bake', () => {
  it('is shallow at the coast and deepens steadily out to the open sea', () => {
    const bake = bakeSeabedDepth([square(20, 6)], []);
    const out = [0, 10, 20, 30, 40, 50, 85].map((x) => depthAt(bake, x, 0));
    expect(out[0]).toBe(0);
    for (let k = 1; k < out.length; k++) expect(out[k]).toBeGreaterThanOrEqual(out[k - 1]!);
    expect(out[5]!).toBeGreaterThan(out[2]!);
    expect(out.at(-1)).toBe(255);
  });

  it("follows the coast, not the field's rectangle of open seabed", () => {
    const tight = bakeSeabedDepth([square(20, 2)], []);
    const roomy = bakeSeabedDepth([square(20, 30)], []);
    for (const [x, y] of [
      [28, 28],
      [35, 0],
      [0, -45],
    ] as const)
      expect(depthAt(roomy, x, y)).toBe(depthAt(tight, x, y));
  });

  it('shows reefs and shallows as shallow water, and nothing for drifting bergs', () => {
    const outline: [number, number][] = [
      [-15, -15],
      [15, -15],
      [15, 15],
      [-15, 15],
    ];
    const shape = (kind: TerrainDef['kind']): TerrainDef => ({ id: kind, kind, outline });
    const reef = bakeSeabedDepth([square(5, 2)], [shape('reef')]);
    expect(depthAt(reef, 12, 0)).toBeLessThan(255 / 2);
    const bergs = bakeSeabedDepth([square(5, 2)], [shape('bergs')]);
    expect(depthAt(bergs, 40, 0)).toBe(255);
    expect(depthAt(bergs, 12, 0)).toBeGreaterThan(depthAt(reef, 12, 0));
  });

  it('keeps within the texel cap by coarsening the cells on a big map', () => {
    const tune = { ...TUNING.graphics.water.depth, maxTexels: 256 };
    const far = { ...square(5, 2), x0: 3000, y0: 3000 };
    const bake = bakeSeabedDepth([square(5, 2), far], [], tune);
    expect(Math.max(bake.w, bake.h)).toBeLessThanOrEqual(256);
    expect(bake.cell).toBeGreaterThan(tune.cell);
  });

  it('bakes the whole game sea in under a megabyte', () => {
    const fields = drawnFields(GAME_MAP, GAME_MAP.islands, {});
    const bake = bakeSeabedDepth(fields, GAME_MAP.terrain ?? []);
    expect(bake.depth.byteLength).toBeLessThan(1024 * 1024);
    expect(bake.cell).toBe(TUNING.graphics.water.depth.cell);
  });
});

describe('seabed bake cache', () => {
  it('bakes again only for a new field, terrain shape or depth number, freeing the old bake', () => {
    const cache = new SeabedTextureCache();
    const field = square(10, 2);
    const first = cache.get([field]);
    expect(cache.get([field])).toBe(first);
    const disposed = vi.spyOn(first.texture, 'dispose');
    // An edit (a builder stroke) gives the island a new field object.
    const fields = [square(10, 2)];
    const edited = cache.get(fields);
    expect(edited).not.toBe(first);
    expect(disposed).toHaveBeenCalledTimes(1);
    const reef: TerrainDef = {
      id: 'r',
      kind: 'reef',
      outline: [
        [0, 0],
        [5, 0],
        [5, 5],
      ],
    };
    const withReef = cache.get(fields, [reef]);
    expect(withReef).not.toBe(edited);
    const depth = TUNING.graphics.water.depth;
    const before = depth.fullDepth;
    depth.fullDepth = before + 1;
    try {
      expect(cache.get(fields, [reef])).not.toBe(withReef);
    } finally {
      depth.fullDepth = before;
    }
    cache.dispose();
  });
});

describe('sea colours by place', () => {
  const ramp = newRamp();
  const near = (a: { r: number; g: number; b: number }, b: typeof a) =>
    Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-6;

  it("takes each sea's own colours inside it", () => {
    expect(near(seaRampAt(0, 0, ramp).deep, SEA_RAMPS.ring!.deep)).toBe(true);
    expect(near(seaRampAt(0, -800, ramp).deep, SEA_RAMPS.south!.deep)).toBe(true);
    expect(near(seaRampAt(800, 0, ramp).mid, SEA_RAMPS.east!.mid)).toBe(true);
  });

  it('lifts night colours toward the floor but leaves every day colour as it is', () => {
    for (const sea of Object.values(SEA_RAMPS))
      for (const day of [sea.shallow, sea.mid, sea.deep])
        expect(near(liftToFloor(day.clone(), sea.night), day)).toBe(true);
    const floor = SEA_RAMPS.east!.night;
    expect(near(liftToFloor(new THREE.Color(0, 0, 0), floor), floor)).toBe(true);
  });

  it('blends half and half on a border between seas', () => {
    const r = 800 / Math.SQRT2;
    const mixed = seaRampAt(r, -r, ramp).deep;
    const halfway = SEA_RAMPS.east!.deep.clone().lerp(SEA_RAMPS.south!.deep, 0.5);
    expect(near(mixed, halfway)).toBe(true);
  });
});

describe('depth-coloured ocean', () => {
  it('draws depth and the shore per pixel on every level (#277), and takes a new bake on any level', () => {
    const cache = new SeabedTextureCache();
    const seabed = cache.get([square(10, 2)]);
    for (const profile of Object.values(QUALITY)) {
      const look = { fancy: profile.fancyWater, reflect: profile.waterReflection, seabed };
      const ocean = new Ocean([], profile.oceanSegments, look, 480);
      const defines = ocean.mesh.material.defines;
      expect('DEPTH' in defines).toBe(true);
      expect('VERTEX_SHORES' in defines).toBe(false);
      const next = cache.get([square(12, 2)]);
      ocean.setSeabed(next);
      expect(ocean.mesh.material.uniforms.uDepthMap!.value).toBe(next.texture);
      ocean.dispose();
    }
    cache.dispose();
  });

  it('keeps the classic water without a bake, its Low shore per vertex', () => {
    const ocean = new Ocean([], 8, { fancy: true });
    expect('DEPTH' in ocean.mesh.material.defines).toBe(false);
    ocean.dispose();
    const low = new Ocean([], 8, { fancy: false });
    expect('VERTEX_SHORES' in low.mesh.material.defines).toBe(true);
    low.dispose();
  });
});

describe('water colours as data', () => {
  it('has shallow, mid and deep colours for the ring and every sea (palette.json › water)', () => {
    for (const id of ['ring', ...grown.seas]) {
      const colors = (palette.water as Record<string, Record<string, string>>)[id];
      expect(colors, id).toBeDefined();
      for (const key of ['shallow', 'mid', 'deep', 'night'])
        expect(colors![key], `${id} ${key}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
