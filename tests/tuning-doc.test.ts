import { describe, expect, it } from 'vitest';
import { parseValue, valueProblem, withValue } from '../src/tune/tuningDoc';

describe('tuningDoc values', () => {
  it('reads numbers and toggles as typed', () => {
    expect(parseValue('8')).toBe(8);
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
  });

  it('takes true or false for a toggle and a number for a number', () => {
    expect(valueProblem('graphics.title.live', true)).toBeNull();
    expect(valueProblem('graphics.title.live', 1)).toMatch(/true or false/);
    expect(valueProblem('hud.idleFadeSec', true)).toMatch(/not a number/);
  });

  it('writes a toggle into a copy of its file', () => {
    const next = withValue({ title: { live: false } }, 'graphics.title.live', true);
    expect(next).toEqual({ title: { live: true } });
  });
});
