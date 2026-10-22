import { expect, it } from 'vitest';
import { INDIAMAN_MIZZEN, indiamanDetails } from '../src/render/models/indiamanDetails';
import { STYLE_D } from '../src/render/models/boatStyle';

it('puts the mizzen on a continuous quarterdeck with an aft poop and clear boom', () => {
  const deckAt = (z: number) => 1.32 + STYLE_D.sheer * Math.sqrt(13 / 5) * (z / 6.5) ** 2;
  const parts = indiamanDetails({
    length: 13,
    beam: 3.8 * STYLE_D.B,
    depth: 2.4,
    deckAt,
    hull: '#5c3a1c',
    band: '#782d31',
    upgrades: { hull: 1, hold: 1, sails: 1 },
  });
  const bounds = parts.map((part) => {
    part.computeBoundingBox();
    return part.boundingBox!;
  });
  const quarterdeck = bounds.find(
    (b) => Math.abs(b.max.y - INDIAMAN_MIZZEN.deck) < 1e-5 && b.max.z > -3 && b.min.z < -6.3,
  );
  expect(quarterdeck).toBeDefined();
  expect(quarterdeck!.min.x).toBeLessThan(-1.4);
  expect(-3.8 - quarterdeck!.min.z).toBeGreaterThan(2);
  expect(quarterdeck!.max.z + 3.8).toBeGreaterThan(0.7);
  const highest = Math.max(...bounds.map((b) => b.max.y));
  expect(deckAt(-3.8) + INDIAMAN_MIZZEN.foot - 0.1 - highest).toBeGreaterThan(0.15);
  expect(bounds.some((b) => b.max.y > INDIAMAN_MIZZEN.deck + 0.39 && b.max.z < -5)).toBe(true);
  expect(INDIAMAN_MIZZEN.sheet.y).toBeCloseTo(INDIAMAN_MIZZEN.deck + 0.4);
  parts.forEach((part) => part.dispose());
});
