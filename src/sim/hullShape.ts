/** Hull sections shared by rendering and harbour proximity. No rendering dependencies. */
export interface HullShape {
  outline: ReadonlyArray<readonly [number, number]>;
  rings: ReadonlyArray<{ t: number; beam: number; length: number }>;
}

export const HULL_SCALE = 2.2;
export const HULL_BEAM_SCALE = 1.05;
export const HULL_DIMENSIONS: Record<string, { length: number; beam: number }> = {
  sloop: { length: 5, beam: 1.9 },
  cutter: { length: 6.2, beam: 2.1 },
  schooner: { length: 8.2, beam: 2.3 },
  clipper: { length: 9.8, beam: 2.4 },
  hoy: { length: 6.2, beam: 2.7 },
  fluyt: { length: 11.5, beam: 3.5 },
  indiaman: { length: 13, beam: 3.8 },
};

export const SLOOP_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.23, 0.4],
    [0.4, 0.23],
    [0.5, 0],
    [0.48, -0.25],
    [0.34, -0.44],
    [0.16, -0.5],
    [-0.16, -0.5],
    [-0.34, -0.44],
    [-0.48, -0.25],
    [-0.5, 0],
    [-0.4, 0.23],
    [-0.23, 0.4],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 1.01, length: 0.99 },
    { t: 0.65, beam: 0.8, length: 0.93 },
    { t: 1, beam: 0.18, length: 0.78 },
  ],
};

export const CUTTER_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.14, 0.4],
    [0.32, 0.23],
    [0.47, 0],
    [0.5, -0.18],
    [0.45, -0.36],
    [0.38, -0.5],
    [-0.38, -0.5],
    [-0.45, -0.36],
    [-0.5, -0.18],
    [-0.47, 0],
    [-0.32, 0.23],
    [-0.14, 0.4],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 0.96, length: 0.99 },
    { t: 0.65, beam: 0.7, length: 0.9 },
    { t: 1, beam: 0.06, length: 0.74 },
  ],
};

export const SCHOONER_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.12, 0.41],
    [0.34, 0.25],
    [0.5, 0.06],
    [0.48, -0.17],
    [0.35, -0.36],
    [0.22, -0.5],
    [-0.22, -0.5],
    [-0.35, -0.36],
    [-0.48, -0.17],
    [-0.5, 0.06],
    [-0.34, 0.25],
    [-0.12, 0.41],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 0.97, length: 0.98 },
    { t: 0.65, beam: 0.65, length: 0.86 },
    { t: 1, beam: 0.09, length: 0.69 },
  ],
};

export const CLIPPER_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.08, 0.42],
    [0.25, 0.29],
    [0.43, 0.12],
    [0.5, -0.08],
    [0.45, -0.3],
    [0.28, -0.5],
    [-0.28, -0.5],
    [-0.45, -0.3],
    [-0.5, -0.08],
    [-0.43, 0.12],
    [-0.25, 0.29],
    [-0.08, 0.42],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 0.94, length: 0.99 },
    { t: 0.65, beam: 0.56, length: 0.88 },
    { t: 1, beam: 0.07, length: 0.76 },
  ],
};

export const HOY_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.27, 0.47],
    [0.42, 0.39],
    [0.5, 0.22],
    [0.5, -0.12],
    [0.47, -0.34],
    [0.34, -0.5],
    [-0.34, -0.5],
    [-0.47, -0.34],
    [-0.5, -0.12],
    [-0.5, 0.22],
    [-0.42, 0.39],
    [-0.27, 0.47],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.3, beam: 0.98, length: 0.98 },
    { t: 0.75, beam: 0.86, length: 0.9 },
    { t: 1, beam: 0.6, length: 0.8 },
  ],
};

export const FLUYT_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.26, 0.45],
    [0.42, 0.32],
    [0.5, 0.12],
    [0.5, -0.1],
    [0.44, -0.3],
    [0.32, -0.44],
    [0.2, -0.5],
    [-0.2, -0.5],
    [-0.32, -0.44],
    [-0.44, -0.3],
    [-0.5, -0.1],
    [-0.5, 0.12],
    [-0.42, 0.32],
    [-0.26, 0.45],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.28, beam: 1.16, length: 0.99 },
    { t: 0.62, beam: 1.08, length: 0.93 },
    { t: 1, beam: 0.56, length: 0.8 },
  ],
};

export const INDIAMAN_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.22, 0.44],
    [0.38, 0.33],
    [0.47, 0.18],
    [0.5, 0.02],
    [0.5, -0.24],
    [0.47, -0.39],
    [0.42, -0.5],
    [-0.42, -0.5],
    [-0.47, -0.39],
    [-0.5, -0.24],
    [-0.5, 0.02],
    [-0.47, 0.18],
    [-0.38, 0.33],
    [-0.22, 0.44],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.3, beam: 1.04, length: 0.99 },
    { t: 0.66, beam: 0.96, length: 0.94 },
    { t: 1, beam: 0.5, length: 0.8 },
  ],
};

export const HULL_SHAPES: Record<string, HullShape> = {
  sloop: SLOOP_HULL,
  cutter: CUTTER_HULL,
  schooner: SCHOONER_HULL,
  clipper: CLIPPER_HULL,
  hoy: HOY_HULL,
  fluyt: FLUYT_HULL,
  indiaman: INDIAMAN_HULL,
};
