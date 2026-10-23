import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { distanceChanges, quickChecks, routeChecks } from '../src/sim/mapChecks';
import type { MapDef } from '../src/sim/map';

const failed = (map: MapDef) => quickChecks(map).filter((c) => !c.ok);
const edit = (change: (map: MapDef) => void) => {
  const map = structuredClone(PHASE1_SOURCE);
  change(map);
  return prepareMap(map);
};

describe('map checks shared with the map editor (0095)', () => {
  it('passes every check on the shipped Windward Ring', () => {
    expect(failed(PHASE1_MAP)).toEqual([]);
    expect(routeChecks(PHASE1_MAP).filter((c) => !c.ok)).toEqual([]);
    expect(distanceChanges(PHASE1_MAP, PHASE1_MAP).ok).toBe(true);
  }, 30000);

  it('prepares a copy and leaves the authored map untouched', () => {
    const map = prepareMap(PHASE1_SOURCE);
    expect(map.islands[0]!.look?.harbourBearing).toBeTypeOf('number');
    expect(PHASE1_SOURCE.islands[0]!.look).not.toHaveProperty('harbourBearing');
    expect(map.wind.weather).toBeDefined();
  });

  it('flags broken links, unknown goods and goods nobody makes or buys', () => {
    const map = edit((m) => {
      m.ports[0]!.islandId = 'nowhere';
      m.ports[1]!.wants.push('gold' as never);
      m.ports.find((p) => p.id === 'abbey-head')!.levelProduces = {};
      m.homePort = 'atlantis';
    });
    const ids = failed(map).map((c) => c.id);
    expect(ids).toContain('links');
    expect(ids).toContain('goods');
    expect(failed(map).find((c) => c.id === 'goods')!.message).toContain('honey');
  });

  it('flags land at the world edge, a start on land and a blocked harbour', () => {
    const map = edit((m) => {
      m.islands.find((i) => i.id === 'lantern-rock')!.x = 420;
      m.start = { x: 285, y: -140, headingDeg: 0 };
      // A reef dropped across Westholm's approach waypoint.
      const wp = m.course.find((w) => w.label === 'Westholm')!;
      m.terrain!.push({
        id: 'test-reef',
        kind: 'reef',
        outline: [
          [wp.x - 15, wp.y - 15],
          [wp.x + 15, wp.y - 15],
          [wp.x + 15, wp.y + 15],
          [wp.x - 15, wp.y + 15],
        ],
      });
    });
    const ids = failed(map).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['edge', 'start', 'harbours']));
  });

  it('warns when a port moved enough to change trade timings', () => {
    const map = edit((m) => {
      m.islands.find((i) => i.id === 'westholm')!.x += 40;
    });
    const check = distanceChanges(map, PHASE1_MAP);
    expect(check.ok).toBe(false);
    expect(check.severity).toBe('warning');
    expect(check.message).toMatch(/Port Calda → Westholm now \d+ u \(was \d+\)/);
  });

  it('finds a port walled in by a reef unreachable', () => {
    const map = edit((m) => {
      const island = m.islands.find((i) => i.id === 'westholm')!;
      const ring: [number, number][] = [];
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        ring.push([island.x + 70 * Math.cos(a), island.y + 70 * Math.sin(a)]);
      }
      const inner = ring.map(([x, y]) => [
        island.x + (x - island.x) * 0.8,
        island.y + (y - island.y) * 0.8,
      ]) as [number, number][];
      m.terrain!.push({
        id: 'wall',
        kind: 'reef',
        outline: [...ring, ring[0]!, ...inner.reverse(), inner[inner.length - 1]!],
      });
    });
    const reach = routeChecks(map).find((c) => c.id === 'reach')!;
    expect(reach.ok).toBe(false);
    expect(reach.message).toContain('Westholm');
  }, 30000);
});
