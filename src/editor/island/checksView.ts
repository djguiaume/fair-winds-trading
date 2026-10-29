import { type IslandIssue, TRIANGLE_BUDGET } from '../../sim/islandChecks';
import { TOP_LEVEL } from './doc';

/** What the checks list shows: the worker's answer, or that it is still running. */
export interface ChecksState {
  issues: IslandIssue[];
  triangles: number[];
  checking: boolean;
}

/**
 * Fills the builder's checks list; clicking an issue with a level or a prop goes to it. Returns the
 * count the Checks tab shows (✗ errors, else ⚠ warnings).
 */
export function renderChecks(
  list: HTMLElement,
  { issues, triangles, checking }: ChecksState,
  go: (issue: IslandIssue) => void,
): string {
  list.replaceChildren();
  const li = (cls: string, text: string, sub?: string) => {
    const item = document.createElement('li');
    item.className = cls;
    item.textContent = text;
    if (sub) {
      const small = document.createElement('small');
      small.textContent = sub;
      item.append(document.createElement('br'), small);
    }
    list.append(item);
    return item;
  };
  if (checking) li('pending', '⋯ checking the island');
  const has = (check: string) => issues.some((i) => i.check === check);
  if (!checking) {
    if (!has('land') && !has('water') && !has('cliff'))
      li('ok', '✓ every prop on its ground, none in the lake or on a cliff edge');
    if (!has('approach') && !has('pier')) li('ok', '✓ clear of the piers and the harbour approach');
    if (!has('growth')) li('ok', '✓ each level only adds: no home is removed');
  }
  for (const issue of issues) {
    const item = li(
      issue.severity,
      `${issue.severity === 'error' ? '✗' : '⚠'} ${issue.message}`,
      issue.level ? `level ${issue.level}` : undefined,
    );
    if (issue.prop !== undefined || issue.level !== undefined) {
      item.classList.add('link');
      item.addEventListener('click', () => go(issue));
    }
  }
  if (!checking && triangles.length && !has('budget'))
    li(
      'ok',
      `✓ 3D: ${triangles[TOP_LEVEL - 1]!.toLocaleString('en')} of ${TRIANGLE_BUDGET.toLocaleString('en')} triangles at level ${TOP_LEVEL}`,
    );
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  return errors ? `✗${errors}` : warnings ? `⚠${warnings}` : '';
}
