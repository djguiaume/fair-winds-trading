// `npm run check` (decision 0153): the editors' own checks on every content file, in seconds,
// without the test suite. Short output: one line per area, one line per problem.
import { readFileSync } from 'node:fs';
import { ISLAND_DESIGNS, type IslandDesign } from '../../src/data/islands';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { grownMap } from '../../src/data/grownMap';
import { stressMap } from '../../src/data/stressMap';
import { questProblems } from '../../src/editor/quest/doc';
import { ISLAND_SCALE } from '../../src/render/models/highlandIslands';
import { islandCheckKit } from '../../src/render/models/towns';
import { checkIsland } from '../../src/sim/islandChecks';
import type { MapDef } from '../../src/sim/map';
import { type MapCheck, questTagsCheck, quickChecks, routeChecks } from '../../src/sim/mapChecks';
import { checkPerks } from '../../src/sim/perks';
import { QUESTS, type QuestDef } from '../../src/sim/quests';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

export interface Problem {
  area: 'seas' | 'islands' | 'quests' | 'perks';
  where: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface CheckOptions {
  /** Areas to check; all when empty. */
  only?: string[];
  /** Extra or replacement seas, by name. */
  seas?: Record<string, MapDef>;
  /** Check only these island files. */
  islands?: string[];
  /**
   * Sailing route checks, the slow part: `first` sea only (default, about 7 s on the ring),
   * `all` seas (the stress sea takes minutes) or `none`.
   */
  routes?: 'first' | 'all' | 'none';
}

/** The seas checked by default: the ring, the grown Phase 4 sea (`?map=phase4`) and the stress sea. */
export function defaultSeas(): Record<string, MapDef> {
  return {
    ring: PHASE1_MAP,
    phase4: prepareMap(grownMap(PHASE1_SOURCE)),
    stress: prepareMap(stressMap(PHASE1_SOURCE)),
  };
}

/** Where each island file is placed: its size and harbour on the first sea that uses it. */
export function islandPlacements(seas: Record<string, MapDef>) {
  const placed = new Map<string, IslandPlace>();
  for (const map of Object.values(seas))
    for (const i of map.islands)
      if (i.look?.design && !placed.has(i.look.design))
        placed.set(i.look.design, { R: i.radius / ISLAND_SCALE, harbour: !!i.look.dock });
  return placed;
}

export interface IslandPlace {
  /** Radius in reference units (the map radius / ISLAND_SCALE). */
  R: number;
  harbour: boolean;
}

/** The island builder's checks on one design at a size, with a file that does not build as an error. */
export function islandProblems(design: IslandDesign, at: IslandPlace) {
  try {
    return checkIsland(design, islandCheckKit(design, at.R, at.harbour)).map((i) => ({
      severity: i.severity,
      message: `${i.check}: ${i.message}`,
    }));
  } catch (e) {
    return [{ severity: 'error' as const, message: `does not build: ${String(e)}` }];
  }
}

/** Every problem in the content, with a count of what was checked per area. */
export function checkAll(opts: CheckOptions = {}) {
  const want = (area: string) => !opts.only?.length || opts.only.includes(area);
  const problems: Problem[] = [];
  const counted: Record<string, string> = {};
  const seas = opts.seas ?? defaultSeas();

  if (want('seas')) {
    const routes = opts.routes ?? 'first';
    Object.entries(seas).forEach(([name, map], n) => {
      const checks: MapCheck[] = [
        ...quickChecks(map),
        questTagsCheck(
          map,
          QUESTS.map((q) => q.id),
        ),
      ];
      if (routes === 'all' || (routes === 'first' && n === 0)) checks.push(...routeChecks(map));
      for (const c of checks)
        if (!c.ok)
          problems.push({
            area: 'seas',
            where: `${name} ${c.id}`,
            severity: c.severity,
            message: c.message,
          });
    });
    const names = Object.keys(seas);
    counted.seas =
      routes === 'first'
        ? `${names.join(', ')}; routes on ${names[0]}`
        : `${names.join(', ')}; routes ${routes}`;
  }

  if (want('islands')) {
    const placed = islandPlacements(seas);
    const ids = opts.islands ?? Object.keys(ISLAND_DESIGNS);
    for (const id of ids) {
      const design = ISLAND_DESIGNS[id];
      const at = placed.get(id);
      if (!design) {
        problems.push({
          area: 'islands',
          where: id,
          severity: 'error',
          message: 'no such island file',
        });
        continue;
      }
      if (!at) {
        problems.push({
          area: 'islands',
          where: id,
          severity: 'warning',
          message: 'not used by any checked sea, skipped',
        });
        continue;
      }
      for (const i of islandProblems(design, at))
        problems.push({ area: 'islands', where: id, severity: i.severity, message: i.message });
    }
    counted.islands = `${ids.length} files`;
  }

  if (want('quests')) {
    const ring = seas.ring ?? Object.values(seas)[0]!;
    const doc = { quests: structuredClone(QUESTS) as QuestDef[], text: { en: {}, fr: {} } };
    for (const message of questProblems(doc, ring))
      problems.push({
        area: 'quests',
        where: message.split(' › ')[0]!,
        severity: 'error',
        message,
      });
    counted.quests = `${QUESTS.length} quests`;
  }

  if (want('perks')) {
    for (const message of checkPerks())
      problems.push({ area: 'perks', where: 'perks.json', severity: 'error', message });
    counted.perks = 'perks.json';
  }
  return { problems, counted };
}

const list = (v: unknown) => (typeof v === 'string' ? v.split(',').filter(Boolean) : undefined);

export function run(args: Args): number {
  if (args.help) {
    console.log(`npm run check [-- options]
  --only seas,islands,quests,perks   check only these areas
  --island id[,id]                   only these island files
  --map file.json[,file.json]        check these map files (editor exports) instead of the ring and stress seas
  --fast                             skip the sailing route checks (about 7 s on the ring)
  --all-routes                       route checks on every sea, not just the first (minutes)
  --warnings                         list warnings too (counted otherwise)
  --json                             every problem as JSON`);
    return 0;
  }
  let seas: Record<string, MapDef> | undefined;
  const files = list(args.map);
  if (files) {
    seas = {};
    for (const f of files) seas[f] = prepareMap(JSON.parse(readFileSync(f, 'utf8')) as MapDef);
  }
  const { problems, counted } = checkAll({
    only: list(args.only),
    islands: list(args.island),
    seas,
    routes: args.fast ? 'none' : args['all-routes'] ? 'all' : 'first',
  });
  if (args.json) {
    console.log(JSON.stringify({ counted, problems }, null, 1));
    return problems.some((p) => p.severity === 'error') ? 1 : 0;
  }
  for (const [area, what] of Object.entries(counted)) {
    const mine = problems.filter((p) => p.area === area);
    const errors = mine.filter((p) => p.severity === 'error');
    const warnings = mine.length - errors.length;
    const tail = warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : '';
    console.log(
      `${area.padEnd(8)}${errors.length ? `${errors.length} error(s)` : 'ok'}${tail} (${what})`,
    );
    for (const p of mine)
      if (p.severity === 'error' || args.warnings)
        console.log(`  ${p.severity === 'error' ? '✗' : '!'} ${p.where}: ${p.message}`);
  }
  return problems.some((p) => p.severity === 'error') ? 1 : 0;
}
