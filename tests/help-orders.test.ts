import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { deliverContract, helpPortId, readContracts, syncHelpOrder } from '../src/sim/contracts';
import { addGrowth } from '../src/sim/settlement';
import { SLOOP } from '../src/sim/ship';
import { stepTrade } from '../src/sim/trade';
import { type World, createWorld } from '../src/sim/world';
import { TUNING } from '../src/data/tuning';

// Tuning values moved to src/data/tuning (decision 0094).
const HELP_COOLDOWN = TUNING.economy.orders.helpCooldown;
const HELP_GROWTH_FACTOR = TUNING.economy.orders.helpGrowthFactor;
const ORDER_GROWTH_BONUS = TUNING.economy.towns.orderGrowthBonus;
const STALL_SECONDS = TUNING.economy.towns.stallSeconds;

/** Help orders from neglected towns and a home port that holds back an upgrade (decision 0069). */

const MAP = PHASE1_MAP;

function world(): World {
  return createWorld(MAP, SLOOP);
}

function step(w: World, seconds: number) {
  const boat = { x: 0, y: -MAP.boundsRadius + 5, speedKn: 6 };
  return stepTrade(w.trade, MAP, boat, seconds);
}

const helpOrders = (w: World) => Object.values(w.trade.contracts.byPort).filter((c) => c.help);

describe('help orders (0069)', () => {
  it('nobody asks for help before a town has stalled', () => {
    const w = world();
    expect(step(w, STALL_SECONDS - 10).some((e) => e.type === 'help-order')).toBe(false);
    expect(helpPortId(MAP, w.trade)).toBeNull();
  });

  it('the town left longest without supply asks, once, with a better reward', () => {
    const w = world();
    const t = w.trade;
    // Everyone but Westholm was supplied a little while ago.
    for (const s of Object.values(t.settlements.byPort)) s.sinceSupply = 100;
    t.settlements.byPort.westholm!.sinceSupply = STALL_SECONDS + 60;
    const before = t.contracts.byPort.westholm!.reward;
    const events = step(w, 1);
    expect(events).toContainEqual({ type: 'help-order', portId: 'westholm' });
    const order = t.contracts.byPort.westholm!;
    expect(order.help).toBe(true);
    expect(order.reward).toBeGreaterThan(before);
    // Only one at a time, and it does not move when another town falls further behind.
    t.settlements.byPort.calda!.sinceSupply = STALL_SECONDS * 10;
    step(w, 1);
    expect(helpOrders(w).map((c) => c.portId)).toEqual(['westholm']);
  });

  it('hidden yards ask only once discovered', () => {
    const w = world();
    const t = w.trade;
    for (const s of Object.values(t.settlements.byPort)) s.sinceSupply = 0;
    t.settlements.byPort['abbey-head']!.sinceSupply = STALL_SECONDS * 5;
    expect(helpPortId(MAP, t)).toBeNull();
    t.progress.discovered.push('abbey-head');
    expect(helpPortId(MAP, t)).toBe('abbey-head');
  });

  it('the home port asks while an upgrade waits for it to grow', () => {
    const w = world();
    const t = w.trade;
    for (const s of Object.values(t.settlements.byPort)) s.sinceSupply = STALL_SECONDS * 5;
    t.settlements.byPort.calda!.sinceSupply = STALL_SECONDS * 9;
    expect(helpPortId(MAP, t)).toBe('calda');
    // A level 3 upgrade needs the home port, Saltmere, to be a town.
    t.captain.ships.sloop!.hold = 2;
    expect(helpPortId(MAP, t)).toBe('saltmere');
    addGrowth(t, 'saltmere', 150);
    step(w, 0.1);
    expect(helpPortId(MAP, t)).not.toBe('saltmere');
  });

  it('delivering it grows the town twice as much, then help pauses', () => {
    const w = world();
    const t = w.trade;
    t.settlements.byPort.stonehaven!.sinceSupply = STALL_SECONDS * 20;
    expect(syncHelpOrder(MAP, t)).toBe('stonehaven');
    const order = t.contracts.byPort.stonehaven!;
    t.dockedAt = 'stonehaven';
    t.captain.cargo[order.good] = order.qty;
    const gold = t.captain.gold;
    const growth = t.settlements.byPort.stonehaven!.growth;
    expect(deliverContract(t, MAP)).toEqual({ ok: true, gold: order.reward });
    expect(t.captain.gold).toBe(gold + order.reward);
    expect(t.settlements.byPort.stonehaven!.growth - growth).toBe(
      (order.qty + ORDER_GROWTH_BONUS) * HELP_GROWTH_FACTOR,
    );
    expect(t.contracts.byPort.stonehaven!.help).toBeUndefined();
    // A pause before the next town asks.
    t.settlements.byPort.calda!.sinceSupply = STALL_SECONDS * 30;
    t.dockedAt = null;
    step(w, HELP_COOLDOWN - 1);
    expect(helpOrders(w)).toEqual([]);
    step(w, 2);
    expect(helpOrders(w).length).toBe(1);
  });

  it('a help order and the pause survive a save', () => {
    const w = world();
    const t = w.trade;
    t.contracts.byPort.calda!.help = true;
    t.contracts.helpIn = 30;
    const back = readContracts(JSON.parse(JSON.stringify(t.contracts)), MAP, t.settlements);
    expect(back.byPort.calda!.help).toBe(true);
    expect(back.helpIn).toBe(30);
    expect(back.byPort.saltmere!.help).toBeUndefined();
  });
});
