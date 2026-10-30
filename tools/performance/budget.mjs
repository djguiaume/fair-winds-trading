/* global process, console, URL */
// `node tools/performance/budget.mjs report.json`: fails when a scenario's draw calls or
// triangles in a `npm run perf` report go past budget.json, or its graphics memory goes past the
// limit for the report's level (decision 0246). Frame times are not checked: the
// headless software renderer says nothing about a tablet (decision 0006), counts do carry over.
import { readFileSync } from 'node:fs';

const METRICS = ['calls', 'triangles'];

/** One message per scenario and metric over its budget (worst run of the report). */
export function overBudget(report, budget) {
  const problems = [];
  if (budget.gpuMemoryMB !== undefined)
    for (const r of report.runs)
      if (r.gpuMemory.totalMB > budget.gpuMemoryMB)
        problems.push(
          `${r.scenario}: graphics memory ${r.gpuMemory.totalMB} MB over budget ${budget.gpuMemoryMB} MB`,
        );
  for (const [scenario, limits] of Object.entries(budget.scenarios)) {
    const runs = report.runs.filter((r) => r.scenario === scenario);
    if (!runs.length) problems.push(`${scenario}: not in the report`);
    for (const metric of METRICS) {
      const worst = Math.max(0, ...runs.map((r) => r.metrics[metric].median));
      if (worst > limits[metric])
        problems.push(`${scenario}: ${metric} ${worst} over budget ${limits[metric]}`);
    }
  }
  return problems;
}

/**
 * The new look (the default; `?look=v1` is the classic one) has its own count limits, set at
 * High; a report at another level is held to its graphics memory limit only.
 */
export function budgetFor(report, budgets) {
  const look = new URL(report.url).searchParams.get('look') === 'v1' ? budgets : budgets.newLook;
  const quality = report.config.settings.quality;
  return {
    scenarios: quality === 'high' ? look.scenarios : {},
    gpuMemoryMB: budgets.gpuMemory.limitsMB[quality],
  };
}

export function run(reportFile) {
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const budgets = JSON.parse(readFileSync(new URL('./budget.json', import.meta.url), 'utf8'));
  const problems = overBudget(report, budgetFor(report, budgets));
  for (const p of problems) console.log(`::error::${p}`);
  console.log(problems.length ? `${problems.length} over budget.` : 'Render budget: all good.');
  return problems.length ? 1 : 0;
}

if (process.argv[1]?.endsWith('budget.mjs')) process.exitCode = run(process.argv[2]);
