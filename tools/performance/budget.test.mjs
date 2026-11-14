import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetFor, overBudget } from './budget.mjs';

const budget = { scenarios: { sailing: { calls: 35, triangles: 66000 } } };
const runOf = (calls, triangles, totalMB = 100) => ({
  scenario: 'sailing',
  metrics: { calls: { median: calls }, triangles: { median: triangles } },
  gpuMemory: { totalMB },
});

test('within budget passes', () => {
  assert.deepEqual(overBudget({ runs: [runOf(30, 60000)] }, budget), []);
});
test('the worst run counts', () => {
  assert.equal(overBudget({ runs: [runOf(30, 60000), runOf(36, 70000)] }, budget).length, 2);
});
test('a scenario missing from the report is a problem', () => {
  assert.equal(overBudget({ runs: [] }, budget).length, 1);
});
const budgets = {
  scenarios: { a: 2 },
  frameWork: { limitsMs: { sailing: 100 } },
  gpuMemory: { limitsMB: { ultra: 470 } },
};
const reportAt = (url, quality) => ({ url, config: { settings: { quality } } });
test('a report at High is held to the scenario counts', () => {
  assert.deepEqual(budgetFor(reportAt('http://x/?debug=', 'high'), budgets), {
    scenarios: budgets.scenarios,
    frameWorkMs: budgets.frameWork.limitsMs,
    gpuMemoryMB: undefined,
  });
});
test('Ultra is held to its graphics memory, not to the counts set at High', () => {
  const ultra = budgetFor(reportAt('http://x/?debug=', 'ultra'), budgets);
  assert.deepEqual(ultra, { scenarios: {}, frameWorkMs: {}, gpuMemoryMB: 470 });
  assert.deepEqual(overBudget({ runs: [runOf(90, 400000, 430)] }, ultra), []);
  assert.equal(overBudget({ runs: [runOf(90, 400000, 711)] }, ultra).length, 1);
});
test('a frame of work past the hitch budget is a problem (issue #516)', () => {
  const held = { scenarios: {}, frameWorkMs: { sailing: 100 } };
  const run = (worstWorkMs) => ({ ...runOf(30, 60000), worstWorkMs });
  assert.deepEqual(overBudget({ runs: [run(40)] }, held), []);
  assert.equal(overBudget({ runs: [run(40), run(140)] }, held).length, 1);
});
