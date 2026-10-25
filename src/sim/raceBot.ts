import { DIFFICULTIES, type Difficulty } from './difficulty';
import type { MapDef } from './map';
import { landOut, landWith } from './questLand';
import type { QuestDef } from './quests';
import { courseOf } from './regatta';
import { makeRacer } from './rival';
import { SHIP_CLASSES, SHIP_IDS, SLOOP } from './ship';
import { heldWind } from './stepEffects';
import { sailAlone } from './traffic';
import { createWorld } from './world';

/*
 * The balance bots of the regatta (decision 0217): a boat of each ship class sails a race's course
 * from its start, in its pinned wind, with the currents of each difficulty level, on the helm of
 * the other boats (decision 0215). Its time is the race's par for that class and level: the gold
 * medal's time; silver and bronze are shares more (`regatta.json` › `medals`).
 */

export interface BotRun {
  ship: string;
  difficulty: Difficulty;
  /** Seconds from the horn to the finish, or null when she did not finish. */
  sec: number | null;
  /** Marks she gave up because she could not get there. */
  stuck: number;
  /** Seconds from the horn at each mark of her route (the start, the marks, the finish). */
  legs: number[];
  /** Her route's points she gave up (0 the start, then the marks, the last the finish). */
  gaveUp: number[];
}

/** At most this long round any course before the bot is called lost. */
const GIVE_UP_SEC = 3600;

/** One bot round a race: a ship class on a level. */
export function sailRace(
  map: MapDef,
  quest: QuestDef,
  ship: string,
  difficulty: Difficulty,
): BotRun {
  const step = quest.steps[0];
  const course = courseOf(step?.goal);
  if (!course) return { ship, difficulty, sec: null, stuck: 0, legs: [], gaveUp: [] };
  const world = createWorld(map, SLOOP);
  world.trade.difficulty = difficulty;
  world.trade.captain.activeShip = ship;
  // The sea as it stands late in the story: every quest's land in place.
  const tags = [...map.islands, ...(map.terrain ?? [])].flatMap((f) =>
    (f.tags ?? []).map((t) => t.slice(t.indexOf(':') + 1)),
  );
  world.land = landWith(map, landOut(map, new Set(tags)));
  world.calmWind = heldWind(step!.wind ?? quest.wind, map);
  // Nobody to give way to.
  world.boat.x = world.boat.y = 1e6;
  const from = step!.moveTo;
  const heading = ((from?.headingDeg ?? 0) * Math.PI) / 180;
  const at = from
    ? { x: from.x, y: from.y, heading }
    : { x: course.start[0].x, y: course.start[0].y, heading };
  const bot = makeRacer(world, course, ship, 1, at);
  bot.waitUntil = 0;
  bot.racer!.gunAt = world.time;
  const end = world.time + GIVE_UP_SEC;
  const legs: number[] = [];
  const gaveUp: number[] = [];
  let leg = 0;
  let stuck = 0;
  while (world.time < end && bot.racer!.finishedAt === null) {
    sailAlone(world, bot, 0.5, 0.1);
    const now = bot.racer!.finishedAt !== null ? bot.route.length : bot.leg;
    while (leg < (bot.racer!.finishedAt !== null ? legs.length + 1 : now)) {
      legs.push(Math.round(world.time * 10) / 10);
      if (bot.stuck > stuck) gaveUp.push(leg);
      stuck = bot.stuck;
      leg++;
      if (bot.racer!.finishedAt !== null) break;
    }
  }
  const done = bot.racer!.finishedAt;
  if (done !== null && bot.stuck > stuck) gaveUp.push(leg);
  return {
    ship,
    difficulty,
    sec: done === null ? null : Math.round((done - bot.racer!.gunAt!) * 10) / 10,
    stuck: bot.stuck,
    legs,
    gaveUp,
  };
}

/**
 * The pars of a race (decision 0217): every ship class on every level, rounded up to whole
 * seconds. A class whose bot does not get round (a big hull in a narrow gap: the bots' grid is
 * coarser than the captain's helm) gets a par worked out from the others by speed: the slowest of
 * their times × their speed over hers, listed in `estimated`.
 */
export function racePars(
  map: MapDef,
  quest: QuestDef,
  ships: readonly string[] = SHIP_IDS,
): { pars: Record<string, Record<string, number>>; runs: BotRun[]; estimated: string[] } {
  const pars: Record<string, Record<string, number>> = {};
  const runs: BotRun[] = [];
  for (const ship of ships)
    for (const level of DIFFICULTIES) {
      const run = sailRace(map, quest, ship, level);
      runs.push(run);
      if (run.sec === null || run.stuck) continue;
      (pars[ship] ??= {})[level] = Math.ceil(run.sec);
    }
  const estimated: string[] = [];
  for (const ship of ships)
    for (const level of DIFFICULTIES) {
      if (pars[ship]?.[level]) continue;
      const mine = SHIP_CLASSES[ship]?.speedRatio ?? 1;
      const guesses = Object.entries(pars)
        .filter(([, l]) => l[level])
        .map(([other, l]) => (l[level]! * (SHIP_CLASSES[other]?.speedRatio ?? 1)) / mine);
      if (!guesses.length) continue;
      (pars[ship] ??= {})[level] = Math.ceil(Math.max(...guesses));
      if (!estimated.includes(ship)) estimated.push(ship);
    }
  return { pars, runs, estimated };
}
