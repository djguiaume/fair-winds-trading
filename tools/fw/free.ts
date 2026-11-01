// `npm run free` (decisions 0153 and 0266): the Free Sailing presets from the command line, with
// the Free Sailing page's own edits (src/editor/freeSailing/doc.ts), checks and files. `walk`
// (the isolation proof in the real game) is run by free.mjs before this module loads.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import {
  type FreeSailingDoc,
  PRESET_FIELDS,
  addPreset,
  findPreset,
  freeProblems,
  presetFiles,
  removePreset,
  setPresetField,
  shippedFreeDoc,
} from '../../src/editor/freeSailing/doc';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const ROOT = 'src/data/free-sailing';
const HELP = `npm run free -- <command>   (the editors' Free Sailing page makes the same edits)
  list [--json]                     every preset: id, hour, weather, ship and upgrades, place
  check                             the presets' checks (also part of npm run check)
  add <id> [--from id]              a new preset, a copy of another (default the first)
  set <id> <field> <value>          one field: ${Object.keys(PRESET_FIELDS).join(', ')}
  remove <id>
  walk [--shots dir]                the real game: launch, change ships, pause, restart, refresh,
                                    go back; fails if the voyage's save or storage changed
Writes go to ${ROOT}/ (add --dry to only print the problems).`;

/** Writes the presets that changed and deletes the ones the doc no longer has. */
function writePresets(doc: FreeSailingDoc): number {
  const files = presetFiles(doc);
  const keep = new Set([...files.map((f) => f.path), 'rules.json']);
  let changed = 0;
  for (const { path, text } of files) {
    const full = `${ROOT}/${path}`;
    if (existsSync(full) && readFileSync(full, 'utf8') === text) continue;
    writeFileSync(full, text);
    changed++;
  }
  for (const f of readdirSync(ROOT))
    if (!keep.has(f)) {
      rmSync(`${ROOT}/${f}`);
      changed++;
    }
  return changed;
}

function report(doc: FreeSailingDoc, args: Args, did: string): number {
  const problems = freeProblems(doc);
  if (!args.dry && !problems.length) {
    const n = writePresets(doc);
    console.log(`${did} (${n} file${n === 1 ? '' : 's'} written)`);
  } else console.log(`${did}${args.dry ? ' (dry run)' : ''}`);
  for (const p of problems) console.log(`✗ ${p}`);
  if (problems.length && !args.dry)
    console.log('Not written: fix the problems above (or --dry to look).');
  return problems.length ? 1 : 0;
}

function fail(message: string): number {
  console.log(message);
  return 1;
}

export function run(args: Args): number {
  const [cmd, id, field, value] = args._;
  if (args.help || !cmd) {
    console.log(HELP);
    return args.help ? 0 : 1;
  }
  const doc = shippedFreeDoc();
  if (cmd === 'check') {
    const problems = freeProblems(doc);
    console.log(
      problems.length
        ? problems.map((p) => `✗ ${p}`).join('\n')
        : `${doc.presets.length} presets ok`,
    );
    return problems.length ? 1 : 0;
  }
  if (cmd === 'list') {
    if (args.json) console.log(JSON.stringify(doc.presets, null, 2));
    else
      for (const p of doc.presets)
        console.log(
          `${p.id}  ${p.hour} h ${p.weather}  ${p.ship.class} ${p.ship.sails}/${p.ship.hold}/${p.ship.hull}  at ${p.place.x},${p.place.y} heading ${p.place.headingDeg}`,
        );
    return 0;
  }
  if (!id) return fail(`${cmd} <id>`);
  if (cmd === 'add') {
    const added = addPreset(doc, id, typeof args.from === 'string' ? args.from : undefined);
    return typeof added === 'string' ? fail(added) : report(doc, args, `added ${id}`);
  }
  if (cmd === 'remove')
    return removePreset(doc, id) ? report(doc, args, `removed ${id}`) : fail(`no preset ${id}`);
  if (cmd === 'set') {
    if (!findPreset(doc, id)) return fail(`no preset ${id}`);
    if (!field || value === undefined) return fail('set <id> <field> <value>');
    const problem = setPresetField(doc, id, field, value);
    return problem ? fail(problem) : report(doc, args, `${id}: ${field} = ${value}`);
  }
  return fail(`unknown command "${cmd}"`);
}
