import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { windForecast } from '../src/sim/forecast';
import { buildOnSpot, giveHomeIsland, offerHomeSpot } from '../src/sim/home';
import { serializeWorld, validateSave } from '../src/sim/save';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { SLOOP } from '../src/sim/ship';
import { storageRoom, storeGoods, storedGoods, storedTotal, takeGoods } from '../src/sim/storage';
import { capacity } from '../src/sim/trade';
import { windAt } from '../src/sim/wind';
import { type World, createWorld } from '../src/sim/world';

// Decision 0136: the warehouse keeps crates, the weather glass shows the wind ahead.
const MAP = PHASE1_MAP;

function withBuilding(spot: string, building: string): World {
  const w = createWorld(MAP, SLOOP);
  giveHomeIsland(w.trade, MAP);
  offerHomeSpot(w.trade, MAP, spot);
  expect(buildOnSpot(w.trade, MAP, spot, building).ok).toBe(true);
  return w;
}

describe('warehouse (decision 0136)', () => {
  it('keeps crates at the moored island, up to its room, and gives them back', () => {
    const w = withBuilding('spot-2', 'warehouse');
    const { trade } = w;
    trade.captain.cargo.fish = 8;
    trade.captain.cargo.planks = 6;
    expect(storageRoom(trade)).toBe(0); // at sea
    expect(storeGoods(trade, 'fish', 1)).toEqual({ ok: false, error: 'no-storage' });
    trade.home.docked = 'skerry';
    expect(storageRoom(trade)).toBe(10);
    expect(storeGoods(trade, 'fish', 8)).toEqual({ ok: true, qty: 8 });
    // Only two more fit.
    expect(storeGoods(trade, 'planks', 6)).toEqual({ ok: true, qty: 2 });
    expect(storeGoods(trade, 'planks', 1)).toEqual({ ok: false, error: 'storage-full' });
    expect(storedGoods(trade)).toEqual({ fish: 8, planks: 2 });
    expect(trade.captain.cargo.fish).toBe(0);
    expect(trade.captain.cargo.planks).toBe(4);
    expect(storeGoods(trade, 'grain', 1)).toEqual({ ok: false, error: 'not-in-hold' });

    // Taking back is limited by the hold.
    trade.captain.cargo.stone = capacity(trade) - 4 - 1;
    expect(takeGoods(trade, 'fish', 8)).toEqual({ ok: true, qty: 1 });
    expect(takeGoods(trade, 'fish', 1)).toEqual({ ok: false, error: 'hold-full' });
    trade.captain.cargo.stone = 0;
    trade.captain.cargo.planks = 0;
    expect(takeGoods(trade, 'fish', 99)).toEqual({ ok: true, qty: 7 });
    expect(storedTotal(trade)).toBe(2);
    expect(takeGoods(trade, 'planks', 2)).toEqual({ ok: true, qty: 2 });
    expect(trade.home.islands.skerry!.stored).toBeUndefined();
  });

  it('no warehouse, no room', () => {
    const w = withBuilding('spot-2', 'bakehouse');
    w.trade.home.docked = 'skerry';
    w.trade.captain.cargo.fish = 3;
    expect(storageRoom(w.trade)).toBe(0);
    expect(storeGoods(w.trade, 'fish', 1)).toEqual({ ok: false, error: 'no-storage' });
  });

  it('saves the kept crates, in the JSON save and in the save code', () => {
    const w = withBuilding('spot-2', 'warehouse');
    w.trade.home.docked = 'skerry';
    w.trade.captain.cargo.fish = 5;
    w.trade.captain.cargo.bread = 3;
    storeGoods(w.trade, 'fish', 5);
    storeGoods(w.trade, 'bread', 3);
    const save = JSON.parse(JSON.stringify(serializeWorld(w)));
    expect(validateSave(save, w)?.home?.islands.skerry?.stored).toEqual({ fish: 5, bread: 3 });
    save.home.islands.skerry.stored = { fish: -2, bread: 1.5, nothing: 3, grain: 4 };
    expect(validateSave(save, w)?.home?.islands.skerry?.stored).toEqual({ grain: 4 });

    const code = serializeWorld(w);
    const read = unpackSave(packSave(code, MAP), MAP, code.version);
    expect(read.ok && read.raw.home).toEqual(code.home);
  });
});

describe('weather glass (decision 0136)', () => {
  it('forecasts nothing without one, and the coming wind with one', () => {
    const plain = createWorld(MAP, SLOOP);
    expect(windForecast(plain)).toBeNull();

    const w = withBuilding('spot-4', 'weather-glass');
    w.time = 500;
    const f = windForecast(w)!;
    expect(f.aheadSec).toBe(60);
    // On a steady sea the forecast is the wind that will blow there in a minute.
    const steady = { ...MAP.wind, gustiness: 0, shiftDeg: 0, weather: undefined };
    w.windConfig = steady;
    const g = windForecast(w)!;
    const then = windAt(steady, 560, MAP.seed, w.boat);
    expect(g.from).toBeCloseTo(then.from, 5);
    expect(g.speedKn).toBeCloseTo(then.speedKn, 5);
  });

  it('smooths over a window so a gust does not swing it', () => {
    const w = withBuilding('spot-4', 'weather-glass');
    w.time = 500;
    const cfg = w.windConfig ?? MAP.wind;
    const spread = TUNING.economy.home.forecastSmoothSec;
    const samples = [0, 0.25, 0.5, 0.75, 1].map((k) =>
      windAt(cfg, 560 + (k - 0.5) * spread, MAP.seed, w.boat),
    );
    const mean = samples.reduce((n, s) => n + s.speedKn, 0) / samples.length;
    expect(windForecast(w)!.speedKn).toBeCloseTo(mean, 5);
  });
});
