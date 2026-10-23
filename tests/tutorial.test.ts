import { describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { Tutorial } from '../src/sim/tutorial';
import { createWorld, stepWorld } from '../src/sim/world';
import { buy, sell, sellAll } from '../src/sim/trade';
import { saveGame, loadGame, SAVE_KEY, serializeWorld } from '../src/sim/save';

function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const world = createWorld(PHASE1_MAP, SLOOP);
  const harbours = Object.fromEntries(
    PHASE1_MAP.ports.map((p) => {
      const i = PHASE1_MAP.islands.find((i) => i.id === p.islandId)!;
      return [p.id, { x: i.x + i.radius + 5, y: i.y }];
    }),
  );
  const tutorial = new Tutorial(world, harbours, storage);
  const choose = (id: string) => {
    const port = PHASE1_MAP.ports.find((p) => p.id === id)!;
    world.destination = { portId: id, label: port.name, ...harbours[id]! };
    tutorial.destinationSelected();
  };
  /** The prologue (decision 0127): sails and wind, the foghorn, alongside the wreck. */
  const rescue = () => {
    tutorial.start();
    tutorial.continueLesson();
    tutorial.continueLesson();
    expect(tutorial.step).toBe('foghorn');
    const wreck = tutorial.wreck!;
    world.boat.x = wreck.x + 40;
    world.boat.y = wreck.y;
    tutorial.observe();
    expect(tutorial.step).toBe('wreck');
    world.boat.x = wreck.x + 14;
    world.boat.speedKn = 1;
    for (let n = 0; n < 8; n++) tutorial.observe({ sailStep: 0, steer: 0 }, 0.5);
    expect(tutorial.step).toBe('chart');
  };
  /** Rook home to Saltmere, the island, and alongside for the first trade. */
  const reachMarket = () => {
    rescue();
    tutorial.chartOpened();
    choose('saltmere');
    expect(tutorial.step).toBe('home');
    world.trade.dockedAt = 'saltmere';
    world.boat.x = harbours.saltmere!.x;
    world.boat.y = harbours.saltmere!.y;
    world.boat.speedKn = 0;
    world.boat.sailStep = 0; // alongside with sails down, as docking leaves her
    tutorial.observe();
    expect(tutorial.step).toBe('island');
    tutorial.continueLesson();
    expect(tutorial.step).toBe('buy');
  };
  return { world, tutorial, storage, harbours, choose, rescue, reachMarket };
}

describe('optional tutorial and save compatibility', () => {
  it('offers on new voyages only; legacy saves remain opt-in', () => {
    const { world, tutorial } = setup();
    const before = serializeWorld(world);
    expect(tutorial.shouldOffer(false)).toBe(true);
    expect(tutorial.shouldOffer(true)).toBe(false);
    tutorial.start();
    tutorial.skip();
    expect(tutorial.shouldOffer(false)).toBe(false);
    expect(serializeWorld(world)).toEqual(before);
  });
  it('persists independently, resumes the lesson and restores only its bearing', () => {
    const { world, storage, harbours, reachMarket } = setup();
    reachMarket();
    saveGame(storage, world);
    const voyage = storage.getItem(SAVE_KEY);
    const restored = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, restored)).toBe(true);
    const resumed = new Tutorial(restored, harbours, storage);
    expect(resumed.step).toBe('buy');
    expect(restored.destination).toBeNull();
    resumed.resume();
    expect(restored.destination?.portId).toBe('saltmere');
    resumed.skip();
    expect(restored.destination).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe(voyage);
    const a = serializeWorld(restored) as unknown as Record<string, unknown>;
    const b = serializeWorld(world) as unknown as Record<string, unknown>;
    for (const k of Object.keys(b))
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k]))
        console.log(
          'DIFF',
          k,
          JSON.stringify(a[k]).slice(0, 300),
          JSON.stringify(b[k]).slice(0, 300),
        );
    expect(serializeWorld(restored)).toEqual(serializeWorld(world));
  });
  it('keeps a later personal destination when skipping', () => {
    const { world, tutorial, choose, rescue } = setup();
    rescue();
    choose('saltmere');
    const personal = { portId: '', label: 'Marker 1', x: 40, y: 20 };
    world.destination = personal;
    tutorial.destinationSelected();
    tutorial.skip();
    expect(world.destination).toBe(personal);
  });
  it('ignores malformed state and unavailable storage', () => {
    const { world, storage, harbours, tutorial } = setup();
    for (const value of [
      'bad json',
      '{}',
      '{"status":"active","step":"bad"}',
      '{"status":"active","step":"dock","origin":"gone","delivery":null,"good":null}',
    ]) {
      storage.setItem(tutorial.key, value);
      expect(new Tutorial(world, harbours, storage).status).toBe('unseen');
    }
    const blocked = new Tutorial(world, harbours, {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
      removeItem() {
        throw Error();
      },
    });
    expect(() => {
      blocked.start();
      blocked.skip();
    }).not.toThrow();
  });
});

describe('real actions drive lessons', () => {
  it('requires lowering/raising, steering and motion for the control exercise', () => {
    const { world, tutorial } = setup();
    tutorial.start();
    const change = vi.fn();
    tutorial.onChange = change;
    for (let n = 0; n < 120; n++) {
      const controls = { sailStep: 2, steer: 0 };
      stepWorld(world, controls, 1 / 60);
      tutorial.observe(controls, 1 / 60);
    }
    expect(tutorial.step).toBe('sails');
    expect(change).not.toHaveBeenCalled();
    tutorial.observe({ sailStep: 0, steer: 0 }, 1 / 60);
    for (let n = 0; n < 90; n++) {
      const controls = { sailStep: 2, steer: n < 30 ? 0.3 : 0 };
      stepWorld(world, controls, 1 / 60);
      tutorial.observe(controls, 1 / 60);
    }
    expect(tutorial.step).toBe('wind');
    expect(change).toHaveBeenCalledTimes(1);
  });
  it('completes a buy-deliver-sell loop with real trade APIs and clears its destination', () => {
    const { world, tutorial, reachMarket, choose, storage, harbours } = setup();
    reachMarket();
    const before = world.trade.captain.gold;
    const purchase = buy(world.trade, 'fish', 1);
    expect(purchase.ok).toBe(true);
    tutorial.traded('buy', 'fish');
    expect(tutorial.step).toBe('choose-delivery');
    expect(tutorial.lesson.copy).toContain('Port Calda');
    choose('saltmere');
    expect(tutorial.step).toBe('choose-delivery');
    choose('calda');
    expect(tutorial.step).toBe('deliver');
    world.trade.dockedAt = 'westholm';
    tutorial.observe();
    expect(tutorial.step).toBe('deliver');
    world.trade.dockedAt = 'calda';
    tutorial.observe();
    expect(tutorial.step).toBe('sell');
    const sale = sell(world.trade, 'fish', 1);
    expect(sale.ok).toBe(true);
    tutorial.traded('sell', 'fish');
    expect(tutorial.status).toBe('completed');
    expect(tutorial.finishedNotice).toBe(true);
    expect(world.destination).toBeNull();
    if (purchase.ok && sale.ok)
      expect(world.trade.captain.gold).toBe(before - purchase.gold + sale.gold);
    expect(new Tutorial(world, harbours, storage).status).toBe('completed');
    const after = serializeWorld(world);
    tutorial.start();
    expect(tutorial.step).toBe('sails');
    expect(serializeWorld(world)).toEqual(after);
  });
  it('uses existing cargo and handles Sell All without requiring another purchase', () => {
    const { world, tutorial, reachMarket, choose } = setup();
    world.trade.captain.gold = 0;
    world.trade.captain.cargo.grain = 8;
    reachMarket();
    tutorial.continueLesson();
    expect(tutorial.good).toBe('grain');
    choose('stonehaven');
    world.trade.dockedAt = 'stonehaven';
    tutorial.observe();
    const result = sellAll(world.trade);
    expect(result.ok).toBe(true);
    tutorial.traded('sell', null);
    expect(tutorial.status).toBe('completed');
  });
  it('returns to buying if the lesson cargo is sold early', () => {
    const { world, tutorial, reachMarket } = setup();
    reachMarket();
    buy(world.trade, 'fish', 1);
    tutorial.traded('buy', 'fish');
    sell(world.trade, 'fish', 1);
    tutorial.traded('sell', 'fish');
    expect(tutorial.step).toBe('buy');
    expect(tutorial.status).toBe('active');
  });
  it('clearing a lesson bearing returns to choosing a port', () => {
    const { world, tutorial, choose, rescue } = setup();
    rescue();
    // Only Rook's harbour counts while he is aboard.
    choose('calda');
    expect(tutorial.step).toBe('chart');
    choose('saltmere');
    expect(tutorial.step).toBe('home');
    expect(tutorial.passenger).toBe(true);
    world.destination = null;
    tutorial.destinationSelected();
    expect(tutorial.step).toBe('home-port');
  });
});

describe('tutorial recovery', () => {
  it('restarts an unfinished lesson on a new voyage, retaining completed/skipped preferences', () => {
    const { world, tutorial, storage, harbours, reachMarket } = setup();
    reachMarket();
    const nextVoyage = new Tutorial(world, harbours, storage, false);
    expect(nextVoyage.status).toBe('unseen');
    expect(nextVoyage.shouldOffer(false)).toBe(true);
    tutorial.skip();
    expect(new Tutorial(world, harbours, storage, false).status).toBe('skipped');
  });
  it('recovers from missing lesson cargo without granting goods or leaving a stale bearing', () => {
    const { world, tutorial, reachMarket, choose } = setup();
    reachMarket();
    buy(world.trade, 'fish', 1);
    tutorial.traded('buy', 'fish');
    choose('calda');
    world.trade.captain.cargo.fish = 0;
    const before = serializeWorld(world);
    tutorial.observe();
    expect(tutorial.step).toBe('choose-port');
    expect(world.destination).toBeNull();
    expect(serializeWorld(world)).toEqual(before);
  });
});
