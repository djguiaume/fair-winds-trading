// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { PHASE0_MAP, PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { createWorld, navigationTarget, stepWorld } from '../src/sim/world';
import { loadGame, SAVE_KEY, saveGame, serializeWorld } from '../src/sim/save';
import html from '../index.html?raw';
import { Hud } from '../src/ui/hud';
import { Input } from '../src/input/input';
import { SeaChart } from '../src/ui/seaChart';

function setup() {
  document.body.innerHTML = `<dialog id="chart"><button id="close-chart">Back</button><svg id="chart-map"></svg><span id="chart-wind"></span><span id="chart-course"></span><div id="chart-goods"></div><table id="chart-prices"></table><p id="chart-status"></p><button id="chart-clear-target">Clear</button></dialog>`;
  const world = createWorld(PHASE1_MAP, SLOOP);
  const chart = new SeaChart(document.querySelector('dialog')!, world, {});
  chart.open();
  return { world, chart };
}
function click(id: string) {
  document.querySelector<HTMLButtonElement>(id)!.click();
}

beforeEach(() => {
  localStorage.clear();
});

describe('sandbox navigation', () => {
  it('has no assigned destination or course progress, even on the old buoy', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    Object.assign(world.boat, PHASE1_MAP.course[0]);
    const events = stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60);
    expect(navigationTarget(world)).toBeNull();
    expect(events.some((e) => e.type === 'waypoint')).toBe(false);
    expect(world.course.reached).toBe(0);
    expect(navigationTarget(createWorld(PHASE0_MAP, SLOOP))).toBe(PHASE0_MAP.course[0]);
  });
  it('keeps the voyage save schema and progress intact across chart use', () => {
    const { world } = setup();
    world.trade.captain.gold = 1234;
    saveGame(localStorage, world);
    const before = localStorage.getItem(SAVE_KEY);
    click(`[data-compare="${PHASE1_MAP.ports[0]!.id}"]`);
    expect(localStorage.getItem(SAVE_KEY)).toBe(before);
    const restored = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(localStorage, restored)).toBe(true);
    expect(serializeWorld(restored)).toEqual(serializeWorld(world));
  });
});

describe('on-demand chart', () => {
  it('sets an explicit port bearing and clears it without advancing a course', () => {
    const { world } = setup();
    click(`[data-compare="${PHASE1_MAP.ports[0]!.id}"]`);
    expect(world.destination?.portId).toBe(PHASE1_MAP.ports[0]!.id);
    expect(document.getElementById('chart-course')!.textContent).toContain(
      PHASE1_MAP.ports[0]!.name,
    );
    click('#chart-clear-target');
    expect(navigationTarget(world)).toBeNull();
  });
  it('has no markers any more and forgets what older versions stored (decision 0058)', () => {
    localStorage.setItem(`fwt.chart.v1.${PHASE1_MAP.name}`, '[{"x":0,"y":0,"label":"Marker 1"}]');
    const { world } = setup();
    expect(localStorage.getItem(`fwt.chart.v1.${PHASE1_MAP.name}`)).toBeNull();
    // Tapping the sea no longer drops a marker or sets a course.
    document.getElementById('chart-map')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigationTarget(world)).toBeNull();
  });
});

describe('navigation HUD and modal input', () => {
  it('hides the objective, compass marker and edge arrow until a bearing is selected', () => {
    document.body.innerHTML = html
      .split('<body>')[1]!
      .split('</body>')[0]!
      .replace(/<script[\s\S]*?<\/script>/g, '');
    const world = createWorld(PHASE1_MAP, SLOOP);
    const hud = new Hud(world, { seen: true, markSeen: () => {} });
    const project = () => ({ x: 400, y: 20, onScreen: false });
    hud.update(0.2, project, { w: 800, h: 600 });
    expect(document.getElementById('navigation-target')!.hidden).toBe(true);
    expect(document.getElementById('wp-arrow')!.hidden).toBe(true);
    expect(document.getElementById('c-wp')!.style.display).toBe('none');
    world.destination = { x: 20, y: 20, portId: '', label: 'Marker 1' };
    hud.update(0.2, project, { w: 800, h: 600 });
    expect(document.getElementById('navigation-target')!.hidden).toBe(false);
    expect(document.getElementById('wp-arrow')!.hidden).toBe(false);
    expect(document.getElementById('obj-name')!.textContent).toBe('Marker 1');
  });
  it('clears held steering and sail changes when the chart pauses input', () => {
    document.body.innerHTML = html
      .split('<body>')[1]!
      .split('</body>')[0]!
      .replace(/<script[\s\S]*?<\/script>/g, '');
    const world = createWorld(PHASE1_MAP, SLOOP);
    const input = new Input(document.getElementById('stage')!);
    const chart = new SeaChart(document.querySelector<HTMLDialogElement>('#chart')!, world, {});
    chart.onChange = () => input.setEnabled(!chart.isOpen);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    input.pressSail(1);
    expect(input.steer).toBe(1);
    chart.open();
    expect(input.isEnabled).toBe(false);
    expect(input.steer).toBe(0);
    expect(input.takeSailDelta()).toBe(0);
    chart.close();
    // Native dialog close dispatches asynchronously; mimic that event in this DOM harness.
    document.getElementById('chart')!.dispatchEvent(new Event('close'));
    expect(input.isEnabled).toBe(true);
    expect(input.steer).toBe(0);
  });
});
