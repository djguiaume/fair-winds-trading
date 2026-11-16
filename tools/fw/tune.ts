// `npm run tune` (decisions 0153 and 0268): the tuning files' numbers from the command line, with
// the ?tune panel's own ranges (src/data/tuning-meta*.ts) shared through src/tune/tuningDoc.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { formatJson } from '../../src/data/jsonFormat';
import { SHIPPED_TUNING } from '../../src/data/tuning';
import { parseValue, tuningRows, valueProblem, withValue } from '../../src/tune/tuningDoc';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const HELP = `npm run tune -- <command>   (the ?tune panel edits the same numbers)
  list <file> [--json]           every value of src/data/tuning/<file>.json: path, value, range
  set <file.path> <value>        one number (checked against its range), a toggle (true/false) or text, e.g. set hud.idleFadeSec 8, set graphics.title.live true, set graphics.sky.looks.day.horizon '#7fc0e6'
Add --dry to only print the check.`;

const fileOf = (name: string) => `src/data/tuning/${name}.json`;

export function run(args: Args): number {
  const [cmd, a, b] = args._;
  if (args.help || !cmd) {
    console.log(HELP);
    return args.help ? 0 : 1;
  }
  if (cmd === 'list' && a) {
    const rows = tuningRows(SHIPPED_TUNING as never, a);
    if (!rows.length) return fail(`no tuning file ${a}`);
    if (args.json) console.log(JSON.stringify(rows, null, 2));
    else
      for (const r of rows)
        console.log(`${r.path}  ${JSON.stringify(r.value)}  ${r.range}  ${r.label}`);
    return 0;
  }
  if (cmd === 'set' && a && b !== undefined) {
    const value = parseValue(b);
    const problem = valueProblem(a, value);
    if (problem) return fail(problem);
    const file = fileOf(a.split('.')[0]!);
    const next = withValue(JSON.parse(readFileSync(file, 'utf8')), a, value);
    if (!args.dry) writeFileSync(file, formatJson(next));
    console.log(`${a} = ${b}${args.dry ? ' (dry run)' : ` (${file} written)`}`);
    return 0;
  }
  return fail(HELP);
}

function fail(message: string): number {
  console.log(message);
  return 1;
}
