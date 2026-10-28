import { TUNING } from '../data/tuning';
import type { IslandDesign, SculptDef, SculptEdit } from '../data/islands';
import type { IslandDef } from './map';
import { ISLAND_SCALE } from './islandUnits';
import { SCULPT_VERSION, sculptProblems } from './sculpt';
import { SculptSession, type SculptBrush } from './sculptSession';

/**
 * Sculpting as data (decision 0153), for `npm run island` and any tool that is not a pointer: the
 * commands run through the same `SculptSession` as the island builder's brushes, so the same
 * ordered commands save the same edits. Places are island-radius units in the file's frame.
 */

/** One stroke: a brush and where the pointer goes. A slope's `at` is its two ends [x, z, height]. */
export interface SculptStroke extends Omit<SculptBrush, 'falloff'> {
  /** Default: `terrain.json › sculpt › falloff`. */
  falloff?: number;
  do: 'sculpt';
  at: number[][];
}

/** Takes edit `index` (1 = the first) out of the file, or every edit without one. */
export interface SculptReset {
  do: 'unsculpt';
  index?: number;
}

/** Puts a saved `sculpt` in the file, in place of its edits or after them. */
export interface SculptImport {
  do: 'sculpt-import';
  sculpt: SculptDef;
  append?: boolean;
}

export type SculptCommand = SculptStroke | SculptReset | SculptImport;

export const SCULPT_COMMANDS = ['sculpt', 'unsculpt', 'sculpt-import'];

export const isSculptCommand = (step: { do: string }): step is SculptCommand =>
  SCULPT_COMMANDS.includes(step.do);

/** A file's own frame on a map: the radius is `radius` reference units, ISLAND_SCALE bigger in the world. */
export function sculptFrame(id: string, radius: number): IslandDef {
  return { id, x: 0, y: 0, radius: radius * ISLAND_SCALE };
}

/** The stroke as the brush paints it: the editor's begin, a dab per point, commit. */
export function paintStroke(session: SculptSession, stroke: SculptStroke) {
  const { op, at, radius, strength, falloff, height, override } = stroke;
  if (!at.length) throw new Error('sculpt needs places (--at "x,z x,z")');
  session.begin({
    op,
    radius,
    strength,
    falloff: falloff ?? TUNING.terrain.sculpt.falloff,
    ...(height !== undefined && { height }),
    ...(override !== undefined && { override }),
  });
  for (const [x, z, h] of at) session.dab(x!, z!, h);
  session.commit();
}

/**
 * Runs the commands in order on the design (its `sculpt` is replaced) and says what each made.
 * Nothing changes when one fails: the design is left as it was.
 */
export function applySculpt(
  island: IslandDef,
  design: IslandDesign,
  commands: SculptCommand[],
  level = 4,
): string[] {
  if (!commands.length) return [];
  const made: string[] = [];
  let sculpt = structuredClone(design.sculpt);
  let session: SculptSession | undefined;
  // One session while strokes follow each other: a field is built once, not per command.
  const open = () => (session ??= new SculptSession(island, { ...design, sculpt }, level));
  const store = () => {
    if (session) sculpt = session.sculpt;
    session = undefined;
  };
  for (const cmd of commands) {
    switch (cmd.do) {
      case 'sculpt':
        paintStroke(open(), cmd);
        made.push(`${cmd.op} ${session!.sculpt?.edits.length}`);
        break;
      case 'unsculpt': {
        store();
        const edits = sculpt?.edits ?? [];
        if (cmd.index === undefined) {
          made.push(`reset ${edits.length}`);
          sculpt = undefined;
          break;
        }
        if (!Number.isInteger(cmd.index) || cmd.index < 1 || cmd.index > edits.length)
          throw new Error(`no sculpt edit ${cmd.index} (${edits.length} in the file)`);
        edits.splice(cmd.index - 1, 1);
        made.push(`removed edit ${cmd.index}`);
        sculpt = edits.length ? { version: SCULPT_VERSION, edits } : undefined;
        break;
      }
      case 'sculpt-import': {
        store();
        const incoming = parseSculpt(cmd.sculpt);
        const edits = [...(cmd.append ? (sculpt?.edits ?? []) : []), ...incoming.edits];
        const merged = { version: SCULPT_VERSION, edits };
        const problems = sculptProblems(merged);
        if (problems.length) throw new Error(`import: ${problems[0]}`);
        sculpt = edits.length ? merged : undefined;
        made.push(`imported ${incoming.edits.length}`);
        break;
      }
    }
  }
  store();
  if (sculpt) design.sculpt = sculpt;
  else delete design.sculpt;
  return made;
}

/**
 * A `sculpt` read from outside: its shape, version, numbers and sizes are all checked, with the
 * first problem in the message. Only the fields the game knows are kept, so equal terrain is
 * the same JSON.
 */
export function parseSculpt(value: unknown): SculptDef {
  const raw = value as Partial<SculptDef> | null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('sculpt must be an object { version, edits }');
  if (raw.version !== SCULPT_VERSION)
    throw new Error(
      `sculpt version ${String(raw.version)} is not this game's (${SCULPT_VERSION}): export it again from a matching game version`,
    );
  if (!Array.isArray(raw.edits)) throw new Error('sculpt has no edits list');
  const sculpt = { version: SCULPT_VERSION, edits: raw.edits.map(cleanEdit) };
  const problems = sculptProblems(sculpt);
  if (problems.length) throw new Error(problems[0]);
  return sculpt;
}

function cleanEdit(e: SculptEdit): SculptEdit {
  const { op, points, radius, strength, falloff, height, override } = e ?? ({} as SculptEdit);
  return {
    op,
    points,
    radius,
    strength,
    falloff,
    ...(height !== undefined && { height }),
    ...(override !== undefined && { override }),
  };
}
