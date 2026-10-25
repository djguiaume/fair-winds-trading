import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { grownMap } from '../src/data/grownMap';
import { chartableZoneIds } from '../src/sim/map';
import { applySave, serializeWorld, validateSave } from '../src/sim/save';
import { encodeSaveCode, readSaveCode } from '../src/sim/saveTransfer';
import { SLOOP } from '../src/sim/ship';
import { type World, type WorldEvent, createWorld, stepWorld } from '../src/sim/world';

/*
 * Named wind zones go on the chart once sailed (decision 0152), like currents (0140): well inside
 * the zone, once, kept in the save and in the FW2 code.
 */

const map = prepareMap(grownMap(PHASE1_SOURCE));

/** A boat lying in the middle of The Glass (turned 8° into the south's quarter, 0179). */
function inTheGlass(setup: (w: World) => void = () => {}) {
  const world = createWorld(map, SLOOP);
  world.dynamicWeather = false;
  world.trade.dockedAt = null;
  world.boat.x = 444;
  world.boat.y = -613;
  world.boat.sailStep = 0;
  world.boat.sail = 0;
  setup(world);
  return world;
}

function lie(world: World, seconds: number) {
  const events: WorldEvent[] = [];
  for (let t = 0; t < seconds; t += 0.1)
    events.push(...stepWorld(world, { steer: 0, sailStep: 0 }, 0.1));
  return events;
}

describe('wind zones charted once sailed (0152)', () => {
  it('charts only the named zones', () => {
    expect(chartableZoneIds(map)).toEqual([
      'sunreach-sound',
      'the-glass',
      'the-trades',
      'ashfall-reach',
      'the-haar',
      'the-grey-murk',
      'fogwatch-voe',
      'stormbreak',
      'the-smirr',
      'the-whistle',
      'the-cold-sea',
    ]);
  });

  it('charts the zone the first time, once', () => {
    const world = inTheGlass();
    const events = lie(world, 2);
    expect(events.filter((e) => e.type === 'zone-charted')).toEqual([
      { type: 'zone-charted', id: 'the-glass' },
    ]);
    expect(world.trade.progress.zones).toEqual(['the-glass']);
  });

  it('charts nothing with the wind zones switched off', () => {
    const world = inTheGlass((w) => (w.windZones = false));
    lie(world, 1);
    expect(world.trade.progress.zones).toBeUndefined();
  });

  it('keeps the charted zones in the save and in the FW2 code', () => {
    const world = inTheGlass();
    lie(world, 1);
    const save = serializeWorld(world);
    expect(save.progress?.zones).toEqual(['the-glass']);
    const fresh = createWorld(map, SLOOP);
    applySave(fresh, validateSave(JSON.parse(JSON.stringify(save)), fresh)!);
    expect(fresh.trade.progress.zones).toEqual(['the-glass']);

    const code = encodeSaveCode(save, map);
    const read = readSaveCode(code, createWorld(map, SLOOP));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.save.progress?.zones).toEqual(['the-glass']);
    // A code without charted zones is what it was before.
    const before = encodeSaveCode(serializeWorld(createWorld(map, SLOOP)), map);
    expect(code.length).toBeGreaterThan(before.length);
  });

  it('drops ids the map no longer has', () => {
    const world = createWorld(map, SLOOP);
    const save = serializeWorld(world);
    save.progress = { ...save.progress!, zones: ['the-glass', 'gone'] };
    expect(validateSave(save, world)!.progress?.zones).toEqual(['the-glass']);
  });
});
