// `npm run island -- <id> sculpt …` (decision 0153): the island builder's terrain brushes as
// commands. Parsing only; the brushes run in src/sim/sculptScript.ts, through the same
// SculptSession as the builder, so the same ordered commands save the same edits.
import { readFileSync } from 'node:fs';
import type { IslandDesign } from '../../src/data/islands';
import { type SculptCommand, type SculptStroke, parseSculpt } from '../../src/sim/sculptScript';
import { type Args, num, pointList } from './islandArgs';

export const SCULPT_HELP = `sculpt (decision 0232; places are island-radius units in the file's frame, x right, z toward the
  harbour; heights and slope ends are in world units; every edit replays from the file, in order):
  sculpt raise|lower  --at "x,z x,z …" --brush r --strength s [--falloff f] [--override]
  sculpt flatten      --at "x,z …" --brush r --strength 0..1 --height h
  sculpt smooth       --at "x,z …" --brush r --strength 0..1
  sculpt slope        --from x,z,h --to x,z,h --brush halfWidth --strength 0..1
  sculpt list | export [--to file] | import <file> [--append] | remove <n> | reset
    --brush: the brush radius (a slope's half width); --radius still sets the map radius to check at.
    --at is one drag: a dab at each point (closer than the spacing in the tuning file are skipped);
    raise/lower: height added per dab at the brush's centre; the others: share pulled toward the target;
    --falloff: share of the radius that fades out (default from terrain.json); --override edits the
    ground kept level round buildings too (the island check then wants every building still level);
    import/export: { version, edits } JSON, an island file with a "sculpt" works too; import replaces
    the edits unless --append. Example, a hill and its crest:
      npm run island -- palm-key sculpt raise --at "-0.4,-0.3 -0.3,-0.2" --brush 0.25 --strength 1.5
      npm run island -- palm-key sculpt flatten --at "-0.35,-0.25" --brush 0.1 --strength 1 --height 6`;

const OPS = ['raise', 'lower', 'flatten', 'smooth', 'slope'];

/** What a `sculpt` call does: change the file with a command, or only report on it. */
export type SculptCall = { command: SculptCommand } | { report: 'list' | 'export'; to?: string };

export function sculptCall(args: Args, rest: string[]): SculptCall {
  const [what, arg] = rest;
  switch (what) {
    case 'list':
      return { report: 'list' };
    case 'export':
      return { report: 'export', to: typeof args.to === 'string' ? args.to : undefined };
    case 'reset':
      return { command: { do: 'unsculpt' } };
    case 'remove':
      if (arg === undefined) throw new Error('sculpt remove needs an edit number (sculpt list)');
      return { command: { do: 'unsculpt', index: Number(arg) } };
    case 'import': {
      if (!arg) throw new Error('sculpt import needs a file');
      const json = JSON.parse(readFileSync(arg, 'utf8')) as { sculpt?: unknown };
      const sculpt = parseSculpt(json && 'sculpt' in json ? json.sculpt : json);
      return { command: { do: 'sculpt-import', sculpt, ...(args.append && { append: true }) } };
    }
    default:
      return { command: strokeFromArgs(what, args) };
  }
}

function strokeFromArgs(op: string | undefined, args: Args): SculptStroke {
  if (!op || !OPS.includes(op))
    throw new Error(`sculpt needs ${OPS.join('|')}|list|export|import|remove|reset`);
  const need = (v: number | undefined, flag: string) => {
    if (v === undefined) throw new Error(`sculpt ${op} needs ${flag}`);
    return v;
  };
  const at =
    op === 'slope'
      ? [args.from, args.to].map((e) => pointList(e)?.[0] ?? [])
      : (pointList(args.at) ?? []);
  if (op === 'slope' && at.some((p) => p.length !== 3))
    throw new Error('sculpt slope needs --from x,z,height --to x,z,height');
  if (!at.length) throw new Error(`sculpt ${op} needs --at "x,z x,z"`);
  const falloff = num(args.falloff);
  const height = op === 'flatten' ? need(num(args.height), '--height h') : undefined;
  return {
    do: 'sculpt',
    op: op as SculptStroke['op'],
    at,
    radius: need(num(args.brush), '--brush r'),
    strength: need(num(args.strength), '--strength s'),
    ...(falloff !== undefined && { falloff }),
    ...(height !== undefined && { height }),
    ...(args.override && { override: true }),
  };
}

/** One line per edit: its number (what `remove` takes), brush and size. */
export function listEdits(design: IslandDesign): string[] {
  const edits = design.sculpt?.edits ?? [];
  if (!edits.length) return ['no sculpt edits'];
  return edits.map((e, i) => {
    const dabs =
      e.op === 'slope' ? `from ${e.points[0]} to ${e.points[1]}` : `${e.points.length} dabs`;
    const extra = `${e.height !== undefined ? `, height ${e.height}` : ''}${e.override ? ', override' : ''}`;
    return `${i + 1} ${e.op} radius ${e.radius}, strength ${e.strength}, falloff ${e.falloff}${extra}, ${dabs}`;
  });
}

/** The `sculpt` of a file as the same JSON every time (undefined without edits: nothing to export). */
export const exportJson = (design: IslandDesign) =>
  design.sculpt ? `${JSON.stringify(design.sculpt)}\n` : undefined;
