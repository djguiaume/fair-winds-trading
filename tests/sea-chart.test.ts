// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  it('opens on the map tab, shows one page per tab, and a port picked from the prices goes back to the map (0196)', () => {
    const { world, chart } = setup();
    expect(document.querySelectorAll('.chart-sheet:not([hidden])')).toHaveLength(0);
    expect(get('chart-status').textContent).toBe('');
    expect(chart.currentTab).toBe('map');
    click('chart-tab-legend');
    expect(get<HTMLElement>('chart-legend-panel').hidden).toBe(false);
    expect(get('chart-tab-legend').getAttribute('aria-selected')).toBe('true');
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
    expect(chart.currentTab).toBe('hold');
    chart.stepTab(1);
    expect(chart.currentTab).toBe('market');
    chart.stepTab(-1);
    chart.stepTab(-1);
    chart.stepTab(-1);
    expect(chart.currentTab).toBe('legend');
    chart.back();
    expect(get<HTMLDialogElement>('chart').open).toBe(false);
  });

  it('lists the hold and the deck on the Cargo tab (0213)', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.captain.cargo.grain = 5;
    world.trade.quests.hold = 6;
    const chart = new SeaChart(get<HTMLDialogElement>('chart'), world, {});
    chart.questCargo = () => ['Maren’s millstones ×1 · 6 deck space'];
    chart.open();
    click('chart-tab-hold');
    expect(get<HTMLElement>('chart-hold-panel').hidden).toBe(false);
    const sections = [...get('chart-hold-list').querySelectorAll('.chart-cargo-section')].map(
      (el) => el.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(sections[0]).toBe('In the hold5/10Grain×5');
    expect(sections[1]).toBe('On deck6/8Maren’s millstones ×1 · 6 deck space');
    // Each room a row of crates, one a unit on a sloop, full from the first (art director).
    const hold = get('chart-hold-list').querySelector('.chart-cargo-section')!;
    expect(hold.querySelectorAll('.chart-crate')).toHaveLength(10);
    expect(hold.querySelectorAll('.chart-crate.is-full')).toHaveLength(5);
    world.trade.captain.cargo.grain = 0;
    world.trade.quests.hold = 0;
    chart.questCargo = () => [];
    chart.close();
    chart.open();
    expect(get('chart-hold-list').textContent).toContain('Nothing aboard.');
  });

  it('steps through the goods with X, then names only (0196)', () => {
    const { chart } = setup();
    const pressed = () =>
      get('chart-prices-on').hidden ? null : get('chart-prices-on').textContent!.trim();
    expect(pressed()).toBeNull();
    chart.nextGood();
    expect(pressed()).toMatch(/fish/i);
    for (let i = 0; i < 10 && pressed(); i++) chart.nextGood();
    expect(pressed()).toBeNull();
  });

  it('uses the actual local wind and ship no-go angle in its own north-up dial', () => {
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
    // The arrow comes in over the ring from where the wind blows.
    expect(
      compass.querySelector('.wind')!.parentElement!.parentElement!.getAttribute('transform'),
    ).toBe('rotate(90)');
    expect((compass.querySelector('.wp')!.parentElement as HTMLElement).style.display).toBe('');
    expect(compass.querySelector('.wp')!.parentElement!.getAttribute('transform')).toBe(
      'rotate(90)',
    );
    // Its one id (the no-go hatching) is the chart's own, never one of the HUD's.
    expect(compass.querySelectorAll('svg [id]:not([id^="chart-"])')).toHaveLength(0);
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

  it('pinches to zoom round the point between the fingers, and the release redraws (#444)', () => {
    vi.useFakeTimers();
    setup();
    const svg = get<SVGSVGElement>('chart-map');
    const width = () => Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    const before = width();
    const press = (type: string, pointerId: number, clientX: number) =>
      svg.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          clientX,
          clientY: 300,
          pointerType: 'touch',
          bubbles: true,
        }),
      );
    press('pointerdown', 1, 250);
    press('pointerdown', 2, 350);
    press('pointermove', 2, 450);
    expect(width()).toBeCloseTo(before / 2);
    press('pointerup', 2, 450);
    press('pointerup', 1, 250);
    // The fingers moved: no mark is dropped, and the words are placed again once it rests.
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 250, clientY: 300 }));
    expect(svg.querySelector('.chart-flag-mark')).toBeNull();
    vi.advanceTimersByTime(200);
    expect(get<HTMLButtonElement>('chart-zoom-out').disabled).toBe(false);
    vi.useRealTimers();
  });

  it('keeps a key of its marks on the map and every mark on the Legend page (#444)', () => {
    setup();
    expect(document.querySelectorAll('.chart-keystrip-item')).toHaveLength(4);
    const legend = get('chart-legend-panel').textContent!;
    for (const key of ['Your mark', 'Quest place', 'Uncharted waters', 'No-go'])
      expect(legend).toContain(key);
    // The rose carries the no-go wedge and the wind arrow; the pad's bar names its buttons.
    expect(get('chart-compass').querySelector('.nogo-hatch')).not.toBeNull();
    expect(document.querySelector('.chart-padbar')!.textContent).toContain('Back');
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
    expect(get<HTMLElement>('chart-prices-on').hidden).toBe(true);
    // A good picked on the Prices page prices every port on the map too.
    get('chart-market-goods').querySelector<HTMLButtonElement>('[data-good="stone"]')!.click();
    expect(
      document.querySelector('#chart-market-goods [aria-pressed="true"]')!.textContent,
    ).toContain('Stone');
    expect(get('chart-prices-on').textContent).toContain('Stone');
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

describe('real course marks (decision 0212)', () => {
  it('drops her own mark on open water, makes it the course, and removes it when tapped', () => {
    const { world } = setup();
    const svg = get('chart-map');
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 20 }));
    expect(world.destination?.kind).toBe('mark');
    expect(get<HTMLElement>('chart-course').hidden).toBe(false);
    expect(get('chart-course-text').textContent).toMatch(/your mark/i);
    const flag = svg.querySelector<SVGElement>('.chart-flag-mark')!;
    expect(flag.getAttribute('data-chart-target')).toBe('mark');
    flag.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(world.destination).toBeNull();
    expect(svg.querySelector('.chart-flag-mark')).toBeNull();
  });

  it('a tap on a port still sets the port course, not a mark', () => {
    const { world } = setup();
    const port = get('chart-map').querySelector<SVGElement>('.chart-port-target')!;
    port.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(world.destination?.portId).toBe(port.getAttribute('data-chart-target'));
    expect(world.destination?.kind).toBeUndefined();
  });

  it("shows the quest's place at sea as a brass flag that sets a course for it", () => {
    const { world, chart } = setup();
    const goal = { x: world.boat.x + 120, y: world.boat.y + 40, label: 'Teeth Rock' };
    chart.close();
    chart.quests = {
      pins: () => [],
      target: () => ({ point: { x: goal.x, y: goal.y }, radius: 6 }),
      goal: () => goal,
      journal: () => [],
      track: () => {},
    };
    chart.open();
    const svg = get('chart-map');
    // No course: the faint quest route shows, as the sea's arrow follows the quest.
    expect(svg.querySelector('.chart-quest-route')).not.toBeNull();
    const flag = svg.querySelector<SVGElement>('.chart-flag-quest')!;
    expect(flag.textContent).toContain('Teeth Rock');
    flag.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(world.destination).toMatchObject({ kind: 'quest', label: 'Teeth Rock', x: goal.x });
    // Now the one brass course line, no second faint route.
    expect(svg.querySelector('.chart-quest-route')).toBeNull();
    expect(svg.querySelector('.chart-course')).not.toBeNull();
    expect(svg.querySelector('.chart-flag-quest')!.classList.contains('is-selected')).toBe(true);
  });
});

describe('journal: finished quests told again', () => {
  it('names the quest and opens it to its steps, what was said, the answer and the thanks', async () => {
    const { QUESTS, QUEST_DONE, QuestBook } = await import('../src/sim/quests');
    const { journal } = await import('../src/ui/questView');
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.quests.byId['westholm-mill'] = { step: QUEST_DONE, counts: [], chose: {} };
    const book = new QuestBook(world, QUESTS);
    const chart = new SeaChart(get<HTMLDialogElement>('chart'), world, {});
    chart.quests = {
      pins: () => [],
      target: () => null,
      journal: () => journal(book, world.map),
      track: () => {},
    };
    chart.open();
    click('chart-tab-journal');
    const row = get('chart-journal-list').querySelector<HTMLElement>(
      '[data-open="westholm-mill"]',
    )!;
    expect(row.textContent).toContain('The mill on the hill · Done');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    row.click();
    const story = get('chart-journal-list').querySelector('.chart-story')!;
    const steps = story.querySelectorAll('li');
    expect(steps.length).toBe(4);
    expect(story.textContent).toContain('Flour on my hands');
    expect(steps[3]!.classList.contains('is-thanks')).toBe(true);
    get('chart-journal-list').querySelector<HTMLElement>('[data-open="westholm-mill"]')!.click();
    expect(get('chart-journal-list').querySelector('.chart-story')).toBeNull();
  });
});
