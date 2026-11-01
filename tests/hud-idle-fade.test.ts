import { describe, expect, it } from 'vitest';
import { IdleFade } from '../src/ui/hud/idleFade';

describe('sea HUD idle fade (issue #441)', () => {
  it('fades after the quiet spell, flips once, and wakes on a change or a wake()', () => {
    const fade = new IdleFade();
    expect(fade.update(1, 'a', 5)).toBe(false);
    for (let i = 0; i < 4; i++) fade.update(1, 'a', 5);
    expect(fade.faded).toBe(false);
    expect(fade.update(1, 'a', 5)).toBe(true);
    expect(fade.faded).toBe(true);
    expect(fade.update(1, 'a', 5)).toBe(false);
    expect(fade.update(0.1, 'b', 5)).toBe(true);
    expect(fade.faded).toBe(false);
    for (let i = 0; i < 6; i++) fade.update(1, 'b', 5);
    fade.wake();
    expect(fade.update(0.1, 'b', 5)).toBe(true);
    expect(fade.faded).toBe(false);
  });
});
