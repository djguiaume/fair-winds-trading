import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { DIFFICULTIES } from '../src/sim/difficulty';
import { DEG, wrapAngle } from '../src/sim/math';
import { SLOOP } from '../src/sim/ship';
import { chartedPorts, legSeconds } from '../src/sim/balance';
import { harbourApproach, sailRoute } from '../src/sim/mapChecks';
import type { MapDef } from '../src/sim/map';
import { DEFAULT_WEATHER, type LocalWeather, type WindConfig, windAt } from '../src/sim/wind';
import {
  type WindZoneDef,
  mapZones,
  zoneEffectAt,
  zoneField,
  zoneStormsAt,
  zonesTuning,
} from '../src/sim/windZones';
import { createWorld, stepWorld } from '../src/sim/world';

/** A square zone of half-size `h` around (x, y). */
function square(
  id: string,
  kind: string,
  x: number,
  y: number,
  h: number,
  extra = {},
): WindZoneDef {
  return {
    id,
    kind,
    outline: [
      [x - h, y - h],
      [x + h, y - h],
      [x + h, y + h],
      [x - h, y + h],
    ],
    ...extra,
  };
}

/** A plain wind with no weather, no gusts and no swing, so the zone is all that changes it. */
function plain(zones: WindZoneDef[], extra: Partial<WindConfig> = {}): WindConfig {
  return {
    fromDeg: 0,
    speedKn: 10,
    gustiness: 0,
    shiftDeg: 0,
    zones: zoneField(zones),
    ...extra,
  };
}

const deg = (rad: number) => (((rad / DEG) % 360) + 360) % 360;
const kinds = () => zonesTuning().kinds;

describe('wind zones (decision 0140)', () => {
  it('leave the wind alone outside every zone and on maps without any', () => {
    const cfg = plain([square('a', 'doldrums', 500, 500, 50)]);
    const open = windAt(cfg, 30, 1, { x: 0, y: 0 });
    expect(open.speedKn).toBeCloseTo(10, 6);
    expect(deg(open.from)).toBeCloseTo(0, 6);
    expect(zoneField([])).toBeNull();
    expect(zoneField(undefined)).toBeNull();
  });

  it('today’s Windward Ring has no wind zones (Guillaume: not on the ring)', () => {
    expect(mapZones(PHASE1_MAP) ?? []).toHaveLength(0);
  });

  it('a trade belt pulls the wind most of the way to its heading', () => {
    const pull = kinds()['trade-belt']!.pull!;
    const cfg = plain([square('t', 'trade-belt', 0, 0, 200, { headingDeg: 60 })]);
    const w = windAt(cfg, 10, 1, { x: 0, y: 0 });
    expect(deg(w.from)).toBeCloseTo(60 * pull, 3);
    expect(w.speedKn).toBeCloseTo(10, 6);
  });

  it('a trade belt halves the gusts', () => {
    const zone = square('t', 'trade-belt', 0, 0, 200, { headingDeg: 0 });
    const swing = (cfg: WindConfig) => {
      let lo = Infinity,
        hi = -Infinity;
      for (let t = 0; t < 120; t += 0.5) {
        const s = windAt(cfg, t, 1, { x: 0, y: 0 }).speedKn;
        lo = Math.min(lo, s);
        hi = Math.max(hi, s);
      }
      return hi - lo;
    };
    const open = swing(plain([], { gustiness: 0.2 }));
    const belt = swing(plain([zone], { gustiness: 0.2 }));
    expect(belt / open).toBeCloseTo(kinds()['trade-belt']!.gusts!, 2);
  });

  it('the doldrums take the wind down to a quarter or two fifths, in shifting puffs', () => {
    const cfg = plain([square('d', 'doldrums', 0, 0, 200)]);
    const [lo, hi] = kinds().doldrums!.strength as [number, number];
    const speeds: number[] = [];
    const dirs: number[] = [];
    for (let t = 0; t < 300; t += 3) {
      const w = windAt(cfg, t, 7, { x: 10, y: -20 });
      speeds.push(w.speedKn / 10);
      dirs.push(wrapAngle(w.from) / DEG);
    }
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(lo - 1e-9);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(hi + 1e-9);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(0.05);
    // The light puffs shift about.
    expect(Math.max(...dirs) - Math.min(...dirs)).toBeGreaterThan(10);
  });

  it('on the easiest level the doldrums never drop below their fairFloor', () => {
    const zones = [square('d', 'doldrums', 0, 0, 200)];
    const floor = kinds().doldrums!.fairFloor!;
    for (let t = 0; t < 200; t += 5) {
      const w = windAt(plain(zones, { easiest: true }), t, 3, { x: 0, y: 0 });
      expect(w.speedKn / 10).toBeGreaterThanOrEqual(floor - 1e-9);
    }
  });

  it('fade in across the edge: half at the outline, nothing half a fade outside', () => {
    const fade = zonesTuning().fadeUnits;
    const cfg = plain([square('g', 'cold-gale', 0, 0, 100)]);
    const gain = kinds()['cold-gale']!.strength as number;
    const at = (x: number) => windAt(cfg, 0, 1, { x, y: 0 }).speedKn / 10;
    expect(at(0)).toBeCloseTo(gain, 6);
    expect(at(100)).toBeCloseTo(1 + (gain - 1) / 2, 6);
    expect(at(100 + fade / 2 + 1)).toBeCloseTo(1, 6);
    expect(at(100 - fade / 2 - 1)).toBeCloseTo(gain, 6);
    // Smooth: no jumps along the way.
    let last = at(40);
    for (let x = 41; x < 160; x++) {
      const now = at(x);
      expect(Math.abs(now - last)).toBeLessThan(0.02);
      last = now;
    }
  });

  it('a sheltered water lets the wind through along its axis only, either way', () => {
    const lagoon = square('l', 'sheltered', 0, 0, 200, { headingDeg: 90 });
    const k = kinds().sheltered!;
    const along = Math.cos(30 * DEG);
    const east = windAt(plain([lagoon], { fromDeg: 120 }), 0, 1, { x: 0, y: 0 });
    expect(deg(east.from)).toBeCloseTo(120 - 30 * k.pull! * along, 3);
    const west = windAt(plain([lagoon], { fromDeg: 240 }), 0, 1, { x: 0, y: 0 });
    expect(deg(west.from)).toBeCloseTo(240 + 30 * k.pull! * along, 3);
    expect(east.speedKn / 10).toBeCloseTo((k.strength as number) * along, 6);
    // Straight along the axis it blows at the kind's strength.
    const straight = windAt(plain([lagoon], { fromDeg: 270 }), 0, 1, { x: 0, y: 0 });
    expect(deg(straight.from)).toBeCloseTo(270, 6);
    expect(straight.speedKn / 10).toBeCloseTo(k.strength as number, 6);
  });

  it('a sheltered water flips ends in a near calm, never with a sudden swing', () => {
    const lagoon = square('l', 'sheltered', 0, 0, 200, { headingDeg: 90 });
    const k = kinds().sheltered!;
    let last: { x: number; y: number } | null = null;
    // Turn the sea wind slowly through north-ish (straight across the E-W axis) and watch the
    // lagoon's wind as a vector: it must change smoothly.
    for (let f = -40; f <= 40; f += 0.5) {
      const w = windAt(plain([lagoon], { fromDeg: f }), 0, 1, { x: 0, y: 0 });
      const v = { x: Math.sin(w.from) * w.speedKn, y: Math.cos(w.from) * w.speedKn };
      if (last) expect(Math.hypot(v.x - last.x, v.y - last.y)).toBeLessThan(0.25);
      last = v;
    }
    const across = windAt(plain([lagoon], { fromDeg: 0 }), 0, 1, { x: 0, y: 0 });
    expect(across.speedKn / 10).toBeCloseTo((k.strength as number) * k.acrossFloor!, 6);
  });

  it('a zone can override the numbers of its kind', () => {
    const cfg = plain([square('d', 'doldrums', 0, 0, 200, { tune: { strength: 0.5 } })]);
    expect(windAt(cfg, 0, 1, { x: 0, y: 0 }).speedKn).toBeCloseTo(5, 6);
  });

  it('an unknown kind does nothing (the map checks report it)', () => {
    const cfg = plain([square('x', 'no-such-kind', 0, 0, 200)]);
    expect(windAt(cfg, 0, 1, { x: 0, y: 0 }).speedKn).toBeCloseTo(10, 6);
  });

  it('report the zone the boat is in', () => {
    const cfg = plain([square('glass', 'doldrums', 0, 0, 100)]);
    const out = {} as LocalWeather;
    windAt(cfg, 0, 1, { x: 0, y: 0 }, out);
    expect(out.zone).toBe('glass');
    windAt(cfg, 0, 1, { x: 400, y: 0 }, out);
    expect(out.zone).toBeNull();
  });

  it('a stormy coast breeds extra storms inside it, the same ones every time', () => {
    const coast = square('c', 'stormy-coast', 0, 300, 150);
    const field = zoneField([coast])!;
    const storms = DEFAULT_WEATHER.storms!;
    const born = new Map<number, { x: number; y: number }>();
    for (let t = 0; t < 4 * 3600; t += 20)
      for (const s of zoneStormsAt(field, storms, 5, t, 0, 440))
        if (!born.has(s.id)) born.set(s.id, s);
    expect(born.size).toBeGreaterThan(3);
    // Each is first seen near the coast it was born on.
    for (const s of born.values()) expect(Math.hypot(s.x, s.y - 300)).toBeLessThan(150 * 1.5 + 80);
    // Deterministic.
    expect(zoneStormsAt(field, storms, 5, 5000, 0, 440)).toEqual(
      zoneStormsAt(field, storms, 5, 5000, 0, 440),
    );
    // Only storms born after `from` count, as for crossing storms (0072).
    expect(zoneStormsAt(field, storms, 5, 5000, 5000, 440)).toHaveLength(0);
    // Other kinds breed none.
    const calm = zoneField([square('d', 'doldrums', 0, 300, 150)])!;
    for (let t = 0; t < 3600; t += 60)
      expect(zoneStormsAt(calm, storms, 5, t, 0, 440)).toHaveLength(0);
  });

  it('only the zones near the asking point are checked', () => {
    // A sea full of far zones: a lookup at the boat still finds nothing and costs little.
    const many: WindZoneDef[] = [];
    for (let i = 0; i < 400; i++)
      many.push(square(`z${i}`, 'doldrums', 2000 + (i % 20) * 300, (i / 20) * 300, 60));
    const field = zoneField(many)!;
    expect(field.grid.near(0, 0, 0)).toHaveLength(0);
    const e = zoneEffectAt(field, 1, 0, 0, 0, 0);
    expect(e.zone).toBeNull();
    expect(e.strength).toBe(1);
  });

  it('the world sails the zones, and the Settings switch turns them off', () => {
    const map = {
      ...PHASE1_MAP,
      windZones: [square('d', 'doldrums', PHASE1_MAP.start.x, PHASE1_MAP.start.y, 200)],
    };
    const on = createWorld(map, SLOOP);
    const off = createWorld(map, SLOOP);
    off.windZones = false;
    const bare = createWorld(PHASE1_MAP, SLOOP);
    const controls = { steer: 0, sailStep: 0 };
    for (let i = 0; i < 3; i++) {
      stepWorld(on, controls, 0.1);
      stepWorld(off, controls, 0.1);
      stepWorld(bare, controls, 0.1);
    }
    expect(on.seaWind.speedKn).toBeLessThan(off.seaWind.speedKn * 0.45);
    expect(off.seaWind.speedKn).toBeCloseTo(bare.seaWind.speedKn, 6);
    expect(on.weather.zone).toBe('d');
  });

  it('the easiest level is the first one in difficulty.json', () => {
    expect(DIFFICULTIES[0]).toBe('fair');
  });

  it('route and balance checks plan with the zones’ average wind', () => {
    const [a, b] = chartedPorts(PHASE1_MAP);
    const ia = PHASE1_MAP.islands.find((i) => i.id === a!.islandId)!;
    const ib = PHASE1_MAP.islands.find((i) => i.id === b!.islandId)!;
    const mid = { x: (ia.x + ib.x) / 2, y: (ia.y + ib.y) / 2 };
    const calm: MapDef = { ...PHASE1_MAP, windZones: [square('d', 'doldrums', mid.x, mid.y, 60)] };
    const gale: MapDef = { ...PHASE1_MAP, windZones: [square('g', 'cold-gale', mid.x, mid.y, 60)] };
    const plainLeg = legSeconds(PHASE1_MAP, SLOOP, a!.id, b!.id);
    expect(legSeconds(calm, SLOOP, a!.id, b!.id)).toBeGreaterThan(plainLeg * 1.2);
    expect(legSeconds(gale, SLOOP, a!.id, b!.id)).toBeLessThan(plainLeg);

    // The whole sea in the doldrums: every route takes about 1 / 0.325 as long.
    const still: MapDef = { ...PHASE1_MAP, windZones: [square('s', 'doldrums', 0, 0, 3000)] };
    const goal = harbourApproach(PHASE1_MAP, a!);
    const wind = PHASE1_MAP.wind.fromDeg;
    const open = sailRoute(PHASE1_MAP, PHASE1_MAP.start, goal, wind)!;
    const slow = sailRoute(still, PHASE1_MAP.start, goal, wind)!;
    const [lo, hi] = kinds().doldrums!.strength as [number, number];
    expect(slow.seconds / open.seconds).toBeCloseTo(2 / (lo + hi), 1);
    // Two full route searches: about 4 s alone, more on a loaded CI runner.
  }, 30000);
});
