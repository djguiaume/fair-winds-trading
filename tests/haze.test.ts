import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import type { MapDef, WindZoneDef } from '../src/sim/map';
import { hazeSwitches, zoneField, zoneHazy, zoneVisualAt, zonesTuning } from '../src/sim/windZones';
import { SLOOP } from '../src/sim/ship';
import { createWorld, stepWorld } from '../src/sim/world';

/** A named square fog bank of half-size `h` around (x, y). */
const bank = (id: string, x: number, y: number, h: number): WindZoneDef => ({
  id,
  name: 'The Murk',
  kind: 'fog-bank',
  outline: [
    [x - h, y - h],
    [x + h, y - h],
    [x + h, y + h],
    [x - h, y + h],
  ],
});

describe('haze: fog banks (decision 0169)', () => {
  it('the fog-bank kind has a haze with a Settings switch, read from the data', () => {
    const haze = zonesTuning().kinds['fog-bank']!.haze!;
    expect(haze.far).toBeGreaterThan(haze.near);
    expect(haze.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(hazeSwitches()).toContain('fog');
  });

  it('thickens across the edge, is full deep inside, and clears when its switch is off', () => {
    const field = zoneField([bank('m', 0, 0, 300)])!;
    const fade = zonesTuning().kinds['fog-bank']!.haze!.fade!;
    expect(zoneVisualAt(field, 0, 0).haze).toBe(1);
    expect(zoneVisualAt(field, 0, 0).zone).toBe('m');
    expect(zoneVisualAt(field, 300 + fade, 0).haze).toBe(0);
    const edge = zoneVisualAt(field, 300, 0).haze;
    expect(edge).toBeGreaterThan(0.3);
    expect(edge).toBeLessThan(0.7);
    expect(zoneVisualAt(field, 0, 0, ['fog']).haze).toBe(0);
  });

  it('only kinds with a haze are hazy', () => {
    expect(zoneHazy(bank('m', 0, 0, 10))).toBe(true);
    expect(zoneHazy(bank('m', 0, 0, 10), ['fog'])).toBe(false);
    expect(zoneHazy({ ...bank('d', 0, 0, 10), kind: 'doldrums' })).toBe(false);
  });

  it('a named fog bank is charted once sailed, even with Settings › Wind zones off', () => {
    const start = PHASE1_MAP.start;
    const map: MapDef = { ...PHASE1_MAP, windZones: [bank('murk', start.x, start.y, 120)] };
    const world = createWorld(map, SLOOP);
    world.windZones = false;
    stepWorld(world, { steer: 0, sailStep: 0 }, 0.1);
    expect(world.trade.progress.zones).toContain('murk');

    const off = createWorld(map, SLOOP);
    off.windZones = false;
    off.hazeOff = ['fog'];
    stepWorld(off, { steer: 0, sailStep: 0 }, 0.1);
    expect(off.trade.progress.zones ?? []).not.toContain('murk');
  });
});
