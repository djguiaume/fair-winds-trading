import { describe, expect, it } from 'vitest';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { designedTownParts, islandCheckKit } from '../src/render/models/towns';
import { coastDistance } from '../src/sim/coast';
import { checkIsland } from '../src/sim/islandChecks';
import {
  cliffDistance,
  crossesCliff,
  islandLayout,
  layoutGround,
  slopeDistance,
} from '../src/sim/islandLayout';

/** Port Calda with a ramp from the low ground (0.11) up onto its plateau (ground 1, 0.32). */
const R = 30 / 2.2;
const EDGE = 7; // the plateau's south-facing edge, over the low ground
function edgeFrame(d: IslandDesign) {
  const o = d.ground[1]!.outline!;
  const a = o[EDGE]!,
    b = o[(EDGE + 1) % o.length]!;
  const mx = (a[0] + b[0]) / 2,
    mz = (a[1] + b[1]) / 2;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let nx = (b[1] - a[1]) / l,
    nz = -(b[0] - a[0]) / l;
  if (coastDistance(mx + nx * 0.01, mz + nz * 0.01, o).distance < 0) [nx, nz] = [-nx, -nz];
  /** `out` outward from the edge's middle (negative: inward), `side` along it. */
  return (out: number, side = 0): [number, number] => [
    mx + nx * out + nz * side,
    mz + nz * out - nx * side,
  ];
}
function withRamp(): IslandDesign {
  const d = structuredClone(ISLAND_DESIGNS.calda!);
  const at = edgeFrame(d);
  // Homes standing where the ramp goes move away (here: are left out).
  d.props = d.props.filter((p) => Math.hypot(p.x - at(0.12)[0], p.z - at(0.12)[1]) > 0.3);
  d.ramps = [
    { points: [at(0.3), at(-0.05)], width: 0.1, start: 0.11, end: 0.32, material: 'grass' },
  ];
  return d;
}

describe('ramps (decision 0123)', () => {
  it('rises evenly along its length and runs over the cliff it climbs', () => {
    const d = withRamp();
    const at = edgeFrame(d);
    const layout = islandLayout(d, 4);
    expect(layoutGround(layout, ...at(0.3))).toBeCloseTo(0.11, 3);
    expect(layoutGround(layout, ...at(0.125))).toBeCloseTo(0.11 + 0.21 * 0.5, 3);
    // Across the plateau's edge: ground under a footprint, no cliff for a lane.
    expect(layoutGround(layout, ...at(0), 0.03)).not.toBeNull();
    expect(crossesCliff(layout, ...at(0.1), ...at(-0.03))).toBe(false);
    // Beside the ramp the edge is still a cliff.
    expect(crossesCliff(layout, ...at(0.1, 0.2), ...at(-0.03, 0.2))).toBe(true);
    // Its sides are edges: a footprint must keep off them.
    expect(cliffDistance(layout, ...at(0.15, 0.04))).toBeCloseTo(0.01, 3);
    expect(slopeDistance(layout, ...at(0.15))).toBe(0);
  });

  it('passes the checks, flags a building on it, and is drawn', () => {
    const d = withRamp();
    const at = edgeFrame(d);
    const kit = islandCheckKit(d, R);
    expect(checkIsland(d, kit).filter((i) => i.severity === 'error')).toEqual([]);
    const [x, z] = at(0.15);
    d.props.push({ type: 'cabin', x, z, from: 1 });
    expect(checkIsland(d, islandCheckKit(d, R)).some((i) => i.check === 'slope')).toBe(true);
    const count = (design: IslandDesign) => {
      const parts = designedTownParts(design, R, 4);
      const n = parts.reduce((t, g) => t + g.getAttribute('position').count / 3, 0);
      parts.forEach((g) => g.dispose());
      return n;
    };
    expect(count(withRamp()) - count({ ...withRamp(), ramps: [] })).toBeGreaterThan(8);
  });

  it('reports a ramp past the coast or without a width', () => {
    const d = withRamp();
    d.ramps![0]!.points.push([5, 5]);
    expect(
      checkIsland(d, islandCheckKit(d, R)).some((i) => i.message.includes('past the coast')),
    ).toBe(true);
    d.ramps![0]!.width = 0;
    expect(checkIsland(d, islandCheckKit(d, R)).some((i) => i.message.includes('width'))).toBe(
      true,
    );
  });
});
