import { TUNING } from '../data/tuning';
import type { IslandDesign, SculptDef, SculptEdit } from '../data/islands';
import { designHeightfield, type Heightfield } from './heightfield';
import type { IslandDef } from './map';
import {
  SCULPT_VERSION,
  applyDab,
  applyEdit,
  brushProblems,
  joinRegions,
  keepMask,
  type Region,
} from './sculpt';

/** A drag's brush: an edit before its points. */
export type SculptBrush = Omit<SculptEdit, 'points'>;

/** One undoable action: an edit, and the samples it changed as they were before it. */
interface Transaction {
  edit: SculptEdit;
  region: Region | null;
  heights: Float32Array;
  terrace: Uint8Array;
}

/** Numbers saved to the file are rounded first, so what is painted is exactly what replays. */
const round = (v: number) => Number(v.toFixed(4));

/**
 * Sculpting one island (decision 0230), for the island builder and `npm run island`: a working
 * copy of its height field that edits paint as they come, one drag = one transaction, with undo
 * and redo that restore or repaint only the samples a transaction touched. Every change returns
 * the region to rebuild; `sculpt` is the file's list of edits as it now stands.
 */
export class SculptSession {
  readonly field: Heightfield;
  private readonly keep: Float32Array | null;
  private readonly edits: SculptEdit[];
  private readonly done: Transaction[] = [];
  private undone: Transaction[] = [];
  /** The drag being painted, with the whole field as it was before it. */
  private drag: {
    edit: SculptEdit;
    heights: Float32Array;
    terrace: Uint8Array;
    region: Region | null;
  } | null = null;

  constructor(
    private readonly island: IslandDef,
    design: IslandDesign,
    level = 4,
  ) {
    this.field = copyField(designHeightfield(island, design, level));
    this.keep = keepMask(this.field, island, design);
    this.edits = [...(design.sculpt?.edits ?? [])];
  }

  /** The island file's `sculpt`; undefined with no edits. */
  get sculpt(): SculptDef | undefined {
    return this.edits.length ? { version: SCULPT_VERSION, edits: [...this.edits] } : undefined;
  }

  get canUndo() {
    return this.done.length > 0;
  }

  get canRedo() {
    return this.undone.length > 0;
  }

  /** Starts a drag with this brush (a drag still open is committed first). */
  begin(brush: SculptBrush) {
    if (this.drag) this.commit();
    const edit: SculptEdit = {
      ...brush,
      radius: round(brush.radius),
      strength: round(brush.strength),
      falloff: round(brush.falloff),
      ...(brush.height !== undefined && { height: round(brush.height) }),
      points: [],
    };
    const problems = brushProblems(edit);
    if (problems.length) throw new Error(`Sculpt brush: ${problems.join(', ')}`);
    this.drag = {
      edit,
      heights: this.field.heights.slice(),
      terrace: this.field.terrace.slice(),
      region: null,
    };
  }

  /**
   * The pointer at [x, z] (this file's frame, radius units). A brush paints a dab once the pointer
   * has moved `sculpt.spacing` of its radius from the last; a slope's first point is its start and
   * every later one moves its end (with `height`). Returns the samples to rebuild.
   */
  dab(x: number, z: number, height = 0): Region | null {
    const drag = this.drag;
    if (!drag) throw new Error('Sculpt: dab before begin');
    if (![x, z, height].every(Number.isFinite)) throw new Error('Sculpt: a point must be numbers');
    const { edit } = drag;
    if (edit.op === 'slope') {
      const end = [round(x), round(z), round(height)];
      if (!edit.points.length) {
        edit.points.push(end);
        return null;
      }
      const before = drag.region;
      this.restore(drag.region, drag.heights, drag.terrace, true);
      edit.points[1] = end;
      drag.region = applyEdit(this.field, this.island, this.keep, edit);
      return joinRegions(before, drag.region);
    }
    const last = edit.points[edit.points.length - 1];
    if (
      last &&
      Math.hypot(x - last[0]!, z - last[1]!) < TUNING.terrain.sculpt.spacing * edit.radius
    )
      return null;
    edit.points.push([round(x), round(z)]);
    const region = applyDab(this.field, this.island, this.keep, edit, edit.points.length - 1);
    drag.region = joinRegions(drag.region, region);
    return region;
  }

  /** Ends the drag as one undoable edit; a drag that painted nothing is dropped. */
  commit(): Region | null {
    const drag = this.drag;
    if (!drag) return null;
    this.drag = null;
    const { edit, region } = drag;
    if (edit.op === 'slope' ? edit.points.length < 2 : !edit.points.length) return null;
    this.edits.push(edit);
    this.done.push({ edit, region, ...crop(this.field, region, drag.heights, drag.terrace) });
    this.undone = [];
    return region;
  }

  /** Drops the drag and puts its samples back. */
  cancel(): Region | null {
    const drag = this.drag;
    if (!drag) return null;
    this.drag = null;
    this.restore(drag.region, drag.heights, drag.terrace, true);
    return drag.region;
  }

  undo(): Region | null {
    this.commit();
    const tx = this.done.pop();
    if (!tx) return null;
    this.restore(tx.region, tx.heights, tx.terrace, false);
    this.edits.pop();
    this.undone.push(tx);
    return tx.region;
  }

  redo(): Region | null {
    this.commit();
    const tx = this.undone.pop();
    if (!tx) return null;
    const region = applyEdit(this.field, this.island, this.keep, tx.edit);
    this.edits.push(tx.edit);
    this.done.push(tx);
    return region;
  }

  /** Puts a region's samples back from a copy: of the whole field, or of the region alone. */
  private restore(
    region: Region | null,
    heights: Float32Array,
    terrace: Uint8Array,
    whole: boolean,
  ) {
    if (!region) return;
    const { w } = this.field;
    const rw = region.i1 - region.i0 + 1;
    for (let j = region.j0; j <= region.j1; j++) {
      const from = whole ? j * w + region.i0 : (j - region.j0) * rw;
      this.field.heights.set(heights.subarray(from, from + rw), j * w + region.i0);
      this.field.terrace.set(terrace.subarray(from, from + rw), j * w + region.i0);
    }
  }
}

/** A field's samples that a session paints, copied; the rest is shared. */
function copyField(field: Heightfield): Heightfield {
  return {
    ...field,
    heights: field.heights.slice(),
    terrace: field.terrace.slice(),
  };
}

/** A region's rows out of whole-field copies, for undo. */
function crop(
  field: Heightfield,
  region: Region | null,
  heights: Float32Array,
  terrace: Uint8Array,
) {
  if (!region) return { heights: new Float32Array(0), terrace: new Uint8Array(0) };
  const rw = region.i1 - region.i0 + 1,
    rh = region.j1 - region.j0 + 1;
  const out = { heights: new Float32Array(rw * rh), terrace: new Uint8Array(rw * rh) };
  for (let j = 0; j < rh; j++) {
    const from = (region.j0 + j) * field.w + region.i0;
    out.heights.set(heights.subarray(from, from + rw), j * rw);
    out.terrace.set(terrace.subarray(from, from + rw), j * rw);
  }
  return out;
}
