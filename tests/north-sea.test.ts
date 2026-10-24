import { describe, expect, it } from 'vitest';
import { grownMap } from '../src/data/grownMap';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { bergChart, bergFields, bergsAt, bergsTuning, prepareField } from '../src/sim/bergs';
import { coastDistance } from '../src/sim/coast';
import { smoothOutline } from '../src/sim/flowShapes';
import type { TerrainDef } from '../src/sim/map';
import { quickChecks } from '../src/sim/mapChecks';
import { landOut } from '../src/sim/questLand';
import { mapZones, zoneField, zoneVisualAt } from '../src/sim/windZones';

// Decision 0170: the north sea, Rimewick.
const map = prepareMap(grownMap(PHASE1_SOURCE));

describe('the north sea, Rimewick (decision 0170)', () => {
  it('passes the map checks with no warnings', () => {
    expect(quickChecks(map).filter((c) => !c.ok)).toEqual([]);
  });

  it('opens Snowberry Pack once the beacon is lit, and only then', () => {
    expect(landOut(map, new Set())).toEqual(new Set());
    expect(landOut(map, new Set(['rimewick-jam']))).toEqual(new Set(['snowberry-pack']));
  });

  it('tints the water past the Floe Line, and only there, whatever the switches', () => {
    const field = zoneField(mapZones(map), smoothOutline)!;
    const north = zoneVisualAt(field, -130, 700, ['fog', 'ash']);
    expect(north.tint).toBeGreaterThan(0.9);
    expect(north.tintKind?.water).toMatch(/^#[0-9a-f]{6}$/);
    expect(north.haze).toBe(0);
    expect(zoneVisualAt(field, 0, 0).tint).toBe(0);
    expect(zoneVisualAt(field, 520, -730).tint).toBe(0);
  });
});

describe('drifting icebergs (decision 0170)', () => {
  const def = bergFields(map)[0]!;
  const field = prepareField(def, 0);

  it('keeps every berg on its loop, clear of the edge and of one another', () => {
    expect(field.bergs).toHaveLength(def.count!);
    const margin = bergsTuning().margin;
    for (let t = 0; t < 3600; t += 37) {
      const bergs = bergsAt(map, t);
      for (const b of bergs)
        expect(coastDistance(b.x, b.y, def.outline).distance).toBeLessThan(-(b.r + margin) + 0.01);
      for (let i = 0; i < bergs.length; i++)
        for (let j = i + 1; j < bergs.length; j++) {
          const a = bergs[i]!,
            b = bergs[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
        }
    }
  });

  it('drifts at the tuned speed, the way the field turns', () => {
    const [a] = bergsAt(map, 100);
    const [b] = bergsAt(map, 110);
    const kn = Math.hypot(b!.x - a!.x, b!.y - a!.y) / 10 / 1.6;
    expect(kn).toBeGreaterThan(bergsTuning().driftKn * 0.6);
    expect(kn).toBeLessThan(bergsTuning().driftKn * 1.6);
    const cw: TerrainDef = { ...structuredClone(def), spin: 'cw' };
    const ccw = bergChart(def, 0).arrows[0]!;
    const turned = bergChart(cw, 0).arrows[0]!;
    expect(turned.dx).toBeCloseTo(-ccw.dx, 6);
    expect(bergChart(def, 0).minutesRound).toBeGreaterThan(5);
  });

  it('drops the bergs that do not fit, and the checks say so', () => {
    const crowded: TerrainDef = { ...structuredClone(def), count: 60 };
    expect(prepareField(crowded, 0).dropped).toBeGreaterThan(0);
    const warned = quickChecks({
      ...map,
      terrain: map.terrain!.map((t) => (t.id === def.id ? crowded : t)),
    }).find((c) => c.id === 'bergs');
    expect(warned).toMatchObject({ ok: false, severity: 'warning' });
  });
});
