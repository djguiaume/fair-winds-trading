import type { IslandDesign } from '../../data/islands';
import { PROP_TYPES } from '../../render/models/props';
import { islandCheckKit } from '../../render/models/towns';
import { coastDistance } from '../../sim/coast';
import { islandLayout, layoutGround } from '../../sim/islandLayout';
import { type Level, newProp } from './doc';

/** Where the builder's props stand: their plan outlines, the ground under them, whether one fits. */

const hulls = new Map<string, [number, number][]>();
/** A prop's plan outline where it stands, from its model (cached by everything but place). */
export function propHull(
  design: IslandDesign,
  R: number,
  harbour: boolean,
  index: number,
): [number, number][] {
  const p = design.props[index]!;
  const key = JSON.stringify([
    p.type,
    p.turn,
    p.size,
    p.variant,
    p.shape,
    p.length,
    design.style,
    R,
  ]);
  let local = hulls.get(key);
  if (!local) {
    try {
      local = islandCheckKit(design, R, harbour).footprint!({ ...p, x: 0, z: 0 });
    } catch {
      local = [
        [-0.03, -0.03],
        [0.03, -0.03],
        [0.03, 0.03],
        [-0.03, 0.03],
      ];
    }
    hulls.set(key, local);
  }
  return local.map(([x, z]) => [x + p.x, z + p.z]);
}

/** Where a prop stands, in words, at the level shown. */
export function groundOf(design: IslandDesign, level: number, index: number) {
  const p = design.props[index]!;
  if (PROP_TYPES[p.type]?.water) return 'in the sea';
  if (p.y !== undefined) return `set at ${p.y}`;
  const layout = islandLayout(design, Math.max(level, p.from ?? 1));
  const h = layoutGround(layout, p.x, p.z, 0);
  if (h !== null) {
    const s = layout.surfaces.find((g) => g.height === h);
    const lowest = Math.min(...layout.surfaces.map((g) => g.height));
    if (s?.material === 'rock') return `on rock (height ${h})`;
    return h === lowest ? 'on the low ground' : `on raised ground (height ${h})`;
  }
  return layout.coasts.some((c) => coastDistance(p.x, p.z, c).distance < 0)
    ? 'on the sand'
    : 'off the island';
}

/** A quick fit test for a prop being dropped: on land (or in the sea for boats). */
export function fits(
  design: IslandDesign,
  R: number,
  harbour: boolean,
  level: number,
  placeAt: Level,
  type: string,
  x: number,
  z: number,
) {
  const layout = islandLayout(design, level);
  const p = newProp(design, type, x, z, placeAt);
  let fit = 0.05;
  try {
    fit = islandCheckKit(design, R, harbour).fit(p);
  } catch {
    /* Unknown models fit nowhere: the checks say why. */
  }
  const land = Math.max(...layout.coasts.map((c) => -coastDistance(x, z, c).distance));
  if (PROP_TYPES[type]?.water) return land < -fit;
  if (layout.lake && coastDistance(x, z, layout.lake).distance < fit) return false;
  if (layoutGround(layout, x, z, 0) === null)
    return land > 0 && !!PROP_TYPES[type]?.edge ? true : land > 0;
  return layoutGround(layout, x, z, fit) !== null;
}
