import { describe, expect, it } from 'vitest';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { designedTownParts, islandCheckKit } from '../src/render/models/towns';
import { coastDistance } from '../src/sim/coast';
import { checkIsland } from '../src/sim/islandChecks';
import { crossesCliff, islandLayout, layoutGround } from '../src/sim/islandLayout';

/** Port Calda with its plateau (ground 1, height 0.32 over 0.11) sloped instead of cliffed. */
const R = 30 / 2.2;
function sloped(edges?: [number, number][]): IslandDesign {
  const d = structuredClone(ISLAND_DESIGNS.calda!);
  d.ground[1]!.slope = 0.15;
  if (edges) d.ground[1]!.slopeEdges = edges;
  return d;
}
/** A point `out` outside the middle of edge i of the plateau, and its mirror inside. */
function across(d: IslandDesign, i: number, out: number) {
  const o = d.ground[1]!.outline!;
  const a = o[i]!,
    b = o[(i + 1) % o.length]!;
  const mx = (a[0] + b[0]) / 2,
    mz = (a[1] + b[1]) / 2;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let nx = (b[1] - a[1]) / l,
    nz = -(b[0] - a[0]) / l;
  if (coastDistance(mx + nx * 0.01, mz + nz * 0.01, o).distance < 0) [nx, nz] = [-nx, -nz];
  return {
    outside: [mx + nx * out, mz + nz * out] as const,
    inside: [mx - nx * out, mz - nz * out] as const,
  };
}
const EDGE = 7; // the plateau's south-facing edge, over the low ground

describe('sloped ground (decision 0096 §4)', () => {
  it('interpolates the height down a ramp, and keeps cliffs elsewhere', () => {
    const d = sloped();
    const layout = islandLayout(d, 4);
    const { outside, inside } = across(d, EDGE, 0.075);
    expect(layoutGround(layout, ...inside)).toBe(0.32);
    expect(layoutGround(layout, ...outside)).toBeCloseTo((0.32 + 0.11) / 2, 2);
    // No longer a cliff edge: a footprint across the edge has ground.
    const edge = across(d, EDGE, 0).outside;
    expect(layoutGround(layout, ...edge, 0.05)).not.toBeNull();
    expect(crossesCliff(layout, ...inside, ...outside)).toBe(false);
    // Only some edges sloped: the others stay cliffs.
    const some = sloped([[0, 2]]);
    const cliff = islandLayout(some, 4);
    expect(layoutGround(cliff, ...edge, 0.05)).toBeNull();
    expect(crossesCliff(cliff, ...inside, ...outside)).toBe(true);
    expect(layoutGround(cliff, ...outside)).toBe(0.11);
  });

  it('draws the ramp, and the shipped islands stay without slopes', () => {
    const count = (d: IslandDesign) => {
      const parts = designedTownParts(d, R, 4);
      const n = parts.reduce((t, g) => t + g.getAttribute('position').count / 3, 0);
      parts.forEach((g) => g.dispose());
      return n;
    };
    const extra = count(sloped()) - count(ISLAND_DESIGNS.calda!);
    // The ramp adds some triangles (a band and a fan per edge), and lanes may gain pieces.
    expect(extra).toBeGreaterThan(10);
    expect(extra).toBeLessThan(200);
    // Only the east sea's dunes and grazing holm slope (decision 0173), and the north's ice
    // islands (decision 0170); the rest keep cliffs.
    const sloping = Object.values(ISLAND_DESIGNS)
      .filter((d) => d.style !== 'ice' && d.ground.some((g) => g.slope))
      .map((d) => d.id)
      .sort();
    expect(sloping).toEqual(['amber-strand', 'lamb-holm']);
  });

  it('lets small props stand on a slope but not buildings', () => {
    const d = sloped();
    const { outside } = across(d, EDGE, 0.075);
    d.props.push({ type: 'lamp-post', x: outside[0], z: outside[1], from: 1 });
    d.props.push({ type: 'barn', x: outside[0], z: outside[1], from: 1 });
    const kit = islandCheckKit(d, R);
    delete kit.triangles;
    const issues = checkIsland(d, kit).filter(
      (i) => i.prop !== undefined && i.prop >= d.props.length - 2,
    );
    const lamp = issues.filter((i) => i.prop === d.props.length - 2 && i.severity === 'error');
    const barn = issues.filter((i) => i.prop === d.props.length - 1 && i.severity === 'error');
    expect(lamp).toEqual([]);
    expect(barn.map((i) => i.check)).toContain('slope');
  });

  it('lanes climb a slope; across a cliff they are flagged', () => {
    const lane = (d: IslandDesign) => {
      const { outside, inside } = across(d, EDGE, 0.12);
      d.lanes = [{ points: [[...inside], [...outside]] }];
      const kit = islandCheckKit(d, R);
      delete kit.triangles;
      return checkIsland(d, kit).filter((i) => i.check === 'lanes');
    };
    expect(lane(sloped())).toEqual([]);
    expect(lane(structuredClone(ISLAND_DESIGNS.calda!))).toHaveLength(1);
  });
});
