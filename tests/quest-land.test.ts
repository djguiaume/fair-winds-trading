import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { grownMap } from '../src/data/grownMap';
import { questShown } from '../src/data/islands';
import { TUNING } from '../src/data/tuning';
import { HighlandIslands } from '../src/render/models/highlandIslands';
import { resolveCollisions } from '../src/sim/collision';
import type { MapDef } from '../src/sim/map';
import { questLandProblems, questTagsCheck, routeChecks } from '../src/sim/mapChecks';
import { featureDistance, landOut, standingMap, syncLand, landWith } from '../src/sim/questLand';
import { applySave, serializeWorld } from '../src/sim/save';
import { QUESTS } from '../src/sim/quests';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld, stepWorld } from '../src/sim/world';

/*
 * Land that rises or clears after a quest (decision 0166): Lone Palm rises once Kit's
 * shoals arc is done, and the Coral Line's east reef clears then. Neither swaps where the boat could see it.
 */

const QUEST = 'saltmere-shoals';

function taggedSea(): MapDef {
  const map = prepareMap(grownMap(PHASE1_SOURCE));
  map.islands.find((i) => i.id === 'lone-palm')!.tags = [`after:${QUEST}`];
  map.terrain!.find((t) => t.id === 'coral-line-east')!.tags = [`before:${QUEST}`];
  return map;
}

const map = taggedSea();
const palm = map.islands.find((i) => i.id === 'lone-palm')!;
const reef = map.terrain!.find((t) => t.id === 'coral-line-east')!;

function finish(world: World) {
  world.trade.quests.byId[QUEST] = { step: 'done', counts: [], chose: {} };
}

function lie(world: World, seconds: number) {
  for (let t = 0; t < seconds; t += 0.1) stepWorld(world, { steer: 0, sailStep: 0 }, 0.1);
}

function at(world: World, x: number, y: number) {
  world.boat.x = x;
  world.boat.y = y;
  world.boat.speedKn = 0;
}

const stands = (world: World, id: string) =>
  [...world.land.islands, ...world.land.terrain].some((f) => f.id === id);

describe('land that rises or clears after a quest (0166)', () => {
  it('starts a voyage with the rising island out and the clearing reef in', () => {
    const world = createWorld(map, SLOOP);
    expect(stands(world, 'lone-palm')).toBe(false);
    expect(stands(world, 'coral-line-east')).toBe(true);
    // Nothing is solid where Lone Palm will rise.
    const boat = { ...world.boat, x: palm.x, y: palm.y };
    expect(
      resolveCollisions(
        boat,
        SLOOP.radius,
        world.land.islands,
        map.boundsRadius,
        world.land.terrain,
      ),
    ).toBeNull();
  });

  it('swaps only out of sight, or while docked and clear of it', () => {
    const { changeDistance, dockedClear } = TUNING.seamanship.questLand;
    const world = createWorld(map, SLOOP);
    world.dynamicWeather = false;
    world.trade.dockedAt = null;
    // At sea near Lone Palm when the quest is done: it waits, the far reef clears.
    at(world, palm.x + palm.radius + 120, palm.y);
    lie(world, 1);
    finish(world);
    lie(world, 1);
    expect(featureDistance(reef, world.boat)).toBeGreaterThan(changeDistance);
    expect(stands(world, 'lone-palm')).toBe(false);
    expect(stands(world, 'coral-line-east')).toBe(false);
    expect(world.land.terrain).not.toContain(reef);
    expect(world.reefs.some((r) => r.outline === reef.outline)).toBe(false);
    // Docked, the port screen covers the sea: it rises, being clear of her.
    const version = world.land.version;
    expect(featureDistance(palm, world.boat)).toBeGreaterThan(dockedClear);
    expect(syncLand(map, world.land, new Set([QUEST]), world.boat, true)).toEqual(['lone-palm']);
    expect(world.land.version).toBe(version + 1);
    expect(stands(world, 'lone-palm')).toBe(true);
  });

  it('raises land once she is out of sight of it', () => {
    const world = createWorld(map, SLOOP);
    world.dynamicWeather = false;
    world.trade.dockedAt = null;
    at(world, palm.x + palm.radius + 120, palm.y);
    lie(world, 1);
    finish(world);
    lie(world, 1);
    expect(stands(world, 'lone-palm')).toBe(false);
    at(world, map.start.x, map.start.y);
    lie(world, 1);
    expect(featureDistance(palm, world.boat)).toBeGreaterThan(
      TUNING.seamanship.questLand.changeDistance,
    );
    expect(stands(world, 'lone-palm')).toBe(true);
    // Solid now.
    const boat = { ...world.boat, x: palm.x, y: palm.y };
    expect(
      resolveCollisions(
        boat,
        SLOOP.radius,
        world.land.islands,
        map.boundsRadius,
        world.land.terrain,
      ),
    ).not.toBeNull();
  });

  it('never raises land on top of a loaded boat', () => {
    const world = createWorld(map, SLOOP);
    finish(world);
    at(world, palm.x, palm.y);
    const save = serializeWorld(world);
    const loaded = createWorld(map, SLOOP);
    applySave(loaded, save);
    expect(loaded.boat.x).toBeCloseTo(palm.x);
    expect(stands(loaded, 'lone-palm')).toBe(false);
    // Clearing is always safe on a load.
    expect(stands(loaded, 'coral-line-east')).toBe(false);
    // Loaded far away, everything is as the quests say.
    at(world, map.start.x, map.start.y);
    const far = createWorld(map, SLOOP);
    applySave(far, serializeWorld(world));
    expect(stands(far, 'lone-palm')).toBe(true);
  });

  it('does not sight an island that has not risen', () => {
    const world = createWorld(map, SLOOP);
    world.dynamicWeather = false;
    world.trade.dockedAt = null;
    at(world, palm.x + 30, palm.y);
    lie(world, 1);
    expect(world.trade.progress.sighted ?? []).not.toContain('lone-palm');
  });

  it('lists the land out for a set of quests done', () => {
    // Cinder Isle (0171) waits on the west's own quest.
    expect([...landOut(map, new Set())]).toEqual(['lone-palm', 'cinder-isle']);
    expect([...landOut(map, new Set([QUEST]))]).toEqual(['cinder-isle', 'coral-line-east']);
    const after = standingMap(map, new Set([QUEST]));
    expect(after.islands).toContain(palm);
    expect(after.terrain).not.toContain(reef);
    expect(landWith(map, new Set()).islands).toBe(map.islands);
  });
});

describe('checks on land that waits on a quest (0166)', () => {
  const ring = () => structuredClone(prepareMap(PHASE1_SOURCE));

  it('runs the route checks before and after the quests', () => {
    const m = ring();
    m.islands.find((i) => i.id === 'bell-rock')!.tags = [`after:${QUEST}`];
    const ids = routeChecks(m).map((c) => c.id);
    expect(ids).toContain('reach-before');
    expect(ids).toContain('reach-after');
    expect(routeChecks(m).every((c) => c.ok)).toBe(true);
  });

  it('refuses ports on land that comes or goes, unless a site founded after it rises', () => {
    const m = ring();
    const westholm = m.islands.find((i) => i.id === 'westholm')!;
    westholm.tags = [`before:${QUEST}`];
    expect(questLandProblems(m).join()).toMatch(/clears with a quest/);
    westholm.tags = [`after:${QUEST}`];
    expect(questLandProblems(m).join()).toMatch(/make it a site/);
    m.ports.find((p) => p.islandId === 'westholm')!.site = true;
    expect(questLandProblems(m)).toEqual([]);
    expect(questLandProblems(taggedSea())).toEqual([]);
  });

  it('names real quests', () => {
    expect(
      questTagsCheck(
        map,
        QUESTS.map((q) => q.id),
      ).ok,
    ).toBe(true);
    const check = questTagsCheck(map, []);
    expect(check.ok).toBe(false);
    expect(check.message).toMatch(/lone-palm waits on "saltmere-shoals"/);
  });
});

describe('the view of land that waits on a quest (0166)', () => {
  it('hides the islands and shapes out of the sea, and keeps them hidden through a rebuild', () => {
    const m = structuredClone(prepareMap(PHASE1_SOURCE));
    const islands = new HighlandIslands(m, false);
    const group = (name: string) => islands.children.find((c) => c.name === name)!;
    const shape = m.terrain!.find((t) => t.kind !== 'shallows')!;
    islands.setLandOut(new Set(['bell-rock', shape.id]));
    expect(group('island:bell-rock').visible).toBe(false);
    expect(group(`terrain:${shape.id}`).visible).toBe(false);
    expect(group('island:saltmere').visible).toBe(true);
    islands.setHomeBuildings({ 'bell-rock': { a: 'b' } });
    expect(group('island:bell-rock').visible).toBe(false);
    islands.setLandOut(new Set());
    expect(group('island:bell-rock').visible).toBe(true);
    islands.dispose();
  });
});

describe('land that stands only while a quest runs (0166)', () => {
  const running = new Set([QUEST]);
  it('reads during: and except: from the quests running', () => {
    expect(questShown({ tags: [`during:${QUEST}`] }, new Set(), running)).toBe(true);
    expect(questShown({ tags: [`during:${QUEST}`] }, new Set(), new Set())).toBe(false);
    expect(questShown({ tags: [`during:${QUEST}`] }, new Set([QUEST]))).toBe(false);
    expect(questShown({ tags: [`except:${QUEST}`] }, new Set(), running)).toBe(false);
    expect(questShown({ tags: [`except:${QUEST}`] }, new Set([QUEST]))).toBe(true);
  });

  it('raises an island while its quest runs and clears it once done, out of sight', () => {
    const m = prepareMap(grownMap(PHASE1_SOURCE));
    m.islands.find((i) => i.id === 'lone-palm')!.tags = [`during:${QUEST}`];
    const world = createWorld(m, SLOOP);
    world.dynamicWeather = false;
    world.trade.dockedAt = null;
    at(world, m.start.x, m.start.y);
    lie(world, 1);
    expect(stands(world, 'lone-palm')).toBe(false);
    world.trade.quests.byId[QUEST] = { step: 'gulls', counts: [], chose: {} };
    lie(world, 1);
    expect(stands(world, 'lone-palm')).toBe(true);
    finish(world);
    lie(world, 1);
    expect(stands(world, 'lone-palm')).toBe(false);
  });

  it('route-checks the sea while the quests run, and keeps marks and ports off it', () => {
    const m = structuredClone(prepareMap(PHASE1_SOURCE));
    m.islands.find((i) => i.id === 'bell-rock')!.tags = [`except:${QUEST}`];
    const ids = routeChecks(m).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['reach-before', 'reach-during', 'reach-after']));
    m.islands.find((i) => i.id === 'westholm')!.tags = [`during:${QUEST}`];
    expect(questLandProblems(m).join()).toMatch(/clears with a quest/);
    m.islands.find((i) => i.id === 'westholm')!.tags = undefined;
    m.marks = [{ type: 'buoy-red', x: 0, y: 0, tags: [`during:${QUEST}`] }];
    expect(questLandProblems(m).join()).toMatch(/during:\/except: is for land/);
  });
});
