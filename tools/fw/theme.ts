// `npm run theme` (decisions 0153 and 0269): list, set, check, export and import the UI theme's
// tokens, with the editors' Theme page's own module (src/editor/theme/doc.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import {
  THEME_FILE,
  findToken,
  groupOf,
  parseTheme,
  setToken,
  shippedTheme,
  themeProblems,
  themeText,
  tokens,
} from '../../src/editor/theme/doc';
import { type Theme, themeCss } from '../../src/ui/theme/model';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const HELP = `npm run theme -- <command>   (the editors' Theme page makes the same edits)
  list [group] [--json]          every token: path, value (group: colour, type, legacy.root…)
  set <token> <value>            one token, e.g. set colour.sage "#4a6d41", set duration.base 200
  check                          the theme's rules (also part of npm run check)
  export [--css] [--out file]    the theme file (or, with --css, the custom properties it makes)
  import <file>                  a theme file (a Theme page export) replaces ${THEME_FILE}
Writes go to ${THEME_FILE} (add --dry to only print the problems).`;

function report(theme: Theme, args: Args, did: string): number {
  const problems = themeProblems(theme);
  const write = !args.dry && !problems.length;
  if (write) writeFileSync(THEME_FILE, themeText(theme));
  console.log(`${did}${write ? ` (${THEME_FILE} written)` : args.dry ? ' (dry run)' : ''}`);
  for (const p of problems) console.log(`✗ ${p}`);
  if (problems.length && !args.dry) console.log('Not written: fix the problems above.');
  return problems.length ? 1 : 0;
}

function list(theme: Theme, group: string | undefined, json: boolean): number {
  const rows = tokens(theme).filter((t) => !group || groupOf(t.path) === group);
  if (!rows.length) return fail(`no tokens in ${group}`);
  if (json) console.log(JSON.stringify(rows, null, 2));
  else for (const t of rows) console.log(`${t.path}  ${String(t.value).slice(0, 90)}`);
  return 0;
}

function fail(message: string): number {
  console.log(message);
  return 1;
}

export function run(args: Args): number {
  const [cmd, path, value] = args._;
  if (args.help || !cmd) {
    console.log(HELP);
    return args.help ? 0 : 1;
  }
  const theme = shippedTheme();
  switch (cmd) {
    case 'list':
      return list(theme, path, Boolean(args.json));
    case 'check': {
      const problems = themeProblems(theme);
      console.log(
        problems.length
          ? problems.map((p) => `✗ ${p}`).join('\n')
          : `${tokens(theme).length} tokens ok`,
      );
      return problems.length ? 1 : 0;
    }
    case 'set': {
      if (!path || value === undefined) return fail('usage: set <token> <value>');
      const before = findToken(theme, path)?.value;
      const problem = setToken(theme, path, value);
      return problem ? fail(problem) : report(theme, args, `${path}: ${before} → ${value}`);
    }
    case 'export': {
      const text = args.css ? themeCss(theme) : themeText(theme);
      if (typeof args.out === 'string') {
        writeFileSync(args.out, text);
        console.log(`wrote ${args.out}`);
      } else process.stdout.write(text);
      return 0;
    }
    case 'import': {
      if (!path) return fail('usage: import <file>');
      const parsed = parseTheme(readFileSync(path, 'utf8'));
      return typeof parsed === 'string' ? fail(parsed) : report(parsed, args, `imported ${path}`);
    }
    default:
      return fail(HELP);
  }
}
