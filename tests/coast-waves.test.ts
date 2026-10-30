import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import {
  type CoastGrid,
  bandCalm,
  coastCalmAt,
  coastSample,
  createBandCalm,
} from '../src/sim/coastWaves';
import type { TerrainDef } from '../src/sim/map';
import { WAVE_BANDS, createSeaState } from '../src/sim/seaState';
import { createWaveField, setWaveField, waveHeightAt } from '../src/sim/waves';
import { bakeSeabedDepth } from '../src/render/seabedDepth';

/** A reef ring round (0, 0), 30 units across, open by a gap to the south: a lagoon. */
function lagoon(): TerrainDef[] {
  const arc = (from: number, to: number, r: number, w: number) => {
    const pts: [number, number][] = [];
    for (let a = from; a <= to; a += 5) pts.push(polar(a, r + w));
    for (let a = to; a >= from; a -= 5) pts.push(polar(a, r - w));
    return pts;
  };
  // Compass degrees, clockwise from north; the gap faces south (160° to 200°).
  return [{ id: 'ring', kind: 'reef', outline: arc(-160, 160, 30, 4) }];
}
const polar = (deg: number, r: number): [number, number] => [
  Math.sin((deg * Math.PI) / 180) * r,
  Math.cos((deg * Math.PI) / 180) * r,
];
/** A long straight bank east of x = 100, running north and south. */
const bank: TerrainDef = {
  id: 'bank',
  kind: 'sandbank',
  outline: [
    [100, -300],
    [160, -300],
    [160, 300],
    [100, 300],
  ],
};

const bake = (terrain: TerrainDef[], piers = []) =>
  bakeSeabedDepth([], terrain, TUNING.graphics.water.depth, TUNING.waves.coast, piers);
const calmAt = (grid: CoastGrid, x: number, y: number) => [
  ...coastCalmAt(grid, x, y, createBandCalm()),
];

/** The heaviest sea the tuning allows. */
function stormField() {
  const state = createSeaState();
  for (const b of WAVE_BANDS)
    Object.assign(state[b], {
      height: TUNING.waves.bands[b].max,
      toX: 0,
      toY: 1,
      coherence: 0.7,
    });
  const field = createWaveField();
  setWaveField(field, state, 3, 1234);
  return field;
}

describe('the coast calms the waves (issue #281)', () => {
  it('leaves the open sea alone, calms a lagoon behind its reef, and the swell before the chop', () => {
    const grid = bake([...lagoon(), bank]);
    expect(calmAt(grid, -400, 0)).toEqual([1, 1, 1]);
    // Off the map's bake: open sea, as the shader's `coastAt`.
    expect(calmAt(grid, 5000, 5000)).toEqual([1, 1, 1]);
    const lagoonMiddle = calmAt(grid, 0, 0);
    for (const share of lagoonMiddle)
      expect(share).toBeLessThanOrEqual(TUNING.waves.coast.sheltered + 0.01);
    // On the shelf off a straight bank: the swell feels the bottom before the chop.
    const [swell, chop] = calmAt(grid, 85, 0);
    expect(swell).toBeLessThan(chop!);
    expect(chop).toBeLessThan(1);
  });

  it('keeps a straight coast open and closes a harbour by its land, never by a circle', () => {
    const grid = bake([bank]);
    // 20 units off the bank: half the way round is land, and that is still open water.
    expect(coastSample(grid, 80, 0).exposure).toBeGreaterThan(TUNING.waves.coast.openAt - 0.1);
    const ring = bake(lagoon());
    expect(coastSample(ring, 0, 0).exposure).toBeLessThan(TUNING.waves.coast.shelteredAt);
    // Just outside the ring, as far from the reef as the middle is: open.
    expect(coastSample(ring, 0, -60).exposure).toBeGreaterThan(0.6);
  });

  it("calms a long pier's berth out in open water", () => {
    // 55 units off the bank, past where it shelters anything.
    const pier = { x0: 60, y0: 0, x1: 45, y1: 0 };
    const grid = bake([bank], [pier] as never);
    expect(coastSample(bake([bank]), 45, 0).exposure).toBeGreaterThan(0.9);
    expect(coastSample(grid, 45, 0).exposure).toBeLessThan(0.2);
    expect(calmAt(grid, 45, 0)[0]).toBeLessThanOrEqual(TUNING.waves.coast.sheltered + 0.01);
    expect(coastSample(grid, 45, 60).exposure).toBeGreaterThan(0.9);
  });

  it('changes smoothly over the bake, with no seam between its cells', () => {
    const grid = bake([...lagoon(), bank]);
    let worst = 0;
    let last = calmAt(grid, -200, 3)[0]!;
    for (let x = -200; x <= 200; x += 0.25) {
      const now = calmAt(grid, x, 3)[0]!;
      worst = Math.max(worst, Math.abs(now - last));
      last = now;
    }
    expect(worst).toBeLessThan(0.04);
  });

  it('reads texel centres exactly as stored, as a GPU filters the texture', () => {
    const grid = bake([bank]);
    const k = Math.floor(grid.h / 2) * grid.w + Math.floor(grid.w / 2);
    const x = grid.x0 + (Math.floor(grid.w / 2) + 0.5) * grid.cell,
      z = grid.z0 + (Math.floor(grid.h / 2) + 0.5) * grid.cell;
    expect(coastSample(grid, x, z).depth).toBeCloseTo(grid.depth[k]! / 255, 9);
    expect(coastSample(grid, x, z).exposure).toBeCloseTo(grid.exposure[k]! / 255, 9);
  });

  it('floats a boat on calmer water from the open sea, over the shelf, into the lagoon', () => {
    const grid = bake([...lagoon(), bank]);
    const field = stormField();
    // The sea's swing over a patch, with the coast's calm and without it.
    const swing = (x: number, y: number, coast: CoastGrid | null) => {
      let sum = 0;
      for (let i = -3; i <= 3; i++)
        for (let j = -3; j <= 3; j++)
          sum += Math.abs(waveHeightAt(field, x + i * 2.5, y + j * 2.5, coast));
      return sum;
    };
    expect(swing(-500, -300, grid)).toBeCloseTo(swing(-500, -300, null), 9);
    const shelf = swing(85, 0, grid) / swing(85, 0, null);
    const inLagoon = swing(0, 5, grid) / swing(0, 5, null);
    expect(shelf).toBeLessThan(1);
    expect(inLagoon).toBeLessThan(Math.min(shelf, TUNING.waves.coast.sheltered + 0.05));
    // The calm is the same as no bake far from land.
    expect(waveHeightAt(field, -500, -300, grid)).toBeCloseTo(waveHeightAt(field, -500, -300), 9);
  });

  it('never calms past the floor and the shelter, nor lifts a wave past the open sea', () => {
    const out = createBandCalm();
    const { floor, sheltered } = TUNING.waves.coast;
    for (let d = 0; d <= 1; d += 0.05)
      for (let e = 0; e <= 1; e += 0.05) {
        bandCalm(d, e, out);
        for (const share of out) {
          expect(share).toBeGreaterThanOrEqual(floor * sheltered - 1e-9);
          expect(share).toBeLessThanOrEqual(1);
        }
      }
  });
});
