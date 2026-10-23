import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { DIFFICULTY, easier, knobs, weatherFor } from '../src/sim/difficulty';
import { deliverContract } from '../src/sim/contracts';
import { damageHull, repairHull, repairPrice } from '../src/sim/hazards';
import { quoteBuy, quoteSell } from '../src/sim/market';
import { type SaveStorage, SAVE_KEY, loadGame, saveGame, serializeWorld } from '../src/sim/save';
import { addGrowth } from '../src/sim/settlement';
import { SLOOP } from '../src/sim/ship';
import { setDifficulty, startVoyage } from '../src/sim/trade';
import { DEFAULT_WEATHER, weatherAt } from '../src/sim/wind';
import { createWorld, stepHeel, stepWorld } from '../src/sim/world';
import { TUNING } from '../src/data/tuning';

// Tuning values moved to src/data/tuning (decision 0094).
const START_GOLD = knobs('captain').startGold;
const STEADY_REVERT = TUNING.difficulty.steadyWind.revert;
const STEADY_STEP_DEG = TUNING.difficulty.steadyWind.stepDeg;
const WIND_BLEND_SEC = TUNING.weather.blendSec;

class MemoryStorage implements SaveStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const world = () => createWorld(PHASE1_MAP, SLOOP);

describe('difficulty levels (decision 0083)', () => {
  it('Captain is the game as tuned: a fresh voyage starts there with the 0046 numbers', () => {
    const w = world();
    expect(w.trade.difficulty).toBe('captain');
    expect(w.trade.captain.gold).toBe(START_GOLD);
    expect(knobs('captain').startGold).toBe(START_GOLD);
    // The map's own weather, unchanged in every value.
    expect(weatherFor(DEFAULT_WEATHER, 'captain', false)).toEqual(DEFAULT_WEATHER);
  });

  it('starts a voyage with the level’s gold and remembers the easiest level played', () => {
    const w = world();
    startVoyage(w.trade, 'salt');
    expect(w.trade.captain.gold).toBe(DIFFICULTY.salt.startGold);
    expect(w.trade.easiestDifficulty).toBe('salt');
    setDifficulty(w.trade, 'fair');
    setDifficulty(w.trade, 'captain');
    expect(w.trade.easiestDifficulty).toBe('fair');
    expect(easier('salt', 'captain')).toBe('captain');
  });

  it('changes repair prices and crash damage, never the speed she sails', () => {
    const w = world();
    damageHull(w.trade, 20);
    const captain = repairPrice(w.trade);
    setDifficulty(w.trade, 'fair');
    expect(repairPrice(w.trade)).toBe(captain / 2);
    setDifficulty(w.trade, 'salt');
    expect(repairPrice(w.trade)).toBe(captain * 1.5);
    w.trade.dockedAt = 'saltmere';
    w.trade.captain.gold = 1000;
    expect(repairHull(w.trade)).toMatchObject({ ok: true, gold: 60, points: 20 });
  });

  it('widens or narrows the port’s cut at once', () => {
    const w = world();
    const m = w.trade.markets.saltmere!;
    const spread = () => quoteBuy(m, 'timber', 10) - quoteSell(m, 'timber', 10);
    const captain = spread();
    setDifficulty(w.trade, 'fair');
    expect(spread()).toBeLessThan(captain);
    setDifficulty(w.trade, 'salt');
    expect(spread()).toBeGreaterThan(captain);
  });

  it('pays more for the next order on Fair winds and less on Old salt; posted orders keep theirs', () => {
    const rewardAfter = (level: 'fair' | 'captain' | 'salt') => {
      const w = world();
      setDifficulty(w.trade, level);
      const port = 'westholm';
      const c = w.trade.contracts.byPort[port]!;
      const posted = c.reward;
      w.trade.dockedAt = port;
      w.trade.captain.cargo[c.good] = c.qty;
      expect(deliverContract(w.trade, PHASE1_MAP)).toMatchObject({ ok: true, gold: posted });
      const next = w.trade.contracts.byPort[port]!;
      return next.reward / next.qty;
    };
    expect(rewardAfter('fair')).toBeGreaterThan(rewardAfter('captain'));
    expect(rewardAfter('captain')).toBeGreaterThan(rewardAfter('salt'));
  });

  it('towns grow faster on Fair winds and slower on Old salt', () => {
    const grown = (level: 'fair' | 'captain' | 'salt') => {
      const w = world();
      setDifficulty(w.trade, level);
      addGrowth(w.trade, 'calda', 30);
      return w.trade.settlements.byPort.calda!.growth;
    };
    expect(grown('captain')).toBe(30);
    expect(grown('fair')).toBe(40);
    expect(grown('salt')).toBe(24);
  });

  it('throws no cargo on Fair winds and two units on Old salt in the same gust', () => {
    const lost = (level: 'fair' | 'captain' | 'salt') => {
      const w = world();
      setDifficulty(w.trade, level);
      w.trade.captain.cargo.timber = 5;
      w.boat.heading = Math.PI / 2;
      w.boat.sail = 1;
      w.wind = { from: 0, speedKn: 19 };
      stepHeel(w, 1 / 30);
      w.wind = { from: 0, speedKn: 25 };
      const events = stepHeel(w, 1 / 30);
      return { events: events.length, timber: w.trade.captain.cargo.timber };
    };
    expect(lost('fair')).toEqual({ events: 0, timber: 5 });
    expect(lost('captain')).toEqual({ events: 1, timber: 4 });
    expect(lost('salt')).toEqual({ events: 1, timber: 3 });
  });

  it('saves the level with the voyage; older saves play on as Captain', () => {
    const storage = new MemoryStorage();
    const w = world();
    startVoyage(w.trade, 'fair');
    setDifficulty(w.trade, 'salt');
    expect(saveGame(storage, w)).toBe(true);
    const back = world();
    expect(loadGame(storage, back)).toBe(true);
    expect(back.trade.difficulty).toBe('salt');
    expect(back.trade.easiestDifficulty).toBe('fair');
    // The port's cut follows the loaded level.
    expect(back.trade.markets.saltmere!.spread).toBe(DIFFICULTY.salt.spread);

    const old = serializeWorld(world()) as unknown as Record<string, unknown>;
    delete old.difficulty;
    delete old.easiestDifficulty;
    storage.setItem(SAVE_KEY, JSON.stringify(old));
    const older = world();
    setDifficulty(older.trade, 'fair');
    expect(loadGame(storage, older)).toBe(true);
    expect(older.trade.difficulty).toBe('captain');
  });

  it('keeps the steady trade wind close to the prevailing wind', () => {
    const steady = weatherFor(DEFAULT_WEATHER, 'fair', true);
    const shifting = weatherFor(DEFAULT_WEATHER, 'fair', false);
    let steadyMax = 0;
    let shiftingMax = 0;
    for (let t = 0; t < 4 * 3600; t += 60) {
      steadyMax = Math.max(steadyMax, Math.abs(weatherAt(steady, 7, t).offsetDeg));
      shiftingMax = Math.max(shiftingMax, Math.abs(weatherAt(shifting, 7, t).offsetDeg));
    }
    expect(steadyMax).toBeLessThanOrEqual(STEADY_STEP_DEG / STEADY_REVERT);
    expect(shiftingMax).toBeGreaterThan(60);
    // The same object every time, so the weather walk keeps its cache.
    expect(weatherFor(DEFAULT_WEATHER, 'fair', true)).toBe(steady);
  });

  it('moves gales and storms with the level', () => {
    const fair = weatherFor(DEFAULT_WEATHER, 'fair', false);
    const salt = weatherFor(DEFAULT_WEATHER, 'salt', false);
    expect(fair.kinds!.gale.weight).toBeLessThan(DEFAULT_WEATHER.kinds!.gale.weight);
    expect(salt.kinds!.gale.weight).toBeGreaterThan(DEFAULT_WEATHER.kinds!.gale.weight);
    expect(fair.storms!.everySec).toBeGreaterThan(DEFAULT_WEATHER.storms!.everySec);
    expect(salt.storms!.everySec).toBeLessThan(DEFAULT_WEATHER.storms!.everySec);
  });

  it('eases the wind to a new level instead of snapping it', () => {
    const w = world();
    // Far into a voyage, where the shifting wind has wandered off the prevailing one.
    w.time = 3 * 3600;
    const step = () => {
      stepWorld(w, { steer: 0, sailStep: 0 }, 0.5);
      return w.seaWind.from;
    };
    let before = step();
    w.steadyWind = true;
    let biggest = 0;
    for (let i = 0; i < (WIND_BLEND_SEC + 10) * 2; i++) {
      const now = step();
      let turn = now - before;
      turn -= 2 * Math.PI * Math.round(turn / (2 * Math.PI));
      biggest = Math.max(biggest, Math.abs(turn));
      before = now;
    }
    // Never more than a few degrees in half a second, gusts and swing included.
    expect(biggest).toBeLessThan((5 * Math.PI) / 180);
    expect(w.windBlend).toBeNull();
  });
});
