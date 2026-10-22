import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { KNOT_TO_UNITS, OVERPOWERED_KN, drivingWind } from '../src/sim/boat';
import { DEG, bearingVector, wrapAngle } from '../src/sim/math';
import { SLOOP } from '../src/sim/ship';
import { type Storm, STORM_CORE, stormStrength, stormsAt } from '../src/sim/storms';
import {
  DEFAULT_WEATHER,
  type LocalWeather,
  WEATHER_KINDS,
  type WeatherKind,
  weatherSlot,
  steadyWeather,
  windAt,
  withoutStorms,
} from '../src/sim/wind';
import {
  HEAVY_HEEL,
  HEAVY_SECONDS,
  type World,
  type WorldEvent,
  createWorld,
  holdStorms,
  stepHeel,
  stepWorld,
} from '../src/sim/world';
import type { MapDef } from '../src/sim/map';
import { Tutorial } from '../src/sim/tutorial';

const STORMS = DEFAULT_WEATHER.storms!;
const seed = PHASE1_MAP.seed;

/** First storm of a seed, at the moment it is strongest near the middle of its track. */
function firstStorm(s = seed): { t: number; storm: Storm } {
  for (let t = 0; t < 3600; t += 5) {
    const storms = stormsAt(STORMS, s, t);
    const storm = storms.find((x) => x.intensity > 0.75 && Math.hypot(x.x, x.y) < 300);
    if (storm) return { t, storm };
  }
  throw new Error('no storm in the first hour');
}

describe('weather states (0067)', () => {
  it('cycles through calm, breeze, rain and gale, with breeze the most common', () => {
    const counts: Record<WeatherKind, number> = { calm: 0, breeze: 0, rain: 0, gale: 0 };
    for (let slot = 0; slot < 400; slot++) counts[weatherSlot(DEFAULT_WEATHER, seed, slot).kind]++;
    for (const k of WEATHER_KINDS) expect(counts[k]).toBeGreaterThan(20);
    expect(counts.breeze).toBe(Math.max(...Object.values(counts)));
  });

  it('makes a calm light and a gale strong', () => {
    const k = DEFAULT_WEATHER.kinds!;
    expect(PHASE1_MAP.wind.speedKn * k.calm.strength[1]).toBeLessThan(8);
    expect(PHASE1_MAP.wind.speedKn * k.gale.strength[0]).toBeGreaterThan(18);
    expect(k.rain.rain).toBeGreaterThan(0.5);
  });

  it('starts a new voyage in a dry breeze', () => {
    const out = {} as LocalWeather;
    windAt(PHASE1_MAP.wind, 0, seed, PHASE1_MAP.start, out);
    expect(out).toMatchObject({ kind: 'breeze', rain: 0, storm: 0 });
  });
});

describe('moving storms (0067)', () => {
  it('are reproducible and come along within the first quarter hour', () => {
    expect(stormsAt(STORMS, seed, 1234)).toEqual(stormsAt(STORMS, seed, 1234));
    for (const s of [1, 7, 42, 99]) {
      let seen = false;
      for (let t = 0; t < 900 && !seen; t += 10) seen = stormsAt(STORMS, s, t).length > 0;
      expect(seen).toBe(true);
    }
  });

  it('cross the sea slower than a sloop, from the edge through the middle', () => {
    const { t, storm } = firstStorm();
    const later = stormsAt(STORMS, seed, t + 10).find((s) => s.id === storm.id)!;
    const speed = Math.hypot(later.x - storm.x, later.y - storm.y) / 10;
    expect(speed).toBeCloseTo(STORMS.speed, 5);
    // Half the speed of a sloop at 8 knots, so a captain can get out of the way.
    expect(speed).toBeLessThanOrEqual(8 * KNOT_TO_UNITS * 0.5);
    // Born outside the sea, faint at first.
    let start = t;
    while (stormsAt(STORMS, seed, start - 1).some((s) => s.id === storm.id)) start--;
    const born = stormsAt(STORMS, seed, start).find((s) => s.id === storm.id)!;
    expect(Math.hypot(born.x, born.y)).toBeGreaterThan(STORMS.areaRadius);
    expect(born.intensity).toBeLessThan(0.05);
  });

  it('blow much harder in the core and circle anticlockwise round the centre', () => {
    const { t, storm } = firstStorm();
    const core = storm.radius * STORM_CORE * 0.8;
    expect(stormStrength(storm, storm.x + core, storm.y)).toBeCloseTo(storm.intensity, 5);
    expect(stormStrength(storm, storm.x + storm.radius * 1.01, storm.y)).toBe(0);
    const out = {} as LocalWeather;
    const outside = windAt(PHASE1_MAP.wind, t, seed, { x: storm.x + 2 * storm.radius, y: storm.y });
    // North of the centre an anticlockwise storm blows toward the west, so it comes from the east.
    const north = windAt(PHASE1_MAP.wind, t, seed, { x: storm.x, y: storm.y + core }, out);
    expect(out.storm).toBeGreaterThan(0.75);
    expect(out.rain).toBeGreaterThan(0.75);
    expect(north.speedKn).toBeGreaterThan(outside.speedKn * 1.4);
    expect(Math.abs(wrapAngle(north.from - 90 * DEG)) / DEG).toBeLessThan(35);
    const south = windAt(PHASE1_MAP.wind, t, seed, { x: storm.x, y: storm.y - core });
    expect(Math.abs(wrapAngle(south.from - 270 * DEG)) / DEG).toBeLessThan(35);
  });

  it('spill the excess wind instead of doubling the boat speed', () => {
    expect(drivingWind(14)).toBe(14);
    expect(drivingWind(OVERPOWERED_KN)).toBe(OVERPOWERED_KN);
    expect(drivingWind(33)).toBe(OVERPOWERED_KN + 3);
  });
});

describe('storms switched off (0067)', () => {
  it('leaves the sea without storms but keeps the rest of the weather', () => {
    const { t, storm } = firstStorm();
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.storms = false;
    world.time = t;
    world.boat.x = storm.x;
    world.boat.y = storm.y;
    const events = stepWorld(world, { steer: 0, sailStep: 0 }, 0.1);
    expect(world.weather.storms).toHaveLength(0);
    expect(world.weather.storm).toBe(0);
    expect(events.some((e) => e.type === 'storm-near')).toBe(false);
    const on = windAt(PHASE1_MAP.wind, t, seed, world.boat);
    // Same weather walk either way: only the storm's own push differs.
    const off = windAt({ ...PHASE1_MAP.wind, weather: withoutStorms(DEFAULT_WEATHER) }, t, seed, {
      x: storm.x + 3 * storm.radius,
      y: storm.y,
    });
    const far = windAt(PHASE1_MAP.wind, t, seed, { x: storm.x + 3 * storm.radius, y: storm.y });
    expect(off).toEqual(far);
    expect(on.speedKn).toBeGreaterThan(off.speedKn);
  });
});

describe('weather switched off (0067)', () => {
  it('blows a steady breeze with no rain or storms, but the wind still turns', () => {
    const steady = { ...PHASE1_MAP.wind, weather: steadyWeather(DEFAULT_WEATHER) };
    const out: LocalWeather = { kind: 'breeze', rain: 0, showers: 0, storm: 0, storms: [] };
    const [lo, hi] = DEFAULT_WEATHER.strength;
    let minFrom = Infinity,
      maxFrom = -Infinity;
    for (let t = 0; t < 3600; t += 20) {
      const wind = windAt(steady, t, seed, { x: 0, y: 0 }, out);
      expect(out.kind).toBe('breeze');
      expect(out.rain).toBe(0);
      expect(out.storms).toHaveLength(0);
      // Regions bend the strength by up to ±15 % on top of the breeze range.
      expect(wind.speedKn).toBeGreaterThanOrEqual(PHASE1_MAP.wind.speedKn * lo * 0.84);
      expect(wind.speedKn).toBeLessThanOrEqual(PHASE1_MAP.wind.speedKn * hi * 1.16);
      const from = wrapAngle(wind.from - PHASE1_MAP.wind.fromDeg * DEG);
      minFrom = Math.min(minFrom, from);
      maxFrom = Math.max(maxFrom, from);
    }
    expect(maxFrom - minFrom).toBeGreaterThan(90 * DEG);
  });

  it('is what the world sails in when the switch is off', () => {
    const { t, storm } = firstStorm();
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.dynamicWeather = false;
    world.time = t;
    world.boat.x = storm.x;
    world.boat.y = storm.y;
    stepWorld(world, { steer: 0, sailStep: 0 }, 0.1);
    expect(world.weather.kind).toBe('breeze');
    expect(world.weather.storms).toHaveLength(0);
  });
});

describe('storms held back (0072)', () => {
  const memory = () => {
    const values = new Map<string, string>();
    return {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
      removeItem: (k: string) => void values.delete(k),
    };
  };
  const still = { steer: 0, sailStep: 0 };

  it('blows no storm while held, and the one under way does not pop up when let go', () => {
    const { t, storm } = firstStorm();
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.boat.x = storm.x;
    world.boat.y = storm.y;
    world.time = t - 0.1;
    holdStorms(world, 'event', true);
    holdStorms(world, 'event', true);
    expect(world.stormHolds).toEqual(['event']);
    const held = stepWorld(world, still, 0.1);
    expect(world.weather.storms).toHaveLength(0);
    expect(held.some((e) => e.type === 'storm-near')).toBe(false);
    // Let go right in the storm's path: it stays away until it has crossed the sea.
    holdStorms(world, 'event', false);
    stepWorld(world, still, 0.1);
    expect(world.weather.storms).toHaveLength(0);
    expect(world.weather.storm).toBe(0);
    // The next storm forms at the edge as usual.
    let next = false;
    for (let k = 0; k < 2 * STORMS.everySec && !next; k++) {
      world.time += 1;
      stepWorld(world, still, 0.01);
      next = world.weather.storms.length > 0;
    }
    expect(next).toBe(true);
  });

  it('holds storms through the tutorial, whatever the Settings say', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const tutorial = new Tutorial(world, {}, memory());
    tutorial.start();
    tutorial.observe();
    expect(world.stormHolds).toContain('tutorial');
    const { t } = firstStorm();
    world.time = t;
    stepWorld(world, still, 0.1);
    expect(world.weather.storms).toHaveLength(0);
    tutorial.skip();
    tutorial.observe();
    expect(world.stormHolds).not.toContain('tutorial');
  });
});

describe('storm warnings (0067)', () => {
  function worldInStorm() {
    const { t, storm } = firstStorm();
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.time = t;
    // Point her downwind-ish near the storm centre with sails down, so she stays in the core.
    world.boat.x = storm.x + 5;
    world.boat.y = storm.y;
    world.boat.heading = Math.atan2(storm.dx, storm.dy);
    return { world, storm };
  }

  it('warns once when a storm comes near', () => {
    const { world, storm } = worldInStorm();
    const v = bearingVector(Math.atan2(storm.dx, storm.dy) + Math.PI);
    world.boat.x = storm.x + v.x * (storm.radius + 100);
    world.boat.y = storm.y + v.y * (storm.radius + 100);
    const first = stepWorld(world, { steer: 0, sailStep: 0 }, 0.1);
    expect(first.filter((e) => e.type === 'storm-near')).toHaveLength(1);
    const again = stepWorld(world, { steer: 0, sailStep: 0 }, 0.1);
    expect(again.some((e) => e.type === 'storm-near')).toBe(false);
  });
});

describe('cargo overboard when she heels too hard (0067)', () => {
  /** Beam reach in a steady wind of `kn` knots for `seconds`, kept in open water. */
  function sail(kn: number, sailStep: number, seconds: number, setup?: (w: World) => void) {
    const map: MapDef = {
      ...PHASE1_MAP,
      wind: { fromDeg: 0, speedKn: kn, gustiness: 0, shiftDeg: 0 },
    };
    const world = createWorld(map, SLOOP);
    world.trade.captain.cargo.timber = 6;
    world.trade.captain.cargo.fish = 4;
    const lost: WorldEvent[] = [];
    for (let t = 0; t < seconds; t += 1 / 30) {
      world.boat.x = 0;
      world.boat.y = 400 - 30;
      world.boat.heading = Math.PI / 2;
      setup?.(world);
      lost.push(
        ...stepWorld(world, { steer: 0, sailStep }, 1 / 30).filter((e) => e.type === 'overboard'),
      );
    }
    return { world, lost };
  }

  it('never loses cargo in a normal breeze under full sail', () => {
    expect(sail(14, 2, 60).lost).toHaveLength(0);
    expect(sail(17, 2, 60).lost).toHaveLength(0);
  });

  it('keeps the cargo through gusts and tacks in the real breeze', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.captain.cargo.timber = 6;
    let lost = 0;
    // Five minutes of the opening breeze (before the first storm), tacking every 20 s.
    for (let t = 0; t < 280; t += 1 / 30) {
      world.boat.x = 0;
      world.boat.y = 370;
      const steer = Math.floor(t / 20) % 2 === 0 ? 0 : t % 20 < 3 ? 1 : 0;
      lost += stepWorld(world, { steer, sailStep: 2 }, 1 / 30).filter(
        (e) => e.type === 'overboard',
      ).length;
    }
    expect(lost).toBe(0);
  });

  it('throws cargo over the side under full sail in a gale', () => {
    const { world, lost } = sail(24, 2, 30);
    expect(Math.abs(world.heel.angle)).toBeGreaterThan(HEAVY_HEEL);
    expect(lost.length).toBeGreaterThanOrEqual(5);
    // The good she carries most of goes first.
    expect(lost[0]).toMatchObject({ type: 'overboard', good: 'timber', qty: 1 });
  });

  it('keeps the cargo when the sails are eased', () => {
    expect(sail(24, 1, 60).lost).toHaveLength(0);
  });

  it('loses nothing alongside', () => {
    const { world } = sail(24, 2, 5);
    world.trade.dockedAt = PHASE1_MAP.homePort!;
    world.overHeel = HEAVY_SECONDS * 0.9;
    for (let i = 0; i < 300; i++) expect(stepHeel(world, 1 / 30)).toHaveLength(0);
  });
});
