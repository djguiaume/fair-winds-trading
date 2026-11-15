import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closingIssues } from './closing.mjs';

test('one issue', () => assert.deepEqual(closingIssues('Fixes #12'), [12]));
test('a list closes every issue, not just the first', () =>
  assert.deepEqual(closingIssues('Fixes #531, #533 and #534'), [531, 533, 534]));
test('several keywords, repeats dropped', () =>
  assert.deepEqual(closingIssues('Closes #1\nresolved: #2\nFixes #1'), [1, 2]));
test('Refs and plain mentions do not close', () =>
  assert.deepEqual(closingIssues('Refs #5. See #6 and fixes nothing'), []));
test('no body', () => assert.deepEqual(closingIssues(null), []));
