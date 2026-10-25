// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { PHASE1_MAP } from '../src/data/maps';
import { DEG } from '../src/sim/math';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { SeaChart } from '../src/ui/seaChart';

const get = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id)! as unknown as T;
const click = (id: string) => get<HTMLButtonElement>(id).click();
function setup() {
  const world = createWorld(PHASE1_MAP, SLOOP);
  const chart = new SeaChart(get<HTMLDialogElement>('chart'), world, {});
  chart.open();
  return { world, chart };
}
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = html
    .split('<body>')[1]!
    .split('</body>')[0]!
    .replace(/<script[\s\S]*?<\/script>/g, '');
});

describe('full-screen chart planning', () => {
  it('opens on the map tab, shows one page per tab, and a port picked from the prices goes back to the map (0194)', () => {
    const { world, chart } = setup();
    expect(document.querySelectorAll('.chart-sheet:not([hidden])')).toHaveLength(0);
    expect(get('chart-status').textContent).toBe('');
    expect(chart.currentTab).toBe('map');
    click('chart-tab-legend');
    expect(get<HTMLElement>('chart-legend-panel').hidden).toBe(false);
    expect(get('chart-tab-legend').getAttribute('aria-pressed')).toBe('true');
    click('chart-tab-market');
    expect(get<HTMLElement>('chart-legend-panel').hidden).toBe(true);
    expect(get<HTMLElement>('chart-market-panel').hidden).toBe(false);
    expect(get('chart').dataset.tab).toBe('market');
    // The page's own goods row picks the table's good.
    get('chart-market-goods').querySelector<HTMLButtonElement>('[data-good="grain"]')!.click();
    expect(get('chart-market-title').textContent).toMatch(/grain/i);
    get('chart-prices').querySelector<HTMLButtonElement>('button[data-compare]')!.click();
    expect(world.destination).not.toBeNull();
    expect(chart.currentTab).toBe('map');
    // LB / RB skip the journal while there are no quests; Back closes from any tab.
    chart.stepTab(1);
    expect(chart.currentTab).toBe('market');
    chart.stepTab(-1);
    chart.stepTab(-1);
    expect(chart.currentTab).toBe('legend');
    chart.back();
    expect(get<HTMLDialogElement>('chart').open).toBe(false);
  });

  it('steps through the goods with X, then names only (0194)', () => {
    const { chart } = setup();
    const pressed = () =>
      get('chart-goods').querySelector('button[aria-pressed="true"]')?.textContent?.trim() ?? null;
    expect(pressed()).toBeNull();
    chart.nextGood();
    expect(pressed()).toMatch(/fish/i);
    for (let i = 0; i < 10 && pressed(); i++) chart.nextGood();
    expect(pressed()).toBeNull();
  });

  it('uses the actual local wind and ship no-go angle in an isolated compass snapshot', () => {
    get('c-wp').style.display = 'none';
    const { world, chart } = setup();
    chart.close();
    world.wind = { from: 90 * DEG, speedKn: 8 };
    world.seaWind = { from: 90 * DEG, speedKn: 20 };
    world.boat.heading = 123 * DEG;
    world.destination = { portId: '', label: 'East', x: world.boat.x + 100, y: world.boat.y };
    chart.open();
    const compass = get('chart-compass');
    expect(compass.getAttribute('data-force')).toBe('1');
    expect(get('chart-wind').textContent).toContain('8 kn');
    expect(compass.querySelector('.nogo')!.parentElement!.getAttribute('transform')).toBe(
      'rotate(90)',
    );
    expect(
      compass.querySelector('.wind')!.parentElement!.parentElement!.getAttribute('transform'),
    ).toBe('rotate(270)');
    expect((compass.querySelector('.wp')!.parentElement as HTMLElement).style.display).toBe('');
    expect(compass.querySelector('.wp')!.parentElement!.getAttribute('transform')).toBe(
      'rotate(90)',
    );
    expect(compass.querySelectorAll('svg [id]')).toHaveLength(0); // no duplicated HUD ids
    expect(get('c-nogo').getAttribute('transform')).toBeNull();
  });

  it('keeps the player screen-sized through zoom, bounds zoom, and resets to the overview', () => {
    setup();
    const svg = get<SVGSVGElement>('chart-map');
    const playerScale = () =>
      Number(
        document
          .querySelector('.chart-player')!
          .getAttribute('transform')!
          .match(/scale\(([^)]+)\)/)![1],
      );
    const scale = playerScale();
    const initialBox = svg.getAttribute('viewBox');
    click('chart-zoom-in');
    expect(playerScale()).toBeCloseTo(scale / 1.5);
    expect(svg.getAttribute('viewBox')).not.toBe(initialBox);
    click('chart-zoom-in');
    click('chart-zoom-in');
    expect(get<HTMLButtonElement>('chart-zoom-in').disabled).toBe(true);
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(svg.getAttribute('viewBox')).not.toBe(initialBox);
    click('chart-fit');
    expect(svg.getAttribute('viewBox')).toBe(initialBox);
    expect(get<HTMLButtonElement>('chart-zoom-out').disabled).toBe(true);
  });

  it('selects ports by keyboard, retains focus, and outlines the chosen port card', () => {
    const { world } = setup();
    localStorage.setItem('fwt.save.v1', 'untouched');
    const target = document.querySelector<SVGElement>('[data-chart-target="westholm"]')!;
    target.focus();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(world.destination?.portId).toBe('westholm');
    expect(document.activeElement?.getAttribute('data-chart-target')).toBe('westholm');
    expect(document.querySelector('[data-chart-target="westholm"]')!.classList).toContain(
      'is-selected',
    );
    expect(document.querySelectorAll('#chart-map .chart-course')).toHaveLength(1);
    expect(get<HTMLElement>('chart-course').hidden).toBe(false);
    expect(localStorage.getItem('fwt.save.v1')).toBe('untouched');
    click('chart-clear-target');
    expect(world.destination).toBeNull();
    expect(get<HTMLElement>('chart-course').hidden).toBe(true);
    expect(get<HTMLButtonElement>('chart-clear-target').disabled).toBe(true);
  });

  it('opens with names only on an empty hold, then prices one picked good under every port', () => {
    const { world } = setup();
    const charted = world.map.ports.filter((p) => !p.hidden);
    expect(document.querySelectorAll('.chart-port-name')).toHaveLength(charted.length);
    expect(document.querySelectorAll('.chart-need')).toHaveLength(0);
    const stone = [...document.querySelectorAll<HTMLButtonElement>('#chart-goods button')].find(
      (b) => b.textContent!.includes('Stone'),
    )!;
    stone.click();
    expect(document.querySelector('#chart-goods [aria-pressed="true"]')!.textContent).toContain(
      'Stone',
    );
    expect(document.querySelectorAll('.chart-need')).toHaveLength(charted.length);
    expect(document.querySelectorAll('.chart-need.best').length).toBeGreaterThan(0);
    expect(get('chart-market-title').textContent).toContain('Stone');
  });

  it('keeps port labels apart and off the boat', () => {
    setup();
    const boxes = [...document.querySelectorAll('.chart-port-target .chart-card-box')].map((r) => {
      const n = (a: string) => Number(r.getAttribute(a));
      return { x0: n('x'), y0: n('y'), x1: n('x') + n('width'), y1: n('y') + n('height') };
    });
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        expect(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0).toBe(true);
  });
});
