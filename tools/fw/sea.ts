// `npm run sea` (decision 0161): lists and changes the Phase 4 sea's files with the sea editor's
// own edits (src/editor/seaSteps.ts over model.ts and seas.ts), writes every changed file the way
// the editor exports it (byte for byte, Prettier's layout), runs the map checks the editor runs
// on the grown sea and prints one line.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SeaDef } from '../../src/data/grownMap';
import { prepareMap } from '../../src/data/maps';
import { type SeaStep, applySeaSteps, seaSummary } from '../../src/editor/seaSteps';
import {
  type GrownDef,
  GROWN_PATH,
  mergeSeas,
  seaExports,
  seaPath,
  splitSeas,
} from '../../src/editor/seas';
import type { MapDef } from '../../src/sim/map';
import { questTagsCheck, quickChecks, routeChecks } from '../../src/sim/mapChecks';
import { QUESTS } from '../../src/sim/quests';
import { densityLines, seaDensity } from '../../src/sim/seaDensity';
import { type Sectors, sectorChecks } from '../../src/sim/seaSectors';

/** The repository: npm runs the tools from there. */
const ROOT = process.cwd();

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const HELP = `npm run sea -- <command> [options]   change the Phase 4 sea's files, check, one line

  list                                  every sea file and what is in it
  new <id> --name "The Ice"             a new sea file src/data/seas/<id>.json, listed in grown.json
  add <what> --sea <id> --at x,y [--outline "x,y x,y …"] [fields]
        island   [--radius 12 --name … --design <island file>]
        reef | sandbank | shallows [--max-draft 1.2] | ice | bergs [--count 6 --size 5,11 --spin cw|ccw --loops 2 --sway 8] | ridge
                                                                  (an oval at --at, or --outline)
        mark     --type buoy-red|buoy-green|cardinal-north|-east|-south|-west|fishing-boat|pilot-cutter|light
                 [--name … --chart --turn deg]
        current  --path "x,y,w x,y,w …" [--speed 1.5 --name …]   (points in the direction it flows)
        drift    [--outline …] --toward deg [--speed 0.8]          (an area current)
        zone     --kind trade-belt|doldrums|stormy-coast|cold-gale|sheltered|storm-belt [--heading deg --name …]
                 (storm-belt: squalls march downwind of --heading; --outline for its band)
        area     --name … [--id …] [--outline …]                    (a chart area, fog of war)
        port     --island <id> [--name …]                           (makes the island a port)
        edge     [--outline …] [--id …]   open water joined to the round sea (decision 0202): the
                 playable sea grows by it and the edge buoys follow its outer edge
        fleet    --home <port> --kind fishing|coaster|visitor --names "A,B" [--id …]
                 coaster/visitor: --to <port> [--route | --path "x,y x,y"] [--ship fluyt --livery north]
                 fishing: --at x,y (the grounds) [--radius 40] [--route | --path …]
                 other boats (decision 0214): one boat per name; --route lays the lane with the
                 route planner round land; --after <quest> shows the fleet once that quest is done
  move <what> <id|index> --at x,y | --by dx,dy | --turn deg | --to-sea <id>
        (a mark or waypoint: index or name; --turn: round the middle of the map, degrees
        clockwise, keeping its distance)
  set <what> <id|index> --name … (and any field: --kind, --max-draft, --type, --speed, --level …;
        a port's --produces, --wants, --wants-made a,b,c, its --keeper (a characters.json id, decision 0211); a sandbank's --color #b8b2a8)
  set shape <id> --style fog     a reef's rock style (a palette style's reefRock and coral; none = warm)
  set <what> <id> --outline "x,y x,y …"   a new outline for a shape, zone, area, area current or edge
  set sea <id> --name …          set grown --radius 985 --charted 445
  set grown --sector east=45,135 a sea's slice of the outer ring, compass degrees (decision 0179;
        several with ';', none removes it); every sea's things must stay inside its own
  --after <quest> | --before <quest> | --always   on add or set: an island, shape or mark stands
        once that quest is done, or until it is (decision 0166: land swaps out of the boat's sight)
  --during <quest> | --except <quest>   an island or shape stands only while that quest runs,
        or all but then
  remove <what> <id|index>       (what: island shape port waypoint mark current zone area edge fleet)
  check                          the checks only
  density [--sight 160 --cell 10] how full each sea's slice of the outer ring is (decision 0180):
        islands, shapes, marks, zones per open water, share of empty water and the biggest
        empty discs; \`npm run chart -- --sea phase4 --density\` draws them

options: --steps steps.json (or '[{"do":"add","what":"reef",…}]': steps as data, src/editor/seaSteps.ts)
         --routes  also the sailing route checks (about 6 s on the grown sea)
         --dry  write nothing; --warnings  list warnings; --json  steps, files and checks as JSON`;

const num = (v: unknown) => (v === undefined || v === true ? undefined : Number(v));
const points = (v: unknown) =>
  typeof v === 'string'
    ? v
        .split(/[;\s]+/)
        .filter(Boolean)
        .map((p) => p.split(',').map(Number))
    : undefined;
const xy = (v: unknown) => points(v)?.[0]?.slice(0, 2) as [number, number] | undefined;

/** Command-line flags to fields, `--max-draft` to `maxDraft`; numbers and true stay typed. */
const FIELD_NAMES: Record<string, string> = {
  radius: 'radius',
  name: 'name',
  design: 'design',
  'max-draft': 'maxDraft',
  type: 'type',
  chart: 'chart',
  turn: 'turn',
  speed: 'speedKn',
  toward: 'towardDeg',
  kind: 'kind',
  heading: 'headingDeg',
  id: 'id',
  level: 'level',
  'max-level': 'maxLevel',
  site: 'site',
  hidden: 'hidden',
  keeper: 'keeper',
  count: 'count',
  size: 'size',
  seed: 'seed',
  spin: 'spin',
  loops: 'loops',
  sway: 'sway',
  home: 'home',
  to: 'to',
  ship: 'ship',
  livery: 'livery',
};
function fieldsOf(args: Args): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [flag, key] of Object.entries(FIELD_NAMES)) {
    const v = args[flag];
    if (v === undefined) continue;
    fields[key] =
      v === true
        ? true
        : v === 'none'
          ? null
          : Number.isFinite(Number(v)) && flag !== 'name' && flag !== 'id'
            ? Number(v)
            : v;
  }
  // A berg field's radius range (decision 0170): "5,11".
  if (typeof fields.size === 'string') fields.size = fields.size.split(',').map(Number);
  // Stands once a quest is done, or until it is (decisions 0130, 0166); `--always` clears it.
  for (const when of ['after', 'before', 'during', 'except'] as const) {
    const quest = args[when];
    if (typeof quest === 'string') fields.tags = quest === 'none' ? null : [`${when}:${quest}`];
  }
  if (args.always) fields.tags = null;
  // A fleet's boats, one per name (decision 0214), and its lane's marks or fishing grounds.
  if (typeof args.names === 'string')
    fields.names = args.names
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
  if (args._[1] === 'fleet') {
    const lane = points(args.path);
    if (lane) fields.path = lane.map((p) => p.slice(0, 2));
    const at = xy(args.at);
    if (fields.kind === 'fishing' && at) fields.grounds = [...at, num(args.radius) ?? 40];
    else if (args._[0] === 'set' && at && typeof args.radius === 'string')
      fields.grounds = [...at, Number(args.radius)];
    delete fields.radius;
    if (args.route) fields.route = true;
  }
  // A port's goods, comma separated: `--wants timber,obsidian`.
  for (const [flag, key] of [
    ['produces', 'produces'],
    ['wants', 'wants'],
    ['wants-made', 'wantsMade'],
  ] as const) {
    const v = args[flag];
    if (typeof v === 'string') fields[key] = v === 'none' ? [] : v.split(',').map((g) => g.trim());
  }
  // A sandbank's colour (decision 0171: a pumice bank is grey).
  if (typeof args.color === 'string') fields.look = { color: args.color };
  // An island's file is its look's design; a reef's rock style is its look's style (0173).
  if (typeof fields.design === 'string') {
    fields.look = { design: fields.design };
    delete fields.design;
  }
  if (typeof fields.style === 'string') {
    fields.look = {
      ...(fields.look as object),
      style: fields.style === 'none' ? null : fields.style,
    };
    delete fields.style;
  }
  return fields;
}

/** `east=45,135;west=225,315` (or `east=none`) as `{ east: [45, 135], west: [225, 315] }`. */
function sectorsOf(text: string): Record<string, [number, number] | null> {
  const out: Record<string, [number, number] | null> = {};
  for (const part of text.split(';').filter(Boolean)) {
    const [sea, value] = part.split('=');
    const range = value?.split(',').map(Number);
    if (!sea || !value) throw new Error(`--sector ${part}: sea=from,to`);
    if (value === 'none') out[sea.trim()] = null;
    else if (range?.length === 2 && range.every(Number.isFinite))
      out[sea.trim()] = [range[0]!, range[1]!];
    else throw new Error(`--sector ${part}: sea=from,to in compass degrees`);
  }
  return out;
}

/** The step a command line asks for, as data. */
export function seaStepFromArgs(args: Args): SeaStep | null {
  const [command, what, id] = args._;
  const fields = fieldsOf(args);
  switch (command) {
    case 'new':
      if (!what) throw new Error('new needs an id');
      return { do: 'new', sea: what, name: typeof args.name === 'string' ? args.name : undefined };
    case 'add':
      if (!what) throw new Error('add what?');
      return {
        do: 'add',
        what: what as never,
        sea: typeof args.sea === 'string' ? args.sea : undefined,
        at: xy(args.at),
        outline: points(args.outline) as [number, number][] | undefined,
        path: points(args.path) as [number, number, number][] | undefined,
        island: typeof args.island === 'string' ? args.island : undefined,
        route: args.route ? true : undefined,
        fields: Object.fromEntries(Object.entries(fields).filter(([k]) => k !== 'route')),
      };
    case 'move':
      if (!what || id === undefined) throw new Error('move <what> <id|index>');
      return {
        do: 'move',
        what: what as never,
        id,
        at: xy(args.at),
        by: xy(args.by),
        turn: args.turn !== undefined ? Number(args.turn) : undefined,
        toSea: typeof args['to-sea'] === 'string' ? args['to-sea'] : undefined,
      };
    case 'set':
      if (what === 'grown')
        return {
          do: 'set',
          what: 'grown',
          fields: {
            boundsRadius: num(args.radius),
            chartedRadius: num(args.charted),
            sectors: typeof args.sector === 'string' ? sectorsOf(args.sector) : undefined,
          },
        };
      if (!what || id === undefined) throw new Error('set <what> <id|index> --field value');
      // A new outline for a shape, zone, area or area current (trimming a reef to its sector).
      if (typeof args.outline === 'string') fields.outline = points(args.outline);
      return { do: 'set', what: what as never, id, fields };
    case 'remove':
      if (!what || id === undefined) throw new Error('remove <what> <id|index>');
      return { do: 'remove', what: what as never, id };
    case 'list':
    case 'check':
    case 'density':
    case undefined:
      return null;
    default:
      throw new Error(`unknown command ${command}`);
  }
}

/** The shipped files, read from disk (a sea made by an earlier call included). */
function readSea() {
  const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');
  const texts: Record<string, string> = { [seaPath('ring')]: read(seaPath('ring')) };
  for (const f of readdirSync(resolve(ROOT, 'src/data/seas')))
    texts[`src/data/seas/${f}`] = read(`src/data/seas/${f}`);
  const grown = JSON.parse(texts[GROWN_PATH]!) as GrownDef;
  const seas = grown.seas.map((id) => {
    const text = texts[seaPath(id)];
    if (!text) throw new Error(`grown.json lists sea "${id}" but ${seaPath(id)} is missing`);
    return JSON.parse(text) as SeaDef;
  });
  const ring = JSON.parse(texts[seaPath('ring')]!) as MapDef;
  return { texts, doc: mergeSeas(ring, seas, grown) };
}

export function run(args: Args): number {
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  let sea: ReturnType<typeof readSea>;
  const steps: SeaStep[] = [];
  try {
    sea = readSea();
    const step = seaStepFromArgs(args);
    if (step) steps.push(step);
    if (typeof args.steps === 'string') {
      const text = args.steps.trim().startsWith('[')
        ? args.steps
        : readFileSync(args.steps, 'utf8');
      steps.push(...(JSON.parse(text) as SeaStep[]));
    }
  } catch (e) {
    console.log(`✗ ${(e as Error).message}`);
    return 1;
  }
  const { doc, texts } = sea;
  if (args._[0] === 'density') {
    const sectors = doc.seaEditor.grown.sectors as Sectors | undefined;
    if (!sectors) {
      console.log('✗ grown.json has no sectors');
      return 1;
    }
    const rows = seaDensity(doc, sectors, { sight: num(args.sight), cell: num(args.cell) });
    if (args.json) console.log(JSON.stringify(rows, null, 1));
    else for (const line of densityLines(rows)) console.log(line);
    return 0;
  }
  if (args._[0] === 'list' || (!args._.length && !steps.length)) {
    if (!args._.length) console.log(HELP + '\n');
    for (const line of seaSummary(doc)) console.log(line);
    return 0;
  }
  let made: string[];
  try {
    made = applySeaSteps(doc, steps);
  } catch (e) {
    console.log(`✗ ${(e as Error).message} (nothing written)`);
    return 1;
  }
  const files = seaExports(doc, texts).filter((f) => f.changed);
  const write = !args.dry;
  if (write) for (const f of files) writeFileSync(resolve(ROOT, f.path), f.text);
  const prepared = prepareMap(doc);
  const checks = [
    ...quickChecks(prepared),
    questTagsCheck(
      prepared,
      QUESTS.map((q) => q.id),
    ),
    ...sectorChecks(splitSeas(doc).seas, doc.seaEditor.grown.sectors as Sectors | undefined),
    ...(args.routes ? routeChecks(prepared) : []),
  ];
  const failed = checks.filter((c) => !c.ok);
  const errors = failed.filter((c) => c.severity === 'error');
  if (args.json) {
    console.log(
      JSON.stringify(
        { made, files: files.map((f) => f.path), written: write, checks: failed },
        null,
        1,
      ),
    );
    return errors.length ? 1 : 0;
  }
  const warnings = failed.length - errors.length;
  const checked = `${errors.length ? `${errors.length} error(s)` : 'checks ok'}${
    warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''
  }${args.routes ? ' (with routes)' : ''}`;
  const changed = files.length
    ? `${write ? 'wrote' : 'would write'} ${files.map((f) => f.path.replace('src/data/', '')).join(', ')}`
    : 'no file changed';
  console.log(`${made.length ? `${made.join('; ')}; ` : ''}${changed}; ${checked}`);
  for (const c of failed)
    if (c.severity === 'error' || args.warnings)
      console.log(`  ${c.severity === 'error' ? '✗' : '!'} ${c.message}`);
  return errors.length ? 1 : 0;
}
