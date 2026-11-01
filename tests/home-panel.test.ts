// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { giveHomeIsland, offerHomeSpot } from '../src/sim/home';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { HomePanel } from '../src/ui/homePanel';

/** Her island at its pier on the harbour's paper (decisions 0126, 0210; issue #443). */
function setup() {
  const world = createWorld(PHASE1_MAP, SLOOP);
  world.trade.captain.gold = 10_000;
  giveHomeIsland(world.trade, PHASE1_MAP);
  offerHomeSpot(world.trade, PHASE1_MAP, 'spot-1');
  world.trade.home.docked = 'skerry';
  document.body.innerHTML = '<div id="home-ui"></div>';
  const panel = new HomePanel(document.getElementById('home-ui')!, world);
  panel.giverOf = () => ({ name: 'Ines', port: 'Saltmere' });
  const chosen: (string | null)[] = [];
  panel.onChosen = (_island, spot) => chosen.push(spot);
  const built: string[] = [];
  panel.onBuilt = (b) => built.push(b.id);
  panel.update();
  panel.open();
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
  /** A tap: the button takes the focus, then the click (happy-dom's click alone does not). */
  const press = (b: HTMLElement) => {
    b.focus();
    b.click();
  };
  return { world, panel, chosen, built, $, press };
}

describe('the home island on the harbour paper (#443)', () => {
  it('has the harbour header, the plots as ledger rows and the picked plot beside them', () => {
    const { $ } = setup();
    expect($('.home-screen .hb-head .ui-header-title')!.textContent).toBe('Skerry');
    expect($('.hb-line')!.textContent).toContain('1 plot to build');
    expect($('#home-tab-island .tab-badge')!.textContent).toBe('1');
    const rows = document.querySelectorAll('.hb-plot');
    expect(rows[0]!.classList).toContain('is-open');
    expect(rows[0]!.textContent).toContain('Ines’s plot');
    expect(rows[1]!.classList).toContain('is-locked');
    expect($('.hb-plot-detail .hb-detail-name')!.textContent).toBe('Ines’s plot');
    expect(document.querySelectorAll('.hb-plot-detail .hb-building')).toHaveLength(2);
    // Not chosen yet: no Build button, the way to see it on the island.
    expect($('[data-build]')).toBeNull();
    expect($('[data-choose="spot-1"]')).not.toBeNull();
    expect(document.documentElement.dataset.screen).toBe('home');
  });

  it('picks another plot, then chooses one: the paper steps aside and Build builds', () => {
    const { panel, chosen, built, $, press } = setup();
    press(document.querySelectorAll<HTMLElement>('.hb-plot')[1]!);
    expect(document.activeElement).toBe(document.querySelectorAll('.hb-plot')[1]);
    expect($('.hb-plot-detail .hb-detail-name')!.textContent).not.toBe('Ines’s plot');
    expect($('[data-choose]')).toBeNull();
    press(document.querySelectorAll<HTMLElement>('.hb-plot')[0]!);
    press($('[data-choose="spot-1"]')!);
    expect(chosen).toEqual(['spot-1']);
    expect(panel.chosen).toEqual({ island: 'skerry', spot: 'spot-1' });
    expect($('.home-screen')!.classList).toContain('is-half');
    expect($('.hb-plots')).toBeNull();
    expect(document.activeElement).toBe($('[data-build]'));
    $('[data-build="workshop"]')!.click();
    expect(built).toEqual(['workshop']);
    expect(panel.chosen).toBeNull();
    expect($('.hb-plot.is-built')!.textContent).toContain('Workshop');
  });

  it('goes back from a chosen plot, then closes; Set sail closes too', () => {
    const { panel, chosen, $ } = setup();
    $('[data-choose="spot-1"]')!.click();
    panel.back();
    expect(chosen).toEqual(['spot-1', null]);
    expect(panel.isOpen).toBe(true);
    panel.back();
    expect(panel.isOpen).toBe(false);
    expect(document.documentElement.dataset.screen).toBeUndefined();
    panel.open();
    $('#home-undock')!.click();
    expect(panel.isOpen).toBe(false);
  });

  it('stores and takes crates on the Warehouse tab', () => {
    const { world, panel, $ } = setup();
    world.trade.home.islands.skerry!.built['spot-1'] = 'warehouse';
    world.trade.captain.cargo.fish = 3;
    panel.render();
    $('#home-tab-warehouse')!.click();
    $('[data-store="in"][data-good="fish"][data-n="3"]')!.click();
    expect(world.trade.captain.cargo.fish).toBe(0);
    expect($('.hb-store-row .hb-c-kept b')!.textContent).toBe('3');
    $('[data-store="out"][data-good="fish"][data-n="1"]')!.click();
    expect(world.trade.captain.cargo.fish).toBe(1);
  });
});
