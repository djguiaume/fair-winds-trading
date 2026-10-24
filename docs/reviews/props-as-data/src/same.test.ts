import { expect, it } from 'vitest';
import * as THREE from 'three';
import { buildRecipe, type Recipe } from './recipe';
import palette from './palette.json';
import fish from './props/fish-house.json';
import hall from './props/market-hall.json';
import mill from './props/windmill.json';
import { PROP_TYPES } from '../../../../src/render/models/props';

const dump = (parts: THREE.BufferGeometry[]) =>
  parts.map((g) => ['position', 'color'].map((n) => Array.from(g.getAttribute(n).array, (v) => v.toFixed(4)).join(',')).join('|') + (g.userData.window ? 'W' : ''));

for (const [r, id] of [[fish, 'fish-house'], [hall, 'market-hall'], [mill, 'windmill']] as const)
  it(`${id} from data equals code`, () => {
    for (const variant of [0, 1, 2, 3, 5])
      for (const shape of [0, 0.3, 0.5, 1]) {
        const args = { R: 20, style: 'timber' as const, variant, shape, size: 1 };
        expect(dump(buildRecipe(r as unknown as Recipe, palette, args))).toEqual(dump(PROP_TYPES[id]!.build(args)));
      }
  });
it('windmill-bare from the same file', () => {
  const r = structuredClone(mill) as unknown as Recipe;
  r.vars = { bare: 1 };
  expect(dump(buildRecipe(r, palette, { variant: 0, shape: 0.5, style: 'fish' }))).toEqual(
    dump(PROP_TYPES['windmill-bare']!.build({ R: 20, style: 'fish', variant: 0, shape: 0.5, size: 1 })));
});
