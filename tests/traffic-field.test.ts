import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { createBoat } from '../src/sim/boat';
import { resolveCollisions } from '../src/sim/collision';
import { seaShape } from '../src/sim/seaEdge';
import { SLOOP } from '../src/sim/ship';
import { laneOf } from '../src/sim/traffic';
import { markField, obstaclesNear } from '../src/sim/trafficField';
import { createWorld } from '../src/sim/world';

describe("the other boats' water grids (issue #516)", () => {
  it('asks only the land and piers near a box, with the same answer at every point of it', () => {
    const world = createWorld(GAME_MAP, SLOOP);
    const { islands, terrain } = world.land;
    const sea = seaShape(world.map);
    const box = { minX: 0, minY: -400, maxX: 400, maxY: 0 };
    const radius = 8;
    const near = obstaclesNear(box, radius, islands, terrain, world.piers);
    expect(near.islands.length).toBeLessThan(islands.length);
    const probe = createBoat(0, 0, 0);
    let blocked = 0;
    for (let x = box.minX; x <= box.maxX; x += 5)
      for (let y = box.minY; y <= box.maxY; y += 5) {
        const ask = (i: typeof islands, t: typeof terrain, p: typeof world.piers) => {
          Object.assign(probe, { x, y, speedKn: 0 });
          return resolveCollisions(probe, radius, i, sea, t, p, SLOOP.draft) !== null;
        };
        const all = ask(islands, terrain, world.piers);
        expect(ask(near.islands, near.terrain, near.piers), `${x},${y}`).toBe(all);
        if (all) blocked++;
      }
    expect(blocked).toBeGreaterThan(0);
  });

  it('fills a fleet grid a share a step: no field until it is full, then the same field', () => {
    const world = createWorld(GAME_MAP, SLOOP);
    const boat = world.traffic.boats[0]!;
    const fresh = () => ({ ...boat, fleet: { ...boat.fleet } });
    const lane = laneOf(world.map, boat.fleet);
    const mark = lane[lane.length - 1]!;
    const wind = { from: 0, speedKn: 12 };

    const spread = fresh();
    let steps = 0;
    let field = null;
    while (!field) {
      world.traffic.gridCells = 200;
      field = markField(world, spread, lane, mark, wind);
      steps++;
    }
    expect(steps).toBeGreaterThan(1);
    world.traffic.gridCells = Infinity;
    const atOnce = markField(world, fresh(), lane, mark, wind);
    expect(atOnce).not.toBeNull();
    expect(field.d).toEqual(atOnce!.d);
  });
});
