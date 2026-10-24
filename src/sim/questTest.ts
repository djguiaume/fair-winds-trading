import { TUNING } from '../data/tuning';
import type { Pier } from './collision';
import type { MapDef } from './map';
import { clearAt } from './mapChecks';
import { wrapAngle } from './math';
import { settlementLevel } from './settlement';
import { type TradeState, distanceToPort, findPort } from './trade';

/*
 * Play a quest from one of its steps (decision 0142). The quest builder opens the game in a new
 * tab with `?map=edited&quest=<id>&step=<id>` and either `&port=<id>` (start docked there) or
 * `&x=…&y=…&h=…` (start at sea, at that point and heading in degrees). The voyage is fresh and kept
 * in memory only, so a test never touches a save.
 */

export interface QuestTest {
  quest: string;
  step: string;
  /** Start docked at this port. */
  port?: string;
  /** Or start at sea here. */
  at?: { x: number; y: number; headingDeg: number };
}

/** The quest test the address asks for, or null. */
export function questTestFrom(search: string): QuestTest | null {
  const q = new URLSearchParams(search);
  const quest = q.get('quest');
  const step = q.get('step');
  if (q.get('map') !== 'edited' || !quest || !step) return null;
  const x = Number(q.get('x'));
  const y = Number(q.get('y'));
  const at =
    q.has('x') && q.has('y') && Number.isFinite(x) && Number.isFinite(y)
      ? { x, y, headingDeg: Number(q.get('h')) || 0 }
      : undefined;
  return { quest, step, port: q.get('port') ?? undefined, at };
}

const dist = (px: number, py: number, p: Pier) => {
  const dx = p.x1 - p.x0;
  const dy = p.y1 - p.y0;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - p.x0) * dx + (py - p.y0) * dy) / len2));
  return Math.hypot(px - (p.x0 + t * dx), py - (p.y0 + t * dy));
};

/**
 * Where the boat waits docked at a port for a test: the clear water in docking range nearest the
 * pier head, off the shore and the piers, heading away from the island. Null if there is none.
 */
export function testBerth(
  map: MapDef,
  trade: TradeState,
  piers: readonly Pier[],
  portId: string,
  shipId: string,
): { x: number; y: number; headingDeg: number } | null {
  const port = findPort(map, portId);
  const island = port && map.islands.find((i) => i.id === port.islandId);
  if (!port || !island) return null;
  const range = TUNING.seamanship.harbour.dockRange;
  const head = piers.find((p) => p.islandId === island.id && !p.boat);
  const from = head ? { x: head.x1, y: head.y1 } : { x: island.x, y: island.y - island.radius };
  const level = settlementLevel(trade, port.id);
  let best: { x: number; y: number; d: number } | null = null;
  for (let r = 3; r <= range && !best; r += 1.5)
    for (let a = 0; a < 360; a += 10) {
      const x = from.x + r * Math.cos((a * Math.PI) / 180);
      const y = from.y + r * Math.sin((a * Math.PI) / 180);
      if (!clearAt(map, x, y, 3) || piers.some((p) => dist(x, y, p) < 4)) continue;
      // Radians, bow towards (sin, cos): pointing out to sea.
      const heading = Math.atan2(x - island.x, y - island.y);
      const d = distanceToPort(map, { x, y, heading }, port, level, shipId, range);
      if (d <= range * 0.6 && (!best || d < best.d)) best = { x, y, d };
    }
  if (!best) return null;
  const headingDeg = (Math.atan2(best.x - island.x, best.y - island.y) * 180) / Math.PI;
  return { x: best.x, y: best.y, headingDeg: (headingDeg + 360) % 360 };
}

/**
 * A heading she can sail from a standstill: the asked one, or, when it points into the wind (`from`,
 * radians, like the heading), the nearest one a little off the no-go zone.
 */
export function sailableHeading(heading: number, from: number, noGo: number): number {
  const off = wrapAngle(heading - from);
  const clear = noGo + (20 * Math.PI) / 180;
  if (Math.abs(off) >= clear) return heading;
  return from + (off < 0 ? -clear : clear);
}
