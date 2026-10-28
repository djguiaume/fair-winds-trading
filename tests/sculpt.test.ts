import { describe, expect, it } from 'vitest';
import { GAME_MAP, PHASE1_MAP } from '../src/data/maps';
import { SEAS } from '../src/data/grownMap';
import { TUNING } from '../src/data/tuning';
import { ISLAND_DESIGNS, type IslandDesign, type SculptEdit } from '../src/data/islands';
import {
  type Heightfield,
  designHeightfield,
  heightAt,
  islandHeightfield,
} from '../src/sim/heightfield';
import type { IslandDef } from '../src/sim/map';
import { islandPoint } from '../src/sim/islandLayout';
import {
  SCULPT_VERSION,
  applyEdit,
  brushWeight,
  buildingFit,
  editProblems,
  keepMask,
  type Region,
  sculptEdits,
  sculptProblems,
} from '../src/sim/sculpt';
import { SculptSession } from '../src/sim/sculptSession';
import { checkSculpt } from '../src/sim/sculptChecks';
import { islandCheckKit } from '../src/render/models/towns';
import { tidyDesign } from '../src/editor/island/doc';
import { formatIslandJson } from '../src/editor/model';

/** A flat island 10 units across, its field a 41 × 41 grid of cell 0.5 round the map's origin. */
const ISLAND: IslandDef = { id: 'flat', x: 0, y: 0, radius: 10 };
function flat(height = 1): Heightfield {
  const w = 41;
  return {
    x0: -10,
    y0: -10,
    cell: 0.5,
    w,
    h: w,
    heights: new Float32Array(w * w).fill(height),
    terrace: new Uint8Array(w * w).fill(1),
    ground: new Uint8Array(w * w),
    grounds: [''],
    smooth: new Float32Array(w * w).fill(1),
    seabed: -3.5,
    seed: 1,
  };
}
const edit = (e: Partial<SculptEdit> & Pick<SculptEdit, 'op'>): SculptEdit => ({
  points: [[0, 0]],
  radius: 0.4,
  strength: 0.1,
  falloff: 0.5,
  ...e,
});
/** The height at a point of the island's frame (radius units). */
const at = (f: Heightfield, x: number, z: number, island = ISLAND) => {
  const p = islandPoint(island, x, z);
  return heightAt(f, p.x, p.y);
};
/** Indices of the samples that differ between two fields. */
function changed(a: Heightfield, b: Heightfield) {
  const out: number[] = [];
  for (let k = 0; k < a.heights.length; k++) if (a.heights[k] !== b.heights[k]) out.push(k);
  return out;
}
const inRegion = (f: Heightfield, r: Region | null, k: number) => {
  const i = k % f.w,
    j = Math.floor(k / f.w);
  return !!r && i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1;
};
const regionOk = (f: Heightfield, r: Region) =>
  r.i0 >= 0 && r.j0 >= 0 && r.i1 < f.w && r.j1 < f.h && r.i0 <= r.i1 && r.j0 <= r.j1;

const calda = GAME_MAP.islands.find((i) => i.look?.design === 'calda')!;
const caldaDesign = ISLAND_DESIGNS.calda!;
const withEdits = (design: IslandDesign, edits: SculptEdit[]): IslandDesign => ({
  ...design,
  sculpt: { version: SCULPT_VERSION, edits },
});
/** An open spot of Calda's frame, away from every building. */
const OPEN: [number, number] = [-0.55, -0.35];

describe('sculpting operations (decision 0230)', () => {
  it('weighs a brush: full in its core, fading smoothly to nothing at its rim', () => {
    expect(brushWeight(0, 1, 0.5)).toBe(1);
    expect(brushWeight(0.5, 1, 0.5)).toBe(1);
    expect(brushWeight(0.75, 1, 0.5)).toBeCloseTo(0.5);
    expect(brushWeight(1, 1, 0.5)).toBe(0);
    expect(brushWeight(0.99, 1, 0)).toBe(1);
    let last = 1;
    for (let d = 0; d <= 1; d += 0.01) {
      const w = brushWeight(d, 1, 1);
      expect(w).toBeLessThanOrEqual(last);
      last = w;
    }
  });

  it('raises and lowers by strength × radius at the centre, only inside the brush', () => {
    for (const op of ['raise', 'lower'] as const) {
      const f = flat(),
        before = flat();
      const region = applyEdit(f, ISLAND, null, edit({ op }))!;
      expect(at(f, 0, 0)).toBeCloseTo(1 + (op === 'raise' ? 1 : -1) * 0.1 * ISLAND.radius);
      expect(at(f, 0.41, 0)).toBe(1);
      expect(regionOk(f, region)).toBe(true);
      for (const k of changed(f, before)) {
        expect(inRegion(f, region, k)).toBe(true);
        expect(f.terrace[k]).toBe(0);
      }
    }
  });

  it('flattens to a height, smooths toward the neighbours and slopes between two ends', () => {
    const f = flat(1);
    applyEdit(f, ISLAND, null, edit({ op: 'flatten', height: 0.5, strength: 1 }));
    expect(at(f, 0, 0)).toBeCloseTo(5);
    expect(at(f, 0.1, 0)).toBeCloseTo(5);

    const spike = flat(0);
    spike.heights[20 * 41 + 20] = 10;
    applyEdit(spike, ISLAND, null, edit({ op: 'smooth', strength: 1, radius: 0.3 }));
    expect(spike.heights[20 * 41 + 20]).toBeLessThan(1);
    expect(spike.heights[20 * 41 + 21]).toBeGreaterThan(0);

    const ramp = flat(0);
    const slope = edit({
      op: 'slope',
      points: [
        [-0.5, 0, 0],
        [0.5, 0, 0.4],
      ],
      radius: 0.2,
      strength: 1,
    });
    applyEdit(ramp, ISLAND, null, slope);
    expect(at(ramp, -0.5, 0)).toBeCloseTo(0);
    expect(at(ramp, 0, 0)).toBeCloseTo(2);
    expect(at(ramp, 0.5, 0)).toBeCloseTo(4);
    expect(at(ramp, 0, 0.5)).toBe(0);
  });

  it('replays overlapping edits in order, the same every time', () => {
    const a = edit({
      op: 'raise',
      points: [
        [0, 0],
        [0.2, 0],
      ],
    });
    const b = edit({ op: 'flatten', points: [[0.1, 0]], height: 0.05, strength: 0.7 });
    const c = edit({ op: 'smooth', points: [[0.1, 0.1]], strength: 0.8 });
    const run = (edits: SculptEdit[]) => {
      const f = flat();
      for (const e of edits) applyEdit(f, ISLAND, null, e);
      return f.heights;
    };
    expect(run([a, b, c])).toEqual(run([a, b, c]));
    expect(run([a, b, c])).not.toEqual(run([b, a, c]));
  });

  it('keeps every height finite and in bounds, whatever the edits', () => {
    const { minHeight, maxHeight } = TUNING.terrain.sculpt;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const f = flat();
    const ops = ['raise', 'lower', 'flatten', 'smooth'] as const;
    for (let n = 0; n < 60; n++) {
      const op = ops[n % 4]!;
      applyEdit(
        f,
        ISLAND,
        null,
        edit({
          op,
          points: [[rand(), rand()]],
          radius: 0.05 + Math.abs(rand()),
          strength: op === 'raise' || op === 'lower' ? Math.abs(rand()) * 50 : Math.abs(rand()),
          height: rand() * 50,
        }),
      );
    }
    for (const h of f.heights) {
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(minHeight);
      expect(h).toBeLessThanOrEqual(maxHeight);
    }
  });

  it('reports edits that cannot replay, and refuses another version', () => {
    expect(editProblems(edit({ op: 'raise' }))).toEqual([]);
    expect(editProblems(edit({ op: 'raise', radius: 0 }))).toEqual(['radius must be above 0']);
    expect(editProblems(edit({ op: 'smooth', strength: 2 }))).toEqual(['strength must be 0 to 1']);
    expect(editProblems(edit({ op: 'flatten' }))).toEqual(['flatten needs a height']);
    expect(editProblems(edit({ op: 'slope' }))).toContain('a slope needs two ends');
    expect(editProblems(edit({ op: 'raise', points: [[0, NaN]] }))).toHaveLength(1);
    expect(editProblems(edit({ op: 'dig' as 'raise' }))).toEqual(['unknown operation "dig"']);
    const future = { ...caldaDesign, sculpt: { version: SCULPT_VERSION + 1, edits: [] } };
    expect(sculptProblems(future.sculpt)).toHaveLength(1);
    expect(() => sculptEdits(future)).toThrow(/version/);
  });
});

describe('sculpted island files (decision 0230)', () => {
  it('leaves files without edits as they were', () => {
    for (const design of Object.values(ISLAND_DESIGNS)) expect(sculptEdits(design)).toEqual([]);
    const plain = designHeightfield(calda, caldaDesign);
    expect(plain.heights).toEqual(islandHeightfield(calda).heights);
  });

  it('replays the same ground after export and import, on the canonical grid', () => {
    const design = withEdits(caldaDesign, [
      edit({
        op: 'raise',
        points: [OPEN, [OPEN[0] + 0.05, OPEN[1]]],
        radius: 0.15,
        strength: 0.02,
      }),
      edit({ op: 'smooth', points: [OPEN], radius: 0.2, strength: 0.5 }),
    ]);
    const field = designHeightfield(calda, design);
    expect(field.cell).toBe(TUNING.terrain.cell);
    expect(at(field, ...OPEN, calda)).toBeGreaterThan(
      at(designHeightfield(calda, caldaDesign), ...OPEN, calda),
    );
    const reloaded = JSON.parse(formatIslandJson(tidyDesign(design))) as IslandDesign;
    expect(reloaded.sculpt).toEqual(design.sculpt);
    expect(designHeightfield(calda, reloaded).heights).toEqual(field.heights);
  });

  it('protects the ground round buildings unless an edit overrides it, then checks it', () => {
    const house = caldaDesign.props.find((p) => buildingFit(p, calda.radius) !== null)!;
    const over = (override?: boolean) =>
      withEdits(caldaDesign, [
        edit({
          op: 'raise',
          points: [[house.x + 0.04, house.z]],
          radius: 0.2,
          strength: 0.03,
          override,
        }),
      ]);
    const base = designHeightfield(calda, caldaDesign);
    const kept = designHeightfield(calda, over());
    const forced = designHeightfield(calda, over(true));
    expect(at(kept, house.x, house.z, calda)).toBe(at(base, house.x, house.z, calda));
    expect(at(forced, house.x, house.z, calda)).toBeGreaterThan(at(base, house.x, house.z, calda));
    const mask = keepMask(base, calda, caldaDesign)!;
    expect(Math.min(...mask)).toBe(0);
    expect(Math.max(...mask)).toBe(1);

    const R = calda.radius / 2.2;
    const issues = (d: IslandDesign) => checkSculpt(d, islandCheckKit(d, R));
    expect(issues(over())).toEqual([]);
    expect(issues(over(true)).map((i) => i.check)).toContain('sculpt');
    expect(issues(withEdits(caldaDesign, [edit({ op: 'raise', radius: -1 })]))[0]!.message).toMatch(
      /radius/,
    );
  });

  it('protects at least each shipped building’s measured footprint', () => {
    const { margin } = TUNING.terrain.sculpt.protect;
    for (const island of [...PHASE1_MAP.islands, ...SEAS.flatMap((sea) => sea.islands)].filter(
      (i) => i.look?.design,
    )) {
      const design = ISLAND_DESIGNS[island.look!.design!]!;
      const kit = islandCheckKit(design, island.radius / 2.2);
      for (const p of design.props) {
        if (!kit.types[p.type]?.building) continue;
        const fit = buildingFit(p, island.radius)!;
        expect(fit + margin, `${design.id} ${p.type}`).toBeGreaterThanOrEqual(
          (p.fit ?? kit.fit(p)) * island.radius,
        );
      }
    }
  });
});

describe('a sculpting session (decision 0230)', () => {
  const brush = { op: 'raise' as const, radius: 0.12, strength: 0.01, falloff: 0.5 };
  const drag = (s: SculptSession, from: [number, number], steps = 6) => {
    s.begin(brush);
    let region: Region | null = null;
    for (let n = 0; n < steps; n++) {
      const r = s.dab(from[0] + n * 0.02, from[1]);
      if (r) region = r;
      expect(r === null || regionOk(s.field, r)).toBe(true);
    }
    return s.commit() ?? region;
  };

  it('paints exactly what the saved edits replay to', () => {
    const s = new SculptSession(calda, caldaDesign);
    drag(s, OPEN);
    s.begin({ op: 'slope', radius: 0.05, strength: 1, falloff: 0.3 });
    s.dab(OPEN[0], OPEN[1] + 0.1, 0.05);
    s.dab(OPEN[0] + 0.1, OPEN[1] + 0.1, 0.1);
    s.dab(OPEN[0] + 0.2, OPEN[1] + 0.1, 0.12);
    s.commit();
    const design = { ...caldaDesign, sculpt: s.sculpt };
    expect(design.sculpt!.edits).toHaveLength(2);
    expect(s.field.heights).toEqual(designHeightfield(calda, design).heights);
  });

  it('skips dabs closer than the spacing, so a slow drag stays small', () => {
    const s = new SculptSession(calda, caldaDesign);
    s.begin(brush);
    expect(s.dab(...OPEN)).not.toBeNull();
    expect(s.dab(OPEN[0] + 0.001, OPEN[1])).toBeNull();
    s.commit();
    expect(s.sculpt!.edits[0]!.points).toHaveLength(1);
  });

  it('undoes a whole drag as one action and redoes it to the same ground', () => {
    const s = new SculptSession(calda, caldaDesign);
    const base = s.field.heights.slice();
    const region = drag(s, OPEN)!;
    const once = s.field.heights.slice();
    drag(s, [OPEN[0], OPEN[1] + 0.05]);
    const twice = s.field.heights.slice();
    expect(s.undo()).not.toBeNull();
    expect(s.field.heights).toEqual(once);
    expect(s.undo()).toEqual(region);
    expect(s.field.heights).toEqual(base);
    expect(s.canUndo).toBe(false);
    expect(s.sculpt).toBeUndefined();
    s.redo();
    s.redo();
    expect(s.canRedo).toBe(false);
    expect(s.field.heights).toEqual(twice);
    expect(s.field.heights).toEqual(
      designHeightfield(calda, { ...caldaDesign, sculpt: s.sculpt }).heights,
    );
  });

  it('cancels a drag, and a new drag clears what could be redone', () => {
    const s = new SculptSession(calda, caldaDesign);
    const base = s.field.heights.slice();
    s.begin(brush);
    s.dab(...OPEN);
    s.cancel();
    expect(s.field.heights).toEqual(base);
    expect(s.canUndo).toBe(false);
    drag(s, OPEN);
    s.undo();
    drag(s, OPEN);
    expect(s.canRedo).toBe(false);
    expect(() => s.begin({ ...brush, radius: 0 })).toThrow(/radius/);
  });
});
