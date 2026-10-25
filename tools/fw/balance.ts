// `npm run balance` (decision 0153): the balance bots of src/sim/balance.ts on all three
// difficulty levels (Guillaume's rule), as one short table plus the checks that fail.
import { PHASE1_MAP } from '../../src/data/maps';
import { loadSea } from './seas';
import {
  type BalanceCheck,
  type DifficultyRun,
  difficultyChecks,
  difficultyRun,
  economyChecks,
  economyRun,
  legTimes,
  levelName,
  type StoryRun,
  storyChecks,
  storyRun,
} from '../../src/sim/balance';
import { DIFFICULTIES } from '../../src/sim/difficulty';
import type { MapDef } from '../../src/sim/map';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const min = (m: number | undefined) => (m === undefined ? 'never' : `${m.toFixed(1)}`);

/** One line per level: sloop legs, then the relaxed and sharp captains' milestones in minutes. */
export function levelTable(by: DifficultyRun): string[] {
  const rows = [
    'level        legs med (9/10)  relaxed: 1st upgrade / cutter / 1st town / repairs   sharp cutter',
  ];
  for (const l of DIFFICULTIES) {
    const r = by[l]!;
    const legs = `${Math.round(r.legs.median)} s (${Math.round(r.legs.slow)} s)`;
    const relaxed = [r.relaxed.firstUpgrade, r.relaxed.cutter, r.relaxed.firstTown].map(min);
    const still = r.stillWater ? `  still water cutter ${min(r.stillWater.cutter)}` : '';
    rows.push(
      `${levelName(l).padEnd(13)}${legs.padEnd(17)}${relaxed.join(' / ')} min / ${Math.round(100 * r.relaxed.repairs)} %`.padEnd(
        84,
      ) + `${min(r.sharp.cutter)} min${still}`,
    );
  }
  return rows;
}

/** One line per level for the grown sea's story run (decision 0195). */
export function storyTable(by: StoryRun): string[] {
  const rows = [
    'level        seas open (relaxed, min)        ring → last hour gold/min   far goods  far legs',
  ];
  for (const l of DIFFICULTIES) {
    const r = by[l]!;
    const open = Object.entries(r.opened)
      .map(([sea, m]) => `${sea[0]} ${Number.isFinite(m) ? Math.round(m) : '–'}`)
      .join(' ');
    rows.push(
      `${levelName(l).padEnd(13)}${open.padEnd(32)}${`${Math.round(r.ringRate)} → ${Math.round(r.lateRate)}`.padEnd(28)}${`${Math.round(100 * r.farShare)} %`.padEnd(11)}${Math.round(r.farLegs)} s`,
    );
  }
  return rows;
}

const failing = (checks: BalanceCheck[]) =>
  checks.filter((c) => !c.ok).map((c) => `  ✗ ${c.label}: ${c.actual} (target ${c.target})`);

export function run(args: Args): number {
  if (args.help) {
    console.log(`npm run balance [-- options]   balance bots on every difficulty level (about 10 s)
  --map ring|stress|phase4|file.json   the sea (default ring): an editor export, or a sea file
                         merged round the ring (src/data/seas/*.json or a copy)
  --legs                 only sloop leg times per level (seconds, fast)
  --only economy,levels,story  run only these parts (story: the grown sea in story order, 0195)
  --all                  list passing checks too
  --json                 runs and checks as JSON`);
    return 0;
  }
  const map: MapDef = typeof args.map === 'string' ? loadSea(args.map).prepared : PHASE1_MAP;
  if (args.legs) {
    for (const l of DIFFICULTIES) {
      const t = legTimes(map, l);
      console.log(
        `${levelName(l).padEnd(13)}median ${Math.round(t.median)} s, 9 in 10 under ${Math.round(t.slow)} s`,
      );
    }
    return 0;
  }
  const only =
    typeof args.only === 'string' ? args.only.split(',') : ['economy', 'levels', 'story'];
  const checks: BalanceCheck[] = [];
  const json: Record<string, unknown> = {};
  const lines: string[] = [];
  if (only.includes('economy')) {
    const r = economyRun(map);
    const c = economyChecks(r);
    checks.push(...c);
    json.economy = r;
    lines.push(`economy (Fair winds bots): ${c.filter((x) => x.ok).length}/${c.length} checks ok`);
  }
  if (only.includes('levels')) {
    const by = difficultyRun(map);
    const c = difficultyChecks(by);
    checks.push(...c);
    json.levels = by;
    lines.push(...levelTable(by), `levels: ${c.filter((x) => x.ok).length}/${c.length} checks ok`);
  }
  if (only.includes('story')) {
    const by = storyRun(map);
    if (by) {
      const c = storyChecks(by);
      checks.push(...c);
      json.story = by;
      lines.push(...storyTable(by), `story: ${c.filter((x) => x.ok).length}/${c.length} checks ok`);
    }
  }
  const bad = checks.some((c) => !c.ok);
  if (args.json) {
    console.log(JSON.stringify({ ...json, checks }, null, 1));
    return bad ? 1 : 0;
  }
  console.log(lines.join('\n'));
  console.log(
    (args.all
      ? checks.map((c) => `  ${c.ok ? '✓' : '✗'} ${c.label}: ${c.actual} (target ${c.target})`)
      : failing(checks)
    ).join('\n') || '  every balance check passes',
  );
  return bad ? 1 : 0;
}
