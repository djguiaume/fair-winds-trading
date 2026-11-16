import { describe, expect, it } from 'vitest';
import { parseValue, valueProblem, withValue } from '../src/tune/tuningDoc';

describe('tuningDoc values', () => {
  it('reads numbers and toggles as typed', () => {
    expect(parseValue('8')).toBe(8);
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
    expect(parseValue('#7fc0e6')).toBe('#7fc0e6');
  });

  it('takes text for a text value, such as a sky colour', () => {
    expect(valueProblem('graphics.sky.looks.day.horizon', '#7fc0e6')).toBeNull();
    expect(valueProblem('graphics.sky.looks.day.horizon', 3)).toMatch(/is text/);
    expect(valueProblem('hud.idleFadeSec', '#7fc0e6')).toMatch(/not a number/);
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
