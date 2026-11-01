// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { REGATTA, checkRegattaData } from '../src/sim/regatta';
import { SHIP_CLASSES, SLOOP } from '../src/sim/ship';
import { holdCapacity } from '../src/sim/upgrades';
import { shipOffer } from '../src/sim/shipyards';
import { testCondition } from '../src/sim/questLibrary';
import { checkReward, payReward } from '../src/sim/questRewards';
import { grantSeriesPrizes } from '../src/sim/seriesPrizes';
import { createWorld } from '../src/sim/world';

// The Tern (decision 0228): a racer given for a series, never sold at a yard.
const trial = { id: 'trial', name: 'Trial', pennant: 'tern', prize: 'tern' };
const original = [...REGATTA.series];
afterEach(() => (REGATTA.series = original));

describe('series prize ships', () => {
  it('gives the prize once, when its series is won', () => {
    REGATTA.series = [...original, trial];
    const { trade } = createWorld(PHASE1_MAP, SLOOP);
    expect(grantSeriesPrizes(trade, [])).toEqual([]);
    expect(trade.captain.ships.tern).toBeUndefined();
    expect(grantSeriesPrizes(trade, ['trial'])).toEqual(['tern']);
    expect(trade.captain.ships.tern).toEqual({ sails: 1, hold: 1, hull: 1 });
    expect(trade.captain.activeShip).toBe('sloop');
    expect(grantSeriesPrizes(trade, ['trial'])).toEqual([]);
  });

  it('flags a prize that is not a ship', () => {
    REGATTA.series = [...original, { ...trial, prize: 'ghost' }];
    expect(checkRegattaData(REGATTA).join()).toContain('no ship "ghost"');
  });

  it('keeps the Tern fast, light and unsold', () => {
    const tern = SHIP_CLASSES.tern!;
    expect(tern.speedRatio).toBeGreaterThan(SHIP_CLASSES.cutter!.speedRatio);
    expect(holdCapacity(tern, { sails: 1, hold: 1, hull: 1 })).toBeLessThan(SLOOP.hold);
    const { trade } = createWorld(PHASE1_MAP, SLOOP);
    expect(shipOffer(trade, PHASE1_MAP, 'tern').status).toBe('no-yard');
  });

  it('sells the other Terns only once the club series is won', () => {
    const { trade } = createWorld(PHASE1_MAP, SLOOP);
    expect(SHIP_CLASSES['tern-pilot']!.series).toBe('regatta-club');
    for (const id of ['tern-pilot', 'tern-yawl'])
      expect(shipOffer(trade, PHASE1_MAP, id).status).toBe('no-yard');
    trade.quests.won = ['regatta-club'];
    for (const id of ['tern-pilot', 'tern-yawl'])
      expect(shipOffer(trade, PHASE1_MAP, id).status).not.toBe('no-yard');
  });
});

describe('a ship as a quest reward', () => {
  const scope = { map: PHASE1_MAP, quests: new Map(), steps: new Map(), items: [] };

  it('gives the ship at stock levels, once, and keeps the one she has', () => {
    const { trade } = createWorld(PHASE1_MAP, SLOOP);
    payReward(trade, PHASE1_MAP, { ship: 'tern' }, () => {});
    expect(trade.captain.ships.tern).toEqual({ sails: 1, hold: 1, hull: 1 });
    trade.captain.ships.tern = { sails: 2, hold: 1, hull: 1 };
    payReward(trade, PHASE1_MAP, { ship: 'tern' }, () => {});
    expect(trade.captain.ships.tern!.sails).toBe(2);
    expect(trade.captain.activeShip).toBe('sloop');
  });

  it('checks the ship is a class', () => {
    expect(checkReward({ ship: 'tern' }, scope, 'r')).toEqual([]);
    expect(checkReward({ ship: 'ghost' }, scope, 'r').join()).toContain('no ship "ghost"');
  });

  it('starts on a series won', () => {
    const { trade } = createWorld(PHASE1_MAP, SLOOP);
    const base = {
      trade,
      map: PHASE1_MAP,
      isDone: () => false,
      chose: () => false,
      isAt: () => false,
    };
    const c = { is: 'series-won', series: 'regatta-club' };
    expect(testCondition(c, base)).toBe(false);
    expect(testCondition(c, { ...base, won: ['regatta-club'] })).toBe(true);
  });
});
