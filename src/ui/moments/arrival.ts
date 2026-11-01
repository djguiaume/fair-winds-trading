import { tOptional } from '../../i18n';
import type { MapDef } from '../../sim/map';
import { harbourPoint } from '../../sim/traffic';

/** A port's harbour, where the arrival banner is measured from. */
export interface ArrivalSpot {
  id: string;
  x: number;
  y: number;
}

/** The harbours that can be announced: every port with a pier (a site waits to be founded). */
export function arrivalSpots(map: MapDef): ArrivalSpot[] {
  const spots: ArrivalSpot[] = [];
  for (const port of map.ports) {
    if (port.site) continue;
    const at = harbourPoint(map, port.id) ?? map.islands.find((i) => i.id === port.islandId);
    if (at) spots.push({ id: port.id, x: at.x, y: at.y });
  }
  return spots;
}

/** The numbers the watch reads from `tuning/ui.json`, live so an edit applies at once. */
export interface ArrivalRange {
  arrivalRadius: number;
  arrivalRearm: number;
}

/**
 * When the boat enters a port's waters (decision 0274): within `arrivalRadius` of its harbour,
 * not merely along its island's shore. Each port is announced once; the boat must sail
 * `arrivalRearm` away before it can be announced again, and a port she leaves from is held until
 * she has. Plain numbers, so the per-frame check allocates nothing.
 */
export class ArrivalWatch {
  private held: string | null = null;

  constructor(
    private readonly spots: readonly ArrivalSpot[],
    private readonly range: ArrivalRange,
  ) {}

  /** The port to announce now, if any. `welcome`: the port is known and may be named. */
  step(x: number, y: number, docked: string | null, welcome: (id: string) => boolean) {
    if (docked) {
      this.held = docked;
      return null;
    }
    if (this.held) {
      const spot = this.spots.find((s) => s.id === this.held);
      if (!spot || this.sq(spot, x, y) > this.range.arrivalRearm ** 2) this.held = null;
      return null;
    }
    const near = this.range.arrivalRadius ** 2;
    for (const spot of this.spots) {
      if (this.sq(spot, x, y) > near || !welcome(spot.id)) continue;
      this.held = spot.id;
      return spot.id;
    }
    return null;
  }

  private sq(spot: ArrivalSpot, x: number, y: number): number {
    return (spot.x - x) ** 2 + (spot.y - y) ** 2;
  }
}

/** The tagline under a port's name ("Home port"); outposts have none. */
export const taglineOf = (portId: string): string | undefined =>
  tOptional(`port.tagline.${portId}`);
