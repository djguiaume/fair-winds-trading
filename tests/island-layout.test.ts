import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PHASE1_MAP } from '../src/data/maps';
import {
  islandCoasts,
  characterPiers,
  fishingMoorings,
  islandLayout,
  islandPoint,
  islandLake,
  layoutGround,
  type IslandTheme,
} from '../src/sim/islandLayout';
import { characterTownPlan, townIslandParts } from '../src/render/models/towns';
import { coastDistance } from '../src/sim/coast';
import { createBoat } from '../src/sim/boat';
import { piersOf, resolveCollisions } from '../src/sim/collision';
import { createTradeState, tryDock } from '../src/sim/trade';
import { SLOOP } from '../src/sim/ship';
import { shoreTexture } from '../src/render/ocean';

const kinds: IslandTheme[] = ['fish', 'timber', 'stone', 'grain'];
describe('producer island geography', () => {
  it('reserves enough safe plots for a town, with a real level-1 to level-4 difference', () => {
    for (const kind of kinds) {
      const R = 24 / 2.2;
      const plan = characterTownPlan(kind, R);

      // The cliffside access route takes precedence over four extra quarry-town plots.
      expect(plan.length, kind).toBeGreaterThanOrEqual(kind === 'stone' ? 28 : 30);
      for (const p of plan)
        expect(layoutGround(islandLayout(kind), p.x / R, p.z / R, 0.075), kind).not.toBeNull();
      const counts = [1, 2, 3, 4].map((level) => {
        const parts = townIslandParts({
          seed: 7001,
          level: level as 1 | 2 | 3 | 4,
          kind,
          profile: kind,
          R,
          sx: 1,
          sz: 1,
          pier: { x: R * 0.08, z0: R * 0.85, len: 4.5 },
        });
        const count = parts.reduce((n, g) => n + g.attributes.position!.count / 3, 0);
        parts.forEach((g) => g.dispose());
        return count;
      });
      // Tree clearing can reduce triangles even while occupied homes increase.
      expect(counts[3]!, kind).toBeGreaterThan(2000);
      expect(counts[3]!).toBeLessThan(12000);
    }
  });
  it('starts around one village nucleus and clears woodland as occupied land expands', () => {
    for (const kind of kinds) {
      const R = 24 / 2.2,
        plan = characterTownPlan(kind, R);
      const nucleus = plan.slice(0, 3);
      for (const p of nucleus)
        expect(
          Math.min(...nucleus.filter((q) => q !== p).map((q) => Math.hypot(p.x - q.x, p.z - q.z))),
          kind,
        ).toBeLessThan(R * 0.36);
      const stages = ([1, 4] as const).map((level) =>
        townIslandParts({
          seed: 7001,
          profile: kind,
          kind,
          R,
          level,
          sx: 1,
          sz: 1,
          pier: { x: R * 0.08, z0: R * 0.85, len: 4.5 },
        }),
      );
      const trees = stages.map((parts) =>
        parts
          .filter((g) => g.userData.tree)
          .map((g) => g.userData.tree as { x: number; z: number }),
      );
      expect(trees[0]!.length, kind).toBeGreaterThan(10);
      expect(trees[1]!.length, kind).toBeGreaterThan(0);
      expect(trees[1]!.length, kind).toBeLessThan(trees[0]!.length);
      for (const tree of trees[1]!) expect(trees[0], kind).toContainEqual(tree);
      if (kind === 'grain')
        expect(stages[1]!.filter((g) => g.userData.field).length).toBeGreaterThan(
          stages[0]!.filter((g) => g.userData.field).length,
        );
      if (kind === 'stone')
        for (const p of plan)
          expect(
            islandLayout(kind).surfaces.some((s) => s.material === 'rock' && s.height * R === p.y),
          ).toBe(false);
      stages.flat().forEach((g) => g.dispose());
    }
  });
  it('widens and deepens the quarry while keeping coasts and inhabited ground fixed', () => {
    const layouts = [1, 2, 3, 4].map((level) => islandLayout('stone', level));
    const exposed = layouts.map((layout) => {
      expect(layout.coasts).toEqual(layouts[0]!.coasts);
      let cuts = 0;
      for (let x = -0.45; x < 0.7; x += 0.07)
        for (let z = -0.4; z < 0.22; z += 0.07) {
          const h = layoutGround(layout, x, z);
          if (h !== null && h < 0.68) cuts++;
        }
      return cuts;
    });
    for (let i = 1; i < 4; i++) expect(exposed[i]!).toBeGreaterThan(exposed[i - 1]!);
    for (const p of characterTownPlan('stone', 24 / 2.2))
      for (const layout of layouts)
        expect(layoutGround(layout, p.x / (24 / 2.2), p.z / (24 / 2.2))).toBeCloseTo(
          p.y / (24 / 2.2),
        );
  });
  it('keeps a broad sea approach to the flagged player berth clear at every level', () => {
    for (const island of PHASE1_MAP.islands.filter((i) => i.look?.profile))
      for (const level of [1, 2, 3, 4]) {
        const port = PHASE1_MAP.ports.find((p) => p.islandId === island.id)!;
        const pier = characterPiers(island.look!.profile!, island.radius / 2.2, level)[0]!;
        const head = (pier.z0 + pier.len) / (island.radius / 2.2);
        const solid = piersOf(PHASE1_MAP, { [port.id]: level });
        for (const offset of [-0.2, 0, 0.2])
          for (let approach = 0.25; approach <= 0.8; approach += 0.1) {
            const p = islandPoint(island, 0.08 + offset, head + approach);
            expect(
              resolveCollisions(
                createBoat(p.x, p.y, 0),
                3,
                PHASE1_MAP.islands,
                10000,
                PHASE1_MAP.terrain,
                solid,
              ),
              `${island.name} L${level}`,
            ).toBeNull();
          }
        const trade = createTradeState(PHASE1_MAP, SLOOP);
        trade.settlements.byPort[port.id]!.level = level as 1 | 2 | 3 | 4;
        const p = islandPoint(island, 0.08, head + 0.3);
        expect(tryDock(trade, PHASE1_MAP, { ...p, speedKn: 0 }, port.id)).toBe(true);
        for (const working of characterPiers(
          island.look!.profile!,
          island.radius / 2.2,
          level,
        ).slice(1))
          expect(Math.abs(working.x - pier.x)).toBeGreaterThan((island.radius / 2.2) * 0.65);
      }
    for (const mooring of fishingMoorings(4))
      if (mooring.z > 0.8) expect(Math.abs(mooring.x - 0.08)).toBeGreaterThan(0.8);
  });
  it('puts the first windmill beside the initial fields', () => {
    const R = 24 / 2.2;
    const parts = townIslandParts({
      seed: 7001,
      profile: 'grain',
      kind: 'grain',
      R,
      level: 1,
      sx: 1,
      sz: 1,
      pier: { x: R * 0.08, z0: R * 0.85, len: 4.5 },
    });
    const mill = parts.find((g) => g.userData.windmill)!.userData.windmill as {
      x: number;
      z: number;
    };
    const fields = parts
      .filter((g) => g.userData.field)
      .map((g) => g.userData.field as { x: number; z: number });
    expect(Math.min(...fields.map((p) => Math.hypot(mill.x - p.x, mill.z - p.z)))).toBeLessThan(
      0.65,
    );
    parts.forEach((g) => g.dispose());
  });
  it('splits Calda log storage between the sandy working shore and upland plateau', () => {
    const R = 24 / 2.2,
      parts = townIslandParts({
        seed: 7001,
        profile: 'timber',
        kind: 'timber',
        R,
        level: 4,
        sx: 1,
        sz: 1,
        pier: { x: 0, z0: 0, len: 4.5 },
      });
    const shore = parts.filter((g) => g.userData.logYard === 'shore'),
      upland = parts.filter((g) => g.userData.logYard === 'upland');
    expect(
      parts
        .filter((g) => g.userData.timberWorkshop)
        .map((g) => g.userData.timberWorkshop)
        .sort(),
    ).toEqual(['cutting-shed', 'lumber-store']);
    expect(shore).toHaveLength(3);
    expect(upland).toHaveLength(3);
    for (const g of shore) {
      g.computeBoundingBox();
      expect(Math.abs(g.boundingBox!.min.y - 0.3)).toBeLessThan(0.05);
    }
    for (const g of upland) {
      g.computeBoundingBox();
      expect(Math.abs(g.boundingBox!.min.y - 0.32 * R)).toBeLessThan(0.05);
    }
    parts.forEach((g) => g.dispose());
  });
  it('retains a forested mountain plateau at Calda level 4', () => {
    const R = 24 / 2.2,
      layout = islandLayout('timber');
    const parts = townIslandParts({
      seed: 7001,
      profile: 'timber',
      kind: 'timber',
      R,
      level: 4,
      sx: 1,
      sz: 1,
      pier: { x: 0, z0: 0, len: 4.5 },
    });
    const upland = parts
      .filter((g) => g.userData.tree)
      .filter((g) => {
        const p = g.userData.tree as { x: number; z: number };
        return layoutGround(layout, p.x, p.z, 0.04) === 0.32;
      });
    expect(upland.length).toBeGreaterThanOrEqual(20);
    expect(Math.max(...layout.surfaces.map((s) => s.height))).toBeGreaterThan(0.9);
    for (const g of parts.filter((g) => g.userData.tree)) {
      const p = g.userData.tree as { x: number; z: number };
      expect(layoutGround(layout, p.x, p.z, 0.04)!).toBeLessThan(0.7);
    }
    parts.forEach((g) => g.dispose());
  });
  it('keeps the lake out of terrain/building placement and supplies satellite shorelines', () => {
    const calda = islandLayout('timber');
    expect(layoutGround(calda, -0.65, -0.45)).toBeNull();
    expect(
      calda.surfaces[0]!.holes![0]!.every(
        ([x, z]) => coastDistance(x, z, calda.lake!).distance > 0,
      ),
    ).toBe(true);
    expect(islandLayout('fish').coasts).toHaveLength(3);
    expect(islandLayout('stone').coasts).toHaveLength(2);
  });
  it('uses the visible shore for collision, including bays and offshore islets', () => {
    for (const island of PHASE1_MAP.islands.filter((i) => i.look?.profile)) {
      const outlines = islandCoasts(island)!;
      for (const outline of outlines) {
        const [x, y] = outline[0]!;
        const boat = createBoat(x, y, 0);
        expect(resolveCollisions(boat, 1, [island], 1000)).toBe('shore');
        expect(outlines.every((c) => coastDistance(boat.x, boat.y, c).distance >= 1 - 1e-4)).toBe(
          true,
        );
      }
      // The main harbour's approach must remain at sea.
      const head = islandPoint(island, 0.08, 1.4);
      const boat = createBoat(head.x, head.y, 0);
      expect(resolveCollisions(boat, 2, [island], 1000)).toBeNull();
    }
    const farm = PHASE1_MAP.islands.find((i) => i.look?.profile === 'grain')!;
    const creek = islandPoint(farm, -0.65, 0.65);
    expect(resolveCollisions(createBoat(creek.x, creek.y, 0), 1, [farm], 1000)).toBeNull();
  });
  it('adds solid secondary piers only when the settlement builds them', () => {
    const at = (level: number) =>
      piersOf(PHASE1_MAP, Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, level])));
    expect(at(4).length - at(1).length).toBe(20);
    for (const pier of at(4)) {
      const boat = createBoat((pier.x0 + pier.x1) / 2, (pier.y0 + pier.y1) / 2, 0);
      expect(resolveCollisions(boat, 1, [], 1000, [], [pier])).toBe('pier');
    }
  });
  it('keeps existing houses in place through all four growth stages', () => {
    for (const kind of kinds) {
      let prior: { id: number; vertices: number[] }[] = [];
      for (const level of [1, 2, 3, 4] as const) {
        const R = 24 / 2.2;
        const parts = townIslandParts({
          seed: 7001,
          profile: kind,
          kind,
          R,
          level,
          sx: 1,
          sz: 1,
          pier: { x: R * 0.08, z0: R * 0.85, len: 4.5 },
        });
        const homes = parts
          .filter((g) => g.userData.residence !== undefined)
          .map((g) => ({
            id: g.userData.residence as number,
            vertices: Array.from(g.attributes.position!.array),
          }));
        expect(homes.slice(0, prior.length)).toEqual(prior);
        expect(homes.length).toBeGreaterThan(prior.length);
        prior = homes;
        parts.forEach((g) => g.dispose());
      }
    }
  });
  it('leaves lake water clear but stops a hull crossing its banks', () => {
    const calda = PHASE1_MAP.islands.find((i) => i.look?.profile === 'timber')!;
    const center = islandPoint(calda, -0.65, -0.45);
    expect(resolveCollisions(createBoat(center.x, center.y, 0), 1, [calda], 1000)).toBeNull();
    const shore = islandLake(calda)![0]!;
    const boat = createBoat(shore[0], shore[1], 0);
    expect(resolveCollisions(boat, 1, [calda], 1000)).toBe('shore');
  });
  it('shows the specialized workshop when production unlocks at level 3', () => {
    for (const kind of kinds) {
      const R = 24 / 2.2;
      const parts = townIslandParts({
        seed: 7001,
        profile: kind,
        kind,
        R,
        level: 3,
        sx: 1,
        sz: 1,
        pier: { x: R * 0.08, z0: R * 0.85, len: 4.5 },
      });
      expect(
        parts.some((g) => g.userData.workshop === kind),
        kind,
      ).toBe(true);
      parts.forEach((g) => g.dispose());
    }
  });
  it('bakes all coasts without uniform-array limits', () => {
    const shore = shoreTexture(PHASE1_MAP.islands, PHASE1_MAP.terrain!);
    expect(shore.texture).toBeInstanceOf(THREE.DataTexture);
    expect(shore.texture.image.width).toBe(512);
    expect(shore.bounds.z).toBeGreaterThan(600);
    const { data, width, height } = shore.texture.image;
    const coasts = PHASE1_MAP.islands.flatMap((i) => islandCoasts(i) ?? []);
    for (const [x, y] of coasts.flat()) {
      const u = Math.floor(((x - shore.bounds.x) / shore.bounds.z) * width);
      const v = Math.floor(((-y - shore.bounds.y) / shore.bounds.w) * height);
      expect((data![(v * width + u) * 4]! / 255) * 64).toBeLessThan(3);
    }
    shore.texture.dispose();
  });
});
