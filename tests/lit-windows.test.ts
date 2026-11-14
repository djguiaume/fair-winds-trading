import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PROP_RECIPES } from '../src/data/props';
import { TUNING } from '../src/data/tuning';
import { buildProp } from '../src/render/models/propRecipe';

const homes = Object.values(PROP_RECIPES).filter((r) => r.home && !r.internal);
const args = (id: string, variant: number) => ({
  R: 1,
  style: PROP_RECIPES[id]!.style ?? 'fish',
  variant,
  shape: 0.9,
  size: 1,
});
const PITCH = (TUNING.camera.pitchDeg * Math.PI) / 180;
/** The sea camera looking at a house from each corner, at its usual pitch. */
const CORNERS = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
].map(([x, z]) =>
  new THREE.Vector3(x, 0, z).normalize().multiplyScalar(Math.cos(PITCH)).setY(Math.sin(PITCH)),
);
const boxOf = (g: THREE.BufferGeometry) =>
  new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);

/**
 * How many corners see the middle of a lit pane: not buried in `solid`, nor hidden behind it or
 * under a deep eave.
 */
function cornersLit(panes: THREE.BufferGeometry[], solid: THREE.BufferGeometry[]): number {
  const both = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); // a buried pane hits a back face
  const walls = solid.map((g) => new THREE.Mesh(g, both));
  const lit = panes
    .filter((g) => (g.attributes.color as THREE.BufferAttribute).getX(0) > 0.6) // not dark glass
    .map((g) => ({
      centre: boxOf(g).getCenter(new THREE.Vector3()),
      normal: new THREE.Vector3().fromBufferAttribute(
        g.attributes.normal as THREE.BufferAttribute,
        0,
      ),
    }));
  const ray = new THREE.Raycaster();
  const seen = (centre: THREE.Vector3, view: THREE.Vector3) => {
    ray.set(centre.clone().addScaledVector(view, 0.002), view);
    return ray.intersectObjects(walls, false).length === 0;
  };
  return CORNERS.filter((view) =>
    lit.some(({ centre, normal }) => normal.dot(view) > 0 && seen(centre, view)),
  ).length;
}

describe('lit windows at night (art bible rule 10, issue #525)', () => {
  it('shows a lit window on every home from any side, plain or rich', () => {
    const dark: string[] = [];
    for (const home of homes)
      for (let variant = 0; variant < 12; variant++) {
        const plain = buildProp(home.id, args(home.id, variant));
        const panes = plain.filter((g) => g.userData.window);
        const rich = home.rich ? buildProp(home.rich, args(home.id, variant)) : [];
        for (const [look, parts] of [
          ['plain', plain],
          ['rich', rich],
        ] as const) {
          if (!parts.length) continue;
          const solid = parts.filter((g) => !g.userData.window);
          if (cornersLit(panes, solid) < CORNERS.length) dark.push(`${home.id} ${look} ${variant}`);
        }
      }
    expect(dark).toEqual([]);
  });
});
