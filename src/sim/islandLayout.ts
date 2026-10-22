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
function createIslandLayout(kind: IslandTheme, level: number): IslandLayout {
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
      [0.15, -1.85],
      [1.5, -1.9],
      [2.0, -1.4],
      [2.05, -0.85],
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
        {
          outline: [
            [-0.35, -0.78],
            [-0.75, -1.02],
            [-0.25, -1.45],
            [0.65, -1.6],
            [1.5, -1.6],
            [1.9, -1.2],
            [1.65, -0.72],
            [0.9, -0.57],
            [0.2, -0.55],
          ],
          height: 0.32,
          material: 'grass',
        },
        { outline: oval(1.25, -1.23, 0.43, 0.34), height: 0.98, material: 'rock' },
        { outline: oval(0.83, -1.4, 0.26, 0.16), height: 0.75, material: 'rock' },
      ],
      landmark: [0.55, -0.65],
    };
  }
  if (kind === 'stone') {
    const main: Outline = [
      [-1.6, 0.25],
      [-1.4, -0.85],
      [-0.25, -1.05],
      [0.8, -0.7],
      [1.35, -0.15],
      [1.2, 0.65],
      [0.5, 0.9],
      [-0.2, 0.82],
      [-0.95, 0.65],
    ];
    // The eastern mountain face is bitten away in a broad open amphitheatre.
    // Each successively higher bench retreats into the mountain, rather than
    // sitting on the shore as an unrelated pile of slabs.
    const bench = (cut: number): Outline => [
      [-1.45, 0.05],
      [-1.25, -0.75],
      [-0.25, -0.92],
      [0.55, -0.65],
      [0.7, -0.42],
      [0.32 - cut, -0.44],
      [-0.02 - cut, -0.25],
      [-0.05 - cut, -0.02],
      [0.18 - cut, 0.18],
      [0.25, 0.25],
      [-0.65, 0.3],
    ];
    const stack = oval(-1.95, 0.1, 0.18, 0.23);
    return {
      coasts: [main, stack],
      surfaces: [
        { outline: main, height: 0.08, material: 'grass' },
        {
          outline: [
            [-0.4, -0.5],
            [0.75, -0.55],
            [1.2, -0.08],
            [1.12, 0.48],
            [0.4, 0.48],
            [-0.4, 0.05],
          ],
          height: 0.16,
          material: 'rock',
        },
        { outline: bench(-0.45), height: 0.29, material: 'rock' },
        { outline: bench(-0.18), height: 0.42, material: 'rock' },
        { outline: bench(0.08), height: 0.55, material: 'rock' },
        {
          outline:
            level === 1
              ? [
                  [-1.45, 0.05],
                  [-1.25, -0.75],
                  [-0.25, -0.92],
                  [0.55, -0.65],
                  [0.74, -0.34],
                  [0.62, -0.1],
                  [0.45, 0.12],
                  [0.25, 0.25],
                  [-0.65, 0.3],
                ]
              : bench([-0.5, -0.18, 0.08, 0.34][level - 1]!),
          height: 0.68,
          material: 'grass',
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
    [1.65, 0.72],
    [1.15, 0.88],
    [0.65, 0.76],
    [0.15, 0.83],
    [-0.25, 0.78],
    [-0.42, 0.6],
    [-0.44, 0.39],
    [-0.6, 0.3],
    [-0.8, 0.34],
    [-1.02, 0.58],
    [-1.12, 0.9],
    [-1.55, 0.95],
  ];
  return {
    coasts: [main],
    surfaces: [{ outline: main, height: 0.065, material: 'grass' }],
    landmark: [1.0, -0.5],
  };
}

const layouts = new Map<string, IslandLayout>();
export function islandLayout(kind: IslandTheme, level = 4): IslandLayout {
  const key = `${kind}/${kind === 'stone' ? level : 4}`;
  const prior = layouts.get(key);
  if (prior) return prior;
  const layout = createIslandLayout(kind, level);
  // Explicit sandy shores: building height checks use the very same inset as the model.
  for (const surface of layout.surfaces)
    if (surface.height < 0.15) {
      surface.outline = insetOutline(surface.outline, 0.085);
      // Calda's working beach widens inland beneath the compact shore log yard.
      if (kind === 'timber')
        surface.outline = surface.outline.map(([x, z]) => [
          x,
          z - (z > 0.5 && x > 0 ? 0.25 * Math.min(1, x / 0.8) : 0),
        ]);
      if (surface.holes) surface.holes = surface.holes.map((h) => insetOutline(h, -0.035));
    }
  layouts.set(key, layout);
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
  // Working docks stay shorter and well away from the central arrival lane.
  const sides =
    kind === 'grain'
      ? [
          [-1.45, 0.8, 0.3],
          [1.2, 0.7, 0.28],
        ]
      : kind === 'stone'
        ? [
            [-1.05, 0.4, 0.4],
            [0.95, 0.6, 0.28],
          ]
        : kind === 'fish'
          ? [
              [-0.9, 0.8, 0.28],
              [0.82, 0.7, 0.32],
            ]
          : [
              [-1.05, 0.8, 0.25],
              [1.1, 0.7, 0.28],
            ];
  for (let i = 0; i < Math.max(0, level - 2); i++) {
    const [x, z, len] = sides[i]!;
    piers.push({ x: x! * R, z0: z! * R, len: len! * R });
  }
  return piers;
}

/** Decorative boats moor beside the fishing beaches, never in the merchant approach. */
export function fishingMoorings(level: number) {
  return [
    { x: -1.75, z: 0.1, yaw: 0.7 },
    { x: 1.55, z: -0.2, yaw: -0.8 },
    { x: -0.8, z: -1.25, yaw: 1.5 },
    { x: -1.35, z: 1.12, yaw: 0.2 },
    { x: 0.65, z: -1.18, yaw: 1.2 },
    { x: 2.4, z: 0.85, yaw: -0.4 },
  ].slice(0, level + 2);
}
