import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { glowAlpha } from '../src/render/lampGlow';
import { ISLAND_SCALE } from '../src/sim/islandUnits';

/** The sea camera's field of view (`view.ts`): a points glow of size s spans s × tan(fov / 2). */
const FOV_DEG = 40;
/** Where the glow still shows: fainter than this reads as night sky. */
const SEEN = 0.1;

/** World width of the part of a glow of `size` that shows. */
function shownWidth(size: number) {
  let t = 0;
  while (t < 1 && glowAlpha(t) > SEEN) t += 0.001;
  return size * Math.tan(((FOV_DEG / 2) * Math.PI) / 180) * t;
}

describe('night lamp glows (issue #543)', () => {
  const lamps = TUNING.graphics.lamps;

  it('keeps a small solid core and a soft halo that never clips to white', () => {
    expect(glowAlpha(0)).toBe(1);
    expect(glowAlpha(lamps.core + 0.01)).toBeLessThan(0.8);
    expect(glowAlpha(0.8)).toBeLessThan(0.05);
    expect(glowAlpha(1)).toBe(0);
  });

  it('draws no halo wider than its lamp stands tall', () => {
    // The harbour lanterns stand 4 units up (`harbourLanternSpots`), a beacon's lamp 5.15 × the island scale.
    expect(shownWidth(lamps.lanternSize)).toBeLessThanOrEqual(4);
    expect(shownWidth(lamps.beaconSize)).toBeLessThanOrEqual(5.15 * ISLAND_SCALE);
  });
});
