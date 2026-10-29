// `npm run fw -- editorperf` (decision 0153): how fast the island builder's terrain brushes are on
// the largest island, through the same SculptSession and FieldSurface as the editor. Prints one
// table; CPU only (no GPU upload), so it shows full-map rebuilds, not drawing cost.
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { islandDesign } from '../../src/data/islands';
import { PHASE1_MAP } from '../../src/data/maps';
import { FieldSurface } from '../../src/render/models/fieldSurface';
import { designHeightfield } from '../../src/sim/heightfield';
import { sculptField, type Region } from '../../src/sim/sculpt';
import { SculptSession } from '../../src/sim/sculptSession';
import { type Args } from './islandArgs';

const STROKES = 24;
const DABS = 40;
const BRUSH = { op: 'raise', radius: 0.18, strength: 0.4, falloff: 0.5 } as const;

const colorOf = () => '#88aa66';
const ms = (from: number) => performance.now() - from;
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))]!;

export function run(args: Args) {
  const island = PHASE1_MAP.islands.reduce((a, b) => (b.radius > a.radius ? b : a));
  const id = typeof args.island === 'string' ? args.island : island.id;
  const def = PHASE1_MAP.islands.find((i) => i.id === id) ?? island;
  const design = islandDesign(def.id);
  const heap = () => process.memoryUsage().heapUsed / 1e6;
  const heap0 = heap();

  let t = performance.now();
  const session = new SculptSession(def, design);
  const buildMs = ms(t);
  const surface = new FieldSurface(session.field, colorOf);
  const { w, h } = session.field;
  const geometry = surface.geometry as THREE.BufferGeometry;

  const dabMs: number[] = [];
  const finishMs: number[] = [];
  const cells: number[] = [];
  for (let s = 0; s < STROKES; s++) {
    session.begin({ ...BRUSH });
    const a = (s / STROKES) * Math.PI * 2;
    for (let d = 0; d < DABS; d++) {
      t = performance.now();
      const region: Region | null = session.dab(
        Math.cos(a) * 0.3 + d * 0.01,
        Math.sin(a) * 0.3 + d * 0.005,
      );
      if (region) {
        surface.update(region);
        dabMs.push(ms(t));
      }
    }
    t = performance.now();
    const region = session.commit();
    if (region) surface.update(region);
    finishMs.push(ms(t));
    if (region) cells.push((region.i1 - region.i0 + 1) * (region.j1 - region.j0 + 1));
  }
  const heapStrokes = heap();

  const undoMs: number[] = [];
  const redoMs: number[] = [];
  while (session.canUndo) {
    t = performance.now();
    const region = session.undo();
    if (region) surface.update(region);
    undoMs.push(ms(t));
  }
  while (session.canRedo) {
    t = performance.now();
    const region = session.redo();
    if (region) surface.update(region);
    redoMs.push(ms(t));
  }

  const edited = { ...design, sculpt: session.sculpt };
  t = performance.now();
  const json = JSON.stringify(edited);
  const saveMs = ms(t);
  t = performance.now();
  const reloaded = JSON.parse(json) as typeof edited;
  sculptField(designHeightfield(def, reloaded), def, reloaded);
  const reloadMs = ms(t);
  const heapEnd = heap();

  const row = (what: string, values: number[]) =>
    console.log(
      `${what.padEnd(26)} median ${percentile(values, 0.5).toFixed(2)}  p95 ${percentile(values, 0.95).toFixed(2)}  max ${Math.max(...values).toFixed(2)} ms  (${values.length})`,
    );
  console.log(
    `island ${def.id}: field ${w}x${h} = ${w * h} samples, ${geometry.attributes.position!.count} vertices`,
  );
  console.log(`session build ${buildMs.toFixed(1)} ms (field + keep mask)`);
  row('brush dab + redraw', dabMs);
  row('stroke finish', finishMs);
  row('undo', undoMs);
  row('redo', redoMs);
  console.log(`largest stroke region: ${Math.max(...cells)} of ${w * h} samples`);
  console.log(
    `save (JSON) ${saveMs.toFixed(1)} ms; reload + replay ${STROKES} strokes ${reloadMs.toFixed(1)} ms`,
  );
  console.log(
    `heap MB: start ${heap0.toFixed(0)}, after ${STROKES} strokes ${heapStrokes.toFixed(0)}, after undo/redo/reload ${heapEnd.toFixed(0)}`,
  );
}
