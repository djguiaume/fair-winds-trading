import grown from '../data/seas/grown.json';
import { SEA_SECTORS } from '../data/grownMap';
import { bearingOf, inSector } from '../sim/seaSectors';
import type { Rng } from '../sim/rng';
import { RING, type BoatSounds, type CallPlace, type SeaBed, type SeaCall } from './catalog';

/*
 * What the sea sounds like where the boat is (decision 0209), worked out without Web Audio so it
 * can be tested and played offline: which sea's bed, how loud each layer, and which calls are due.
 * `ambience.ts` turns the answer into sound.
 */

/**
 * The sea a point is in: the ring inside its charted radius, else the sea whose sector of the
 * outer ring holds its bearing (decision 0179); the ring when no sector does.
 */
export function seaIdAt(x: number, y: number, ringRadius = grown.chartedRadius): string {
  if (Math.hypot(x, y) <= ringRadius) return RING;
  const bearing = bearingOf(x, y);
  for (const [id, sector] of Object.entries(SEA_SECTORS))
    if (inSector(bearing, sector, 0)) return id;
  return RING;
}

/** What the game tells the sound about the boat, a few times a second. */
export interface SoundsHere {
  /** True wind at the boat, knots. */
  windKn: number;
  /** Speed through the water, knots. */
  speedKn: number;
  /** Bows in the no-go zone with sail up: the canvas flogs. */
  luffing: boolean;
  /** Rain at the boat, 0 to 1. */
  rain: number;
  /** Alongside a pier: no wash, no luffing. */
  docked: boolean;
  /** Calmer water (Sunreach's lagoon), the waves' share 0 to 1 (1 = none). */
  calm: number;
}

/** Every layer's loudness and filter, before the Sounds volume. */
export interface LayerMix {
  waves: number;
  wavesTone: number;
  swellHz: number;
  wind: number;
  windTone: number;
  wash: number;
  luff: number;
  rain: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The layers for a bed: the waves grow a little with the wind, the wind's whistle rises and
 * brightens with it, the wash follows her speed, the luffing and the rain are on or off.
 */
export function layerMix(bed: SeaBed, boat: BoatSounds, here: SoundsHere): LayerMix {
  const wind = clamp(here.windKn, 0, 40);
  return {
    waves: bed.waves.level * (0.65 + 0.35 * clamp(wind / 20, 0, 1.3)) * here.calm,
    wavesTone: bed.waves.tone * (0.85 + 0.3 * clamp(wind / 25, 0, 1.2)),
    swellHz: 1 / bed.waves.swellSec,
    wind: bed.wind.level * clamp((wind - 2) / 20, 0.06, 1.25),
    windTone: bed.wind.tone * (0.7 + 0.6 * clamp(wind / 30, 0, 1)),
    wash: here.docked ? 0 : boat.wash.level * clamp(here.speedKn / boat.wash.fullKn, 0, 1.2),
    luff: here.luffing && !here.docked ? boat.luff.level * clamp(wind / 12, 0.4, 1.2) : 0,
    rain: boat.rain.level * clamp(here.rain, 0, 1),
  };
}

/** How far the boat is from what a call is tied to, in map units (Infinity: none about). */
export interface PlaceDistances {
  /** From the island's shore, by id; any island for `"any"`. */
  island(ids: string[] | 'any'): number;
  bergs: number;
  vents: number;
  reefs: number;
  /** A storm or a storm belt's squall at the boat. */
  storm: boolean;
  raining: boolean;
}

function distanceTo(place: CallPlace, where: PlaceDistances): number {
  if (place.islands !== undefined) return where.island(place.islands);
  if (place.bergs) return where.bergs;
  if (place.vents) return where.vents;
  if (place.reefs) return where.reefs;
  return Infinity;
}

/** A call's loudness here, 0 when it may not sound: full at the place, 0.4 at its range. */
export function callLevel(call: SeaCall, where: PlaceDistances): number {
  if (call.when === 'storm' && !where.storm) return 0;
  if (call.when === 'rain' && !where.raining) return 0;
  if (call.away && distanceTo(call.away, where) <= call.away.range) return 0;
  let level = call.volume ?? 1;
  if (call.near) {
    const d = distanceTo(call.near, where);
    if (d > call.near.range) return 0;
    level *= 1 - 0.6 * clamp(d / call.near.range, 0, 1);
  }
  return level;
}

/**
 * Times every call of the sea the boat is in. A call only counts down while it may sound, so a
 * gull doesn't cry the instant she sails into its range; the first wait is a random share of one.
 */
export class CallClock {
  private waits = new Map<string, number>();

  constructor(private readonly rng: Rng) {}

  /** The calls due in the last `dt` seconds of `sea`'s bed, with their loudness. */
  step(
    dt: number,
    sea: string,
    bed: SeaBed,
    where: PlaceDistances,
  ): { effect: string; level: number }[] {
    const due: { effect: string; level: number }[] = [];
    (bed.calls ?? []).forEach((call, k) => {
      const key = `${sea}:${k}`;
      const [lo, hi] = call.every;
      const level = callLevel(call, where);
      let wait = this.waits.get(key) ?? this.rng() * hi;
      if (level > 0) {
        wait -= dt;
        if (wait <= 0) {
          due.push({ effect: call.effect, level });
          wait = lo + this.rng() * (hi - lo);
        }
      }
      this.waits.set(key, wait);
    });
    return due;
  }
}

/** The calm share at a point: the lowest `waves` of the bed's calm places she is inside. */
export function calmAt(
  bed: SeaBed,
  islands: readonly { id: string; x: number; y: number; radius: number }[],
  x: number,
  y: number,
): number {
  let calm = 1;
  for (const c of bed.calm ?? []) {
    const island = islands.find((i) => i.id === c.island);
    if (island && Math.hypot(island.x - x, island.y - y) <= island.radius * c.within)
      calm = Math.min(calm, c.waves);
  }
  return calm;
}
