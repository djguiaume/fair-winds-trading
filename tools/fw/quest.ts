// `npm run quest` (decision 0153): the quest builder's checks on one quest, and its "Play from
// step" link, with screenshots of that test through `npm run shots`. Since decision 0164 it also
// changes a quest's own sea with the builder's edits (doc.ts): where a step takes the boat, the
// quest's buoys and its held wind, and writes the file the way the builder exports it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMapShape } from '../../src/data/editedMap';
import { GAME_MAP, prepareMap } from '../../src/data/maps';
import {
  type QuestDoc,
  addQuestMark,
  addRaceMark,
  moveRaceMark,
  raceGoal,
  removeRaceMark,
  setRaceLine,
  setRacePars,
  playUrl,
  questFileText,
  questProblems,
  removeQuestMark,
  seaStart,
  setStepMove,
  setWind,
  stepPort,
} from '../../src/editor/quest/doc';
import { type MapDef, SEA_MARK_TYPES, type SeaMarkType } from '../../src/sim/map';
import { clearAt } from '../../src/sim/mapChecks';
import type { Condition } from '../../src/sim/questLibrary';
import { QUESTS, type QuestDef } from '../../src/sim/quests';
import { racePars } from '../../src/sim/raceBot';
import { STORM_HELP, stormEdit } from './raceStorm';
import {
  flagsText,
  isFlagShape,
  regattaProblems,
  regattaText,
  removeFlag,
  setFlag,
  setRule,
  setSeries,
  shippedRegattaDoc,
} from '../../src/editor/regatta/doc';
import { MEDALS, medalTimes, seriesById } from '../../src/sim/regatta';
import { DIFFICULTIES } from '../../src/sim/difficulty';
import { SHIP_IDS } from '../../src/sim/ship';

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

The quest's own sea (decision 0164), with the builder's edits; writes the quest file, checks it:
  move <id> --step N|step-id --at x,y [--heading deg]   where the step takes the boat as it begins
  move <id> --step N --clear
  buoy <id> --at x,y [--name A] [--type buoy-yellow|buoy-red|…]   a mark shown while it runs
  buoy <id> <n> --at x,y | --name B | --type …           change mark n (1 = first)
  buoy <id> <n> --remove
  wind <id> [--step N] --speed kn [--from deg]           a held breeze (the quest's, or a step's)
  wind <id> [--step N] --clear
       --dry                    write nothing, print what would change

Races of the Saltmere Regatta (decision 0217; also \`npm run race -- …\`):
  race                          every race: series, marks, pars
  race <id>                     its course and each medal's time per ship class
  race <id> --pars [--write]    the balance bots sail it with every ship class on all three
       [--ships sloop,cutter]   levels (pinned wind, each level's currents): the pars
  race --all --pars --write     every race
  race <id> --start "x,y x,y"   the start line: committee boat's end, then the pin's
  race <id> --finish "x,y x,y"  the finish line
  race <id> --add --at x,y [--after N]   a mark (numbered in order), after mark N
  race <id> --mark N --at x,y | --remove move or remove mark N (1 = first)
${STORM_HELP}
  race rules                    regatta.json and flags.json: the rules, Kestrel, series, flags
  race set <path> <value>       a value of regatta.json, e.g. set medals.silver 1.2,
                                set rival.hull "#f4f1e8", set rival.paceRange 0.45,1.4
  race series <id> [--name "…"] [--pennant flag]   a series (a new id adds one)
  race flag <id> [--shape pennant|swallowtail|burgee] [--bands "#a,#b"] [--length n]
                 [--height n] | --remove        a flag (a new id adds one)
                                (the editor's Regatta page makes the same edits; --dry)
  race <id> --overlay file.json writes the course as a chart overlay and prints the view:
                                npm run chart -- --overlay file.json --view w,s,e,n
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
  if (!file) return GAME_MAP;
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
      // A standing order asks again (decision 0214).
      ...(q.repeat ? { standing: true } : {}),
    }));
    if (args.json) console.log(JSON.stringify(rows, null, 2));
    else
      for (const r of rows)
        console.log(
          `${r.id.padEnd(24)} ${String(r.steps).padStart(2)} ${r.standing ? 'asks ' : 'steps'}  ${r.start} ${r.port}${r.standing ? ' (standing order)' : ''}`,
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

  if (cmd === 'move' || cmd === 'buoy' || cmd === 'wind') return edit(cmd, ids, args, doc, map);
  if (cmd === 'race') return race(ids, args, doc, map);

  console.log(`unknown command "${cmd}"\n${HELP}`);
  return 1;
}

const xy = (v: unknown) => {
  const p = typeof v === 'string' ? v.split(',').map(Number) : [];
  return p.length === 2 && p.every(Number.isFinite) ? { x: p[0]!, y: p[1]! } : null;
};
const num = (v: unknown) => (typeof v === 'string' && v !== '' ? Number(v) : undefined);

/** `move`, `buoy` and `wind`: one edit to a quest file, then its checks, one line. */
function edit(cmd: string, ids: string[], args: Args, doc: QuestDoc, map: MapDef): number {
  const [id, which] = ids;
  const q = doc.quests.find((x) => x.id === id);
  if (!q) {
    console.log(id ? `no quest "${id}"` : `quest ${cmd} <id> …`);
    return 1;
  }
  const stepOf = () => {
    const n = Number(args.step);
    const step =
      Number.isInteger(n) && n >= 1 ? q.steps[n - 1] : q.steps.find((s) => s.id === args.step);
    if (!step)
      throw new Error(
        `quest ${id} has no step ${String(args.step)} (${q.steps.map((s) => s.id).join(', ')})`,
      );
    return step;
  };
  const type = args.type;
  if (typeof type === 'string' && !(SEA_MARK_TYPES as readonly string[]).includes(type)) {
    console.log(`--type is one of ${SEA_MARK_TYPES.join(', ')}`);
    return 1;
  }
  let said: string;
  try {
    if (cmd === 'move') {
      const step = stepOf();
      const at = xy(args.at);
      if (!args.clear && !at)
        throw new Error('quest move <id> --step N --at x,y [--heading deg] (or --clear)');
      setStepMove(step, args.clear ? null : at, num(args.heading) ?? step.moveTo?.headingDeg);
      said = step.moveTo
        ? `${id} › ${step.id} takes the boat to ${step.moveTo.x},${step.moveTo.y}${step.moveTo.headingDeg === undefined ? '' : ` heading ${step.moveTo.headingDeg}°`}`
        : `${id} › ${step.id} no longer moves the boat`;
    } else if (cmd === 'buoy') {
      if (which === undefined) {
        const at = xy(args.at);
        if (!at) throw new Error('quest buoy <id> --at x,y [--name A --type buoy-yellow]');
        const name = typeof args.name === 'string' ? args.name : undefined;
        const i = addQuestMark(q, at, (type as SeaMarkType | undefined) ?? 'buoy-yellow', name);
        said = `${id}: mark ${i + 1} (${q.marks![i]!.type}${name ? ` ${name}` : ''}) at ${q.marks![i]!.x},${q.marks![i]!.y}`;
      } else {
        const i = Number(which) - 1;
        const mark = q.marks?.[i];
        if (!mark) throw new Error(`quest ${id} has ${q.marks?.length ?? 0} mark(s)`);
        if (args.remove) {
          removeQuestMark(q, i);
          said = `${id}: mark ${i + 1} removed`;
        } else {
          const at = xy(args.at);
          if (at) Object.assign(mark, { x: at.x, y: at.y });
          if (typeof args.name === 'string') mark.name = args.name;
          if (typeof type === 'string') mark.type = type as SeaMarkType;
          said = `${id}: mark ${i + 1} (${mark.type}${mark.name ? ` ${mark.name}` : ''}) at ${mark.x},${mark.y}`;
        }
      }
    } else {
      const target = args.step === undefined ? q : stepOf();
      const where = args.step === undefined ? id : `${id} › ${(target as { id: string }).id}`;
      const speed = num(args.speed);
      if (!args.clear && speed === undefined)
        throw new Error('quest wind <id> [--step N] --speed kn [--from deg] (or --clear)');
      setWind(target, args.clear ? undefined : speed, num(args.from));
      said = target.wind
        ? `${where} holds ${target.wind.speedKn} kn${target.wind.fromDeg === undefined ? '' : ` from ${target.wind.fromDeg}°`}`
        : `${where}: no held wind`;
    }
  } catch (e) {
    console.log((e as Error).message);
    return 1;
  }
  const problems = problemsOf(doc, map, [q.id]);
  const given = files(args.file).find((f) => {
    try {
      return (JSON.parse(readFileSync(resolve(f), 'utf8')) as QuestDef).id === q.id;
    } catch {
      return false;
    }
  });
  const path = resolve(given ?? `src/data/quests/${q.id}.json`);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  const text = questFileText(q, before);
  if (!args.dry && text !== before) writeFileSync(path, text);
  if (args.json)
    console.log(
      JSON.stringify(
        { quest: q.id, change: said, file: path, written: !args.dry && text !== before, problems },
        null,
        2,
      ),
    );
  else {
    for (const p of problems) console.log(p);
    console.log(
      `${said}${args.dry ? ' (dry run)' : ''} · ${problems.length ? `${problems.length} problem(s)` : 'checks ok'}`,
    );
  }
  return problems.length ? 1 : 0;
}

const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Writes a quest file the way the builder exports it; whether it changed. */
function writeQuest(q: QuestDef, args: Args): boolean {
  const path = resolve(`src/data/quests/${q.id}.json`);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  const text = questFileText(q, before);
  if (args.dry || text === before) return false;
  writeFileSync(path, text);
  return true;
}

/** `race`: the regatta's courses, their pars from the bots, and the builder's course edits. */
function race(ids: string[], args: Args, doc: QuestDoc, map: MapDef): number {
  if (['rules', 'set', 'series', 'flag'].includes(ids[0] ?? '')) return regattaFiles(ids, args);
  const races = doc.quests.filter((q) => q.race);
  const [id] = ids;
  if (!id && !args.all) {
    for (const q of races) {
      const goal = raceGoal(q);
      const classes = Object.keys(q.race!.pars).length;
      console.log(
        `${q.id.padEnd(18)} ${q.race!.series.padEnd(13)} ${String((goal?.marks as unknown[])?.length ?? 0).padStart(2)} marks  pars for ${classes}/${SHIP_IDS.length} ships  at ${q.port ?? ''}`,
      );
    }
    return 0;
  }
  const chosen = args.all ? races : races.filter((q) => q.id === id);
  if (!chosen.length) {
    console.log(`no race "${id}" (${races.map((q) => q.id).join(', ')})`);
    return 1;
  }
  if (args.pars) {
    const ships = typeof args.ships === 'string' ? args.ships.split(',').filter(Boolean) : SHIP_IDS;
    let bad = 0;
    const out: Record<string, unknown> = {};
    for (const q of chosen) {
      const { pars, runs, estimated } = racePars(map, q, ships);
      const lost = runs.filter((r) => r.sec === null || r.stuck);
      // A big hull the bots could not get round has an estimated par; the smallest must finish.
      if (lost.some((r) => r.ship === 'sloop' || r.ship === 'cutter')) bad++;
      out[q.id] = { pars, lost, estimated };
      if (!args.json) {
        console.log(`${q.id}: ${DIFFICULTIES.join(' / ')}`);
        for (const ship of ships)
          console.log(
            `  ${ship.padEnd(9)} ${DIFFICULTIES.map((l) => (pars[ship]?.[l] ? fmt(pars[ship][l]!) : '  —')).join('  ')}${estimated.includes(ship) ? '  (estimated by speed: the bot did not get round)' : ''}`,
          );
        for (const r of lost)
          console.log(
            `  ${r.ship} on ${r.difficulty}${r.storms ? '' : ' (storms off)'}: ${r.sec === null ? 'did not finish' : `gave up ${r.stuck} mark(s)`} (route points given up: ${r.gaveUp.join(', ') || 'none'}; 0 the start, last the finish; legs at ${r.legs.join(', ')} s)`,
          );
      }
      if (args.write) {
        // A partial run keeps the other classes' pars.
        setRacePars(q, { ...q.race!.pars, ...pars });
        writeQuest(q, args);
      }
    }
    if (args.json) console.log(JSON.stringify(out, null, 2));
    console.log(
      `${chosen.length} race(s) sailed${args.write && !args.dry ? ', pars written' : ''}${bad ? ` · ${bad} race(s) the sloop or cutter could not sail` : ''}`,
    );
    return bad ? 1 : 0;
  }
  const q = chosen[0]!;
  const pts = (v: unknown) => {
    const p = typeof v === 'string' ? v.split(/[\s;]+/).map(xy) : [];
    return p.length === 2 && p[0] && p[1] ? (p as { x: number; y: number }[]) : null;
  };
  let said = '';
  if (typeof args.start === 'string' || typeof args.finish === 'string') {
    for (const which of ['start', 'finish'] as const) {
      if (args[which] === undefined) continue;
      const line = pts(args[which]);
      if (!line) {
        console.log(`--${which} "x,y x,y" (the committee boat's end, then the pin's)`);
        return 1;
      }
      setRaceLine(q, which, line[0]!, line[1]!);
      said += `${q.id}: ${which} line ${line.map((p) => `${p.x},${p.y}`).join(' to ')}. `;
    }
  } else if (args.storm !== undefined) {
    const result = stormEdit(q, args);
    if ('error' in result) {
      console.log(result.error);
      return 1;
    }
    said = result.said;
  } else if (args.add) {
    const at = xy(args.at);
    if (!at) {
      console.log('race <id> --add --at x,y [--after N]');
      return 1;
    }
    const after = num(args.after);
    const i = addRaceMark(q, at, after === undefined ? undefined : after - 1);
    said = `${q.id}: mark ${i + 1} at ${at.x},${at.y}`;
  } else if (args.mark !== undefined) {
    const i = Number(args.mark) - 1;
    if (args.remove) {
      if (!removeRaceMark(q, i)) {
        console.log(`no mark ${args.mark} to remove (a race keeps one)`);
        return 1;
      }
      said = `${q.id}: mark ${i + 1} removed`;
    } else {
      const at = xy(args.at);
      if (!at || !moveRaceMark(q, i, at)) {
        console.log('race <id> --mark N --at x,y');
        return 1;
      }
      said = `${q.id}: mark ${i + 1} at ${at.x},${at.y}`;
    }
  }
  if (said) {
    const problems = problemsOf(doc, map, [q.id]);
    const written = writeQuest(q, args);
    for (const p of problems) console.log(p);
    console.log(
      `${said.trim()}${written ? '' : ' (not written)'} · ${problems.length ? `${problems.length} problem(s)` : 'checks ok'} · sail it again with --pars --write`,
    );
    return problems.length ? 1 : 0;
  }
  // The course and each medal's time.
  const goal = raceGoal(q)!;
  if (typeof args.overlay === 'string') return raceOverlay(q, goal, args.overlay);
  const line = (g: unknown) =>
    (g as { x: number; y: number }[]).map((p) => `${p.x},${p.y}`).join(' to ');
  console.log(`${q.id} (${q.name}), ${q.race!.series}, at ${q.port}`);
  console.log(`  start  ${line(goal.start)}`);
  (goal.marks as { x: number; y: number }[]).forEach((m, i) =>
    console.log(`  mark ${i + 1} ${m.x},${m.y}`),
  );
  console.log(`  finish ${line(goal.finish)}`);
  (q.race!.storms ?? []).forEach((st, i) =>
    console.log(
      `  storm ${i + 1} ${st.x},${st.y}${st.radius ? `  radius ${st.radius}` : ''}${st.strength ? `  strength ${st.strength}` : ''}${st.driftSpeed ? `  drifts ${st.driftSpeed}/s toward ${st.driftDeg}°` : ''}`,
    ),
  );
  console.log(
    `  wind   ${q.wind ? `${q.wind.speedKn} kn from ${q.wind.fromDeg ?? 'the map'}°` : "the sea's"}`,
  );
  console.log(`  gold   ${MEDALS.map((m) => `${m} ${q.race!.gold[m]}`).join(', ')}`);
  for (const level of DIFFICULTIES) {
    console.log(`  ${level}: ${MEDALS.slice().reverse().join(' / ')}`);
    for (const ship of SHIP_IDS) {
      const t = medalTimes(q.race!, ship, level);
      console.log(
        `    ${ship.padEnd(9)} ${MEDALS.slice()
          .reverse()
          .map((m) => (Number.isFinite(t[m]) ? fmt(t[m]) : '—'))
          .join('  ')}${q.race!.pars[ship] ? '' : '  (no par: the slowest)'}`,
      );
    }
  }
  return 0;
}

/**
 * `race rules|set|series|flag` (decision 0217): regatta.json and flags.json with the Regatta
 * page's own edits, written byte for byte as the page exports them, then checked.
 */
function regattaFiles(ids: string[], args: Args): number {
  const [cmd, id, value] = ids;
  const doc = shippedRegattaDoc();
  const r = doc.regatta;
  if (cmd === 'rules') {
    const k = r.rival;
    console.log(
      `horn ${r.countdownSec} s · marks within ${r.within} · lines at least ${r.minLine} · medals ${MEDALS.map((m) => `${m} ×${r.medals[m]}`).join(', ')} · series won with ${r.winMedal}`,
    );
    console.log(
      `${k.name}: ${k.ship} "${k.sailNumber}", hull ${k.hull}, band ${k.band}, burgee ${k.flag}, sails to ${k.pace} (×${k.paceRange.join('–')}), room ${k.berth}, runs out ${k.runOut}`,
    );
    for (const s of r.series) console.log(`series ${s.id}: ${s.name}, pennant ${s.pennant}`);
    for (const f of doc.flags.flags)
      console.log(`flag ${f.id}: ${f.shape} ${f.length}×${f.height}, bands ${f.bands.join(' ')}`);
    const problems = regattaProblems(doc);
    console.log(problems.length ? problems.map((p) => `✗ ${p}`).join('\n') : 'checks ok');
    return problems.length ? 1 : 0;
  }
  let did: string;
  if (cmd === 'set') {
    if (!id || value === undefined) {
      console.log('race set <path> <value>');
      return 1;
    }
    const problem = setRule(doc, id, value);
    if (problem) {
      console.log(problem);
      return 1;
    }
    did = `${id} = ${value}`;
  } else if (cmd === 'series') {
    if (!id) {
      console.log('race series <id> [--name "…"] [--pennant flag]');
      return 1;
    }
    setSeries(doc, id, {
      ...(typeof args.name === 'string' ? { name: args.name } : {}),
      ...(typeof args.pennant === 'string' ? { pennant: args.pennant } : {}),
    });
    did = `series ${id}`;
  } else {
    if (!id) {
      console.log(
        'race flag <id> [--shape …] [--bands "#a,#b"] [--length n] [--height n] | --remove',
      );
      return 1;
    }
    if (args.remove) {
      if (!removeFlag(doc, id)) {
        console.log(`no flag "${id}"`);
        return 1;
      }
      did = `flag ${id} removed`;
    } else {
      const change: Parameters<typeof setFlag>[2] = {};
      if (typeof args.shape === 'string') {
        if (!isFlagShape(args.shape)) {
          console.log('--shape pennant|swallowtail|burgee');
          return 1;
        }
        change.shape = args.shape;
      }
      if (typeof args.bands === 'string') change.bands = args.bands.split(',').map((c) => c.trim());
      if (args.length !== undefined) change.length = Number(args.length);
      if (args.height !== undefined) change.height = Number(args.height);
      setFlag(doc, id, change);
      did = `flag ${id}`;
    }
  }
  const problems = regattaProblems(doc);
  if (problems.length) {
    console.log(`${did} · not written:\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`);
    return 1;
  }
  const shipped = shippedRegattaDoc();
  const files: [string, string, string][] = [
    ['src/data/regatta.json', regattaText(doc), regattaText(shipped)],
    ['src/data/flags.json', flagsText(doc), flagsText(shipped)],
  ];
  const changed = files.filter(([, text, before]) => text !== before);
  if (!args.dry) for (const [path, text] of changed) writeFileSync(resolve(path), text);
  console.log(
    `${did} · ${changed.length ? changed.map(([p]) => p).join(', ') : 'nothing changed'}${args.dry ? ' (dry)' : ''} · checks ok`,
  );
  return 0;
}

/**
 * A race's course as a `npm run chart` overlay (decision 0217): the line from the start round
 * each mark to the finish, the marks numbered, the lines named; prints the view that frames it.
 */
function raceOverlay(q: QuestDef, goal: Condition, file: string): number {
  type P = { x: number; y: number };
  const start = goal.start as P[];
  const finish = goal.finish as P[];
  const marks = goal.marks as P[];
  const mid = (g: P[]): [number, number] => [(g[0]!.x + g[1]!.x) / 2, (g[0]!.y + g[1]!.y) / 2];
  const same = JSON.stringify(start) === JSON.stringify(finish);
  const overlay = {
    title: `${q.name} · ${seriesById(q.race!.series)?.name ?? q.race!.series}`,
    legend: [{ style: 'route', text: 'the course, mark to mark (boats sail round land)' }],
    lines: [
      {
        points: [mid(start), ...marks.map((m) => [m.x, m.y]), mid(finish)],
        style: 'route',
        label: q.name,
        arrow: true,
      },
      {
        points: start.map((p) => [p.x, p.y]),
        style: 'short',
        label: same ? 'start and finish' : 'start',
      },
      ...(same ? [] : [{ points: finish.map((p) => [p.x, p.y]), style: 'long', label: 'finish' }]),
    ],
    labels: marks.map((m, i) => ({ at: [m.x, m.y + 14], text: `mark ${i + 1}`, style: 'note' })),
  };
  writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`);
  const all = [...start, ...finish, ...marks];
  const pad = 90;
  const view = [
    Math.min(...all.map((p) => p.x)) - pad,
    Math.min(...all.map((p) => p.y)) - pad,
    Math.max(...all.map((p) => p.x)) + pad,
    Math.max(...all.map((p) => p.y)) + pad,
  ].map(Math.round);
  console.log(
    `${file}: ${q.id}'s course · npm run chart -- --overlay ${file} --view ${view.join(',')}`,
  );
  return 0;
}
