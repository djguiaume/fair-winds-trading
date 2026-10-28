import { describe, expect, it } from 'vitest';
import { DEG } from '../src/sim/math';
import {
  BASE_HEEL,
  HEEL_FACTOR,
  HEEL_FEEL,
  Heel,
  type HeelInput,
  MAX_HEEL,
  heelFactor,
  targetHeel,
} from '../src/render/heel';
import { SHIP_IDS } from '../src/sim/ship';

/** Every ship file (decision 0109); the warship line (ketch, brig, frigate) comes in Phase 5. */
const SHIP_LINES = SHIP_IDS;

const beam = (over: Partial<HeelInput> = {}): HeelInput => ({
  twa: 90 * DEG,
  noGoAngle: 45 * DEG,
  windKn: 14,
  sail: 1,
  luff: 0,
  factor: 1,
  ...over,
});

describe('visual heel (decision 0044)', () => {
  it('leans a stock sloop about 14° on a beam reach in the usual breeze', () => {
    expect(targetHeel(beam())).toBeCloseTo(BASE_HEEL, 5);
  });

  it('leans away from the wind on either tack', () => {
    expect(targetHeel(beam())).toBeGreaterThan(0);
    expect(targetHeel(beam({ twa: -90 * DEG }))).toBeCloseTo(-targetHeel(beam()), 6);
  });

  it('stands up in irons, heels most on a reach and little running downwind', () => {
    const at = (deg: number) => Math.abs(targetHeel(beam({ twa: deg * DEG })));
    expect(at(30)).toBe(0);
    expect(at(50)).toBeGreaterThan(at(180));
    expect(at(90)).toBeGreaterThan(at(140));
    expect(at(140)).toBeGreaterThan(at(180));
    expect(at(180)).toBeLessThan(at(90) * 0.2);
  });

  it('heels more in stronger wind, less with reefed or flapping sails, never past the cap', () => {
    expect(targetHeel(beam({ windKn: 19 }))).toBeGreaterThan(targetHeel(beam()));
    expect(targetHeel(beam({ windKn: 6 }))).toBeLessThan(targetHeel(beam()) * 0.5);
    expect(targetHeel(beam({ sail: 0.3 }))).toBeLessThan(targetHeel(beam()) * 0.5);
    expect(targetHeel(beam({ luff: 1 }))).toBe(0);
    expect(targetHeel(beam({ windKn: 40, factor: 1.2 }))).toBeLessThanOrEqual(MAX_HEEL);
  });

  it('gives every ship class a factor: tall swift rigs lean more than wide haulers', () => {
    expect(SHIP_LINES).toHaveLength(8);
    for (const id of SHIP_LINES) expect(HEEL_FACTOR[id], id).toBeGreaterThan(0);
    expect(heelFactor('schooner')).toBeGreaterThan(heelFactor('sloop'));
    expect(heelFactor('fluyt')).toBeLessThan(heelFactor('sloop'));
    expect(heelFactor('indiaman')).toBeLessThan(heelFactor('hoy'));
    expect(heelFactor('unknown')).toBe(1);
  });

  it('settles on the steady heel at any frame rate', () => {
    for (const dt of [1 / 120, 1 / 30, 0.2]) {
      const h = new Heel();
      h.update(beam({ sail: 0 }), dt, HEEL_FEEL.lively);
      for (let t = 0; t < 20; t += dt) h.update(beam(), dt, HEEL_FEEL.lively);
      expect(h.angle).toBeCloseTo(targetHeel(beam()), 3);
    }
  });

  /** Biggest heel while the sails fill from furled, for each feel. */
  function peakWhenSheetedIn(feel: (typeof HEEL_FEEL)['lively']) {
    const h = new Heel();
    h.update(beam({ sail: 0 }), 1 / 60, feel);
    let peak = 0;
    for (let t = 0; t < 6; t += 1 / 60) peak = Math.max(peak, h.update(beam(), 1 / 60, feel));
    return peak;
  }

  it('rocks past the steady heel on Medium/High but eases in smoothly on Low', () => {
    const steady = targetHeel(beam());
    expect(peakWhenSheetedIn(HEEL_FEEL.lively)).toBeGreaterThan(steady * 1.1);
    expect(peakWhenSheetedIn(HEEL_FEEL.smooth)).toBeLessThanOrEqual(steady * 1.001);
  });

  it('lurches further when a gust hits than in the same steady wind', () => {
    const h = new Heel();
    h.reset(beam());
    let peak = 0;
    for (let t = 0; t < 2; t += 1 / 60)
      peak = Math.max(peak, h.update(beam({ windKn: 17 }), 1 / 60, HEEL_FEEL.lively));
    expect(peak).toBeGreaterThan(targetHeel(beam({ windKn: 17 })));
  });

  it('eases off in an island lee where the felt wind drops', () => {
    const h = new Heel();
    h.reset(beam());
    for (let t = 0; t < 8; t += 1 / 60)
      h.update(beam({ windKn: 14 * 0.45 }), 1 / 60, HEEL_FEEL.lively);
    expect(h.angle).toBeLessThan(targetHeel(beam()) * 0.4);
  });
});
