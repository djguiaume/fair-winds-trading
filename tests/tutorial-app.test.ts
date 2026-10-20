// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import html from '../index.html?raw';
import type { World } from '../src/sim/world';
import type { Input } from '../src/input/input';

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
  const { world, input } = (window as unknown as { fwt: { world: World; input: Input } }).fwt;
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
  expect(offer.open).toBe(true);
  expect(input.isEnabled).toBe(false);
  click('#tutorial-start');
  await flushClose();
  expect(offer.open).toBe(false);
  expect(input.isEnabled).toBe(true);
  click('#tutorial-action');
  expect(chart.open).toBe(true);
  expect(input.isEnabled).toBe(false);
  click('[data-compare="calda"]');
  expect(world.destination?.portId).toBe('calda');
  click('#close-chart');
  await flushClose();
  expect(input.isEnabled).toBe(true);
  click('#tutorial-continue');
  click('#tutorial-action'); // Existing compass tacking illustration.
  expect((document.getElementById('wind-help') as HTMLDialogElement).open).toBe(true);
  expect(input.isEnabled).toBe(false);
  click('#close-wind-help');
  await flushClose();
  expect(input.isEnabled).toBe(true);
  click('#tutorial-continue');
  Object.assign(world.boat, { x: 152, y: 240, speedKn: 0 });
  click('.port-marker[data-port-id="calda"]');
  expect(world.trade.dockedAt).toBe('calda');
  expect(input.isEnabled).toBe(false);
  click('[data-action="buy"][data-good="timber"][data-qty="1"]');
  expect(world.trade.captain.cargo.timber).toBe(1);
  expect(document.querySelector('#tutorial-market .tutorial-card')!.textContent).toContain(
    'Find a buyer',
  );
  click('#tutorial-action');
  expect(chart.open).toBe(true);
  click('[data-compare="saltmere"]');
  click('#close-chart');
  await flushClose();
  world.trade.dockedAt = null;
  Object.assign(world.boat, { x: 252, y: -134, speedKn: 0 });
  click('.port-marker[data-port-id="saltmere"]');
  click('#tp-sell-all');
  expect(world.trade.captain.cargo.timber).toBe(0);
  expect(world.destination).toBeNull();
  expect(document.querySelector('#tutorial-market .tutorial-card')!.textContent).toContain(
    'First delivery complete',
  );
  click('#tutorial-finish');
  click('#tp-close');
  await flushClose();
  expect(input.isEnabled).toBe(true);
  const before = JSON.stringify(world.trade);
  click('#menu-btn');
  expect(document.getElementById('menu-tutorial')!.textContent).toBe('Replay tutorial');
  click('#menu-tutorial');
  expect(offer.open).toBe(true);
  expect(input.isEnabled).toBe(false);
  click('#tutorial-free');
  await flushClose();
  expect(input.isEnabled).toBe(true);
  expect(JSON.stringify(world.trade)).toBe(before);
  context.mockRestore();
});
