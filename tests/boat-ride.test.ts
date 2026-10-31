import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { BoatRide, type RideConditions, rideCaps } from '../src/render/boatRide';
import { HULL_DIMENSIONS, HULL_SCALE } from '../src/sim/hullShape';
import { DEG } from '../src/sim/math';
import { createSeaState, steadySeaState } from '../src/sim/seaState';
import { createWaveField, setWaveField, waveHeightAt } from '../src/sim/waves';

const atSea: RideConditions = { waves: true, share: 1, storm: 0 };
const hullOf = (id: string) => {
  const d = HULL_DIMENSIONS[id]!;
  return { length: d.length * HULL_SCALE, beam: d.beam * HULL_SCALE };
};
const sloop = hullOf('sloop');

/** A frozen sea leaning `slopeX` east and `slopeZ` south (scene), `lift` high at the origin. */
const plane =
  (slopeX: number, slopeZ: number, lift = 0) =>
  (x: number, z: number) =>
    lift + slopeX * x + slopeZ * z;

/** Ride `seconds` of world time from `t0` at `fps`; the last pose. */
function rideFor(
  ride: BoatRide,
  sea: (x: number, z: number, t: number) => number,
  seconds: number,
  fps: number,
  heading = 0,
  hull = sloop,
  conditions = atSea,
  t0 = 1000,
  docked = false,
) {
  let pose = ride.pose;
  for (let i = 0; i <= Math.round(seconds * fps); i++) {
    const t = t0 + i / fps;
    pose = ride.update((x, z) => sea(x, z, t), 0, 0, heading, hull, t, conditions, docked);
  }
  return { ...pose };
}

/** The wind preview's Gerstner sea (`?waves=wind`), moving with time. */
function windSea(speedKn = 14, storm = 0) {
  const state = createSeaState();
  steadySeaState(0, speedKn, storm, state);
  const field = createWaveField();
  let at = Number.NaN;
  return (x: number, z: number, t: number) => {
    if (t !== at) setWaveField(field, state, 7, (at = t));
    return waveHeightAt(field, x, -z);
  };
}

describe('boat ride (issue #283)', () => {
  it('sits level and still on a flat sea', () => {
    const pose = rideFor(new BoatRide(), () => 0, 5, 60);
    expect(pose).toEqual({ lift: 0, pitch: 0, roll: 0 });
  });

  it('pitches bow up and rolls port down the way the sea leans, at any heading', () => {
    const slope = 0.02;
    // Sea rising to the north (scene -z): heading north the bow climbs; heading east, starboard
    // (south) is the low side, so she rolls starboard down (negative).
    const north = rideFor(new BoatRide(), plane(0, -slope), 20, 60, 0);
    expect(north.pitch).toBeCloseTo(Math.atan(slope), 3);
    expect(north.roll).toBeCloseTo(0, 6);
    const east = rideFor(new BoatRide(), plane(0, -slope), 20, 60, 90 * DEG);
    expect(east.pitch).toBeCloseTo(0, 6);
    expect(east.roll).toBeCloseTo(-Math.atan(slope), 3);
    // Heading west, the high north is on her starboard: she rolls port down.
    const west = rideFor(new BoatRide(), plane(0, -slope), 20, 60, 270 * DEG);
    expect(west.roll).toBeCloseTo(Math.atan(slope), 3);
  });

  it('rises with the sea under her hull, so the hull stays on the water', () => {
    const pose = rideFor(new BoatRide(), plane(0.01, 0, 0.7), 5, 60, 0);
    expect(pose.lift).toBeCloseTo(0.7 * TUNING.waves.motion.heave, 6);
  });

  it('never pitches or rolls past her caps, which are tighter on a big ship and open in a storm', () => {
    const steep = plane(0.5, -0.5);
    for (const id of Object.keys(HULL_DIMENSIONS)) {
      const hull = hullOf(id);
      const caps = rideCaps(hull.length, 0, { pitch: 0, roll: 0 });
      const pose = rideFor(new BoatRide(), steep, 20, 60, 45 * DEG, hull);
      expect(Math.abs(pose.pitch), id).toBeLessThanOrEqual(caps.pitch);
      expect(Math.abs(pose.roll), id).toBeLessThanOrEqual(caps.roll);
    }
    const { small, big, storm } = TUNING.waves.motion.ride;
    const smallCaps = rideCaps(sloop.length, 0, { pitch: 0, roll: 0 });
    expect(smallCaps.roll).toBeCloseTo(small.rollDeg * DEG);
    const bigCaps = rideCaps(hullOf('indiaman').length, 0, { pitch: 0, roll: 0 });
    expect(bigCaps.roll).toBeLessThan(smallCaps.roll);
    expect(bigCaps.roll).toBeGreaterThanOrEqual(big.rollDeg * DEG - 1e-9);
    const stormCaps = rideCaps(sloop.length, 1, { pitch: 0, roll: 0 });
    expect(stormCaps.roll).toBeCloseTo(smallCaps.roll * (1 + storm));
  });

  it('rolls the same whatever the frame rate, and stops when the game does', () => {
    const sea = windSea();
    const at = (fps: number) => rideFor(new BoatRide(), sea, 30, fps, 90 * DEG);
    const smooth = at(144);
    for (const fps of [20, 30, 60]) {
      const pose = at(fps);
      expect(Math.abs(pose.lift - smooth.lift), `${fps} fps`).toBeLessThan(0.05);
      expect(Math.abs(pose.roll - smooth.roll), `${fps} fps`).toBeLessThan(0.15 * DEG);
      expect(Math.abs(pose.pitch - smooth.pitch), `${fps} fps`).toBeLessThan(0.15 * DEG);
    }
    // Paused: the same world time every frame moves nothing.
    const ride = new BoatRide();
    const moving = rideFor(ride, sea, 30, 60, 90 * DEG);
    for (let i = 0; i < 60; i++)
      ride.update((x, z) => sea(x, z, 1030), 0, 0, 90 * DEG, sloop, 1030, atSea);
    expect(ride.pose).toEqual(moving);
  });

  it('follows the moving sea within a fraction of the waves, never drifting or turning NaN', () => {
    const sea = windSea(20);
    const ride = new BoatRide();
    let worst = 0;
    for (let i = 0; i < 60 * 600; i++) {
      const t = 5000 + i / 60;
      const pose = ride.update((x, z) => sea(x, z, t), 0, 0, 0, sloop, t, atSea);
      expect(Number.isFinite(pose.lift + pose.pitch + pose.roll)).toBe(true);
      if (i > 60) worst = Math.max(worst, Math.abs(pose.lift - sea(0, 0, t)));
    }
    // Hull averaging and the short rise smoothing: the sloop's waterline stays within 0.35 units
    // of the sea at her middle in a 20 kn sea about ±1.8 units high.
    expect(worst).toBeLessThan(0.35);
    const nan = new BoatRide().update(() => Number.NaN, 0, 0, 0, sloop, 0, atSea);
    expect(nan).toEqual({ lift: 0, pitch: 0, roll: 0 });
  });

  it('a long hull pitches less than a short one on the same chop', () => {
    const sea = windSea(20);
    const most = (hull: typeof sloop) => {
      const ride = new BoatRide();
      let pitch = 0;
      for (let i = 0; i < 60 * 120; i++) {
        const t = 2000 + i / 60;
        pitch = Math.max(
          pitch,
          Math.abs(ride.update((x, z) => sea(x, z, t), 0, 0, 0, hull, t, atSea).pitch),
        );
      }
      return pitch;
    };
    expect(most(hullOf('indiaman'))).toBeLessThan(most(sloop));
  });

  it('eases her tilt out alongside a berth, keeping her rise, and with the waves off', () => {
    const lean = plane(0.03, -0.03, 0.4);
    const { dockSec } = TUNING.waves.motion.ride;
    const ride = new BoatRide();
    const sailing = rideFor(ride, lean, 10, 60, 30 * DEG);
    const halfway = rideFor(ride, lean, dockSec / 4, 60, 30 * DEG, sloop, atSea, 1011, true);
    expect(Math.abs(halfway.roll)).toBeLessThan(Math.abs(sailing.roll));
    expect(Math.abs(halfway.roll)).toBeGreaterThan(0);
    const moored = rideFor(ride, lean, dockSec * 6, 60, 30 * DEG, sloop, atSea, 1012, true);
    expect(Math.abs(moored.roll)).toBeLessThan(0.01 * DEG);
    expect(moored.lift).toBeCloseTo(sailing.lift, 6);
    const off = rideFor(new BoatRide(), lean, 10, 60, 30 * DEG, sloop, { ...atSea, waves: false });
    expect(off.pitch).toBe(0);
    expect(off.roll).toBe(0);
    expect(off.lift).toBeCloseTo(sailing.lift, 6);
  });

  it('Gentle sea motion keeps its share of the tilt', () => {
    const lean = plane(0.01, -0.01);
    const full = rideFor(new BoatRide(), lean, 20, 60, 30 * DEG);
    const gentle = rideFor(new BoatRide(), lean, 20, 60, 30 * DEG, sloop, {
      ...atSea,
      share: TUNING.waves.motion.gentle,
    });
    expect(gentle.roll / full.roll).toBeCloseTo(TUNING.waves.motion.gentle, 1);
    expect(gentle.lift).toBeCloseTo(full.lift, 9);
  });
});
