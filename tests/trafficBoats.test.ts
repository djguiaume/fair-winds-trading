import { describe, expect, it } from 'vitest';
import { buildProp, partsTriangles } from '../src/render/models/propRecipe';
import { cargoOf } from '../src/render/trafficBatch';

/** Ceilings from the v1.2 look rules (docs/reviews/art-direction/new-look/boats.md). */
const CEILING: Record<string, number> = { 'traffic-fishing': 1500, 'traffic-coaster': 3500 };

const build = (id: string, cargo: number) =>
  buildProp(id, { R: 1, style: 'fish', variant: 0, shape: 0.5, size: 1, vars: { cargo } });

describe('other boats (issue #331)', () => {
  it('stay under their triangle ceilings with every deck cargo', () => {
    for (const [id, most] of Object.entries(CEILING))
      for (let cargo = 0; cargo <= 5; cargo++)
        expect(partsTriangles(build(id, cargo)), `${id} cargo ${cargo}`).toBeLessThan(most);
  });

  it('carry a different deck cargo for each kind of good', () => {
    const sizes = [0, 1, 2, 3, 4, 5].map((c) => partsTriangles(build('traffic-coaster', c)));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('load cargo by the home port’s good, a tarp when it has none', () => {
    expect(cargoOf('fish')).toBe(1);
    expect(cargoOf('planks')).toBe(3);
    expect(cargoOf('amber')).toBe(5);
    expect(cargoOf(undefined)).toBe(0);
  });

  it('keep every sail apart from the hull, for its own instanced mesh', () => {
    const sails = (id: string) => build(id, 0).filter((g) => g.userData.sail).length;
    expect(sails('traffic-fishing')).toBe(1);
    expect(sails('traffic-coaster')).toBe(2);
  });
});
