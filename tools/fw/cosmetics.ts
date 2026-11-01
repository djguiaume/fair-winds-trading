// `npm run cosmetics` (decisions 0153 and 0261): the boat cosmetic catalogue from the command line,
// with the Cosmetics page's own edits (src/editor/cosmetics/doc.ts), checks and files.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  type CosmeticsDoc,
  SLOT_FOLDERS,
  addItem,
  bundleText,
  catalogueFiles,
  cosmeticsProblems,
  find,
  importBundle,
  removeItem,
  setField,
  shippedCosmeticsDoc,
} from '../../src/editor/cosmetics/doc';
import { lookSvg } from '../../src/editor/cosmetics/preview';
import { APPEARANCE_SLOTS, type Appearance, type Item, type Slot } from '../../src/sim/cosmetics';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const ROOT = 'src/data/cosmetics';
const HELP = `npm run cosmetics -- <command>   (the Cosmetics page of the editors makes the same edits)
  list [slot] [--json]                      every item: slot/id, English name, unlock, classes
  check                                     the catalogue's checks (also part of npm run check)
  add <slot> <id> [--en "Name"] [--fr "Nom"] [--unlock free|quest:id|regatta:id|milestone:name]
                  [--classes sloop,cutter] [--svg file.svg] [--recipe prop-id --tris n]
                                            a new item (a figurehead needs its recipe)
  set <slot> <id> <path> <value>            one field: cloth, name.fr, colours "#a,#b", unlock.quest,
                                            own.bands, tris, recipe …  ("-" clears an optional one)
  remove <slot> <id>
  export [--out file.json]                  the whole catalogue as one bundle (items + emblem SVGs)
  import file.json                          items of a bundle replace or join the catalogue
  shot <slot> <id> [--class sloop] [--out dir]   the item on a boat, as SVG
  sheet [--slot s] [--class sloop] [--out dir]   every item on a boat in one SVG sheet
slots: ${SLOT_FOLDERS.join(', ')}
Writes go to ${ROOT}/ (add --dry to only print the problems).`;

/** Writes the files that changed and deletes the ones the catalogue no longer has. */
function writeCatalogue(doc: CosmeticsDoc): number {
  const files = catalogueFiles(doc);
  const keep = new Set(files.map((f) => f.path));
  let changed = 0;
  for (const { path, text } of files) {
    const full = `${ROOT}/${path}`;
    if (existsSync(full) && readFileSync(full, 'utf8') === text) continue;
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
    changed++;
  }
  for (const folder of SLOT_FOLDERS) {
    if (!existsSync(`${ROOT}/${folder}`)) continue;
    for (const f of readdirSync(`${ROOT}/${folder}`))
      if (!keep.has(`${folder}/${f}`)) {
        rmSync(`${ROOT}/${folder}/${f}`);
        changed++;
      }
  }
  return changed;
}

function parseUnlock(text: string): Item['unlock'] | null {
  if (text === 'free') return { kind: 'free' };
  const [kind, id] = text.split(':');
  return id && ['quest', 'regatta', 'milestone'].includes(kind!)
    ? ({ kind: 'earned', [kind!]: id } as Item['unlock'])
    : null;
}

const unlockText = (u: Item['unlock']) =>
  u.kind === 'free'
    ? 'free'
    : `earned ${u.quest ? `quest:${u.quest}` : u.regatta ? `regatta:${u.regatta}` : `milestone:${u.milestone}`}`;

function report(doc: CosmeticsDoc, args: Args, did: string): number {
  const problems = cosmeticsProblems(doc);
  if (!args.dry && !problems.length) {
    const n = writeCatalogue(doc);
    console.log(`${did} (${n} file${n === 1 ? '' : 's'} written)`);
  } else console.log(`${did}${args.dry ? ' (dry run)' : ''}`);
  for (const p of problems) console.log(`✗ ${p}`);
  if (problems.length && !args.dry)
    console.log('Not written: fix the problems above (or --dry to look).');
  return problems.length ? 1 : 0;
}

const slotOf = (s: string | undefined): Slot | 'set' | null =>
  SLOT_FOLDERS.find((x) => x === s) ?? null;

function sheet(doc: CosmeticsDoc, args: Args): string {
  const shipClass = typeof args.class === 'string' ? args.class : 'sloop';
  const items = doc.items.filter((i) => i.slot !== 'set' && (!args.slot || i.slot === args.slot));
  const cell = (i: Item, n: number) => {
    const slot = i.slot as Slot;
    const key = Object.entries(APPEARANCE_SLOTS).find(
      ([, s]) => s === slot,
    )![0] as keyof Appearance;
    const svg = lookSvg(doc, { [key]: i.id }, shipClass).replace(
      '<svg ',
      `<svg x="${(n % 4) * 210}" y="${Math.floor(n / 4) * 176}" `,
    );
    return `${svg}<text x="${(n % 4) * 210 + 4}" y="${Math.floor(n / 4) * 176 + 166}" font-size="11" font-family="sans-serif" fill="#22252a">${i.id} · ${i.unlock.kind}</text>`;
  };
  const rows = Math.ceil(items.length / 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${rows * 176}" viewBox="0 0 840 ${rows * 176}"><rect width="840" height="${rows * 176}" fill="#f4f1e8"/>${items.map(cell).join('')}</svg>\n`;
}

export function run(args: Args): number {
  const [cmd, slotArg, id, path, value] = args._;
  if (args.help || !cmd) {
    console.log(HELP);
    return args.help ? 0 : 1;
  }
  const doc = shippedCosmeticsDoc();
  if (cmd === 'check') {
    const problems = cosmeticsProblems(doc);
    console.log(
      problems.length ? problems.map((p) => `✗ ${p}`).join('\n') : `${doc.items.length} items ok`,
    );
    return problems.length ? 1 : 0;
  }
  if (cmd === 'list') {
    const rows = doc.items.filter((i) => !slotArg || i.slot === slotArg);
    if (args.json)
      console.log(
        JSON.stringify(
          rows.map((i) => ({ slot: i.slot, id: i.id, name: i.name.en, unlock: i.unlock })),
          null,
          2,
        ),
      );
    else
      for (const i of rows)
        console.log(
          `${i.slot}/${i.id}  ${i.name.en}  ${unlockText(i.unlock)}${'classes' in i && i.classes ? `  [${i.classes.join(',')}]` : ''}`,
        );
    return 0;
  }
  if (cmd === 'export') {
    if (typeof args.out === 'string') writeFileSync(args.out, bundleText(doc));
    else console.log(bundleText(doc));
    return 0;
  }
  if (cmd === 'import') {
    if (!slotArg || !existsSync(slotArg)) return fail('import <file.json>');
    const problem = importBundle(doc, readFileSync(slotArg, 'utf8'));
    return problem ? fail(problem) : report(doc, args, `imported ${slotArg}`);
  }
  if (cmd === 'sheet') {
    const dir = typeof args.out === 'string' ? args.out : 'shots/cosmetics';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/sheet.svg`, sheet(doc, args));
    console.log(`${dir}/sheet.svg`);
    return 0;
  }
  const slot = slotOf(slotArg);
  if (!slot || !id) return fail(`${cmd} <slot> <id>   (slots: ${SLOT_FOLDERS.join(', ')})`);
  if (cmd === 'add') return addCommand(doc, slot, id, args);
  const item = find(doc, slot, id);
  if (cmd === 'remove')
    return removeItem(doc, slot, id)
      ? report(doc, args, `removed ${slot}/${id}`)
      : fail(`no ${slot}/${id}`);
  if (!item) return fail(`no ${slot}/${id}`);
  if (cmd === 'set') {
    if (!path || value === undefined) return fail('set <slot> <id> <path> <value>');
    const problem = setField(item, path, value);
    return problem ? fail(problem) : report(doc, args, `${slot}/${id}: ${path} = ${value}`);
  }
  if (cmd === 'shot') {
    const key = Object.entries(APPEARANCE_SLOTS).find(([, s]) => s === slot)?.[0];
    if (!key) return fail('shot shows one item of a slot, not a set');
    const dir = typeof args.out === 'string' ? args.out : 'shots/cosmetics';
    mkdirSync(dir, { recursive: true });
    const shipClass = typeof args.class === 'string' ? args.class : 'sloop';
    writeFileSync(`${dir}/${id}.svg`, lookSvg(doc, { [key]: id }, shipClass));
    console.log(`${dir}/${id}.svg`);
    return 0;
  }
  return fail(`unknown command "${cmd}"`);
}

function addCommand(doc: CosmeticsDoc, slot: Slot | 'set', id: string, args: Args): number {
  const item = addItem(doc, slot, id);
  if (typeof item === 'string') return fail(item);
  if (typeof args.en === 'string') item.name.en = args.en;
  if (typeof args.fr === 'string') item.name.fr = args.fr;
  if (typeof args.unlock === 'string') {
    const u = parseUnlock(args.unlock);
    if (!u) return fail('--unlock free|quest:id|regatta:id|milestone:name');
    item.unlock = u;
  }
  if (typeof args.classes === 'string' && item.slot !== 'set')
    item.classes = args.classes.split(',');
  if (item.slot === 'figurehead') {
    if (typeof args.recipe === 'string') item.recipe = args.recipe;
    if (typeof args.tris === 'string') item.tris = Number(args.tris);
  }
  if (typeof args.svg === 'string') {
    if (slot !== 'sail-logo' || !existsSync(args.svg))
      return fail('--svg file.svg goes with a sail-logo');
    doc.logos[id] = readFileSync(args.svg, 'utf8');
  }
  return report(doc, args, `added ${slot}/${id}`);
}

function fail(message: string): number {
  console.log(message);
  return 1;
}
