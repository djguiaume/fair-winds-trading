import * as THREE from 'three';
import type { Rng } from '../../sim/rng';
import {
  PALETTE,
  PROP_RECIPES,
  type Num,
  type PropRecipe,
  type RecipePart,
} from '../../data/props';
import { glowing, paint, paintFaces, triangleCount, windowPanes } from './geometry';

/**
 * Builds props from their recipe files (decision 0135). A recipe is a list of primitive parts
 * placed and coloured by numbers or small expressions; this file reads them. A shape numbers
 * cannot describe is a named code part below, written once and usable by any recipe.
 */
export type Parts = THREE.BufferGeometry[];

export interface PropBuildArgs {
  /** The island's radius in reference units, for props sized in radius units. */
  R: number;
  /** The island's style: walls and roofs come from it unless the recipe fixes one. */
  style: string;
  variant: number;
  shape: number;
  size: number;
  length?: number;
  /** Where `range` vars draw from: by default the island file's `shape` for every draw. */
  rng?: Rng;
  /** Var values that replace the recipe's (the old town code's `crates(5)`). */
  vars?: Record<string, number>;
}

type Scope = Record<string, number>;
type Expr = (scope: Scope) => number;

// ---------------------------------------------------------------- expressions

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  floor: Math.floor,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  sin: Math.sin,
  cos: Math.cos,
  sqrt: Math.sqrt,
  pow: Math.pow,
};
const TOKEN = /\s*(\d*\.\d+|\d+|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||[-+*/%()<>?:,!])/y;
const compiled = new Map<string, Expr>();

/**
 * Compiles an expression once: numbers, names, `pi`, + − × ÷ %, comparisons, `&&`, `||`, `!`,
 * `a ? b : c`, brackets and the functions above. No `eval`.
 */
export function compileExpression(src: string): Expr {
  const done = compiled.get(src);
  if (done) return done;
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(at))) break;
      throw new Error(`Cannot read "${src}" at "${src.slice(at)}"`);
    }
    tokens.push(m[1]!);
  }
  let i = 0;
  const peek = () => tokens[i];
  const take = (t?: string) => {
    const got = tokens[i++];
    if (got === undefined || (t !== undefined && got !== t))
      throw new Error(`Cannot read "${src}": expected ${t ?? 'more'}`);
    return got;
  };
  const atom = (): Expr => {
    const t = take();
    if (t === '(') {
      const e = ternary();
      take(')');
      return e;
    }
    if (t === '-') {
      const e = atom();
      return (s) => -e(s);
    }
    if (t === '!') {
      const e = atom();
      return (s) => (e(s) ? 0 : 1);
    }
    if (/^[\d.]/.test(t)) {
      const v = Number(t);
      return () => v;
    }
    if (!/^[A-Za-z_]/.test(t)) throw new Error(`Cannot read "${src}" at "${t}"`);
    if (t === 'pi') return () => Math.PI;
    if (peek() === '(') {
      const fn = FUNCTIONS[t];
      if (!fn) throw new Error(`Unknown function "${t}" in "${src}"`);
      take('(');
      const args: Expr[] = [];
      if (peek() !== ')')
        do args.push(ternary());
        while (peek() === ',' && take(','));
      take(')');
      return (s) => fn(...args.map((a) => a(s)));
    }
    return (s) => {
      const v = s[t];
      if (v === undefined) throw new Error(`Unknown name "${t}" in "${src}"`);
      return v;
    };
  };
  const binary =
    (next: () => Expr, ops: Record<string, (a: number, b: number) => number>) => () => {
      let e = next();
      while (peek() !== undefined && ops[peek()!]) {
        const op = ops[take()]!;
        const l = e,
          r = next();
        e = (s) => op(l(s), r(s));
      }
      return e;
    };
  const mul = binary(atom, { '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b });
  const add = binary(mul, { '+': (a, b) => a + b, '-': (a, b) => a - b });
  const cmp = binary(add, {
    '<': (a, b) => +(a < b),
    '>': (a, b) => +(a > b),
    '<=': (a, b) => +(a <= b),
    '>=': (a, b) => +(a >= b),
    '==': (a, b) => +(a === b),
    '!=': (a, b) => +(a !== b),
  });
  const and = binary(cmp, { '&&': (a, b) => (a ? b : a) });
  const or = binary(and, { '||': (a, b) => a || b });
  function ternary(): Expr {
    const c = or();
    if (peek() !== '?') return c;
    take('?');
    const a = ternary();
    take(':');
    const b = ternary();
    return (s) => (c(s) ? a(s) : b(s));
  }
  const e = ternary();
  if (i < tokens.length) throw new Error(`Cannot read "${src}" at "${tokens[i]}"`);
  compiled.set(src, e);
  return e;
}

const num = (v: Num | undefined, s: Scope, fallback = 0) =>
  v === undefined ? fallback : typeof v === 'number' ? v : compileExpression(v)(s);

// ---------------------------------------------------------------- code parts

/**
 * Shapes written in code, by name (the ship parts pattern, decision 0109). Each returns an
 * unpainted geometry; the recipe part colours and places it.
 */
export const CODE_PARTS: Record<string, (scope: Scope) => THREE.BufferGeometry> = {
  /** The planked hull on a working slipway: a lofted, open curved shell. */
  'slip-hull': () => {
    const vertices: number[] = [];
    const point = (section: number, arc: number) => {
      const t = section / 8,
        a = -Math.PI / 2 + (arc / 6) * Math.PI;
      const width = 0.12 + Math.pow(Math.sin(t * Math.PI), 0.65) * 1.05;
      return [Math.sin(a) * width, 1.25 - Math.cos(a) * width, -2.3 + t * 4.6];
    };
    for (let section = 0; section < 8; section++)
      for (let arc = 0; arc < 6; arc++) {
        const a = point(section, arc),
          b = point(section + 1, arc),
          c = point(section + 1, arc + 1),
          d = point(section, arc + 1);
        vertices.push(...a, ...b, ...c, ...a, ...c, ...d, ...c, ...b, ...a, ...d, ...c, ...a);
      }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    hull.computeVertexNormals();
    return hull;
  },
  /**
   * A fore-and-aft sail (decision 0214's other boats): flat, in the boat's centre plane, its luff
   * up the mast from the origin and its foot aft along −Z. `foot` and `luff` long, the head
   * `head` long, peaked up `peak` at the leech: a gaff or lug sail, or a jib-headed one at 0.
   */
  sail: (s) => {
    const foot = s.foot ?? 2;
    const luff = s.luff ?? 2;
    const head = s.head ?? 0;
    const peak = s.peak ?? 0;
    const p = [
      [0, 0, 0],
      [0, 0, -foot],
      [0, luff + peak, -Math.max(head, 0.01)],
      [0, luff, 0],
    ];
    const v = [0, 1, 2, 0, 2, 3].flatMap((k) => p[k]!);
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    sail.computeVertexNormals();
    return sail;
  },
};

// ---------------------------------------------------------------- shapes

type Shape = (a: number[], part: RecipePart, s: Scope) => THREE.BufferGeometry;

/** Gable roof: a triangular prism with its ridge along X, eaves at height y. */
function gable(w: number, d: number, h: number, y: number) {
  const shape = new THREE.Shape([
    new THREE.Vector2(-d / 2, 0),
    new THREE.Vector2(d / 2, 0),
    new THREE.Vector2(0, h),
  ]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  return g.rotateY(Math.PI / 2).translate(-w / 2, y, 0);
}

/** Hipped (pyramid) roof. */
function hip(w: number, d: number, h: number, y: number) {
  const g = new THREE.CylinderGeometry(0, 0.72, h, 4, 1).rotateY(Math.PI / 4);
  g.scale(w / 1.02, 1, d / 1.02);
  return g.translate(0, y + h / 2, 0);
}

const SHAPES: Record<string, Shape> = {
  box: ([w, h, d]) => new THREE.BoxGeometry(w, h, d),
  cyl: ([rt, rb, h, n, open, start, arc]) =>
    new THREE.CylinderGeometry(rt, rb, h, n ?? 6, 1, !!open, start ?? 0, arc ?? Math.PI * 2),
  cone: ([r, h, n]) => new THREE.ConeGeometry(r, h, n, 1, true),
  gable: ([w, d, h], p, s) => gable(w!, d!, h!, num(p.y, s)),
  hip: ([w, d, h], p, s) => hip(w!, d!, h!, num(p.y, s)),
  sphere: ([r, ws, hs, ps, pl, ts, tl]) =>
    new THREE.SphereGeometry(r, ws, hs, ps, pl ?? Math.PI * 2, ts, tl ?? Math.PI),
  ico: ([r, detail]) => new THREE.IcosahedronGeometry(r, detail ?? 0),
  dodeca: ([r, detail]) => new THREE.DodecahedronGeometry(r, detail ?? 0),
  torus: ([r, tube, rs, ts]) => new THREE.TorusGeometry(r, tube, rs, ts),
  plane: ([w, h]) => new THREE.PlaneGeometry(w, h),
};
/** The shape keys a part may have, for the checks. */
export const SHAPE_KEYS = [...Object.keys(SHAPES), 'windows', 'use', 'part', 'parts'];

// ---------------------------------------------------------------- building

function colorOf(
  color: RecipePart['color'],
  style: { walls: string[]; roofs: string[] } | undefined,
  s: Scope,
): string {
  if (color === undefined) throw new Error('A part has no color');
  if (typeof color === 'object')
    return colorOf(color.of[Math.round(num(color.pick, s)) % color.of.length], style, s);
  if (color.startsWith('#')) return color;
  const m = /^(\w+)(?:\[(.+)\])?$/.exec(color);
  if (!m) throw new Error(`Cannot read the colour "${color}"`);
  // A style's walls and roofs, then the palette colours it overrides (decision 0168).
  const st = style as
    (Record<string, string[]> & { colors?: Record<string, string | string[]> }) | undefined;
  const list = st?.[m[1]!] ?? st?.colors?.[m[1]!] ?? PALETTE.colors[m[1]!];
  if (list === undefined) throw new Error(`Unknown colour "${m[1]}"`);
  if (typeof list === 'string') return list;
  const k = m[2] ? compileExpression(m[2])(s) : 0;
  return list[((k % list.length) + list.length) % list.length]!;
}

/** Every colour a part's `color` may take: a whole list for a name with no index (`faces`). */
function colorsOf(
  color: RecipePart['color'],
  style: { walls: string[]; roofs: string[] } | undefined,
  s: Scope,
): string[] {
  if (typeof color === 'object')
    return colorsOf(color.of[Math.round(num(color.pick, s)) % color.of.length], style, s);
  const st = style as
    (Record<string, string[]> & { colors?: Record<string, string | string[]> }) | undefined;
  const list =
    color && /^\w+$/.test(color)
      ? (st?.[color] ?? st?.colors?.[color] ?? PALETTE.colors[color])
      : undefined;
  return Array.isArray(list) ? list : [colorOf(color, style, s)];
}

function transform(g: THREE.BufferGeometry, p: RecipePart, s: Scope) {
  for (const [op, ...a] of p.ops ?? []) {
    const v = a.map((x) => num(x, s));
    if (op === 'move') g.translate(v[0]!, v[1]!, v[2]!);
    else if (op === 'turnX') g.rotateX(v[0]!);
    else if (op === 'turnY') g.rotateY(v[0]!);
    else if (op === 'turnZ') g.rotateZ(v[0]!);
    else if (op === 'scale') g.scale(v[0]!, v[1] ?? v[0]!, v[2] ?? v[0]!);
    else throw new Error(`Unknown step "${op}"`);
  }
  if (p.at) g.translate(num(p.at[0], s), num(p.at[1], s), num(p.at[2], s));
}

function recipeOf(id: string): PropRecipe {
  const recipe = PROP_RECIPES[id];
  if (!recipe) throw new Error(`Unknown prop type "${id}"`);
  return recipe;
}

/** A prop type's numbers for these args: the island file's fields, then its vars in order. */
function scopeOf(recipe: PropRecipe, args: PropBuildArgs): Scope {
  const rng = args.rng ?? (() => args.shape);
  const s: Scope = {
    R: args.R,
    variant: args.variant,
    shape: args.shape,
    size: args.size,
    ...recipe.defaults,
  };
  if (args.length !== undefined) s.length = args.length;
  for (const [k, v] of Object.entries(recipe.vars ?? {})) {
    if (args.vars && k in args.vars) s[k] = args.vars[k]!;
    else if (typeof v === 'object') s[k] = v.range[0] + (v.range[1] - v.range[0]) * rng();
    else s[k] = num(v, s);
  }
  return s;
}

/**
 * Draws a prop's seeded numbers now and builds its geometry only when called, so a scatter can
 * reject a candidate without allocating it (decision 0112).
 */
export function prepareProp(id: string, args: PropBuildArgs): () => Parts {
  const recipe = recipeOf(id);
  const s = scopeOf(recipe, args);
  const style = PALETTE.styles[recipe.style ?? args.style];
  return () => {
    const out: Parts = [];
    const emit = (p: RecipePart, s: Scope) => {
      if (p.repeat) {
        const [name, values] = Object.entries(p.repeat)[0]!;
        const rest = { ...p.repeat };
        delete rest[name];
        const list = Array.isArray(values)
          ? values.map((v) => num(v, s))
          : Array.from({ length: num(values.count, s) }, (_, k) => k);
        const inner = { ...p, repeat: Object.keys(rest).length ? rest : undefined };
        for (const v of list) emit(inner, { ...s, [name]: v });
        return;
      }
      if (p.if !== undefined && !num(p.if, s)) return;
      if (p.parts) {
        const from = out.length;
        for (const q of p.parts) emit(q, s);
        // A group's own steps move its finished parts, as a placed prop moves.
        if (p.ops || p.at) for (const g of out.slice(from)) transform(g, p, s);
        return;
      }
      if (p.windows) {
        const [w, d, y, front, side, cx, cz] = p.windows.map((v) => num(v, s));
        out.push(...windowPanes(w!, d!, y!, front!, side!, num(p.seed, s), cx, cz));
        return;
      }
      if (p.use) {
        const vars = Object.fromEntries(
          Object.entries(p.vars ?? {}).map(([k, v]) => [k, num(v, s)]),
        );
        const parts = prepareProp(p.use, { ...args, vars })();
        for (const g of parts) transform(g, p, s);
        if (p.tag && parts[0]) Object.assign(parts[0].userData, p.tag);
        out.push(...parts);
        return;
      }
      let g: THREE.BufferGeometry | undefined;
      if (p.part) {
        const make = CODE_PARTS[p.part];
        if (!make) throw new Error(`Unknown code part "${p.part}"`);
        g = make(s);
      } else
        for (const [key, make] of Object.entries(SHAPES)) {
          const dims = (p as Record<string, unknown>)[key] as Num[] | undefined;
          if (dims) {
            g = make(
              dims.map((v) => num(v, s)),
              p,
              s,
            );
            break;
          }
        }
      if (!g) throw new Error(`A part of "${id}" has no shape`);
      transform(g, p, s);
      g = p.faces
        ? paintFaces(g, colorsOf(p.color, style, s))
        : paint(g, colorOf(p.color, style, s));
      if (p.glow) glowing(g);
      if (p.tag) Object.assign(g.userData, p.tag);
      out.push(g);
    };
    for (const p of recipe.parts ?? []) emit(p, s);
    if (recipe.scale !== undefined) {
      const k = num(recipe.scale, s);
      for (const g of out) g.scale(k, k, k);
    }
    return out;
  };
}

/** A prop type's parts, in reference units, front toward +Z. */
export const buildProp = (id: string, args: PropBuildArgs): Parts => prepareProp(id, args)();

// ---------------------------------------------------------------- checks

const RECIPE_KEYS = new Set([
  ...['id', 'name', 'group', 'internal', 'extends', 'home', 'building', 'water', 'lamp', 'vent'],
  ...['sizedInModel', 'fit', 'fitRadius', 'edge', 'style', 'defaults', 'vars', 'parts', 'scale'],
]);
const PART_KEYS = new Set([
  ...SHAPE_KEYS,
  ...['seed', 'y', 'ops', 'at', 'color', 'glow', 'faces', 'tag', 'if', 'repeat', 'vars'],
]);

/** The triangles of a set of parts. */
export const partsTriangles = (parts: Parts) => parts.reduce((n, g) => n + triangleCount(g), 0);

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
