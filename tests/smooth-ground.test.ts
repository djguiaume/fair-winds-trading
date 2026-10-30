import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { ISLAND_DESIGNS, atLevel, designOf } from '../src/data/islands';
import { type Heightfield, heightAt, islandHeightfield } from '../src/sim/heightfield';
import { islandCoasts, islandLayout, islandPoint } from '../src/sim/islandLayout';
import { coastDistance } from '../src/sim/coast';
import { createRng } from '../src/sim/rng';
import { fbm, valueNoise } from '../src/sim/noise';
import { smoothField } from '../src/sim/smoothField';
import {
  designPalette,
  fieldGround,
  fieldGroundTextures,
  groundTexels,
} from '../src/render/models/fieldGround';
import { facetedGround } from '../src/render/models/ground';
import { applySteps } from '../src/editor/island/steps';

const designed = GAME_MAP.islands.filter((i) => designOf(i));

/** The raster as built, smoothing off (the cache keys on the tuning, so it is built afresh). */
function rawField(island: (typeof designed)[number], level = 4) {
  const amount = TUNING.terrain.smooth.amount;
  TUNING.terrain.smooth.amount = 0;
  try {
    return islandHeightfield({ ...island }, level);
  } finally {
    TUNING.terrain.smooth.amount = amount;
  }
}

/** A square plateau `top` high on a 40 × 40 grid of 1-unit cells, land on its inner 30 × 30. */
function plateau(top: number, faceted?: (i: number, j: number) => boolean): Heightfield {
  const w = 40,
    h = 40;
  const f: Heightfield = {
    x0: 0,
    y0: 0,
    cell: 1,
    w,
    h,
    heights: new Float32Array(w * h).fill(-3.5),
    terrace: new Uint8Array(w * h),
    ground: new Uint8Array(w * h),
    grounds: ['', 'grass'],
    smooth: new Float32Array(w * h).fill(1),
    seabed: -3.5,
    seed: 3,
  };
  for (let j = 5; j < 35; j++)
    for (let i = 5; i < 35; i++) {
      const k = j * w + i;
      f.ground[k] = 1;
      f.heights[k] = i > 15 && i < 25 && j > 15 && j < 25 ? top : 2;
      if (faceted?.(i, j)) f.smooth[k] = 0;
    }
  return f;
}

describe('noise', () => {
  it('is seeded, smooth and within ±1', () => {
    expect(valueNoise(3.3, 7.1, 5)).toBe(valueNoise(3.3, 7.1, 5));
    expect(valueNoise(3.3, 7.1, 5)).not.toBe(valueNoise(3.3, 7.1, 6));
    let low = 0,
      high = 0;
    for (let i = 0; i < 2000; i++) {
      const v = fbm(i * 0.37, i * 0.11, 9);
      low = Math.min(low, v);
      high = Math.max(high, v);
      expect(Math.abs(valueNoise(i * 0.1, 0, 2) - valueNoise(i * 0.1 + 0.01, 0, 2))).toBeLessThan(
        0.1,
      );
    }
    expect(low).toBeGreaterThanOrEqual(-1);
    expect(high).toBeLessThanOrEqual(1);
    expect(high - low).toBeGreaterThan(0.8);
  });
});

describe('the smoothed ground (issue #269)', () => {
  it('rounds the tiers into slopes', () => {
    const f = smoothField(plateau(10));
    // Across the plateau's edge (x 15 to 16) the step of 8 is spread over several cells.
    const row = 20 * 40;
    expect(f.heights[row + 16]! - f.heights[row + 15]!).toBeLessThan(4);
    expect(f.heights[row + 12]!).toBeGreaterThan(2);
  });

  it('keeps a faceted shape exactly as built, with no skirt round it', () => {
    const inside = (i: number, j: number) => i > 15 && i < 25 && j > 15 && j < 25;
    const faceted = smoothField(plateau(10, inside));
    const flat = smoothField(plateau(2));
    const row = 20 * 40;
    expect(faceted.heights[row + 20]).toBe(10);
    expect(faceted.heights[row + 16]).toBe(10);
    // The ground next to it is the ground the plateau stands on, not raised by it.
    expect(faceted.heights[row + 14]!).toBeCloseTo(flat.heights[row + 14]!, 1);
  });

  it('keeps the waterline on the sim coast', () => {
    const rng = createRng(4);
    let checked = 0,
      wrong = 0;
    for (const island of designed) {
      const f = islandHeightfield(island, 4);
      const coasts = islandCoasts(island)!;
      for (let n = 0; n < 300; n++) {
        const x = f.x0 + rng() * (f.w - 1) * f.cell,
          y = f.y0 + rng() * (f.h - 1) * f.cell;
        let inland = -Infinity;
        for (const c of coasts) inland = Math.max(inland, -coastDistance(x, y, c).distance);
        // Past half a unit either side of the coast, land is above the sea and sea below.
        if (Math.abs(inland) < 0.5 || Math.abs(inland) > 4) continue;
        checked++;
        if (heightAt(f, x, y) > 0 !== inland > 0) wrong++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(wrong / checked).toBeLessThan(0.002);
  }, 60_000);

  it('keeps the town on its terraces', () => {
    let sum = 0,
      count = 0;
    for (const island of designed.slice(0, 12)) {
      const raw = rawField(island);
      const f = islandHeightfield(island, 4);
      for (const p of designOf(island)!.props.filter((p) => atLevel(p, 4))) {
        const q = islandPoint(island, p.x, p.z);
        const before = heightAt(raw, q.x, q.y);
        if (before < 0) continue;
        const moved = Math.abs(heightAt(f, q.x, q.y) - before);
        expect(moved, `${island.id} ${p.type}`).toBeLessThan(1.5);
        sum += moved;
        count++;
      }
    }
    expect(sum / count).toBeLessThan(0.15);
  }, 60_000);

  it('leaves landmarks with smooth 0 at their height: the Giant stays a stack', () => {
    const giant = designed.find((i) => i.look?.design === 'the-giant')!;
    const f = islandHeightfield(giant, 4);
    const top = designOf(giant)!.ground[1]!;
    expect(top.smooth).toBe(0);
    expect(heightAt(f, giant.x, giant.y)).toBeCloseTo(top.height * giant.radius, 3);
  });

  it('draws faceted shapes as their classic pieces and nothing else', () => {
    const giant = ISLAND_DESIGNS['the-giant']!;
    expect(facetedGround(islandLayout(giant, 4), giant.style, 3)).toHaveLength(1);
    const saltmere = ISLAND_DESIGNS.saltmere!;
    expect(saltmere.ground.some((g) => g.smooth === 0)).toBe(false);
    expect(facetedGround(islandLayout(saltmere, 4), saltmere.style, 3)).toHaveLength(0);
  });
});

describe('the new look ground mesh', () => {
  it('is one indexed, smooth-shaded grid on a colour texture of the full field', () => {
    const f = smoothField(plateau(10));
    const g = fieldGround(f);
    expect(g.index).not.toBeNull();
    const normals = g.attributes.normal!;
    for (let k = 0; k < normals.count; k += 37)
      expect(Math.hypot(normals.getX(k), normals.getY(k), normals.getZ(k))).toBeCloseTo(1, 4);
    // Wholly deep cells are left out: far fewer triangles than cells.
    expect(g.index!.count / 6).toBeLessThan(39 * 39);
    // A coarser mesh reads the same texture: its corners on the same texels.
    const coarse = fieldGround(f, 3);
    expect(coarse.attributes.position!.count).toBeLessThan(g.attributes.position!.count / 4);
    expect(coarse.attributes.uv!.getX(1)).toBeCloseTo(g.attributes.uv!.getX(3), 6);
  });

  it('colours by zone: green flat tops, warm sandstone bands, slope in alpha (issue #373)', () => {
    const f = smoothField(plateau(10));
    const { colour, sides } = fieldGroundTextures(f, designPalette('fish'));
    const texels = colour.image.data as Uint8Array;
    // The field's sample (i, j), on a small island's finer texture (issue #277).
    const t = groundTexels(f);
    const at = (i: number, j: number) => {
      const k = j * t * colour.image.width + i * t;
      return Array.from(texels.slice(k * 4, k * 4 + 4));
    };
    const [r, gr, b, level] = at(20, 20);
    expect(gr).toBeGreaterThan(r!);
    expect(gr).toBeGreaterThan(b!);
    expect(level).toBeGreaterThan(250);
    // The plateau's edge is steep: the shader turns it to the cliff bands.
    expect(at(16, 20)[3]).toBeLessThan(255 * (1 - TUNING.terrain.draw.slope[1]!));
    // The grass row's bands (row 1) are warm sandstone.
    const band = Array.from(
      (sides.image.data as Uint8Array).slice(sides.image.width * 4, sides.image.width * 4 + 3),
    );
    expect(band[0]).toBeGreaterThan(band[2]! + 20);
    expect(band[0]).toBeGreaterThan(band[1]! * 0.95);
  });

  it('marks each texel with its ground and height, sea and land kept apart', () => {
    const f = smoothField(plateau(10));
    const { colour, shape, heights } = fieldGroundTextures(f, designPalette('fish'));
    expect(shape.image.width).toBe(colour.image.width);
    const data = shape.image.data as Uint8Array;
    const texel = (k: number) => data.slice(k * 4, k * 4 + 4);
    const n = colour.image.width * colour.image.height;
    expect(new Set(Array.from({ length: n }, (_, k) => texel(k)[0]))).toEqual(new Set([0, 1]));
    const t = groundTexels(f);
    const at = (i: number, j: number) => texel(j * t * shape.image.width + i * t);
    const height = (v: Uint8Array) => heights[0] + ((v[1]! * 256 + v[2]!) / 65535) * heights[1];
    expect(at(20, 20)[0]).toBe(1);
    // The bands' height: the field's, smoothed a little (draw.bandSmooth), so higher on the top.
    expect(Math.abs(height(at(20, 20)) - heightAt(f, 20, 20))).toBeLessThan(1);
    expect(height(at(20, 20))).toBeGreaterThan(height(at(10, 10)) + 4);
    expect(texel(0)[0]).toBe(0);
  });

  it('marks rock grounds sharp in the shape texture’s alpha', () => {
    const f = { ...smoothField(plateau(10)), grounds: ['', 'basalt'] };
    const { shape } = fieldGroundTextures(f, designPalette('fog'));
    const t = groundTexels(f);
    const data = shape.image.data as Uint8Array;
    expect(data[(20 * t * shape.image.width + 20 * t) * 4 + 3]).toBe(255);
    const soft = fieldGroundTextures(smoothField(plateau(10)), designPalette('fish')).shape;
    expect((soft.image.data as Uint8Array)[(20 * t * soft.image.width + 20 * t) * 4 + 3]).toBe(0);
  });

  it('repeats each ground’s bands to a width every row shares', () => {
    const f = { ...smoothField(plateau(10)), grounds: ['', 'grass', 'rock'] };
    const palette = {
      look: (g: string) => ({
        top: ['#808080'],
        side: {
          sand: ['#010101'],
          grass: ['#020202', '#030303'],
          rock: ['#040404', '#050505', '#060606'],
        }[g]!,
      }),
      wet: '#000000',
    };
    const { sides } = fieldGroundTextures(f, palette);
    expect(sides.image.width).toBe(6);
    const red = (g: number, b: number) => (sides.image.data as Uint8Array)[(g * 6 + b) * 4];
    expect([0, 1, 2, 3, 4, 5].map((b) => red(1, b))).toEqual([2, 3, 2, 3, 2, 3]);
    expect([0, 1, 2, 3, 4, 5].map((b) => red(2, b))).toEqual([4, 5, 6, 4, 5, 6]);
  });

  it('gives a small island a finer texture, its mesh on the same texels (issue #277)', () => {
    const f = smoothField(plateau(10));
    const t = groundTexels(f);
    expect(t).toBeGreaterThan(1);
    const { colour, texel } = fieldGroundTextures(f, designPalette('fish'));
    expect(colour.image.width).toBe((f.w - 1) * t + 1);
    expect(texel).toBeCloseTo(f.cell / t, 6);
    const g = fieldGround(f, 1);
    expect(g.attributes.uv!.getX(1)).toBeCloseTo((t + 0.5) / colour.image.width, 6);
  });
});

describe('editing smooth', () => {
  it('sets, clamps and clears a shape’s smooth from steps (the builder and npm run island)', () => {
    const design = structuredClone(ISLAND_DESIGNS.calda!);
    applySteps(design, [{ do: 'ground', index: 2, smooth: 0 }]);
    expect(design.ground[2]!.smooth).toBe(0);
    applySteps(design, [{ do: 'ground', index: 2, smooth: -1 }]);
    expect(design.ground[2]!.smooth).toBe(0);
    applySteps(design, [{ do: 'ground', index: 2, smooth: 0.456 }]);
    expect(design.ground[2]!.smooth).toBe(0.46);
    applySteps(design, [{ do: 'ground', index: 2, smooth: 1 }]);
    expect('smooth' in design.ground[2]!).toBe(false);
    applySteps(design, [{ do: 'mountain', at: [0.2, -0.2], size: [0.2, 0.2], smooth: 0 }]);
    expect(design.ground[design.ground.length - 1]!.smooth).toBe(0);
  });
});
