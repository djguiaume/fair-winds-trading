import { describe, expect, it } from 'vitest';
import { createBoat } from '../src/sim/boat';
import { resolveCollisions } from '../src/sim/collision';
import type { MapDef } from '../src/sim/map';
import { edgeProblems } from '../src/sim/mapChecks';
import {
  atSea,
  edgeSpots,
  keepAtSea,
  seaBox,
  seaDistance,
  seaReach,
  seaShape,
  sharpestTurn,
} from '../src/sim/seaEdge';
import { GAME_SOURCE, PHASE1_SOURCE } from '../src/data/maps';
import { SEAS, grownMap } from '../src/data/grownMap';
import grownFile from '../src/data/seas/grown.json';
import { applySeaSteps } from '../src/editor/seaSteps';
import { type GrownDef, mergeSeas, splitSeas } from '../src/editor/seas';
import { TUNING } from '../src/data/tuning';

/** Decision 0202: the playable edge is the round sea joined with each sea file's `edges`. */

const R = 985;
/** A section sticking out east, like a future extension's. */
const EAST: [number, number][] = [
  [900, -160],
  [1260, -160],
  [1260, 160],
  [900, 160],
];
const withSection = (): Pick<MapDef, 'boundsRadius' | 'edges'> => ({
  boundsRadius: R,
  edges: [{ id: 'east-reach', outline: EAST }],
});

describe('the round sea (no edges): exactly as before', () => {
  const sea = seaShape({ boundsRadius: R });

  it('has no rim and the old wall', () => {
    expect(sea.rim).toBeUndefined();
    expect(seaReach(sea)).toBe(R);
    expect(seaBox(sea)).toEqual([-R, -R, R, R]);
    const p = { x: 1000, y: 30 };
    const r = Math.hypot(p.x, p.y);
    const pushed = keepAtSea(sea, p);
    expect(pushed).toEqual({ nx: -1000 / r, ny: -30 / r });
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(R, 9);
  });

  it('puts the ring of buoys where it always was', () => {
    const { spacing, offset } = TUNING.seamanship.boundaryBuoys;
    const spots = edgeSpots(sea, spacing, offset);
    const r = R + offset;
    expect(spots.length).toBe(Math.max(8, Math.round((Math.PI * 2 * r) / spacing)));
    for (const s of spots) expect(Math.hypot(s.x, s.y)).toBeCloseTo(r, 6);
  });

  it('the game sea today has no edges', () => {
    expect(GAME_SOURCE.edges ?? []).toEqual([]);
    expect(seaShape(GAME_SOURCE).rim).toBeUndefined();
  });
});

describe('a section joined to the round sea', () => {
  const sea = seaShape(withSection());
  const { spacing, offset, maxTurnDeg } = TUNING.seamanship.boundaryBuoys;

  it('can be sailed into, and the wall holds the boat inside it', () => {
    expect(atSea(sea, 1150, 0)).toBe(true);
    expect(atSea(sea, 1150, 300)).toBe(false);
    expect(atSea(sea, 0, R - 1)).toBe(true);
    expect(seaReach(sea)).toBeGreaterThan(1250);
    const boat = createBoat(1300, 0, 0);
    expect(resolveCollisions(boat, 3, [], sea)).toBe('edge');
    expect(seaDistance(sea, boat.x, boat.y).distance).toBeGreaterThanOrEqual(-1e-6);
    expect(boat.x).toBeLessThan(1261);
    const inside = createBoat(1150, 0, 0);
    expect(resolveCollisions(inside, 3, [], sea)).toBeNull();
    expect([inside.x, inside.y]).toEqual([1150, 0]);
  });

  it('floats buoys only along the outer edge, none where the section joins', () => {
    const spots = edgeSpots(sea, spacing, offset);
    for (const s of spots) expect(seaDistance(sea, s.x, s.y).distance).toBeCloseTo(-offset, 0);
    // None left on the old rim where the section opened it.
    const seam = spots.filter((s) => s.x > 800 && Math.abs(s.y) < 100);
    expect(seam.every((s) => s.x > 1255)).toBe(true);
    // Evenly spaced.
    for (let i = 1; i < spots.length; i++) {
      const gap = Math.hypot(spots[i]!.x - spots[i - 1]!.x, spots[i]!.y - spots[i - 1]!.y);
      expect(gap).toBeGreaterThan(spacing * 0.8);
      expect(gap).toBeLessThan(spacing * 1.2);
    }
  });

  it('rounds every corner, the seams too (the art director: at most 30° between buoys)', () => {
    expect(sharpestTurn(sea, spacing).deg).toBeLessThanOrEqual(maxTurnDeg);
  });

  it('is checked: joined, ids, enough points', () => {
    expect(edgeProblems({ ...withSection() } as MapDef)).toEqual([]);
    const far = {
      boundsRadius: R,
      edges: [{ id: 'adrift', outline: EAST.map(([x, y]) => [x + 400, y]) }],
    } as MapDef;
    expect(edgeProblems(far)).toEqual(['sea edge adrift does not join the sea']);
    // Joined through another section that joins.
    const chain = {
      boundsRadius: R,
      edges: [
        { id: 'a', outline: EAST },
        { id: 'b', outline: EAST.map(([x, y]) => [x + 300, y / 2]) },
      ],
    } as MapDef;
    expect(edgeProblems(chain)).toEqual([]);
  });
});

describe('sea files bring their own edges', () => {
  it('the grown sea joins every sea file’s edges', () => {
    const seas = SEAS.map((s) =>
      s.id === 'east' ? { ...s, edges: [{ id: 'east-reach', outline: EAST }] } : s,
    );
    const map = grownMap(PHASE1_SOURCE, seas);
    expect(map.edges?.map((e) => e.id)).toEqual(['east-reach']);
    expect(atSea(seaShape(map), 1150, 0)).toBe(true);
  });

  it('`npm run sea -- add edge` writes it into that sea file, and back out on remove', () => {
    const doc = mergeSeas(PHASE1_SOURCE, SEAS, grownFile as GrownDef);
    const made = applySeaSteps(doc, [{ do: 'add', what: 'edge', sea: 'east', outline: EAST }]);
    expect(made).toEqual(['edge edge-1']);
    const files = splitSeas(doc);
    expect(files.seas.find((s) => s.id === 'east')?.edges).toEqual([
      { id: 'edge-1', outline: EAST },
    ]);
    expect(files.seas.filter((s) => s.edges?.length)).toHaveLength(1);
    expect('edges' in files.ring).toBe(false);
    applySeaSteps(doc, [{ do: 'move', what: 'edge', id: 'edge-1', by: [10, 0] }]);
    expect(doc.edges![0]!.outline[0]).toEqual([910, -160]);
    applySeaSteps(doc, [{ do: 'remove', what: 'edge', id: 'edge-1' }]);
    expect(splitSeas(doc).seas.find((s) => s.id === 'east')?.edges).toBeUndefined();
  });
});
