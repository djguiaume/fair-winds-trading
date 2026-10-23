// @vitest-environment happy-dom
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { buildHighlandIslands } from '../src/render/models/highlandIslands';
import { type TownLevel, townIslandParts } from '../src/render/models/towns';

const levels = [1, 2, 3, 4] as const;
const kinds = ['fish', 'timber', 'grain', 'stone', 'yard'];

function triangles(level: TownLevel, kind: string) {
  const R = 24 / 2.2;
  const parts = townIslandParts({
    seed: 7001,
    level,
    kind,
    R,
    sx: 1.02,
    sz: 0.97,
    pier: { x: R * 0.08, z0: R * 0.85, len: Math.min(R * 0.75, 4.5) },
  });
  const count = parts.reduce((n, g) => n + g.attributes.position!.count / 3, 0);
  for (const g of parts) g.dispose();
  return count;
}

function built(levelsByPort?: Record<string, TownLevel>) {
  const mesh = buildHighlandIslands(PHASE1_MAP, { shadows: false, levels: levelsByPort });
  let triangles = 0;
  mesh.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name !== 'windows')
      triangles += o.geometry.attributes.position!.count / 3;
  });
  const result = {
    triangles,
    harbours: mesh.userData.harbours as Record<string, { x: number; y: number }>,
  };
  mesh.dispose();
  return result;
}

describe('growing towns (decision 0060)', () => {
  it('only ever adds as a port levels up, for every kind of port', () => {
    for (const kind of kinds) {
      const counts = levels.map((l) => triangles(l, kind));
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]!);
    }
  });

  it('is seeded: the same island at the same level builds the same', () => {
    expect(triangles(3, 'stone')).toBe(triangles(3, 'stone'));
  });

  it('keeps every pier head where the simulation docks, at any level', () => {
    const today = built();
    const ports = Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, 4 as TownLevel]));
    const grown = built(ports);
    expect(grown.harbours).toEqual(today.harbours);
  });

  it('stays within the tablet budget with every port at port-town level', () => {
    const today = built();
    const ports = Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, 4 as TownLevel]));
    const grown = built(ports);
    // Six ports at level 4 add at most ~3,000 triangles each to the one merged mesh.
    expect(grown.triangles - today.triangles).toBeLessThan(6 * 3000);
  });
});
