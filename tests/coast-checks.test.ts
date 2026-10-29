import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { ISLAND_DESIGNS, type IslandDesign, type SculptEdit } from '../src/data/islands';
import { islandCheckKit } from '../src/render/models/towns';
import { checkCoast } from '../src/sim/coastChecks';
import { checkIsland } from '../src/sim/islandChecks';
import { ISLAND_SCALE } from '../src/sim/islandUnits';
import { SCULPT_VERSION } from '../src/sim/sculpt';
import { contourLines } from '../src/sim/fieldContour';
import { coastMapChecks, coastReport } from '../src/sim/mapCoast';
import type { Heightfield } from '../src/sim/heightfield';

const calda = GAME_MAP.islands.find((i) => i.look?.design === 'calda')!;
const caldaDesign = ISLAND_DESIGNS.calda!;
const kit = islandCheckKit(caldaDesign, calda.radius / ISLAND_SCALE, true);

const dab = (op: SculptEdit['op'], at: [number, number], strength: number): SculptEdit => ({
  op,
  points: [at],
  radius: 0.15,
  strength,
  falloff: 0.5,
  override: true,
});
const sculpted = (...edits: SculptEdit[]): IslandDesign => ({
  ...caldaDesign,
  sculpt: { version: SCULPT_VERSION, edits },
});
const coastIssues = (design: IslandDesign) =>
  checkIsland(design, kit).filter((i) => i.check === 'coast');
/** A point of calda's coast, in the file's units, and one just out to sea from it (the field reaches 8 units past the coast). */
const shore = caldaDesign.coasts[0]![9]!;
const seaward: [number, number] = [shore[0] + 0.08, shore[1] + 0.09];

// Every test builds the ground of islands, which takes seconds on a CI runner.
describe('the drawn coast against the sailed coast (decision 0237)', { timeout: 60000 }, () => {
  it('agrees on every island and barrier island of the game, on every quality level', () => {
    const { tolerance } = TUNING.terrain.coast;
    for (const quality of Object.keys(
      TUNING.terrain.groundStep,
    ) as (keyof typeof TUNING.terrain.groundStep)[])
      for (const row of coastReport(GAME_MAP, quality))
        expect(row.worst?.distance ?? 0, `${row.id} at ${quality}`).toBeLessThanOrEqual(tolerance);
  });

  it('keeps the tolerance inside the water margin a dock keeps', () => {
    expect(TUNING.terrain.coast.tolerance).toBeLessThan(2);
  });

  it('passes the shipped islands and a hill inland', () => {
    expect(coastIssues(caldaDesign)).toEqual([]);
    expect(coastIssues(sculpted(dab('raise', [0, 0], 0.2)))).toEqual([]);
  });

  it('rejects land raised out of the sea, and a coast cut into the island', () => {
    const land = coastIssues(sculpted(dab('raise', seaward, 1)));
    expect(land[0]?.severity).toBe('error');
    expect(land[0]?.message).toMatch(/drawn land beyond/);
    const cut = coastIssues(sculpted(dab('lower', [shore[0] * 0.9, shore[1] * 0.9], 1)));
    expect(cut[0]?.message).toMatch(/drawn sea inside/);
  });

  it('stands buildings on level ground above the sea', () => {
    expect(checkCoast(caldaDesign, kit)).toEqual([]);
    const house = caldaDesign.props.findIndex((p) => kit.types[p.type]?.building);
    const adrift = {
      ...caldaDesign,
      props: caldaDesign.props.map((p, i) => (i === house ? { ...p, x: 2, z: 2 } : p)),
    };
    const issues = checkCoast(adrift, kit);
    expect(issues.map((i) => i.prop)).toEqual([house]);
  });

  it('checks the barrier islands, sandbanks and every harbour of the game', () => {
    expect(coastMapChecks(GAME_MAP).filter((c) => !c.ok)).toEqual([]);
  });

  it('finds ground drawn in dock water', () => {
    const pier = { ...caldaDesign.piers[0] };
    expect(pier).toBeDefined();
    const harbour = [0.08, 1.2] as [number, number];
    ISLAND_DESIGNS.calda = sculpted(dab('raise', harbour, 6));
    try {
      const failed = coastMapChecks(GAME_MAP).filter((c) => !c.ok);
      expect(failed.map((c) => c.id)).toContain('harbour-water');
    } finally {
      ISLAND_DESIGNS.calda = caldaDesign;
    }
  });
});

describe('the drawn coast line', () => {
  it('follows height zero, closed round an island', () => {
    const w = 8;
    const heights = new Float32Array(w * w).fill(-1);
    for (let j = 2; j < 6; j++) for (let i = 2; i < 6; i++) heights[j * w + i] = 1;
    const field = { x0: 0, y0: 0, cell: 1, w, h: w, heights } as Heightfield;
    const lines = contourLines(field);
    expect(lines).toHaveLength(1);
    const [x, y] = [lines[0]!.map((p) => p[0]), lines[0]!.map((p) => p[1])];
    expect([Math.min(...x), Math.max(...x), Math.min(...y), Math.max(...y)]).toEqual([
      1.5, 5.5, 1.5, 5.5,
    ]);
    expect(lines[0]![0]).toEqual(lines[0]![lines[0]!.length - 1]);
  });
});
