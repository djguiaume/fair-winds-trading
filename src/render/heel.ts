import { DEG, clamp } from '../sim/math';

/**
 * Visual heeling (decision 0044): how far the boat model leans away from the wind. Render-only,
 * it reads the wind the boat feels (sea wind with gusts, island lee and channel effects) and never
 * changes the simulation, so speed and controls are the same with or without it.
 */

/** Heel of a stock sloop with full sails on a beam reach in the maps' 14 kn breeze: about 1.3× a real
 * small sloop, so the lean still reads from the high camera (Guillaume, 2026-10-20). */
export const BASE_HEEL = 14.3 * DEG;
/** No hull ever leans past this, however strong the wind. */
export const MAX_HEEL = 23 * DEG;
/** Wind speed that gives BASE_HEEL. */
const REFERENCE_KN = 14;

/**
 * How readily each class leans, 1 = sloop. Tall, slim rigs heel more; wide, heavy hulls stand up
 * to the wind. Covers the ship lines of decision 0035, so a new class only needs its model.
 */
export const HEEL_FACTOR: Readonly<Record<string, number>> = {
  sloop: 1,
  // Swift line: tall fore-and-aft rigs on slim hulls.
  cutter: 1.05,
  schooner: 1.15,
  clipper: 1.05,
  // Warship line: wide hulls, heavy guns low down.
  ketch: 0.85,
  brig: 0.75,
  frigate: 0.65,
  // Hauler line: deep round hulls full of cargo.
  hoy: 0.75,
  fluyt: 0.6,
  indiaman: 0.5,
};

export function heelFactor(shipClassId: string): number {
  return HEEL_FACTOR[shipClassId] ?? 1;
}

/**
 * Point of sail → share of the heeling force, 0..1. Nothing in irons; the most from a close
 * reach to a beam reach, where the wind pushes the sails sideways; little running downwind,
 * where it pushes them forward.
 */
export function pointOfSailHeel(absTwa: number, noGoAngle: number): number {
  if (absTwa < noGoAngle) return 0;
  const deg = absTwa / DEG;
  const noGo = noGoAngle / DEG;
  const rise = clamp((deg - noGo) / 25, 0, 1);
  const fall = 1 - clamp((deg - 100) / 80, 0, 1) * 0.88;
  return (0.45 + 0.55 * rise) * fall;
}

export interface HeelInput {
  /** True wind angle (radians, signed: positive = wind on starboard). */
  twa: number;
  noGoAngle: number;
  /** Wind the boat feels, knots. */
  windKn: number;
  /** Sail area 0..1. */
  sail: number;
  /** 0 = sails full, 1 = flapping. */
  luff: number;
  /** HEEL_FACTOR of the class. */
  factor: number;
}

/** Heel the boat settles at for steady wind; positive = mast leaning to port (BoatPose.heel). */
export function targetHeel(i: HeelInput): number {
  const side = i.twa > 0 ? 1 : -1; // wind on starboard pushes the mast to port
  const strength = Math.min(1.8, Math.pow(Math.max(0, i.windKn) / REFERENCE_KN, 1.25));
  const drive = pointOfSailHeel(Math.abs(i.twa), i.noGoAngle) * i.sail * (1 - i.luff);
  return side * clamp(BASE_HEEL * strength * drive * i.factor, 0, MAX_HEEL);
}

/** Per-quality feel: a springy hull that lurches on gusts, or a calm, well-damped one on Low. */
export interface HeelFeel {
  /** Seconds for one roll back and forth. */
  period: number;
  /** 1 = no overshoot; lower = the hull swings past and rocks back. */
  damping: number;
  /** Extra lean per knot of wind above its recent average (the lurch of a gust). */
  gustGain: number;
}

export const HEEL_FEEL: Readonly<Record<'smooth' | 'lively', HeelFeel>> = {
  lively: { period: 1.8, damping: 0.45, gustGain: 0.25 },
  smooth: { period: 2.6, damping: 1, gustGain: 0.12 },
};

/** Seconds over which the "recent average" wind is taken, to tell a gust from a steady wind. */
const GUST_AVERAGE_SEC = 4;

export class Heel {
  angle = 0;
  private velocity = 0;
  private averageKn = -1;

  /** Jump straight to the steady heel (new boat, loaded game). */
  reset(input: HeelInput) {
    this.angle = targetHeel(input);
    this.velocity = 0;
    this.averageKn = input.windKn;
  }

  update(input: HeelInput, dt: number, feel: HeelFeel): number {
    if (this.averageKn < 0) this.reset(input);
    if (!(dt > 0)) return this.angle;
    dt = Math.min(dt, 0.25);
    this.averageKn += (input.windKn - this.averageKn) * (1 - Math.exp(-dt / GUST_AVERAGE_SEC));
    const gust = Math.max(0, input.windKn - this.averageKn);
    const steady = targetHeel(input);
    const target =
      Math.sign(steady) * Math.min(MAX_HEEL, Math.abs(steady) * (1 + gust * feel.gustGain));
    // Damped spring, in small steps so a slow frame cannot make it unstable.
    const w = (2 * Math.PI) / feel.period;
    const steps = Math.ceil(dt / (1 / 60));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.velocity += (w * w * (target - this.angle) - 2 * feel.damping * w * this.velocity) * h;
      this.angle += this.velocity * h;
    }
    this.angle = clamp(this.angle, -MAX_HEEL * 1.15, MAX_HEEL * 1.15);
    return this.angle;
  }
}
