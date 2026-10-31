import { TUNING } from '../data/tuning';
import { type BoatControls, type BoatState, stepBoat } from './boat';
import { clamp } from './math';
import { type SeaState, createSeaState, seaStateAt, steadySeaState } from './seaState';
import type { ShipClass } from './ship';
import type { Wind, WindConfig } from './wind';

/*
 * How the waves slow a ship (issue #284, decision 0256). One bounded rule on top of the polars,
 * never instead of them: a share of the speed she would make in flat water, most with her bow
 * into the seas, a little on the beam, almost nothing running before them, and never a boost.
 * Small hulls feel it more than big ones. It only lowers the speed she settles at, so the no-go
 * zone, tacking, the sails, the rudder and docking all answer as before, and nothing pushes her
 * sideways. The sea comes from the sea state (`seaState.ts`), not from what is drawn, so every
 * quality level, frame rate and the balance bots sail the same sea. It is the same rule on every
 * level (decision 0083: the boat sails the same); the harder levels' rougher weather raises
 * rougher seas by itself. Numbers: `waves.json` › `drag`.
 */

const drag = () => TUNING.waves.drag;

/** How much of `drag.perUnit` a band's waves cost with her bow at `cosHead` to where they come
 * from (1 head on, 0 abeam, -1 dead astern), as its `coherence` (0 = a confused sea) blends it. */
function headingShare(cosHead: number, coherence: number): number {
  const { head, beam, following } = drag();
  const steady =
    cosHead >= 0 ? beam + (head - beam) * cosHead : beam + (beam - following) * cosHead;
  return beam + (steady - beam) * clamp(coherence, 0, 1);
}

/** How much a hull feels the sea: `small.share` at `small.radius` down to `big.share`. */
export function hullShare(ship: ShipClass): number {
  const { small, big } = drag();
  const t = clamp((ship.radius - small.radius) / Math.max(1e-6, big.radius - small.radius), 0, 1);
  return small.share + (big.share - small.share) * t;
}

/**
 * The share (0..`drag.max`) of her flat-water speed the sea `sea` takes off `ship` heading
 * `heading` (compass radians).
 */
export function seaDrag(ship: ShipClass, heading: number, sea: SeaState): number {
  const tuning = drag();
  const ex = Math.sin(heading),
    ny = Math.cos(heading);
  let rough = 0;
  for (const name of ['swell', 'chop'] as const) {
    const band = sea[name];
    // The waves run toward (toX, toY): her bow meets them head on when it points the other way.
    const cosHead = -(ex * band.toX + ny * band.toY);
    rough += tuning[name] * band.height * headingShare(cosHead, band.coherence);
  }
  return Math.min(tuning.max, tuning.perUnit * rough * hullShare(ship));
}

/** What the sea needs from the world: `World` has all of it. */
export interface SeaSource {
  windConfig: WindConfig | null;
  map: { seed: number };
  time: number;
  /** A quest's or a race's held breeze: the sea it raises, as long settled. */
  calmWind: Wind | null;
  /** Settings › Waves slow the boat. */
  seaDragOn: boolean;
}

interface Sample {
  at: number;
  sea: SeaState;
}
const samples = new WeakMap<BoatState, Sample>();

/**
 * The sea around `boat`, read again every `drag.sampleSec` of world time (the swell answers the
 * wind over minutes, so that is plenty), so a fleet costs little and every run is the same.
 */
function seaAround(world: SeaSource, boat: BoatState): SeaState {
  let sample = samples.get(boat);
  if (!sample) samples.set(boat, (sample = { at: -Infinity, sea: createSeaState() }));
  const since = world.time - sample.at;
  if (since >= 0 && since < drag().sampleSec) return sample.sea;
  sample.at = world.time;
  if (world.calmWind) steadySeaState(world.calmWind.from, world.calmWind.speedKn, 0, sample.sea);
  else seaStateAt(world.windConfig, world.map.seed, world.time, boat.x, boat.y, sample.sea);
  return sample.sea;
}

/** `seaDrag` for a boat sailing in the world, in the sea where she is; 0 with the switch off. */
export function seaDragAt(world: SeaSource, boat: BoatState, ship: ShipClass): number {
  return world.seaDragOn ? seaDrag(ship, boat.heading, seaAround(world, boat)) : 0;
}

/** `stepBoat` in the sea where she is: the waves slow her as they slow every boat. */
export function stepBoatAtSea(
  world: SeaSource,
  boat: BoatState,
  controls: BoatControls,
  ship: ShipClass,
  wind: Wind,
  dt: number,
): void {
  stepBoat(boat, controls, ship, wind, dt, seaDragAt(world, boat, ship));
}
