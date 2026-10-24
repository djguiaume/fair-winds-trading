import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { knobs } from '../src/sim/difficulty';
import type { MapDef } from '../src/sim/map';
import { flowChecks } from '../src/sim/mapChecks';
import { SLOOP } from '../src/sim/ship';
import { beltMeanWait, beltNow, beltNumbers, beltSquallsAt } from '../src/sim/stormBelt';
import { stormStrength } from '../src/sim/storms';
import { type WindZoneDef, zoneField } from '../src/sim/windZones';
import { createWorld, holdStorms, stepWorld } from '../src/sim/world';

/** An east-west belt 120 units wide and 400 long, centred on (x, y), squalls rolling in from the east. */
function belt(x: number, y: number, extra: Partial<WindZoneDef> = {}): WindZoneDef {
  return {
    id: 'belt',
    name: 'Stormbreak',
    kind: 'storm-belt',
    headingDeg: 90,
    outline: [
      [x - 200, y - 60],
      [x + 200, y - 60],
      [x + 200, y + 60],
      [x - 200, y + 60],
    ],
    ...extra,
  };
}

/** Sum of the squalls' strength at a spot. */
const hit = (squalls: ReturnType<typeof beltSquallsAt>, x: number, y: number) =>
  squalls.reduce((s, q) => s + stormStrength(q, x, y), 0);

describe('storm belt (decision 0167)', () => {
  const field = zoneField([belt(0, 0)])!;

  it('breeds trains of squalls that march downwind of its heading, then lulls', () => {
    const seen = new Map<number, { x: number; t: number }>();
    let quiet = 0,
      busy = 0;
    for (let t = 0; t < 3 * 3600; t += 5) {
      const squalls = beltSquallsAt(field, 7, t, 0, 1);
      if (squalls.length) busy++;
      else quiet++;
      for (const q of squalls) {
        expect(q.squall).toBe(true);
        // Wind from the east: they travel west.
        expect(q.dx).toBeCloseTo(-1, 6);
        const first = seen.get(q.id);
        if (first) expect(q.x).toBeLessThan(first.x + 1e-6);
        else seen.set(q.id, { x: q.x, t });
        // Never far outside the belt.
        expect(Math.abs(q.y)).toBeLessThan(60 + q.radius);
      }
    }
    expect(seen.size).toBeGreaterThan(50);
    // Both trains and real lulls.
    expect(quiet).toBeGreaterThan(200);
    expect(busy).toBeGreaterThan(200);
    // A pure function of seed and time; none with the level at 0; only born after `from`.
    expect(beltSquallsAt(field, 7, 4000, 0, 1)).toEqual(beltSquallsAt(field, 7, 4000, 0, 1));
    expect(beltSquallsAt(field, 7, 4000, 0, 0)).toHaveLength(0);
    expect(beltSquallsAt(field, 7, 4000, 4000, 1)).toHaveLength(0);
  });

  it('the HUD lull is a real lull, and the level scales the trains', () => {
    const spots = [-150, 0, 150];
    let lulls = 0;
    for (const x of spots)
      for (let t = 0; t < 2 * 3600; t += 3) {
        const now = beltNow(field, 7, t, x, 0, 0, 1)!;
        expect(now).not.toBeNull();
        expect(now.inside).toBe(true);
        expect(now.changeSec).toBeGreaterThan(0);
        if (now.squalls) continue;
        lulls++;
        expect(hit(beltSquallsAt(field, 7, t, 0, 1), x, 0)).toBeLessThan(0.02);
      }
    expect(lulls).toBeGreaterThan(500);
    // Out of range there is nothing to say.
    expect(beltNow(field, 7, 100, 0, 600, 0, 1)).toBeNull();

    const share = (level: number) => {
      let on = 0,
        n = 0;
      for (let t = 0; t < 3 * 3600; t += 4, n++)
        if (beltNow(field, 7, t, 0, 0, 0, level)!.squalls) on++;
      return on / n;
    };
    const fair = share(knobs('fair').stormBelt);
    const salt = share(knobs('salt').stormBelt);
    expect(fair).toBeLessThan(share(knobs('captain').stormBelt));
    expect(share(knobs('captain').stormBelt)).toBeLessThan(salt);
    // The balance estimate grows with the level.
    const numbers = beltNumbers(field).get('belt')!;
    expect(beltMeanWait(numbers, knobs('fair').stormBelt)).toBeLessThan(
      beltMeanWait(numbers, knobs('salt').stormBelt),
    );
  });

  it('the world tells the captain once, and the switches and the tutorial stop the squalls', () => {
    const map: MapDef = {
      ...PHASE1_MAP,
      windZones: [belt(PHASE1_MAP.start.x, PHASE1_MAP.start.y + 150)],
    };
    const controls = { steer: 0, sailStep: 0 };
    const on = createWorld(map, SLOOP);
    const off = createWorld(map, SLOOP);
    off.stormBelt = false;
    const held = createWorld(map, SLOOP);
    holdStorms(held, 'tutorial', true);
    const told: string[] = [];
    let squalls = 0;
    for (let i = 0; i < 1600; i++) {
      // Hove to at the belt's edge: keep her where she started.
      for (const w of [on, off, held]) Object.assign(w.boat, { x: map.start.x, y: map.start.y });
      for (const e of stepWorld(on, controls, 0.5)) {
        if (e.type === 'belt-near') told.push(e.zone);
        // A squall never raises a storm toast of its own.
        if (e.type === 'storm-near') expect(on.weather.storms.some((s) => !s.squall)).toBe(true);
      }
      stepWorld(off, controls, 0.5);
      stepWorld(held, controls, 0.5);
      if (on.weather.storms.some((s) => s.squall)) squalls++;
      expect(off.weather.storms.some((s) => s.squall)).toBe(false);
      expect(held.weather.storms.some((s) => s.squall)).toBe(false);
    }
    expect(told).toEqual(['belt']);
    expect(on.belt?.zone).toBe('belt');
    expect(off.belt).toBeNull();
    expect(held.belt).toBeNull();
    expect(squalls).toBeGreaterThan(50);
  });

  it('map checks keep harbours clear and want a heading', () => {
    const port = PHASE1_MAP.ports[0]!;
    const island = PHASE1_MAP.islands.find((i) => i.id === port.islandId)!;
    const over: MapDef = { ...PHASE1_MAP, windZones: [belt(island.x, island.y)] };
    const calm = flowChecks(over).find((c) => c.id === 'calm-harbours')!;
    expect(calm.ok).toBe(false);
    const far: MapDef = { ...PHASE1_MAP, windZones: [belt(0, 2000)] };
    expect(flowChecks(far).find((c) => c.id === 'calm-harbours')!.ok).toBe(true);
    const bare = belt(0, 0);
    delete bare.headingDeg;
    const flow = flowChecks({ ...PHASE1_MAP, windZones: [bare] }).find((c) => c.id === 'flow')!;
    expect(flow.ok).toBe(false);
    expect(flow.message).toContain('needs headingDeg');
  });
});
