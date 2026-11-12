// `npm run island -- audit` (issue #513): the town rules over every shipped island with houses,
// one line per island (or a Markdown table with --md, JSON with --json, plans with --chart dir,
// named <id>-before.jpg or --as after),
// from the same town checks the island builder shows.
import { ISLAND_DESIGNS } from '../../src/data/islands';
import { islandCheckKit } from '../../src/render/models/islandCheckKit';
import { ISLAND_SCALE } from '../../src/sim/islandUnits';
import { checkTown } from '../../src/sim/townChecks';
import { townPlan } from '../../src/sim/townPlan';
import { TOWN_RULES } from '../../src/sim/townRules';
import { defaultSeas, islandPlacements } from './check';
import type { Args } from './islandArgs';
import { writeTownCharts } from './townChart';

/** The rules in the art bible's order, as the checks name them (`town-<rule>`). */
export const TOWN_CHECKS = [
  'slope',
  'ground',
  'shore',
  'facing',
  'row',
  'spacing',
  'lanes',
  'piers',
  'harbour',
  'fields',
  'woods',
  'hazard',
] as const;

export interface TownAudit {
  id: string;
  name: string;
  style: string;
  houses: number;
  /** House width in world units. */
  W: number;
  warn: number;
  fail: number;
  /** Findings by rule, "warn/fail". */
  rules: Record<string, [number, number]>;
  messages: string[];
}

/** The town audit of every shipped island with houses, sorted by id. */
export function townAudit(only?: string): TownAudit[] {
  const places = islandPlacements(defaultSeas());
  const out: TownAudit[] = [];
  for (const design of Object.values(ISLAND_DESIGNS).sort((a, b) => a.id.localeCompare(b.id))) {
    const place = places.get(design.id);
    if (!place || (only && design.id !== only)) continue;
    const kit = islandCheckKit(design, place.R, place.harbour);
    const plan = townPlan(design, kit, TOWN_RULES, []);
    if (!plan) continue;
    const issues = checkTown(design, kit);
    const rules: Record<string, [number, number]> = {};
    for (const rule of TOWN_CHECKS) rules[rule] = [0, 0];
    for (const i of issues) rules[i.check.slice('town-'.length)]![i.grade === 'fail' ? 1 : 0]++;
    out.push({
      id: design.id,
      name: design.name,
      style: design.style,
      houses: plan.houses.length,
      W: Math.round(plan.W * place.R * ISLAND_SCALE * 10) / 10,
      warn: issues.filter((i) => i.grade !== 'fail').length,
      fail: issues.filter((i) => i.grade === 'fail').length,
      rules,
      messages: issues.map(
        (i) =>
          `${i.grade === 'fail' ? '✗' : '!'} ${i.check}: ${i.message}${i.prop === undefined ? '' : ` [prop ${i.prop}]`}`,
      ),
    });
  }
  return out;
}

const cell = ([warn, fail]: [number, number]) =>
  warn || fail ? [fail && `${fail}✗`, warn && `${warn}!`].filter(Boolean).join(' ') : '·';

/** The audit as a Markdown table: one row per island, one column per rule. */
export function auditTable(audit: TownAudit[]): string {
  const head = ['Island', 'Style', 'Houses', 'W', 'Fail', 'Warn', ...TOWN_CHECKS];
  const rows = audit.map((a) => [
    a.name,
    a.style,
    String(a.houses),
    a.W.toFixed(1),
    String(a.fail),
    String(a.warn),
    ...TOWN_CHECKS.map((r) => cell(a.rules[r]!)),
  ]);
  return [head, head.map(() => '---'), ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');
}

export async function runAudit(args: Args, only?: string): Promise<number> {
  if (typeof args.chart === 'string') {
    const as = typeof args.as === 'string' ? args.as : undefined;
    for (const file of await writeTownCharts(args.chart, only, as)) console.log(`→ ${file}`);
    return 0;
  }
  const audit = townAudit(only);
  if (args.json) console.log(JSON.stringify(audit, null, 1));
  else if (args.md) console.log(auditTable(audit));
  else
    for (const a of audit) {
      console.log(
        `${a.id}: ${a.houses} houses, W ${a.W}; ${a.fail} fail, ${a.warn} warn; ${TOWN_CHECKS.filter(
          (r) => a.rules[r]![0] + a.rules[r]![1],
        )
          .map((r) => `${r} ${cell(a.rules[r]!)}`)
          .join(', ')}`,
      );
      if (only || args.warnings) for (const m of a.messages) console.log(`  ${m}`);
    }
  return 0;
}
