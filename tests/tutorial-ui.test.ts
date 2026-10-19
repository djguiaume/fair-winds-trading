// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { Tutorial } from '../src/sim/tutorial';
import { createWorld } from '../src/sim/world';
import { TutorialCard } from '../src/ui/tutorial';
import { TradePanel } from '../src/ui/tradePanel';
import { SeaChart } from '../src/ui/seaChart';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = html
    .split('<body>')[1]!
    .split('</body>')[0]!
    .replace(/<script[\s\S]*?<\/script>/g, '');
});
const click = (selector: string) => {
  const b = document.querySelector<HTMLButtonElement>(selector)!;
  expect(b, selector).not.toBeNull();
  b.focus();
  b.click();
};
function setup(mode: 'adult' | 'kids' = 'adult') {
  const world = createWorld(PHASE1_MAP, SLOOP);
  const tutorial = new Tutorial(world, {}, localStorage);
  const card = new TutorialCard(tutorial);
  const panel = new TradePanel(document.getElementById('trade-panel')!, world);
  panel.uiMode = mode;
  tutorial.onChange = () => card.render();
  panel.onRender = () => card.render();
  panel.onTrade = (kind, good) => tutorial.traded(kind, good);
  const chart = new SeaChart(document.getElementById('chart') as HTMLDialogElement, world, {});
  chart.onDestinationChange = () => tutorial.destinationSelected();
  tutorial.start();
  return { world, tutorial, card, panel, chart };
}

describe('tutorial card in real UI surfaces', () => {
  it('moves one card between sea and chart; port selection and clearing drive the lesson', () => {
    const { tutorial, card, chart } = setup();
    card.setSurface('sea');
    expect(document.querySelectorAll('.tutorial-card')).toHaveLength(1);
    chart.open();
    tutorial.chartOpened();
    card.setSurface('chart');
    click('#chart-ports button');
    expect(tutorial.step).toBe('sails');
    expect(document.querySelectorAll('.tutorial-card')).toHaveLength(1);
    expect(document.querySelector('#tutorial-chart .tutorial-card')).not.toBeNull();
    click('#chart-clear-target');
    expect(tutorial.step).toBe('choose-port');
    chart.close();
    card.setSurface('sea');
    expect(document.querySelector('#tutorial-sea .tutorial-card')).not.toBeNull();
  });
  it('collapses without pausing play and gives focus back when skipped', () => {
    const { tutorial, card } = setup();
    card.setSurface('sea');
    click('#tutorial-collapse');
    expect(document.getElementById('tutorial-collapse')!.getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(document.getElementById('tutorial-action')).toBeNull();
    expect(tutorial.isActive).toBe(true);
    click('#tutorial-collapse');
    click('#tutorial-skip');
    expect(document.querySelector<HTMLElement>('.tutorial-card')!.hidden).toBe(true);
    expect(document.activeElement?.id).toBe('menu-btn');
  });
  for (const mode of ['adult', 'kids'] as const) {
    it(`${mode}: real market buys and Sell All complete the tutorial; failed buys do not advance`, () => {
      const { world, tutorial, card, panel } = setup(mode);
      world.destination = { portId: 'calda', label: 'Port Calda', x: 0, y: 0 };
      tutorial.destinationSelected();
      tutorial.continueLesson();
      tutorial.continueLesson();
      world.trade.dockedAt = 'calda';
      tutorial.observe();
      panel.open();
      card.setSurface('market');
      expect(tutorial.step).toBe('buy');
      world.trade.captain.gold = 0;
      // Stale button still invokes the real API and must not advance the lesson.
      click('[data-action="buy"][data-good="timber"][data-qty="1"]');
      expect(tutorial.step).toBe('buy');
      world.trade.captain.gold = 120;
      panel.render();
      click('[data-action="buy"][data-good="timber"][data-qty="1"]');
      expect(tutorial.step).toBe('choose-delivery');
      expect(document.querySelector('#tutorial-market .tutorial-card')).not.toBeNull();
      world.destination = { portId: 'saltmere', label: 'Saltmere', x: 0, y: 0 };
      tutorial.destinationSelected();
      world.trade.dockedAt = 'saltmere';
      tutorial.observe();
      panel.render();
      click('#tp-sell-all');
      expect(tutorial.status).toBe('completed');
      expect(world.destination).toBeNull();
      expect(document.querySelector('#tutorial-market .tutorial-card')!.textContent).toContain(
        'First delivery complete',
      );
      click('#tutorial-finish');
      expect(document.querySelector<HTMLElement>('.tutorial-card')!.hidden).toBe(true);
    });
  }
});
