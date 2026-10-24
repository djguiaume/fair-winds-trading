// `npm run quest` (decision 0153): the quest builder's checks on one quest, and its "Play from
// step" link, with screenshots of that test through `npm run shots`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMapShape } from '../../src/data/editedMap';
import { PHASE1_MAP, prepareMap } from '../../src/data/maps';
import {
  type QuestDoc,
  playUrl,
  questProblems,
  seaStart,
  stepPort,
} from '../../src/editor/quest/doc';
import type { MapDef } from '../../src/sim/map';
import { clearAt } from '../../src/sim/mapChecks';
import { QUESTS, type QuestDef } from '../../src/sim/quests';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const PAGES = 'https://djguiaume.github.io/fair-winds-trading/';

export const HELP = `npm run quest -- <command> [options]

  list                          every quest: id, steps, start
  check <id> [<id> …]           the quest builder's checks on these quests (all with no id)
  play <id> --step N|step-id    the "Play from step" link: a fresh Captain voyage at that step
       --port id | --sea | --at x,y --heading deg
                                start docked (default: the step's port), at sea near the
                                step's place (as the builder does), or there
       --shots                  screenshots of the test (npm run shots options apply: --sizes,
                                --wait, --lang, --cards, --out, --name)
Options
  --file quest.json             a quest file to use instead of (or besides) the shipped one
  --map file.json               a map editor export instead of the ring
  --json                        detail as JSON
`;

/** The shipped quests, with the quest files given on the command line in place of theirs. */
export function questDoc(files: string[] = []): QuestDoc {
  const quests = structuredClone(QUESTS) as QuestDef[];
  for (const f of files) {
    const q = JSON.parse(readFileSync(resolve(f), 'utf8')) as QuestDef;
    const at = quests.findIndex((x) => x.id === q.id);
    if (at >= 0) quests[at] = q;
    else quests.push(q);
  }
  return { quests, text: { en: {}, fr: {} } };
}

/** The builder's problems that concern these quests (theirs, and hooks naming them). */
export function problemsOf(doc: QuestDoc, map: MapDef, ids: string[]): string[] {
  const all = questProblems(doc, map);
  if (!ids.length) return all;
  return all.filter((m) =>
    ids.some(
      (id) =>
        m.startsWith(`quest ${id}:`) || m.startsWith(`quest ${id} ›`) || m.includes(`"${id}"`),
    ),
  );
}

export interface QuestPlay {
  quest: string;
  step: string;
  start: { port: string } | { x: number; y: number; headingDeg: number };
  /** The game's address, relative (`./?map=edited&quest=…`). */
  path: string;
}

/** Where and how to play a quest from a step, like the builder's "Play from step" card. */
export function questPlay(
  doc: QuestDoc,
  map: MapDef,
  id: string,
  opts: { step?: string; port?: string; sea?: boolean; at?: [number, number]; heading?: number },
): QuestPlay | string {
  const q = doc.quests.find((x) => x.id === id);
  if (!q) return `no quest "${id}"`;
  const n = Number(opts.step);
  const step =
    opts.step === undefined
      ? q.steps[0]
      : Number.isInteger(n) && n >= 1
        ? q.steps[n - 1]
        : q.steps.find((s) => s.id === opts.step);
  if (!step) return `quest ${id} has no step ${opts.step} (${q.steps.map((s) => s.id).join(', ')})`;
  let start: QuestPlay['start'];
  if (opts.at) start = { x: opts.at[0], y: opts.at[1], headingDeg: opts.heading ?? 0 };
  else if (opts.sea) {
    const sea = seaStart(step, map, (x, y) => clearAt(map, x, y, 4));
    if (!sea) return `step ${step.id} has no place at sea to start near; use --port or --at`;
    start = sea;
  } else {
    const port = opts.port ?? stepPort(q, step, map);
    if (!map.ports.some((p) => p.id === port)) return `no port "${port}" on this map`;
    start = { port };
  }
  return { quest: q.id, step: step.id, start, path: playUrl(q.id, step.id, start) };
}

function loadMap(file: string | undefined): MapDef {
  if (!file) return PHASE1_MAP;
  const raw: unknown = JSON.parse(readFileSync(resolve(file), 'utf8'));
  if (!isMapShape(raw)) throw new Error(`${file}: not a map file`);
  return prepareMap(raw);
}

const files = (v: unknown) => (typeof v === 'string' ? v.split(',').filter(Boolean) : []);

export async function run(args: Args): Promise<number> {
  const [cmd, ...ids] = args._;
  if (args.help || !cmd) {
    console.log(HELP);
    return cmd || args.help ? 0 : 1;
  }
  const doc = questDoc(files(args.file));
  const map = loadMap(typeof args.map === 'string' ? args.map : undefined);

  if (cmd === 'list') {
    const rows = doc.quests.map((q) => ({
      id: q.id,
      steps: q.steps.length,
      start: q.start.is ?? '',
      port: q.port ?? '',
    }));
    if (args.json) console.log(JSON.stringify(rows, null, 2));
    else
      for (const r of rows)
        console.log(
          `${r.id.padEnd(24)} ${String(r.steps).padStart(2)} steps  ${r.start} ${r.port}`,
        );
    return 0;
  }

  if (cmd === 'check') {
    const unknown = ids.filter((id) => !doc.quests.some((q) => q.id === id));
    if (unknown.length) {
      console.log(`no quest ${unknown.map((u) => `"${u}"`).join(', ')}`);
      return 1;
    }
    const problems = problemsOf(doc, map, ids);
    if (args.json) console.log(JSON.stringify(problems, null, 2));
    else {
      for (const p of problems) console.log(p);
      const what = ids.length ? ids.join(', ') : `${doc.quests.length} quests`;
      console.log(problems.length ? `${problems.length} problem(s) in ${what}` : `ok: ${what}`);
    }
    return problems.length ? 1 : 0;
  }

  if (cmd === 'play') {
    const id = ids[0];
    if (!id) {
      console.log('quest play <id> --step N');
      return 1;
    }
    const at =
      typeof args.at === 'string'
        ? (args.at.split(',').map(Number) as [number, number])
        : undefined;
    const play = questPlay(doc, map, id, {
      step: typeof args.step === 'string' ? args.step : undefined,
      port: typeof args.port === 'string' ? args.port : undefined,
      sea: !!args.sea,
      at,
      heading: args.heading !== undefined ? Number(args.heading) : undefined,
    });
    if (typeof play === 'string') {
      console.log(play);
      return 1;
    }
    const link = PAGES + play.path.slice(2);
    if (!args.shots) {
      if (args.json) console.log(JSON.stringify({ ...play, link }, null, 2));
      else console.log(`${play.quest} › ${play.step}: ${play.path}\n${link}`);
      return 0;
    }
    // The test needs the quests and the map it was built from in the browser, as the builder
    // leaves them (`?map=edited`): only when they differ from the shipped ones.
    const storage: Record<string, string> = {};
    if (files(args.file).length) storage['fwt.editor.quests.v1'] = JSON.stringify(doc);
    const shots = await import('./shots.mjs');
    const shot = shots.normalise({
      ...args,
      _: undefined,
      at: undefined,
      port: undefined,
      sea: typeof args.map === 'string' ? args.map : 'ring',
      url: play.path,
      // A quest that is not `main` speaks on the harbour screen's Quay tab (decision 0141).
      tab: typeof args.tab === 'string' ? args.tab : 'port' in play.start ? 'quay' : undefined,
      storage,
      name: typeof args.name === 'string' ? args.name : `${play.quest}-${play.step}`,
    });
    const out = resolve(typeof args.out === 'string' ? args.out : 'shots');
    const written = await shots.takeShots([shot], out);
    if (args.json) console.log(JSON.stringify({ ...play, link, files: written }, null, 2));
    else console.log(`${play.quest} › ${play.step}: ${written.length} shot(s) in ${out}\n${link}`);
    return 0;
  }

  console.log(`unknown command "${cmd}"\n${HELP}`);
  return 1;
}
