// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { quoteAcross, quoteBuy, quoteSell, topNeed } from '../src/sim/market';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { SeaChart } from '../src/ui/seaChart';
import { TradePanel } from '../src/ui/tradePanel';

/** Charted ports at the start: the hidden yards join once discovered (decision 0048). */
const ids = PHASE1_MAP.ports.filter((p) => !p.hidden).map((p) => p.id);

describe('top needs and market overview (decision 0036)', () => {
  it('names a wanted good as each port top need, and it moves when you fill it', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    for (const port of PHASE1_MAP.ports) {
      const market = world.trade.markets[port.id]!;
      const need = topNeed(market);
      expect(port.wants).toContain(need);
      market.stock[need] = 200; // the player floods it
      expect(topNeed(market)).not.toBe(need);
    }
  });

  it('quotes the same next-unit prices the harbour charges', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const quotes = quoteAcross(world.trade.markets, 'fish', ids);
    expect(quotes.map((q) => q.portId)).toEqual(ids);
    for (const q of quotes) {
      const market = world.trade.markets[q.portId]!;
      expect(q.buy).toBe(quoteBuy(market, 'fish', 1));
      expect(q.sell).toBe(quoteSell(market, 'fish', 1));
    }
  });

  it('shows needs on the chart and a price table that sets a bearing', () => {
    document.body.innerHTML = '<dialog id="chart"></dialog>';
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.captain.cargo.timber = 4;
    const chart = new SeaChart(document.querySelector('dialog')!, world, {});
    chart.open();
    expect(document.querySelectorAll('.chart-need')).toHaveLength(ids.length);
    // Opens on the good in the hold, named in the cartouche and picked on the Prices page.
    expect(document.querySelector('#chart-prices-on')!.textContent).toContain('Timber');
    const active = document.querySelector('#chart-market-goods [aria-pressed="true"]')!;
    expect(active.textContent).toContain('Timber');
    const rows = document.querySelectorAll('#chart-prices [data-compare]');
    expect(rows).toHaveLength(ids.length);
    expect(document.querySelector('#chart-prices')!.textContent).toContain('pays most');
    document.querySelector<HTMLButtonElement>('#chart-market-goods [data-good="stone"]')!.click();
    expect(
      document.querySelector('#chart-market-goods [aria-pressed="true"]')!.textContent,
    ).toContain('Stone');
    // Names only (decision 0058): the cartouche's clear leaves only the port names.
    document.querySelector<HTMLButtonElement>('#chart-clear-prices')!.click();
    expect(document.querySelectorAll('.chart-need')).toHaveLength(0);
    expect(document.querySelector<HTMLElement>('#chart-prices-on')!.hidden).toBe(true);
    document.querySelector<HTMLButtonElement>(`[data-compare="westholm"]`)!.click();
    expect(world.destination?.portId).toBe('westholm');
  });

  it('tells the harbour where each good sells best elsewhere', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.dockedAt = 'saltmere';
    document.body.innerHTML = '<div id="panel" hidden></div>';
    const panel = new TradePanel(document.querySelector<HTMLElement>('#panel')!, world);
    panel.open();
    const best = quoteAcross(
      world.trade.markets,
      'fish',
      ids.filter((id) => id !== 'saltmere'),
    ).sort((a, b) => b.sell - a.sell)[0]!;
    const name = PHASE1_MAP.ports.find((p) => p.id === best.portId)!.name;
    expect(document.body.textContent).toContain(`${name} pays ${best.sell}`);
  });
});
