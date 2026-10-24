// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PAD, controlProblems, type PadButton } from '../src/input/gamepad';
import {
  StickRepeat,
  menuAction,
  nearestInDirection,
  startOf,
  stickDirection,
  type Box,
} from '../src/ui/padFocus';

const box = (left: number, top: number, w = 100, h = 40): Box => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});
const press = (button: PadButton, repeat = false) => ({ button, repeat });

describe('game controller in the menus (decision 0163)', () => {
  it('the menu section of the controls file is checked with the rest', () => {
    expect(controlProblems()).toEqual([]);
    const bad = structuredClone(PAD);
    bad.menu.actions.back = [];
    bad.menu.moveX = 'nope' as never;
    expect(controlProblems(bad)).toEqual(['menu.moveX: no axis "nope"', 'menu.back: no button']);
  });

  it('reads the buttons as menu actions from the controls file', () => {
    expect(menuAction(press('a'))).toBe('press');
    expect(menuAction(press('b'))).toBe('back');
    expect(menuAction(press('down'))).toBe('down');
    expect(menuAction(press('rb'))).toBe('tabNext');
    expect(menuAction(press('lb'))).toBe('tabPrev');
    expect(menuAction(press('menu'))).toBe('resume');
    expect(menuAction(press('x'))).toBe('secondary');
    expect(menuAction(press('y'))).toBeNull();
  });

  it('follows a column down and up, and a row across', () => {
    // A menu list: four rows in a column, a side button to the right of the second.
    const rows = [box(0, 0), box(0, 50), box(0, 100), box(0, 150), box(140, 50)];
    expect(nearestInDirection(rows[0]!, rows.slice(1), 'down')).toBe(0);
    expect(nearestInDirection(rows[2]!, [rows[0]!, rows[1]!, rows[3]!], 'up')).toBe(1);
    expect(nearestInDirection(rows[1]!, [rows[0]!, rows[2]!, rows[4]!], 'right')).toBe(2);
    expect(nearestInDirection(rows[0]!, [rows[1]!, rows[2]!], 'up')).toBe(-1);
  });

  it('keeps to the column before jumping across (market buy buttons)', () => {
    const from = box(600, 140);
    // Below and a little to the right vs. straight below but farther.
    const near = box(780, 190);
    const below = box(600, 200);
    expect(nearestInDirection(from, [near, below], 'down')).toBe(1);
  });

  it('turns the stick into one move, then repeats while held', () => {
    expect(stickDirection(0.1, 0.2, 0.5)).toBeNull();
    expect(stickDirection(0.9, 0.3, 0.5)).toBe('right');
    expect(stickDirection(-0.2, -0.8, 0.5)).toBe('up');
    const s = new StickRepeat();
    expect(s.step('down', 0, 400, 100)).toBe('down');
    expect(s.step('down', 200, 400, 100)).toBeNull();
    expect(s.step('down', 400, 400, 100)).toBe('down');
    expect(s.step('down', 450, 400, 100)).toBeNull();
    expect(s.step('down', 500, 400, 100)).toBe('down');
    expect(s.step(null, 520, 400, 100)).toBeNull();
    expect(s.step('down', 530, 400, 100)).toBe('down');
  });

  it('starts on a screen’s main brass button, never its close button or tabs', () => {
    document.body.innerHTML = `
      <button class="close-btn">x</button>
      <button class="tab-btn active">Market</button>
      <button class="port-btn">Sell</button>
      <button class="port-btn brass">Buy</button>`;
    const all = [...document.querySelectorAll<HTMLElement>('button')];
    expect(startOf(all)?.textContent).toBe('Buy');
    expect(startOf(all.slice(0, 3))?.textContent).toBe('Sell');
    expect(startOf(all.slice(0, 1))?.textContent).toBe('x');
  });
});
