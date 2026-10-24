import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { grownMap } from '../src/data/grownMap';
import { chartAreaIds, chartedAt, fogIslandIds, islandCharted, stepFog } from '../src/sim/fog';
import { QuestBook, type QuestDef, checkQuests } from '../src/sim/quests';
import { applySave, serializeWorld, validateSave } from '../src/sim/save';
import { encodeSaveCode, readSaveCode } from '../src/sim/saveTransfer';
import { discoveredPorts } from '../src/sim/shipyards';
import { SLOOP } from '../src/sim/ship';
import { type World, type WorldEvent, createWorld, stepWorld } from '../src/sim/world';

/*
 * Fog of war (decision 0156): the Phase 4 sea's new waters start uncharted. An area is charted at
 * once when she sails into it (or a quest step hands it over), a fogged island alone when sighted.
 */

const map = prepareMap(grownMap(PHASE1_SOURCE));
const ring = prepareMap(PHASE1_SOURCE);

function at(x: number, y: number) {
  const world = createWorld(map, SLOOP);
  world.dynamicWeather = false;
  world.trade.dockedAt = null;
  world.boat.x = x;
  world.boat.y = y;
  world.boat.sailStep = 0;
  world.boat.sail = 0;
  return world;
}

function lie(world: World, seconds: number) {
  const events: WorldEvent[] = [];
  for (let t = 0; t < seconds; t += 0.1)
    events.push(...stepWorld(world, { steer: 0, sailStep: 0 }, 0.1));
  return events;
}

const island = (id: string) => map.islands.find((i) => i.id === id)!;

describe('fog of war (0156)', () => {
  it('fogs only the new waters: the ring and today’s map stay charted', () => {
    expect(ring.fog).toBeUndefined();
    const fresh = createWorld(map, SLOOP).trade.progress;
    expect(chartedAt(map, fresh, 0, 0)).toBe(true);
    for (const i of ring.islands) expect(islandCharted(map, fresh, island(i.id))).toBe(true);
    expect(chartedAt(map, fresh, 520, -730)).toBe(false);
    expect(islandCharted(map, fresh, island('palm-key'))).toBe(false);
  });

  it('names the south sea’s four areas, then the east sea’s (0173)', () => {
    expect(chartAreaIds(map)).toEqual([
      'coral-line',
      'sugar-bar',
      'sunreach-waters',
      'palm-key-narrows',
      'stepping-stones',
      'fogwatch-waters',
      'the-race',
      'amber-reach',
    ]);
    expect(fogIslandIds(map)).toEqual([
      'sunreach',
      'sunreach-south',
      'palm-key',
      'lone-palm',
      'fogwatch',
      'the-giant',
      'his-wife',
      'amber-strand',
      'puffin-holm',
      'lamb-holm',
      'broch-isle',
    ]);
  });

  it('hides a fogged port until its island is charted', () => {
    const world = createWorld(map, SLOOP);
    expect(discoveredPorts(map, world.trade).map((p) => p.id)).not.toContain('sunreach');
    world.trade.progress.areas = ['sunreach-waters'];
    expect(discoveredPorts(map, world.trade).map((p) => p.id)).toContain('sunreach');
  });

  it('charts the area she sails into, once, with an event', () => {
    const world = at(420, -720); // Palm Key Narrows, far from any island
    const events = lie(world, 1);
    expect(events.filter((e) => e.type === 'area-charted')).toEqual([
      { type: 'area-charted', id: 'palm-key-narrows', name: 'Palm Key Narrows' },
    ]);
    expect(world.trade.progress.areas).toEqual(['palm-key-narrows']);
    expect(chartedAt(map, world.trade.progress, 520, -730)).toBe(true);
  });

  it('charts a fogged island alone when she sails past it in uncharted water', () => {
    const world = at(-470, -665);
    world.trade.progress.areas = ['coral-line'];
    // Outside every area (west of the south sea), within sight of nothing: nothing new.
    world.boat.x = -900;
    world.boat.y = 0;
    expect(lie(world, 0.2)).toEqual([]);
    // Within sight of Lone Palm, in the Sugar Bar area: the area and the island.
    world.trade.progress.areas = [];
    world.boat.x = -470 + island('lone-palm').radius + 40;
    world.boat.y = -665;
    const events = lie(world, 0.2).filter(
      (e) => e.type === 'area-charted' || e.type === 'island-sighted',
    );
    expect(events[0]).toMatchObject({ type: 'area-charted', id: 'sugar-bar' });
    // Lone Palm lies in the area now charted, so it needs no sighting of its own.
    expect(world.trade.progress.sighted).toBeUndefined();
  });

  it('sights an island in fog that no area covers', () => {
    // Before its sea's areas are drawn, an island out there is charted on its own when sighted.
    const bare = { ...map, fog: { ...map.fog!, areas: [] } };
    const world = createWorld(bare, SLOOP);
    world.trade.progress.areas = undefined;
    const lone = island('lone-palm');
    const near = { x: lone.x + lone.radius + 60, y: lone.y };
    expect(stepFog(bare, world.trade.progress, near, 90)).toEqual([
      { type: 'island-sighted', id: 'lone-palm' },
    ]);
    expect(islandCharted(bare, world.trade.progress, lone)).toBe(true);
    expect(stepFog(bare, world.trade.progress, near, 90)).toEqual([]);
    // Too far off: nothing.
    const far = createWorld(bare, SLOOP).trade.progress;
    expect(stepFog(bare, far, { x: lone.x + 200, y: lone.y }, 90)).toEqual([]);
  });

  it('keeps charted areas and sighted islands in the save and the FW2 code', () => {
    const world = createWorld(map, SLOOP);
    world.trade.progress.areas = ['coral-line', 'palm-key-narrows'];
    world.trade.progress.sighted = ['lone-palm'];
    const save = serializeWorld(world);
    const fresh = createWorld(map, SLOOP);
    applySave(fresh, validateSave(JSON.parse(JSON.stringify(save)), fresh)!);
    expect(fresh.trade.progress.areas).toEqual(['coral-line', 'palm-key-narrows']);
    expect(fresh.trade.progress.sighted).toEqual(['lone-palm']);

    const code = encodeSaveCode(save, map);
    const read = readSaveCode(code, createWorld(map, SLOOP));
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.save.progress?.areas).toEqual(['coral-line', 'palm-key-narrows']);
      expect(read.save.progress?.sighted).toEqual(['lone-palm']);
    }
    const before = encodeSaveCode(serializeWorld(createWorld(map, SLOOP)), map);
    // One flag per area and fogged island: each new sea adds a character or two (0173).
    expect(code.length - before.length).toBeLessThan(16);
  });

  it('drops ids the map no longer has', () => {
    const world = createWorld(map, SLOOP);
    const save = serializeWorld(world);
    save.progress = {
      ...save.progress!,
      areas: ['coral-line', 'gone'],
      sighted: ['skerry', 'palm-key'],
    };
    const read = validateSave(save, world)!.progress;
    expect(read?.areas).toEqual(['coral-line']);
    expect(read?.sighted).toEqual(['palm-key']);
  });

  it('lifts a step’s `charts` as soon as the step begins', () => {
    const quest: QuestDef = {
      id: 'test-chart',
      name: 'Old chart',
      text: 'test',
      start: { is: 'always' },
      steps: [
        {
          id: 'given',
          charts: ['coral-line', 'sunreach-waters'],
          goal: { is: 'docked', port: 'sunreach' },
        },
      ],
    } as unknown as QuestDef;
    expect(checkQuests([quest], map)).toEqual([]);
    expect(
      checkQuests([{ ...quest, steps: [{ ...quest.steps[0]!, charts: ['nowhere'] }] }], map),
    ).toContainEqual(expect.stringContaining('no chart area "nowhere"'));
    const world = createWorld(map, SLOOP);
    const book = new QuestBook(world, [quest]);
    book.check();
    expect(world.trade.progress.areas).toEqual(['coral-line', 'sunreach-waters']);
  });
});
