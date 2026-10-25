import { describe, expect, it } from 'vitest';
import { GAME_MAP, PHASE1_MAP } from '../src/data/maps';
import { chartAreaIds, fogIslandIds, islandCharted } from '../src/sim/fog';
import { SAVE_KEY, type SaveStorage, loadGame, serializeWorld } from '../src/sim/save';
import { encodeSaveCode, readSaveCode } from '../src/sim/saveTransfer';
import { QUEST_DONE } from '../src/sim/quests';
import { SLOOP } from '../src/sim/ship';
import { farGoodsOnChart } from '../src/sim/shipyards';
import { type World, createWorld, stepWorld } from '../src/sim/world';

/*
 * The grown sea is the main game (decision 0190): the Windward Ring in the middle keeps its name,
 * ports and places, so a voyage from before resumes where it was, with the new waters fogged, and
 * its save codes still read.
 */

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

/** A ring voyage some way in: sailed a while, gold, cargo, a second ship, a quest done. */
function ringVoyage(): World {
  const w = createWorld(PHASE1_MAP, SLOOP);
  for (let i = 0; i < 2000; i++)
    stepWorld(w, { steer: i % 400 < 200 ? 0.3 : -0.3, sailStep: 3 }, 0.1);
  const c = w.trade.captain;
  c.gold = 2500;
  c.ships.cutter = { sails: 2, hold: 2, hull: 1 };
  c.cargo.fish = 7;
  w.trade.quests.byId['first-voyage'] = { step: QUEST_DONE, counts: [], chose: {} };
  w.trade.progress.discovered.push(...PHASE1_MAP.ports.slice(0, 3).map((p) => p.id));
  return w;
}

describe('the grown sea is the main game (decision 0190)', () => {
  it('keeps the ring: same name, its ports first and in order, the new waters fogged', () => {
    expect(GAME_MAP.name).toBe(PHASE1_MAP.name);
    expect(GAME_MAP.boundsRadius).toBeGreaterThan(PHASE1_MAP.boundsRadius * 2);
    expect(GAME_MAP.ports.slice(0, PHASE1_MAP.ports.length).map((p) => p.id)).toEqual(
      PHASE1_MAP.ports.map((p) => p.id),
    );
    expect(GAME_MAP.ports.length).toBeGreaterThan(PHASE1_MAP.ports.length);
    expect(GAME_MAP.compatibleSaveMaps).toEqual(
      expect.arrayContaining([
        ...(PHASE1_MAP.compatibleSaveMaps ?? []),
        'Windward Ring (Phase 4 sea)',
      ]),
    );
  });

  it('resumes a ring save where it was, every ring port kept and the outer seas uncharted', () => {
    const ring = ringVoyage();
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(serializeWorld(ring)));
    const game = createWorld(GAME_MAP, SLOOP);
    expect(loadGame(storage, game)).toBe(true);
    expect(game.boat.x).toBeCloseTo(ring.boat.x, 3);
    expect(game.boat.y).toBeCloseTo(ring.boat.y, 3);
    expect(game.trade.captain.gold).toBe(2500);
    expect(game.trade.captain.ships.cutter).toEqual({ sails: 2, hold: 2, hull: 1 });
    expect(game.trade.captain.cargo.fish).toBe(7);
    expect(game.trade.quests.byId['first-voyage']?.step).toBe(QUEST_DONE);
    expect(game.trade.progress.discovered).toEqual(
      expect.arrayContaining(ring.trade.progress.discovered),
    );
    // The ring's markets carry over; the new ports start at their defaults.
    for (const port of PHASE1_MAP.ports)
      expect(game.trade.markets[port.id]?.stock).toEqual(ring.trade.markets[port.id]?.stock);
    const sunreach = GAME_MAP.islands.find((i) => i.id === 'sunreach')!;
    expect(islandCharted(GAME_MAP, game.trade.progress, sunreach)).toBe(false);
  });

  it('reads a ring FW2 code, written before 0190, with the ring as the earlier map', () => {
    const ring = ringVoyage();
    const code = encodeSaveCode(serializeWorld(ring), PHASE1_MAP);
    const game = createWorld(GAME_MAP, SLOOP);
    // Its lists are the ring's, shorter than the grown sea's: alone, the game cannot place them.
    expect(readSaveCode(code, game)).toEqual({ ok: false, problem: 'otherVersion' });
    const read = readSaveCode(code, game, [PHASE1_MAP]);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.save.map).toBe(GAME_MAP.name);
    expect(read.save.gold).toBe(2500);
    expect(read.save.ships.cutter).toEqual({ sails: 2, hold: 2, hull: 1 });
    expect(read.save.boat.x).toBeCloseTo(ring.boat.x, 1);
    expect(read.save.quests?.byId['first-voyage']?.step).toBe(QUEST_DONE);
  });

  it('moves a grown-sea voyage through a code and back', () => {
    const from = createWorld(GAME_MAP, SLOOP);
    from.trade.captain.gold = 999;
    const code = encodeSaveCode(serializeWorld(from), GAME_MAP);
    const read = readSaveCode(code, createWorld(GAME_MAP, SLOOP), [PHASE1_MAP]);
    expect(read.ok && read.save.gold).toBe(999);
  });

  it('still loads a voyage sailed at ?map=phase4 while it was a dev sea', () => {
    const dev = serializeWorld(createWorld(GAME_MAP, SLOOP));
    dev.map = 'Windward Ring (Phase 4 sea)';
    dev.gold = 321;
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(dev));
    const game = createWorld(GAME_MAP, SLOOP);
    expect(loadGame(storage, game)).toBe(true);
    expect(game.trade.captain.gold).toBe(321);
  });

  it("lists no far good on the chart's market before a port that sells it is charted", () => {
    const game = createWorld(GAME_MAP, SLOOP);
    expect([...farGoodsOnChart(GAME_MAP, game.trade)]).toEqual([]);
    game.trade.progress.areas = chartAreaIds(GAME_MAP);
    game.trade.progress.sighted = fogIslandIds(GAME_MAP);
    expect(farGoodsOnChart(GAME_MAP, game.trade).size).toBeGreaterThan(0);
  });
});
