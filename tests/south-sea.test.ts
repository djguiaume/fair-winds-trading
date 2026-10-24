import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { GROWN_SEA_RADIUS, grownMap } from '../src/data/grownMap';
import { createBoat } from '../src/sim/boat';
import { resolveCollisions } from '../src/sim/collision';
import { passageShallowness } from '../src/sim/hazards';
import type { TerrainDef } from '../src/sim/map';
import {
  DEEPEST_SHIP,
  clearAt,
  harbourApproach,
  quickChecks,
  sailRoute,
} from '../src/sim/mapChecks';
import { INDIAMAN, SCHOONER, SLOOP } from '../src/sim/ship';

/** Length of a planned route, in map units. */
const length = (points: { x: number; y: number }[]) =>
  points.reduce((n, p, i) => (i ? n + Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y) : 0), 0);

describe('the south sea, Sunreach (decision 0151)', () => {
  const map = prepareMap(grownMap(PHASE1_SOURCE));
  const port = (id: string) => map.ports.find((p) => p.id === id)!;
  const passage = map.terrain!.find((t) => t.kind === 'shallows')!;

  it('grows the sea round the Windward Ring and leaves the ring as it is', () => {
    expect(map.boundsRadius).toBe(GROWN_SEA_RADIUS);
    for (const island of PHASE1_MAP.islands)
      expect(map.islands.find((i) => i.id === island.id)).toEqual(island);
    for (const p of PHASE1_MAP.ports) expect(port(p.id)).toEqual(p);
    for (const t of PHASE1_MAP.terrain ?? [])
      expect(map.terrain!.find((s) => s.id === t.id)).toEqual(t);
    expect(map.windZones?.map((z) => z.kind).sort()).toEqual([
      'doldrums',
      'sheltered',
      'trade-belt',
    ]);
  });

  it('has no map-check errors or warnings', () => {
    const issues = quickChecks(map).filter((c) => !c.ok);
    expect(issues.map((c) => c.message)).toEqual([]);
  });

  it('opens through the Keeper’s Passage: a sloop sails from the ring to Sunreach', () => {
    const from = harbourApproach(map, port('watchman-key'));
    const plan = sailRoute(map, from, harbourApproach(map, port('sunreach')), map.wind.fromDeg);
    expect(plan).not.toBeNull();
  }, 60_000);

  it('lets shallow keels cut through Palm Key Narrows, and deep ships go round', () => {
    const a = harbourApproach(map, port('sunreach')),
      b = harbourApproach(map, port('palm-key'));
    const wind = map.wind.fromDeg;
    const shallow = sailRoute(map, a, b, wind)!;
    const deep = sailRoute(map, a, b, wind, 11, undefined, {
      radius: SLOOP.radius,
      draft: DEEPEST_SHIP.draft,
    })!;
    expect(shallow).not.toBeNull();
    expect(deep).not.toBeNull();
    // The long way exists and is longer, without being punishing (ADR 0151 records the numbers).
    expect(length(deep.points)).toBeGreaterThan(length(shallow.points) * 1.1);
    expect(deep.seconds).toBeLessThan(shallow.seconds * 1.6);
  }, 120_000);

  it('refuses ships deeper than the passage allows, softly, and lets the others cross', () => {
    expect(SCHOONER.draft).toBeLessThanOrEqual(passage.maxDraft!);
    expect(INDIAMAN.draft).toBeGreaterThan(passage.maxDraft!);
    const xs = passage.outline.map((p) => p[0]),
      ys = passage.outline.map((p) => p[1]);
    const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const only: TerrainDef[] = [passage];
    const sloop = createBoat(mid.x, mid.y, 0);
    expect(resolveCollisions(sloop, SLOOP.radius, [], 1e5, only, [], SLOOP.draft)).toBeNull();
    const indiaman = createBoat(mid.x, mid.y, 0);
    expect(resolveCollisions(indiaman, INDIAMAN.radius, [], 1e5, only, [], INDIAMAN.draft)).toBe(
      'shallows',
    );
    // Pushed out of the passage, as by a sandbank.
    expect(clearAt(map, indiaman.x, indiaman.y, 0, SLOOP.draft)).toBe(true);
    expect(passageShallowness(only, mid)).toBeGreaterThan(0);
    expect(passageShallowness(only, { x: mid.x + 500, y: mid.y })).toBe(0);
    // Map checks see the passage as water for a sloop and as shore for the deepest ship.
    expect(clearAt(map, mid.x, mid.y, 1)).toBe(true);
    expect(clearAt(map, mid.x, mid.y, 1, DEEPEST_SHIP.draft)).toBe(false);
  });
});
