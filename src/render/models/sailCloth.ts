import * as THREE from 'three';
import { BOAT_LOOK, canvasColour, sailRow, sailRowEdges, type BoatLook } from './boatLook';
import { STYLE_D as ST } from './boatStyle';
import { Faces } from './hullGeometry';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Damage on a sail (decision 0208): patched canvas, and holes in the panels at `tears`. */
export interface ClothWear {
  patched?: boolean;
  tears?: ReadonlyArray<{ u: number; v: number }>;
}

/** Where a damaged sail's patches sit, as fractions along the foot and up the luff (0208). */
const PATCH_SPOTS = [
  [0.2, 0.25],
  [0.78, 0.3],
  [0.22, 0.78],
  [0.8, 0.8],
] as const;

/** Cloth edges have zero belly, so tack, luff, head and spar attachments cannot drift.
 * `nu` × `nv` panels; the upgrade bands and stripe run across whole rows (sailRow). */
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
  wear: ClothWear = {},
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
  const rows = sailRowEdges(level, nv);
  for (let j = 0; j < nv; j++) {
    const row = sailRow(level, j, nv);
    for (let i = 0; i < nu; i++) {
      if (torn.has(`${i}:${j}`)) continue;
      let color = canvas;
      let glow = 1;
      if (patched.has(`${i}:${j}`)) color = ST.damagePatches[(i + j) % 2]!;
      else if (worn && row === 'canvas' && (i * 7 + j * 3) % 8 === 1)
        color = ST.patches[(i + j) % 2]!;
      else if (row !== 'canvas') {
        color = row === 'band' ? look.sailBand : look.sailStripe;
        glow = BOAT_LOOK.sails.bandGlow;
      }
      f.quad(
        at(i / nu, rows[j]!),
        at((i + 1) / nu, rows[j]!),
        at((i + 1) / nu, rows[j + 1]!),
        at(i / nu, rows[j + 1]!),
        color,
        glow,
      );
    }
  }
  return f.geometry();
}
