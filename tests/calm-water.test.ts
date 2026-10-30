import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { CalmWater } from '../src/render/calmWater';
import { waveHeight } from '../src/render/ocean';
import { waveSag } from '../src/render/oceanWaves';
import { shoreTexture } from '../src/render/shoreTexture';
import type { WindZoneDef } from '../src/sim/map';

const oval = (id: string, kind: string, tune?: WindZoneDef['tune']): WindZoneDef => ({
  id,
  kind,
  tune,
  outline: Array.from({ length: 12 }, (_, i): [number, number] => {
    const a = (i / 12) * Math.PI * 2;
    return [262 + Math.cos(a) * 62, -12 + Math.sin(a) * 44];
  }),
});

describe('calm water in wind zones (decision 0144)', () => {
  const shore = shoreTexture(PHASE1_MAP.islands, PHASE1_MAP.terrain ?? []);

  it('draws glassy water only for zones whose kind has `glassy`', () => {
    const calm = new CalmWater(
      [
        oval('d', 'doldrums'),
        oval('l', 'sheltered'),
        oval('t', 'trade-belt'),
        oval('g', 'cold-gale'),
      ],
      shore,
    );
    expect(calm.root.children.map((m) => m.name)).toEqual(['calm:d', 'calm:l']);
    calm.dispose();
  });

  it('a zone can turn its glassy water off or on with `tune`', () => {
    const calm = new CalmWater(
      [oval('d', 'doldrums', { glassy: 0 }), oval('t', 'trade-belt', { glassy: 0.4 })],
      shore,
    );
    expect(calm.root.children.map((m) => m.name)).toEqual(['calm:t']);
    calm.dispose();
  });

  it('today’s ring has none', () => {
    const calm = new CalmWater(PHASE1_MAP.windZones ?? [], shore);
    expect(calm.root.children).toHaveLength(0);
    calm.dispose();
  });
});

describe('the calm sheet over a coarse ocean grid (issue #277)', () => {
  /** The ocean's flat triangle over (x, z), on a grid `cell` apart, at time t, above the waves. */
  const rise = (x: number, z: number, cell: number, t: number) => {
    const i = Math.floor(x / cell) * cell,
      j = Math.floor(z / cell) * cell;
    const fx = (x - i) / cell,
      fz = (z - j) / cell;
    const h = (a: number, b: number) => waveHeight(a, b, t);
    // PlaneGeometry splits each square on the diagonal from (i, j+cell) to (i+cell, j).
    const flat =
      fx + fz <= 1
        ? h(i, j) + fx * (h(i + cell, j) - h(i, j)) + fz * (h(i, j + cell) - h(i, j))
        : h(i + cell, j + cell) +
          (1 - fx) * (h(i, j + cell) - h(i + cell, j + cell)) +
          (1 - fz) * (h(i + cell, j) - h(i + cell, j + cell));
    return flat - h(x, z);
  };

  it('bounds how far every level’s ocean stands over the true waves', () => {
    for (const cell of [480 / 48, 480 / 80, 480 / 120, 480 / 160]) {
      let worst = 0;
      for (let k = 0; k < 4000; k++) {
        const x = (k * 7.31) % 200,
          z = (k * 3.97) % 200;
        worst = Math.max(worst, rise(x, z, cell, k * 0.37));
      }
      expect(worst).toBeLessThanOrEqual(waveSag(cell));
    }
  });
});

describe('pack ice in the shore bake (issue #277)', () => {
  it('is shore all through, so the waves calm under it', () => {
    const square: [number, number][] = [
      [-40, -40],
      [40, -40],
      [40, 40],
      [-40, 40],
    ];
    const read = (kind: 'ice' | 'reef') => {
      const { texture, bounds } = shoreTexture([], [{ id: 'p', kind, outline: square }]);
      const { data, width, height } = texture.image as {
        data: Uint8Array;
        width: number;
        height: number;
      };
      const i = Math.floor(((0 - bounds.x) / bounds.z) * width),
        j = Math.floor(((0 - bounds.y) / bounds.w) * height);
      texture.dispose();
      return data[j * width + i]!;
    };
    expect(read('ice')).toBe(0);
    expect(read('reef')).toBeGreaterThan(100);
  });
});
