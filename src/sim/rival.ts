import { TUNING } from '../data/tuning';
import { createBoat } from './boat';
import { createRng } from './rng';
import { bearingTo, bearingVector } from './math';
import { REGATTA, type RaceCourse, type RaceDef, gateMid, gateSide, rivalPace } from './regatta';
import type { TrafficBoat, TrafficDef } from './traffic';
import type { World } from './world';

/*
 * The race's rival (decision 0217): Wren's cutter Kestrel sails the course beside the captain as a
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
 * A boat that sails a course as a racer (decision 0217): Kestrel, or the balance bots that set the
 * pars. `pace` scales her speed. She turns like a captain's ship of her class, so the pars are
 * times a captain can sail. Lies with her sails down until released.
 */
export function makeRacer(
  world: World,
  course: RaceCourse,
  shipId: string,
  pace: number,
  at: { x: number; y: number; heading: number },
): TrafficBoat {
  const base = TUNING.ships[shipId] ?? TUNING.ships.sloop!;
  const ship = { ...base, speedRatio: base.speedRatio * pace };
  const route = [startPoint(course), ...course.marks, gateMid(course.finish)];
  return {
    fleet: fleetOf(course),
    name: REGATTA.rival.name,
    fleetIndex: -1,
    index: 0,
    ship,
    boat: createBoat(at.x, at.y, at.heading),
    route,
    leg: 0,
    legFrom: { x: at.x, y: at.y },
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
      finish: course.finish,
    },
  };
}

/**
 * Kestrel at the line, a couple of boat lengths along it from the captain toward the end with
 * more room, on the same side, sails down until the horn.
 */
export function createRival(world: World, race: RaceDef, course: RaceCourse): TrafficBoat {
  const rival = REGATTA.rival;
  const base = TUNING.ships[rival.ship] ?? TUNING.ships.sloop!;
  const pace = rivalPace(race, world.trade.captain.activeShip, world.trade.difficulty);
  const me = world.boat;
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
  const out = makeRacer(world, course, rival.ship, pace, { x, y, heading: me.heading });
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

/** The captain's race has ended: she finishes hers, then goes (decision 0217). */
export function endRival(world: World) {
  if (world.rival?.racer) world.rival.racer.over = true;
}

/** Her time round the course, seconds, once she has finished. */
export function rivalTime(world: World): number | undefined {
  const r = world.rival?.racer;
  return r && r.gunAt !== null && r.finishedAt !== null ? r.finishedAt - r.gunAt : undefined;
}
