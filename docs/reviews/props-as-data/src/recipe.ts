import * as THREE from 'three';
import { glowing, paint, windowPanes } from '../../../../src/render/models/geometry';

/**
 * PROTOTYPE (props as data review): builds a prop from a JSON recipe of primitive parts.
 * Not wired into the game.
 */
type Num = number | string;
type Vec = [Num, Num, Num];
export interface Part {
  box?: Vec;
  cyl?: [Num, Num, Num, Num?];
  gable?: [Num, Num, Num];
  hip?: [Num, Num, Num];
  windows?: [Num, Num, Num, Num, Num];
  seed?: Num;
  at?: Vec;
  y?: Num;
  /** Transform steps applied in order after the shape is made. */
  ops?: [string, ...Num[]][];
  color?: string;
  glow?: boolean;
  if?: string;
  repeat?: Record<string, Num[] | { count: number }>;
  parts?: Part[];
  use?: string;
}
export interface Recipe {
  id: string;
  style?: string;
  vars?: Record<string, Num | { shape: [number, number] }>;
  parts: Part[];
}
export interface Palette {
  colors: Record<string, string | string[]>;
  styles: Record<string, Record<string, string[]>>;
}

// A tiny expression reader: numbers, names, + - * / %, comparisons, ( ), and name[index].
function evaluate(src: string, scope: Record<string, number>): number {
  const tokens = src.match(/\d*\.\d+|\d+|[A-Za-z_]\w*|==|!=|<=|>=|[-+*/%()<>[\]]/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++]!;
  const atom = (): number => {
    const t = next();
    if (t === '(') {
      const v = cmp();
      next();
      return v;
    }
    if (t === '-') return -atom();
    if (/^[\d.]/.test(t)) return Number(t);
    if (t === 'pi') return Math.PI;
    if (!(t in scope)) throw new Error(`Unknown name "${t}" in "${src}"`);
    return scope[t]!;
  };
  const mul = (): number => {
    let v = atom();
    while (['*', '/', '%'].includes(peek()!)) {
      const op = next(),
        r = atom();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  const add = (): number => {
    let v = mul();
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + mul() : v - mul();
    return v;
  };
  const cmp = (): number => {
    const v = add();
    const op = peek();
    if (!op || !['==', '!=', '<', '>', '<=', '>='].includes(op)) return v;
    next();
    const r = add();
    return Number(
      op === '==' ? v === r : op === '!=' ? v !== r : op === '<' ? v < r : op === '>' ? v > r : op === '<=' ? v <= r : v >= r,
    );
  };
  return cmp();
}

export function buildRecipe(
  recipe: Recipe,
  palette: Palette,
  args: { variant: number; shape: number; style: string; R?: number },
  library: Record<string, Recipe> = {},
): THREE.BufferGeometry[] {
  const scope: Record<string, number> = { variant: args.variant, shape: args.shape, R: args.R ?? 1 };
  for (const [k, v] of Object.entries(recipe.vars ?? {}))
    scope[k] =
      typeof v === 'object' ? v.shape[0] + (v.shape[1] - v.shape[0]) * args.shape : num(v, scope);
  const style = palette.styles[recipe.style ?? args.style]!;
  const colorOf = (name: string, s: Record<string, number>) => {
    const m = name.match(/^(\w+)(?:\[(.+)\])?$/);
    if (!m) return name;
    const list = style[m[1]!] ?? palette.colors[m[1]!];
    if (list === undefined) return name; // a literal like #a8432f
    if (typeof list === 'string') return list;
    const k = m[2] ? evaluate(m[2], s) : 0;
    return list[((k % list.length) + list.length) % list.length]!;
  };
  const out: THREE.BufferGeometry[] = [];
  const emit = (p: Part, s: Record<string, number>) => {
    if (p.if && !evaluate(p.if, s)) return;
    if (p.repeat) {
      const [name, values] = Object.entries(p.repeat)[0]!;
      const rest = { ...p.repeat };
      delete rest[name];
      const list = Array.isArray(values)
        ? values
        : Array.from({ length: values.count }, (_, k) => k);
      for (const v of list)
        emit({ ...p, repeat: Object.keys(rest).length ? rest : undefined }, { ...s, [name]: num(v, s) });
      return;
    }
    if (p.parts) return p.parts.forEach((q) => emit(q, s));
    const n = (v: Num | undefined, d = 0) => (v === undefined ? d : num(v, s));
    if (p.windows) {
      const [w, d, y, f, sd] = p.windows.map((v) => n(v));
      out.push(...windowPanes(w!, d!, y!, f!, sd!, n(p.seed)));
      return;
    }
    let g: THREE.BufferGeometry;
    if (p.box) g = new THREE.BoxGeometry(n(p.box[0]), n(p.box[1]), n(p.box[2]));
    else if (p.cyl)
      g = new THREE.CylinderGeometry(n(p.cyl[0]), n(p.cyl[1]), n(p.cyl[2]), n(p.cyl[3], 6));
    else if (p.gable) {
      const [w, d, h] = p.gable.map((v) => n(v)) as [number, number, number];
      const sh = new THREE.Shape([
        new THREE.Vector2(-d / 2, 0),
        new THREE.Vector2(d / 2, 0),
        new THREE.Vector2(0, h),
      ]);
      g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
      g.rotateY(Math.PI / 2).translate(-w / 2, n(p.y), 0);
    } else if (p.hip) {
      const [w, d, h] = p.hip.map((v) => n(v)) as [number, number, number];
      g = new THREE.CylinderGeometry(0, 0.72, h, 4, 1).rotateY(Math.PI / 4);
      g.scale(w / 1.02, 1, d / 1.02).translate(0, n(p.y) + h / 2, 0);
    } else if (p.use) {
      const parts = buildRecipe(library[p.use]!, palette, args, library);
      for (const q of parts) applyOps(q, p, s);
      out.push(...parts);
      return;
    } else throw new Error('part has no shape');
    applyOps(g, p, s);
    g = paint(g, colorOf(p.color ?? 'post', s));
    out.push(p.glow ? glowing(g) : g);
  };
  const applyOps = (g: THREE.BufferGeometry, p: Part, s: Record<string, number>) => {
    for (const [op, ...a] of p.ops ?? []) {
      const v = a.map((x) => num(x, s));
      if (op === 'move') g.translate(v[0]!, v[1]!, v[2]!);
      else if (op === 'turnX') g.rotateX(v[0]!);
      else if (op === 'turnY') g.rotateY(v[0]!);
      else if (op === 'turnZ') g.rotateZ(v[0]!);
      else if (op === 'scale') g.scale(v[0]!, v[1] ?? v[0]!, v[2] ?? v[0]!);
    }
    if (p.at) g.translate(num(p.at[0], s), num(p.at[1], s), num(p.at[2], s));
  };
  for (const p of recipe.parts) emit(p, scope);
  return out;
}

const num = (v: Num, s: Record<string, number>) => (typeof v === 'number' ? v : evaluate(v, s));
