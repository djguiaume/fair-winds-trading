import { PALETTE, PROP_RECIPES, type PropRecipe, type RecipePart } from '../../data/props';
import { CODE_PARTS } from './propCodeParts';
import { SHAPE_KEYS, buildProp, partsTriangles } from './propRecipe';

/** Prop recipe checks (decision 0135): unknown keys, shapes, and that every recipe builds. */
const RECIPE_KEYS = new Set([
  ...['id', 'name', 'group', 'internal', 'extends', 'home', 'building', 'water', 'lamp', 'vent'],
  ...['sizedInModel', 'fit', 'fitRadius', 'edge', 'style', 'defaults', 'vars', 'parts', 'scale'],
  'protect',
]);
const PART_KEYS = new Set([
  ...SHAPE_KEYS,
  ...[
    'seed',
    'pane',
    'y',
    'ops',
    'at',
    'color',
    'band',
    'glow',
    'faces',
    'tag',
    'if',
    'repeat',
    'vars',
  ],
]);

/**
 * Problems with a prop recipe, in words: unknown keys (a typo), a part with no shape or two, and
 * anything that fails to build for the variants 0 to 5 and shapes 0 to 1 in every style. Returns
 * the most triangles it built too, for the group's budget.
 */
export function checkPropRecipe(recipe: PropRecipe): { issues: string[]; triangles: number } {
  const issues: string[] = [];
  for (const k of Object.keys(recipe)) if (!RECIPE_KEYS.has(k)) issues.push(`unknown key "${k}"`);
  const walk = (p: RecipePart, where: string) => {
    for (const k of Object.keys(p))
      if (!PART_KEYS.has(k)) issues.push(`${where}: unknown key "${k}"`);
    const shapes = SHAPE_KEYS.filter((k) => k in p);
    if (shapes.length !== 1)
      issues.push(`${where}: needs one shape, has ${shapes.join(', ') || 'none'}`);
    if (p.use && !PROP_RECIPES[p.use]) issues.push(`${where}: uses unknown prop "${p.use}"`);
    if (p.part && !CODE_PARTS[p.part]) issues.push(`${where}: unknown code part "${p.part}"`);
    p.parts?.forEach((q, i) => walk(q, `${where}.parts[${i}]`));
  };
  recipe.parts?.forEach((p, i) => walk(p, `parts[${i}]`));
  if (!recipe.parts?.length) issues.push('has no parts');
  let triangles = 0;
  if (!issues.length)
    try {
      for (const style of Object.keys(PALETTE.styles))
        for (let variant = 0; variant <= 5; variant++)
          for (const shape of [0, 0.5, 1]) {
            const parts = buildProp(recipe.id, { R: 18, style, variant, shape, size: 1 });
            triangles = Math.max(triangles, partsTriangles(parts));
            for (const g of parts) g.dispose();
          }
    } catch (e) {
      issues.push((e as Error).message);
    }
  return { issues, triangles };
}
