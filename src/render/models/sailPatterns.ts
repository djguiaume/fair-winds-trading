import boatLookFile from '../../data/boat-look.json';

/**
 * Sail patterns (issue #418, `boat-look.json` › `patterns`): shapes on the cloth's panel grid,
 * `nu` panels from luff to leech and `nv` from foot to head, painted panel by panel. Each panel's
 * two triangles split along the diagonal that follows the shape, so chevrons and diamonds get
 * clean slanted edges for no extra triangle. Pure (no three.js): the 3D sails and the flat
 * swatches draw from it alike. The upgrade foot and head bands (decision 0259) keep their rows
 * and draw over any pattern; a pattern takes the sails-3 stripe's rows.
 */

/** -1 the canvas, 0 the pattern colour, 1 the trim colour. */
export type Paint = -1 | 0 | 1;

const P = boatLookFile.patterns;

/** What a pattern paints at grid point (x, y): x panels from the luff, y panels up from the foot. */
export function patternPaint(kind: string, x: number, y: number, nu = 6, nv = 6): Paint {
  const mid = nu / 2;
  switch (kind) {
    case 'stripe':
      return Math.abs(Math.floor(x) + 0.5 - mid) < P.stripe.halfWidth ? 0 : -1;
    case 'panels':
      return Math.floor(x) % P.panels.every === 1 ? 0 : -1;
    case 'halves':
      return y / nv > x / nu ? 0 : -1;
    case 'chevron': {
      // Arms one panel up per panel across, peaking at the middle.
      const below = P.chevron.base + (mid - Math.abs(x - mid)) - y;
      if (below < 0) return -1;
      return below < P.chevron.depth ? 0 : below < P.chevron.depth * 2 ? 1 : -1;
    }
    case 'diamond': {
      const r = Math.abs(x - mid) + Math.abs(y - nv / 2);
      return r < P.diamond.core ? 1 : r < P.diamond.outer ? 0 : -1;
    }
    default:
      return -1;
  }
}

/**
 * Panel (i, j): `ac` splits it foot-luff to head-leech, into (a, b, c) and (a, c, d); `bd` the
 * other way, into (a, b, d) and (b, c, d), with corners a b c d at foot-luff, foot-leech,
 * head-leech, head-luff. The split cuts between the corners the pattern tells apart.
 */
export function panelPaint(
  kind: string,
  i: number,
  j: number,
  nu = 6,
  nv = 6,
): { split: 'ac' | 'bd'; paint: [Paint, Paint] } {
  const at = (s: number, t: number) => patternPaint(kind, i + s, j + t, nu, nv);
  const split = at(0.25, 0.25) !== at(0.75, 0.75) ? 'bd' : 'ac';
  const paint: [Paint, Paint] =
    split === 'ac' ? [at(2 / 3, 1 / 3), at(1 / 3, 2 / 3)] : [at(1 / 3, 1 / 3), at(2 / 3, 2 / 3)];
  return { split, paint };
}

/** Every painted triangle of a pattern on an `nu` × `nv` grid, corners as (u, v) from 0 to 1. */
export function patternTriangles(
  kind: string,
  nu = 6,
  nv = 6,
): { corners: [number, number][]; paint: 0 | 1 }[] {
  const out: { corners: [number, number][]; paint: 0 | 1 }[] = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const { split, paint } = panelPaint(kind, i, j, nu, nv);
      const [a, b, c, d] = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ].map(([x, y]) => [x! / nu, y! / nv] as [number, number]);
      const tris =
        split === 'ac'
          ? [
              [a, b, c],
              [a, c, d],
            ]
          : [
              [a, b, d],
              [b, c, d],
            ];
      tris.forEach((corners, k) => {
        const p = paint[k]!;
        if (p >= 0) out.push({ corners: corners as [number, number][], paint: p as 0 | 1 });
      });
    }
  return out;
}

/** Which pattern colours the upgrade band and stripe take (`patterns.bandColours`). */
export function bandPaints(kind: string): [number, number] {
  const table = P.bandColours as unknown as Record<string, [number, number]>;
  return table[kind] ?? table['*']!;
}
