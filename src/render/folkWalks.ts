import { atLevel, type IslandDesign } from '../data/islands';
import { characterPiers, islandLayout } from '../sim/islandLayout';
import { type TownDef, type Walk, type WalkPoint, makeWalk } from '../sim/townFolk';
import { type LanePiece, lanePieces } from './models/townLanes';
import { isResidence } from './models/townProps';

/*
 * Where a town's people go (issue #477), from the island file alone: the lanes the town shows
 * at its level, the piers' decks and edges, and the cargo by the harbour. Plan coordinates are
 * the file's radius units; a deck's height is in reference units, like the ground a prop stands on.
 */

/** Top of a pier's deck, reference units (`towns.ts` dock). */
const DECK_TOP = 0.55;
/** The arrival pier's deck width by level, reference units (`towns.ts` dock); a side pier's. */
const DECK_WIDTH = [0.6, 0.9, 1.1, 1.1];
const SIDE_PIER_WIDTH = 0.9;
/** Where along a pier the fishermen stand, as shares of its length, from the root. */
const FISHING_SPOTS = [0.42, 0.62, 0.82];
/** A lane run shorter than this, radius units, is a stub nobody walks. */
const MIN_LANE = 0.15;
/** A worker carries at most this far, radius units; farther cargo is worked on the spot. */
const CARRY_RANGE = 0.9;
/** A worker's stand is this far off the cargo toward where it goes, radius units. */
const OFF_CARGO = 0.08;

/** Every walk and standing place of a town at its level. */
export function townWalks(
  design: IslandDesign,
  R: number,
  level: number,
  hasHarbour: boolean,
  town: Pick<TownDef, 'cargo'>,
): Walk[] {
  const walks = laneWalks(design, level);
  const piers = hasHarbour ? characterPiers(design, R, level) : [];
  piers.forEach((pier, k) => {
    const x = pier.x / R,
      z0 = pier.z0 / R,
      len = pier.len / R;
    const half =
      (k === 0 ? DECK_WIDTH[Math.min(level, DECK_WIDTH.length) - 1]! : SIDE_PIER_WIDTH) / 2;
    const deck = (zz: number): WalkPoint => ({ x, z: zz, y: DECK_TOP });
    walks.push(makeWalk('pier', [deck(z0 + 0.25 / R), deck(z0 + len - 0.5 / R)]));
    FISHING_SPOTS.forEach((t, i) => {
      const side = i % 2 ? -1 : 1;
      const edge = { x: x + (side * (half + 0.03)) / R, z: z0 + len * t, y: DECK_TOP };
      walks.push(makeWalk('edge', [edge], (side * Math.PI) / 2));
    });
  });
  const root = piers[0] ? { x: piers[0].x / R, z: piers[0].z0 / R } : null;
  const cargo = design.props.filter((p) => town.cargo.includes(p.type) && atLevel(p, level));
  for (const prop of cargo) {
    const others = cargo.filter((o) => o !== prop);
    const to = nearest([...(root ? [root] : []), ...others], prop.x, prop.z, CARRY_RANGE);
    if (!to) {
      walks.push(makeWalk('cargo', [{ x: prop.x, z: prop.z + OFF_CARGO }], 0));
      continue;
    }
    const d = Math.hypot(to.x - prop.x, to.z - prop.z);
    const from = {
      x: prop.x + ((to.x - prop.x) / d) * OFF_CARGO,
      z: prop.z + ((to.z - prop.z) / d) * OFF_CARGO,
    };
    const stop = {
      x: to.x - ((to.x - prop.x) / d) * OFF_CARGO,
      z: to.z - ((to.z - prop.z) / d) * OFF_CARGO,
    };
    walks.push(makeWalk('cargo', [from, stop]));
  }
  return walks;
}

/** The lanes the town shows at this level, each run of pieces one walk. */
function laneWalks(design: IslandDesign, level: number): Walk[] {
  const walks: Walk[] = [];
  const homes = design.props
    .filter((p) => isResidence(p) && atLevel(p, level))
    .map((p) => ({ x: p.x, z: p.z }));
  let run: WalkPoint[] = [];
  let last: LanePiece | null = null;
  const flush = () => {
    const walk = makeWalk('lane', run);
    if (walk.length >= MIN_LANE) walks.push(walk);
    run = [];
  };
  for (const piece of lanePieces(design, islandLayout(design, level), homes)) {
    if (!last || last.lane !== piece.lane || last.i !== piece.i - 1) {
      flush();
      run.push({ x: piece.ax, z: piece.az });
    }
    run.push({ x: piece.bx, z: piece.bz });
    last = piece;
  }
  flush();
  return walks;
}

function nearest<P extends { x: number; z: number }>(
  places: P[],
  x: number,
  z: number,
  within: number,
) {
  let best: P | null = null;
  let bestD = within;
  for (const p of places) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
