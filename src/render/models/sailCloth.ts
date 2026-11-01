import * as THREE from 'three';
import { BOAT_LOOK, canvasColour, sailRow, sailRowEdges, type BoatLook } from './boatLook';
import { STYLE_D as ST } from './boatStyle';
import { Faces } from './hullGeometry';
import { paintMarks, type SailMark } from './sailMarks';
import { panelPaint } from './sailPatterns';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Damage on a sail (decision 0208): patched canvas, and holes in the panels at `tears`. */
export interface ClothWear {
  patched?: boolean;
  tears?: ReadonlyArray<{ u: number; v: number }>;
}

/** A sail's damage and the marks painted on it (a logo, the racing number: sailMarks.ts). */
export interface ClothDress extends ClothWear {
  marks?: readonly SailMark[];
}

/** Where a damaged sail's patches sit, as fractions along the foot and up the luff (0208). */
const PATCH_SPOTS = [
  [0.2, 0.25],
  [0.78, 0.3],
  [0.22, 0.78],
  [0.8, 0.8],
] as const;

/** Cloth edges have zero belly, so tack, luff, head and spar attachments cannot drift.
 * `nu` × `nv` panels; the upgrade bands and stripe run across whole rows (sailRow); a pattern
 * (sailPatterns.ts) paints the canvas rows, and the stripe's too. Damage draws over all of them,
 * and marks (sailMarks.ts) over everything but damage. */
export function cloth(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  level: number,
  belly: number,
  look: BoatLook,
  nu = 6,
  nv = 6,
  wear: ClothDress = {},
) {
  const f = new Faces(true);
  // A patched sail (decision 0208) takes the stock canvas look, keeping its bands.
  const worn = level === 1 || wear.patched === true;
  // Damage patches (decision 0208): four big squares of darker, warmer canvas, two panels each
  // way, clear of the middle where a torn sail has its hole.
  const patched = new Set<string>();
  if (wear.patched)
    for (const [u, v] of PATCH_SPOTS) {
      const i0 = Math.max(0, Math.min(nu - 2, Math.round(u * nu - 1)));
      const j0 = Math.max(0, Math.min(nv - 2, Math.round(v * nv - 1)));
      for (const [di, dj] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        patched.add(`${i0 + di!}:${j0 + dj!}`);
    }
  const torn = new Set(
    (wear.tears ?? []).map(
      (t) => `${Math.min(nu - 1, Math.floor(t.u * nu))}:${Math.min(nv - 1, Math.floor(t.v * nv))}`,
    ),
  );
  const at = (u: number, v: number) =>
    V(
      -belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
      (a.y * (1 - u) + b.y * u) * (1 - v) + (c.y * (1 - u) + d.y * u) * v,
      (a.z * (1 - u) + b.z * u) * (1 - v) + (c.z * (1 - u) + d.z * u) * v,
    );
  const canvas = canvasColour(look, level, worn);
  // A pattern other than plain bands paints the canvas and the sails-3 stripe rows.
  const pattern = look.sailPattern?.kind === 'bands' ? null : look.sailPattern;
  const rows = sailRowEdges(level, nv);
  for (let j = 0; j < nv; j++) {
    const row = sailRow(level, j, nv);
    for (let i = 0; i < nu; i++) {
      if (torn.has(`${i}:${j}`)) continue;
      const [u0, u1, v0, v1] = [i / nu, (i + 1) / nu, rows[j]!, rows[j + 1]!];
      const corners = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)] as const;
      let color = canvas;
      let glow = 1;
      if (patched.has(`${i}:${j}`)) color = ST.damagePatches[(i + j) % 2]!;
      else if (row === 'band' || (row === 'stripe' && !pattern)) {
        color = row === 'band' ? look.sailBand : look.sailStripe;
        glow = BOAT_LOOK.sails.bandGlow;
      } else if (pattern) {
        patternPanel(f, corners, panelPaint(pattern.kind, i, j, nu, nv), pattern.colours, canvas);
        continue;
      } else if (worn && (i * 7 + j * 3) % 8 === 1) color = ST.patches[(i + j) % 2]!;
      f.quad(...corners, color, glow);
    }
  }
  if (wear.marks?.length) {
    const cell = (u: number, v: number) =>
      `${Math.min(nu - 1, Math.floor(u * nu))}:${Math.max(0, rows.findIndex((e) => e > v) - 1)}`;
    paintMarks(
      f,
      {
        corners: [a, b, c, d],
        at,
        hidden: (u, v) => torn.has(cell(u, v)) || patched.has(cell(u, v)),
      },
      wear.marks,
    );
  }
  return f.geometry();
}

/** One canvas panel under a pattern: two triangles split along the pattern's edge. */
function patternPanel(
  f: Faces,
  [a, b, c, d]: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
  { split, paint }: ReturnType<typeof panelPaint>,
  colours: readonly string[],
  canvas: string,
) {
  const [first, second] =
    split === 'ac'
      ? [
          [a, b, c],
          [a, c, d],
        ]
      : [
          [a, b, d],
          [b, c, d],
        ];
  for (const [k, tri] of [first!, second!].entries()) {
    const p = paint[k]!;
    const colour = p < 0 ? canvas : (colours[p] ?? colours[0]!);
    f.tri(tri[0]!, tri[1]!, tri[2]!, colour, p < 0 ? 1 : BOAT_LOOK.sails.bandGlow);
  }
}
