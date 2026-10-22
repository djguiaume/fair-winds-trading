import type { IslandDef, TerrainDef } from './map';
import { coastDistance, insetOutline } from './coast';

export type IslandTheme = 'fish' | 'timber' | 'stone' | 'grain';
export type Outline = TerrainDef['outline'];
export interface LandSurface {
  outline: Outline;
  holes?: Outline[];
  height: number;
  material: 'grass' | 'rock';
}
export interface IslandLayout {
  coasts: Outline[];
  lake?: Outline;
  surfaces: LandSurface[];
  landmark: [number, number];
}

const oval = (x: number, z: number, rx: number, rz: number): Outline =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI * 2) / 10;
    return [x + Math.cos(a) * rx, z + Math.sin(a) * rz];
  });

/** Authored silhouettes in radius units, shared by models, collision, chart and water. */
function createIslandLayout(kind: IslandTheme): IslandLayout {
  if (kind === 'fish') {
    const main: Outline = [
      [-1.55, 0.35],
      [-1.5, -0.45],
      [-1.05, -0.9],
      [-0.2, -1],
      [0.7, -0.85],
      [1.25, -0.4],
      [1.2, 0.25],
      [0.9, 0.8],
      [0.5, 0.96],
      [0.22, 0.65],
      [-0.2, 0.75],
      [-0.6, 0.95],
      [-1.15, 0.9],
    ];
    const beacon = oval(1.95, -0.65, 0.3, 0.33);
    const outpost = oval(1.95, 0.65, 0.35, 0.22);
    return {
      coasts: [main, beacon, outpost],
      surfaces: [
        { outline: main, height: 0.065, material: 'grass' },
        { outline: oval(-0.85, -0.45, 0.45, 0.35), height: 0.28, material: 'grass' },
        { outline: beacon, height: 0.12, material: 'grass' },
        { outline: outpost, height: 0.065, material: 'grass' },
      ],
      landmark: [1.95, -0.65],
    };
  }
  if (kind === 'timber') {
    const main: Outline = [
      [-1.8, 0.25],
      [-1.7, -0.65],
      [-0.9, -1.25],
      [0.15, -1.4],
      [1.2, -1.15],
      [1.75, -0.4],
      [1.65, 0.55],
      [0.9, 1.0],
      [0, 0.83],
      [-0.9, 0.95],
      [-1.65, 0.7],
    ];
    const lake = oval(-0.65, -0.45, 0.37, 0.23);
    return {
      coasts: [main],
      lake,
      surfaces: [
        { outline: main, holes: [lake], height: 0.11, material: 'grass' },
        { outline: oval(0.55, -0.9, 0.9, 0.35), height: 0.32, material: 'grass' },
      ],
      landmark: [0.55, -0.65],
    };
  }
  if (kind === 'stone') {
    const main: Outline = [
      [-1.4, 0.25],
      [-1.15, -0.85],
      [-0.25, -1.05],
      [0.8, -0.7],
      [1.35, -0.15],
      [1.2, 0.65],
      [0.5, 0.9],
      [-0.2, 0.82],
      [-0.95, 0.65],
    ];
    const high: Outline = [
      [-1.25, 0.05],
      [-1.05, -0.75],
      [-0.25, -0.92],
      [0.55, -0.65],
      [0.7, -0.2],
      [0.25, 0.25],
      [-0.65, 0.3],
    ];
    const stack = oval(-1.95, 0.1, 0.18, 0.23);
    return {
      coasts: [main, stack],
      surfaces: [
        { outline: main, height: 0.08, material: 'grass' },
        { outline: high, height: 0.65, material: 'grass' },
        {
          outline: [
            [0.55, -0.3],
            [0.95, -0.32],
            [1.2, -0.08],
            [1.15, 0.43],
            [0.82, 0.57],
            [0.55, 0.4],
          ],
          height: 0.16,
          material: 'rock',
        },
        {
          outline: [
            [0.58, -0.28],
            [0.94, -0.29],
            [1.13, -0.09],
            [1.05, 0.12],
            [0.7, 0.23],
          ],
          height: 0.27,
          material: 'rock',
        },
        { outline: stack, height: 0.75, material: 'rock' },
      ],
      landmark: [-0.65, -0.55],
    };
  }
  const main: Outline = [
    [-1.85, 0.25],
    [-1.7, -0.7],
    [-0.7, -1.3],
    [0.55, -1.35],
    [1.45, -0.85],
    [1.85, 0.1],
    [1.75, 0.8],
    [1.25, 1.1],
    [1.0, 0.95],
    [0.85, 0.82],
    [0.84, 0.65],
    [0.9, 0.4],
    [0.86, 0.26],
    [0.72, 0.18],
    [0.58, 0.22],
    [0.5, 0.38],
    [0.46, 0.6],
    [0.32, 0.72],
    [0.15, 0.83],
    [-0.25, 0.78],
    [-0.38, 0.6],
    [-0.4, 0.34],
    [-0.52, 0.22],
    [-0.7, 0.2],
    [-0.86, 0.26],
    [-0.94, 0.42],
    [-0.96, 0.65],
    [-0.9, 0.85],
    [-0.85, 1.0],
    [-1.55, 0.95],
  ];
  return {
    coasts: [main],
    surfaces: [{ outline: main, height: 0.065, material: 'grass' }],
    landmark: [1.0, -0.5],
  };
}

const layouts = new Map<IslandTheme, IslandLayout>();
export function islandLayout(kind: IslandTheme): IslandLayout {
  const prior = layouts.get(kind);
  if (prior) return prior;
  const layout = createIslandLayout(kind);
  // Explicit sandy shores: building height checks use the very same inset as the model.
  for (const surface of layout.surfaces)
    if (surface.height < 0.15) {
      surface.outline = insetOutline(surface.outline, 0.085);
      if (surface.holes) surface.holes = surface.holes.map((h) => insetOutline(h, -0.035));
    }
  layouts.set(kind, layout);
  return layout;
}

/** An entire footprint must fit on a single surface and avoid water and cliff edges. */
export function layoutGround(
  layout: IslandLayout,
  x: number,
  z: number,
  margin = 0,
): number | null {
  if (!layout.coasts.some((c) => coastDistance(x, z, c).distance <= -margin)) return null;
  if (layout.lake && coastDistance(x, z, layout.lake).distance < margin) return null;
  let height: number | null = null;
  for (const s of layout.surfaces) {
    const d = coastDistance(x, z, s.outline).distance;
    if (Math.abs(d) < margin) return null;
    if (d < -margin && !s.holes?.some((h) => coastDistance(x, z, h).distance < margin))
      height = Math.max(height ?? 0, s.height);
  }
  return height;
}

/** Profiles use the same harbour-facing frame as pierAt. */
export function islandBearing(island: IslandDef): number {
  return island.look?.harbourBearing ?? 0;
}
export function islandPoint(island: IslandDef, x: number, z: number) {
  const a = Math.PI - islandBearing(island);
  return {
    x: island.x + island.radius * (Math.cos(a) * x + Math.sin(a) * z),
    y: island.y + island.radius * (Math.sin(a) * x - Math.cos(a) * z),
  };
}
const coastCache = new WeakMap<IslandDef, { key: string; coasts: Outline[] }>();
export function islandCoasts(island: IslandDef): Outline[] | null {
  if (!island.look?.profile) return null;
  const key = `${island.x}/${island.y}/${island.radius}/${island.look.profile}/${islandBearing(island)}`;
  const cached = coastCache.get(island);
  if (cached?.key === key) return cached.coasts;
  const coasts: Outline[] = islandLayout(island.look.profile).coasts.map((c) =>
    c.map(([x, z]) => {
      const p = islandPoint(island, x, z);
      return [p.x, p.y];
    }),
  );
  coastCache.set(island, { key, coasts });
  return coasts;
}

/** Inland water shares its outline with the terrain hole and chart. */
export function islandLake(island: IslandDef): Outline | null {
  if (!island.look?.profile) return null;
  const lake = islandLayout(island.look.profile).lake;
  return lake
    ? lake.map(([x, z]) => {
        const p = islandPoint(island, x, z);
        return [p.x, p.y];
      })
    : null;
}

export function characterPiers(kind: IslandTheme, R: number, level: number) {
  const piers = [{ x: R * 0.08, z0: R * 0.63, len: Math.min(R * 0.75, 4.5) + R * 0.22 }];
  if (level >= 3) piers.push({ x: -R * 0.65, z0: R * 0.88, len: R * 0.4 });
  if (level >= 4) piers.push({ x: R * 0.52, z0: R * 0.82, len: R * 0.38 });
  // Westholm's inlet mouths stay clear; its secondary docks follow the central peninsula.
  if (kind === 'grain')
    piers.slice(1).forEach((p, i) => {
      p.x = R * (i ? 0.27 : -0.15);
      p.z0 = R * 0.81;
    });
  return piers;
}
