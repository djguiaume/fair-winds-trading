import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { PHASE1_MAP } from '../src/data/maps';
import { islandDesign } from '../src/data/islands';
import { townIslandParts, type TownLevel } from '../src/render/models/towns';
import { characterPiers, islandLayout, islandMoorings } from '../src/sim/islandLayout';
import * as legacy from './helpers/legacy/towns';
import * as legacyLayout from './helpers/legacy/islandLayout';

/**
 * Proof for decision 0097: the island files rebuild the old code's islands. For every port and
 * level, each part the old `characterTownParts` drew has a part from the file with the same
 * colours and game hooks and positions within 1e-4 reference units (the files keep six
 * decimals), and the ground, piers and moorings the simulation uses are equal. This test and
 * the legacy copy it compares with are removed once the old code is gone; the golden hashes in
 * island-files.test.ts keep guarding the result.
 */
const TOL = 1e-4;
const ports = PHASE1_MAP.islands
  .map((island, index) => ({ island, seed: PHASE1_MAP.seed * 1000 + index }))
  .filter(({ island }) => island.look?.design);

type Part = { count: number; colour: string; pos: Float32Array | number[]; data: unknown };
const describePart = (g: THREE.BufferGeometry): Part => {
  const colours = g.getAttribute('color');
  const c = colours ? Array.from(colours.array.slice(0, 3)).map((v) => v.toFixed(4)) : [];
  return {
    count: g.getAttribute('position').count,
    colour: c.join(','),
    pos: g.getAttribute('position').array as Float32Array,
    data: g.userData,
  };
};
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
};
function close(a: unknown, b: unknown, tol = TOL): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => close(v, b[i], tol));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort(),
      kb = Object.keys(b).sort();
    return (
      close(ka, kb) &&
      ka.every((k) =>
        close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol),
      )
    );
  }
  return a === b;
}

/** Old parts the new build has no match for, and new parts left over. */
function unmatched(old: THREE.BufferGeometry[], fresh: THREE.BufferGeometry[]) {
  const pool = new Map<string, Part[]>();
  for (const g of fresh) {
    const p = describePart(g);
    const key = `${p.count}|${p.colour}`;
    pool.set(key, [...(pool.get(key) ?? []), p]);
  }
  const missing: Part[] = [];
  for (const g of old) {
    const p = describePart(g);
    const candidates = pool.get(`${p.count}|${p.colour}`) ?? [];
    const i = candidates.findIndex((q) => maxDiff(p.pos, q.pos) <= TOL && close(p.data, q.data));
    if (i < 0) missing.push(p);
    else candidates.splice(i, 1);
  }
  return { missing, extra: [...pool.values()].flat() };
}

describe('island files rebuild the old islands (decision 0097)', () => {
  for (const { island, seed } of ports)
    for (const level of [1, 2, 3, 4] as TownLevel[])
      it(`${island.name} at level ${level}`, () => {
        const design = islandDesign(island.look!.design!);
        const kind = design.style;
        const R = island.radius / 2.2;
        const spec = {
          seed,
          level,
          kind,
          R,
          sx: 1,
          sz: 1,
          pier: { x: R * 0.08, z0: R * 0.85, len: Math.min(R * 0.75, 4.5) },
        };
        const old = legacy.townIslandParts({ ...spec, profile: kind });
        const fresh = townIslandParts({ ...spec, design: design.id });
        const { missing, extra } = unmatched(old, fresh);
        const show = (ps: Part[]) =>
          ps
            .slice(0, 5)
            .map(
              (p) =>
                `${p.count} ${p.colour} ${JSON.stringify(p.data)} ${p.pos[0]},${p.pos[1]},${p.pos[2]}`,
            );
        expect(show(missing), 'old parts without a match').toEqual([]);
        expect(show(extra), 'new parts without a match').toEqual([]);
        expect(fresh.length).toBe(old.length);

        // Ground, piers and moorings: the simulation's collision, docking and placement.
        const a = legacyLayout.islandLayout(kind, level),
          b = islandLayout(design, level);
        expect(close(b.coasts, a.coasts, 1e-6)).toBe(true);
        expect(close(b.lake ?? null, a.lake ?? null, 1e-6)).toBe(true);
        expect(
          close(
            b.surfaces.map((s) => [s.outline, s.holes ?? [], s.height, s.material]),
            a.surfaces.map((s) => [s.outline, s.holes ?? [], s.height, s.material]),
            1e-6,
          ),
        ).toBe(true);
        expect(characterPiers(design, R, level)).toEqual(
          legacyLayout.characterPiers(kind, R, level),
        );
        expect(
          close(
            islandMoorings(design, level),
            kind === 'fish' ? legacyLayout.fishingMoorings(level) : [],
            1e-6,
          ),
        ).toBe(true);
        [...old, ...fresh].forEach((g) => g.dispose());
      });
});
