/* global console */
// `npm run adr` (decision 0153): the next free decision number across main and every pushed
// branch (threads work in parallel and used to pick the same one), and a new decision file.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

const DIR = join(ROOT, 'docs/decisions');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const numberOf = (name) => Number(/(?:^|\/)(\d{4})-[^/]*\.md$/.exec(name)?.[1] ?? NaN);

/** Every decision number in use: this checkout, origin/main and every remote branch. */
export function takenNumbers({ fetch = true } = {}) {
  const taken = new Map();
  const add = (n, where) => Number.isFinite(n) && !taken.has(n) && taken.set(n, where);
  for (const f of readdirSync(DIR)) add(numberOf(f), 'this checkout');
  try {
    if (fetch) git('fetch', '-q', 'origin');
  } catch {
    console.log('! could not fetch origin, using the branches known locally');
  }
  const refs = git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin').split('\n');
  for (const ref of refs.filter((r) => r && r !== 'origin/HEAD' && r !== 'origin'))
    for (const f of git('ls-tree', '--name-only', ref, 'docs/decisions/').split('\n'))
      add(numberOf(f), ref);
  return taken;
}

export const nextFree = (taken) => Math.max(0, ...taken.keys()) + 1;
const pad = (n) => String(n).padStart(4, '0');
const slug = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 60);

export function run(args) {
  const [cmd = 'next', ...words] = args._;
  if (args.help || !['next', 'new'].includes(cmd)) {
    console.log(`npm run adr                  next free decision number (main and every pushed branch)
npm run adr -- new "Title"   write docs/decisions/NNNN-title.md from the template and link it in the README
  --no-fetch                 do not fetch origin first`);
    return args.help ? 0 : 1;
  }
  const taken = takenNumbers({ fetch: !args['no-fetch'] });
  const n = nextFree(taken);
  if (cmd === 'next') {
    const top = Math.max(...taken.keys());
    console.log(`next free: ${pad(n)} (highest ${pad(top)} on ${taken.get(top)})`);
    return 0;
  }
  const title = words.join(' ').trim();
  if (!title) {
    console.log('give a title: npm run adr -- new "Short title"');
    return 1;
  }
  const file = `${pad(n)}-${slug(title)}.md`;
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(DIR, file),
    `# ${pad(n)}. ${title}\n\n**Status:** Proposed (${today}).\n\n## Context\n\n## Decision\n\n## Consequences\n`,
  );
  const readme = join(DIR, 'README.md');
  const sep = readFileSync(readme, 'utf8').endsWith('\n') ? '' : '\n';
  appendFileSync(
    readme,
    `${sep}| [${pad(n)}](${file}) | **${title}**: (one line) | ${today} | Proposed |\n`,
  );
  console.log(`wrote docs/decisions/${file} and its README line; fill both in`);
  return 0;
}
