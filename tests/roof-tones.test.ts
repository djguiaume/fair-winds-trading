import { describe, expect, it } from 'vitest';
import { chimneyCapTone, leanToTone } from '../src/render/models/roofTones';

const lightness = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

describe('roof tones', () => {
  it('shades a lean-to darker than a light roof and lighter than a dark one', () => {
    expect(lightness(leanToTone('#c8603e'))).toBeLessThan(lightness('#c8603e'));
    expect(lightness(leanToTone('#2f3035'))).toBeGreaterThan(lightness('#2f3035'));
  });

  it('keeps the warm charcoal cap on a bright roof and lifts it on a dark or olive one', () => {
    expect(chimneyCapTone('#c8603e')).toBe('#4d4640');
    expect(chimneyCapTone('#33373d')).toBe('#8a8174');
    expect(chimneyCapTone('#6e7f45')).toBe('#8a8174');
  });
});
