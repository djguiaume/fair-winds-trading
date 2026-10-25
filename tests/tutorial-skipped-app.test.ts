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

it('Free sailing on a fresh voyage still plays the prologue, without the coach (decision 0160)', async () => {
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
  const { world, quests } = (
    window as unknown as { fwt: { world: World; input: Input; quests: QuestBook } }
  ).fwt;
  const click = (id: string) => {
    const el = document.querySelector<HTMLButtonElement>(id)!;
    expect(el, id).not.toBeNull();
    el.click();
  };
  const offer = document.getElementById('tutorial-offer') as HTMLDialogElement;
  const bubble = () => document.querySelector<HTMLElement>('.tutorial-card');
  click('#menu-play');
  click('#set-sail');
  expect(offer.open).toBe(true);
  click('#tutorial-free');
  await new Promise((resolve) => setTimeout(resolve, 0));
  // Alone at sea at the prologue's spot, sails down: not beside Saltmere with full sails.
  const start = world.map.prologue!.start;
  expect([world.boat.x, world.boat.y]).toEqual([start.x, start.y]);
  expect(world.boat.sailStep).toBe(0);
  expect(world.trade.dockedAt).toBeNull();
  // The story runs, its lessons do not.
  expect(quests.progress('first-voyage')?.step).toBe('foghorn');
  expect(quests.isCoached('first-voyage')).toBe(false);
  expect(bubble()?.hidden ?? true).toBe(true);
  // The story keeps the sea: the sailing lessons wait until it is over (decision 0164).
  expect(document.getElementById('menu-tutorial-label')!.textContent).toBe('Sailing lessons');
  expect(document.querySelector<HTMLButtonElement>('#menu-tutorial')!.disabled).toBe(true);
  const wreck = pointOf(world.map, 'wreck')!;
  Object.assign(world.boat, { x: wreck.x + 12, y: wreck.y, speedKn: 0.5 });
  for (let n = 0; n < 8; n++) quests.check(0.5);
  // Rook speaks at the rescue on his own card, even without the coach (decision 0184).
  const card = document.getElementById('quest-card') as HTMLDialogElement;
  expect(quests.progress('first-voyage')?.step).toBe('aboard');
  expect(card.open).toBe(true);
  expect(card.querySelector('h2')!.textContent).toBe('Rook');
  expect(card.querySelector('.quest-speech')!.textContent).toContain(
    'Harbourmaster Rook, of Saltmere',
  );
  click('#quest-card [data-option="continue"]');
  expect(card.open).toBe(false);
  expect(quests.progress('first-voyage')?.step).toBe('home');
  Object.assign(world.boat, { x: 252, y: -134, speedKn: 0 });
  click('.port-marker[data-port-id="saltmere"]');
  expect(world.trade.dockedAt).toBe('saltmere');
  expect(quests.isDone('first-voyage')).toBe(true);
  // No "First delivery complete" bubble; Rook's thanks speaks on its own card.
  expect(bubble()?.hidden ?? true).toBe(true);
  expect(quests.progress('rooks-thanks')).toBeDefined();
  expect((document.getElementById('quest-card') as HTMLDialogElement).open).toBe(true);
  context.mockRestore();
});
