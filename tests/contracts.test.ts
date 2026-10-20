// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import {
  CONTRACT_COOLDOWN,
  CONTRACT_HOLD_SHARE,
  CONTRACT_QTY,
  contractQtyRange,
  createContracts,
  deliverContract,
  makeContract,
  openContracts,
  readContracts,
} from '../src/sim/contracts';
import { GOOD_DEFS } from '../src/sim/goods';
import { createMarket, quoteSell } from '../src/sim/market';
import { type SaveStorage, loadGame, saveGame, serializeWorld } from '../src/sim/save';
import { SLOOP } from '../src/sim/ship';
import { stepTrade } from '../src/sim/trade';
import { createWorld } from '../src/sim/world';
import { TradePanel } from '../src/ui/tradePanel';

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

describe('delivery contracts (0028)', () => {
  it('posts one order per port, for a good it wants, that fits a stock sloop', () => {
    const state = createContracts(PHASE1_MAP);
    expect(openContracts(state)).toHaveLength(PHASE1_MAP.ports.length);
    for (const port of PHASE1_MAP.ports) {
      const c = state.byPort[port.id]!;
      expect(port.wants).toContain(c.good);
      expect(c.qty).toBeGreaterThanOrEqual(CONTRACT_QTY[0]);
      expect(c.qty).toBeLessThanOrEqual(Math.min(CONTRACT_QTY[1], SLOOP.hold));
    }
    expect(createContracts(PHASE1_MAP)).toEqual(state);
  });

  it('pays clearly more than selling the same goods on the market', () => {
    for (const port of PHASE1_MAP.ports) {
      for (let n = 0; n < 10; n++) {
        const c = makeContract(PHASE1_MAP, port, n);
        const market = createMarket(port);
        expect(c.reward).toBeGreaterThan(quoteSell(market, c.good, c.qty) * 1.2);
        // …but stays within reason.
        expect(c.reward).toBeLessThan(c.qty * GOOD_DEFS[c.good].basePrice * 4);
      }
    }
  });

  it('delivers from the hold for the reward, then posts the next order after a pause', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const { trade } = world;
    const port = PHASE1_MAP.ports[1]!;
    const order = trade.contracts.byPort[port.id]!;
    expect(deliverContract(trade, PHASE1_MAP)).toEqual({ ok: false, error: 'not-docked' });
    trade.dockedAt = port.id;
    trade.captain.cargo[order.good] = order.qty - 1;
    expect(deliverContract(trade, PHASE1_MAP)).toEqual({ ok: false, error: 'not-enough-cargo' });
    trade.captain.cargo[order.good] = order.qty + 2;
    const gold = trade.captain.gold;
    expect(deliverContract(trade, PHASE1_MAP)).toEqual({ ok: true, gold: order.reward });
    expect(trade.captain.gold).toBe(gold + order.reward);
    expect(trade.captain.cargo[order.good]).toBe(2);
    expect(trade.contracts.completed).toBe(1);
    expect(trade.contracts.byPort[port.id]!.readyIn).toBe(CONTRACT_COOLDOWN);
    expect(deliverContract(trade, PHASE1_MAP)).toEqual({ ok: false, error: 'no-contract' });
    stepTrade(trade, PHASE1_MAP, { x: 0, y: -112, speedKn: 5 }, CONTRACT_COOLDOWN);
    expect(trade.contracts.byPort[port.id]!.readyIn).toBe(0);
  });

  it('grows orders with the hold of the ship sailed when they are posted (0046)', () => {
    expect(contractQtyRange(SLOOP.hold)).toEqual(CONTRACT_QTY);
    const [lo, hi] = contractQtyRange(35);
    expect(hi).toBe(Math.round(35 * CONTRACT_HOLD_SHARE));
    expect(lo).toBe(Math.round(hi / 2));
    const world = createWorld(PHASE1_MAP, SLOOP);
    const { trade } = world;
    trade.captain.ships.sloop!.hold = 3;
    const port = PHASE1_MAP.ports[0]!;
    trade.dockedAt = port.id;
    const order = trade.contracts.byPort[port.id]!;
    trade.captain.cargo[order.good] = order.qty;
    expect(deliverContract(trade, PHASE1_MAP).ok).toBe(true);
    const next = trade.contracts.byPort[port.id]!;
    expect(next.qty).toBeGreaterThanOrEqual(contractQtyRange(22)[0]);
    expect(next.qty).toBeLessThanOrEqual(contractQtyRange(22)[1]);
  });

  it('saves and resumes orders; older saves without them get fresh orders', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.contracts.completed = 3;
    world.trade.contracts.byPort[PHASE1_MAP.ports[0]!.id]!.readyIn = 12;
    const storage = new MemoryStorage();
    saveGame(storage, world);
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, resumed)).toBe(true);
    expect(resumed.trade.contracts).toEqual(world.trade.contracts);

    const old = serializeWorld(world) as unknown as Record<string, unknown>;
    delete old.contracts;
    storage.setItem('fwt.save.v1', JSON.stringify(old));
    const legacy = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, legacy)).toBe(true);
    expect(legacy.trade.contracts).toEqual(createContracts(PHASE1_MAP));
  });

  it('replaces damaged saved orders instead of trusting them', () => {
    const port = PHASE1_MAP.ports[0]!;
    const read = readContracts(
      { completed: -1, byPort: { [port.id]: { good: 'gold', qty: 99, reward: 1, readyIn: 0 } } },
      PHASE1_MAP,
    );
    expect(read).toEqual(createContracts(PHASE1_MAP));
  });

  for (const mode of ['adult', 'kids'] as const) {
    it(`${mode}: the harbour lists orders and delivers this port's`, () => {
      const world = createWorld(PHASE1_MAP, SLOOP);
      const port = PHASE1_MAP.ports[0]!;
      world.trade.dockedAt = port.id;
      document.body.innerHTML = '<div id="panel" hidden></div>';
      const container = document.querySelector<HTMLElement>('#panel')!;
      const panel = new TradePanel(container, world);
      panel.uiMode = mode;
      // Captain mode lists every order on its own tab (decision 0049); Kids mode keeps them on the market.
      panel.open(mode === 'adult' ? 'orders' : 'market');
      const deliver = () => container.querySelector<HTMLButtonElement>('#tp-deliver')!;
      expect(deliver().disabled).toBe(true);
      const others = container.querySelectorAll('.contract-list li');
      // Only charted ports: the hidden yards' orders show once discovered (decision 0048).
      expect(others).toHaveLength(PHASE1_MAP.ports.filter((p) => !p.hidden).length - 1);

      const order = world.trade.contracts.byPort[port.id]!;
      world.trade.captain.cargo[order.good] = order.qty;
      panel.render();
      const gold = world.trade.captain.gold;
      deliver().click();
      expect(world.trade.captain.gold).toBe(gold + order.reward);
      expect(container.querySelector('#tp-deliver')).toBeNull();
      expect(container.querySelector('.trade-status')!.textContent).toContain(String(order.reward));
    });
  }
});
