import { ISLAND_DESIGNS, questShown } from '../../data/islands';
import { t } from '../../i18n';
import { bergsAt } from '../../sim/bergs';
import { knobs } from '../../sim/difficulty';
import { chartedAt, islandCharted } from '../../sim/fog';
import { ownedIslands } from '../../sim/home';
import { islandCoasts, islandLake } from '../../sim/islandLayout';
import type { IslandDef, PortDef, SeaMarkDef } from '../../sim/map';
import { questsDone } from '../../sim/settlement';
import { seaShape } from '../../sim/seaEdge';
import { seaMarkShape } from '../chartMarks';
import { SHIPPED_THEME } from '../theme/model';
import { seaSvg } from '../seaOutline';
import { type Box, box, boxOf, type Paint, points } from './svg';

/** A name to place on the chart once the ports have theirs (decision 0058). */
export interface Place {
  name: string;
  x: number;
  top: number;
  bottom: number;
}

/** What the land leaves for the labels: names to place, land to keep off, her own islands. */
export interface LandOut {
  places: Place[];
  landBoxes: Box[];
  homes: IslandDef[];
}

/**
 * The land's wash: the theme's pale green, or its own for a style that has one (`land-ice`, snow
 * on an ice island, decision 0170; `land-volcano`, ash).
 */
function landWash(design: string | undefined): string | null {
  const style = design ? ISLAND_DESIGNS[design]?.style : undefined;
  return style && SHIPPED_THEME.chart[`land-${style}`] ? `var(--ui-chart-land-${style})` : null;
}

/** The paper sea inside its inked rim, a section joined to the round sea included (0202). */
export function drawWater({ world, shape, unit }: Paint) {
  const water = seaSvg(seaShape(world.map), 4 * unit);
  shape(water.tag, { ...water.attrs, class: 'chart-sea' });
}

const TERRAIN_CLASS: Record<string, string> = {
  reef: 'chart-reef',
  shallows: 'chart-shallows',
  ice: 'chart-ice',
  bergs: 'chart-bergs',
};

/**
 * The land standing now (an island a quest has not raised yet is not drawn, 0166): a pale green
 * wash inside an engraved ink coast, an ice island in its own wash (0170); reefs as dotted ink,
 * shoals as pale sand, ice as a grey wash. Returns the names it leaves for the labels.
 */
export function drawLand(p: Paint, charted: readonly PortDef[]): LandOut {
  const { world, shape } = p;
  const { map, trade } = world;
  const out: LandOut = { places: [], landBoxes: [], homes: [] };
  const coast = (tag: string, attrs: Record<string, string | number>, design?: string) => {
    const wash = landWash(design);
    shape(tag, { ...attrs, class: 'chart-land', ...(wash ? { style: `fill:${wash}` } : {}) });
  };
  const owned = ownedIslands(trade.home);
  const hasPort = (id: string) => charted.some((port) => port.islandId === id);
  for (const island of world.land.islands) {
    const coasts = islandCoasts(island);
    if (coasts)
      for (const o of coasts) coast('polygon', { points: points(o) }, island.look?.design);
    else coast('circle', { cx: island.x, cy: -island.y, r: island.radius }, island.look?.design);
    const lake = islandLake(island);
    if (lake) shape('polygon', { points: points(lake), class: 'chart-lake' });
    out.landBoxes.push(
      coasts
        ? boxOf(coasts.flat())
        : box(island.x, -island.y, island.radius * 2, island.radius * 2),
    );
    if (owned.includes(island.id) && !hasPort(island.id)) out.homes.push(island);
    else if (island.name && !hasPort(island.id) && islandCharted(map, trade.progress, island))
      out.places.push({
        name: island.name,
        x: island.x,
        top: -island.y - island.radius,
        bottom: -island.y + island.radius,
      });
  }
  for (const terrain of world.land.terrain) {
    if (terrain.kind === 'island') coast('polygon', { points: points(terrain.outline) });
    else
      shape('polygon', {
        points: points(terrain.outline),
        class: TERRAIN_CLASS[terrain.kind] ?? 'chart-bank',
      });
    const b = boxOf(terrain.outline);
    // Names keep off land and off ice, the pack's own name included (decision 0170).
    if (terrain.kind === 'island' || terrain.kind === 'ice') out.landBoxes.push(b);
    const known = chartedAt(map, trade.progress, (b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2);
    if (!known) continue;
    // Where each berg is now: only on a level whose chart shows them (Fair winds, 0170).
    if (terrain.kind === 'bergs' && world.bergsOn && knobs(trade.difficulty).chartBergs)
      for (const berg of bergsAt(map, world.time))
        if (berg.field === terrain.id)
          shape('circle', { cx: berg.x, cy: -berg.y, r: berg.r, class: 'chart-berg' });
    const name = terrainName(terrain.kind, terrain.name);
    if (name) out.places.push({ name, x: (b.x0 + b.x1) / 2, top: b.y0, bottom: b.y1 });
  }
  return out;
}

/**
 * A charted shape's name as the chart prints it: an island's or a pack's own (0170), drifting ice
 * and sandy passages say what they are (decisions 0137, 0152); reefs and banks stay unnamed.
 */
function terrainName(kind: string, name: string | undefined): string | null {
  if (!name) return null;
  if (kind === 'island' || kind === 'ice') return name;
  if (kind === 'bergs') return t('chart.bergs', { name });
  if (kind === 'shallows') return t('chart.shallows', { name });
  return null;
}

/**
 * Sea marks (decision 0130): channel buoys and lights once their quest says so and their water is
 * charted, then a running quest's own marks (0164), named or not. Names join the places.
 */
export function drawSeaMarks(p: Paint, quests: readonly SeaMarkDef[], places: Place[]) {
  const { world, shape, px } = p;
  const { map, trade } = world;
  const done = questsDone(trade);
  const shown = (map.marks ?? []).filter(
    (m) => m.chart && questShown(m, done) && chartedAt(map, trade.progress, m.x, m.y),
  );
  for (const mark of [...shown, ...quests]) {
    // A named mark (a gateway's light) gets its place name beside it (decision 0152).
    if (mark.name)
      places.push({ name: mark.name, x: mark.x, top: -mark.y - 6, bottom: -mark.y + 6 });
    const { tag, attrs } = seaMarkShape(mark, px);
    shape(tag, { ...attrs, class: 'chart-mark' });
  }
}
