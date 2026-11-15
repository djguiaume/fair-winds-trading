// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { PHASE1_MAP } from '../src/data/maps';
import { TutorialCoach } from '../src/ui/tutorial';
import { TradePanel } from '../src/ui/tradePanel';
import { SeaChart } from '../src/ui/seaChart';
import { Hud } from '../src/ui/hud';
import { MARKET, TUTORIAL, tutorialVoyage } from './helpers/tutorial';

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
/** The coach on the real sea, chart and harbour screen, wired like the game (decision 0151). */
function setup() {
  const v = tutorialVoyage();
  const { world, quests } = v;
  // The sea HUD builds its own buttons (issue #441): Map, Menu and the sails the coach rings.
  new Hud(world, { seen: true, markSeen: () => {} });
  const card = new TutorialCoach(quests, v.harbours);
  const panel = new TradePanel(document.getElementById('trade-panel')!, world);
  quests.onEvent = (e) => {
    if (e.type === 'finished' && (e.quest === TUTORIAL || e.quest === MARKET))
      card.finished = e.quest;
    card.render();
  };
  panel.onRender = () => card.render();
  panel.onAction = () => {
    quests.check();
    card.render();
  };
  card.onOption = (quest, option) => quests.choose(quest, option);
  card.onSkip = (quest) => {
    quests.drop(quest);
    card.render();
  };
  const chart = new SeaChart(document.getElementById('chart') as HTMLDialogElement, world, {});
  chart.onDestinationChange = () => quests.check();
  v.start();
  return { ...v, v, card, panel, chart };
}

describe('tutorial coach marks in real UI surfaces', () => {
  it('moves one card between sea and chart, with no way to pick a port in the first voyage', () => {
    const { v, card, chart } = setup();
    v.rescue();
    card.setSurface('sea');
    expect(document.querySelectorAll('.tutorial-card')).toHaveLength(1);
    chart.open();
    v.screen('chart');
    card.setSurface('chart');
    // Rook's way home is the compass arrow and the pier flag: the chart lesson is gone (v1.11).
    expect(v.step).toBe('home');
    click('[data-compare="calda"]');
    expect(v.step).toBe('home');
    expect(document.querySelectorAll('.tutorial-card')).toHaveLength(1);
    expect(document.querySelector('#tutorial-chart .tutorial-card')).not.toBeNull();
    click('#tutorial-skip');
    expect(v.running).toBe(false);
    expect(document.querySelector<HTMLElement>('.tutorial-card')!.hidden).toBe(true);
  });

  it('shows the step title with no counter, and the Continue button the step offers', () => {
    const { v, card } = setup();
    card.setSurface('sea');
    expect(document.querySelector('.coach h3')!.textContent).toBe('Sails and steering');
    click('#tutorial-continue');
    expect(v.step).toBe('wind');
    expect(document.querySelector('.coach h3')!.textContent).toBe('Let the wind help');
  });

  it(`real market buys and Sell All complete the tutorial; failed buys do not advance`, () => {
    const { v, world, card, panel } = setup();
    v.reachMarket();
    panel.open();
    v.screen('market');
    card.setSurface('market');
    expect(v.step).toBe('buy');
    world.trade.captain.gold = 0;
    // Stale button still invokes the real API and must not advance the lesson.
    click('[data-action="buy"][data-good="fish"][data-qty="1"]');
    expect(v.step).toBe('buy');
    world.trade.captain.gold = 120;
    panel.render();
    click('[data-action="buy"][data-good="fish"][data-qty="1"]');
    expect(v.step).toBe('choose-delivery');
    expect(document.querySelector('#tutorial-market .tutorial-card')).not.toBeNull();
    v.course('calda');
    world.trade.dockedAt = null;
    v.dock('calda');
    panel.render();
    click('#tp-sell-all');
    expect(v.quests.isDone(MARKET)).toBe(true);
    expect(document.querySelector('#tutorial-market .tutorial-card')!.textContent).toContain(
      'First delivery complete',
    );
    click('#tutorial-finish');
    expect(document.querySelector<HTMLElement>('.tutorial-card')!.hidden).toBe(true);
  });
});

describe('coach marks (decision 0061)', () => {
  it('rings the element to tap and puts the bubble beside it', () => {
    const { card } = setup();
    const target = document.getElementById('sail-lever')!;
    target.getBoundingClientRect = () => new DOMRect(80, 600, 120, 48);
    card.setSurface('sea');
    const ring = document.querySelector<HTMLElement>('.coach-ring')!;
    const bubble = document.querySelector<HTMLElement>('.coach')!;
    expect(ring.hidden).toBe(false);
    expect(ring.style.left).toBe('74px');
    expect(bubble.dataset.side).toBe('top');
  });

  it('falls back to an unpinned bubble with its action button when nothing is on screen', () => {
    const { v, card } = setup();
    v.cont();
    card.setSurface('sea');
    expect(document.querySelector<HTMLElement>('.coach-ring')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.coach')!.dataset.side).toBe('none');
    expect(document.getElementById('tutorial-action')).not.toBeNull();
  });

  it('points at home for Rook, the cheap good in the market, then the nearest harbour', () => {
    const { v, world, quests } = setup();
    v.rescue();
    expect(v.lesson!.port).toBe('saltmere');
    v.course('saltmere');
    v.dock('saltmere');
    v.cont();
    v.cont();
    quests.ask(MARKET);
    expect(v.step).toBe('buy');
    expect(v.lesson!.good).toBe('fish');
    // Buying, then losing the cargo at sea: the lesson asks for a harbour, the nearest one.
    world.trade.captain.cargo.fish = 1;
    v.check();
    v.course(null);
    world.trade.dockedAt = null;
    world.trade.captain.cargo.fish = 0;
    v.check();
    expect(v.step).toBe('dock');
    const calda = PHASE1_MAP.islands.find(
      (i) => i.id === PHASE1_MAP.ports.find((p) => p.id === 'calda')!.islandId,
    )!;
    Object.assign(world.boat, { x: calda.x + 5, y: calda.y });
    expect(v.lesson!.port).toBe('calda');
  });
});
