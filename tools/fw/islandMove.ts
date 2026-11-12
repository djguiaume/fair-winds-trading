// `npm run island -- <id> move …` (issue #514): the command line of the builder's drag and turn.
import type { MoveStep } from '../../src/editor/island/moveStep';
import { type Args, num, pair, pointList } from './islandArgs';

export const MOVE_HELP = `  move      prop <index> [--at x,z --turn deg --size s --y h --fit r --length l]
            pier <index> [--at x,z --length l] | lane <index> --points "x,z x,z …" | spot <index> [--at x,z --y h]
            moves or turns what is there, in place (the audit and --json give a prop's index)`;

/** The move a command line asks for, as a step. */
export function moveFromArgs(args: Args, rest: string[]): MoveStep {
  const [what, index] = rest;
  if (!what || index === undefined) throw new Error('move needs what and its index: move prop 12');
  const step: MoveStep = {
    do: 'move',
    what: what as MoveStep['what'],
    index: Number(index),
    at: pair(args.at),
    turn: num(args.turn),
    size: num(args.size),
    y: num(args.y),
    fit: num(args.fit),
    length: num(args.length),
    points: pointList(args.points),
  };
  return Object.fromEntries(Object.entries(step).filter(([, v]) => v !== undefined)) as MoveStep;
}
