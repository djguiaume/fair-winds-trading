import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FORESTS, forestBiome, forestProblems } from '../src/data/forests';
import { groundColors } from '../src/data/grounds';
import { type IslandDesign, designOf } from '../src/data/islands';
import { GAME_MAP } from '../src/data/maps';
import { applySteps } from '../src/editor/island/steps';
import {
  type ForestInput,
  type ForestTree,
  filePoint,
  plantForest,
  regionBox,
  replantRegion,
} from '../src/sim/forest';
import { type Heightfield, heightAt, islandHeightfield, sampleIndex } from '../src/sim/heightfield';
import { islandPoint } from '../src/sim/islandLayout';
import type { IslandDef } from '../src/sim/map';
import { SculptSession } from '../src/sim/sculptSession';
import { forestCost, forestMeshes, setForestQuality } from '../src/render/models/forest';
import { designForest, emptyClearings } from '../src/render/models/forestPlan';
import { islandParts, shownLevel } from '../src/render/models/islandParts';
import { fieldStand } from '../src/render/models/townProps';
import { mergeAll, vertexColorMaterial } from '../src/render/models/geometry';
import { buildProp } from '../src/render/models/propRecipe';
import type { QualityLevel } from '../src/render/quality';

/*
 * The new look's forests (issue #275): biome mixes, the town's clear ground, determinism, a
 * sculpt edit replanting only its corner, and what each quality level draws.
 */

const islandOf = (id: string) => GAME_MAP.islands.find((i) => i.id === id)!;

/** An island's forest input as the game builds it: the town at level 2, its clearings noted. */
function inputOf(island: IslandDef, design = designOf(island)!, field?: Heightfield): ForestInput {
  const index = GAME_MAP.islands.indexOf(island);
  const port = GAME_MAP.ports.find((p) => p.islandId === island.id);
  const townLevel = port ? 2 : undefined;
  const level = shownLevel(island, townLevel);
  const ground = field ?? islandHeightfield(island, level);
  const clearings = emptyClearings(island, design, !!island.look?.dock);
  const parts = islandParts(
    island,
    GAME_MAP,
    index,
    undefined,
    townLevel,
    undefined,
    undefined,
    fieldStand(island, ground),
    clearings,
  );
  parts.forEach((g) => g.dispose());
  return { island, design, field: ground, level, clearings };
}

const WOODED = GAME_MAP.islands.filter((i) => designOf(i)?.woods.tries);
const PLANTED = new Map(WOODED.map((i) => [i.id, plantForest(inputOf(i))]));

const kindsOf = (trees: ForestTree[]) => new Set(trees.map((t) => t.kind));

describe('forest data', () => {
  it("gives each kind its model's height", () => {
    for (const [id, k] of Object.entries(FORESTS.kinds)) {
      const model = mergeAll(
        buildProp(k.prop, { R: 1, style: 'fish', variant: 0, shape: 0.5, size: 1, vars: k.vars }),
      );
      model.computeBoundingBox();
      expect(model.boundingBox!.max.y, id).toBeCloseTo(k.height, 1);
    }
  });

  it('names real props, a biome for every style, and shares between 0 and 1', () => {
    expect(forestProblems()).toEqual([]);
  });

  it('reports what is wrong', () => {
    const broken = structuredClone(FORESTS);
    broken.kinds.pine!.prop = 'no-such-tree';
    broken.biomes.ring!.cover = 2;
    broken.biomes.south!.trees.push({ kind: 'oak', share: 1 });
    expect(forestProblems(broken)).toEqual([
      'kind pine: no prop "no-such-tree"',
      'biome ring: cover must be between 0 and 1',
      'biome south: no kind "oak"',
    ]);
  });
});

describe('forest placement', () => {
  it('grows each biome its own trees (art direction §3)', () => {
    const byBiome = new Map<string, Set<string>>();
    for (const island of WOODED) {
      const biome = FORESTS.styles[designOf(island)!.style]!;
      const kinds = byBiome.get(biome) ?? new Set<string>();
      for (const k of kindsOf(PLANTED.get(island.id)!)) kinds.add(k);
      byBiome.set(biome, kinds);
    }
    expect([...byBiome.get('ring')!].sort()).toEqual(['broadleaf', 'pine']);
    expect([...byBiome.get('south')!].sort()).toEqual(['jungle', 'palm']);
    expect([...byBiome.get('north')!]).toEqual(['snow-pine']);
    expect([...byBiome.get('west')!]).toEqual(['birch']);
    // East: no forest at all, even with its woods turned on.
    const fogwatch = islandOf('fogwatch');
    const design = structuredClone(designOf(fogwatch)!);
    design.woods.tries = 260;
    expect(FORESTS.styles[design.style]).toBe('east');
    expect(plantForest({ ...inputOf(fogwatch), design })).toEqual([]);
  });

  it("plants an island file as the game does (the CLI's report)", () => {
    const island = islandOf('calda');
    expect(designForest(island, designOf(island)!, 2, true)).toEqual(PLANTED.get('calda'));
  });

  it('is the same every time', () => {
    const island = islandOf('calda');
    const again = plantForest(inputOf(island));
    expect(again).toEqual(PLANTED.get('calda'));
    expect(again.length).toBeGreaterThan(50);
  });

  it('keeps off the beach, steep ground and grounds that carry no trees', () => {
    for (const island of WOODED) {
      const design = designOf(island)!;
      const biome = forestBiome(design.style)!;
      const field = islandHeightfield(island, inputOf(island).level);
      for (const t of PLANTED.get(island.id)!) {
        expect(t.height).toBeGreaterThanOrEqual(biome.minHeight);
        expect(t.height).toBeCloseTo(heightAt(field, t.x, t.y), 5);
        const ground = field.grounds[field.ground[sampleIndex(field, t.x, t.y)]!]!;
        expect(groundColors(ground, design.style).trees, `${island.id} ${ground}`).toBe(true);
      }
    }
  });

  it('keeps houses, lanes, piers, build spots and the harbour view clear', () => {
    for (const island of WOODED) {
      const input = inputOf(island);
      const { design, clearings } = input;
      const trees = PLANTED.get(island.id)!.map((t) => filePoint(island, t.x, t.y));
      for (const [x, z, r] of clearings.circles)
        for (const [tx, tz] of trees) expect(Math.hypot(tx - x, tz - z)).toBeGreaterThan(r - 1e-9);
      const plot = FORESTS.clear.plot / island.radius;
      for (const spot of design.homeSpots ?? [])
        for (const [tx, tz] of trees)
          expect(Math.hypot(tx - spot.x, tz - spot.z)).toBeGreaterThan(plot);
      const lane = FORESTS.clear.lane / island.radius;
      for (const l of design.lanes)
        for (const [x, z] of l.points)
          for (const [tx, tz] of trees) expect(Math.hypot(tx - x!, tz - z!)).toBeGreaterThan(lane);
    }
  });

  it('clears 1.5 house widths round every house', () => {
    const input = inputOf(islandOf('saltmere'));
    expect(input.clearings.homes.length).toBeGreaterThan(3);
    // Every house noted a circle at least as wide as 1.5 house widths each side.
    for (const [x, z] of input.clearings.homes) {
      const circle = input.clearings.circles.find(([cx, cz]) => cx === x && cz === z)!;
      expect(circle[2] * input.island.radius).toBeGreaterThan(4);
    }
  });

  it('leaves the harbour camera its line to the town', () => {
    const input = inputOf(islandOf('calda'));
    const { island, field } = input;
    const [cx, cz, cy] = input.clearings.camera!;
    const half = FORESTS.clear.view / island.radius;
    for (const t of PLANTED.get('calda')!) {
      const [x, z] = filePoint(island, t.x, t.y);
      const top = t.height + FORESTS.kinds[t.kind]!.height * t.scale;
      for (const [hx, hz] of input.clearings.homes) {
        const p = islandPoint(island, hx, hz);
        const hy = heightAt(field, p.x, p.y);
        const dx = cx - hx,
          dz = cz - hz;
        const s = ((x - hx) * dx + (z - hz) * dz) / (dx * dx + dz * dz);
        const near = s > 0 && s < 1 && Math.hypot(hx + dx * s - x, hz + dz * s - z) < half;
        if (near) expect(top).toBeLessThanOrEqual(hy + (cy - hy) * s);
      }
    }
  });

  it('fills an island with painted woods beyond them, mixes small trees in, lines lanes', () => {
    const island = islandOf('saltmere');
    const input = inputOf(island);
    const areas = input.design.woods.areas!;
    const trees = PLANTED.get('saltmere')!;
    const points = trees.map((t) => filePoint(island, t.x, t.y));
    const outside = points.filter(
      ([x, z]) => !areas.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r),
    );
    expect(outside.length).toBeGreaterThan(10);
    // Small trees: a share of every kind, at the small size.
    const unit = input.design.woods.size * 2.2;
    const small = trees.filter((t) => t.scale < unit * FORESTS.kinds[t.kind]!.scale[0]);
    expect(small.length / trees.length).toBeGreaterThan(0.2);
    // Hedgerows: the lane pieces drawn at this level are lined with trees.
    expect(input.clearings.lanes.length).toBeGreaterThan(0);
    const ring = FORESTS.biomes.ring!;
    const hedgerow = ring.hedgerow;
    ring.hedgerow = 0;
    try {
      expect(plantForest(input).length).toBeLessThan(trees.length);
    } finally {
      ring.hedgerow = hedgerow;
    }
  });

  it('grows none with the woods off or a density of 0, more with a higher density', () => {
    const island = islandOf('calda');
    const design = structuredClone(designOf(island)!);
    const count = (d: IslandDesign) => plantForest({ ...inputOf(island), design: d }).length;
    const shipped = count(design);
    applySteps(design, [{ do: 'woods', density: 1.6 }]);
    expect(design.woods.density).toBe(1.6);
    expect(count(design)).toBeGreaterThan(shipped);
    design.woods.density = 0;
    expect(count(design)).toBe(0);
    design.woods.density = 1;
    design.woods.tries = 0;
    expect(count(design)).toBe(0);
  });

  it("grows painted groves in the new look only, leaving the classic look's woods as they are", () => {
    const island = islandOf('calda');
    const design = structuredClone(designOf(island)!);
    const count = () => plantForest({ ...inputOf(island), design }).length;
    const areas = structuredClone(design.woods.areas);
    const shipped = count();
    applySteps(design, [{ do: 'woods', at: [0.5, 0.2], r: 0.3, grove: true }]);
    expect(design.woods.groves).toHaveLength(1);
    expect(design.woods.areas).toEqual(areas);
    expect(count()).toBeGreaterThan(shipped);
    applySteps(design, [{ do: 'woods', at: [0.5, 0.2], r: 0.3, clear: true }]);
    expect(design.woods.groves).toBeUndefined();
  });

  it('maps file points and map points both ways', () => {
    const island = islandOf('sunreach');
    const p = islandPoint(island, 0.3, -0.45);
    const [x, z] = filePoint(island, p.x, p.y);
    expect(x).toBeCloseTo(0.3, 9);
    expect(z).toBeCloseTo(-0.45, 9);
  });
});

describe('replanting after a sculpt edit', () => {
  it('redoes only the edited corner, as a full planting would', () => {
    const island = islandOf('calda');
    const design = designOf(island)!;
    const before = inputOf(island);
    const trees = plantForest(before);
    const session = new SculptSession(island, design, before.level);
    session.begin({ op: 'raise', radius: 0.12, strength: 3, falloff: 0.5 });
    // On the woods: the edit must change what grows there.
    const [fx, fz] = filePoint(island, trees[0]!.x, trees[0]!.y);
    session.dab(fx, fz);
    const region = session.commit()!;
    const box = regionBox(session.field, region);
    const after = { ...before, field: session.field };
    const replanted = replantRegion(trees, after, box);
    const key = (t: ForestTree) => `${t.x.toFixed(6)},${t.y.toFixed(6)},${t.kind}`;
    expect(new Set(replanted.map(key))).toEqual(new Set(plantForest(after).map(key)));
    // Outside the box, the very same trees.
    const outside = trees.filter(
      (t) => t.x < box[0] || t.x > box[2] || t.y < box[1] || t.y > box[3],
    );
    for (const t of outside) expect(replanted).toContain(t);
    expect(outside.length).toBeLessThan(trees.length);
  });
});

describe('forest drawing', () => {
  const material = vertexColorMaterial();
  const trees = PLANTED.get('sunreach')!;

  it('draws one instanced mesh per kind, fewer of the same trees on lower levels', () => {
    const group = forestMeshes(trees, 'tropic', material, 'high');
    expect(group.children).toHaveLength(kindsOf(trees).size);
    const drawn = (level: QualityLevel) => {
      setForestQuality(group, level);
      return forestCost(group).trees;
    };
    expect(drawn('high')).toBe(trees.length);
    expect(drawn('ultra')).toBe(trees.length);
    expect(drawn('medium')).toBeLessThan(trees.length);
    expect(drawn('low')).toBeLessThan(drawn('medium'));
    // Low draws the trees ranked first (deepest in their woods), which High draws too.
    setForestQuality(group, 'low');
    for (const mesh of group.children as THREE.InstancedMesh[]) {
      const ranks = (mesh.userData as { ranks: number[] }).ranks;
      expect(mesh.count).toBe(Math.round(ranks.length * FORESTS.quality.low.share));
      const kept = Math.max(...ranks.slice(0, mesh.count));
      for (const r of ranks.slice(mesh.count)) expect(r).toBeGreaterThanOrEqual(kept);
    }
    expect((group.children[0] as THREE.Mesh).castShadow).toBe(FORESTS.quality.low.shadows);
    setForestQuality(group, 'high');
    expect((group.children[0] as THREE.Mesh).castShadow).toBe(true);
  });

  it('stays inside its budget over the whole game map (High)', () => {
    let trees = 0,
      draws = 0,
      triangles = 0;
    for (const island of WOODED) {
      const cost = forestCost(
        forestMeshes(PLANTED.get(island.id)!, designOf(island)!.style, material, 'high'),
      );
      trees += cost.trees;
      draws += cost.draws;
      triangles += cost.triangles;
    }
    // Recorded in docs/v1.2/plan.md step 5: a few draws per wooded island, all of it on screen at once.
    expect(trees).toBeLessThan(1500);
    expect(draws).toBeLessThanOrEqual(2 * WOODED.length);
    expect(triangles).toBeLessThan(60_000);
  });
});
