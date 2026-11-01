import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOGUE as CAT } from '../src/data/cosmetics';
import { SHIP_FILES } from '../src/data/ships';
import { wornLook } from '../src/render/boatAppearance';
import { createBoatModel } from '../src/render/models';
import type { ShipUpgrades, UpgradeLevel } from '../src/render/models/types';
import { RULES, type Appearance, type Slot } from '../src/sim/cosmetics';

// Issue #301: every class wears every upgrade level with every figurehead, and a fully dressed
// look on any upgrade mix and damage state builds, stays inside the declared bounds and frees
// what it made.

const LEVELS: UpgradeLevel[] = [1, 2, 3];
const MIXES: ShipUpgrades[] = LEVELS.flatMap((sails) =>
  LEVELS.flatMap((hold) => LEVELS.map((hull) => ({ sails, hold, hull }))),
);
const idsOf = (slot: Slot) => CAT.items.filter((i) => i.slot === slot).map((i) => i.id);
const FIGUREHEADS = idsOf('figurehead');
const DRESSED = (n: number): Partial<Appearance> => ({
  sailColour: idsOf('sail-colour')[n % idsOf('sail-colour').length]!,
  sailPattern: idsOf('sail-pattern')[(n % 8) + 1]!,
  sailLogo: idsOf('sail-logo')[n % idsOf('sail-logo').length]!,
  hullColour: idsOf('hull-colour')[n % idsOf('hull-colour').length]!,
  figurehead: FIGUREHEADS[n % FIGUREHEADS.length]!,
});

/** Triangles and meshes (one draw call each) of a built model. */
function cost(root: THREE.Object3D) {
  let triangles = 0;
  let meshes = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return { triangles, meshes };
}

function build(ship: string, upgrades: ShipUpgrades, want: Partial<Appearance>, damage = 0) {
  const worn = wornLook(want, ship);
  return createBoatModel(ship, {
    upgrades,
    damage: damage as 0 | 1 | 2 | 3,
    look: worn.look,
    ...(worn.flag ? { flag: worn.flag } : {}),
  });
}

describe('upgrade and cosmetic combinations', () => {
  it('every class builds every upgrade mix, dressed, at every damage state', () => {
    for (const file of SHIP_FILES)
      MIXES.forEach((mix, n) => {
        const boat = build(file.id, mix, DRESSED(n), n % 4);
        const { triangles, meshes } = cost(boat.root);
        expect(triangles, `${file.id} ${JSON.stringify(mix)}`).toBeGreaterThan(0);
        expect(meshes).toBeGreaterThan(0);
        boat.dispose();
      });
  });

  it('a figurehead and a logo add triangles but no draw call, within the declared caps', () => {
    for (const file of SHIP_FILES)
      for (const mix of [MIXES[0]!, MIXES[MIXES.length - 1]!]) {
        const bare = cost(build(file.id, mix, {}).root);
        const logoCap = RULES.maxTriangles['sail-logo'] * 2;
        const dressed = cost(build(file.id, mix, { sailLogo: 'gull' }).root);
        expect(dressed.meshes, `${file.id} logo`).toBe(bare.meshes);
        expect(dressed.triangles - bare.triangles, `${file.id} logo`).toBeLessThanOrEqual(logoCap);
        for (const head of FIGUREHEADS) {
          const crowned = cost(build(file.id, mix, { figurehead: head }).root);
          expect(crowned.meshes, `${file.id} ${head}`).toBe(bare.meshes);
          expect(crowned.triangles - bare.triangles, `${file.id} ${head}`).toBeGreaterThan(0);
          expect(crowned.triangles - bare.triangles, `${file.id} ${head}`).toBeLessThanOrEqual(
            RULES.maxTriangles.figurehead,
          );
        }
      }
  });

  it('the none option draws no figurehead on any class', () => {
    for (const file of SHIP_FILES) {
      const a = cost(build(file.id, MIXES[0]!, {}).root);
      const b = cost(build(file.id, MIXES[0]!, { figurehead: null }).root);
      expect(b).toEqual(a);
    }
  });
});
