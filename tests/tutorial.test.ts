import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { createWorld, holdStorms } from '../src/sim/world';
import { buy, sell, sellAll, startVoyage } from '../src/sim/trade';
import { DIFFICULTIES } from '../src/sim/difficulty';
import { readQuests } from '../src/sim/quests';
import { saveGame, loadGame, SAVE_KEY, serializeWorld } from '../src/sim/save';
import { TutorialChoice } from '../src/ui/tutorial';
import { MARKET, TUTORIAL, tutorialVoyage } from './helpers/tutorial';

// Decision 0151: the tutorial is an ordinary quest, run by the quest book and saved with the voyage.

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => void values.set(k, v),
    removeItem: (k: string) => void values.delete(k),
  };
}

describe('optional tutorial and save compatibility', () => {
  it('offers on new voyages only, until taken or declined once on this map', () => {
    const storage = memory();
    const choice = new TutorialChoice(PHASE1_MAP.name, storage);
    expect(choice.shouldOffer(false)).toBe(true);
    expect(choice.shouldOffer(true)).toBe(false);
    choice.set('skipped');
    expect(new TutorialChoice(PHASE1_MAP.name, storage).shouldOffer(false)).toBe(false);
    choice.set('completed');
    expect(new TutorialChoice(PHASE1_MAP.name, storage).status).toBe('completed');
    // Old or broken storage offers it again; blocked storage never throws.
    for (const value of ['bad json', '{}', '{"status":"active","step":"bad"}']) {
      storage.setItem(choice.key, value);
      expect(new TutorialChoice(PHASE1_MAP.name, storage).status).toBe('unseen');
    }
    const blocked = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    };
    expect(() => new TutorialChoice(PHASE1_MAP.name, blocked).set('skipped')).not.toThrow();
  });

  it('starting and skipping touch nothing of the voyage but the quest progress', () => {
    const v = tutorialVoyage();
    const before = serializeWorld(v.world);
    v.start();
    expect(v.step).toBe('sails');
    expect(v.quests.tracked).toBe(TUTORIAL);
    v.skip();
    expect(v.quests.isDone(TUTORIAL)).toBe(true);
    const after = serializeWorld(v.world) as unknown as Record<string, unknown>;
    expect({ ...after, quests: undefined }).toEqual({ ...before, quests: undefined });
  });

  it('is saved with the voyage: the lesson and its picks resume where they were', () => {
    const v = tutorialVoyage();
    const storage = memory();
    v.reachMarket();
    expect(v.step).toBe('buy');
    expect(v.vars).toEqual({ origin: 'saltmere' });
    saveGame(storage, v.world);
    const restored = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, restored)).toBe(true);
    const again = tutorialVoyage(PHASE1_MAP, undefined, restored);
    expect(again.step).toBe('buy');
    expect(again.vars).toEqual({ origin: 'saltmere' });
    expect(again.quests.tracked).toBe(MARKET);
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
  });

  it('moves a lesson kept in the browser before 0151 into the voyage once', () => {
    const storage = memory();
    const choice = new TutorialChoice(PHASE1_MAP.name, storage);
    storage.setItem(
      choice.key,
      JSON.stringify({
        status: 'active',
        step: 'deliver',
        origin: 'saltmere',
        delivery: 'calda',
        good: 'fish',
      }),
    );
    const legacy = new TutorialChoice(PHASE1_MAP.name, storage).legacy();
    expect(legacy).toEqual({
      step: 'deliver',
      vars: { origin: 'saltmere', delivery: 'calda', cargo: 'fish' },
    });
    const v = tutorialVoyage();
    v.world.trade.captain.cargo.fish = 1;
    v.world.trade.dockedAt = null;
    v.course('calda');
    // The trading steps live in the first market's quest (v1.11).
    expect(v.quests.restore(TUTORIAL, legacy!.step, legacy!.vars)).toBe(false);
    expect(v.quests.restore(MARKET, legacy!.step, legacy!.vars)).toBe(true);
    expect(v.step).toBe('deliver');
    v.dock('calda');
    expect(v.step).toBe('sell');
    // Only once: a quest with progress is left alone.
    expect(v.quests.restore(MARKET, 'deliver')).toBe(false);
  });

  it('keeps a personal course when skipping', () => {
    const v = tutorialVoyage();
    v.rescue();
    v.course('saltmere');
    const personal = { portId: '', label: 'Marker 1', x: 40, y: 20 };
    v.world.destination = personal;
    v.check();
    v.skip();
    expect(v.world.destination).toBe(personal);
  });

  it('holds the storms while it runs (decision 0072)', () => {
    const v = tutorialVoyage();
    v.start();
    expect(v.quests.holdsStorms).toBe(true);
    holdStorms(v.world, 'quest', v.quests.holdsStorms);
    expect(v.world.stormHolds).toContain('quest');
    v.skip();
    expect(v.quests.holdsStorms).toBe(false);
  });
});

describe('saves from before the shorter first voyage (v1.11)', () => {
  const saved = (step: string, vars = { origin: 'saltmere' }) => ({
    byId: { [TUTORIAL]: { step, counts: [], chose: { sails: 'continue' }, vars } },
    tracked: TUTORIAL,
  });

  it('carries on at the way home from the removed chart lessons', () => {
    for (const step of ['chart', 'home-port']) {
      const read = readQuests(saved(step), PHASE1_MAP).byId[TUTORIAL]!;
      expect(read.step).toBe('home');
      expect(read.vars).toEqual({ origin: 'saltmere' });
    }
  });

  it('finds the first voyage done when it stood at a trading step', () => {
    const read = readQuests(saved('deliver'), PHASE1_MAP);
    expect(read.byId[TUTORIAL]!.step).toBe('done');
    expect(read.tracked).toBeUndefined();
  });
});

describe('real actions drive lessons', () => {
  it('requires lowering/raising, steering and motion for the control exercise', () => {
    const v = tutorialVoyage();
    v.start();
    v.world.boat.speedKn = 2;
    v.helm({ sailStep: 2, steer: 0 }, 2);
    expect(v.step).toBe('sails');
    v.helm({ sailStep: 0, steer: 0 }, 0.3);
    expect(v.step).toBe('sails');
    v.helm({ sailStep: 2, steer: 0.3 }, 0.5);
    v.helm({ sailStep: 2, steer: 0 }, 1);
    expect(v.step).toBe('wind');
  });

  it('completes a buy-deliver-sell loop with real trade APIs', () => {
    const v = tutorialVoyage();
    v.reachMarket();
    const before = v.world.trade.captain.gold;
    const purchase = buy(v.world.trade, 'fish', 1);
    expect(purchase.ok).toBe(true);
    v.check();
    expect(v.step).toBe('choose-delivery');
    expect(v.vars.cargo).toBe('fish');
    expect(v.lesson!.port).toBe('calda');
    // A course back to the harbour she bought at is not a delivery.
    v.course('saltmere');
    expect(v.step).toBe('choose-delivery');
    v.course('calda');
    expect(v.step).toBe('deliver');
    expect(v.vars.delivery).toBe('calda');
    v.world.trade.dockedAt = null;
    v.dock('westholm');
    expect(v.step).toBe('deliver');
    v.dock('calda');
    expect(v.step).toBe('sell');
    const sale = sell(v.world.trade, 'fish', 1);
    expect(sale.ok).toBe(true);
    const events = v.check();
    expect(events).toContainEqual({ type: 'finished', quest: MARKET });
    expect(v.quests.isDone(MARKET)).toBe(true);
    if (purchase.ok && sale.ok)
      expect(v.world.trade.captain.gold).toBe(before - purchase.gold + sale.gold);
    // Replaying starts it over, without touching the voyage.
    const after = serializeWorld(v.world);
    v.start();
    expect(v.step).toBe('sails');
    expect(serializeWorld(v.world).gold).toEqual(after.gold);
  });

  it('uses existing cargo and handles Sell All without requiring another purchase', () => {
    const v = tutorialVoyage();
    v.world.trade.captain.gold = 0;
    v.world.trade.captain.cargo.grain = 8;
    v.reachMarket();
    expect(v.lesson!.options.map((o) => o.id)).toEqual(['continue']);
    v.cont();
    expect(v.vars.cargo).toBe('grain');
    v.course('stonehaven');
    v.world.trade.dockedAt = null;
    v.dock('stonehaven');
    expect(v.step).toBe('sell');
    expect(sellAll(v.world.trade).ok).toBe(true);
    v.check();
    expect(v.quests.isDone(MARKET)).toBe(true);
  });

  it('offers "use my cargo" only with cargo aboard', () => {
    const v = tutorialVoyage();
    v.reachMarket();
    expect(v.lesson!.options).toEqual([]);
    expect(v.cont()).toEqual([]);
    expect(v.step).toBe('buy');
  });

  it('returns to buying if the lesson cargo is sold early', () => {
    const v = tutorialVoyage();
    v.reachMarket();
    buy(v.world.trade, 'fish', 1);
    v.check();
    sell(v.world.trade, 'fish', 1);
    v.check();
    expect(v.step).toBe('buy');
    expect(v.vars.origin).toBe('saltmere');
    expect(v.running).toBe(true);
  });

  it('only Rook’s harbour counts while he is aboard, with or without a course', () => {
    const v = tutorialVoyage();
    v.rescue();
    expect(v.step).toBe('home');
    v.course('calda');
    v.dock('calda');
    expect(v.step).toBe('home');
    v.course(null);
    v.dock('saltmere');
    expect(v.step).toBe('thanks');
  });
});

describe('the first voyage on every level (v1.11)', () => {
  it.each(DIFFICULTIES)('finishes the rescue, the first market and the sale on %s', (level) => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    startVoyage(world.trade, level);
    const v = tutorialVoyage(PHASE1_MAP, undefined, world);
    v.reachMarket();
    expect(v.quests.isDone(TUTORIAL)).toBe(true);
    expect(v.step).toBe('buy');
    expect(buy(world.trade, 'fish', 1).ok).toBe(true);
    v.check();
    v.course('calda');
    world.trade.dockedAt = null;
    v.dock('calda');
    expect(sell(world.trade, 'fish', 1).ok).toBe(true);
    v.check();
    expect(v.quests.isDone(MARKET)).toBe(true);
  });
});

describe('tutorial recovery', () => {
  it('goes back to choosing a port when the lesson cargo is gone at sea', () => {
    const v = tutorialVoyage();
    v.reachMarket();
    buy(v.world.trade, 'fish', 1);
    v.check();
    v.course('calda');
    expect(v.step).toBe('deliver');
    v.world.trade.dockedAt = null;
    v.world.trade.captain.cargo.fish = 0;
    v.course(null);
    v.check();
    expect(v.step).toBe('dock');
    // Any port then: it becomes the harbour to buy at.
    v.dock('westholm');
    expect(v.vars.origin).toBe('westholm');
    expect(v.step).toBe('buy');
  });

  it('sailing off before buying asks to dock again, and the coach points the way', () => {
    const v = tutorialVoyage();
    v.reachMarket();
    expect(v.lesson!.good).toBe('fish');
    v.dock(null);
    expect(v.step).toBe('dock');
    expect(v.lesson!.port).toBe('saltmere');
    v.dock('saltmere');
    expect(v.step).toBe('buy');
  });
});
