import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { CurrentField } from '../src/sim/currents';
import { type SailRoute, harbourApproach, sailRoute } from '../src/sim/mapChecks';
import { applySave, serializeWorld, validateSave } from '../src/sim/save';
import { readSaveCode, encodeSaveCode } from '../src/sim/saveTransfer';
import { SLOOP } from '../src/sim/ship';
import { type World, type WorldEvent, createWorld, stepWorld } from '../src/sim/world';

/*
 * Currents in the game (decisions 0140, 0145): the water carries the boat over the ground the
 * way leeway does, the Settings switch and the level scale it, and a current she sails in is
 * charted and saved.
 */

/** A boat lying with her sails down in the middle gap of the Gap Run. */
function inTheGap(setup: (w: World) => void = () => {}) {
  const world = createWorld(PHASE1_MAP, SLOOP);
  world.dynamicWeather = false;
  world.trade.dockedAt = null;
  world.boat.x = -52;
  world.boat.y = 19;
  world.boat.sailStep = 0;
  world.boat.sail = 0;
  setup(world);
  return world;
}

function drift(world: World, seconds: number) {
  const events: WorldEvent[] = [];
  const x = world.boat.x;
  for (let t = 0; t < seconds; t += 0.1)
    events.push(...stepWorld(world, { steer: 0, sailStep: 0 }, 0.1));
  return { dx: world.boat.x - x, events };
}

describe('the current carries the boat (0140)', () => {
  it('drifts her east through the gap, more than the wind alone would', () => {
    const still = drift(
      inTheGap((w) => (w.currentsOn = false)),
      10,
    );
    const world = inTheGap();
    const moving = drift(world, 10);
    // 1.8 kn for 10 s is about 29 units at today's scale; leeway alone is far less.
    expect(moving.dx - still.dx).toBeGreaterThan(15);
    expect(world.water.id).toBe('gap-run');
    expect(world.sogKn).toBeGreaterThan(1);
  });

  it('is gentler on Fair winds and stronger on Old salt', () => {
    const at = (difficulty: string) =>
      drift(
        inTheGap((w) => (w.trade.difficulty = difficulty)),
        5,
      ).dx;
    expect(at('fair')).toBeLessThan(at('captain'));
    expect(at('salt')).toBeGreaterThan(at('captain'));
  });

  it('is still water with the Settings switch off', () => {
    const world = inTheGap((w) => (w.currentsOn = false));
    drift(world, 1);
    expect(world.water.id).toBe('');
    expect(world.trade.progress.charted).toBeUndefined();
  });
});

describe('charted once sailed (0140)', () => {
  it('charts the current the first time, once', () => {
    const world = inTheGap();
    const { events } = drift(world, 3);
    expect(events.filter((e) => e.type === 'current-charted')).toEqual([
      { type: 'current-charted', id: 'gap-run' },
    ]);
    expect(world.trade.progress.charted).toEqual(['gap-run']);
  });

  it('keeps the charted currents in the save and in the FW2 code', () => {
    const world = inTheGap();
    drift(world, 3);
    const save = serializeWorld(world);
    expect(save.progress?.charted).toEqual(['gap-run']);
    const fresh = createWorld(PHASE1_MAP, SLOOP);
    applySave(fresh, validateSave(JSON.parse(JSON.stringify(save)), fresh)!);
    expect(fresh.trade.progress.charted).toEqual(['gap-run']);

    const code = encodeSaveCode(save, PHASE1_MAP);
    const read = readSaveCode(code, createWorld(PHASE1_MAP, SLOOP));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.save.progress?.charted).toEqual(['gap-run']);
    // A code without charted currents is what it was before.
    const before = encodeSaveCode(serializeWorld(createWorld(PHASE1_MAP, SLOOP)), PHASE1_MAP);
    expect(code.length).toBeGreaterThan(before.length);
  });

  it('drops ids the map no longer has', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const save = serializeWorld(world);
    save.progress = { ...save.progress!, charted: ['gap-run', 'gone'] };
    expect(validateSave(save, world)!.progress?.charted).toEqual(['gap-run']);
  });
});

describe('the middle gap is a real tradeoff (0140 point 5)', () => {
  const field = new CurrentField(PHASE1_MAP);
  const water = (x: number, y: number) => field.at(x, y);
  const port = (id: string) =>
    harbourApproach(
      PHASE1_MAP,
      PHASE1_MAP.ports.find((p) => p.id === id)!,
    );
  const throughGap = (r: SailRoute) =>
    r.points.some((p) => p.x > -120 && p.x < 40 && p.y > -10 && p.y < 80);
  const route = (from: string, to: string, wind: number, withWater: boolean) =>
    sailRoute(PHASE1_MAP, port(from), port(to), wind, 11, withWater ? water : undefined)!;

  it('speeds the east-bound leg and slows or reroutes the west-bound one', () => {
    let eastFaster = 0,
      westRerouted = 0;
    for (const wind of [30, 210, 300]) {
      const east = route('westholm', 'calda', wind, true);
      if (route('westholm', 'calda', wind, false).seconds > east.seconds + 1) eastFaster++;
      const still = route('calda', 'westholm', wind, false);
      const west = route('calda', 'westholm', wind, true);
      // Against the current the gap never gets quicker; sometimes the way round wins instead.
      expect(west.seconds).toBeGreaterThanOrEqual(still.seconds - 1.5);
      if (throughGap(still) && !throughGap(west)) westRerouted++;
    }
    expect(eastFaster).toBeGreaterThanOrEqual(2);
    expect(westRerouted).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
