import { islandPoint } from '../sim/islandLayout';
import type { IslandDef, MapDef } from '../sim/map';
import { TUNING } from '../data/tuning';
import { type HarbourViewDef, designOf } from '../data/islands';
import PALETTE_FILE from '../data/palette.json';
import HARBOUR_VIEW from '../data/harbour-view.json';

/**
 * The harbour screen's picture of a port (decision 0211): where the camera stands and which light
 * it is taken in. Pure numbers, so the renderer, the editor and the tests share them.
 */

export { HARBOUR_VIEW };

/** The three lights a picture is cached in: it matches the time of day when she docks. */
export type HarbourLight = 'day' | 'golden' | 'night';
export const HARBOUR_LIGHTS: readonly HarbourLight[] = ['day', 'golden', 'night'];

/** The light bucket for a moment of the day (`daylightAt`). */
export function harbourLight(day: { night: number; warm: number }): HarbourLight {
  if (day.night >= HARBOUR_VIEW.light.nightFrom) return 'night';
  if (day.warm >= HARBOUR_VIEW.light.goldenFrom) return 'golden';
  return 'day';
}

/** A time of day that shows each light at its clearest, in game seconds (`weather.json` › `daylight`). */
export function harbourLightTime(light: HarbourLight): number {
  const { dayEnd, duskEnd, nightEnd } = TUNING.weather.daylight;
  if (light === 'night') return (duskEnd + nightEnd) / 2;
  if (light === 'golden') return dayEnd - 2;
  return dayEnd / 2;
}

/** Where the picture's camera stands and looks, in sim coordinates (y north) and heights. */
export interface HarbourShot {
  from: { x: number; y: number };
  fromHeight: number;
  look: { x: number; y: number };
  lookHeight: number;
}

/**
 * The camera for a port's picture. By default it stands out at sea off the harbour pier, a little
 * to one side, and looks back across the pier at the town; an island file's `harbourView` places
 * it by hand, in the file's own coordinates (radius units, like everything in it).
 */
export function harbourShot(
  island: IslandDef,
  pier: { x: number; y: number },
  view?: HarbourViewDef,
): HarbourShot {
  const R = island.radius;
  const cam = HARBOUR_VIEW.camera;
  let dx = pier.x - island.x;
  let dy = pier.y - island.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const look = view?.look
    ? islandPoint(island, view.look[0], view.look[1])
    : { x: island.x + dx * len * cam.look, y: island.y + dy * len * cam.look };
  const from = view?.from
    ? islandPoint(island, view.from[0], view.from[1])
    : {
        x: pier.x + dx * R * cam.out - dy * R * cam.side,
        y: pier.y + dy * R * cam.out + dx * R * cam.side,
      };
  return {
    from,
    fromHeight: R * (view?.height ?? cam.height),
    look,
    lookHeight: R * (view?.lookHeight ?? cam.lookHeight),
  };
}

/** The cache key of a picture: the port, its light, and whatever changes the town's look. */
export function harbourPictureKey(portId: string, light: HarbourLight, look: string): string {
  return `${portId}|${light}|${look}`;
}

/**
 * The port's signature colour, the accent line under the harbour screen's header: its island
 * file's `harbourView.accent`, else the first roof colour of its town style.
 */
export function harbourAccent(map: MapDef, portId: string): string | null {
  const port = map.ports.find((p) => p.id === portId);
  const island = port && map.islands.find((i) => i.id === port.islandId);
  const design = island && designOf(island);
  if (!design) return null;
  if (design.harbourView?.accent) return design.harbourView.accent;
  const styles = PALETTE_FILE.styles as Record<string, { roofs?: string[] }>;
  return styles[design.style]?.roofs?.[0] ?? null;
}
