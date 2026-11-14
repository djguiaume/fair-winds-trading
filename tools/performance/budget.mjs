/* global process, console, URL */
// `node tools/performance/budget.mjs report.json`: fails when a scenario's draw calls or
// triangles in a `npm run perf` report go past budget.json, its worst frame work goes past the
// hitch budget (issue #516), or its graphics memory goes past the limit for the report's level
// (decision 0246). Frame intervals are not checked: the headless software renderer says nothing
// about a tablet (decision 0006); counts and the game's own work per frame do carry over.
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
  for (const [scenario, limit] of Object.entries(budget.frameWorkMs ?? {}))
    for (const r of report.runs.filter((run) => run.scenario === scenario))
      if (r.worstWorkMs > limit)
        problems.push(
          `${scenario}: a frame of ${r.worstWorkMs.toFixed(1)} ms work over budget ${limit} ms`,
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
 * The count limits are set at High, like the frame work limits; a report at another level is held to its
 * graphics memory limit only.
 */
export function budgetFor(report, budgets) {
  const quality = report.config.settings.quality;
  return {
    scenarios: quality === 'high' ? budgets.scenarios : {},
    frameWorkMs: quality === 'high' ? budgets.frameWork.limitsMs : {},
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
