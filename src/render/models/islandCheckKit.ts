import { type IslandDesign, type PropDef, designQuestIds, questDesign } from '../../data/islands';
import type { IslandCheckKit } from '../../sim/islandChecks';
import { PROP_TYPES, WOODLAND_TREES, put, type Parts } from './props';
import { extent, nearParts, propParts } from './townProps';
import { type TownLevel, designedTownParts } from './towns';

/** Convex hull of a model's plan, in reference units. */
function planHull(parts: Parts): [number, number][] {
  const points: [number, number][] = [];
  for (const g of parts) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) points.push([p.getX(i), p.getZ(i)]);
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  const half = (ps: [number, number][]) => {
    const h: [number, number][] = [];
    for (const p of ps) {
      while (h.length > 1 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(points), ...half([...points].reverse())];
}

/** What src/sim/islandChecks.ts needs from the models, for an island of radius R. */
export function islandCheckKit(design: IslandDesign, R: number, harbour = true): IslandCheckKit {
  const built = (prop: PropDef) => {
    const parts = propParts(prop, design, R);
    const scale = PROP_TYPES[prop.type]!.sizedInModel ? 1 : (prop.size ?? 1);
    return { parts, scale };
  };
  return {
    R,
    harbour,
    types: PROP_TYPES,
    woodlandTrees: Object.keys(WOODLAND_TREES),
    fit: (prop) => {
      const type = PROP_TYPES[prop.type]!;
      const { parts, scale } = built(prop);
      const fit = type.fitRadius ?? ((type.fit ?? extent(parts)) * scale) / R;
      parts.forEach((g) => g.dispose());
      return fit;
    },
    footprint: (prop) => {
      const { parts, scale } = built(prop);
      put([], parts, prop.x * R, 0, prop.z * R, ((prop.turn ?? 0) * Math.PI) / 180, scale);
      const hull = planHull(parts).map(([x, z]): [number, number] => [x / R, z / R]);
      parts.forEach((g) => g.dispose());
      return hull;
    },
    // Props shown before or after a quest never stand together: count the town as a new voyage
    // finds it and with every one of its quests done, and keep the bigger (decision 0216).
    triangles: (level) => {
      const count = (d: IslandDesign) => {
        const parts = designedTownParts(d, R, level as TownLevel, harbour);
        const n = nearParts(parts).reduce((t, g) => t + g.getAttribute('position').count / 3, 0);
        parts.forEach((g) => g.dispose());
        return n;
      };
      const quests = designQuestIds(design);
      if (!quests.length) return count(design);
      return Math.max(
        count(questDesign(design, new Set())),
        count(questDesign(design, new Set(quests))),
      );
    },
  };
}
