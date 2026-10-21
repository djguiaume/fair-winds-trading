// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { Tutorial } from '../src/sim/tutorial';
import { createWorld } from '../src/sim/world';
import { TutorialCoach } from '../src/ui/tutorial';
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
  const card = new TutorialCoach(tutorial);
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

describe('tutorial coach marks in real UI surfaces', () => {
  it('moves one card between sea and chart; port selection and clearing drive the lesson', () => {
    const { tutorial, card, chart } = setup();
    card.setSurface('sea');
    expect(document.querySelectorAll('.tutorial-card')).toHaveLength(1);
    chart.open();
    tutorial.chartOpened();
    card.setSurface('chart');
    click('[data-compare="calda"]');
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

describe('coach marks (decision 0061)', () => {
  it('rings the element to tap and puts the bubble beside it', () => {
    const { card } = setup();
    const target = document.getElementById('chart-btn')!;
    target.getBoundingClientRect = () => new DOMRect(80, 600, 120, 48);
    card.setSurface('sea');
    const ring = document.querySelector<HTMLElement>('.coach-ring')!;
    const bubble = document.querySelector<HTMLElement>('.coach')!;
    expect(ring.hidden).toBe(false);
    expect(ring.style.left).toBe('74px');
    expect(bubble.dataset.side).toBe('top');
    // The ring replaces the bubble's own "Open map" button.
    expect(document.getElementById('tutorial-action')).toBeNull();
  });
  it('falls back to an unpinned bubble with its action button when nothing is on screen', () => {
    const { card } = setup();
    card.setSurface('sea');
    expect(document.querySelector<HTMLElement>('.coach-ring')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.coach')!.dataset.side).toBe('none');
    expect(document.getElementById('tutorial-action')).not.toBeNull();
  });
  it('points at the nearest harbour on the chart and the cheap good in the market', () => {
    const { world, tutorial } = setup();
    const saltmere = PHASE1_MAP.islands.find(
      (i) => i.id === PHASE1_MAP.ports.find((p) => p.id === 'saltmere')!.islandId,
    )!;
    Object.assign(world.boat, { x: saltmere.x + 5, y: saltmere.y });
    expect(tutorial.pointerPort).toBe('saltmere');
    world.destination = { portId: 'calda', label: 'Port Calda', x: 0, y: 0 };
    tutorial.destinationSelected();
    tutorial.continueLesson();
    tutorial.continueLesson();
    world.trade.dockedAt = 'calda';
    tutorial.observe();
    expect(tutorial.step).toBe('buy');
    expect(tutorial.pointerGood).toBe(PHASE1_MAP.ports.find((p) => p.id === 'calda')!.produces[0]);
  });
});
