// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { ISLAND_DESIGNS, type IslandDesign, type SculptDef } from '../src/data/islands';
import { FieldSurface, fieldGround } from '../src/render/models/fieldSurface';
import { designHeightfield, heightAt } from '../src/sim/heightfield';
import { islandPoint } from '../src/sim/islandLayout';
import { ISLAND_SCALE } from '../src/sim/islandUnits';
import type { IslandDef } from '../src/sim/map';
import { TUNING } from '../src/data/tuning';
import { tidyDesign } from '../src/editor/island/doc';
import { formatIslandJson } from '../src/editor/model';
import {
  clampBrush,
  defaultBrush,
  resized,
  sculptBrush,
  strengthKey,
} from '../src/editor/island/terrain/brush';
import { TerrainTool, type TerrainHost } from '../src/editor/island/terrain/terrainTool';
import { terrainWarnings } from '../src/editor/island/terrain/warnings';
import { SculptSession } from '../src/sim/sculptSession';

const R = 16;
const island = (): IslandDef => ({
  id: 'calda',
  x: 0,
  y: 0,
  radius: R * ISLAND_SCALE,
  look: { design: 'calda', harbourBearing: Math.PI, dock: true },
});
const calda = (): IslandDesign => structuredClone(ISLAND_DESIGNS.calda!);

describe('the terrain brush settings', () => {
  it('start inside their ranges and make the brush a saved edit would be', () => {
    const b = defaultBrush();
    expect(clampBrush(b)).toEqual(b);
    expect(sculptBrush(b)).toEqual({
      op: 'raise',
      radius: b.radius,
      strength: b.lift,
      falloff: TUNING.terrain.sculpt.falloff,
    });
  });

  it('take the strength each tool reads, a flatten height and the override', () => {
    const b = { ...defaultBrush(), tool: 'flatten' as const, height: 0.04, override: true };
    expect(strengthKey('lower')).toBe('lift');
    expect(strengthKey('flatten')).toBe('share');
    expect(sculptBrush(b)).toMatchObject({
      op: 'flatten',
      strength: b.share,
      height: 0.04,
      override: true,
    });
    expect(sculptBrush({ ...b, tool: 'smooth' })).not.toHaveProperty('height');
  });

  it('keep every setting in range when the brush is resized', () => {
    const [min, max] = TUNING.terrain.sculpt.editor.radius;
    expect(resized(defaultBrush(), 1000).radius).toBe(max);
    expect(resized(defaultBrush(), 0.0001).radius).toBe(min);
  });
});

describe('the field surface', () => {
  it('draws the same ground as the game wherever there is land, and follows changes in place', () => {
    const field = designHeightfield(island(), calda(), 4);
    const color = () => '#abcdef';
    const surface = new FieldSurface(field, color);
    const game = fieldGround(field, color);
    const cells = (field.w - 1) * (field.h - 1);
    expect(surface.geometry.getAttribute('position').count).toBe(cells * 6);
    // Every game triangle is one of the surface's (the surface also draws the open seabed).
    const own = new Set<string>();
    const positions = surface.geometry.getAttribute('position').array;
    for (let i = 0; i < positions.length; i += 9)
      own.add(Array.from(positions.subarray(i, i + 9)).join());
    const theirs = game.getAttribute('position').array;
    for (let i = 0; i < theirs.length; i += 9)
      expect(own.has(Array.from(theirs.subarray(i, i + 9)).join())).toBe(true);

    const k = Math.floor(field.h / 2) * field.w + Math.floor(field.w / 2);
    field.heights[k] = 9;
    surface.update({
      i0: k % field.w,
      j0: Math.floor(k / field.w),
      i1: k % field.w,
      j1: Math.floor(k / field.w),
    });
    expect(Array.from(surface.geometry.getAttribute('position').array)).toContain(9);
    const normals = surface.geometry.getAttribute('normal').array;
    expect(Array.from(normals).every(Number.isFinite)).toBe(true);
  });
});

/** A host that counts what the builder would be asked to do. */
function harness(design: IslandDesign) {
  const calls = { save: [] as (SculptDef | undefined)[], restand: 0, redraw: 0, refresh: 0 };
  const view = { setField: vi.fn(), render: vi.fn() };
  const host: TerrainHost = {
    top: view as never,
    preview: view as never,
    R: () => R,
    harbour: () => true,
    level: () => 4,
    save: (sculpt) => {
      calls.save.push(sculpt);
      if (sculpt) design.sculpt = structuredClone(sculpt);
      else delete design.sculpt;
    },
    restand: () => void calls.restand++,
    redraw: () => void calls.redraw++,
    refresh: () => void calls.refresh++,
  };
  return { tool: new TerrainTool(host), calls, view };
}

/** A free spot of calda's ground, away from its buildings (radius units). */
const FREE: [number, number] = [0.45, -0.5];

describe('the terrain tool', () => {
  it('paints a stroke, saves it as one edit and replays it exactly from the file', () => {
    const design = calda();
    const { tool, calls } = harness(design);
    tool.prepare(design, true);
    tool.set({ tool: 'raise', radius: 0.12, lift: 0.03 });
    expect(tool.begin(...FREE)).toBe(true);
    for (let i = 1; i <= 6; i++) tool.move(FREE[0] + i * 0.05, FREE[1]);
    expect(tool.stroking).toBe(true);
    tool.end();
    expect(tool.stroking).toBe(false);
    expect(calls.save).toHaveLength(1);
    const sculpt = calls.save[0]!;
    expect(sculpt.edits).toHaveLength(1);
    expect(sculpt.edits[0]!.points.length).toBeGreaterThan(1);

    // Save and reload: the file's own replay gives the ground that was painted.
    const reloaded = JSON.parse(formatIslandJson(tidyDesign(design))) as IslandDesign;
    const painted = (tool as unknown as { session: SculptSession }).session.field;
    const replayed = designHeightfield(island(), reloaded, 4);
    expect(Array.from(replayed.heights)).toEqual(Array.from(painted.heights));
    const p = islandPoint(island(), FREE[0] + 0.15, FREE[1]);
    const plain = designHeightfield(island(), { ...calda(), sculpt: undefined }, 4);
    expect(heightAt(replayed, p.x, p.y)).toBeGreaterThan(heightAt(plain, p.x, p.y));
  });

  it('follows the builder through undo, redo and reset, one step at a time', () => {
    const design = calda();
    const { tool } = harness(design);
    tool.prepare(design, true);
    const session = () => (tool as unknown as { session: SculptSession }).session;
    const before = session().field.heights.slice();
    for (const x of [FREE[0], FREE[0] + 0.3]) {
      tool.set({ radius: 0.1, lift: 0.04 });
      tool.begin(x, FREE[1]);
      tool.move(x + 0.1, FREE[1]);
      tool.end();
    }
    expect(tool.strokes).toBe(2);
    const both = structuredClone(design.sculpt)!;
    const heights = session().field.heights.slice();
    const sessionBefore = session();

    // The builder's undo puts the design back one stroke; the session undoes just that stroke.
    design.sculpt = { ...both, edits: both.edits.slice(0, 1) };
    tool.prepare(design, true);
    expect(session()).toBe(sessionBefore);
    expect(tool.strokes).toBe(1);
    expect(Array.from(session().field.heights)).not.toEqual(Array.from(heights));

    design.sculpt = both;
    tool.prepare(design, true);
    expect(session()).toBe(sessionBefore);
    expect(Array.from(session().field.heights)).toEqual(Array.from(heights));

    // A reset (or any design the session did not make) rebuilds it from the file.
    delete design.sculpt;
    tool.prepare(design, true);
    expect(tool.strokes).toBe(0);
    expect(Array.from(session().field.heights)).toEqual(Array.from(before));
  });

  it('puts the ground back when a stroke is cancelled', () => {
    const design = calda();
    const { tool, calls } = harness(design);
    tool.prepare(design, true);
    const session = () => (tool as unknown as { session: SculptSession }).session;
    const before = session().field.heights.slice();
    tool.begin(...FREE);
    tool.move(FREE[0] + 0.1, FREE[1]);
    expect(Array.from(session().field.heights)).not.toEqual(Array.from(before));
    tool.cancel();
    expect(Array.from(session().field.heights)).toEqual(Array.from(before));
    expect(calls.save).toHaveLength(0);
    expect(tool.stroking).toBe(false);
  });

  it('takes a target height from the ground, and a slope from where it starts', () => {
    const design = calda();
    const { tool, calls } = harness(design);
    tool.prepare(design, true);
    tool.picking = true;
    expect(tool.begin(...FREE)).toBe(false);
    expect(tool.picking).toBe(false);
    expect(tool.brush.height).not.toBeNull();
    tool.set({ tool: 'slope', height: 0.1, radius: 0.1, share: 1 });
    tool.begin(...FREE);
    tool.move(FREE[0] + 0.3, FREE[1]);
    expect(tool.marks().slope).toHaveLength(2);
    tool.end();
    const [a, b] = calls.save[0]!.edits[0]!.points;
    expect(a).toHaveLength(3);
    expect(b![2]).toBeCloseTo(0.1, 3);
  });

  it('warns about unexported terrain edits only, and lets go of the field when not shown', () => {
    const design = calda();
    const { tool, view } = harness(design);
    tool.markExported(design);
    expect(tool.unexported(design)).toBe(false);
    tool.prepare(design, true);
    tool.begin(...FREE);
    tool.move(FREE[0] + 0.1, FREE[1]);
    tool.end();
    expect(tool.unexported(design)).toBe(true);
    tool.markExported(design);
    expect(tool.unexported(design)).toBe(false);
    expect(tool.prepare(design, false)).toBeUndefined();
    expect(view.setField).toHaveBeenLastCalledWith(null);
  });
});

describe('the coast and harbour warnings', () => {
  it('say nothing for an island without edits', () => {
    const design = calda();
    const session = new SculptSession(island(), design, 4);
    expect(terrainWarnings(session.field, island(), design, true)).toEqual([]);
  });

  it('say where a brush raised the sea beyond the coast, or dug the coast under', () => {
    const design = calda();
    const bounds = design.coasts.flat();
    const east = Math.max(...bounds.map((p) => p[0]));
    const edge = bounds.find((p) => p[0] === east)!;
    const session = new SculptSession(island(), design, 4);
    session.begin({ op: 'raise', radius: 0.2, strength: 0.2, falloff: 0.2, override: true });
    session.dab(edge[0] + 0.1, edge[1]);
    session.commit();
    design.sculpt = session.sculpt;
    const raised = terrainWarnings(session.field, island(), design, true);
    expect(raised.some((w) => w.kind === 'coast-raised')).toBe(true);

    const dug = new SculptSession(island(), calda(), 4);
    dug.begin({ op: 'lower', radius: 0.2, strength: 0.2, falloff: 0.2, override: true });
    dug.dab(edge[0] - 0.05, edge[1]);
    dug.commit();
    const sunk = { ...calda(), sculpt: dug.sculpt };
    expect(
      terrainWarnings(dug.field, island(), sunk, true).some((w) => w.kind === 'coast-sunk'),
    ).toBe(true);
  });

  it('say when the water at the arrival pier is raised out of the sea', () => {
    const design = calda();
    const session = new SculptSession(island(), design, 4);
    session.begin({ op: 'raise', radius: 0.15, strength: 0.3, falloff: 0.2, override: true });
    session.dab(0.08, 1.0);
    session.commit();
    design.sculpt = session.sculpt;
    const warnings = terrainWarnings(session.field, island(), design, true);
    expect(warnings.some((w) => w.kind === 'berth')).toBe(true);
    // An island with no harbour has no arrival pier to keep clear.
    const berths = (harbour: boolean) =>
      terrainWarnings(session.field, island(), design, harbour).filter((w) => w.kind === 'berth');
    expect(berths(false).length).toBeLessThan(berths(true).length);
  });
});

describe('the sculpt limits', () => {
  it('reach every island file to its furthest coast point, so no island is out of the brushes', () => {
    for (const design of Object.values(ISLAND_DESIGNS)) {
      const far = Math.max(...design.coasts.flat().map(([x, z]) => Math.hypot(x!, z!)));
      expect(far, design.id).toBeLessThanOrEqual(TUNING.terrain.sculpt.limits.reach);
    }
  });
});
