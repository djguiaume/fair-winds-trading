import { type TownDef, type TownFolkData, WHERES } from './townFolk';

/** What the checks compare names with: quality levels, prop recipes, palette colours. */
export interface FolkNames {
  levels: readonly string[];
  recipes: readonly string[];
  colors: readonly string[];
}

/** The most people the mesh may hold: each is an instance placed every frame. */
export const MAX_PEOPLE = 120;

/**
 * Every problem in a town-folk file (issue #477), worded for the editors' page and
 * `npm run folk -- check`; none means the game can draw it.
 */
export function townFolkProblems(data: TownFolkData, names: FolkNames): string[] {
  const problems: string[] = [];
  const fail = (where: string, what: string) => problems.push(`${where}: ${what}`);
  const between = (where: string, v: unknown, lo: number, hi: number) => {
    if (!(typeof v === 'number' && v >= lo && v <= hi)) fail(where, `a number from ${lo} to ${hi}`);
  };
  for (const level of names.levels) between(`quality.${level}`, data.quality?.[level], 0, 1);
  const town = data.town ?? ({} as Partial<TownDef>);
  if (!names.recipes.includes(town.model!))
    fail('town.model', `"${town.model}" is not a prop recipe (src/data/props/)`);
  if (!names.colors.includes(town.coats!))
    fail('town.coats', `"${town.coats}" is not a palette colour (src/data/palette.json)`);
  for (const type of town.cargo ?? [])
    if (!names.recipes.includes(type)) fail('town.cargo', `"${type}" is not a prop recipe`);
  between('town.size', town.size, 0.2, 3);
  between('town.max', town.max, 0, MAX_PEOPLE);
  between('town.range', town.range, 0, 1000);
  between('town.fadeSec', town.fadeSec, 0.1, 30);
  between('town.night', town.night, 0, 1);
  if (!Array.isArray(town.perLevel) || !town.perLevel.length)
    fail('town.perLevel', 'people per town level, one number a level');
  for (const [k, n] of (town.perLevel ?? []).entries())
    between(`town.perLevel.${k}`, n, 0, MAX_PEOPLE);
  const kinds = Object.entries(data.kinds ?? {});
  if (!kinds.length) fail('kinds', 'at least one kind of person');
  for (const [id, kind] of kinds) {
    const at = `kinds.${id}`;
    if (!WHERES.includes(kind.where)) fail(`${at}.where`, `one of ${WHERES.join(', ')}`);
    between(`${at}.share`, kind.share, 0, 1);
    between(`${at}.speed`, kind.speed, 0, 5);
    between(`${at}.stepHz`, kind.stepHz, 0, 6);
    const [a, b] = Array.isArray(kind.pauseSec) ? kind.pauseSec : [NaN, NaN];
    if (!(kind.pauseSec?.length === 2 && a! >= 0 && b! >= a! && b! <= 60))
      fail(`${at}.pauseSec`, '[low, high] with 0 ≤ low ≤ high ≤ 60');
  }
  const shares = kinds.reduce((sum, [, k]) => sum + (Number(k.share) || 0), 0);
  if (kinds.length && Math.abs(shares - 1) > 0.05) fail('kinds', 'the shares add up to 1');
  return problems;
}
