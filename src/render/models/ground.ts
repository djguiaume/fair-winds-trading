import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { type GroundColors, groundColors } from '../../data/grounds';
import type { TerrainDef } from '../../sim/map';
import { insetOutline } from '../../sim/coast';
import { createRng, range } from '../../sim/rng';
import { type Spot, sampleInside } from '../../sim/landmarks';
import {
  flatLayout,
  isSloped,
  layoutGround,
  PEAK_SEGMENTS,
  peakBox,
  type IslandLayout,
  type LandSurface,
  type LayoutRamp,
  type Outline,
} from '../../sim/islandLayout';
import { BEACH_TOP } from '../../sim/islandUnits';
import type { Heightfield } from '../../sim/heightfield';
import { isGlowing, paint, paintFaces, paintGroups } from './geometry';
import { craterPool } from './lavaCracks';
import type { Parts } from './props';
import { B2 } from './highlandPalette';

/**
 * The islands' ground, apart from what stands on it (issue #268): the classic extruded tiers of
 * the island files and terrain shapes, and the new look's ground drawn from the shared height
 * field (decision 0222, `?look=v2`).
 */

/** An island file's outline as a three.js shape, in reference units (z drawn as -y). */
export function outlineShape(outline: Outline, R: number, holes: Outline[] = []) {
  const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x * R, -z * R)));
  s.holes = holes.map((h) => new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x * R, -z * R))));
  return s;
}

/** One flat-topped tier of ground with cliff sides, from `bottom` to `top`. */
function tier(
  outline: Outline,
  bottom: number,
  top: number,
  look: GroundColors,
  R: number,
  holes: Outline[] = [],
) {
  const g = new THREE.ExtrudeGeometry(outlineShape(outline, R, holes), {
    depth: top - bottom,
    bevelEnabled: false,
    curveSegments: 1,
  });
  g.rotateX(-Math.PI / 2).translate(0, bottom, 0);
  // The extrusion's first group is its caps, the second its sides (cliffs).
  const sideFrom = (g.groups[1]?.start ?? Infinity) / 3;
  return paintFaces(g, look.top, (_x, _y, _z, face) => (face >= sideFrom ? look.side : undefined));
}

/**
 * The classic ground of an island file at a level (decision 0101), in reference units: the beach,
 * raised surfaces as cliffs, mountains, sloped edges and ramps.
 */
export function designedGround(layout: IslandLayout, style: string, R: number): Parts {
  // Grounds as data (palette.json › grounds): the style swaps the file's names for its own.
  const ground = (material: string) => groundColors(material, style);
  const beach = ground('sand');
  const out: Parts = [];
  for (const coast of layout.coasts)
    out.push(tier(coast, -1, BEACH_TOP, beach, R, layout.lake ? [layout.lake] : []));
  for (const s of layout.surfaces) {
    const look = ground(s.material);
    if (s.shape === 'peak') {
      const { cx, cz, rx, rz } = peakBox(s);
      const mountainBase = (s.base ?? 0) * R;
      const height = s.height * R - mountainBase;
      // A snow line (capAbove) needs rings up the cone to fall on; plain peaks keep one. A
      // volcano's cone is cut off at its crater's rim (decision 0171).
      const rings = look.cap ? 4 : 1;
      const g = (
        s.crater
          ? new THREE.CylinderGeometry(R * s.crater, R, height, PEAK_SEGMENTS, rings)
          : new THREE.ConeGeometry(R, height, PEAK_SEGMENTS, rings)
      )
        .scale(rx, 1, rz)
        .translate(cx * R, (s.height * R + mountainBase) / 2, cz * R);
      const line = mountainBase + height * (look.capAbove ?? 1);
      out.push(paintFaces(g, look.peak, (_x, y) => (look.cap && y > line ? look.cap : undefined)));
      if (s.crater) out.push(craterPool(s, R, look.glow ?? look.side[0]!, !!look.glow));
    } else out.push(tier(s.outline, BEACH_TOP, s.height * R, look, R, s.holes));
  }
  // Sloped edges (decision 0096 §4): a ramp down from the top, outward, to the ground below.
  for (const s of layout.surfaces)
    if (s.slope && s.shape !== 'peak') out.push(ramp(layout, s, R, ground(s.material).top));
  // Ramps that climb along their length (decision 0123).
  for (const r of layout.ramps) out.push(...rampBand(r, R, ground(r.material)));
  // Glowing parts (a crater's lava) go to the windows' mesh, not the terrain's.
  for (const g of out) if (!isGlowing(g)) g.userData.islandTerrain = true;
  return out;
}

/** The raised sandy rim round an island's lake (its water is drawn with the town). */
export function lakeRim(layout: IslandLayout, style: string, R: number): Parts {
  const lake = layout.lake!;
  return [
    tier(insetOutline(lake, -0.035), BEACH_TOP, 0.55, groundColors('sand', style), R, [lake]),
  ];
}

/**
 * The ramp of a sloped outline: a band from each sloped edge's top, outward by the slope's
 * width, down to the ground below, with a fan at each bend between two sloped edges.
 */
function ramp(layout: IslandLayout, s: LandSurface, R: number, colors: string[]) {
  const o = s.outline;
  const w = s.slope!;
  let area = 0;
  for (let i = 0; i < o.length; i++) {
    const a = o[i]!,
      b = o[(i + 1) % o.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const out = area > 0 ? -1 : 1;
  const normal = (i: number) => {
    const a = o[i % o.length]!,
      b = o[(i + 1) % o.length]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [((b[1] - a[1]) / l) * out, (-(b[0] - a[0]) / l) * out] as const;
  };
  // Down to the ground below, not up a mountain's flat outline (its cone stands over the foot).
  const flat = flatLayout(layout);
  const foot = (x: number, z: number) => (layoutGround(flat, x, z) ?? 0) * R;
  const positions: number[] = [];
  const v = (x: number, y: number, z: number) => positions.push(x * R, y, z * R);
  /** One triangle, wound to face up. */
  const tri = (p: number[], q: number[], r: number[]) => {
    const up = (q[0]! - p[0]!) * (r[2]! - p[2]!) - (q[2]! - p[2]!) * (r[0]! - p[0]!) < 0;
    for (const [x, y, z] of up ? [p, q, r] : [p, r, q]) v(x!, y!, z!);
  };
  const top = s.height * R;
  for (let i = 0; i < o.length; i++) {
    if (!isSloped(s, i)) continue;
    const a = o[i]!,
      b = o[(i + 1) % o.length]!;
    const [nx, nz] = normal(i);
    const fa = [a[0] + nx * w, a[1] + nz * w],
      fb = [b[0] + nx * w, b[1] + nz * w];
    const A = [a[0], top, a[1]],
      B = [b[0], top, b[1]],
      FA = [fa[0]!, foot(fa[0]!, fa[1]!), fa[1]!],
      FB = [fb[0]!, foot(fb[0]!, fb[1]!), fb[1]!];
    tri(A, B, FB);
    tri(A, FB, FA);
    // The bend to the next edge, when it slopes too: a fan round the corner.
    if (isSloped(s, (i + 1) % o.length)) {
      const [mx, mz] = normal(i + 1);
      const fc = [b[0] + mx * w, b[1] + mz * w];
      tri(B, FB, [fc[0]!, foot(fc[0]!, fc[1]!), fc[1]!]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return paintFaces(g, colors);
}

/**
 * A ramp along its points (decision 0123): a band rising evenly from start to end, with rock
 * sides and ends down to the beach. Corners are mitred so the band keeps its width.
 */
function rampBand(r: LayoutRamp, R: number, look: GroundColors): Parts {
  const p = r.points;
  const total = r.along[r.along.length - 1]! || 1;
  const half = r.width / 2;
  const dir = (i: number) => {
    const [ax, az] = p[Math.max(0, i - 1)]!,
      [bx, bz] = p[Math.min(p.length - 1, Math.max(1, i))]!;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return [(bx - ax) / l, (bz - az) / l] as const;
  };
  // Left and right edge of each cross-section and its height.
  const sections = p.map(([x, z], i) => {
    const [ux, uz] = dir(i),
      [vx, vz] = dir(i + 1);
    let nx = -(uz + vz),
      nz = ux + vx;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    // Mitre: as wide as the band across both runs, no more than twice at a sharp bend.
    const k = Math.min(2, 1 / Math.max(0.5, Math.abs(nx * -uz + nz * ux)));
    const y = (r.start + ((r.end - r.start) * r.along[i]!) / total) * R;
    return {
      left: [(x + nx * half * k) * R, y, (z + nz * half * k) * R],
      right: [(x - nx * half * k) * R, y, (z - nz * half * k) * R],
    };
  });
  const top: number[] = [],
    sides: number[] = [];
  const quad = (to: number[], a: number[], b: number[], c: number[], d: number[]) =>
    to.push(...a, ...b, ...c, ...a, ...c, ...d);
  const low = (v: number[]) => [v[0]!, BEACH_TOP, v[2]!];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1]!,
      b = sections[i]!;
    quad(top, a.left, a.right, b.right, b.left);
    quad(sides, low(a.left), a.left, b.left, low(b.left));
    quad(sides, a.right, low(a.right), low(b.right), b.right);
  }
  const first = sections[0]!,
    last = sections[sections.length - 1]!;
  quad(sides, low(first.right), first.right, first.left, low(first.left));
  quad(sides, low(last.left), last.left, last.right, low(last.right));
  const mesh = (positions: number[], c: string[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // Wound either way round: both faces drawn by flipping to face up or out.
    const faced = new THREE.BufferGeometry();
    const both = [...positions];
    for (let i = 0; i < positions.length; i += 9)
      both.push(
        ...positions.slice(i, i + 3),
        ...positions.slice(i + 6, i + 9),
        ...positions.slice(i + 3, i + 6),
      );
    faced.setAttribute('position', new THREE.Float32BufferAttribute(both, 3));
    g.dispose();
    return paintFaces(faced, c);
  };
  return [mesh(top, look.top), mesh(sides, look.side)];
}

export function extrudeOutline(outline: TerrainDef['outline'], bottom: number, top: number) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: top - bottom,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry.translate(0, bottom, 0);
}

/** Floe colours: snow on top, the pale sea ice at the edges, blue where it is thick (0170). */
const FLOE_TOPS = ['#eef4f8', '#e3ecf3', '#f6f9fb', '#dcebf2'];
const FLOE_SIDE = '#a8dde8';

/** `weather.json` › `ice`. */
interface IceTuning {
  floeSize: [number, number];
  jitter: number;
  bits: number;
  bitSize: [number, number];
}

/**
 * A field of ice (decision 0170): a thin pale sheet over the whole outline, so nothing shows
 * through, then flat floes of several sizes laid across it, a few tilted slabs where floes press
 * together, and the odd grounded berg on a big field. Low-poly and merged like the rest of the
 * terrain, so a field is one batch whatever its size.
 */
export function iceField(feature: TerrainDef, seed: number): Parts {
  const parts: Parts = [paint(extrudeOutline(feature.outline, -0.5, 0.25), '#d8ecf3')];
  const rng = createRng(seed);
  const occupied: Spot[] = [];
  const xs = feature.outline.map((p) => p[0]),
    ys = feature.outline.map((p) => p[1]);
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  const floes = Math.min(140, Math.round(area / 55));
  const tune = (TUNING.weather as unknown as { ice: IceTuning }).ice;
  // A floe: an uneven five- to seven-sided slab, so no two read as the same hexagon.
  const floe = (x: number, y: number, r: number, h: number, sides: number, top: string) => {
    const turn = rng() * 6;
    const corners = Array.from({ length: sides }, (_, k) => {
      const a = turn + ((k + range(rng, -0.25, 0.25)) / sides) * Math.PI * 2;
      const d = r * range(rng, 1 - tune.jitter, 1 + tune.jitter * 0.5);
      return [x + Math.cos(a) * d, y + Math.sin(a) * d] as [number, number];
    });
    parts.push(paintGroups(extrudeOutline(corners, 0.2, 0.2 + h), [top, FLOE_SIDE]));
  };
  for (let i = 0; i < floes; i++) {
    const r = range(rng, tune.floeSize[0], tune.floeSize[1]);
    const p = sampleInside(rng, feature.outline, r * 0.8, occupied);
    if (!p) continue;
    floe(
      p.x,
      p.y,
      r,
      range(rng, 0.35, 0.8),
      5 + Math.floor(rng() * 3),
      FLOE_TOPS[i % FLOE_TOPS.length]!,
    );
  }
  // Broken ice between the floes.
  for (let i = 0; i < Math.round(floes * tune.bits); i++) {
    const r = range(rng, tune.bitSize[0], tune.bitSize[1]);
    const p = sampleInside(rng, feature.outline, r, occupied);
    if (!p) continue;
    floe(
      p.x,
      p.y,
      r,
      range(rng, 0.2, 0.4),
      4 + Math.floor(rng() * 2),
      FLOE_TOPS[(i + 1) % FLOE_TOPS.length]!,
    );
  }
  // Pressure ridges: slabs pushed up on edge where the floes meet.
  for (let i = 0; i < Math.min(30, floes / 4); i++) {
    const p = sampleInside(rng, feature.outline, 1.5, []);
    if (!p) continue;
    const slab = new THREE.BoxGeometry(range(rng, 2, 4), range(rng, 0.9, 1.8), 0.5)
      .rotateZ(range(rng, -0.5, 0.5))
      .rotateY(rng() * 6)
      .translate(p.x, 0.7, -p.y);
    parts.push(paint(slab, i % 2 ? '#c5e4ee' : '#eef4f8'));
  }
  return parts;
}

/** Barrier island tiers' colours, beach first (heights: `terrain.json › ridge`, decision 0031). */
const RIDGE_COLORS = [B2.sand, B2.rock, B2.rock2, B2.grass];

/**
 * The classic ground of a terrain shape: a barrier island's terraces, the beach on the exact
 * collision outline and each tier inset so nothing overhangs the shore; a sandbank's flat top.
 */
export function featureGround(feature: TerrainDef): Parts {
  if (feature.kind === 'sandbank')
    return [
      paint(
        extrudeOutline(feature.outline, -0.4, TUNING.terrain.sandbankTop),
        feature.look?.color ?? B2.sand,
      ),
    ];
  if (feature.kind !== 'island') return [];
  const { insets, bottoms, tops } = TUNING.terrain.ridge;
  return insets.map((inset, i) => {
    const outline = inset ? insetOutline(feature.outline, inset) : feature.outline;
    return paint(extrudeOutline(outline, bottoms[i]!, tops[i]!), RIDGE_COLORS[i] ?? B2.grass);
  });
}

/** What colour a triangle of field ground takes: its highest corner's ground, steep or not. */
export type FieldColor = (ground: string, steep: boolean) => string;

/** Rise over run past which a field triangle reads as a cliff or slope side. */
const STEEP = 1.3;

/**
 * The new look's ground (decision 0222): one triangle pair per cell of a height field, in scene
 * coordinates, flat shaded like the rest of the land. Open seabed cells are left out.
 */
export function fieldGround(field: Heightfield, colorOf: FieldColor): THREE.BufferGeometry {
  const { w, h, cell, heights } = field;
  const positions: number[] = [],
    colors: number[] = [];
  // One colour per ground and steepness: a field has a handful, its triangles many.
  const palette = new Map<string, THREE.Color>();
  const colorFor = (ground: string, steep: boolean) => {
    const key = `${ground}/${steep}`;
    let c = palette.get(key);
    if (!c) palette.set(key, (c = new THREE.Color(colorOf(ground, steep))));
    return c;
  };
  const corner = [0, 0, 0, 0];
  const vertex = (k: number) => {
    const i = k % w,
      j = (k - i) / w;
    positions.push(field.x0 + i * cell, heights[k]!, -(field.y0 + j * cell));
  };
  const triangle = (a: number, b: number, c: number) => {
    const ha = heights[a]!,
      hb = heights[b]!,
      hc = heights[c]!;
    const top = ha >= hb && ha >= hc ? a : hb >= hc ? b : c;
    const steep = (Math.max(ha, hb, hc) - Math.min(ha, hb, hc)) / cell > STEEP;
    const color = colorFor(field.grounds[field.ground[top]!]!, steep);
    for (const k of [a, b, c]) {
      vertex(k);
      colors.push(color.r, color.g, color.b);
    }
  };
  for (let j = 0; j + 1 < h; j++)
    for (let i = 0; i + 1 < w; i++) {
      const a = j * w + i;
      corner[0] = a;
      corner[1] = a + 1;
      corner[2] = a + w;
      corner[3] = a + w + 1;
      if (corner.every((k) => heights[k]! <= field.seabed)) continue;
      // Wound to face up: +x, then -z (the map's +y).
      triangle(a, a + 1, a + w);
      triangle(a + 1, a + w + 1, a + w);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
