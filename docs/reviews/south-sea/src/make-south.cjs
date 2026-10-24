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
function armBand(a, t0, t1, k0, k1, steps = 8) {
  const outer = [],
    inner = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    // Round the ends: the band narrows towards both ends.
    const e = Math.sin((Math.PI * i) / steps) ** 0.5;
    const mid = (k0 + k1) / 2,
      half = ((k1 - k0) / 2) * Math.max(0.35, e);
    outer.push(onArm(a, t, mid + half));
    inner.push(onArm(a, t, mid - half));
  }
  return [...outer, ...inner.reverse()];
}

function townProps(island, a) {
  const props = [];
  const R = island.r / 2.2;
  const at = (t, k) => toIsland(island, onArm(a, t, k));
  // Faces the lagoon: the house's front turns to the harbour direction of the shore there.
  const faceIn = (t) => {
    const p = onArm(a, t, 0),
      q = onArm(a, t, 1);
    const b = bearingOf(p[0] - q[0], p[1] - q[1]);
    return Math.round(((Math.PI - (b - island.bearing)) / DEG + 540) % 360) - 180;
  };
  // Homes in two rows along the inner shore, numbered from the harbour outwards: the town grows
  // both ways along the lagoon as it climbs the levels (decision 0059).
  const rows = [
    [92, 0.24], [108, 0.24], [86, 0.26], [114, 0.26], [93, 0.42], [107, 0.42],
    [80, 0.24], [120, 0.25], [84, 0.42], [116, 0.42], [72, 0.25], [128, 0.26],
    [76, 0.43], [124, 0.43], [64, 0.27], [136, 0.27], [68, 0.44], [132, 0.44],
    [56, 0.3], [144, 0.29], [60, 0.46], [140, 0.46],
  ];
  const from = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4];
  rows.forEach(([t, k], i) => {
    const [x, z] = at(t, k);
    props.push({
      type: 'beach-house',
      x,
      z,
      turn: faceIn(t) + (i % 3) * 6 - 6,
      size: 1.55,
      variant: i % 4,
      shape: r4((i * 0.37) % 1),
      from: from[i],
    });
  });
  const add = (type, t, k, extra = {}) => {
    const [x, z] = at(t, k);
    props.push({ type, x, z, turn: faceIn(t), from: 1, ...extra });
  };
  add('market-hall', 100, 0.58, { size: 1.2, from: 3 });
  add('warehouse', 121, 0.62, { size: 1.2, from: 2 });
  add('crates', 90, 0.17, { size: 1, variant: 1, from: 2 });
  add('lamp-post', 88, 0.2, { size: 1 });
  add('lamp-post', 106, 0.16, { size: 1, from: 2 });
  add('lamp-post', 118, 0.17, { size: 1, from: 3 });
  // Drying racks: where Juno's tea will dry once the spice comes in (decisions 0146, 0147).
  add('drying-rack', 70, 0.6, { size: 1.1, from: 2 });
  add('drying-rack', 130, 0.6, { size: 1.1, from: 3 });
  // Palms between the houses: the woods keep clear of homes, so the town's own are placed.
  const palmsAt = [
    [90, 0.32], [110, 0.31], [82, 0.52], [118, 0.5], [74, 0.35], [126, 0.36], [66, 0.53],
    [134, 0.52], [98, 0.5], [60, 0.37], [140, 0.37], [104, 0.3],
  ];
  palmsAt.forEach(([t, k], i) => add('palm', t, k, { turn: (i * 67) % 360, size: 1.1 + (i % 3) * 0.15 }));
  add('moored-boat', 82, -0.12, { from: 2 });
  add('moored-boat', 118, -0.12, { from: 3 });
  // A lighthouse on each headland (ADR 0143: the two headlands are natural places for them).
  const tip = 15 + (180 + OV) - 11;
  add('lighthouse', tip, 0.5, { size: 1.0, turn: 0 });
  void R;
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

/**
 * A green hill (decision 0152: grass peaks on the palm islands): a low-poly cone standing on
 * the arm at angle t, `k` of the way across, `rad` units round and `h` (island-height units)
 * tall. Its woods `clear` circle keeps palms off its slopes.
 */
function hill(island, a, t, k, rad, h, stretch = 1) {
  // Keep the whole hill on land: no wider than the arm allows round its centre.
  let room = Infinity;
  for (const dt of [-8, -4, 0, 4, 8]) {
    const p = onArm(a, t + dt, 0),
      q = onArm(a, t + dt, 1);
    const across = Math.hypot(p[0] - q[0], p[1] - q[1]);
    room = Math.min(room, across * Math.min(k, 1 - k) * 0.8);
  }
  rad = Math.min(rad, room / stretch);
  const [cx, cy] = onArm(a, t, k);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    pts.push(toIsland(island, [cx + Math.cos(ang) * rad * stretch, cy + Math.sin(ang) * rad]));
  }
  const [x, z] = toIsland(island, [cx, cy]);
  return {
    ground: { outline: pts, height: h, material: 'grass', shape: 'peak', base: 0.06 },
    clear: [x, z, r4((rad * stretch * 1.05) / island.r)],
  };
}

const northCoast = north.outline;
// Behind the town: a big hill on the west shoulder, a pair on the east and a knoll between.
const northHills = [
  hill(sunreach, north, 46, 0.68, 20, 0.62),
  hill(sunreach, north, 158, 0.66, 22, 0.7),
  hill(sunreach, north, 176, 0.6, 14, 0.45),
  hill(sunreach, north, 100, 0.9, 10, 0.3, 1.6),
];
const sunreachFile = designFile('sunreach', 'Sunreach', sunreach, [northCoast], {
  seed: 7101,
  ground: [{ coast: 0, height: 0.06, material: 'grass' }, ...northHills.map((h) => h.ground)],
  lanes: [
    {
      points: [60, 70, 80, 90, 100, 110, 120, 130, 140].map((t) =>
        toIsland(sunreach, onArm(north, t, 0.33)),
      ),
    },
  ],
  piers: [
    { ...pierAt(sunreach, north, 78), from: 3 },
    { ...pierAt(sunreach, north, 124), from: 4 },
  ],
  props: townProps(sunreach, north),
  woods: {
    tree: 'woodland-palm',
    tries: 700,
    area: bounds(northCoast.map((p) => toIsland(sunreach, p))),
    size: 1.8,
    margin: 0.07,
    spacing: 0.19,
    clear: northHills.map((h) => h.clear),
  },
});
/** A short side pier on the inner shore at arm angle t, in island units. */
function pierAt(island, a, t) {
  const [x, z] = toIsland(island, onArm(a, t, 0.04));
  return { x, z, length: 0.26 };
}

const southCoast = south.outline;
const southTip = 15 + (180 + OV) - 11;
const southHills = [
  hill(sunreachSouth, south, 72, 0.6, 26, 0.8),
  hill(sunreachSouth, south, 96, 0.55, 18, 0.5),
  hill(sunreachSouth, south, 160, 0.6, 20, 0.55),
  hill(sunreachSouth, south, 40, 0.55, 13, 0.36),
];
const southFile = designFile('sunreach-south', 'Sunreach South Arm', sunreachSouth, [southCoast], {
  seed: 7102,
  ground: [{ coast: 0, height: 0.06, material: 'grass' }, ...southHills.map((h) => h.ground)],
  props: [
    (() => {
      const [x, z] = toIsland(sunreachSouth, onArm(south, southTip, 0.5));
      return { type: 'lighthouse', x, z, turn: 0, size: 1.0, from: 1 };
    })(),
  ],
  woods: {
    tree: 'woodland-palm',
    tries: 800,
    area: bounds(southCoast.map((p) => toIsland(sunreachSouth, p))),
    size: 1.8,
    margin: 0.07,
    spacing: 0.17,
    clear: southHills.map((h) => h.clear),
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
// point 7). Deep ships go round its north end.
const NARROWS_X = 335,
  PASS = [-715, -770];
const chainTip = Math.sqrt((SEA - 7) ** 2 - NARROWS_X ** 2);
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
    outline: (() => {
      const pts = lineBand(
        [
          [NARROWS_X, PASS[1] - 4],
          [NARROWS_X + 8, -830],
          [NARROWS_X - 4, -880],
          [NARROWS_X, -chainTip + 30],
        ],
        22,
        22,
      );
      // Close the gap to the edge of the sea with a pointed tip.
      pts.splice(4, 0, [NARROWS_X, r1(-chainTip)]);
      return pts;
    })(),
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
  { id: 'glass-shoal', kind: 'sandbank', outline: blob(240, -640, 12, 53, 9, 0.35, 1.8, 50) },
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
    outline: ellipse(CX, CY, 92, 70, PHI, 10),
  },
  { id: 'the-glass', name: 'The Glass', kind: 'doldrums', outline: ellipse(150, -600, 80, 46, 30, 10) },
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
    // The Keeper's Passage: a red and a green buoy each side, and its light on the chart.
    { type: 'buoy-red', x: r1(gateA[0]), y: r1(gateA[1]), chart: true },
    { type: 'buoy-green', x: r1(gateB[0]), y: r1(gateB[1]), chart: true },
    { type: 'light', x: r1(gateMid[0]), y: r1(gateMid[1]), chart: true },
    // Palm Key Narrows: the sandy passage between the reefs.
    { type: 'buoy-red', x: NARROWS_X - 22, y: PASS[0] - 2, chart: true },
    { type: 'buoy-green', x: NARROWS_X + 22, y: PASS[0] - 2, chart: true },
    { type: 'buoy-red', x: NARROWS_X - 22, y: PASS[1] + 2, chart: true },
    { type: 'buoy-green', x: NARROWS_X + 22, y: PASS[1] + 2, chart: true },
  ],
  windZones,
};

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
