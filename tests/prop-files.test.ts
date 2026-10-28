import { describe, expect, it } from 'vitest';
import { PROP_GROUPS, PROP_RECIPES, type PropRecipe } from '../src/data/props';
import { PROP_TYPES } from '../src/render/models/props';
import { buildProp, compileExpression, partsTriangles } from '../src/render/models/propRecipe';
import { checkPropRecipe } from '../src/render/models/propRecipeChecks';

describe('prop recipe files (decision 0135)', () => {
  it('every file reads, builds in every style and variant, and keeps its group budget', () => {
    const report: Record<string, string[]> = {};
    for (const recipe of Object.values(PROP_RECIPES)) {
      const { issues, triangles } = checkPropRecipe(recipe);
      const budget = PROP_GROUPS[recipe.group]?.budget;
      if (budget === undefined) issues.push(`unknown group "${recipe.group}"`);
      else if (triangles > budget)
        issues.push(`${triangles} triangles, over the ${recipe.group} budget of ${budget}`);
      if (issues.length) report[recipe.id] = issues;
    }
    expect(report).toEqual({});
  }, 30_000);

  it('offers every file but the internal pieces to the island builder', () => {
    const offered = Object.values(PROP_RECIPES).filter((r) => !r.internal);
    expect(Object.keys(PROP_TYPES)).toEqual(offered.map((r) => r.id));
    expect(PROP_TYPES['fish-house']).toMatchObject({ group: 'homes', home: true, building: true });
    expect(PROP_TYPES['windmill-bare']!.name).toBe('Windmill, bare sails');
  });

  it('names a typo, an unknown colour and a bad expression', () => {
    const check = (recipe: object) => {
      const r = { id: 'test-broken', group: 'town', ...recipe } as PropRecipe;
      PROP_RECIPES[r.id] = r;
      try {
        return checkPropRecipe(r).issues.join('; ');
      } finally {
        delete PROP_RECIPES[r.id];
      }
    };
    expect(check({ parts: [{ bx: [1, 1, 1], color: 'post' }] })).toMatch(/unknown key "bx"/);
    expect(check({ parts: [{ box: [1, 1, 1], color: 'mauve' }] })).toMatch(
      /Unknown colour "mauve"/,
    );
    expect(check({ parts: [{ box: [1, 'h +', 1], color: 'post' }] })).toMatch(/Cannot read "h \+"/);
    expect(check({ parts: [{ box: [1, 'h', 1], color: 'post' }] })).toMatch(/Unknown name "h"/);
    expect(check({ parts: [{ use: 'nothing-here' }] })).toMatch(/unknown prop "nothing-here"/);
  });

  it('reads expressions without eval', () => {
    const at = (src: string, scope = {}) => compileExpression(src)(scope);
    expect(at('1 + 2 * 3')).toBe(7);
    expect(at('(1 + 2) * 3')).toBe(9);
    expect(at('k * pi / 2 + 0.4', { k: 1 })).toBeCloseTo(Math.PI / 2 + 0.4);
    expect(at('variant == 0 ? 2 : variant', { variant: 0 })).toBe(2);
    expect(at('variant == 0 ? 2 : variant', { variant: 5 })).toBe(5);
    expect(at('!store && 1', { store: 0 })).toBe(1);
    expect(at('floor(i / 3) * 0.4 + max(1, 2)', { i: 4 })).toBeCloseTo(2.4);
    expect(at('side * -0.45', { side: -1 })).toBe(0.45);
    expect(() => at('alert(1)')).toThrow(/Unknown function/);
  });

  it('builds a new prop from a file alone, with no code', () => {
    // A copy of the fish house turned into a net loft: what a new file in src/data/props does.
    const loft: PropRecipe = {
      id: 'test-net-loft',
      group: 'fish',
      building: true,
      style: 'fish',
      vars: { h: { range: [1.7, 2.1] } },
      parts: [
        { box: [1.1, 'h', 0.9], at: [0, 'h / 2', 0], color: 'walls[variant + 1]' },
        { gable: [1.25, 1.05, 0.75], y: 'h', color: 'roofs[variant]' },
        {
          repeat: { x: [-0.3, 0, 0.3] },
          box: [0.16, 0.5, 0.03],
          at: ['x', 0.55, 0.48],
          color: '#7d8f86',
        },
        { windows: [1.1, 0.9, 'h * 0.45', 2, 1], seed: 'variant' },
      ],
    };
    PROP_RECIPES[loft.id] = loft;
    try {
      expect(checkPropRecipe(loft).issues).toEqual([]);
      const low = buildProp(loft.id, { R: 18, style: 'stone', variant: 0, shape: 0, size: 1 });
      const high = buildProp(loft.id, { R: 18, style: 'stone', variant: 0, shape: 1, size: 1 });
      expect(low).toHaveLength(2 + 3 + 6);
      high[0]!.computeBoundingBox();
      expect(high[0]!.boundingBox!.max.y).toBeCloseTo(2.1);
      expect(partsTriangles(low)).toBeLessThanOrEqual(PROP_GROUPS.fish.budget);
    } finally {
      delete PROP_RECIPES[loft.id];
    }
  });
});
