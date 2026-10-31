import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { ISLAND_DESIGNS, type IslandDesign, type SculptEdit } from '../src/data/islands';
import { islandCheckKit } from '../src/render/models/towns';
import { BakeError, bakeCoast } from '../src/sim/coastBake';
import { bakeMapProblems } from '../src/sim/coastBakeMap';
import { checkIsland } from '../src/sim/islandChecks';
import { ISLAND_SCALE } from '../src/sim/islandUnits';
import { ringsCross } from '../src/sim/polyline';
import { SCULPT_VERSION } from '../src/sim/sculpt';

const calda = GAME_MAP.islands.find((i) => i.look?.design === 'calda')!;
const file = ISLAND_DESIGNS.calda!;
const kit = islandCheckKit(file, calda.radius / ISLAND_SCALE, true);
const shore = file.coasts[0]![9]!;

const edit = (op: SculptEdit['op'], at: [number, number], strength: number): SculptEdit => ({
  op,
  points: [at],
  radius: 0.07,
  strength,
  falloff: 0.5,
  override: true,
});
const sculpted = (...edits: SculptEdit[]): IslandDesign => ({
  ...structuredClone(file),
  sculpt: { version: SCULPT_VERSION, edits },
});
const coastErrors = (d: IslandDesign) =>
  checkIsland(d, kit).filter((i) => i.check === 'coast' && i.severity === 'error');

describe('baking a sculpted coast (issue #352)', { timeout: 120000 }, () => {
  const seaward: [number, number] = [shore[0] * 1.04, shore[1] * 1.04];

  it('moves the outline to the sculpted ground: sculpt, bake, no coast gap', () => {
    const design = sculpted(edit('raise', seaward, 3));
    expect(coastErrors(design).length).toBeGreaterThan(0);
    const baked = bakeCoast(design, kit);
    expect(coastErrors(baked.design)).toEqual([]);
    expect(baked.design.sculpt).toEqual(design.sculpt);
    expect(baked.gap).toBeLessThanOrEqual(1.5);
    expect(baked.coasts.reduce((n, c) => n + c.length, 0)).toBeLessThanOrEqual(120);
    expect(ringsCross(baked.coasts)).toBe(false);
    expect(bakeMapProblems(GAME_MAP, baked.design)).toEqual([]);
  });

  it('is stable: the same ground gives the same outline, and a baked island bakes again', () => {
    const design = sculpted(edit('raise', seaward, 3));
    const once = bakeCoast(design, kit);
    expect(bakeCoast(structuredClone(design), kit).coasts).toEqual(once.coasts);
    expect(bakeCoast(once.design, kit).gap).toBeLessThanOrEqual(1.5);
  });

  it('leaves an untouched island close to its file', () => {
    const baked = bakeCoast(structuredClone(file), kit);
    expect(coastErrors(baked.design)).toEqual([]);
  });

  it('refuses land that runs off the edge of the ground', () => {
    const big: SculptEdit = {
      ...edit('raise', [shore[0] + 0.08, shore[1] + 0.09], 3),
      radius: 0.15,
    };
    expect(() => bakeCoast(sculpted(big), kit)).toThrow(/off the edge/);
  });

  it('refuses edits that cannot replay', () => {
    const design = sculpted(edit('raise', [99, 99], 1));
    expect(() => bakeCoast(design, kit)).toThrow(BakeError);
  });
});
