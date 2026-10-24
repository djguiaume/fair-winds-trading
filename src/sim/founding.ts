import type { MapDef } from './map';
import { settlementLevels, startLevel } from './settlement';
import { isFounded } from './shipyards';
import type { TradeState } from './trade';

/*
 * Founding an outpost (decisions 0137, 0157). A port marked `site` in the map is an empty island
 * until a quest reward `found` names it: no pier, no market, nothing on the chart, nowhere to dock.
 * Founding puts it on the chart and opens it at its start level; from then on it is a town like
 * any other, grows with the goods it wants and stops at its `maxLevel`. The founding goods and the
 * settlers are ordinary quest steps (`landed`, `carried` to a spot at sea), so every outpost is a
 * quest file and a port entry, and nothing about one outpost is in the code.
 */

/**
 * Town levels as the harbour is built: an unfounded site is level 0, so its island shows no pier
 * and no buildings from level 1 (its daymark has `from: 0`), and nobody docks there. The renderer,
 * the piers and docking read this; the settlement itself keeps its start level for the day it opens.
 */
export function townLevels(map: MapDef, trade: TradeState): Record<string, number> {
  const levels = settlementLevels(trade);
  for (const port of map.ports) if (!isFounded(trade, port)) levels[port.id] = 0;
  return levels;
}

/**
 * Found a site: on the chart, open at its start level with no growth yet, and fresh, as if just
 * supplied. Returns false when the port is no site or is already founded.
 */
export function foundSite(trade: TradeState, map: MapDef, portId: string): boolean {
  const port = map.ports.find((p) => p.id === portId);
  if (!port?.site || isFounded(trade, port)) return false;
  trade.progress.discovered.push(port.id);
  trade.settlements.byPort[port.id] = {
    level: startLevel(port),
    growth: 0,
    sinceSupply: 0,
    rare: 0,
  };
  return true;
}

/** The sites founded so far, in map order: a key that changes when one is founded. */
export function foundedSites(map: MapDef, trade: TradeState): string[] {
  return map.ports.filter((p) => p.site && isFounded(trade, p)).map((p) => p.id);
}
