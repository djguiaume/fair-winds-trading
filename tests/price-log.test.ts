import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { quoteBuy } from '../src/sim/market';
import { priceTrend, stepMarketsLogged } from '../src/sim/priceLog';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { sparkline, trendWords } from '../src/ui/harbour/trend';

const day = TUNING.weather.daylight.daySeconds;
const port = PHASE1_MAP.ports[0]!;
const good = port.produces[0]!;

describe("the harbour ledger's price line (#443)", () => {
  it("starts with today's price alone, then logs one price per day that ends", () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const market = world.trade.markets[port.id]!;
    expect(priceTrend(world.trade, port.id, good)).toEqual([quoteBuy(market, good, 1)]);
    stepMarketsLogged(world.trade, day * 0.5);
    expect(priceTrend(world.trade, port.id, good)).toHaveLength(1);
    stepMarketsLogged(world.trade, day * 2);
    expect(priceTrend(world.trade, port.id, good)).toHaveLength(3);
  });

  it('keeps the last days only, even across a long sleep', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const kept = TUNING.ui.priceLogDays;
    stepMarketsLogged(world.trade, day * (kept + 30));
    expect(priceTrend(world.trade, port.id, good)).toHaveLength(kept + 1);
  });

  it("follows the stock: a market sold out since yesterday's close is up today", () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    stepMarketsLogged(world.trade, day);
    world.trade.markets[port.id]!.stock[good] = 0;
    const prices = priceTrend(world.trade, port.id, good);
    expect(prices.at(-1)!).toBeGreaterThan(prices[0]!);
    expect(trendWords(prices)).toMatch(/^Up \d+ since yesterday/);
  });

  it('has nothing for a good the port does not trade', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    expect(priceTrend(world.trade, 'nowhere', good)).toEqual([]);
  });

  it('draws one price as a flat dash and several as a line', () => {
    expect(sparkline([], 96, 28)).toBe('');
    expect(sparkline([10], 96, 28)).toContain('stroke-dasharray');
    expect(sparkline([10, 12, 9], 96, 28)).toContain('<polyline');
    expect(trendWords([10])).toBe('First day on the books here.');
  });
});
