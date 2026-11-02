import { describe, expect, it } from 'vitest';
import { PICTURE_GRADE, gradePixels } from '../src/render/pictureGrade';

/** One column of `rows` pixels of one colour, graded; returns each row's RGB. */
function graded(rgb: [number, number, number], rows: number, warmth = 1) {
  const px = new Uint8ClampedArray(rows * 4);
  for (let i = 0; i < rows; i++) px.set([...rgb, 255], i * 4);
  gradePixels(px, 1, rows, PICTURE_GRADE, warmth);
  return Array.from({ length: rows }, (_, i) => [...px.subarray(i * 4, i * 4 + 3)]);
}

const hue = ([r, g, b]: number[]) => {
  const max = Math.max(r!, g!, b!);
  const d = max - Math.min(r!, g!, b!);
  return max === g ? 60 * ((b! - r!) / d + 2) : 60 * ((r! - g!) / d + 4);
};

describe('the harbour banner grade (#464)', () => {
  it('warms the top and darkens the foot', () => {
    const [top, , foot] = graded([128, 128, 128], 3);
    expect(top![0]).toBeGreaterThan(top![2]!);
    expect(foot![0]).toBeLessThan(top![0]!);
  });

  it('turns teal toward the game blue and quiets it', () => {
    const teal: [number, number, number] = [40, 170, 190];
    const [out] = graded(teal, 1, 0);
    expect(hue(out!)).toBeGreaterThan(hue(teal) + 10);
    expect(Math.max(...out!) - Math.min(...out!)).toBeLessThan(150);
  });

  it('keeps the night: no warm light without warmth, only the foot shade', () => {
    expect(graded([30, 40, 90], 1, 0)[0]).toEqual([30, 40, 90]);
  });
});
