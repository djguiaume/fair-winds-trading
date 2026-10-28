import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { CalmWater } from '../src/render/calmWater';
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
