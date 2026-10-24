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
import { ISLAND_SCALE } from '../../src/render/models/highlandIslands';
import { isResidence } from '../../src/render/models/towns';
import { type IslandPlace, defaultSeas, islandPlacements, islandProblems } from './check';

/** The repository: npm runs the tools from there. */
const ROOT = process.cwd();

type Args = Record<string, string | boolean | undefined> & { _: string[] };

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
  woods     --at x,z [--r 0.2] [--clear]  paint (turns woods on); --tree --tries --size --spacing --margin
  spot      --at x,z [--pair id] [--y h]
  prop      <type> --at "x,z[ x,z …]" [--turn deg --size s --variant v --shape s --length l --y h --fit r --clear r]
            [--level n --to n --tags a,b]
  pier      --at x,z [--length 0.26] [--level n]
  remove    prop|ground|lane|ramp|river|spot|coast|pier <index>, or remove lake
  set       --name … --style … --seed …
  ground    <index> [--ramp] --material <palette.json ground: grass, rock, snow, ice…> [--height h]
  tidy      rewrite the file in the builder's format (any step does)
options: --steps steps.json (or '[{"do":"prop",…}]': a list of steps as data, see src/editor/island/steps.ts)
         --radius r  map radius to check at (default: the island's size on the ring or the Phase 4 sea)
         --no-harbour  check as an island without a harbour; --out file  write there instead
         --dry  do not write; --warnings  list warnings; --json  summary, steps and problems as JSON`;

const num = (v: unknown) => (v === undefined || v === true ? undefined : Number(v));
/** "x,z x,z" or "x,z;x,z" (a third number per point for stairs). */
const pointList = (v: unknown) =>
  typeof v === 'string'
    ? v
        .split(/[;\s]+/)
        .filter(Boolean)
        .map((p) => p.split(',').map(Number))
    : undefined;
const pair = (v: unknown) => {
  const p = pointList(v)?.[0];
  return p ? ([p[0]!, p[1] ?? p[0]!] as [number, number]) : undefined;
};
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
      return { do: kind, points: need(pointList(args.points), '--points "x,z x,z"') };
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
    case 'ground':
      return clean({
        do: 'ground',
        index: Number(need(rest[0] ?? args.index, 'which ground (an index)')),
        ramp: args.ramp ? true : undefined,
        material: typeof args.material === 'string' ? args.material : undefined,
        height: num(args.height),
      });
    case 'set':
      return clean({
        do: 'set',
        name: typeof args.name === 'string' ? args.name : undefined,
        style: typeof args.style === 'string' ? (args.style as IslandStyle) : undefined,
        seed: num(args.seed),
      });
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

export function run(args: Args): number {
  const [target, kind, ...rest] = args._;
  if (args.help || !target) {
    console.log(HELP);
    return target || args.help ? 0 : 1;
  }
  let design: IslandDesign;
  let file: string;
  const steps: IslandStep[] = [];
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
      if (kind && kind !== 'tidy' && kind !== 'check') steps.push(stepFromArgs(kind, args, rest));
    }
    if (typeof args.steps === 'string') {
      const text = args.steps.trim().startsWith('[')
        ? args.steps
        : readFileSync(args.steps, 'utf8');
      steps.push(...(JSON.parse(text) as IslandStep[]));
    }
  } catch (e) {
    console.log(`✗ ${(e as Error).message}`);
    return 1;
  }

  let made: string[];
  try {
    made = applySteps(design, steps);
  } catch (e) {
    console.log(`✗ ${(e as Error).message} (nothing written)`);
    return 1;
  }
  design = tidyDesign(design);
  const write = !args.dry && kind !== 'check';
  if (write) writeFileSync(file, formatIslandJson(design));

  const at = placeOf(design.id, num(args.radius), args['no-harbour'] ? false : undefined);
  const place = at ?? { R: 20 / ISLAND_SCALE, harbour: false };
  const problems = islandProblems(design, place);
  const errors = problems.filter((p) => p.severity === 'error');
  const summary = islandSummary(design, isResidence);
  if (args.json) {
    console.log(JSON.stringify({ summary, file, written: write, made, place, problems }, null, 1));
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
