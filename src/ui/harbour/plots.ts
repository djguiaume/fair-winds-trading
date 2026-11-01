import { type MessageKey, t } from '../../i18n';
import { type BuildingDef, BUILDINGS, buildChoices, homeSpots, islandHome } from '../../sim/home';
import { buildingPerks } from '../../sim/perks';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { card } from '../components/card';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { coins } from './parts';

/**
 * The home island's plots (decisions 0126, 0210) as the harbour ledger shows them (issue #443):
 * one row per plot on the left, the picked plot on the right with its two buildings. Chosen ("see
 * it on the island"), the plot's buildings come with their Build buttons beside the island.
 */

/** Who gives a plot (the arc's giver and port), for its name and its line. */
export interface PlotGiver {
  name: string;
  port: string;
}

/** One plot as the Island tab lists it. */
export interface PlotRow {
  spot: string;
  n: number;
  /** Something to build now: free (an arc's plot) or for gold (a spare). */
  open: boolean;
  built?: BuildingDef;
  giver?: PlotGiver;
  pair: BuildingDef[];
}

/** A building's perks in the player's words, one sentence each (decisions 0126, 0136). */
export function effectLine(b: BuildingDef): string {
  return buildingPerks(b.id)
    .map((p) =>
      t(`perk.${p.id}` as MessageKey, {
        pct: Math.round(Math.abs(1 - (p.multiply ?? 1)) * 100),
        n: p.add ?? 0,
      }),
    )
    .join(' ');
}

export const buildingName = (b: BuildingDef) => t(`building.${b.id}` as MessageKey);
const buildingA = (b: BuildingDef) => t(`building.${b.id}.a` as MessageKey);
const kindOf = (b: BuildingDef) =>
  t(`hook.${buildingPerks(b.id)[0]?.hook ?? 'repairPrice'}` as MessageKey);

/** The plots: the ones to build first, then in number order. */
export function plotRows(
  world: World,
  island: string,
  giverOf: (island: string, spot: string) => PlotGiver | undefined,
): PlotRow[] {
  const { trade, map } = world;
  const home = islandHome(trade.home, island);
  const rows = homeSpots(map, island).map((spot, i): PlotRow => {
    const built = home.built[spot.id];
    return {
      spot: spot.id,
      n: i + 1,
      open: buildChoices(trade, map, spot.id, island).length > 0,
      built: built ? BUILDINGS.find((b) => b.id === built) : undefined,
      giver: spot.pair ? giverOf(island, spot.id) : undefined,
      pair: spot.pair ? BUILDINGS.filter((b) => b.pair === spot.pair) : [],
    };
  });
  // A spare plot shows only while it has something to offer or stands built.
  const shown = rows.filter((r) => r.pair.length || r.open || r.built);
  return [...shown.filter((r) => r.open), ...shown.filter((r) => !r.open)];
}

function plotTitle(r: PlotRow): string {
  // A plot still to be given has no name yet (the storyteller's rule, 0210).
  if (!r.giver || !r.pair.length || !(r.open || r.built)) return t('home.plotN', { n: r.n });
  return t(/^[aeiouyàâéèêëîïôûüœæ]/i.test(r.giver.name) ? 'home.plotOfVowel' : 'home.plotOf', {
    name: r.giver.name,
  });
}

function plotTag(r: PlotRow): string {
  if (r.built) return `${t('home.builtTag')} · ${buildingName(r.built)}`;
  if (!r.open) return '';
  return t(r.pair.length ? 'home.stakedFree' : 'home.stakedGold');
}

function plotLine(r: PlotRow): string {
  const [a, b] = r.pair;
  if (r.built) return effectLine(r.built);
  if (!r.pair.length) return t('home.spare');
  if (r.open && r.giver) return t('home.fromGiver', { ...r.giver });
  if (r.giver) return t('home.willStake', { ...r.giver, a: buildingA(a!), b: buildingA(b!) });
  return t('home.someone', { a: buildingA(a!), b: buildingA(b!) });
}

const stateOf = (r: PlotRow) => (r.built ? 'is-built' : r.open ? 'is-open' : 'is-locked');

/** The plots as ledger rows: the number on its disc, the name, what stands or who will stake it. */
export function plotsLedger(
  rows: readonly PlotRow[],
  selected: string | undefined,
  pick: (spot: string) => void,
): HTMLElement {
  const list = el('div', 'hb-list hb-scroll hb-plots');
  for (const r of rows) {
    const tag = plotTag(r);
    const row = listRow({
      label: plotTitle(r),
      detail: plotLine(r),
      value: tag || undefined,
      selected: r.spot === selected,
      onPress: () => pick(r.spot),
    });
    row.classList.add('hb-row', 'hb-plot', stateOf(r));
    row.dataset.pick = `plot:${r.spot}`;
    row.prepend(el('span', 'hb-plot-n', String(r.n)));
    list.append(row);
  }
  return list;
}

export interface PlotActions {
  /** "See it on the island": the camera turns to the plot, the paper steps aside. */
  choose: (spot: string) => void;
  build: (building: string) => void;
}

/**
 * The picked plot: its name, tag and line, what can stand on it (each building's kind, name and
 * effect), and the way on: see it on the island, or, chosen, a Build button on each building.
 */
export function plotDetail(
  world: World,
  island: string,
  r: PlotRow,
  chosen: boolean,
  act: PlotActions,
): HTMLElement {
  const box = el('article', 'hb-detail hb-plot-detail');
  const name = el('h2', 'hb-detail-name', plotTitle(r));
  const tag = plotTag(r);
  box.append(name);
  if (tag) box.append(el('p', 'hb-plot-tag', tag));
  box.append(el('p', 'hb-detail-note', plotLine(r)));
  if (!r.open) return box;
  const gold = world.trade.captain.gold;
  const choices = el('div', 'hb-buildings');
  for (const { building, price } of buildChoices(world.trade, world.map, r.spot, island)) {
    const c = card({ title: buildingName(building), text: effectLine(building) });
    c.classList.add('hb-building');
    c.prepend(el('span', 'hb-building-kind', kindOf(building)));
    if (chosen) c.append(buildButton(building, price, gold, act));
    choices.append(c);
  }
  box.append(choices);
  if (!chosen) {
    const see = button({
      label: t('home.choosePlot'),
      variant: 'primary',
      onPress: () => act.choose(r.spot),
    });
    see.dataset.choose = r.spot;
    box.append(see);
  }
  return box;
}

function buildButton(building: BuildingDef, price: number, gold: number, act: PlotActions) {
  const short = price > gold;
  const b = button({
    label: short ? t('home.notEnoughGold') : price ? t('home.build') : t('home.buildFree'),
    variant: 'primary',
    icon: 'anchor',
    disabled: short,
    onPress: () => act.build(building.id),
  });
  b.dataset.build = building.id;
  if (price && !short)
    b.insertAdjacentHTML('beforeend', `<span class="hb-price">${coins(price)}</span>`);
  return b;
}

/** "Your island · 2 plots to build": the island in one line under its name. */
export function islandLine(toBuild: number): string {
  const build = toBuild === 1 ? t('home.toBuildOne') : t('home.toBuildMany', { n: toBuild });
  return toBuild ? `${t('home.yourIsland')} · ${build}` : t('home.yourIsland');
}
