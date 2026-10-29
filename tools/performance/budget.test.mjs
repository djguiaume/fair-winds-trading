import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetFor, overBudget } from './budget.mjs';

const budget = { scenarios: { sailing: { calls: 35, triangles: 66000 } } };
const runOf = (calls, triangles) => ({
  scenario: 'sailing',
  metrics: { calls: { median: calls }, triangles: { median: triangles } },
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
test('the new look has its own budget', () => {
  const budgets = { scenarios: { a: 1 }, newLook: { scenarios: { a: 2 } } };
  assert.equal(budgetFor({ url: 'http://x/?look=v2&debug=' }, budgets), budgets.newLook);
  assert.equal(budgetFor({ url: 'http://x/?debug=' }, budgets), budgets);
});
