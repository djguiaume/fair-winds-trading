// The south sea (Sunreach's sea, ADR 0152): writes the sea's data file and its island files.
//   node docs/reviews/south-sea/src/make-south.cjs
// Writes src/data/seas/south.json and src/data/islands/{sunreach,sunreach-south,palm-key,
// lone-palm}.json. The shapes are drawn here by script once; after that the files are ordinary
// data, so the island builder and the map editor can keep shaping them by hand.
// World coordinates: x east, y north (as phase1-map.json). Bearings: 0 = north, clockwise.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const DATA = path.join(ROOT, 'src', 'data');
const ring = JSON.parse(fs.readFileSync(path.join(DATA, 'phase1-map.json'), 'utf8'));

const SEA = 985;
const DEG = Math.PI / 180;
const r1 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 10000) / 10000;
const polar = (r, b) => [r * Math.sin(b * DEG), r * Math.cos(b * DEG)];
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const bump = (t, c, w, h) => h * Math.exp(-(((t - c) / w) ** 2));

// ---------------------------------------------------------------- Sunreach, the ring island
// The layout of ADR 0143 (staggered ring, harbour facing in, slots of at least 50 units),
// drawn as two thick, irregular arms (the "shaped" pass of docs/reviews/ring-lagoon).
const CX = -60,
  CY = -735,
  R = 112,
  D = 46,
  OV = 30,
  PHI = -14;
function northProfile(t) {
  const out =
    20 + bump(t, 95, 30, 20) + bump(t, 150, 18, 10) + bump(t, 40, 14, 9) - bump(t, 120, 8, 6) +
    4 * Math.sin(t / 7);
  const inn = 18 + bump(t, 70, 25, 8) - bump(t, 95, 12, 6) + bump(t, 175, 15, 6) + 3 * Math.sin(t / 5 + 1);
  const tip = Math.sqrt(Math.max(0.15, Math.min(1, (t - 15) / 18, (195 + OV - t) / 22)));
  return [out * tip, inn * tip];
}
function southProfile(t) {
  const out =
    22 + bump(t, 80, 35, 14) + bump(t, 30, 14, 12) - bump(t, 130, 10, 7) + bump(t, 170, 20, 8) +
    4 * Math.sin(t / 6 + 2);
  const inn = 17 + bump(t, 110, 30, 9) - bump(t, 60, 10, 7) + 3 * Math.sin(t / 4.5);
  const tip = Math.sqrt(Math.max(0.15, Math.min(1, (t - 15) / 22, (195 + OV - t) / 18)));
  return [out * tip, inn * tip];
}
function rot(x, y, deg) {
  const a = deg * DEG;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}
const ARM_STEPS = 48;
/** Arm angle t (degrees round its own centre) to world, at radius r from that centre. */
function armPoint(t, r, flip) {
  let x = -D + r * Math.cos(t * DEG),
    y = r * Math.sin(t * DEG);
  if (flip) [x, y] = [-x, -y];
  [x, y] = rot(x, y, PHI);
  return [CX + x, CY + y];
}
function arm(profile, flip) {
  const outer = [],
    inner = [];
  for (let i = 0; i <= ARM_STEPS; i++) {
    const t = 15 + (i * (180 + OV)) / ARM_STEPS;
    const [o, n] = profile(t);
    outer.push(armPoint(t, R + o, flip));
    inner.push(armPoint(t, R - n, flip));
  }
  return { outline: [...outer, ...inner.reverse()], profile, flip };
}
const north = arm(northProfile, false);
const south = arm(southProfile, true);

/** World point to island-file units for an island at (X, Y), radius r, harbour bearing b. */
function toIsland(island, [wx, wy]) {
  const a = Math.PI - island.bearing;
  const u = (wx - island.x) / island.r,
    v = (wy - island.y) / island.r;
  return [r4(Math.cos(a) * u + Math.sin(a) * v), r4(Math.sin(a) * u - Math.cos(a) * v)];
}
/** A point on an arm, `k` of the way from its inner shore (0) to its outer shore (1). */
function onArm(a, t, k) {
  const [o, n] = a.profile(t);
  return armPoint(t, R - n + k * (o + n), a.flip);
}
const bearingOf = (dx, dy) => (Math.atan2(dx, dy) + 2 * Math.PI) % (2 * Math.PI);

// The town sits on the north arm's inner shore, round arm angle 100 where the arm is thickest.
const TOWN_T = 100;
const shoreIn = onArm(north, TOWN_T, 0),
  shoreOut = onArm(north, TOWN_T, 1);
const thick = Math.hypot(shoreIn[0] - shoreOut[0], shoreIn[1] - shoreOut[1]);
// Island radius 60: the arrival pier runs from 0.63 r (on land) to 0.85 r + 9.9 (in the lagoon),
// so the centre stands 42 units back from the inner shore (collision.ts pierAt).
const SUN_R = 60,
  BACK = 42;
if (thick < BACK + 8) throw new Error(`north arm only ${thick.toFixed(0)} thick at the town`);
const inward = [(shoreIn[0] - shoreOut[0]) / thick, (shoreIn[1] - shoreOut[1]) / thick];
const sunreach = {
  x: r1(shoreIn[0] - inward[0] * BACK),
  y: r1(shoreIn[1] - inward[1] * BACK),
  r: SUN_R,
};
sunreach.bearing = bearingOf(inward[0], inward[1]);
const sunreachWp = {
  label: 'Sunreach',
  x: r1(sunreach.x + inward[0] * 2.05 * SUN_R),
  y: r1(sunreach.y + inward[1] * 2.05 * SUN_R),
};
// prepareMap faces the harbour at the waypoint: use exactly that bearing for the file.
sunreach.bearing = bearingOf(sunreachWp.x - sunreach.x, sunreachWp.y - sunreach.y);

// The south arm: no harbour, centred on its thickest stretch.
const sMid = onArm(south, 85, 0.45);
const sunreachSouth = { x: r1(sMid[0]), y: r1(sMid[1]), r: 60, bearing: Math.PI };

function smoothPolygon(points, rounds = 1) {
  for (let k = 0; k < rounds; k++) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    points = out;
  }
  return points;
}
/** A hill: the band of an arm between angles t0..t1 and shore fractions k0..k1. */
function armBand(a, t0, t1, k0, k1, steps = 8, wob = 0) {
  const outer = [],
    inner = [];
  // A natural edge: the inner side wanders by up to `wob` (shore fraction).
  const n = (t) => wob * (0.6 * Math.sin(t * 0.23 + t0) + 0.4 * Math.sin(t * 0.61 + 2 * t1));
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    // Round the ends: the band narrows towards both ends.
    const e = Math.sin((Math.PI * i) / steps) ** 0.5;
    const mid = (k0 + k1) / 2,
      half = ((k1 - k0) / 2) * Math.max(0.35, e);
    outer.push(onArm(a, t, mid + half));
    inner.push(onArm(a, t, Math.min(mid + half - 0.08, mid - half + n(t) * e)));
  }
  return [...outer, ...inner.reverse()];
}

// The look (decision 0152, design review): Sunreach is the rim of an old drowned crater. The
// rim stands high on the open-sea side, with cliffs and rocky summits; the lagoon side is soft,
// with the town on two terraces, Juno's tea house at the harbour head, white lagoon beaches,
// and the tea gardens climbing the south arm in terraces, facing the town across the Sound.

/** Faces the lagoon: the bearing of the shore normal at arm angle t, as a prop turn. */
function faceIn(island, a, t) {
  const p = onArm(a, t, 0),
    q = onArm(a, t, 1);
  const b = bearingOf(p[0] - q[0], p[1] - q[1]);
  return Math.round(((Math.PI - (b - island.bearing)) / DEG + 540) % 360) - 180;
}
function propAdder(island, a, props) {
  return (type, t, k, extra = {}) => {
    const [x, z] = toIsland(island, onArm(a, t, k));
    props.push({ type, x, z, turn: faceIn(island, a, t), from: 1, ...extra });
  };
}
/** Raised ground on an arm: the band between angles t0..t1 and shore fractions k0..k1. */
function band(island, a, t0, t1, k0, k1, height, material = 'grass', extra = {}) {
  const { wob = 0, ...rest } = extra;
  extra = rest;
  return {
    outline: armBand(a, t0, t1, k0, k1, Math.max(6, Math.round((t1 - t0) / 3)), wob).map((p) =>
      toIsland(island, p),
    ),
    height,
    material,
    ...extra,
  };
}
/** A summit: an irregular grass shoulder with a rock top, at arm angle t, shore fraction k. */
function summit(island, a, t, k, rad, height, seed) {
  const [cx, cy] = onArm(a, t, k);
  const ring = (r, h, mat, sd) => ({
    outline: blob(cx, cy, r, sd, 11, 0.35).map((p) => toIsland(island, p)),
    height: h,
    material: mat,
  });
  return [ring(rad, height * 0.7, 'grass', seed), ring(rad * 0.55, height, 'rock', seed + 7)];
}
/** The low ground of a whole arm, with the lagoon beach `beach(t)` (shore fraction) per angle. */
function lowGround(island, a, beach, height = 0.06) {
  const outer = [],
    inner = [];
  for (let i = 0; i <= ARM_STEPS; i++) {
    const t = 19 + (i * (172 + OV)) / ARM_STEPS;
    const tip = Math.min(1, (t - 19) / 14, (191 + OV - t) / 14);
    const k0 = 0.5 - (0.5 - beach(t)) * Math.max(0.2, tip),
      k1 = 0.5 + 0.42 * Math.max(0.2, tip);
    outer.push(onArm(a, t, k1));
    inner.push(onArm(a, t, k0));
  }
  return {
    outline: [...outer, ...inner.reverse()].map((p) => toIsland(island, p)),
    height,
    material: 'grass',
  };
}

function townProps(island, a) {
  const props = [];
  const add = propAdder(island, a, props);
  // Homes, numbered from the harbour outwards: the town grows both ways along the lagoon and up
  // to the upper terrace as it climbs the levels (decision 0059).
  const homes = [
    // lower terrace, along the shore lane
    [84, 0.2, 1], [112, 0.2, 1], [78, 0.21, 1], [118, 0.235, 1], [72, 0.22, 2], [124, 0.22, 2],
    [66, 0.22, 2], [130, 0.22, 3], [60, 0.22, 3], [136, 0.22, 3], [54, 0.23, 4], [140, 0.23, 4],
    // upper terrace
    [92, 0.5, 1], [108, 0.5, 2], [84, 0.51, 2], [116, 0.51, 2], [76, 0.52, 3], [124, 0.52, 3],
    [68, 0.53, 3], [132, 0.555, 4], [100, 0.6, 4],
  ];
  homes.forEach(([t, k, from], i) =>
    add('beach-house', t, k, {
      turn: faceIn(island, a, t) + (i % 3) * 6 - 6,
      size: 1.55,
      variant: i % 4,
      shape: r4((i * 0.37) % 1),
      from,
    }),
  );
  // Juno's tea house at the harbour head: the port's signature, idle until the spice comes in.
  add('tea-house', 90, 0.24, { size: 1.45, turn: faceIn(island, a, 91) });
  add('market-hall', 100, 0.47, { size: 1.15, from: 2 });
  add('warehouse', 148, 0.32, { size: 1.15, from: 2 });
  add('crates', 108, 0.16, { size: 1, variant: 1, from: 1 });
  for (const [t, k, from] of [[97, 0.31, 1], [109, 0.31, 2], [80, 0.31, 3], [121, 0.31, 3]])
    add('lamp-post', t, k, { size: 1, from });
  add('drying-rack', 94, 0.47, { size: 1.0, from: 2 });
  add('drying-rack', 106, 0.47, { size: 1.0, from: 3 });
  // Palms between the houses: the woods keep clear of homes, so the town's own are placed.
  const palmsAt = [
    [87, 0.21], [75, 0.21], [63, 0.22], [133, 0.22],
    [88, 0.55], [112, 0.55], [80, 0.55], [120, 0.55],
  ];
  palmsAt.forEach(([t, k], i) => add('palm', t, k, { turn: (i * 67) % 360, size: 1.1 + (i % 3) * 0.15 }));
  add('moored-boat', 80, -0.1, { from: 2 });
  add('moored-boat', 121, -0.1, { from: 3 });
  // A lighthouse on each headland (ADR 0143: the two headlands are natural places for them).
  add('lighthouse', 15 + (180 + OV) - 11, 0.5, { size: 1.0, turn: 0 });
  return props;
}

function designFile(id, name, island, coastsWorld, extra) {
  return {
    id,
    name,
    style: 'tropic',
    seed: extra.seed,
    coasts: coastsWorld.map((c) => c.map((p) => toIsland(island, p))),
    ground: extra.ground,
    lanes: extra.lanes ?? [],
    piers: extra.piers ?? [],
    props: extra.props,
    woods: extra.woods,
  };
}
function bounds(points) {
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)].map((v) => r4(v));
}
/** A woods `clear` circle round arm angle t, shore fraction k, `rad` world units. */
function clearAt(island, a, t, k, rad) {
  const [x, z] = toIsland(island, onArm(a, t, k));
  return [x, z, r4(rad / island.r)];
}
/** A short side pier on the inner shore at arm angle t, in island units. */
function pierAt(island, a, t) {
  const [x, z] = toIsland(island, onArm(a, t, 0.04));
  return { x, z, length: 0.26 };
}

// North arm: the town arm. Low shore terrace, the upper terrace behind it, the rim ridge with a
// rocky summit on each shoulder (west the higher), cliffs to the open sea.
const northCoast = north.outline;
const sunreachFile = designFile('sunreach', 'Sunreach', sunreach, [northCoast], {
  seed: 7101,
  ground: [
    { coast: 0, height: 0.06, material: 'grass' },
    band(sunreach, north, 56, 144, 0.4, 0.7, 0.16),
    band(sunreach, north, 20, 66, 0.5, 0.93, 0.32, 'grass', { wob: 0.08 }),
    band(sunreach, north, 62, 138, 0.74, 0.93, 0.28, 'grass', { wob: 0.04 }),
    band(sunreach, north, 128, 212, 0.48, 0.93, 0.34, 'grass', { wob: 0.08 }),
    ...summit(sunreach, north, 42, 0.68, 12, 0.7, 31),
    ...summit(sunreach, north, 168, 0.68, 11, 0.6, 37),
  ],
  lanes: [
    { points: [56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144].map((t) => toIsland(sunreach, onArm(north, t, 0.3))) },
    { points: [66, 76, 86, 96, 104, 114, 124, 134].map((t) => toIsland(sunreach, onArm(north, t, 0.57))) },
  ],
  piers: [
    { ...pierAt(sunreach, north, 78), from: 3 },
    { ...pierAt(sunreach, north, 124), from: 4 },
  ],
  props: townProps(sunreach, north),
  woods: {
    tree: 'woodland-palm',
    tries: 900,
    area: bounds(northCoast.map((p) => toIsland(sunreach, p))),
    size: 1.8,
    margin: 0.07,
    spacing: 0.15,
    clear: [clearAt(sunreach, north, 100, 0.33, 22)],
  },
});

// South arm: the tea gardens. Three terraces climb from a white lagoon beach towards the rim,
// facing the town; pickers' cottages and a drying shed at their foot, a jetty across the Sound.
// The rim behind holds the island's highest summit. A wide beach runs along the east bay.
const southCoast = south.outline;
const southTip = 15 + (180 + OV) - 11;
const southBeach = (t) => 0.1 + bump(t, 150, 22, 0.3) + bump(t, 98, 30, 0.08);
const southProps = [];
{
  const add = propAdder(sunreachSouth, south, southProps);
  add('lighthouse', southTip, 0.5, { size: 1.0, turn: 0 });
  // Tea gardens on the terrace steps, in rows facing the lagoon.
  const rows = [
    [0.355, [86, 92, 98, 104, 110, 116]],
    [0.66, [86, 93, 100, 107]],
  ];
  rows.forEach(([k, ts], r) =>
    ts.forEach((t, i) => add('tea-garden', t, k, { size: 0.6, variant: (i + r) % 3 })),
  );
  // Pickers' cottages and the drying shed at the foot of the gardens.
  add('beach-house', 66, 0.3, { size: 1.45, variant: 2, shape: 0.2 });
  add('beach-house', 134, 0.4, { size: 1.45, variant: 0, shape: 0.6 });
  add('beach-house', 56, 0.36, { size: 1.4, variant: 3, shape: 0.8, from: 3 });
  add('tea-house', 62, 0.42, { size: 0.9, from: 2 });
  add('drying-rack', 70, 0.22, { size: 1.0 });
  add('drying-rack', 127, 0.22, { size: 1.0, from: 2 });
  add('moored-boat', 99, -0.1, { size: 0.9 });
  // The east bay's beach: a palm or two and boats drawn up.
  add('palm', 146, 0.18, { size: 1.3, turn: 40 });
  add('palm', 156, 0.2, { size: 1.1, turn: 200 });
  add('moored-boat', 151, -0.1, { size: 0.9 });
}
const southFile = designFile('sunreach-south', 'Sunreach South Arm', sunreachSouth, [southCoast], {
  seed: 7102,
  ground: [
    lowGround(sunreachSouth, south, southBeach),
    band(sunreachSouth, south, 66, 132, 0.22, 0.78, 0.12),
    band(sunreachSouth, south, 72, 126, 0.54, 0.78, 0.24),
    band(sunreachSouth, south, 22, 205, 0.8, 0.93, 0.36, 'grass', { wob: 0.04 }),
    band(sunreachSouth, south, 28, 68, 0.56, 0.93, 0.36, 'grass', { wob: 0.08 }),
    band(sunreachSouth, south, 140, 200, 0.6, 0.93, 0.36, 'grass', { wob: 0.08 }),
    ...summit(sunreachSouth, south, 48, 0.68, 13, 0.85, 41),
    ...summit(sunreachSouth, south, 176, 0.68, 10, 0.6, 43),
  ],
  piers: [{ ...pierAt(sunreachSouth, south, 99), from: 1 }],
  props: southProps,
  woods: {
    tree: 'woodland-palm',
    tries: 900,
    area: bounds(southCoast.map((p) => toIsland(sunreachSouth, p))),
    size: 1.8,
    margin: 0.07,
    spacing: 0.15,
    clear: [
      clearAt(sunreachSouth, south, 99, 0.5, 20),
      clearAt(sunreachSouth, south, 80, 0.4, 14),
      clearAt(sunreachSouth, south, 118, 0.4, 14),
    ],
  },
});

// ---------------------------------------------------------------- small islands
function blob(cx, cy, r, seed, n = 12, rough = 0.3, stretch = 1, turnDeg = 0) {
  const rand = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - rough / 2 + rand() * rough;
    const [x, y] = rot(Math.cos(a) * r * k * stretch, Math.sin(a) * r * k, turnDeg);
    pts.push([r1(cx + x), r1(cy + y)]);
  }
  return pts;
}
/** A small round island file: a beach, a grass top and its palms. */
function smallIsland(id, name, seed, props, opts = {}) {
  const coast = blob(0, 0, 1, seed, 14, 0.22, opts.stretch ?? 1).map(([x, y]) => [r4(x), r4(y)]);
  return {
    id,
    name,
    style: 'tropic',
    seed,
    coasts: [coast],
    ground: [
      { coast: 0, height: 0.07, material: 'grass' },
      ...(opts.hill
        ? [
            {
              outline: blob(-0.15, -0.2, 0.42, seed + 1, 8, 0.1).map(([x, y]) => [r4(x), r4(y)]),
              height: 0.9,
              material: 'grass',
              shape: 'peak',
              base: 0.07,
            },
          ]
        : []),
    ],
    lanes: [],
    piers: [],
    props,
    woods: {
      tree: 'woodland-palm',
      tries: opts.tries ?? 160,
      area: [-1.2, -1.2, 1.2, 1.2],
      size: 1.7,
      margin: 0.1,
      spacing: opts.spacing ?? 0.24,
      ...(opts.hill ? { clear: [[-0.15, -0.2, 0.5]] } : {}),
    },
  };
}
// Palm Key, the outpost site: empty until it is founded. The flagpole and name board come with
// the outpost's quest (`after:outpost-south`, decision 0134), added with that quest: tags must
// name a quest that exists.
const palmKey = { id: 'palm-key', x: 520, y: -730, radius: 22 };
const palmKeyFile = smallIsland(
  'palm-key',
  'Palm Key',
  7103,
  [
    { type: 'boulder', x: -0.55, z: -0.4, turn: 30, size: 0.35, variant: 1, from: 1 },
    // A stone daymark for the Narrows: the island's landmark until the outpost is founded.
    { type: 'beacon', x: -0.45, z: 0.35, turn: 0, size: 0.5, variant: 0, from: 1 },
  ],
  { hill: true, tries: 260, spacing: 0.2, stretch: 1.25 },
);
// Lone Palm: one palm on a speck of sand, and an old stone beacon beside it (a daymark).
const lonePalm = { id: 'lone-palm', x: -470, y: -665, radius: 7 };
const lonePalmFile = smallIsland(
  'lone-palm',
  'Lone Palm',
  7104,
  [
    { type: 'palm', x: 0.1, z: 0.05, turn: 20, size: 1.4, from: 1 },
    { type: 'beacon', x: -0.35, z: -0.25, turn: 0, size: 0.5, variant: 0, from: 1 },
  ],
  { tries: 0 },
);

// ---------------------------------------------------------------- reefs, bars and passages
function arcBand(b0, b1, r, thickness, seed, steps = 14) {
  const rand = rng(seed);
  const outer = [],
    inner = [];
  for (let i = 0; i <= steps; i++) {
    const b = b0 + ((b1 - b0) * i) / steps;
    const taper = Math.sin((Math.PI * i) / steps) ** 0.6;
    const w = (thickness / 2) * Math.max(0.25, taper) * (0.75 + rand() * 0.5);
    const wiggle = (rand() - 0.5) * 6;
    outer.push(polar(r + wiggle + w, b).map(r1));
    inner.push(polar(r + wiggle - w, b).map(r1));
  }
  return [...outer, ...inner.reverse()];
}
function lineBand(points, thickness, seed) {
  const rand = rng(seed);
  const left = [],
    right = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / l,
      ny = (b[0] - a[0]) / l;
    const end = i === 0 || i === points.length - 1 ? 0.35 : 1;
    const w = (thickness / 2) * end * (0.75 + rand() * 0.5);
    left.push([r1(points[i][0] + nx * w), r1(points[i][1] + ny * w)]);
    right.push([r1(points[i][0] - nx * w), r1(points[i][1] - ny * w)]);
  }
  return [...left, ...right.reverse()];
}

// The Coral Line: the broken reef barrier south of the ring, with one gateway, the Keeper's
// Passage, just outside Watchman Key (ADR 0137 layout B). The pieces overlap so that only the
// gateway lets a ship through; the ends leave the open sea to the south-east and south-west.
const GATE = [158, 168];
const terrain = [
  { id: 'coral-line-east', name: 'Coral Line', kind: 'reef', outline: arcBand(126, GATE[0], 500, 20, 11, 12) },
  { id: 'coral-line-south', kind: 'reef', outline: arcBand(GATE[1], 202, 502, 20, 12, 12) },
  { id: 'coral-line-west', kind: 'reef', outline: arcBand(197, 236, 518, 20, 13, 12) },
];
// Palm Key Narrows: a reef chain between Sunreach and Palm Key, from the open sea down to the
// edge of the sea, broken once by a sandy passage that only shallow ships cross (ADR 0137
// point 7). Deep ships go round its north end, or through the deep channel at its south end.
const NARROWS_X = 335,
  PASS = [-715, -770],
  CHANNEL_TOP = -838;
terrain.push(
  {
    id: 'narrows-north',
    name: 'Palm Key Narrows',
    kind: 'reef',
    outline: lineBand(
      [
        [NARROWS_X - 20, -560],
        [NARROWS_X - 6, -610],
        [NARROWS_X + 4, -660],
        [NARROWS_X, PASS[0] + 4],
      ],
      22,
      21,
    ),
  },
  {
    id: 'narrows-south',
    kind: 'reef',
    // It stops short of the sea's edge: the deep-water channel below it lies inside The Trades,
    // so deep ships ride the trade wind round (design review, decision 0152).
    outline: lineBand(
      [
        [NARROWS_X, PASS[1] - 4],
        [NARROWS_X + 8, -805],
        [NARROWS_X - 2, CHANNEL_TOP],
      ],
      22,
      18,
    ),
  },
  {
    id: 'narrows-passage',
    name: 'Palm Key Narrows',
    kind: 'shallows',
    maxDraft: 1.2,
    // A rounded sandy patch that overlaps both reef ends, so the passage is its only way.
    outline: Array.from({ length: 14 }, (_, i) => {
      const ang = (i / 14) * Math.PI * 2;
      const c = Math.cos(ang),
        sn = Math.sin(ang);
      const rx = 30 * Math.sign(c) * Math.abs(c) ** 0.6,
        ry = ((PASS[0] - PASS[1]) / 2 + 10) * Math.sign(sn) * Math.abs(sn) ** 0.6;
      return [r1(NARROWS_X + rx), r1((PASS[0] + PASS[1]) / 2 + ry)];
    }),
  },
  // Landmarks in the open sea, so a crossing always has something to steer by (layout B).
  {
    id: 'wreck-reef',
    name: 'Wreck Reef',
    kind: 'reef',
    outline: blob(560, -330, 30, 31, 10, 0.4, 1.7, 25),
    look: { landmark: 'wreck', landmarkAt: { x: 556, y: -328 } },
  },
  { id: 'sugar-bar', name: 'Sugar Bar', kind: 'sandbank', outline: blob(-520, -380, 34, 41, 12, 0.35, 2.2, -35) },
  { id: 'sugar-bar-spit', kind: 'sandbank', outline: blob(-470, -430, 14, 42, 9, 0.4, 1.6, -60) },
  { id: 'palm-islet-west', kind: 'island', outline: blob(-330, -585, 13, 51, 10, 0.3, 1.3, 20), look: { trees: 6 } },
  { id: 'palm-islet-south', kind: 'island', outline: blob(190, -900, 11, 52, 10, 0.3, 1.4, -10), look: { trees: 5 } },
  { id: 'glass-shoal', kind: 'sandbank', outline: blob(560, -575, 12, 53, 9, 0.35, 1.8, 50) },
);

// ---------------------------------------------------------------- wind zones
const ellipse = (cx, cy, rx, ry, turnDeg, n = 10) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const [x, y] = rot(Math.cos(a) * rx, Math.sin(a) * ry, turnDeg);
    return [r1(cx + x), r1(cy + y)];
  });
const trades = [];
for (let b = 118; b <= 242; b += 8) trades.push(polar(SEA - 8, b).map(r1));
for (let b = 242; b >= 118; b -= 8) trades.push(polar(872, b).map(r1));
const windZones = [
  {
    id: 'sunreach-sound',
    name: 'Sunreach Sound',
    kind: 'sheltered',
    headingDeg: 90,
    // A paler, smoother lagoon (the calm-water look of decision 0144), softer than The Glass.
    tune: { glassy: 0.35 },
    outline: ellipse(CX, CY, 92, 70, PHI, 10),
  },
  // South of Wreck Reef, on the open water between the ring's east side and Palm Key.
  { id: 'the-glass', name: 'The Glass', kind: 'doldrums', outline: ellipse(525, -545, 115, 72, 25, 12) },
  { id: 'the-trades', name: 'The Trades', kind: 'trade-belt', headingDeg: 70, outline: trades },
];

// ---------------------------------------------------------------- the sea file
const gateMid = polar(500, (GATE[0] + GATE[1]) / 2);
const gateA = polar(500, GATE[0] + 2.4),
  gateB = polar(500, GATE[1] - 2.4);
const sea = {
  about:
    'The south sea, Sunreach (decisions 0137, 0143, 0152). Merged onto the Windward Ring by src/data/grownMap.ts; play it with ?map=phase4. Written by docs/reviews/south-sea/src/make-south.cjs, then edited as data.',
  id: 'south',
  name: 'Sunreach',
  islands: [
    { id: 'sunreach', name: 'Sunreach', x: sunreach.x, y: sunreach.y, radius: sunreach.r, look: { design: 'sunreach', dock: true } },
    {
      id: 'sunreach-south',
      // No name: the chart names the ring once, at its port.
      x: sunreachSouth.x,
      y: sunreachSouth.y,
      radius: sunreachSouth.r,
      look: { design: 'sunreach-south', harbourBearing: r4(sunreachSouth.bearing) },
    },
    { ...palmKey, name: 'Palm Key', look: { design: 'palm-key' } },
    { ...lonePalm, name: 'Lone Palm', look: { design: 'lone-palm', harbourBearing: 0 } },
  ],
  terrain,
  ports: [
    // Trade from the far goods (decision 0150): Sunreach's workshop crafts spiced tea only from
    // the spice it receives. Palm Key gets its port when outposts can be founded (decision 0137,
    // outpost-south arc): then maxLevel 3, levelProduces 2: spice through afterQuest.
    {
      id: 'sunreach',
      name: 'Sunreach',
      islandId: 'sunreach',
      produces: [],
      wants: ['spice'],
      wantsMade: ['honey', 'planks', 'bread'],
      level: 3,
      levelProduces: { 3: ['spicedTea'] },
    },
  ],
  course: [
    sunreachWp,
    { label: 'Palm Key', x: palmKey.x - 50, y: palmKey.y - 10 },
  ],
  marks: [
    // Sunreach's two entrances: a red buoy off the north arm, a green one off the south arm.
    ...entranceBuoys(),
    // The Keeper's Passage: a red and a green buoy each side, and its light on the chart.
    { type: 'buoy-red', x: r1(gateA[0]), y: r1(gateA[1]), chart: true },
    { type: 'buoy-green', x: r1(gateB[0]), y: r1(gateB[1]), chart: true },
    { type: 'light', x: r1(gateMid[0]), y: r1(gateMid[1]), chart: true },
    // Palm Key Narrows: the sandy passage between the reefs.
    { type: 'buoy-red', x: NARROWS_X - 22, y: PASS[0] - 2, chart: true },
    { type: 'buoy-green', x: NARROWS_X + 22, y: PASS[0] - 2, chart: true },
    { type: 'buoy-red', x: NARROWS_X - 22, y: PASS[1] + 2, chart: true },
    { type: 'buoy-green', x: NARROWS_X + 22, y: PASS[1] + 2, chart: true },
    // Cardinal marks at both ends of the Narrows reefs: pass north of the north one (the long
    // way round), south of the south one (the deep channel inside The Trades).
    { type: 'cardinal-north', x: NARROWS_X - 22, y: -532, chart: true },
    { type: 'cardinal-south', x: NARROWS_X - 2, y: CHANNEL_TOP - 24, chart: true },
  ],
  windZones,
};

/** The narrowest point of each entrance (west and east), with a buoy each side of the channel. */
function entranceBuoys() {
  const out = [];
  for (const side of [-1, 1]) {
    let best = null;
    for (const p of north.outline)
      for (const q of south.outline) {
        if ((p[0] - CX) * side < 40 || (q[0] - CX) * side < 40) continue;
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (!best || d < best.d) best = { p, q, d };
      }
    const at = (f) => [r1(best.p[0] + (best.q[0] - best.p[0]) * f), r1(best.p[1] + (best.q[1] - best.p[1]) * f)];
    const [rx, ry] = at(0.18),
      [gx, gy] = at(0.82);
    out.push({ type: 'buoy-red', x: rx, y: ry }, { type: 'buoy-green', x: gx, y: gy });
  }
  return out;
}

// Keep clear of the ring: nothing of the south sea within 60 units of the ring's land.
const ringPoints = [
  ...ring.terrain.flatMap((t) => t.outline),
  ...ring.islands.map((i) => [i.x, i.y]),
];
for (const t of terrain)
  for (const [x, y] of t.outline)
    for (const [rx, ry] of ringPoints)
      if (Math.hypot(x - rx, y - ry) < 60) throw new Error(`${t.id} too close to the ring`);

const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('wrote', path.relative(ROOT, file));
};
write(path.join(DATA, 'seas', 'south.json'), sea);
write(path.join(DATA, 'islands', 'sunreach.json'), sunreachFile);
write(path.join(DATA, 'islands', 'sunreach-south.json'), southFile);
write(path.join(DATA, 'islands', 'palm-key.json'), palmKeyFile);
write(path.join(DATA, 'islands', 'lone-palm.json'), lonePalmFile);
console.log('north arm thickness at the town', thick.toFixed(1), 'centre', sunreach, 'wp', sunreachWp);
