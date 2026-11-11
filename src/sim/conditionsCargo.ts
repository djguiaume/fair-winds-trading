import { GOODS, type GoodId } from './goods';
import {
  type ConditionKind,
  type QuestSpot,
  type StepContext,
  goodParam,
  isSpot,
  numParam,
  portParam,
} from './conditionBasics';

/*
 * Conditions about goods and quest cargo (decisions 0125, 0131, 0157, 0213): handed over, bought,
 * landed, carried. Each keeps numbers while its step runs, so they only work in a step's goal.
 */

/** Inside a spot at sea, slow enough. */
function inSpot(spot: QuestSpot, ctx: StepContext): boolean {
  return (
    Math.hypot(ctx.boat.x - spot.x, ctx.boat.y - spot.y) <= spot.within &&
    ctx.boat.speedKn <= (spot.maxKn ?? Infinity)
  );
}

const holdOf = (spot: QuestSpot) => Math.round(numParam(spot.holdSec) * 100);

/** The goods bought alongside a port since the last check: good → how many more aboard. */
function boughtSince(ctx: StepContext, good: GoodId | null): number {
  let n = 0;
  for (const g of good ? [good] : GOODS)
    n += Math.max(0, ctx.trade.captain.cargo[g] - ctx.cargoBefore[g]);
  return n;
}

export const CARGO_CONDITIONS: Record<string, ConditionKind> = {
  /**
   * Goods handed over alongside `port`, sold or for an order, since the step began; buying the
   * same good back there counts off again. Slot: how many.
   */
  delivered: {
    params: { port: 'port', good: 'good', qty: 'count' },
    slots: 1,
    update(c, ctx, s) {
      const at = portParam(c, ctx);
      const good = goodParam(c, ctx);
      if (!at || !good || ctx.trade.dockedAt !== at) return;
      const handed = ctx.cargoBefore[good] - ctx.trade.captain.cargo[good];
      s[0] = Math.min(numParam(c.qty), Math.max(0, s[0]! + handed));
    },
    test: (c, _ctx, s) => s[0]! >= numParam(c.qty),
    news(c, ctx, s) {
      const at = portParam(c, ctx);
      const good = goodParam(c, ctx);
      const total = numParam(c.qty);
      const done = s[0]!;
      if (!at || !good || ctx.trade.dockedAt !== at || done >= total) return null;
      const news = { good, n: done, left: total - done, done, total, space: 0 };
      if (ctx.trade.captain.cargo[good] > 0) return { ...news, kind: 'handHere' };
      return done ? { ...news, kind: 'handedOver' } : null;
    },
  },
  /**
   * Goods bought alongside `port` since the step began (with no `good`, of any kind); a good taken
   * aboard there any other way counts too. Slot: how many.
   */
  bought: {
    params: { port: 'port', good: 'good?', qty: 'count' },
    slots: 1,
    update(c, ctx, s) {
      const at = portParam(c, ctx);
      if (!at || ctx.trade.dockedAt !== at) return;
      if (c.good !== undefined && !goodParam(c, ctx)) return;
      s[0] = Math.min(numParam(c.qty), s[0]! + boughtSince(ctx, goodParam(c, ctx)));
    },
    test: (c, _ctx, s) => s[0]! >= numParam(c.qty),
  },
  /**
   * Goods landed for the quest at `place` (decision 0157): alongside a port, or held slowly at a
   * spot at sea, they come out of the hold by themselves, as many as she has aboard up to `qty`,
   * so a short load lands what it can and the rest comes later. Nothing is paid; founding goods
   * for an empty island land this way. Slots: how many landed, hundredths of a second held.
   */
  landed: {
    params: { place: 'place', good: 'good', qty: 'count' },
    slots: 2,
    update(c, ctx, s) {
      const good = goodParam(c, ctx);
      const place = c.place;
      let at: boolean;
      if (isSpot(place)) {
        // Held up to the spot's time, then kept there while the boat stays: "alongside".
        s[1] = inSpot(place, ctx) ? Math.min(s[1]! + Math.round(ctx.dt * 100), holdOf(place)) : 0;
        at = inSpot(place, ctx) && s[1]! >= holdOf(place);
      } else at = ctx.trade.dockedAt !== null && ctx.trade.dockedAt === portParam(c, ctx, 'place');
      if (!at || !good || !ctx.land) return;
      const n = Math.min(numParam(c.qty) - s[0]!, ctx.trade.captain.cargo[good]);
      if (n <= 0) return;
      ctx.land(good, n);
      s[0] = s[0]! + n;
    },
    test: (c, _ctx, s) => s[0]! >= numParam(c.qty),
  },
  /**
   * Quest cargo (`carried`): pieces of the quest's `item`, loaded at `from` as far as the hold has
   * room, unloaded at `to`. Each is a port (alongside) or a spot at sea (decision 0131: held
   * slowly there). It takes hold space and cannot be sold. Slots: pieces aboard, pieces delivered,
   * hundredths of a second held at a spot.
   */
  carried: {
    params: { item: 'item', qty: 'count', from: 'place', to: 'place' },
    slots: 3,
    update(c, ctx, s) {
      const spot = [c.from, c.to].find((p) => isSpot(p) && inSpot(p, ctx)) as QuestSpot | undefined;
      // Held up to the spot's time, then kept there while the boat stays: "alongside".
      s[2] = spot ? Math.min(s[2]! + Math.round(ctx.dt * 100), holdOf(spot)) : 0;
      const at = (key: 'from' | 'to') =>
        isSpot(c[key])
          ? c[key] === spot && s[2]! >= holdOf(spot)
          : ctx.trade.dockedAt === portParam(c, ctx, key);
      if (at('from')) {
        const space = ctx.itemSpace(c.item as string);
        // Space 0: a passenger, who takes no room in the hold.
        const room = space > 0 ? Math.floor(ctx.freeSpace / space) : Infinity;
        s[0] = s[0]! + Math.max(0, Math.min(numParam(c.qty) - s[0]! - s[1]!, room));
      }
      if (at('to')) {
        s[1] = s[1]! + s[0]!;
        s[0] = 0;
      }
    },
    test: (c, _ctx, s) => s[1]! >= numParam(c.qty),
    news(c, ctx, s) {
      const place = (key: 'from' | 'to') => (isSpot(c[key]) ? 'spot' : portParam(c, ctx, key)!);
      const at = (key: 'from' | 'to') =>
        isSpot(c[key])
          ? inSpot(c[key] as QuestSpot, ctx) && s[2]! >= holdOf(c[key] as QuestSpot)
          : ctx.trade.dockedAt !== null && ctx.trade.dockedAt === portParam(c, ctx, key);
      const total = numParam(c.qty);
      const [aboard, done] = [s[0]!, s[1]!];
      const left = Math.max(0, total - aboard - done);
      if (done >= total) return null;
      const item = c.item as string;
      const space = Math.max(0, ctx.itemSpace(item) - ctx.freeSpace);
      const news = {
        item,
        n: aboard,
        left,
        done,
        total,
        space,
        to: place('to'),
        from: place('from'),
      };
      if (at('from')) {
        if (!left)
          return {
            ...news,
            kind:
              ctx.itemSpace(item) === 0 ? 'loadedPassenger' : total === 1 ? 'loadedOne' : 'loaded',
          };
        // Room enough: the rest comes aboard at the next check.
        if (!space) return null;
        return { ...news, kind: aboard ? 'loadedShort' : 'noRoom' };
      }
      if (at('to')) {
        if (done) return { ...news, kind: 'unloaded', n: done };
        if (!aboard) return { ...news, kind: 'nothingAboard' };
      }
      return null;
    },
  },
};
