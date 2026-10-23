import type { IslandDef, MapDef, TerrainDef } from '../sim/map';
import { wrapPositive } from '../sim/math';
import settings from './stress-map.json';

/** Local storage prefix of the stress sea's own voyage, so the real one is never touched. */
export const STRESS_PREFIX = 'fwt.stress.';

/**
 * The bigger-map test sea (decision 0115): the shipped map copied, turned and shifted to fill five
 * times its area, so drawing, wind, storms and the chart can be measured at the size the map will
 * grow to. Copies that would overlap land already placed, or the sea's edge, are left out.
 * A dev tool: it changes no gameplay and is reached only with `?map=stress`.
 */
export function stressMap(source: MapDef, config = settings): MapDef {
  const map: MapDef = {
    ...structuredClone(source),
    name: `${source.name} (stress test)`,
    compatibleSaveMaps: [],
    // The prologue's places are not copied: the tutorial starts at the chart there (decision 0127).
    prologue: undefined,
    boundsRadius: config.boundsRadius,
    islands: [],
    terrain: [],
    course: [],
    ports: [],
  };
  const placed: { x: number; y: number; r: number }[] = [];
  const fits = (x: number, y: number, r: number) =>
    Math.hypot(x, y) + r < config.boundsRadius - config.edgeMargin &&
    placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + config.clearance);

  config.copies.forEach((copy, k) => {
    const turn = (copy.turnDeg * Math.PI) / 180;
    const cos = Math.cos(turn),
      sin = Math.sin(turn);
    // Turning the layout counter-clockwise turns every compass bearing clockwise by as much.
    const move = (x: number, y: number) => ({
      x: Math.round((x * cos - y * sin + copy.x) * 10) / 10,
      y: Math.round((x * sin + y * cos + copy.y) * 10) / 10,
    });
    const suffix = k === 0 ? '' : `-${k + 1}`;
    const nameSuffix = k === 0 ? '' : ` ${k + 1}`;
    const kept = new Set<string>();
    for (const island of source.islands) {
      const at = move(island.x, island.y);
      if (!fits(at.x, at.y, island.radius)) continue;
      placed.push({ ...at, r: island.radius });
      kept.add(island.id);
      const out: IslandDef = structuredClone({ ...island, ...at, id: island.id + suffix });
      if (island.name) out.name = island.name + nameSuffix;
      if (out.look?.harbourBearing !== undefined)
        out.look.harbourBearing = wrapPositive(out.look.harbourBearing - turn);
      map.islands.push(out);
    }
    for (const terrain of source.terrain ?? []) {
      const outline = terrain.outline.map(([x, y]) => move(x, y));
      const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length;
      const cy = outline.reduce((s, p) => s + p.y, 0) / outline.length;
      const r = Math.max(...outline.map((p) => Math.hypot(p.x - cx, p.y - cy)));
      if (!fits(cx, cy, r)) continue;
      placed.push({ x: cx, y: cy, r });
      const out: TerrainDef = {
        ...structuredClone(terrain),
        id: terrain.id + suffix,
        outline: outline.map((p): [number, number] => [p.x, p.y]),
      };
      if (terrain.name) out.name = terrain.name + nameSuffix;
      map.terrain!.push(out);
    }
    for (const port of source.ports) {
      if (!kept.has(port.islandId)) continue;
      map.ports.push({
        ...structuredClone(port),
        id: port.id + suffix,
        name: port.name + nameSuffix,
        islandId: port.islandId + suffix,
      });
    }
    const names = new Map(source.islands.map((i) => [i.name, i.id]));
    for (const wp of source.course) {
      const id = names.get(wp.label);
      if (id !== undefined && !kept.has(id)) continue;
      map.course.push({ ...move(wp.x, wp.y), label: wp.label + nameSuffix });
    }
  });
  return map;
}
