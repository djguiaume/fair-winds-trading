import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { createWorld, holdStorms } from '../src/sim/world';
import { buy, sell, sellAll } from '../src/sim/trade';
import { saveGame, loadGame, SAVE_KEY, serializeWorld } from '../src/sim/save';
import { TutorialChoice } from '../src/ui/tutorial';
import { TUTORIAL, tutorialVoyage } from './helpers/tutorial';

// Decision 0148: the tutorial is an ordinary quest, run by the quest book and saved with the voyage.

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
    expect(again.quests.tracked).toBe(TUTORIAL);
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
  });

  it('moves a lesson kept in the browser before 0148 into the voyage once', () => {
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
    expect(v.quests.restore(TUTORIAL, legacy!.step, legacy!.vars)).toBe(true);
    expect(v.step).toBe('deliver');
    v.dock('calda');
    expect(v.step).toBe('sell');
    // Only once: a quest with progress is left alone.
    expect(v.quests.restore(TUTORIAL, 'sails')).toBe(false);
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
    expect(v.lesson!.copy).toContain('Port Calda');
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
    expect(events).toContainEqual({ type: 'finished', quest: TUTORIAL });
    expect(v.quests.isDone(TUTORIAL)).toBe(true);
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
    expect(v.quests.isDone(TUTORIAL)).toBe(true);
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

  it('only Rook’s harbour counts while he is aboard; clearing the course asks again', () => {
    const v = tutorialVoyage();
    v.rescue();
    expect(v.step).toBe('chart');
    v.screen('chart');
    expect(v.step).toBe('home-port');
    v.course('calda');
    expect(v.step).toBe('home-port');
    v.course('saltmere');
    expect(v.step).toBe('home');
    v.course(null);
    expect(v.step).toBe('home-port');
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
    expect(v.step).toBe('choose-port');
    // Any port then: it becomes the harbour to buy at.
    v.course('westholm');
    expect(v.step).toBe('dock');
    expect(v.vars.origin).toBe('westholm');
    v.dock('westholm');
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
