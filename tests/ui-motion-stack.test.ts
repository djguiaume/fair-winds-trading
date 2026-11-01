// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NumberRolls, playEnter, resetMotionQuery } from '../src/ui/motion';
import { type Screen, ScreenStack } from '../src/ui/screens/stack';

// The motion system and the screen stack (decision 0269).
let reduce = false;
beforeEach(() => {
  reduce = false;
  resetMotionQuery();
  vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetMotionQuery();
});

const screen = (id: string, extra: Partial<Screen> = {}): Screen => {
  const root = document.createElement('section');
  root.hidden = true;
  return { id, root, ...extra };
};
const shown = (...s: Screen[]) => s.map((x) => !x.root.hidden);

describe('playEnter', () => {
  it('marks the way in, and nothing when the player wants less motion', () => {
    const el = document.createElement('div');
    playEnter(el, 'slide');
    expect(el.dataset.enter).toBe('slide');
    playEnter(el, 'fade');
    expect(el.dataset.enter).toBe('fade');
    reduce = true;
    resetMotionQuery();
    playEnter(el, 'slide');
    expect(el.dataset.enter).toBeUndefined();
  });
});

describe('number rolls', () => {
  const clock = () => {
    const frames: ((now: number) => void)[] = [];
    let now = 0;
    return {
      frames,
      at: (t: number) => (now = t),
      clock: { now: () => now, request: (f: (now: number) => void) => frames.push(f) },
      run: (t: number) => {
        now = t;
        frames.shift()?.(t);
      },
    };
  };

  it('rolls to the new value, then stops asking for frames', () => {
    const c = clock();
    const rolls = new NumberRolls(c.clock, 200);
    const gold = document.createElement('b');
    gold.dataset.value = '100';
    gold.textContent = '100';
    rolls.roll(gold, 200);
    expect(c.frames).toHaveLength(1);
    c.run(100);
    const mid = Number(gold.textContent);
    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(200);
    c.run(200);
    expect(gold.textContent).toBe('200');
    expect(rolls.rolling).toBe(0);
    expect(c.frames).toHaveLength(0);
  });

  it('retargets a rolling number from where it is, reusing its roll', () => {
    const c = clock();
    const rolls = new NumberRolls(c.clock, 200);
    const a = document.createElement('b');
    const b = document.createElement('b');
    a.dataset.value = '0';
    b.dataset.value = '0';
    rolls.roll(a, 100);
    rolls.roll(b, 50, (n) => `${n} g`);
    c.run(100);
    rolls.roll(a, 0);
    expect(rolls.rolling).toBe(2);
    c.run(400);
    c.run(400);
    expect([a.textContent, b.textContent]).toEqual(['0', '50 g']);
    expect(rolls.rolling).toBe(0);
  });

  it('jumps straight to the value with reduced motion', () => {
    reduce = true;
    const c = clock();
    const rolls = new NumberRolls(c.clock, 200);
    const el = document.createElement('b');
    el.dataset.value = '3';
    rolls.roll(el, 9);
    expect(el.textContent).toBe('9');
    expect(c.frames).toHaveLength(0);
  });
});

describe('screen stack', () => {
  it('shows only the top screen and brings the one under back on pop', () => {
    const changes = vi.fn();
    const stack = new ScreenStack(changes);
    const menu = screen('menu');
    const settings = screen('settings');
    stack.reset(menu);
    stack.push(settings);
    expect(shown(menu, settings)).toEqual([false, true]);
    expect(settings.root.dataset.enter).toBe('slide');
    stack.pop();
    expect(shown(menu, settings)).toEqual([true, false]);
    expect(menu.root.dataset.enter).toBe('fade');
    expect(changes).toHaveBeenCalledTimes(3);
  });

  it('replaces the top, closes one by id and empties for the open sea', () => {
    const stack = new ScreenStack();
    const menu = screen('menu');
    const voyage = screen('new-voyage');
    const help = screen('help');
    stack.reset(menu);
    stack.replace(voyage);
    expect([stack.depth, stack.top?.id]).toEqual([1, 'new-voyage']);
    expect(shown(menu, voyage)).toEqual([false, true]);
    stack.reset(menu);
    stack.push(help);
    stack.close('menu');
    expect([stack.depth, stack.top?.id, help.root.hidden]).toEqual([1, 'help', false]);
    stack.reset();
    expect([stack.depth, help.root.hidden]).toEqual([0, true]);
    expect(stack.padScreen()).toBeNull();
  });

  it('gives Esc, B and the pad the top screen and its own way back', () => {
    const stack = new ScreenStack();
    const shown: string[] = [];
    const menu = screen('menu', { back: () => {}, onShow: () => shown.push('menu') });
    const help = screen('help', { onHide: () => shown.push('help hidden') });
    stack.reset(menu);
    stack.push(help);
    expect(stack.padScreen()?.root).toBe(help.root);
    stack.padScreen()!.back();
    expect(stack.top?.id).toBe('menu');
    stack.back();
    expect(stack.top?.id).toBe('menu');
    expect(shown).toEqual(['menu', 'help hidden', 'menu']);
  });

  it('moves a screen pushed twice to the top instead of stacking it again', () => {
    const stack = new ScreenStack();
    const a = screen('a');
    const b = screen('b');
    stack.push(a);
    stack.push(b);
    stack.push(a);
    expect([stack.depth, stack.top?.id]).toEqual([2, 'a']);
    expect(shown(a, b)).toEqual([true, false]);
  });
});
