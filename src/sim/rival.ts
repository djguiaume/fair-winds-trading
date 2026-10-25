import { TUNING } from '../data/tuning';
import { createBoat } from './boat';
import { createRng } from './rng';
import { bearingTo, bearingVector } from './math';
import { REGATTA, type RaceCourse, type RaceDef, gateMid, gateSide, rivalPace } from './regatta';
import type { TrafficBoat, TrafficDef } from './traffic';
import type { World } from './world';

/*
 * The race's rival (decision 0216): Wren's cutter Kestrel sails the course beside the captain as a
 * living-sea boat (decision 0215): the same sailing model and helm as the other boats, in the
 * race's pinned wind, round the same marks. Her speed is scaled so she finishes about on the
 * captain's silver time (`regatta.json` › `rival.pace`), so beating her is a silver medal on any
 * ship and level. Not saved: a voyage loaded mid-race starts her again at the line.
 */

/** One fleet per course, kept so her helm's grids are made once per race. */
const fleets = new WeakMap<RaceCourse, TrafficDef>();

function fleetOf(course: RaceCourse): TrafficDef {
  let fleet = fleets.get(course);
  if (fleet) return fleet;
  const marks = [startPoint(course), ...course.marks, gateMid(course.finish)];
  fleet = {
    id: 'regatta-rival',
    kind: 'visitor',
    home: '',
    names: [REGATTA.rival.name],
    path: marks.map((p) => [Math.round(p.x), Math.round(p.y)] as [number, number]),
    ship: REGATTA.rival.ship,
  };
  fleets.set(course, fleet);
  return fleet;
}

/** A little over the start line toward the first mark: where she aims at the horn. */
function startPoint(course: RaceCourse) {
  const mid = gateMid(course.start);
  const to = course.marks[0] ?? gateMid(course.finish);
  const v = bearingVector(bearingTo(mid, to));
  return { x: mid.x + v.x * 12, y: mid.y + v.y * 12 };
}

/**
 * Kestrel at the line, a boat's length or two to leeward of the captain on the course side's far
 * edge, sails down until the horn.
 */
export function createRival(world: World, race: RaceDef, course: RaceCourse): TrafficBoat {
  const rival = REGATTA.rival;
  const base = TUNING.ships[rival.ship] ?? TUNING.ships.sloop!;
  const pace = rivalPace(race, world.trade.captain.activeShip, world.trade.difficulty);
  const ship = {
    ...base,
    speedRatio: base.speedRatio * pace,
    turnRateDeg: base.turnRateDeg * TUNING.seamanship.traffic.crewTurn,
    ironsDecel: base.decel,
  };
  const me = world.boat;
  // Along the line from the boat toward whichever end leaves her more room, on the boat's side.
  const [a, b] = course.start;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const along = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const toA = Math.hypot(me.x - a.x, me.y - a.y);
  const toB = Math.hypot(me.x - b.x, me.y - b.y);
  const k = toB > toA ? 1 : -1;
  const gap = (base.radius + 5) * 2.5;
  let x = me.x + along.x * gap * k;
  let y = me.y + along.y * gap * k;
  // Never over the line before the horn.
  const course0 = course.marks[0] ?? gateMid(course.finish);
  if (Math.sign(gateSide(course.start, { x, y })) === Math.sign(gateSide(course.start, course0))) {
    x = me.x;
    y = me.y;
  }
  const route = [startPoint(course), ...course.marks, gateMid(course.finish)];
  const boat = createBoat(x, y, me.heading);
  const out: TrafficBoat = {
    fleet: fleetOf(course),
    name: rival.name,
    fleetIndex: -1,
    index: 0,
    ship,
    boat,
    route,
    leg: 0,
    legFrom: { x, y },
    outbound: true,
    casts: 0,
    waitUntil: Infinity,
    tack: 0,
    lastTack: -Infinity,
    wind: { from: 0, speedKn: 0 },
    windAt: -Infinity,
    best: Infinity,
    bestAt: world.time,
    byWater: false,
    stuck: 0,
    trips: 0,
    awake: true,
    sweeps: false,
    rng: createRng(world.map.seed ^ 0x6b657374),
    racer: {
      gunAt: null,
      finishedAt: null,
      arrive: Math.min(REGATTA.within, TUNING.seamanship.traffic.arriveRange),
      over: false,
    },
  };
  world.rival = out;
  return out;
}

/** The horn (`started`): she sails. Given up (`!started`): she leaves the water at once. */
export function releaseRival(world: World, started: boolean) {
  const b = world.rival;
  if (!b?.racer) return;
  if (!started) {
    world.rival = null;
    return;
  }
  b.racer.gunAt = world.time;
  b.waitUntil = world.time;
  b.bestAt = world.time;
}

/** The captain's race has ended: she finishes hers, then goes (decision 0216). */
export function endRival(world: World) {
  if (world.rival?.racer) world.rival.racer.over = true;
}

/** Her time round the course, seconds, once she has finished. */
export function rivalTime(world: World): number | undefined {
  const r = world.rival?.racer;
  return r && r.gunAt !== null && r.finishedAt !== null ? r.finishedAt - r.gunAt : undefined;
}
