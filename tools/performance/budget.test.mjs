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
  scenarios: { a: 1 },
  newLook: { scenarios: { a: 2 } },
  gpuMemory: { limitsMB: { ultra: 470 } },
};
const reportAt = (url, quality) => ({ url, config: { settings: { quality } } });
test('the new look has its own budget', () => {
  assert.deepEqual(budgetFor(reportAt('http://x/?debug=', 'high'), budgets), {
    scenarios: budgets.newLook.scenarios,
    gpuMemoryMB: undefined,
  });
  assert.equal(
    budgetFor(reportAt('http://x/?look=v1&debug=', 'high'), budgets).scenarios,
    budgets.scenarios,
  );
});
test('Ultra is held to its graphics memory, not to the counts set at High', () => {
  const ultra = budgetFor(reportAt('http://x/?debug=', 'ultra'), budgets);
  assert.deepEqual(ultra, { scenarios: {}, gpuMemoryMB: 470 });
  assert.deepEqual(overBudget({ runs: [runOf(90, 400000, 430)] }, ultra), []);
  assert.equal(overBudget({ runs: [runOf(90, 400000, 711)] }, ultra).length, 1);
});
