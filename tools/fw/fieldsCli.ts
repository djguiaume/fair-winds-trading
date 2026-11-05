// The command of a small data file (decision 0153): the editors' data page's own fields, edits
// and checks (src/editor/fieldsDoc.ts), shared by `npm run life` and `npm run folk`.
import { readFileSync, writeFileSync } from 'node:fs';
import {
  type FieldsDoc,
  addKind,
  docField,
  docFields,
  removeKind,
  setDocField,
} from '../../src/editor/fieldsDoc';

export type Args = Record<string, string | boolean | undefined> & { _: string[] };

const help = <Doc extends object>(
  spec: FieldsDoc<Doc>,
) => `npm run ${spec.tool} -- <command>   (the editors' ${spec.about} page makes the same edits)
  list [--json]                 every field: path and value (${docFields(spec.shipped())[1]?.path ?? 'a.b'}  1)
  check                         the file's checks (also part of npm run check)
  set <path> <value>            one field: a number, a word, "low, high" or "a, b, c"
  add-kind <id> [--from id]     a new ${spec.kinds.name}, a copy of another (default the first)
  remove-kind <id>
Writes ${spec.file} (add --dry to only print the check).`;

/** Writes the file when the checks pass; prints what was done and every problem. */
function report<Doc extends object>(spec: FieldsDoc<Doc>, doc: Doc, args: Args, did: string) {
  const problems = spec.problems(doc);
  const text = spec.text(doc);
  const write = !args.dry && !problems.length && readFileSync(spec.file, 'utf8') !== text;
  if (write) writeFileSync(spec.file, text);
  console.log(`${did}${args.dry ? ' (dry run)' : write ? ` (${spec.file} written)` : ''}`);
  for (const p of problems) console.log(`✗ ${p}`);
  if (problems.length && !args.dry) console.log('Not written: fix the problems above.');
  return problems.length ? 1 : 0;
}

function fail(message: string): number {
  console.log(message);
  return 1;
}

/** Runs a data file's command: list, check, set, add-kind, remove-kind. */
export function runFieldsCli<Doc extends object>(spec: FieldsDoc<Doc>, args: Args): number {
  const [cmd, a, b] = args._;
  if (args.help || !cmd) {
    console.log(help(spec));
    return args.help ? 0 : 1;
  }
  const doc = spec.shipped();
  if (cmd === 'check') {
    const problems = spec.problems(doc);
    console.log(
      problems.length ? problems.map((p) => `✗ ${p}`).join('\n') : `${spec.about.toLowerCase()} ok`,
    );
    return problems.length ? 1 : 0;
  }
  if (cmd === 'list') {
    const rows = docFields(doc).map(({ path, kind }) => ({
      path,
      kind,
      value: docField(doc, path),
    }));
    if (args.json) console.log(JSON.stringify(rows, null, 2));
    else for (const r of rows) console.log(`${r.path}  ${r.value}`);
    return 0;
  }
  if (cmd === 'set') {
    if (!a || b === undefined) return fail('set <path> <value>');
    const problem = setDocField(doc, a, String(b), spec.tool);
    return problem ? fail(problem) : report(spec, doc, args, `${a} = ${docField(doc, a)}`);
  }
  if (cmd === 'add-kind' && a) {
    const problem = addKind(spec, doc, a, typeof args.from === 'string' ? args.from : undefined);
    return problem ? fail(problem) : report(spec, doc, args, `added ${spec.kinds.name} ${a}`);
  }
  if (cmd === 'remove-kind' && a)
    return removeKind(spec, doc, a)
      ? report(spec, doc, args, `removed ${a}`)
      : fail(`no ${spec.kinds.name} ${a}`);
  return fail(help(spec));
}
