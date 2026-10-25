import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { createWorld, stepWorld } from '../src/sim/world';

describe('her own chart mark (decision 0212)', () => {
  it('is cleared with a mark-reached event once she sails up to it', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const controls = { steer: 0, sailStep: 0 };
    world.destination = {
      kind: 'mark',
      label: 'Your mark',
      x: world.boat.x + 200,
      y: world.boat.y,
    };
    expect(stepWorld(world, controls, 1 / 60).some((e) => e.type === 'mark-reached')).toBe(false);
    expect(world.destination).not.toBeNull();
    world.destination = { kind: 'mark', label: 'Your mark', x: world.boat.x + 3, y: world.boat.y };
    expect(stepWorld(world, controls, 1 / 60).some((e) => e.type === 'mark-reached')).toBe(true);
    expect(world.destination).toBeNull();
  });

  it('leaves a port course alone however close she is', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.destination = { portId: 'x', label: 'Port', x: world.boat.x + 1, y: world.boat.y };
    stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60);
    expect(world.destination).not.toBeNull();
  });
});
