import { SHIP_IDS } from './ship';

/*
 * A race's record in the quest progress (decisions 0217, 0226): the best time overall (hundredths
 * of a second), the best medal, and the best time of each ship class, as the pars are kept per
 * class. The club board shows the time of the ship the captain sails now.
 */
export interface RaceRecord {
  best?: number;
  medal?: number;
  /** Ship class → best time, hundredths of a second. */
  bests?: Record<string, number>;
}

/** The fields to carry over when a race's progress is rebuilt. */
export function raceRecord(p: RaceRecord): RaceRecord {
  return {
    ...(p.best !== undefined ? { best: p.best } : {}),
    ...(p.medal ? { medal: p.medal } : {}),
    ...(p.bests ? { bests: p.bests } : {}),
  };
}

/** This ship's best time; a record from before the classes were kept counts for every ship. */
export const bestFor = (p: RaceRecord, ship: string): number | undefined =>
  p.bests ? p.bests[ship] : p.best;

/** Keeps a finish; true when it is this ship's best time. */
export function recordTime(p: RaceRecord, ship: string, hundredths: number): boolean {
  const was = bestFor(p, ship);
  const better = was === undefined || hundredths < was;
  if (better) p.bests = { ...p.bests, [ship]: hundredths };
  p.best = Math.min(p.best ?? hundredths, hundredths);
  return better;
}

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

/** A loaded record, kept only where it makes sense. */
export function cleanRaceRecord(raw: RaceRecord): RaceRecord {
  const bests = Object.fromEntries(
    Object.entries(raw.bests ?? {}).filter(
      ([ship, sec]) => SHIP_IDS.includes(ship) && isCount(sec),
    ),
  );
  return {
    ...(isCount(raw.best) ? { best: raw.best } : {}),
    ...(isCount(raw.medal) && raw.medal > 0 && raw.medal <= 3 ? { medal: raw.medal } : {}),
    ...(Object.keys(bests).length ? { bests } : {}),
  };
}

/** The save code's numbers: best time + 1 (0 = none), medal, then each class (ship, time). */
export function writeRaceRecord(p: RaceRecord, uint: (n: number) => void) {
  uint(p.best === undefined ? 0 : p.best + 1);
  uint(p.medal ?? 0);
  const bests = Object.entries(p.bests ?? {}).filter(([ship]) => SHIP_IDS.includes(ship));
  uint(bests.length);
  for (const [ship, time] of bests) {
    uint(SHIP_IDS.indexOf(ship));
    uint(time);
  }
}

export function readRaceRecord(uint: () => number): RaceRecord {
  const best = uint();
  const medal = uint();
  const bests: Record<string, number> = {};
  for (let n = uint(); n > 0; n--) {
    const ship = SHIP_IDS[uint()];
    const time = uint();
    if (ship) bests[ship] = time;
  }
  return {
    ...(best ? { best: best - 1 } : {}),
    ...(medal ? { medal } : {}),
    ...(Object.keys(bests).length ? { bests } : {}),
  };
}
