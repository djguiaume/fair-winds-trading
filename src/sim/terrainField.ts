import { TUNING } from '../data/tuning';
import { insetOutline } from './coast';
import { type Heightfield, boxOf, inside, rasterise } from './heightfield';
import type { TerrainDef } from './map';
import { smoothField } from './smoothField';
import { finish } from './steps';

/** Grounds of a barrier island's tiers, beach first (`terrain.json › ridge`). */
const RIDGE_GROUNDS = ['sand', 'rock', 'rock', 'grass'];

/**
 * The height field of a terrain shape that stands above the sea: a barrier island's tiers
 * (decision 0031) or a sandbank. Reefs, ice, shallows and bergs have no ground here: null.
 */
export function terrainHeightfield(feature: TerrainDef, seed: number): Heightfield | null {
  const box = boxOf([feature.outline]);
  if (feature.kind === 'sandbank') {
    const top = TUNING.terrain.sandbankTop;
    return smoothField(
      finish(
        rasterise(box, seed, (x, y, out) => {
          if (!inside(feature.outline, x, y)) return false;
          out.height = top;
          out.ground = 'sand';
          out.terrace = true;
          return true;
        }),
      ),
      [],
      [feature.outline],
    );
  }
  if (feature.kind !== 'island') return null;
  const { insets, tops } = TUNING.terrain.ridge;
  const tiers = insets.map((inset) =>
    inset ? insetOutline(feature.outline, inset) : feature.outline,
  );
  const last = tiers.length - 1;
  return smoothField(
    finish(
      rasterise(box, seed, (x, y, out) => {
        let tier = -1;
        for (let k = last; k >= 0 && tier < 0; k--) if (inside(tiers[k]!, x, y)) tier = k;
        if (tier < 0) return false;
        out.height = tops[tier]!;
        out.ground = RIDGE_GROUNDS[tier] ?? 'grass';
        out.terrace = tier === last;
        return true;
      }),
    ),
    [],
    [feature.outline],
  );
}
