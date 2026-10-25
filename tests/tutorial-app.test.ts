// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import html from '../index.html?raw';
import type { World } from '../src/sim/world';
import type { Input } from '../src/input/input';
import type { QuestBook } from '../src/sim/quests';
import { pointOf } from '../src/sim/questLibrary';

// Exercise real app wiring and native-dialog lifecycle without needing a WebGL renderer.
vi.mock('../src/render/view', () => ({
  GameView: class {
    harbours = {
      calda: { x: 152, y: 240 },
      saltmere: { x: 252, y: -134 },
      westholm: { x: -280, y: 40 },
      stonehaven: { x: -140, y: -270 },
    };
    resize() {}
    render() {}
    setQuality() {}
    setSettlementLevels() {}
    setHomeBuildings() {}
    setQuestsDone() {}
    setPennant() {}
    jumpToBoat() {}
    setFocus() {}
    setZoom() {}
    getZoom() {
      return 1;
    }
    project() {
      return { x: 300, y: 300, onScreen: true };
    }
  },
}));
afterEach(() => vi.unstubAllGlobals());

it('offers a fresh tutorial, pauses planning, completes real trades, then replays without resetting the voyage', async () => {
  localStorage.clear();
  document.body.innerHTML = html
    .split('<body>')[1]!
    .split('</body>')[0]!
    .replace(/<script[\s\S]*?<\/script>/g, '');
  window.history.replaceState(null, '', '/?debug');
  vi.stubGlobal('__BUILD_REVISION__', 'test');
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({} as WebGL2RenderingContext);
  await import('../src/main');
  const { world, input, quests } = (
    window as unknown as { fwt: { world: World; input: Input; quests: QuestBook } }
  ).fwt;
  // The tutorial is an ordinary quest (decision 0151).
  const step = () => quests.progress('first-voyage')?.step;
  const click = (id: string) => {
    const el = document.querySelector<HTMLButtonElement>(id)!;
    expect(el, id).not.toBeNull();
    el.focus();
    el.click();
  };
  const offer = document.getElementById('tutorial-offer') as HTMLDialogElement;
  const chart = document.getElementById('chart') as HTMLDialogElement;
  const flushClose = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  click('#menu-play');
  // A fresh voyage starts by picking a difficulty level, Captain preselected (decision 0083).
  const picker = document.getElementById('new-voyage')!;
  expect(picker.hidden).toBe(false);
  expect(input.isEnabled).toBe(false);
  expect(picker.querySelector('[data-level="captain"]')!.getAttribute('aria-checked')).toBe('true');
  click('#set-sail');
  expect(picker.hidden).toBe(true);
  expect(world.trade.difficulty).toBe('captain');
  expect(offer.open).toBe(true);
  expect(input.isEnabled).toBe(false);
  click('#tutorial-start');
  await flushClose();
  expect(offer.open).toBe(false);
  expect(input.isEnabled).toBe(true);
  // The prologue starts alone at sea (decision 0127).
  expect(world.boat.x).toBe(world.map.prologue!.start.x);
  expect(world.trade.dockedAt).toBeNull();
  click('#tutorial-continue');
  click('#tutorial-action'); // Existing compass tacking illustration.
  expect((document.getElementById('wind-help') as HTMLDialogElement).open).toBe(true);
  expect(input.isEnabled).toBe(false);
  click('#close-wind-help');
  await flushClose();
  expect(input.isEnabled).toBe(true);
  click('#tutorial-continue');
  expect(step()).toBe('foghorn');
  // Come alongside the wreck slowly; the sim loop would check every quarter second.
  const wreck = pointOf(world.map, 'wreck')!;
  Object.assign(world.boat, { x: wreck.x + 12, y: wreck.y, speedKn: 0.5 });
  for (let n = 0; n < 8; n++) quests.check(0.5);
  // Rook's card at the rescue (decision 0185), then the chart lesson's bubble.
  expect(step()).toBe('aboard');
  expect((document.getElementById('quest-card') as HTMLDialogElement).open).toBe(true);
  click('#quest-card [data-option="welcome"]');
  expect(step()).toBe('chart');
  // The coach mark rings the Map button; tapping it opens the chart, and Rook asks for home.
  click('#chart-btn');
  expect(chart.open).toBe(true);
  expect(input.isEnabled).toBe(false);
  click('[data-compare="saltmere"]');
  expect(world.destination?.portId).toBe('saltmere');
  click('#close-chart');
  await flushClose();
  expect(input.isEnabled).toBe(true);
  Object.assign(world.boat, { x: 252, y: -134, speedKn: 0 });
  click('.port-marker[data-port-id="saltmere"]');
  expect(world.trade.dockedAt).toBe('saltmere');
  // Rook thanks her on the quay, on his card (decision 0190), then the island lesson.
  expect(step()).toBe('thanks');
  const card = document.getElementById('quest-card') as HTMLDialogElement;
  expect(card.open).toBe(true);
  expect(card.querySelector('.quest-speech')!.textContent).toContain('swimming for it');
  click('#quest-card [data-option="continue"]');
  expect(card.open).toBe(false);
  expect(step()).toBe('island');
  click('#tutorial-continue');
  expect(step()).toBe('buy');
  expect(input.isEnabled).toBe(false);
  click('[data-action="buy"][data-good="fish"][data-qty="1"]');
  expect(world.trade.captain.cargo.fish).toBe(1);
  expect(document.querySelector('#tutorial-market .tutorial-card')!.textContent).toContain(
    'Find a buyer',
  );
  click('#tutorial-action');
  expect(chart.open).toBe(true);
  click('[data-compare="calda"]');
  click('#close-chart');
  await flushClose();
  world.trade.dockedAt = null;
  Object.assign(world.boat, { x: 152, y: 240, speedKn: 0 });
  click('.port-marker[data-port-id="calda"]');
  click('#tp-sell-all');
  expect(world.trade.captain.cargo.fish).toBe(0);
  expect(quests.isDone('first-voyage')).toBe(true);
  expect(document.querySelector('#tutorial-market .tutorial-card')!.textContent).toContain(
    'First delivery complete',
  );
  click('#tutorial-finish');
  click('#tp-close');
  await flushClose();
  expect(input.isEnabled).toBe(true);
  const before = JSON.stringify(world.trade);
  click('#menu-btn');
  // Once the tutorial is done, the menu offers Rook's sailing lessons instead (decision 0164).
  expect(document.getElementById('menu-tutorial-label')!.textContent).toBe('Sailing lessons');
  click('#menu-tutorial');
  expect(offer.open).toBe(false);
  expect(quests.isRunning('sailing-lessons')).toBe(true);
  expect(quests.isRunning('first-voyage')).toBe(false);
  expect(document.querySelector('.tutorial-card')!.textContent).toMatch(
    /Sail out to the course|Hoist and lower sails/,
  );
  expect(input.isEnabled).toBe(true);
  click('#menu-btn');
  expect(document.getElementById('menu-tutorial-label')!.textContent).toBe('Continue the lessons');
  // Rook's course off Saltmere: the boat is taken there; the voyage is otherwise untouched.
  expect([world.boat.x, world.boat.y]).toEqual([300, -85]);
  const kept = (trade: object) => JSON.stringify({ ...trade, quests: null, dockedAt: null });
  expect(kept(world.trade)).toBe(kept(JSON.parse(before)));
  context.mockRestore();
});
