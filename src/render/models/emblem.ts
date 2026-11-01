import * as THREE from 'three';

/**
 * A sail logo's SVG (decision 0261: flat filled shapes only) as flat triangles, no DOM needed, so
 * the game, the tests and `npm run cosmetics` read it alike. Points come out centred on the
 * viewBox, scaled so its larger side is 1, x to the right and y up. Each `path` fills by its
 * outlines (an outline inside another is a hole); circles and ellipses are octagons, curves a few pieces.
 */

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const CIRCLE_SIDES = 8;
const CURVE_PIECES = 4;

const nums = (s: string | undefined) => (s?.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
const attr = (attrs: string, name: string) =>
  new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];

/** a then b, as SVG's matrix(a b c d e f). */
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** An SVG `transform` list: translate, scale, rotate (about a point) and matrix. */
export function parseTransform(text: string | undefined): Matrix {
  let m = IDENTITY;
  for (const [, op, args] of (text ?? '').matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const [a = 0, b, c] = nums(args);
    let t: Matrix = IDENTITY;
    if (op === 'translate') t = [1, 0, 0, 1, a, b ?? 0];
    else if (op === 'scale') t = [a, 0, 0, b ?? a, 0, 0];
    else if (op === 'matrix') t = nums(args).slice(0, 6) as Matrix;
    else if (op === 'rotate') {
      const r = (a * Math.PI) / 180;
      const [cos, sin] = [Math.cos(r), Math.sin(r)];
      const [cx, cy] = [b ?? 0, c ?? 0];
      t = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
    }
    m = multiply(m, t);
  }
  return m;
}

const ring = (cx: number, cy: number, rx: number, ry: number) =>
  Array.from({ length: CIRCLE_SIDES }, (_, i) => {
    const a = (i / CIRCLE_SIDES) * Math.PI * 2;
    return new THREE.Vector2(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  });

/** A path's outlines: one ShapePath, so `toShapes` can tell holes by their winding. */
function pathShapes(d: string): THREE.Shape[] {
  const sp = new THREE.ShapePath();
  let [x, y, sx, sy] = [0, 0, 0, 0];
  // The last control point, for the smooth curves S and T.
  let [cx, cy] = [0, 0];
  let last = '';
  for (const [, cmd, args] of d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
    const rel = cmd !== cmd!.toUpperCase();
    const c = cmd!.toUpperCase();
    const v = nums(args);
    const ox = () => (rel ? x : 0);
    const oy = () => (rel ? y : 0);
    if (c === 'Z') {
      [x, y] = [sx, sy];
      last = c;
      continue;
    }
    const size = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7 }[c] ?? 0;
    for (let i = 0; size && i + size <= v.length; i += size) {
      const p = v.slice(i, i + size);
      if (c === 'M' && i === 0) {
        [x, y] = [p[0]! + ox(), p[1]! + oy()];
        [sx, sy] = [x, y];
        sp.moveTo(x, y);
      } else if (c === 'M' || c === 'L' || c === 'T' || c === 'H' || c === 'V') {
        const nx = c === 'V' ? x : p[0]! + ox();
        const ny = c === 'H' ? y : c === 'V' ? p[0]! + oy() : p[1]! + oy();
        if (c === 'T') {
          const [qx, qy] = 'QT'.includes(last) ? [2 * x - cx, 2 * y - cy] : [x, y];
          sp.quadraticCurveTo(qx, qy, nx, ny);
          [cx, cy] = [qx, qy];
        } else sp.lineTo(nx, ny);
        [x, y] = [nx, ny];
      } else if (c === 'Q') {
        [cx, cy] = [p[0]! + ox(), p[1]! + oy()];
        const [nx, ny] = [p[2]! + ox(), p[3]! + oy()];
        sp.quadraticCurveTo(cx, cy, nx, ny);
        [x, y] = [nx, ny];
      } else if (c === 'C' || c === 'S') {
        const [x1, y1] =
          c === 'C'
            ? [p[0]! + ox(), p[1]! + oy()]
            : 'CS'.includes(last)
              ? [2 * x - cx, 2 * y - cy]
              : [x, y];
        const k = c === 'C' ? 2 : 0;
        [cx, cy] = [p[k]! + ox(), p[k + 1]! + oy()];
        const [nx, ny] = [p[k + 2]! + ox(), p[k + 3]! + oy()];
        sp.bezierCurveTo(x1, y1, cx, cy, nx, ny);
        [x, y] = [nx, ny];
      } else if (c === 'A') {
        const [nx, ny] = [p[5]! + ox(), p[6]! + oy()];
        for (const q of arcPoints(x, y, p[0]!, p[1]!, p[2]!, p[3]!, p[4]!, nx, ny))
          sp.lineTo(q.x, q.y);
        [x, y] = [nx, ny];
      }
      last = c;
    }
  }
  return sp.toShapes();
}

/** An SVG arc (endpoint form, SVG 1.1 appendix F.6) as a few points, the end point last. */
function arcPoints(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  turnDeg: number,
  large: number,
  sweep: number,
  x1: number,
  y1: number,
): THREE.Vector2[] {
  if (!rx || !ry) return [new THREE.Vector2(x1, y1)];
  const phi = (turnDeg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const px = cos * dx + sin * dy;
  const py = -sin * dx + cos * dy;
  const grow = Math.max(1, Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry)));
  [rx, ry] = [Math.abs(rx) * grow, Math.abs(ry) * grow];
  const num = rx * rx * ry * ry - rx * rx * py * py - ry * ry * px * px;
  const k =
    (large === sweep ? -1 : 1) *
    Math.sqrt(Math.max(0, num / (rx * rx * py * py + ry * ry * px * px)));
  const qx = (k * rx * py) / ry;
  const qy = (-k * ry * px) / rx;
  const ccx = cos * qx - sin * qy + (x0 + x1) / 2;
  const ccy = sin * qx + cos * qy + (y0 + y1) / 2;
  const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
  const a0 = angle((px - qx) / rx, (py - qy) / ry);
  let da = angle((-px - qx) / rx, (-py - qy) / ry) - a0;
  if (sweep && da < 0) da += Math.PI * 2;
  if (!sweep && da > 0) da -= Math.PI * 2;
  const steps = Math.max(2, Math.ceil((Math.abs(da) / Math.PI) * 3));
  return Array.from({ length: steps }, (_, i) => {
    const a = a0 + (da * (i + 1)) / steps;
    const ex = rx * Math.cos(a);
    const ey = ry * Math.sin(a);
    return new THREE.Vector2(cos * ex - sin * ey + ccx, sin * ex + cos * ey + ccy);
  });
}

/** One element's filled outlines, before its transform. */
function elementShapes(tag: string, attrs: string): THREE.Shape[] {
  const n = (name: string) => Number(attr(attrs, name) ?? 0);
  if (tag === 'path') return pathShapes(attr(attrs, 'd') ?? '');
  let pts: THREE.Vector2[] = [];
  if (tag === 'polygon') {
    const v = nums(attr(attrs, 'points'));
    for (let i = 0; i + 1 < v.length; i += 2) pts.push(new THREE.Vector2(v[i], v[i + 1]));
  } else if (tag === 'rect') {
    const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
    pts = [x, x + w, x + w, x].map((px, i) => new THREE.Vector2(px, i < 2 ? y : y + h));
  } else if (tag === 'circle') pts = ring(n('cx'), n('cy'), n('r'), n('r'));
  else if (tag === 'ellipse') pts = ring(n('cx'), n('cy'), n('rx'), n('ry'));
  return pts.length >= 3 ? [new THREE.Shape(pts)] : [];
}

/** Flat triangles of an emblem, as x, y pairs (three points a triangle), counter-clockwise. */
export function emblemTriangles(svg: string): Float32Array {
  const [vx = 0, vy = 0, vw = 1, vh = 1] = nums(/\bviewBox="([^"]*)"/.exec(svg)?.[1]);
  const unit = Math.max(vw, vh) || 1;
  const out: number[] = [];
  const stack: Matrix[] = [IDENTITY];
  for (const [, close, tag, attrs, selfClose] of svg.matchAll(/<(\/?)(\w+)\b([^>]*?)(\/?)>/g)) {
    if (tag === 'g') {
      if (close) stack.pop();
      else if (!selfClose)
        stack.push(multiply(stack.at(-1)!, parseTransform(attr(attrs!, 'transform'))));
      continue;
    }
    if (close || tag === 'svg' || tag === 'title') continue;
    const m = multiply(stack.at(-1)!, parseTransform(attr(attrs!, 'transform')));
    // SVG y runs down; flipping it turns each outline's winding, so flip back to keep it.
    const place = (p: THREE.Vector2) =>
      new THREE.Vector2(
        (m[0] * p.x + m[2] * p.y + m[4] - vx - vw / 2) / unit,
        -(m[1] * p.x + m[3] * p.y + m[5] - vy - vh / 2) / unit,
      );
    for (const shape of elementShapes(tag!, attrs!)) {
      const { shape: outline, holes } = shape.extractPoints(CURVE_PIECES);
      const contour = dedupe(outline.map(place));
      const inner = holes.map((h) => dedupe(h.map(place)));
      if (contour.length < 3) continue;
      if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
      for (const h of inner) if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
      const all = [...contour, ...inner.flat()];
      for (const tri of THREE.ShapeUtils.triangulateShape(contour, inner)) {
        const [a, b, c] = tri.map((i) => all[i]!) as [THREE.Vector2, THREE.Vector2, THREE.Vector2];
        // Counter-clockwise, so each face of the sail can tell its reading side.
        const ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) >= 0;
        for (const p of ccw ? [a, b, c] : [a, c, b]) out.push(p.x, p.y);
      }
    }
  }
  return new Float32Array(out);
}

/** Drops a closing point equal to the first, which earcut would count twice. */
function dedupe(points: THREE.Vector2[]): THREE.Vector2[] {
  const first = points[0];
  const last = points.at(-1);
  return first && last && points.length > 1 && first.distanceTo(last) < 1e-9
    ? points.slice(0, -1)
    : points;
}
