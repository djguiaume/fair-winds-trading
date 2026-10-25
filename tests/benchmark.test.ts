import { describe, expect, it } from 'vitest';
import { GAME_MAP, PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { stressMap } from '../src/data/stressMap';
import { BENCHMARK, Bench, BenchRoute } from '../src/perf/bench';
import { clearAt } from '../src/sim/mapChecks';
import { SLOOP } from '../src/sim/ship';

describe('?bench benchmark (decision 0154)', () => {
  it('has a route of [x, y] points and passes with a scale', () => {
    expect(BENCHMARK.route.length).toBeGreaterThan(2);
    for (const p of BENCHMARK.route) expect(p).toHaveLength(2);
    expect(BENCHMARK.passes.length).toBeGreaterThan(0);
    for (const p of BENCHMARK.passes) expect(p.scale).toBeGreaterThan(0);
  });

  it.each([
    ['the grown sea, the game since decision 0193', GAME_MAP],
    ['the ring alone', PHASE1_MAP],
    ['the stress sea', prepareMap(stressMap(PHASE1_SOURCE))],
  ])('sails in open water on %s', (_, map) => {
    const route = new BenchRoute(BENCHMARK.route);
    const blocked: number[] = [];
    for (let d = 0; d <= route.length; d += 2) {
      const p = route.at(d);
      if (!clearAt(map, p.x, p.y, SLOOP.radius + 4)) blocked.push(Math.round(d));
    }
    expect(blocked).toEqual([]);
  });

  it('walks the route once per pass, then stops', () => {
    const config = {
      ...BENCHMARK,
      speedKn: 1,
      passes: [
        { label: 'a', scale: 1 },
        { label: 'b', scale: 0.5 },
      ],
      route: [
        [0, 0],
        [0, 10],
        [10, 10],
      ] as [number, number][],
    };
    const bench = new Bench(config, 1);
    expect(bench.passSec).toBe(20);
    const first = bench.step(0.016);
    expect(first).toMatchObject({ pass: 0, passStarted: true, done: false });
    expect(first.pose).toMatchObject({ x: 0, y: 0 });
    expect(first.pose.heading).toBeCloseTo(0); // north, up the first leg
    const mid = bench.step(15);
    expect(mid.pose.x).toBeCloseTo(5);
    expect(mid.pose.y).toBeCloseTo(10);
    expect(mid.pose.heading).toBeCloseTo(Math.PI / 2); // east
    const second = bench.step(5);
    expect(second).toMatchObject({ pass: 1, passStarted: true, done: false });
    expect(second.pose).toMatchObject({ x: 0, y: 0 });
    expect(bench.step(20).done).toBe(true);
  });
});
