// `npm run life` (decision 0153, issue #476): the birds and sea life of src/data/sea-life.json
// from the command line, with the editors' Sea life page's own fields, edits and checks
// (src/editor/seaLife/doc.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import {
  LIFE_FILE,
  type SeaLifeDoc,
  addBird,
  lifeField,
  lifeFields,
  lifeProblems,
  lifeText,
  removeBird,
  setLifeField,
  shippedLifeDoc,
} from '../../src/editor/seaLife/doc';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const HELP = `npm run life -- <command>   (the editors' Sea life page makes the same edits)
  list [--json]                 every field: path and value (birds.gull.count  14)
  check                         the file's checks (also part of npm run check)
  set <path> <value>            one field, e.g. set birds.gull.count 18, set whale.every "40, 90",
                                set dolphins.seas "ring, south"
  add-bird <id> [--from id]     a new bird kind, a copy of another (default the first)
  remove-bird <id>
Writes ${LIFE_FILE} (add --dry to only print the check).`;

/** Writes the file when the checks pass; prints what was done and every problem. */
function report(doc: SeaLifeDoc, args: Args, did: string): number {
  const problems = lifeProblems(doc);
  const text = lifeText(doc);
  const write = !args.dry && !problems.length && readFileSync(LIFE_FILE, 'utf8') !== text;
  if (write) writeFileSync(LIFE_FILE, text);
  console.log(`${did}${args.dry ? ' (dry run)' : write ? ` (${LIFE_FILE} written)` : ''}`);
  for (const p of problems) console.log(`✗ ${p}`);
  if (problems.length && !args.dry) console.log('Not written: fix the problems above.');
  return problems.length ? 1 : 0;
}

function fail(message: string): number {
  console.log(message);
  return 1;
}

export function run(args: Args): number {
  const [cmd, a, b] = args._;
  if (args.help || !cmd) {
    console.log(HELP);
    return args.help ? 0 : 1;
  }
  const doc = shippedLifeDoc();
  if (cmd === 'check') {
    const problems = lifeProblems(doc);
    console.log(problems.length ? problems.map((p) => `✗ ${p}`).join('\n') : 'sea life ok');
    return problems.length ? 1 : 0;
  }
  if (cmd === 'list') {
    const rows = lifeFields(doc).map(({ path, kind }) => ({
      path,
      kind,
      value: lifeField(doc, path),
    }));
    if (args.json) console.log(JSON.stringify(rows, null, 2));
    else for (const r of rows) console.log(`${r.path}  ${r.value}`);
    return 0;
  }
  if (cmd === 'set') {
    if (!a || b === undefined) return fail('set <path> <value>');
    const problem = setLifeField(doc, a, String(b));
    return problem ? fail(problem) : report(doc, args, `${a} = ${lifeField(doc, a)}`);
  }
  if (cmd === 'add-bird' && a) {
    const problem = addBird(doc, a, typeof args.from === 'string' ? args.from : undefined);
    return problem ? fail(problem) : report(doc, args, `added bird kind ${a}`);
  }
  if (cmd === 'remove-bird' && a)
    return removeBird(doc, a) ? report(doc, args, `removed ${a}`) : fail(`no bird kind ${a}`);
  return fail(HELP);
}
