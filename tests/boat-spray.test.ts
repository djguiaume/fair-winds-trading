import { afterEach, describe, expect, it } from 'vitest';
import { resetTuning, TUNING } from '../src/data/tuning';
import { BoatSpray, SPRAY_CAPACITY, type SprayInput } from '../src/render/boatSpray';
import { RigPose } from '../src/render/boatPose';
import { SeaMotion } from '../src/render/seaMotion';
import { DEG } from '../src/sim/math';

// Issue #554: spray that grows with speed, a lee splash in a gust, a burst on a bump, at most
// 64 bits; a follow cam that leans a little with her heel unless Settings › Motion steadies it.
afterEach(() => resetTuning());

const flat = () => 0;
const boat = (speedKn: number, heel = 0): SprayInput => ({
  x: 0,
  z: 0,
  dx: 0,
  dz: -1,
  speedKn,
  heel,
  length: 11,
  beam: 4,
  sinceBump: Infinity,
});
/** Bits in the air after `seconds` of steady sailing at `speedKn`. */
function sail(spray: BoatSpray, speedKn: number, seconds = 1) {
  for (let t = 0; t < seconds; t += 1 / 60) spray.update(1 / 60, boat(speedKn), flat);
  return spray.active;
}

describe('boat spray', () => {
  it('throws nothing under 3 kn and more the faster she sails', () => {
    expect(sail(new BoatSpray(), 2.5)).toBe(0);
    const at5 = sail(new BoatSpray(() => 0.5), 5);
    const at7 = sail(new BoatSpray(() => 0.5), 7);
    expect(at5).toBeGreaterThan(0);
    expect(at7).toBeGreaterThan(at5);
  });

  it('never holds more than 64 bits, whatever the rate', () => {
    TUNING.waves.spray.bowRate = 120;
    TUNING.waves.spray.headBoost = 6;
    const spray = new BoatSpray();
    expect(sail(spray, 12, 3)).toBeLessThanOrEqual(SPRAY_CAPACITY);
    expect(spray.mesh.count).toBe(spray.active);
  });

  it('splashes off her lee side when a gust heels her, and at the bow on a bump', () => {
    const spray = new BoatSpray(() => 0.5);
    TUNING.waves.spray.bowRate = 0;
    spray.update(1 / 60, boat(7, 0), flat);
    spray.update(1 / 60, boat(7, 4 * DEG), flat);
    expect(spray.active).toBe(TUNING.waves.spray.heelBurst);
    spray.reset();
    spray.update(1 / 60, boat(0), flat);
    spray.update(1 / 60, { ...boat(0), sinceBump: 0 }, flat);
    expect(spray.active).toBe(TUNING.waves.spray.bumpBurst);
  });

  it('throws nothing when switched off (Ultra-low)', () => {
    const spray = new BoatSpray();
    spray.enabled = false;
    expect(sail(spray, 8)).toBe(0);
    expect(spray.mesh.visible).toBe(false);
  });

  it('is never pure white (art direction: foam at most #f6f9fb)', () => {
    const spray = new BoatSpray();
    const { r, g, b } = (
      spray.mesh.material as unknown as { color: { r: number; g: number; b: number } }
    ).color;
    expect(Math.max(r, g, b)).toBeLessThanOrEqual(0xf9 / 255);
  });
});

describe('the boom and the follow cam', () => {
  it('swings the boom across in a gybe instead of jumping', () => {
    const pose = new RigPose();
    const ship = TUNING.ships.sloop!;
    const wind = { from: 0, speedKn: 12 };
    const at = (heading: number) =>
      ({ heading, sail: 1, sinceBump: Infinity, rudder: 0 }) as Parameters<RigPose['update']>[0];
    const before = pose.update(at(185 * DEG), wind, ship, 0, 1 / 60, false, 1).boomAngle;
    const next = pose.update(at(175 * DEG), wind, ship, 0, 1 / 60, false, 1).boomAngle;
    expect(Math.sign(next)).toBe(Math.sign(before));
    expect(Math.abs(next - before)).toBeLessThanOrEqual(
      (TUNING.graphics.closeUp.boomSwingDegPerSec * DEG) / 60 + 1e-9,
    );
  });

  it('leans at most a few degrees with her heel, and not at all when steadied', () => {
    const motion = new SeaMotion();
    let lean = 0;
    for (let i = 0; i < 600; i++) lean = motion.cameraLean(1 / 60, 30 * DEG);
    expect(lean).toBeCloseTo(TUNING.waves.motion.cameraLeanMaxDeg * DEG, 3);
    // Slower than the heel: a tenth of a second in, it has barely begun.
    const fresh = new SeaMotion();
    expect(fresh.cameraLean(0.1, 10 * DEG)).toBeLessThan(10 * DEG * 0.3 * 0.2);
    motion.steady = true;
    for (let i = 0; i < 600; i++) lean = motion.cameraLean(1 / 60, 30 * DEG);
    expect(Math.abs(lean)).toBeLessThan(1e-3);
    motion.cameraBob = true;
    expect(motion.cameraRise(10, 2)).toBe(0);
  });
});
