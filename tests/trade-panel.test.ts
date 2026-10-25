// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { quoteBuy, quoteSell } from '../src/sim/market';
import { CUTTER, SLOOP } from '../src/sim/ship';
import { homePort } from '../src/sim/shipyards';
import { stockLevels, upgradePrice } from '../src/sim/upgrades';
import { createWorld } from '../src/sim/world';
import { TradePanel } from '../src/ui/tradePanel';
import { loadSettings, saveSettings } from '../src/ui/settings';

function setup() {
  const world = createWorld(PHASE1_MAP, SLOOP);
  // The home port: the only shipyard with upgrades and ship changes (decision 0048).
  world.trade.dockedAt = homePort(PHASE1_MAP).id;
  document.body.innerHTML = '<button id="return">Harbour</button><div id="panel" hidden></div>';
  const container = document.querySelector<HTMLElement>('#panel')!;
  const panel = new TradePanel(container, world);
  const click = (selector: string) => {
    const button = container.querySelector<HTMLButtonElement>(selector);
    expect(button, selector).not.toBeNull();
    button!.focus();
    button!.click();
  };
  return { world, container, panel, click };
}

beforeEach(() => localStorage.clear());

describe('harbour UI with real trade state', () => {
  for (const mode of ['adult', 'kids'] as const) {
    it(`${mode}: displayed buy and sell quotes equal the gold movement`, () => {
      const { world, panel, container, click } = setup();
      panel.uiMode = mode;
      const market = world.trade.markets[world.trade.dockedAt!]!;
      market.stock.fish = 19.5;
      const price = quoteBuy(market, 'fish', 1);
      const gold = world.trade.captain.gold;
      const action = vi.fn();
      panel.onAction = action;
      panel.open();
      expect(
        container.querySelector('[data-action="buy"][data-good="fish"]')!.textContent,
      ).toContain(String(price));
      click('[data-action="buy"][data-good="fish"][data-qty="1"]');
      expect(world.trade.captain.gold).toBe(gold - price);
      expect(world.trade.captain.cargo.fish).toBe(1);
      const income = quoteSell(market, 'fish', 1);
      expect(
        container.querySelector('[data-action="sell"][data-good="fish"]')!.textContent,
      ).toContain(String(income));
      click('[data-action="sell"][data-good="fish"][data-qty="1"]');
      expect(world.trade.captain.gold).toBe(gold - price + income);
      expect(action).toHaveBeenCalledTimes(2);
    });

    it(`${mode}: buys upgrades and Cutter, then switches back to Sloop`, () => {
      const { world, panel, click } = setup();
      panel.uiMode = mode;
      world.trade.captain.gold = 10_000;
      const price = upgradePrice(SLOOP, stockLevels(), 'sails')!;
      panel.open('shipyard');
      click('[data-track="sails"]');
      expect(world.trade.captain.ships.sloop!.sails).toBe(2);
      expect(world.trade.captain.gold).toBe(10_000 - price);
      click('[data-ship-buy="cutter"]');
      expect(world.trade.captain.activeShip).toBe('cutter');
      expect(world.trade.captain.gold).toBe(10_000 - price - CUTTER.price);
      click('[data-ship-switch="sloop"]');
      expect(world.trade.captain.activeShip).toBe('sloop');
    });

    it(`${mode}: prevents changing to a boat too small for the cargo`, () => {
      const { world, panel, container } = setup();
      panel.uiMode = mode;
      world.trade.captain.gold = 10_000;
      world.trade.captain.cargo.fish = 17;
      panel.open('shipyard');
      expect(container.querySelector('[data-ship-buy="cutter"]')).toBeNull();
      expect(container.textContent).toContain('Cargo too big');
      world.trade.captain.ships.cutter = stockLevels();
      world.trade.captain.activeShip = 'cutter';
      world.trade.captain.cargo.fish = 15;
      panel.render();
      expect(container.querySelector('[data-ship-switch="sloop"]')).toBeNull();
    });
  }

  it('keeps keyboard focus and scroll during trades and traps Tab/Escape', () => {
    const { panel, container, click } = setup();
    const opener = document.querySelector<HTMLButtonElement>('#return')!;
    opener.focus();
    panel.open();
    const modal = container.querySelector<HTMLElement>('.trade-modal')!;
    modal.scrollTop = 250;
    click('[data-action="buy"][data-good="fish"]');
    expect(container.querySelector('.trade-modal')!.scrollTop).toBe(250);
    expect((document.activeElement as HTMLElement).dataset.action).toBe('buy');
    const close = container.querySelector<HTMLButtonElement>('#tp-close')!;
    const last = container.querySelector<HTMLButtonElement>('#tp-undock')!;
    last.focus();
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(container.querySelector('button'));
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.isOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('keeps the focus on a Sell button that greys after the last sale (decision 0192)', () => {
    const { world, panel, container, click } = setup();
    world.trade.captain.cargo.fish = 1;
    panel.open();
    const gold = world.trade.captain.gold;
    click('[data-action="sell"][data-good="fish"]');
    const sell = document.activeElement as HTMLButtonElement;
    // Not the close button: the next A must not leave the port.
    expect(sell.dataset.action).toBe('sell');
    expect(sell.getAttribute('aria-disabled')).toBe('true');
    const after = world.trade.captain.gold;
    expect(after).toBeGreaterThan(gold);
    sell.click();
    expect(world.trade.captain.gold).toBe(after);
    expect(container.querySelector('[data-pad="steps"] [aria-pressed="true"]')!.textContent).toBe(
      '×1',
    );
  });

  it('reports a trade failure if state changed after drawing the quote', () => {
    const { world, panel, container, click } = setup();
    panel.open();
    world.trade.captain.gold = 0;
    click('[data-action="buy"][data-good="fish"]');
    expect(container.querySelector('[role="status"]')!.textContent).toContain('more gold');
    expect(world.trade.captain.cargo.fish).toBe(0);
  });

  it('hides the Kids mode switch while Kids mode is shelved (decision 0043)', () => {
    const { container, panel } = setup();
    panel.open();
    expect(container.querySelector('#tp-toggle-mode')).toBeNull();
  });

  it('falls back to Captain mode when a saved preference says Kids', () => {
    saveSettings({ ...loadSettings(), uiMode: 'kids' });
    expect(loadSettings().uiMode).toBe('adult');
  });
});

describe('full-screen port (decision 0049)', () => {
  it('buys and sells in lots, clamped to what the hold allows', () => {
    const { world, panel, container, click } = setup();
    world.trade.captain.gold = 10_000;
    panel.open();
    click('[data-lot="5"]');
    click('[data-action="buy"][data-good="fish"]');
    expect(world.trade.captain.cargo.fish).toBe(5);
    click('[data-lot="10"]');
    // Only 5 places left in a 10-place hold.
    expect(
      container.querySelector<HTMLButtonElement>('[data-action="buy"][data-good="fish"]')!.dataset
        .qty,
    ).toBe('5');
    expect(
      container.querySelector<HTMLButtonElement>('[data-action="sell"][data-good="fish"]')!.dataset
        .qty,
    ).toBe('5');
    click('#tp-sell-all');
    expect(world.trade.captain.cargo.fish).toBe(0);
  });

  it('counts open orders on the Orders tab and shows them there', () => {
    const { panel, container, click } = setup();
    panel.open();
    const badge = container.querySelector('#tp-tab-orders .tab-badge')!.textContent;
    click('#tp-tab-orders');
    const listed = container.querySelectorAll('.contract-list li').length;
    expect(listed).toBeGreaterThan(0);
    // The badge counts what the tab lists: undiscovered ports stay hidden (decision 0048).
    const here = container.querySelector('#tp-deliver') ? 1 : 0;
    expect(Number(badge)).toBe(listed + here);
  });
});
