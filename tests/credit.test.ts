import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { deliverContract } from '../src/sim/contracts';
import { cheapestLoad, creditOffer, leavesShort, takeCredit } from '../src/sim/credit';
import { quoteBuy } from '../src/sim/market';
import { applySave, serializeWorld, validateSave } from '../src/sim/save';
import { packSave, unpackSave } from '../src/sim/saveCode';
import { SLOOP } from '../src/sim/ship';
import { DIFFICULTIES } from '../src/sim/difficulty';
import { cargoUsed, sell, setDifficulty, settleCredit } from '../src/sim/trade';
import { type World, createWorld } from '../src/sim/world';

/** A load on credit, and the warning before she spends her last gold (decision 0200). */

const MAP = PHASE1_MAP;

/** Docked at `portId` with every ring port charted, no gold and an empty hold. */
function broke(portId = MAP.ports[0]!.id): World {
  const w = createWorld(MAP, SLOOP);
  w.trade.progress.discovered = MAP.ports.filter((p) => !p.hidden).map((p) => p.id);
  w.trade.dockedAt = portId;
  w.trade.captain.gold = 0;
  return w;
}

describe('a load on credit (0200)', () => {
  it('every ring port lends a broke captain a load that pays, on every level', () => {
    for (const level of DIFFICULTIES)
      for (const port of MAP.ports.filter((p) => !p.site && !p.hidden)) {
        const w = broke(port.id);
        setDifficulty(w.trade, level);
        if (!cheapestLoad(w.trade)) continue; // a port that sells nothing lends nothing
        const offer = creditOffer(MAP, w.trade);
        expect(offer, `${level} ${port.id}`).not.toBeNull();
        expect(offer!.port).not.toBe(port.id);
        expect(offer!.qty).toBeGreaterThan(0);
        expect(w.trade.contracts.byPort[offer!.port]!.good).toBe(offer!.good);
      }
  });

  it('is offered only while she is broke, her hold is empty and she owes nothing', () => {
    const w = broke();
    w.trade.captain.gold = cheapestLoad(w.trade);
    expect(creditOffer(MAP, w.trade)).toBeNull();
    w.trade.captain.gold = 0;
    w.trade.captain.cargo.fish = 1;
    expect(creditOffer(MAP, w.trade)).toBeNull();
    w.trade.captain.cargo.fish = 0;
    expect(takeCredit(MAP, w.trade)).not.toBeNull();
    for (const g of Object.keys(w.trade.captain.cargo) as (keyof typeof w.trade.captain.cargo)[])
      w.trade.captain.cargo[g] = 0;
    expect(creditOffer(MAP, w.trade)).toBeNull();
  });

  it('puts the load in her hold at the port’s price, and she pays it back where she sells it', () => {
    const w = broke();
    const t = w.trade;
    const market = t.markets[t.dockedAt!]!;
    const offer = creditOffer(MAP, t)!;
    expect(offer.price).toBe(quoteBuy(market, offer.good, offer.qty));
    const stock = market.stock[offer.good];
    takeCredit(MAP, t);
    expect(t.captain.cargo[offer.good]).toBe(offer.qty);
    expect(market.stock[offer.good]).toBe(stock - offer.qty);
    expect(t.captain.gold).toBe(0);
    expect(t.captain.loan).toEqual({
      port: offer.port,
      good: offer.good,
      qty: offer.qty,
      owed: offer.price,
    });

    t.dockedAt = offer.port;
    const order = t.contracts.byPort[offer.port]!;
    if (order.qty <= offer.qty) {
      const r = deliverContract(t, MAP);
      expect(r.ok).toBe(true);
      expect(t.captain.gold).toBe(order.reward - offer.price);
      expect(t.captain.gold).toBeGreaterThan(0);
    } else {
      const r = sell(t, offer.good, offer.qty, MAP);
      expect(r.ok && t.captain.gold).toBe(r.ok ? Math.max(0, r.gold - offer.price) : false);
    }
    expect(t.captain.loan).toBeUndefined();
  });

  it('no deadline and nothing can fail: she pays what she has, and the loan is cleared', () => {
    const w = broke();
    const t = w.trade;
    const offer = takeCredit(MAP, t)!;
    // She sold the load somewhere else and spent most of it.
    t.captain.cargo[offer.good] = 0;
    t.captain.gold = 3;
    t.dockedAt = MAP.ports.find((p) => p.id !== offer.port)!.id;
    expect(settleCredit(t)).toBe(0);
    expect(t.captain.loan).toBeDefined();
    t.dockedAt = offer.port;
    expect(settleCredit(t, 'timber' === offer.good ? 'fish' : 'timber')).toBe(0);
    expect(settleCredit(t)).toBe(Math.min(3, offer.price));
    expect(t.captain.loan).toBeUndefined();
  });

  it('the loan survives a save, and a save code', () => {
    const w = broke();
    const offer = takeCredit(MAP, w.trade)!;
    const save = serializeWorld(w);
    expect(save.loan).toEqual({
      port: offer.port,
      good: offer.good,
      qty: offer.qty,
      owed: offer.price,
    });
    const fresh = createWorld(MAP, SLOOP);
    applySave(fresh, validateSave(JSON.parse(JSON.stringify(save)), fresh)!);
    expect(fresh.trade.captain.loan).toEqual(save.loan);
    const read = unpackSave(packSave(save, MAP), MAP, save.version);
    expect(read.ok && read.raw.loan).toEqual(save.loan);
    expect(
      validateSave({ ...save, loan: { port: 'nowhere', good: 'fish', qty: 1, owed: 1 } }, fresh)
        ?.loan,
    ).toBeUndefined();
  });

  it('warns before a purchase leaves her with an empty hold and less than the cheapest load', () => {
    const w = broke();
    const t = w.trade;
    const load = cheapestLoad(t);
    const market = t.markets[t.dockedAt!]!;
    expect(load).toBeGreaterThan(0);
    expect(load).toBeLessThanOrEqual(quoteBuy(market, 'fish', TUNING.economy.credit.loadUnits));
    t.captain.gold = load + 100;
    expect(leavesShort(t, 50)).toBe(false);
    expect(leavesShort(t, 101)).toBe(true);
    t.captain.cargo.fish = 2;
    expect(cargoUsed(t)).toBe(2);
    expect(leavesShort(t, 101)).toBe(false);
  });
});
