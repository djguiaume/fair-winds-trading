import * as THREE from 'three';
import { coastDistance } from '../../sim/coast';
import {
  type IslandLayout,
  type LandSurface,
  peakBox,
  peakHeight,
  surfaceHeight,
} from '../../sim/islandLayout';
import { createRng } from '../../sim/rng';
import { BEACH_TOP, glowing, molten, paint } from './geometry';

/**
 * Glowing cracks on a ground that has a `glow` colour (decision 0171, lava fields): a seeded
 * network of thin lines on its flat top, and streaks down a mountain's flanks from its crater.
 * They are glowing parts, so they share the lit windows' material: dull red by day, bright at
 * night, no extra draw call. Reference units round the island's origin, like the terrain.
 */

type Parts = THREE.BufferGeometry[];
const LIFT = 0.03;

/** A thin glowing line along points (radius units) at the land's height there. */
function crackLine(
  layout: IslandLayout,
  points: [number, number][],
  width: number,
  R: number,
  color: string,
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]!,
      [bx, bz] = points[i]!;
    const ha = surfaceHeight(layout, ax, az),
      hb = surfaceHeight(layout, bx, bz);
    if (ha === null || hb === null) continue;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    // Tapering: thinner towards the ends of the crack.
    const wa = width * (i === 1 ? 0.4 : 1),
      wb = width * (i === points.length - 1 ? 0.3 : 1);
    const nx = -(bz - az) / l,
      nz = (bx - ax) / l;
    const ya = Math.max(ha * R, BEACH_TOP) + LIFT,
      yb = Math.max(hb * R, BEACH_TOP) + LIFT;
    const A1 = [(ax + nx * wa) * R, ya, (az + nz * wa) * R],
      A2 = [(ax - nx * wa) * R, ya, (az - nz * wa) * R],
      B1 = [(bx + nx * wb) * R, yb, (bz + nz * wb) * R],
      B2 = [(bx - nx * wb) * R, yb, (bz - nz * wb) * R];
    for (const [p, q, r] of [
      [A1, B2, A2],
      [A1, B1, B2],
    ]) {
      // Wound to face up.
      const ny = (q![2]! - p![2]!) * (r![0]! - p![0]!) - (q![0]! - p![0]!) * (r![2]! - p![2]!);
      positions.push(...p!, ...(ny >= 0 ? [...q!, ...r!] : [...r!, ...q!]));
    }
  }
  if (!positions.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return glowing(paint(g, color));
}

/** Is this point on the surface's own top (not under higher ground, not near its edge)? */
function onTop(layout: IslandLayout, s: LandSurface, x: number, z: number) {
  if (coastDistance(x, z, s.outline).distance > -0.02) return false;
  if (s.holes?.some((h) => coastDistance(x, z, h).distance < 0.02)) return false;
  const h = surfaceHeight(layout, x, z);
  return h !== null && Math.abs(h - s.height) < 1e-6;
}

/** Cracks over a flat surface: about one per 0.02 square radius units of its box. */
function flatCracks(layout: IslandLayout, s: LandSurface, seed: number, R: number, color: string) {
  const rng = createRng(seed);
  const xs = s.outline.map((p) => p[0]),
    zs = s.outline.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const count = Math.min(40, Math.round(((x1 - x0) * (z1 - z0)) / 0.02));
  const out: Parts = [];
  for (let i = 0, tries = 0; i < count && tries < count * 6; tries++) {
    const x = x0 + rng() * (x1 - x0),
      z = z0 + rng() * (z1 - z0);
    if (!onTop(layout, s, x, z)) continue;
    i++;
    // A wandering line with a fork now and then.
    let a = rng() * Math.PI * 2;
    const pts: [number, number][] = [[x, z]];
    const steps = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < steps; k++) {
      a += (rng() - 0.5) * 1.4;
      const [px, pz] = pts[pts.length - 1]!;
      const step = 0.025 + rng() * 0.03;
      const next: [number, number] = [px + Math.cos(a) * step, pz + Math.sin(a) * step];
      if (!onTop(layout, s, next[0], next[1])) break;
      pts.push(next);
    }
    if (pts.length < 2) continue;
    const line = crackLine(layout, pts, 0.004 + rng() * 0.003, R, color);
    if (line) out.push(line);
    if (pts.length > 3 && rng() < 0.4) {
      const m = pts[Math.floor(pts.length / 2)]!;
      const b = a + (rng() < 0.5 ? 1 : -1) * (0.8 + rng() * 0.6);
      const end: [number, number] = [m[0] + Math.cos(b) * 0.04, m[1] + Math.sin(b) * 0.04];
      if (onTop(layout, s, end[0], end[1])) {
        const fork = crackLine(layout, [m, end], 0.003, R, color);
        if (fork) out.push(fork);
      }
    }
  }
  return out;
}

/** Streaks down a mountain's flanks, from its rim or near its top, part way to its foot. */
function peakCracks(layout: IslandLayout, s: LandSurface, seed: number, R: number, color: string) {
  const rng = createRng(seed);
  const { cx, cz, rx, rz } = peakBox(s);
  const top = s.crater ?? 0.08;
  const out: Parts = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = ((i + rng() * 0.6) / n) * Math.PI * 2;
    const reach = top + 0.25 + rng() * 0.35;
    const pts: [number, number][] = [];
    let wobble = 0;
    for (let k = 0; k <= 6; k++) {
      const t = top + ((reach - top) * k) / 6;
      wobble += (rng() - 0.5) * 0.18;
      const x = cx + Math.sin(a + wobble) * t * rx,
        z = cz + Math.cos(a + wobble) * t * rz;
      if (peakHeight(s, x, z) === null) break;
      pts.push([x, z]);
    }
    const line = crackLine(layout, pts, 0.006 + rng() * 0.004, R, color);
    if (line) out.push(line);
  }
  return out;
}

/** Every crack on the surfaces whose ground glows. */
export function lavaCracks(
  layout: IslandLayout,
  glowOf: (material: string) => string | undefined,
  seed: number,
  R: number,
): Parts {
  const out: Parts = [];
  layout.surfaces.forEach((s, i) => {
    const color = glowOf(s.material);
    if (!color) return;
    const k = seed * 31 + i * 7919;
    out.push(
      ...(s.shape === 'peak'
        ? peakCracks(layout, s, k, R, color)
        : flatCracks(layout, s, k, R, color)),
    );
  });
  return out;
}

/**
 * Small dark rocks over the flat tops of the surfaces whose ground has `specks` (decision 0171:
 * moss grown over old lava): flat seeded pentagons, about one per 0.012 square radius units.
 */
export function groundSpecks(
  layout: IslandLayout,
  specksOf: (material: string) => string | undefined,
  seed: number,
  R: number,
): Parts {
  const out: Parts = [];
  layout.surfaces.forEach((s, i) => {
    const color = specksOf(s.material);
    if (!color || s.shape === 'peak') return;
    const rng = createRng(seed * 17 + i * 104729);
    const xs = s.outline.map((p) => p[0]),
      zs = s.outline.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const count = Math.min(36, Math.round(((x1 - x0) * (z1 - z0)) / 0.012));
    const positions: number[] = [];
    for (let k = 0, tries = 0; k < count && tries < count * 4; tries++) {
      const x = x0 + rng() * (x1 - x0),
        z = z0 + rng() * (z1 - z0);
      if (!onTop(layout, s, x, z)) continue;
      k++;
      const r = (0.008 + rng() * 0.012) * R,
        turn = rng() * Math.PI;
      const y = Math.max(s.height * R, BEACH_TOP) + LIFT;
      const corner = (j: number) => {
        const a = turn + (j / 5) * Math.PI * 2;
        const rr = r * (0.7 + ((j * 7 + k) % 3) * 0.15);
        return [x * R + Math.cos(a) * rr, y, z * R + Math.sin(a) * rr];
      };
      // A fan of three triangles, wound to face up.
      for (const j of [1, 2, 3]) positions.push(...corner(0), ...corner(j + 1), ...corner(j));
    }
    if (!positions.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    out.push(paint(g, color));
  });
  return out;
}

/** A crater's pool of lava (or dark rock), level with its rim, in reference units. */
export function craterPool(s: LandSurface, R: number, color: string, glow: boolean) {
  const { cx, cz, rx, rz } = peakBox(s);
  const r = (s.crater ?? 0) * 0.8;
  const g = new THREE.CircleGeometry(R * r, 10)
    .rotateX(-Math.PI / 2)
    .scale(rx, 1, rz)
    .translate(cx * R, s.height * R + 0.02, cz * R);
  const pool = paint(g, color);
  // Marked so the islands can tell where smoke rises and lava bombs land (decision 0178): the
  // cone's slope, rise over run, the same at any scale.
  const run = ((rx + rz) / 2) * (1 - (s.crater ?? 0));
  pool.userData.crater = { slope: (s.height - (s.base ?? 0)) / Math.max(run, 0.01) };
  return glow ? molten(pool) : pool;
}
