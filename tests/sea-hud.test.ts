// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
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
