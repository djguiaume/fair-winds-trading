/* global process, console */
// Closes the issues a merged PR says it fixes (issue #569). GitHub's own closing keywords miss
// "Fixes #1, #2" (only #1 closes) and any merge that did not land on the default branch.
// `node tools/ci/closing.mjs` reads PR_BODY and prints the issue numbers, one per line.
import { pathToFileURL } from 'node:url';

const KEYWORD_LIST =
  /\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s*:?\s+((?:#\d+(?:\s*(?:,|and|&)\s*)?)+)/gi;

/** Issue numbers named after a closing keyword, in order, without repeats. "Refs #N" does not close. */
export function closingIssues(body) {
  const found = new Set();
  for (const [, list] of (body ?? '').matchAll(KEYWORD_LIST))
    for (const [, n] of list.matchAll(/#(\d+)/g)) found.add(Number(n));
  return [...found];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  for (const n of closingIssues(process.env.PR_BODY)) console.log(n);
