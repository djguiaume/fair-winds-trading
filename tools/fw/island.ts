// `npm run island` (decision 0153): makes and changes island files with the island builder's own
// edits (src/editor/island/steps.ts over doc.ts and shapes.ts), tidies and writes the file the
// way the builder exports it, runs the builder's checks and prints one line.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IslandDesign, IslandStyle } from '../../src/data/islands';
import { tidyDesign } from '../../src/editor/island/doc';
import {
  type BlobSpec,
  type IslandStep,
  STEP_KINDS,
  applySteps,
  islandFromOutline,
  islandSummary,
} from '../../src/editor/island/steps';
import { formatIslandJson } from '../../src/editor/model';
import { ISLAND_SCALE } from '../../src/sim/islandUnits';
import {
  type SculptCommand,
  applySculpt,
  isSculptCommand,
  sculptFrame,
} from '../../src/sim/sculptScript';
import { type TownLevel, islandCheckKit } from '../../src/render/models/towns';
import { designForest } from '../../src/render/models/forestPlan';
import { FORESTS } from '../../src/data/forests';
import { isResidence } from '../../src/render/models/townProps';
import { type Args, num, pair, pointList } from './islandArgs';
import { SCULPT_HELP, exportJson, listEdits, sculptCall } from './islandSculpt';
import { type IslandPlace, defaultSeas, islandPlacements, islandProblems } from './check';

/** The repository: npm runs the tools from there. */
const ROOT = process.cwd();

const HELP = `npm run island -- <id|file.json> [step] [options]   change an island file, check it, one line
npm run island -- new <id> [options]                  a new island file (src/data/islands/<id>.json)

new:   --outline "x,z x,z …" or --blob r=1,points=14,rough=0.22,stretch=1,turn=0 (default)
       --name "Palm Key" --style <a palette.json style: timber, fish, ice…> --seed 7103 --low 0.06 --force
steps (island-radius units, harbour toward +z; --level n = from that town level):
  islet     --outline … | --blob r=0.3,… --at x,z [--low h]
  plateau   --at x,z [--size rx,rz | --outline … | --blob …] [--height h | --rise 0.2] [--slope w] [--rock | --material snow] [--level n]
  mountain  --at x,z [--size rx,rz | --outline … | --blob …] [--height h | --rise 0.6] [--material slate] [--level n]
  lake      --at x,z [--size rx,rz | --outline … | --blob …]
  ramp      --points "x,z x,z …" [--start h --end h (default: the ground there)] [--width 0.1] [--rock | --material m] [--level n]
  lane | path | stairs   --points "x,z x,z …" (stairs take the ground's height at each point)
  river     --points "x,z x,z …" (source first, mouth last; past the coast it falls into the sea)
            [--kind water|lava] [--width 0.04] [--level n --to n --tags after:quest]
            a point "x,z,w" has its own width; the river eases between widths
  widen     <river> --point n --width w   one point's own width (--width none: the river's)
  woods     --at x,z [--r 0.2] [--clear]  paint (turns woods on); --tree --tries --size --spacing --margin
            --density d  the new look's forest: its biome's cover × d (0 none, 1 as forests.json)
  spot      --at x,z [--pair id] [--y h]
  prop      <type> --at "x,z[ x,z …]" [--turn deg --size s --variant v --shape s --length l --y h --fit r --clear r]
            [--level n --to n --tags a,b]
  pier      --at x,z [--length 0.26] [--level n]
  remove    prop|ground|lane|ramp|river|spot|coast|pier <index>, or remove lake
  set       --name … --style … --seed …
  view      --from x,z --look x,z [--height h --look-height h] [--accent #hex]   the harbour screen's
            picture of its port (decision 0211; heights in radius units; none clears one, --clear all)
  ground    <index> [--ramp] --material <palette.json ground: grass, rock, snow, ice…> [--height h] [--beach w (a coast ground: its beach width)]
  sculpt    hand terrain, brush by brush (help below); also steps {"do":"sculpt",…} in --steps
  tidy      rewrite the file in the builder's format (any step does)
options: --steps steps.json (or '[{"do":"prop",…}]': a list of steps as data, see src/editor/island/steps.ts)
         --radius r  map radius to check at (default: the island's size on the ring or the Phase 4 sea)
         --no-harbour  check as an island without a harbour; --out file  write there instead
         --dry  do not write; --warnings  list warnings; --json  summary, steps and problems as JSON
         --forest [--level n]  the new look's trees (forests.json) at that town level (default 4):
                   by kind, and how many each quality level draws
${SCULPT_HELP}`;

/** "r=1,points=14,rough=0.2" */
function blobSpec(v: unknown): BlobSpec | undefined {
  if (typeof v !== 'string') return v === true ? { r: 1 } : undefined;
  const spec: Record<string, number> = {};
  for (const kv of v.split(',')) {
    const [k, x] = kv.split('=');
    if (k) spec[k.trim()] = Number(x ?? k);
  }
  return { r: 1, ...spec } as BlobSpec;
}

/** The step a command line asks for, as data. */
export function stepFromArgs(kind: string, args: Args, rest: string[]): IslandStep {
  const at = pair(args.at);
  const level = num(args.level);
  const material =
    typeof args.material === 'string' ? args.material : args.rock ? 'rock' : undefined;
  const shaped = {
    outline: pointList(args.outline) as [number, number][] | undefined,
    blob: blobSpec(args.blob),
    size: pair(args.size),
    points:
      typeof args.points === 'string' && !args.points.includes(',') ? num(args.points) : undefined,
  };
  const need = <T>(v: T | undefined, what: string): T => {
    if (v === undefined) throw new Error(`${kind} needs ${what}`);
    return v;
  };
  const clean = <T extends object>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  switch (kind) {
    case 'islet':
      return clean({ do: 'islet', at, low: num(args.low), ...shaped });
    case 'plateau':
    case 'mountain':
      return clean({
        do: kind,
        at: need(at, '--at x,z'),
        level,
        height: num(args.height),
        rise: num(args.rise),
        material,
        slope: num(args.slope),
        crater: num(args.crater),
        ...shaped,
      });
    case 'lake':
      return clean({ do: 'lake', at: need(at, '--at x,z'), ...shaped });
    case 'ramp':
      return clean({
        do: 'ramp',
        points: need(pointList(args.points), '--points "x,z x,z"'),
        start: num(args.start),
        end: num(args.end),
        width: num(args.width),
        material,
        level,
      });
    case 'lane':
    case 'path':
    case 'stairs':
      return clean({
        do: kind,
        points: need(pointList(args.points), '--points "x,z x,z"'),
        width: num(args.width),
      });
    case 'river':
      return clean({
        do: 'river',
        points: need(pointList(args.points), '--points "x,z x,z"'),
        kind:
          args.kind === 'lava'
            ? ('lava' as const)
            : args.kind === 'water'
              ? ('water' as const)
              : undefined,
        width: num(args.width),
        level,
        to: num(args.to),
        tags: typeof args.tags === 'string' ? args.tags.split(',') : undefined,
      });
    case 'woods':
      return clean({
        do: 'woods',
        at,
        r: num(args.r),
        clear: args.clear ? true : undefined,
        tree: typeof args.tree === 'string' ? args.tree : undefined,
        tries: num(args.tries),
        size: num(args.size),
        spacing: num(args.spacing),
        margin: num(args.margin),
        density: num(args.density),
      });
    case 'spot':
      return clean({
        do: 'spot',
        at: need(at, '--at x,z'),
        pair: typeof args.pair === 'string' ? args.pair : undefined,
        y: num(args.y),
      });
    case 'prop': {
      const places = need(pointList(args.at), '--at "x,z"') as [number, number][];
      return clean({
        do: 'prop',
        type: need(rest[0] ?? (typeof args.type === 'string' ? args.type : undefined), 'a type'),
        at: places.length === 1 ? places[0]! : places,
        turn: num(args.turn),
        size: num(args.size),
        variant: num(args.variant),
        shape: num(args.shape),
        length: num(args.length),
        y: num(args.y),
        fit: num(args.fit),
        clear: num(args.clear),
        level,
        to: num(args.to),
        tags: typeof args.tags === 'string' ? args.tags.split(',') : undefined,
      });
    }
    case 'pier':
      return clean({ do: 'pier', at: need(at, '--at x,z'), length: num(args.length), level });
    case 'remove':
      return clean({
        do: 'remove',
        what: need(rest[0], 'what to remove') as 'prop',
        index: rest[1] !== undefined ? Number(rest[1]) : num(args.index),
      });
    case 'widen':
      return clean({
        do: 'widen',
        river: Number(need(rest[0] ?? args.river, 'which river (an index)')),
        point: Number(need(args.point, '--point n')),
        width: args.width === 'none' ? undefined : need(num(args.width), '--width w (or none)'),
      });
    case 'ground':
      return clean({
        do: 'ground',
        index: Number(need(rest[0] ?? args.index, 'which ground (an index)')),
        ramp: args.ramp ? true : undefined,
        material: typeof args.material === 'string' ? args.material : undefined,
        height: num(args.height),
        beach: num(args.beach),
      });
    case 'set':
      return clean({
        do: 'set',
        name: typeof args.name === 'string' ? args.name : undefined,
        style: typeof args.style === 'string' ? (args.style as IslandStyle) : undefined,
        seed: num(args.seed),
      });
    case 'view': {
      const orNone = <T>(v: unknown, read: (v: unknown) => T) => (v === 'none' ? null : read(v));
      return clean({
        do: 'view',
        from: orNone(args.from, pair),
        look: orNone(args.look, pair),
        height: orNone(args.height, num),
        lookHeight: orNone(args['look-height'], num),
        accent: orNone(args.accent, (v) => (typeof v === 'string' ? v : undefined)),
        clear: args.clear ? true : undefined,
      });
    }
    default:
      throw new Error(`unknown step "${kind}" (${STEP_KINDS.join(', ')}, tidy)`);
  }
}

/** The file of an island id (src/data/islands/<id>.json), or a path as given. */
export const islandPath = (target: string) =>
  target.endsWith('.json') ? resolve(target) : resolve(ROOT, 'src/data/islands', `${target}.json`);

/** Where an island is placed: on the ring, the stress sea or the Phase 4 sea, by its file id. */
export function placeOf(id: string, radius?: number, harbour?: boolean): IslandPlace | undefined {
  if (radius) return { R: radius / ISLAND_SCALE, harbour: harbour ?? true };
  const at = islandPlacements(defaultSeas()).get(id);
  return at && harbour === false ? { ...at, harbour } : at;
}

/** `sculpt list` and `sculpt export`: report on the file and leave it alone. */
function printSculpt(design: IslandDesign, call: ReturnType<typeof sculptCall>) {
  if ('command' in call) return 0;
  if (call.report === 'list') {
    console.log(listEdits(design).join('\n'));
    return 0;
  }
  const json = exportJson(design);
  if (json === undefined) {
    console.log('✗ no sculpt edits to export');
    return 1;
  }
  if (call.to) writeFileSync(resolve(call.to), json);
  console.log(
    call.to ? `exported ${design.sculpt?.edits.length} edits → ${call.to}` : json.trimEnd(),
  );
  return 0;
}

/** "forest at level 4: 118 trees (broadleaf 103, pine 15); Low 53 · Medium 83 · High 118" */
function forestLine(design: IslandDesign, place: { R: number; harbour: boolean }, level: number) {
  const island = sculptFrame(design.id, place.R);
  const trees = designForest(island, design, level as TownLevel, place.harbour);
  const kinds = new Map<string, number>();
  for (const t of trees) kinds.set(t.kind, (kinds.get(t.kind) ?? 0) + 1);
  const mix = [...kinds].map(([k, n]) => `${k} ${n}`).join(', ');
  const drawn = Object.entries(FORESTS.quality)
    .map(([q, { share }]) => `${q} ${trees.filter((t) => t.rank < share).length}`)
    .join(' · ');
  return `forest at level ${level}: ${trees.length} trees${mix ? ` (${mix})` : ''}; ${drawn}`;
}

export function run(args: Args): number {
  const [target, kind, ...rest] = args._;
  if (args.help || !target) {
    console.log(HELP);
    return target || args.help ? 0 : 1;
  }
  let design: IslandDesign;
  let file: string;
  const steps: IslandStep[] = [];
  const sculpting: SculptCommand[] = [];
  let report: ReturnType<typeof sculptCall> | undefined;
  try {
    if (target === 'new') {
      const id = kind;
      if (!id) throw new Error('new needs an id');
      file = typeof args.out === 'string' ? resolve(args.out) : islandPath(id);
      if (existsSync(file) && !args.force) throw new Error(`${file} exists (--force to replace)`);
      design = islandFromOutline(id, {
        outline: pointList(args.outline) as [number, number][] | undefined,
        blob: blobSpec(args.blob),
        name: typeof args.name === 'string' ? args.name : undefined,
        style: typeof args.style === 'string' ? (args.style as IslandStyle) : undefined,
        seed: num(args.seed),
        low: num(args.low),
      });
    } else {
      const from = islandPath(target);
      if (!existsSync(from))
        throw new Error(`no island file ${from} (npm run island -- new ${target})`);
      design = JSON.parse(readFileSync(from, 'utf8')) as IslandDesign;
      file = typeof args.out === 'string' ? resolve(args.out) : from;
      if (kind === 'sculpt') {
        const call = sculptCall(args, rest);
        if ('command' in call) sculpting.push(call.command);
        else report = call;
      } else if (kind && kind !== 'tidy' && kind !== 'check')
        steps.push(stepFromArgs(kind, args, rest));
    }
    if (typeof args.steps === 'string') {
      const text = args.steps.trim().startsWith('[')
        ? args.steps
        : readFileSync(args.steps, 'utf8');
      for (const step of JSON.parse(text) as (IslandStep | SculptCommand)[])
        (isSculptCommand(step) ? sculpting : steps).push(step as never);
    }
  } catch (e) {
    console.log(`✗ ${(e as Error).message}`);
    return 1;
  }

  const at = placeOf(design.id, num(args.radius), args['no-harbour'] ? false : undefined);
  const place = at ?? { R: 20 / ISLAND_SCALE, harbour: false };
  let made: string[];
  try {
    made = applySteps(design, steps);
    if (report) return printSculpt(design, report);
    made.push(...applySculpt(sculptFrame(design.id, place.R), design, sculpting));
  } catch (e) {
    console.log(`✗ ${(e as Error).message} (nothing written)`);
    return 1;
  }
  design = tidyDesign(design);
  const write = !args.dry && kind !== 'check';
  if (write) writeFileSync(file, formatIslandJson(design));

  const problems = islandProblems(design, place);
  const errors = problems.filter((p) => p.severity === 'error');
  // Triangles at the top level, against the old phones' budget (0117).
  let triangles: number | undefined;
  try {
    triangles = islandCheckKit(design, place.R, place.harbour).triangles?.(4);
  } catch {
    triangles = undefined;
  }
  const forest = args.forest ? forestLine(design, place, num(args.level) ?? 4) : undefined;
  const summary = `${islandSummary(design, isResidence)}${
    triangles !== undefined ? `, ${triangles} triangles at level 4` : ''
  }${forest ? `; ${forest}` : ''}`;
  if (args.json) {
    console.log(
      JSON.stringify({ summary, file, written: write, made, place, triangles, problems }, null, 1),
    );
    return errors.length ? 1 : 0;
  }
  const warnings = problems.length - errors.length;
  const checked = `${errors.length ? `${errors.length} error(s)` : 'checks ok'}${
    warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''
  } at radius ${Math.round(place.R * ISLAND_SCALE)}${at ? '' : ' (not on a sea; --radius)'}`;
  const where = write ? ` → ${file.replace(`${ROOT}/`, '')}` : '';
  console.log(`${summary}; ${checked}${made.length ? `; made ${made.join(', ')}` : ''}${where}`);
  for (const p of problems)
    if (p.severity === 'error' || args.warnings)
      console.log(`  ${p.severity === 'error' ? '✗' : '!'} ${p.message}`);
  return errors.length ? 1 : 0;
}
