// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import html from '../index.html?raw';
import { Hud } from '../src/ui/hud';
import { Input } from '../src/input/input';
import { loadSettings } from '../src/ui/settings';

const $ = (id: string) => document.getElementById(id)!;
const project = (x: number, y: number) => ({ x, y, onScreen: true });
const size = { w: 800, h: 600 };

function setup() {
  document.body.innerHTML = html
    .split('<body>')[1]!
    .split('</body>')[0]!
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const world = createWorld(PHASE1_MAP, SLOOP);
  const hud = new Hud(world, { seen: true, markSeen: () => {} });
  return { world, hud };
}

beforeEach(() => localStorage.clear());

describe('Sea HUD (decision 0049)', () => {
  it('fills the crate icon with the hold and shows the count without a bar', () => {
    const { world, hud } = setup();
    hud.update(0.2, project, size);
    expect($('hud-cargo').textContent).toBe('0/10');
    expect($('hud-cargo-fill').getAttribute('height')).toBe('0.0');
    world.trade.captain.cargo.fish = 5;
    hud.update(0.2, project, size);
    expect($('hud-cargo').textContent).toBe('5/10');
    expect($('hud-cargo-fill').getAttribute('height')).toBe('8.0');
    expect($('hud-cargo-box').classList.contains('is-full')).toBe(false);
  });

  it('shows heading in degrees with the compass point, and the hull only when damaged', () => {
    const { world, hud } = setup();
    world.boat.heading = (125 * Math.PI) / 180;
    hud.update(0.2, project, size);
    expect($('heading').textContent).toBe('125° SE');
    expect($('hull-bar').hidden).toBe(true);
    expect($('hud-hull-box').hidden).toBe(true);
    world.trade.captain.hullDamage[world.trade.captain.activeShip] = 10;
    hud.update(0.2, project, size);
    expect($('hull-bar').hidden).toBe(false);
    expect($('hud-hull-box').hidden).toBe(false);
  });

  it('folds the speed log and remembers the choice', () => {
    const { hud } = setup();
    let saved: boolean | null = null;
    hud.onLogToggle = (shown) => (saved = shown);
    expect(hud.showLog).toBe(true);
    $('log-toggle').click();
    expect(hud.showLog).toBe(false);
    expect($('speed-log').classList.contains('is-folded')).toBe(true);
    expect(saved).toBe(false);
    expect(loadSettings().showLog).toBe(true);
  });

  it('sets the sails straight from a lever notch and mirrors the boat', () => {
    const { world, hud } = setup();
    const input = new Input($('stage'));
    hud.onSailStep = (step) => input.setSail(step);
    // A keyboard press on a focused notch (click with detail 0).
    $('sail-half').dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(input.takeSailTarget()).toBe(1);
    expect(input.takeSailTarget()).toBeNull();
    expect($('sail-half').getAttribute('aria-pressed')).toBe('true');
    world.boat.sailStep = 2;
    hud.update(0.2, project, size);
    expect($('sail-lever').dataset.step).toBe('2');
    expect($('sail-full').getAttribute('aria-pressed')).toBe('true');
    input.setEnabled(false);
    input.setSail(0);
    expect(input.takeSailTarget()).toBeNull();
  });
});

describe('responsive overlay updates', () => {
  it('switches both arrows and the name together on the first frame after selecting another target', () => {
    const { world, hud } = setup();
    Object.assign(world.boat, { x: 0, y: 0 });
    const project = (x: number, y: number) => ({
      x: 400 + x,
      y: 300 - y,
      onScreen: Math.abs(y) < 100,
    });
    world.destination = { x: 0, y: 300, portId: '', label: 'Previous target' };
    hud.update(0.2, project, size);
    world.destination = { x: 0, y: -300, portId: 'watchman', label: 'Watchman Key' };
    // Less than the text throttle; target selection must still be immediate.
    hud.update(1 / 60, project, size);
    expect($('obj-name').textContent).toBe('Watchman Key');
    expect($('obj-arrow').style.transform).toBe(`rotate(${Math.PI}rad)`);
    expect(($('wp-arrow').firstElementChild as HTMLElement).style.transform).toBe(
      `rotate(${Math.PI}rad)`,
    );
    expect($('wp-arrow').hidden).toBe(false);
    world.destination = null;
    hud.update(1 / 60, project, size);
    expect($('navigation-target').hidden).toBe(true);
    expect($('wp-arrow').hidden).toBe(true);
  });

  it('moves pier labels on consecutive frames without rewriting unchanged content', () => {
    const { world, hud } = setup();
    const port = world.map.ports[0]!;
    const island = world.map.islands.find((i) => i.id === port.islandId)!;
    Object.assign(world.boat, { x: island.x + island.radius + 50, y: island.y });
    let x = 400;
    const project = () => ({ x, y: 300, onScreen: true });
    hud.update(0.2, project, size);
    const marker = document.querySelector<HTMLElement>(`[data-port-id="${port.id}"]`)!;
    expect(marker.hidden).toBe(false);
    const first = marker.style.transform;
    const observer = new MutationObserver(() => {});
    observer.observe(marker, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    x += 0.5;
    hud.update(1 / 60, project, size);
    expect(marker.style.transform).not.toBe(first);
    const mutations = observer.takeRecords();
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.every((m) => m.target === marker && m.attributeName === 'style')).toBe(true);
    observer.disconnect();
    hud.portLabels.mode = 'off';
    hud.update(1 / 60, project, size);
    expect(marker.hidden).toBe(true);
  });
});

describe('one Trade button at a time (decision 0058)', () => {
  it('uses the port sign when it is on screen, and the bottom button only when it is not', () => {
    const { world, hud } = setup();
    world.trade.dockedAt = 'saltmere';
    hud.update(0.2, project, size);
    expect(document.querySelector('.port-marker[data-port-id="saltmere"]')).not.toBeNull();
    expect($('dock-btn').hidden).toBe(true);
    const offScreen = (x: number, y: number) => ({ x, y, onScreen: false });
    hud.update(0.2, offScreen, size);
    expect($('dock-btn').hidden).toBe(false);
    world.trade.dockedAt = null;
    hud.update(0.2, project, size);
    expect($('dock-btn').hidden).toBe(true);
  });
});

describe('hidden HUD work', () => {
  it('does no projection or instrument mutations while covered and refreshes on return', () => {
    const { world, hud } = setup();
    world.destination = { x: 0, y: 300, portId: '', label: 'First target' };
    hud.update(0.2, project, size);
    const spy = vi.fn(project);
    const observer = new MutationObserver(() => {});
    observer.observe($('hud'), { attributes: true, childList: true, subtree: true });
    world.boat.heading = Math.PI;
    world.trade.captain.cargo.fish = 5;
    world.destination.label = 'New target';
    hud.update(1 / 60, spy, size, false, false);
    hud.setFps(30, false);
    expect(spy).not.toHaveBeenCalled();
    expect(observer.takeRecords()).toHaveLength(0);
    hud.update(1 / 60, spy, size, true, true);
    expect(spy).toHaveBeenCalled();
    expect($('heading').textContent).toBe('180\u00b0 S');
    expect($('hud-cargo').textContent).toBe('5/10');
    expect($('obj-name').textContent).toBe('New target');
    observer.disconnect();
  });

  it('keeps toast expiry and pause wind-cue resets running while covered', () => {
    const { world, hud } = setup();
    world.boat.heading = world.wind.from;
    world.boat.sailStep = 2;
    world.boat.sail = 1;
    hud.update(4, project, size);
    expect($('upwind-chip').hidden).toBe(false);
    hud.showToast('temporary', 1);
    hud.update(2, project, size, false, false);
    expect($('toast').hidden).toBe(true);
    hud.update(1 / 60, project, size, true, true);
    expect($('upwind-chip').hidden).toBe(true);
    expect($('wind-compass').classList.contains('wind-pulse')).toBe(false);
  });

  it('continues refreshing paused instruments that remain visible under translucent sheets', () => {
    const { world, hud } = setup();
    hud.update(0.2, project, size);
    world.trade.captain.cargo.fish = 3;
    world.boat.heading = Math.PI / 2;
    const spy = vi.fn(project);
    world.destination = { x: 300, y: 0, portId: '', label: 'Market target' };
    hud.update(0.2, spy, size, false, true);
    expect($('hud-cargo').textContent).toBe('3/10');
    expect($('heading').textContent).toBe('90\u00b0 E');
    expect(spy).toHaveBeenCalled();
  });

  it('skips folded speed text and refreshes it immediately when unfolded', () => {
    const { world, hud } = setup();
    hud.update(0.2, project, size);
    const heading = $('heading').textContent;
    hud.showLog = false;
    world.boat.heading = Math.PI;
    hud.update(0.2, project, size);
    expect($('heading').textContent).toBe(heading);
    hud.showLog = true;
    hud.update(1 / 60, project, size);
    expect($('heading').textContent).toBe('180\u00b0 S');
  });
});

it('refreshes already visible port-sign content on the first uncovered frame', () => {
  const { world, hud } = setup();
  world.trade.dockedAt = 'saltmere';
  hud.update(0.2, project, size);
  const sign = document.querySelector<HTMLElement>('[data-port-id="saltmere"]')!;
  const oldLabel = sign.getAttribute('aria-label');
  hud.update(1 / 60, project, size);
  hud.update(1 / 60, project, size, false, false);
  world.trade.dockedAt = null;
  // A paused, still-visible sheet can close the chart: no elapsed text interval is needed.
  hud.update(1 / 60, project, size, false, true);
  expect(sign.getAttribute('aria-label')).not.toBe(oldLabel);
});

it('advances gust lifetime while hidden instead of replaying a stale gust on return', () => {
  const { world, hud } = setup();
  world.wind.speedKn = 8;
  hud.update(0.2, project, size);
  world.wind.speedKn = 20;
  hud.update(1 / 60, project, size);
  expect($('wind-gust').hidden).toBe(false);
  hud.update(20, project, size, false, false);
  hud.update(1 / 60, project, size, false, true);
  expect($('wind-gust').hidden).toBe(true);
});
