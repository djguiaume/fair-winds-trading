import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, DUSK_END, NIGHT_END, daylightAt } from '../src/sim/daylight';

describe('day and night (0067)', () => {
  it('starts a voyage in the morning, in full daylight', () => {
    const d = daylightAt(0);
    expect(d.hour).toBeCloseTo(7, 5);
    expect(d.night).toBe(0);
  });

  it('repeats every game day and keeps time across a resumed voyage', () => {
    expect(daylightAt(123)).toEqual(daylightAt(123 + DAY_SECONDS));
    expect(daylightAt(123 + 5 * DAY_SECONDS).hour).toBeCloseTo(daylightAt(123).hour, 6);
  });

  it('spends about a quarter of the day in full night', () => {
    let night = 0;
    for (let t = 0; t < DAY_SECONDS; t++) if (daylightAt(t).night > 0.99) night++;
    expect(night / DAY_SECONDS).toBeGreaterThan(0.2);
    expect(night / DAY_SECONDS).toBeLessThan(0.3);
    expect(daylightAt((DUSK_END + NIGHT_END) / 2).hour).toBeCloseTo(1, 5);
  });

  it('never jumps: light, warmth and clock change smoothly', () => {
    let prev = daylightAt(0);
    for (let t = 0.5; t <= DAY_SECONDS * 2; t += 0.5) {
      const d = daylightAt(t);
      expect(Math.abs(d.night - prev.night)).toBeLessThan(0.02);
      expect(Math.abs(d.warm - prev.warm)).toBeLessThan(0.02);
      const dh = (((d.hour - prev.hour) % 24) + 24) % 24;
      expect(dh).toBeLessThan(0.05);
      prev = d;
    }
  });

  it('moves the sun from east through south to west, and keeps the light above the horizon', () => {
    const at = (hour: number) => {
      for (let t = 0; t < DAY_SECONDS; t += 0.25) {
        const d = daylightAt(t);
        if (Math.abs(d.hour - hour) < 0.02) return d;
      }
      throw new Error(`no ${hour}h`);
    };
    expect(at(12).lightBearing).toBeCloseTo(Math.PI, 1);
    expect(at(9).lightBearing).toBeLessThan(Math.PI);
    expect(at(16).lightBearing).toBeGreaterThan(Math.PI);
    for (let t = 0; t < DAY_SECONDS; t += 7) expect(daylightAt(t).lightHeight).toBeGreaterThan(0.1);
  });
});
