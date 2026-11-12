import type { IslandDesign } from '../../data/islands';
import { moveProp, moveSpot, setPropValue, turnProp } from './doc';

/**
 * Moves or turns something already in an island file (issue #514): the builder's drag, turn and
 * resize as a step, so a town is rearranged without removing and adding its props again (which
 * would change their order, and the homes' with it).
 */
export interface MoveStep {
  do: 'move';
  what: 'prop' | 'pier' | 'lane' | 'spot';
  index: number;
  at?: [number, number];
  /** A prop's turn, size, height and footprint as the `prop` step sets them. */
  turn?: number;
  size?: number;
  y?: number;
  fit?: number;
  /** A pier's or a ground prop's length. */
  length?: number;
  /** A lane's new line; stairs keep a third number, their height, per point. */
  points?: number[][];
}

const pos = (v: number) => Number(v.toFixed(6));

export function applyMove(design: IslandDesign, step: MoveStep): string {
  const i = step.index;
  const missing = () => new Error(`no ${step.what} ${Number.isInteger(i) ? i : '(give an index)'}`);
  switch (step.what) {
    case 'prop': {
      if (!design.props[i]) throw missing();
      if (step.at) moveProp(design, i, step.at[0], step.at[1]);
      if (step.turn !== undefined) turnProp(design, i, step.turn);
      for (const key of ['size', 'y', 'fit', 'length'] as const)
        if (step[key] !== undefined) setPropValue(design, i, key, step[key]);
      break;
    }
    case 'pier': {
      const pier = design.piers[i];
      if (!pier) throw missing();
      if (step.at) [pier.x, pier.z] = [pos(step.at[0]), pos(step.at[1])];
      if (step.length !== undefined) pier.length = pos(step.length);
      break;
    }
    case 'lane': {
      const lane = design.lanes[i];
      if (!lane) throw missing();
      if (!step.points || step.points.length < 2)
        throw new Error('a lane needs two points or more');
      if (lane.kind === 'stairs' && step.points.some((p) => p[2] === undefined))
        throw new Error('stairs need a height for every point (x,z,h)');
      lane.points = step.points.map((p) => p.map(pos));
      if (lane.kind === 'stairs') lane.base = Math.min(...lane.points.map((p) => p[2]!));
      break;
    }
    case 'spot': {
      if (!design.homeSpots?.[i]) throw missing();
      if (step.at) moveSpot(design, i, step.at[0], step.at[1]);
      if (step.y !== undefined) design.homeSpots[i]!.y = pos(step.y);
      break;
    }
    default:
      throw new Error(`move what? (prop, pier, lane, spot)`);
  }
  return `moved ${step.what} ${i}`;
}
