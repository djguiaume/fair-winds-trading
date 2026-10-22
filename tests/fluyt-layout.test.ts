import { describe, expect, it } from 'vitest';
import { FLUYT_MIZZEN, FLUYT_STERN, fluytCargo } from '../src/render/models/fluytDetails';
import { STYLE_D } from '../src/render/models/boatStyle';
import type { BoatDetailContext } from '../src/render/models/boatDetails';

describe('fluyt working deck', () => {
  const length = 11.5;
  const deckAt = (z: number) =>
    1.8 * STYLE_D.H * 0.55 + STYLE_D.sheer * Math.sqrt(length / 5) * (z / (length / 2)) ** 2;
  const context: BoatDetailContext = {
    length,
    beam: 3.5 * STYLE_D.B,
    depth: 1.8 * STYLE_D.H,
    deckAt,
    hull: '#6e4520',
    band: '#b5652a',
    upgrades: { hull: 1, hold: 1, sails: 1 },
  };

  it('supports the mizzen well inside the quarterdeck with boom clearance above its rails', () => {
    expect(length * FLUYT_STERN.front - -3.3).toBeGreaterThan(0.6);
    expect(-3.3 - length * FLUYT_STERN.back).toBeGreaterThan(1);
    expect(FLUYT_MIZZEN.deck).toBeCloseTo(
      deckAt(length * FLUYT_STERN.back) + FLUYT_STERN.height + 0.0775,
    );
    const railTop = FLUYT_MIZZEN.deck - 0.0775 + 0.4075;
    expect(deckAt(-3.3) + FLUYT_MIZZEN.foot - 0.1 - railTop).toBeGreaterThan(0.1);
  });

  for (const level of [1, 2, 3] as const) {
    it(`stows hold ${level} in separated, low side rows clear of masts and stairs`, () => {
      const cargo = fluytCargo({ ...context, upgrades: { hull: 1, hold: level, sails: 1 } });
      expect(cargo).toHaveLength([6, 8, 11][level - 1]!);
      for (const item of cargo) {
        expect(item.layer).toBe(0);
        expect(Math.abs(item.x) - 0.252).toBeGreaterThan(0.6);
        expect(item.z - 0.252).toBeGreaterThan(length * FLUYT_STERN.front);
        expect(Math.hypot(item.x, item.z)).toBeGreaterThan(0.9);
        // A single crate stays below the lowest main square sail, with over half a metre to spare.
        expect(deckAt(item.z) + 0.4284).toBeLessThan(deckAt(0) + 1 - 0.4);
        for (const other of cargo) {
          if (other === item) continue;
          expect(Math.abs(item.x - other.x) >= 0.504 || Math.abs(item.z - other.z) >= 0.504).toBe(
            true,
          );
        }
      }
    });
  }
});
