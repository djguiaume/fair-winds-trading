/* global process, console, URL */
// `node tools/performance/budget.mjs report.json`: fails when a scenario's draw calls or
// triangles in a `npm run perf` report go past budget.json, its worst frame work goes past the
// hitch budget (issue #516), or its graphics memory goes past the limit for the report's level
// (decision 0246). Counts are held at every level and from both cameras (issue #558); the bytes
// and requests before the title menu are held too (issue #557). Frame intervals are not checked: the headless software renderer says nothing
// about a tablet (decision 0006); counts and the game's own work per frame do carry over.
import { appendFileSync, readFileSync } from 'node:fs';

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
  for (const r of report.runs.filter((run) => run.firstLoad))
    for (const [key, limit] of Object.entries(budget.firstLoad ?? {}))
      if (r.firstLoad[key] > limit)
        problems.push(`firstLoad: ${key} ${r.firstLoad[key]} over budget ${limit}`);
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
 * The limits for a report's level: counts from `scenarios` at High and from `levels` elsewhere,
 * the hitch budget at every level but Ultra (its software-rendered frames are seconds long), the
 * first load at High, graphics memory where a limit is set.
 */
export function budgetFor(report, budgets) {
  const quality = report.config.settings.quality;
  const high = quality === 'high';
  return {
    scenarios: high ? budgets.scenarios : (budgets.levels[quality] ?? {}),
    frameWorkMs: quality === 'ultra' ? {} : budgets.frameWork.limitsMs,
    firstLoad: high ? budgets.firstLoad.limits : {},
    gpuMemoryMB: budgets.gpuMemory.limitsMB[quality],
  };
}

/** Markdown table of one report's counts by view against their limits, for the run's summary. */
export function table(report, limits) {
  const quality = report.config.settings.quality;
  const rows = [
    `### ${quality}`,
    '',
    '| View | Calls | Triangles | Past the fog |',
    '|---|---|---|---|',
  ];
  for (const [scenario, max] of Object.entries(limits.scenarios)) {
    const runs = report.runs.filter((r) => r.scenario === scenario);
    if (!runs.length) continue;
    const calls = Math.max(...runs.map((r) => r.metrics.calls.median));
    const triangles = Math.max(...runs.map((r) => r.metrics.triangles.median));
    const meshes = Math.max(...runs.map((r) => r.beyondFog?.meshes ?? 0));
    rows.push(
      `| ${scenario} | ${calls} / ${max.calls} | ${triangles} / ${max.triangles} | ${meshes} meshes |`,
    );
  }
  for (const r of report.runs.filter((run) => run.firstLoad))
    rows.push(
      `| firstLoad | ${r.firstLoad.requests} / ${limits.firstLoad.requests} requests | ${r.firstLoad.bytes} / ${limits.firstLoad.bytes} bytes | |`,
    );
  return rows.join('\n');
}

export function run(reportFile) {
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const budgets = JSON.parse(readFileSync(new URL('./budget.json', import.meta.url), 'utf8'));
  const limits = budgetFor(report, budgets);
  const problems = overBudget(report, limits);
  const summary = `${table(report, limits)}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  for (const p of problems) console.log(`::error::${p}`);
  console.log(problems.length ? `${problems.length} over budget.` : 'Render budget: all good.');
  return problems.length ? 1 : 0;
}

if (process.argv[1]?.endsWith('budget.mjs')) process.exitCode = run(process.argv[2]);
