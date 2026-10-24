import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import {
  addAreaCurrent,
  addLanePoint,
  addZone,
  beginLane,
  deleteSelection,
  findCurrent,
  findZone,
  finishLane,
  formatMapJson,
  insertFlowPoint,
  moveFlow,
  moveFlowPoint,
  reverseCurrent,
  setLaneWidth,
} from '../src/editor/model';
import { CurrentField } from '../src/sim/currents';
import {
  areaCrests,
  laneCrests,
  outlineCrosses,
  smoothOutline,
  smoothPath,
} from '../src/sim/flowShapes';
import type { MapDef } from '../src/sim/map';
import { flowChecks } from '../src/sim/mapChecks';

/*
 * The shared base of currents and wind zones (decision 0140): the map format, the one smoothing
 * function the game and the editor share, the current lookup, the map checks and the editor's
 * document edits.
 */

const fresh = () => structuredClone(PHASE1_SOURCE);
const speed = (field: CurrentField, x: number, y: number) => {
  const v = field.at(x, y);
  return Math.hypot(v.east, v.north);
};

describe('smoothing (0140)', () => {
  it('keeps a lane’s ends and eases its widths', () => {
    const path: [number, number, number][] = [
      [0, 0, 40],
      [100, 0, 80],
      [100, 100, 40],
    ];
    const smooth = smoothPath(path);
    expect(smooth[0]).toEqual([0, 0, 40]);
    expect(smooth[smooth.length - 1]).toEqual([100, 100, 40]);
    expect(smooth.length).toBeGreaterThan(10);
    // No corner: the curve cuts inside the authored corner and never overshoots.
    for (const [x, y, w] of smooth) {
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThanOrEqual(40);
      expect(w).toBeLessThanOrEqual(80);
    }
    expect(smooth.some(([x, y]) => x === 100 && y === 0)).toBe(false);
  });

  it('closes an outline and stays inside its points', () => {
    const square: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const smooth = smoothOutline(square);
    expect(smooth).toHaveLength(4 * 2 ** TUNING.weather.currents.smoothRounds);
    for (const [x, y] of smooth) {
      expect(Math.min(x, y)).toBeGreaterThanOrEqual(0);
      expect(Math.max(x, y)).toBeLessThanOrEqual(100);
    }
    expect(outlineCrosses(smooth)).toBe(false);
    expect(
      outlineCrosses([
        [0, 0],
        [100, 100],
        [100, 0],
        [0, 100],
      ]),
    ).toBe(true);
  });
});

describe('the ring current (0140)', () => {
  const field = new CurrentField(PHASE1_MAP);

  it('runs east through the middle gap at about 1.8 kn', () => {
    const gap = field.at(-52, 19);
    expect(gap.id).toBe('gap-run');
    expect(Math.hypot(gap.east, gap.north)).toBeGreaterThan(1.5);
    expect(Math.hypot(gap.east, gap.north)).toBeLessThanOrEqual(1.8 + 1e-9);
    expect(gap.east).toBeGreaterThan(Math.abs(gap.north) * 3);
  });

  it('eases off where the lane widens, at its edges and at its ends', () => {
    expect(speed(field, -52, 19)).toBeGreaterThan(speed(field, 200, 75));
    expect(speed(field, -52, 60)).toBe(0);
    expect(speed(field, -52, -20)).toBe(0);
    expect(speed(field, -362, 248)).toBe(0);
    expect(speed(field, 271, 65)).toBe(0);
  });

  it('leaves the harbours still, and the map passes its checks', () => {
    for (const check of flowChecks(PHASE1_MAP))
      expect(check, check.message).toMatchObject({ ok: true });
  });

  it('scales with difficulty and is still water off the lane', () => {
    const v = field.at(-52, 19, 0.6);
    expect(Math.hypot(v.east, v.north)).toBeCloseTo(speed(field, -52, 19) * 0.6, 6);
    expect(field.at(0, -300).id).toBe('');
  });

  it('draws crests downstream of where they were, inside the lane', () => {
    const lane = smoothPath(PHASE1_SOURCE.currents![0]!.path!);
    const a = laneCrests(lane, 0),
      b = laneCrests(lane, 10);
    expect(a.length).toBeGreaterThan(10);
    // The same crest, 10 units further along: its bow moved east in the gap.
    const near = (cs: typeof a) =>
      cs.reduce((best, c) =>
        Math.hypot(c.c[0] + 52, c.c[1] - 19) < Math.hypot(best.c[0] + 52, best.c[1] - 19)
          ? c
          : best,
      );
    expect(near(b).c[0]).not.toBe(near(a).c[0]);
    const area = areaCrests(
      smoothOutline([
        [0, 0],
        [200, 0],
        [200, 200],
        [0, 200],
      ]),
      90,
      0,
    );
    expect(area.length).toBeGreaterThan(5);
  });
});

describe('map checks for currents and wind zones (0140)', () => {
  const failing = (map: MapDef) =>
    flowChecks(prepareMap(map))
      .filter((c) => !c.ok)
      .map((c) => c.message)
      .join('; ');

  it('flag duplicate ids, unknown kinds, narrow lanes, bad speeds and shapes outside the sea', () => {
    const map = fresh();
    map.currents!.push({ ...map.currents![0]!, speedKn: 4 });
    map.currents!.push({
      id: 'thin',
      speedKn: 1,
      path: [
        [0, -300, 10],
        [100, -300, 10],
      ],
    });
    map.currents!.push({
      id: 'area',
      speedKn: 1,
      outline: [
        [0, 0],
        [10, 0],
        [0, 10],
      ],
    });
    map.windZones = [
      {
        id: 'z',
        kind: 'monsoon',
        outline: [
          [0, 0],
          [10, 0],
          [0, 10],
        ],
      },
      {
        id: 'far',
        kind: 'doldrums',
        outline: [
          [0, 900],
          [10, 900],
          [0, 910],
        ],
      },
      {
        id: 'bow',
        kind: 'doldrums',
        outline: [
          [0, 0],
          [100, 100],
          [100, 0],
          [0, 100],
        ],
      },
    ];
    const text = failing(map);
    expect(text).toContain('two currents "gap-run"');
    expect(text).toContain('speed 4 kn');
    expect(text).toContain('thin narrower than 20');
    expect(text).toContain('area: an area current needs towardDeg');
    expect(text).toContain('kind "monsoon"');
    expect(text).toContain('far leaves the sea');
    expect(text).toContain('bow crosses itself');
  });

  it('flag a current running through a harbour', () => {
    const map = fresh();
    // Straight past Westholm's harbour (its pier faces east, towards -281, 41).
    map.currents!.push({
      id: 'harbour',
      speedKn: 2,
      path: [
        [-250, -150, 60],
        [-250, 40, 60],
        [-250, 200, 60],
      ],
    });
    expect(failing(map)).toMatch(/current at/);
  });
});

describe('editor tools for currents and wind zones (0140)', () => {
  it('lay a lane point by point and drop a double-click’s repeats', () => {
    const map = fresh();
    const id = beginLane(map, 0, -300);
    addLanePoint(map, id, 100, -300);
    addLanePoint(map, id, 200, -280);
    addLanePoint(map, id, 201, -280);
    expect(finishLane(map, id)).toBe(true);
    expect(findCurrent(map, id)!.path).toEqual([
      [0, -300, 50],
      [100, -300, 50],
      [200, -280, 50],
    ]);
    const lone = beginLane(map, 0, 0);
    expect(finishLane(map, lone)).toBe(false);
    expect(findCurrent(map, lone)).toBeUndefined();
  });

  it('move, widen, insert, reverse and delete', () => {
    const map = fresh();
    const sel = { kind: 'current' as const, id: 'gap-run' };
    const path = () => findCurrent(map, 'gap-run')!.path!;
    const first = [...path()[0]!];
    moveFlow(map, sel, 10, -5);
    expect(path()[0]).toEqual([first[0]! + 10, first[1]! - 5, first[2]]);
    moveFlowPoint(map, sel, 1, 0, 0);
    expect(path()[1]!.slice(0, 2)).toEqual([0, 0]);
    setLaneWidth(map, 'gap-run', 1, 33.4);
    expect(path()[1]![2]).toBe(33);
    const n = path().length;
    expect(insertFlowPoint(map, sel, 0)).toBe(1);
    expect(path()).toHaveLength(n + 1);
    expect(insertFlowPoint(map, sel, n)).toBeUndefined();
    const last = path()[path().length - 1];
    reverseCurrent(map, 'gap-run');
    expect(path()[0]).toEqual(last);
    expect(deleteSelection(map, { ...sel, point: 0 })).toEqual(sel);
    expect(path()).toHaveLength(n);
    expect(deleteSelection(map, sel)).toBeNull();
    expect(findCurrent(map, 'gap-run')).toBeUndefined();
  });

  it('add an area current and a wind zone that pass the checks and export cleanly', () => {
    const map = fresh();
    const area = addAreaCurrent(map, 0, -320);
    expect(findCurrent(map, area)).toMatchObject({ towardDeg: 90, speedKn: 0.8 });
    reverseCurrent(map, area);
    expect(findCurrent(map, area)!.towardDeg).toBe(270);
    const zone = addZone(map, 100, -300, 'doldrums');
    expect(findZone(map, zone)!.outline).toHaveLength(8);
    expect(flowChecks(prepareMap(map)).every((c) => c.ok)).toBe(true);
    const text = formatMapJson(map);
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(map)));
  });
});
