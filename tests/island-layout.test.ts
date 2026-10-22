import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PHASE1_MAP } from '../src/data/maps';
import {
  islandCoasts,
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
import { shoreTexture } from '../src/render/ocean';

const kinds: IslandTheme[] = ['fish', 'timber', 'stone', 'grain'];
describe('producer island geography', () => {
  it('reserves enough safe plots for a town, with a real level-1 to level-4 difference', () => {
    for (const kind of kinds) {
      const R = 24 / 2.2;
      const plan = characterTownPlan(kind, R);

      expect(plan.length, kind).toBeGreaterThanOrEqual(30);
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
      for (let i = 1; i < 4; i++) expect(counts[i]!).toBeGreaterThan(counts[i - 1]!);
      expect(counts[3]!).toBeLessThan(12000);
    }
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
