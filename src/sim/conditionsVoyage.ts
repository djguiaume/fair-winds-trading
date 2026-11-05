import { GOODS } from './goods';
import { hasBuilding } from './home';
import { settlementLevel } from './settlement';
import { isDiscovered, standingAt } from './shipyards';
import { type ConditionKind, goodParam, numParam, portParam } from './conditionBasics';

/**
 * Conditions on the voyage as it stands (decision 0125): where the boat is, what is open, what the
 * captain owns and has done. They keep no numbers, so they work as a start or in a goal.
 */
export const VOYAGE_CONDITIONS: Record<string, ConditionKind> = {
  /** Alongside `port`, or any port when it names none. */
  docked: {
    params: { port: 'port?' },
    test: (c, ctx) => {
      const at = ctx.trade.dockedAt;
      return c.port === undefined ? at !== null : at !== null && at === portParam(c, ctx);
    },
  },
  /** A course set on the chart to `port`, or to any port when it names none. */
  course: {
    params: { port: 'port?' },
    test: (c, ctx) => {
      const to = ctx.course ?? null;
      return c.port === undefined ? to !== null : to !== null && to === portParam(c, ctx);
    },
  },
  /** The chart or the market is open (or the sea, with nothing over it). */
  screen: { params: { screen: 'screen' }, test: (c, ctx) => (ctx.screen ?? 'sea') === c.screen },
  discovered: {
    params: { port: 'port' },
    test: (c, ctx) => isDiscovered(ctx.trade, portParam(c, ctx) ?? ''),
  },
  'town-level': {
    params: { port: 'port', atLeast: 'count' },
    test: (c, ctx) => settlementLevel(ctx.trade, portParam(c, ctx) ?? '') >= numParam(c.atLeast),
  },
  standing: {
    params: { port: 'port', atLeast: 'count' },
    test: (c, ctx) => standingAt(ctx.trade, portParam(c, ctx) ?? '') >= numParam(c.atLeast),
  },
  'orders-done': {
    params: { atLeast: 'count' },
    test: (c, ctx) => ctx.trade.contracts.completed >= numParam(c.atLeast),
  },
  gold: {
    params: { atLeast: 'count' },
    test: (c, ctx) => ctx.trade.captain.gold >= numParam(c.atLeast),
  },
  /** At least `qty` (default 1) of a good aboard; with no `good`, of goods of any kind. */
  'has-cargo': {
    params: { good: 'good?', qty: 'count?' },
    test: (c, ctx) => {
      const qty = numParam(c.qty, 1);
      if (c.good === undefined)
        return GOODS.reduce((n, g) => n + ctx.trade.captain.cargo[g], 0) >= qty;
      const good = goodParam(c, ctx);
      return good !== null && ctx.trade.captain.cargo[good] >= qty;
    },
  },
  /**
   * A building stands on one of the captain's islands, or on `island` (decisions 0126, 0128): a
   * port can follow the choice.
   */
  built: {
    params: { building: 'building', island: 'island?' },
    test: (c, ctx) =>
      hasBuilding(ctx.trade.home, c.building as string, c.island as string | undefined),
  },
  /** Moored at the pier of the home island, or of `island` (one of hers with build spots). */
  moored: {
    params: { island: 'island?' },
    test: (c, ctx) => {
      const docked = ctx.trade.home.docked;
      return !!docked && docked === ((c.island as string | undefined) ?? ctx.map.homeIsland);
    },
  },
  'owns-ship': {
    params: { ship: 'ship' },
    test: (c, ctx) => ctx.trade.captain.ships[c.ship as string] !== undefined,
  },
  'series-won': {
    params: { series: 'series' },
    test: (c, ctx) => ctx.won?.includes(c.series as string) ?? false,
  },
};
