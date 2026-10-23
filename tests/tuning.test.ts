import { afterEach, describe, expect, it } from 'vitest';
import { SHIPPED_TUNING, TUNING, resetTuning } from '../src/data/tuning';
import { TUNING_META, metaPath } from '../src/data/tuning-meta';
import { DEG } from '../src/sim/math';
import {
  GOODS,
  GOOD_DEFS,
  GOOD_ICONS,
  MADE_FROM,
  RARE_GOODS,
  RAW_GOODS,
  SPECIALTY_GOODS,
} from '../src/sim/goods';
import { SHIP_CLASSES, SHIP_IDS, SLOOP, noGoAngle, polarFraction, turnRate } from '../src/sim/ship';
import { DIFFICULTIES, DIFFICULTY } from '../src/sim/difficulty';
import { DEFAULT_WEATHER, WEATHER_KINDS } from '../src/sim/wind';
import { MAX_UPGRADE_LEVEL, UPGRADE_EFFECTS } from '../src/sim/upgrades';
import { MAX_SETTLEMENT_LEVEL } from '../src/sim/settlement';
import { WIND_FORCES, windForce } from '../src/sim/windStrength';
import { midPrice, stepMarket, type Market } from '../src/sim/market';
import { daylightAt } from '../src/sim/daylight';
import { emptyAmounts } from '../src/sim/goods';

/*
 * Tuning lives in src/data/tuning/*.json (decisions 0093 and 0094). These tests check the files
 * have exactly the ids the code knows, that every value has a meta entry and sits in its range,
 * and that the sim reads the values live.
 */

afterEach(() => resetTuning());

type Leaf = { path: string[]; value: unknown };

function leaves(v: unknown, path: string[] = []): Leaf[] {
  if (typeof v === 'object' && v !== null && !Array.isArray(v))
    return Object.entries(v).flatMap(([k, x]) => leaves(x, [...path, k]));
  return [{ path, value: v }];
}

const numbersIn = (v: unknown): number[] =>
  Array.isArray(v) ? v.flatMap(numbersIn) : typeof v === 'number' ? [v] : [];

describe('tuning files', () => {
  it('have exactly the ids the code knows', () => {
    expect(Object.keys(TUNING.ships)).toEqual([...SHIP_IDS]);
    for (const [id, ship] of Object.entries(TUNING.ships)) expect(ship.id).toBe(id);
    expect(Object.keys(TUNING.goods)).toEqual([...GOODS]);
    for (const [id, good] of Object.entries(TUNING.goods)) expect(good.id).toBe(id);
    for (const g of GOODS) {
      const from = TUNING.goods[g]!.madeFrom;
      if ((SPECIALTY_GOODS as readonly string[]).includes(g))
        expect(RAW_GOODS as readonly string[]).toContain(from);
      else expect(from).toBeUndefined();
    }
    expect(Object.keys(TUNING.difficulty.levels)).toEqual([...DIFFICULTIES]);
    expect(Object.keys(TUNING.weather.default.kinds!).sort()).toEqual([...WEATHER_KINDS].sort());
    const levels = (n: number) => Array.from({ length: n - 1 }, (_, i) => String(i + 2));
    expect(Object.keys(TUNING.economy.towns.growthToLevel)).toEqual(levels(MAX_SETTLEMENT_LEVEL));
    expect(Object.keys(TUNING.upgrades.homePortLevel)).toEqual(levels(MAX_UPGRADE_LEVEL));
    for (const table of Object.values(TUNING.upgrades.effects))
      expect(table).toHaveLength(MAX_UPGRADE_LEVEL);
    for (const ship of Object.values(TUNING.ships))
      expect(ship.upgradePrices).toHaveLength(MAX_UPGRADE_LEVEL - 1);
    const { wantsEquilibrium, producesEquilibrium, orderScale } = TUNING.economy.towns;
    for (const table of [wantsEquilibrium, producesEquilibrium, orderScale])
      expect(table).toHaveLength(MAX_SETTLEMENT_LEVEL);
    expect(TUNING.weather.force.thresholdsKn).toHaveLength(WIND_FORCES.length - 1);
  });

  it('give every value a meta entry, inside its range and on its step', () => {
    const used = new Set<string>();
    for (const { path, value } of leaves(TUNING)) {
      const key = metaPath(path);
      const meta = TUNING_META[key];
      expect(meta, `meta for ${key}`).toBeDefined();
      used.add(key);
      if (meta!.kind === 'number') {
        const values = numbersIn(value);
        expect(values.length, `${path.join('.')} is a number`).toBeGreaterThan(0);
        for (const n of values) {
          expect(n, `${path.join('.')} ≥ min`).toBeGreaterThanOrEqual(meta!.min);
          expect(n, `${path.join('.')} ≤ max`).toBeLessThanOrEqual(meta!.max);
          const steps = n / meta!.step;
          expect(Math.abs(steps - Math.round(steps)), `${path.join('.')} on step`).toBeLessThan(
            1e-6,
          );
        }
      } else if (meta!.kind === 'toggle') expect(typeof value).toBe('boolean');
      else if (meta!.kind === 'text') expect(typeof value).toBe('string');
    }
    // No meta left over from a value that was removed.
    expect(Object.keys(TUNING_META).filter((k) => !used.has(k))).toEqual([]);
  });

  it('keep every polar sorted from head to wind to dead downwind', () => {
    for (const ship of Object.values(TUNING.ships)) {
      const angles = ship.polar.map(([a]) => a);
      expect(angles[0]).toBe(0);
      expect(angles[angles.length - 1]).toBe(180);
      expect([...angles].sort((a, b) => a - b)).toEqual(angles);
      for (const [, f] of ship.polar) expect(f).toBeGreaterThanOrEqual(0);
      for (const [, f] of ship.polar) expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('start live values equal to the shipped files', () => {
    expect(TUNING).toEqual(SHIPPED_TUNING);
    expect(TUNING).not.toBe(SHIPPED_TUNING);
  });
});

describe('live tuning', () => {
  it('reaches the sim without a reload', () => {
    const market: Market = { portId: 'p', stock: emptyAmounts(), equilibrium: emptyAmounts() };
    market.equilibrium.fish = 100;
    stepMarket(market, 10);
    const shipped = market.stock.fish;
    market.stock.fish = 0;
    TUNING.economy.market.recoverySeconds = 10;
    stepMarket(market, 10);
    expect(market.stock.fish).toBeGreaterThan(shipped);

    const before = midPrice('fish', 30);
    TUNING.goods.fish!.basePrice *= 2;
    expect(midPrice('fish', 30)).toBeCloseTo(before * 2, 9);

    expect(polarFraction(SLOOP, 50 * DEG)).toBeGreaterThan(0);
    TUNING.ships.sloop!.noGoDeg = 55;
    expect(polarFraction(SLOOP, 50 * DEG)).toBe(0);

    TUNING.weather.force.thresholdsKn[0] = 9;
    expect(windForce(8)).toBe(0);

    expect(daylightAt(300).night).toBe(0);
    TUNING.weather.daylight.dayEnd = 200;
    TUNING.weather.daylight.duskEnd = 250;
    expect(daylightAt(300).night).toBe(1);
  });

  it('resets in place, so references into it stay valid', () => {
    TUNING.ships.sloop!.hold = 99;
    TUNING.weather.force.thresholdsKn.push(30);
    TUNING.difficulty.levels.captain!.startGold = 1;
    resetTuning();
    expect(TUNING).toEqual(SHIPPED_TUNING);
    expect(SLOOP).toBe(TUNING.ships.sloop);
    expect(SLOOP.hold).toBe(10);
    expect(SHIP_CLASSES).toBe(TUNING.ships);
    expect(GOOD_DEFS).toBe(TUNING.goods);
    expect(DIFFICULTY).toBe(TUNING.difficulty.levels);
    expect(DEFAULT_WEATHER).toBe(TUNING.weather.default);
    expect(UPGRADE_EFFECTS).toBe(TUNING.upgrades.effects);
  });
});

/*
 * Decision 0094 moved these values out of TypeScript constants without changing any of them. Each
 * line is the constant as it was on main before the move (v0.3.0) and where it lives now. This
 * pins the move only: when a value is changed on purpose later, delete this block rather than
 * editing it (the balance tests are the safety net from then on).
 */
describe('moved values equal the old constants (decision 0094)', () => {
  const t = TUNING;
  const captain = t.difficulty.levels.captain!;
  const scalars: [oldName: string, now: unknown, old: unknown][] = [
    // boat.ts
    ['KNOT_TO_UNITS', t.seamanship.boat.knotToUnits, 1.6],
    ['OVERPOWERED_KN', t.seamanship.boat.overpoweredKn, 21],
    ['REFERENCE_BREEZE_KN', t.seamanship.boat.referenceBreezeKn, 14],
    // contracts.ts
    ['CONTRACT_QTY', t.economy.orders.qty, [4, 8]],
    ['CONTRACT_HOLD_SHARE', t.economy.orders.holdShare, 0.6],
    ['CONTRACT_PRICE_FACTOR (= Captain orderFactor)', captain.orderFactor, 1.5],
    ['CONTRACT_DISTANCE_SCALE', t.economy.orders.distanceScale, 700],
    ['CONTRACT_COOLDOWN', t.economy.orders.cooldown, 90],
    ['HELP_REWARD_FACTOR', t.economy.orders.helpRewardFactor, 1.5],
    ['HELP_GROWTH_FACTOR', t.economy.orders.helpGrowthFactor, 2],
    ['HELP_COOLDOWN', t.economy.orders.helpCooldown, 240],
    // daylight.ts
    ['DAY_SECONDS', t.weather.daylight.daySeconds, 720],
    ['DAY_END', t.weather.daylight.dayEnd, 420],
    ['DUSK_END', t.weather.daylight.duskEnd, 480],
    ['NIGHT_END', t.weather.daylight.nightEnd, 660],
    // difficulty.ts
    ['STEADY_STEP_DEG', t.difficulty.steadyWind.stepDeg, 10],
    ['STEADY_REVERT', t.difficulty.steadyWind.revert, 0.5],
    ['STEADY_REGION_BEND_DEG', t.difficulty.steadyWind.regionBendDeg, 10],
    ['STEADY_REGION_STRENGTH', t.difficulty.steadyWind.regionStrength, 0.08],
    ['STEADY_GUSTS', t.difficulty.steadyWind.gusts, 0.75],
    // hazards.ts
    ['SHALLOW_WIDTH', t.seamanship.hazards.shallowWidth, 14],
    ['SHALLOW_DRAG', t.seamanship.hazards.shallowDrag, 0.6],
    ['STRIKE_DAMAGE', t.seamanship.hazards.strikeDamage, 6],
    ['CRASH_SAFE_KN', t.seamanship.hazards.crashSafeKn, 2],
    ['CRASH_DAMAGE', t.seamanship.hazards.crashDamage, 5],
    ['LEAK_PENALTY', t.seamanship.hazards.leakPenalty, 0.25],
    ['REPAIR_COST (= Captain repairCost)', captain.repairCost, 2],
    // market.ts
    ['REFERENCE_STOCK', t.economy.market.referenceStock, 30],
    [
      'EQUILIBRIUM',
      t.economy.market.equilibrium,
      { produces: 100, wants: 12, neutral: 30, none: 0 },
    ],
    ['PRICE_ELASTICITY', t.economy.market.elasticity, 0.8],
    ['PRICE_FLOOR', t.economy.market.floor, 0.35],
    ['PRICE_CEILING', t.economy.market.ceiling, 3],
    ['SPREAD (= Captain spread)', captain.spread, 0.06],
    ['RECOVERY_SECONDS', t.economy.market.recoverySeconds, 75],
    // settlement.ts
    ['GROWTH_TO_LEVEL', t.economy.towns.growthToLevel, { 2: 40, 3: 150, 4: 350 }],
    ['ORDER_GROWTH_BONUS', t.economy.towns.orderGrowthBonus, 5],
    ['STALL_SECONDS', t.economy.towns.stallSeconds, 180],
    ['STALL_DECAY_PER_MINUTE', t.economy.towns.stallDecayPerMinute, 2],
    ['WANTS_EQUILIBRIUM', t.economy.towns.wantsEquilibrium, [15, 12, 10, 8]],
    ['PRODUCES_EQUILIBRIUM', t.economy.towns.producesEquilibrium, [85, 100, 115, 130]],
    ['SPECIALTY_SHARE', t.economy.towns.specialtyShare, 0.4],
    ['RARE_SHARE', t.economy.towns.rareShare, 0.7],
    ['RARE_FOR_PORT_TOWN', t.economy.towns.rareForPortTown, 20],
    ['ORDER_SCALE', t.economy.towns.orderScale, [0.8, 1, 1.25, 1.5]],
    ['UPGRADE_NEEDS_LEVEL', t.upgrades.homePortLevel, { 2: 2, 3: 3 }],
    // shipyards.ts
    ['DISCOVER_RANGE', t.economy.discoverRange, 90],
    // storms.ts
    ['STORM_CORE', t.weather.storms.coreShare, 0.35],
    ['STORM_RAMP', t.weather.storms.rampSec, 60],
    ['INFLOW (deg)', t.weather.storms.inflowDeg, 20],
    // trade.ts
    ['START_GOLD (= Captain startGold)', captain.startGold, 150],
    ['DOCK_RANGE', t.seamanship.harbour.dockRange, 16],
    ['DOCK_SPEED_KN', t.seamanship.harbour.dockSpeedKn, 1.5],
    ['UNDOCK_MARGIN', t.seamanship.harbour.undockMargin, 6],
    // wind.ts
    ['STORM_GAIN', t.weather.storms.windGain, 0.9],
    ['SHADOW_LENGTH', t.weather.islands.shadowLength, 70],
    ['SHADOW_DEPTH', t.weather.islands.shadowDepth, 0.55],
    ['SHADOW_SPREAD (deg)', t.weather.islands.shadowSpreadDeg, 10],
    ['FUNNEL_GAIN', t.weather.islands.funnelGain, 0.2],
    ['FUNNEL_REACH', t.weather.islands.funnelReach, 28],
    // windStrength.ts
    ['FORCE_THRESHOLDS_KN', t.weather.force.thresholdsKn, [7, 11, 15, 19]],
    ['FORCE_HYSTERESIS_KN', t.weather.force.hysteresisKn, 0.6],
    ['GUST_HOLD', t.weather.force.gustHoldSec, 1.6],
    ['GUST_JUMP_KN', t.weather.force.gustJumpKn, 1.4],
    ['AVERAGE_TAU', t.weather.force.averageSec, 5],
    // world.ts
    ['WAYPOINT_RADIUS', t.seamanship.harbour.waypointRadius, 12],
    ['HARBOUR_BRAKE', t.seamanship.harbour.brake, 1.6],
    ['MOOR_MAX_KN', t.seamanship.harbour.moorMaxKn, 3],
    ['MOORED_KN', t.seamanship.harbour.mooredKn, 0.2],
    ['STORM_WARNING', t.weather.storms.warningRange, 140],
    ['OVERPRESSED_KN', t.seamanship.cargo.overpressedKn, 19.5],
    ['HEAVY_SECONDS', t.seamanship.cargo.heavySeconds, 3],
    ['LURCH_GUST_KN', t.seamanship.cargo.lurchGustKn, 4],
    ['LURCH_PRESS_KN', t.seamanship.cargo.lurchPressKn, 18],
    ['LURCH_COOLDOWN', t.seamanship.cargo.lurchCooldown, 3],
    ['PRESS_AVERAGE_SEC', t.seamanship.cargo.pressAverageSec, 4],
    ['PRESS_HYSTERESIS_KN', t.seamanship.cargo.pressHysteresisKn, 0.6],
    ['WIND_BLEND_SEC', t.weather.blendSec, 60],
  ];

  it.each(scalars)('%s', (_name, now, old) => expect(now).toEqual(old));

  it('ship classes (ship.ts), angles back in radians', () => {
    const asOld = Object.fromEntries(
      Object.entries(SHIP_CLASSES).map(([id, ship]) => {
        const old: Record<string, unknown> = { ...ship };
        delete old.noGoDeg;
        delete old.turnRateDeg;
        return [id, { ...old, noGoAngle: noGoAngle(ship), turnRate: turnRate(ship) }];
      }),
    );
    expect(asOld).toEqual(OLD_SHIP_CLASSES);
  });

  it('upgrades, goods, difficulty levels and the Phase 2 weather', () => {
    expect(UPGRADE_EFFECTS).toEqual(OLD_UPGRADE_EFFECTS);
    // Decision 0108 added `kind` to goods and `name` and `gloom` to weather kinds: same values,
    // the old lists and the gale's grey sky now come from the files.
    expect([RAW_GOODS, SPECIALTY_GOODS, RARE_GOODS]).toEqual([
      ['fish', 'grain', 'timber', 'stone'],
      ['smokedFish', 'bread', 'planks', 'cutStone'],
      ['honey', 'lampOil'],
    ]);
    expect(WEATHER_KINDS).toEqual(['calm', 'breeze', 'rain', 'gale']);
    expect(
      Object.fromEntries(Object.entries(DEFAULT_WEATHER.kinds!).map(([id, k]) => [id, k.gloom])),
    ).toEqual({ calm: 0, breeze: 0, rain: 0, gale: 0.25 });
    const without = <T extends object>(o: T, ...keys: string[]) =>
      Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
    const goodDefs = Object.fromEntries(
      Object.entries(GOOD_DEFS).map(([id, def]) => [id, without(def, 'kind')]),
    );
    const weather = {
      ...DEFAULT_WEATHER,
      kinds: Object.fromEntries(
        Object.entries(DEFAULT_WEATHER.kinds!).map(([id, k]) => [id, without(k, 'name', 'gloom')]),
      ),
    };
    expect(goodDefs).toEqual(
      Object.fromEntries(
        Object.entries(OLD_GOOD_DEFS).map(([id, def]) => [
          id,
          {
            ...def,
            icon: OLD_GOOD_ICONS[id as keyof typeof OLD_GOOD_ICONS],
            ...(id in OLD_MADE_FROM
              ? { madeFrom: OLD_MADE_FROM[id as keyof typeof OLD_MADE_FROM] }
              : {}),
          },
        ]),
      ),
    );
    expect(GOOD_ICONS).toEqual(OLD_GOOD_ICONS);
    expect(MADE_FROM).toEqual(OLD_MADE_FROM);
    // Decision 0111 added each level's name and card look; the knobs are the same.
    expect(
      Object.fromEntries(
        Object.entries(DIFFICULTY).map(([id, l]) => [
          id,
          without(l, 'name', 'tag', 'color', 'waves'),
        ]),
      ),
    ).toEqual(OLD_DIFFICULTY);
    expect(weather).toEqual(OLD_DEFAULT_WEATHER);
  });
});

const OLD_MADE_FROM = { smokedFish: 'fish', bread: 'grain', planks: 'timber', cutStone: 'stone' };
const OLD_SHIP_CLASSES = {
  sloop: {
    id: 'sloop',
    name: 'Sloop',
    line: 'starter',
    tier: 0,
    standing: 0,
    noGoAngle: 45 * DEG,
    polar: [
      [0, 0],
      [45, 0.42],
      [55, 0.68],
      [70, 0.88],
      [95, 1],
      [125, 0.93],
      [155, 0.8],
      [180, 0.7],
    ],
    speedRatio: 0.62,
    accel: 0.55,
    decel: 0.3,
    ironsDecel: 0.9,
    turnRate: 62 * DEG,
    minSteerage: 0.4,
    steerageSpeedKn: 4,
    turnDrag: 0.18,
    leeway: 0.045,
    radius: 4.5,
    draft: 0.7,
    hold: 10,
    price: 0,
    upgradePrices: [300, 900],
  },
  cutter: {
    id: 'cutter',
    name: 'Cutter',
    line: 'swift',
    tier: 1,
    standing: 0,
    noGoAngle: 40 * DEG,
    polar: [
      [0, 0],
      [40, 0.45],
      [50, 0.72],
      [65, 0.9],
      [95, 1],
      [125, 0.92],
      [155, 0.78],
      [180, 0.68],
    ],
    speedRatio: 0.66,
    accel: 0.5,
    decel: 0.28,
    ironsDecel: 0.9,
    turnRate: 56 * DEG,
    minSteerage: 0.4,
    steerageSpeedKn: 4.5,
    turnDrag: 0.18,
    leeway: 0.04,
    radius: 5,
    draft: 1,
    hold: 16,
    price: 1500,
    upgradePrices: [500, 1800],
  },
  schooner: {
    id: 'schooner',
    name: 'Schooner',
    line: 'swift',
    tier: 2,
    standing: 3,
    noGoAngle: 38 * DEG,
    polar: [
      [0, 0],
      [38, 0.45],
      [48, 0.72],
      [62, 0.92],
      [95, 1],
      [125, 0.92],
      [155, 0.76],
      [180, 0.66],
    ],
    speedRatio: 0.775,
    accel: 0.5,
    decel: 0.26,
    ironsDecel: 0.85,
    turnRate: 68 * DEG,
    minSteerage: 0.38,
    steerageSpeedKn: 5,
    turnDrag: 0.17,
    leeway: 0.038,
    radius: 6.5,
    draft: 1.1,
    hold: 30,
    price: 5000,
    upgradePrices: [1500, 4500],
  },
  clipper: {
    id: 'clipper',
    name: 'Clipper',
    line: 'swift',
    tier: 3,
    standing: 6,
    noGoAngle: 40 * DEG,
    polar: [
      [0, 0],
      [40, 0.47],
      [50, 0.74],
      [65, 0.93],
      [100, 1],
      [130, 0.95],
      [160, 0.82],
      [180, 0.72],
    ],
    speedRatio: 0.9,
    accel: 0.46,
    decel: 0.24,
    ironsDecel: 0.85,
    turnRate: 65 * DEG,
    minSteerage: 0.35,
    steerageSpeedKn: 5.5,
    turnDrag: 0.16,
    leeway: 0.035,
    radius: 7,
    draft: 1.2,
    hold: 50,
    price: 20000,
    upgradePrices: [5000, 15000],
  },
  hoy: {
    id: 'hoy',
    name: 'Hoy',
    line: 'hauler',
    tier: 1,
    standing: 1,
    noGoAngle: 50 * DEG,
    polar: [
      [0, 0],
      [50, 0.38],
      [60, 0.62],
      [75, 0.85],
      [100, 1],
      [130, 0.95],
      [160, 0.82],
      [180, 0.74],
    ],
    speedRatio: 0.53,
    accel: 0.42,
    decel: 0.26,
    ironsDecel: 1,
    turnRate: 53 * DEG,
    minSteerage: 0.35,
    steerageSpeedKn: 4.5,
    turnDrag: 0.2,
    leeway: 0.05,
    radius: 5.2,
    draft: 1.2,
    hold: 25,
    price: 1800,
    upgradePrices: [700, 2100],
  },
  fluyt: {
    id: 'fluyt',
    name: 'Fluyt',
    line: 'hauler',
    tier: 2,
    standing: 3,
    noGoAngle: 55 * DEG,
    polar: [
      [0, 0],
      [55, 0.35],
      [65, 0.6],
      [80, 0.82],
      [105, 0.95],
      [135, 1],
      [160, 0.97],
      [180, 0.9],
    ],
    speedRatio: 0.5,
    accel: 0.34,
    decel: 0.2,
    ironsDecel: 1.1,
    turnRate: 46 * DEG,
    minSteerage: 0.3,
    steerageSpeedKn: 5,
    turnDrag: 0.22,
    leeway: 0.055,
    radius: 8.5,
    draft: 1.5,
    hold: 60,
    price: 7000,
    upgradePrices: [2000, 6000],
  },
  indiaman: {
    id: 'indiaman',
    name: 'Indiaman',
    line: 'hauler',
    tier: 3,
    standing: 6,
    noGoAngle: 55 * DEG,
    polar: [
      [0, 0],
      [55, 0.35],
      [65, 0.6],
      [80, 0.82],
      [105, 0.95],
      [135, 1],
      [160, 0.97],
      [180, 0.9],
    ],
    speedRatio: 0.53,
    accel: 0.3,
    decel: 0.18,
    ironsDecel: 1.1,
    turnRate: 43 * DEG,
    minSteerage: 0.3,
    steerageSpeedKn: 5.5,
    turnDrag: 0.22,
    leeway: 0.05,
    radius: 9.5,
    draft: 1.8,
    hold: 120,
    price: 25000,
    upgradePrices: [6000, 18000],
  },
};
const OLD_GOOD_DEFS = {
  fish: { id: 'fish', name: 'Fish', basePrice: 8 },
  grain: { id: 'grain', name: 'Grain', basePrice: 10 },
  timber: { id: 'timber', name: 'Timber', basePrice: 14 },
  stone: { id: 'stone', name: 'Stone', basePrice: 18 },
  smokedFish: { id: 'smokedFish', name: 'Smoked fish', basePrice: 20 },
  bread: { id: 'bread', name: 'Bread', basePrice: 24 },
  planks: { id: 'planks', name: 'Planks', basePrice: 32 },
  cutStone: { id: 'cutStone', name: 'Cut stone', basePrice: 40 },
  honey: { id: 'honey', name: 'Honey', basePrice: 55 },
  lampOil: { id: 'lampOil', name: 'Lamp oil', basePrice: 50 },
};
const OLD_GOOD_ICONS = {
  fish: '🐟',
  grain: '🌾',
  timber: '🪵',
  stone: '🪨',
  smokedFish: '🍢',
  bread: '🍞',
  planks: '🪚',
  cutStone: '🧱',
  honey: '🍯',
  lampOil: '🪔',
};
const OLD_DIFFICULTY = {
  fair: {
    cargoLost: 0,
    damage: 0.5,
    repairCost: 1,
    spread: 0.02,
    orderFactor: 2,
    startGold: 250,
    growth: 0.75,
    galeWeight: 0.08,
    stormEverySec: 900,
    steadyWind: true,
  },
  captain: {
    cargoLost: 1,
    damage: 1,
    repairCost: 2,
    spread: 0.06,
    orderFactor: 1.5,
    startGold: 150,
    growth: 1,
    galeWeight: 0.15,
    stormEverySec: 600,
    steadyWind: false,
  },
  salt: {
    cargoLost: 2,
    damage: 1.5,
    repairCost: 3,
    spread: 0.11,
    orderFactor: 1.25,
    startGold: 100,
    growth: 1.25,
    galeWeight: 0.22,
    stormEverySec: 420,
    steadyWind: false,
  },
};
const OLD_DEFAULT_WEATHER = {
  periodSec: 180,
  blendSec: 60,
  stepDeg: 75,
  revert: 0.12,
  strength: [0.8, 1.15],
  regions: { bendDeg: 40, strength: 0.15, sizeUnits: 400, driftSec: 900 },
  kinds: {
    breeze: { weight: 0.5, strength: [0.8, 1.15], rain: 0, gusts: 1 },
    calm: { weight: 0.17, strength: [0.35, 0.55], rain: 0, gusts: 0.6 },
    rain: { weight: 0.18, strength: [0.95, 1.2], rain: 0.7, gusts: 1.6 },
    gale: { weight: 0.15, strength: [1.35, 1.55], rain: 0.15, gusts: 1.6 },
  },
  persist: 0.35,
  storms: { everySec: 600, radius: 95, speed: 3.2, areaRadius: 440 },
};
const OLD_UPGRADE_EFFECTS = {
  sailsSpeed: [1, 1.08, 1.16],
  sailsAccel: [1, 1.15, 1.3],
  holdCapacity: [1, 1.6, 2.2],
  hullSpeed: [1, 1.02, 1.04],
  hullDurability: [100, 150, 220],
};
