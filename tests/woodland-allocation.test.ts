import { describe, expect, it, vi } from 'vitest';
import { ISLAND_DESIGNS } from '../src/data/islands';
import { WOODLAND_TREES } from '../src/render/models/props';
import { designedTownParts } from '../src/render/models/towns';

describe('woodland candidate allocation', () => {
  it.each(Object.keys(WOODLAND_TREES))(
    '%s constructs geometry only for trees that survive every placement check',
    (tree) => {
      const design = structuredClone(ISLAND_DESIGNS.calda!);
      design.woods.tree = tree;
      const prepare = WOODLAND_TREES[tree]!;
      const build = vi.fn();
      const candidates = vi.spyOn(WOODLAND_TREES, tree).mockImplementation((rng) => {
        const make = prepare(rng);
        return () => {
          build();
          return make();
        };
      });
      try {
        const parts = designedTownParts(design, 12, 2);
        const accepted = parts.filter((g) => g.userData.tree).length;
        expect(accepted).toBeGreaterThan(0);
        expect(accepted).toBeLessThan(design.woods.tries);
        expect(candidates).toHaveBeenCalledTimes(design.woods.tries);
        expect(build).toHaveBeenCalledTimes(accepted);
        parts.forEach((g) => g.dispose());

        // In-place editor changes take effect on the next build: no stale prepared forest.
        design.woods.clear = [[0, 0, 100]];
        build.mockClear();
        const cleared = designedTownParts(design, 12, 2);
        expect(cleared.some((g) => g.userData.tree)).toBe(false);
        expect(build).not.toHaveBeenCalled();
        cleared.forEach((g) => g.dispose());
      } finally {
        candidates.mockRestore();
      }
    },
  );
});
