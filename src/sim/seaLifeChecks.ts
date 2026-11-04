import { BIRD_HOMES, type SeaLifeData, type Span, type Waters } from './seaLife';

/** What the checks compare names with: quality levels, seas, prop recipes, palette colours. */
export interface LifeNames {
  levels: readonly string[];
  seas: readonly string[];
  recipes: readonly string[];
  colors: readonly string[];
}

/** The most dolphins a pod has: one place each in the pod (`seaSwimmers.ts`). */
export const MAX_POD = 6;
/** Most of one bird kind or of shoals: each is an instance drawn every frame. */
const MAX_COUNT = 40;

/**
 * Every problem in a sea-life file (issue #476), worded for the editors' page and
 * `npm run life -- check`; none means the game can draw it.
 */
export function seaLifeProblems(data: SeaLifeData, names: LifeNames): string[] {
  const problems: string[] = [];
  const fail = (where: string, what: string) => problems.push(`${where}: ${what}`);
  const between = (where: string, v: unknown, lo: number, hi: number) => {
    if (!(typeof v === 'number' && v >= lo && v <= hi)) fail(where, `a number from ${lo} to ${hi}`);
  };
  const span = (where: string, v: unknown, lo: number, hi: number) => {
    const [a, b] = Array.isArray(v) ? (v as Span) : [NaN, NaN];
    if (!(v instanceof Array && v.length === 2 && a >= lo && b >= a && b <= hi))
      fail(where, `[low, high] with ${lo} ≤ low ≤ high ≤ ${hi}`);
  };
  const model = (where: string, id: unknown) => {
    if (typeof id !== 'string' || !names.recipes.includes(id))
      fail(where, `"${String(id)}" is not a prop recipe (src/data/props/)`);
  };
  const waters = (where: string, w: Partial<Waters>) => {
    if (!Array.isArray(w.seas) || !w.seas.length) fail(`${where}.seas`, 'a list of sea ids');
    for (const sea of w.seas ?? [])
      if (!names.seas.includes(sea))
        fail(`${where}.seas`, `"${sea}" is not a sea (${names.seas.join(', ')})`);
    if (w.shore !== undefined) span(`${where}.shore`, w.shore, 0, 100000);
  };

  for (const level of names.levels) between(`quality.${level}`, data.quality?.[level], 0, 1);

  for (const [id, bird] of Object.entries(data.birds ?? {})) {
    const at = `birds.${id}`;
    model(`${at}.model`, bird.model);
    between(`${at}.count`, bird.count, 0, MAX_COUNT);
    if (!Number.isInteger(bird.count)) fail(`${at}.count`, 'a whole number');
    between(`${at}.size`, bird.size, 0.1, 5);
    waters(at, { seas: bird.seas });
    if (!BIRD_HOMES.includes(bird.home)) fail(`${at}.home`, `one of ${BIRD_HOMES.join(', ')}`);
    between(`${at}.range`, bird.range, 1, 1000);
    span(`${at}.circle`, bird.circle, 1, 200);
    span(`${at}.height`, bird.height, 1, 100);
    between(`${at}.speed`, bird.speed, 0.1, 50);
    between(`${at}.flapHz`, bird.flapHz, 0, 10);
    between(`${at}.glide`, bird.glide, 0, 1);
    between(`${at}.night`, bird.night, 0, 1);
  }

  const { dolphins, whale, shoals } = data;
  model('dolphins.model', dolphins.model);
  between('dolphins.size', dolphins.size, 0.1, 5);
  span('dolphins.pod', dolphins.pod, 1, MAX_POD);
  waters('dolphins', dolphins);
  span('dolphins.every', dolphins.every, 1, 3600);
  span('dolphins.staySec', dolphins.staySec, 1, 600);
  span('dolphins.side', dolphins.side, 2, 100);
  between('dolphins.cruiseKn', dolphins.cruiseKn, 0.5, 30);
  between('dolphins.jumpSec', dolphins.jumpSec, 0.5, 20);
  between('dolphins.airShare', dolphins.airShare, 0.05, 1);
  between('dolphins.jumpHeight', dolphins.jumpHeight, 0, 10);

  model('whale.model', whale.model);
  model('whale.spout', whale.spout);
  between('whale.size', whale.size, 0.1, 5);
  waters('whale', whale);
  span('whale.every', whale.every, 1, 3600);
  between('whale.surfaceSec', whale.surfaceSec, 2, 120);
  span('whale.fromBoat', whale.fromBoat, 5, 500);
  between('whale.swimKn', whale.swimKn, 0, 20);

  model('shoals.model', shoals.model);
  between('shoals.count', shoals.count, 0, MAX_COUNT);
  if (!Number.isInteger(shoals.count)) fail('shoals.count', 'a whole number');
  span('shoals.size', shoals.size, 0.1, 10);
  if (!names.colors.includes(shoals.color))
    fail('shoals.color', `"${shoals.color}" is not a palette colour (src/data/palette.json)`);
  between('shoals.opacity', shoals.opacity, 0.05, 1);
  waters('shoals', shoals);
  span('shoals.range', shoals.range, 5, 500);
  between('shoals.driftKn', shoals.driftKn, 0, 10);
  between('shoals.swirl', shoals.swirl, 0, 5);
  return problems;
}
