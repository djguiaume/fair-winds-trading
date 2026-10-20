/**
 * Background music composer (decision 0045). Pure and seeded: turns a seed into one
 * "tune", a list of timed notes, with no Web Audio in sight so it can be tested and reused.
 *
 * Every tune is 16 bars in AABB form, each phrase played twice (first ending open on the
 * dominant, then closed on the tonic), so it sounds composed rather than random. A few bars of
 * pad alone follow before the next tune, which gets a new seed: the music never loops exactly.
 *
 * Time is counted in eighth notes; a bar is 6 of them (6/8, two dotted-quarter beats).
 */
import { createRng, type Rng } from '../sim/rng';

export type Voice = 'melody' | 'bass' | 'pad';

export interface Note {
  voice: Voice;
  /** MIDI note number (60 = middle C). */
  midi: number;
  /** Start, in eighth notes from the start of the tune. */
  at: number;
  /** Length in eighth notes. */
  len: number;
  /** 0..1 loudness inside its voice. */
  vel: number;
}

export interface Tune {
  notes: Note[];
  /** Total length in eighth notes, rest bars included. */
  length: number;
  /** Seconds per eighth note. */
  eighth: number;
}

export const EIGHTHS_PER_BAR = 6;
const PHRASE_BARS = 4;
const REST_BARS = 4;

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

/**
 * "Fair Winds", the sailing theme Guillaume picked (decision 0045): a sea-folk air on a flute
 * over quiet chords and one bass note per bar. A first, fuller version felt crowded, so this is
 * the light-band take: long notes, a few gaps in the melody, no ornaments, a light echo.
 */
export const THEME = {
  /** Dotted-quarter beats per minute, picked per tune in [min, max]. */
  tempo: [84, 92],
  /** D major, G major, D dorian, A dorian (dorian is the minor of old sea tunes). */
  keys: [
    { tonic: 62, scale: MAJOR },
    { tonic: 67, scale: MAJOR },
    { tonic: 62, scale: DORIAN },
    { tonic: 69, scale: DORIAN },
  ],
  /** Bar rhythms in eighths; each sums to 6. */
  rhythms: [[3, 3], [3, 2, 1], [2, 1, 3], [6], [4, 2]],
  /** Chance a weak-beat melody note becomes a rest, to give the tune room to breathe. */
  restChance: 0.15,
  /** Pad chord loudness. */
  padVel: 0.55,
  /** Echo send on the flute, 0..1. */
  echo: 0.15,
} as const;

type Key = (typeof THEME.keys)[number];

/** Progressions as scale degrees (0 = tonic chord), one chord per bar; the 4th bar is replaced
 * by the cadence chord. */
const PROGRESSIONS = [
  [0, 4, 5, 3],
  [0, 3, 0, 4],
  [0, 5, 3, 4],
  [0, 3, 4, 4],
  [5, 3, 0, 4],
  [0, 6, 3, 4],
];

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** MIDI note of scale step `step` (can be negative or past an octave). */
export function scaleNote(tonic: number, scale: readonly number[], step: number): number {
  const octave = Math.floor(step / scale.length);
  return tonic + octave * 12 + scale[step - octave * scale.length]!;
}

/** Scale steps of the triad built on `degree`. */
const triad = (degree: number) => [degree, degree + 2, degree + 4];

const LOW = -2;
const HIGH = 9;

/** Nearest step to `from` whose pitch class is one of the chord's. */
function nearestChordStep(from: number, degree: number) {
  const tones = triad(degree).map((s) => mod(s, 7));
  let best = from;
  let bestDist = Infinity;
  for (let s = LOW; s <= HIGH; s++) {
    if (!tones.includes(mod(s, 7))) continue;
    const d = Math.abs(s - from);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** One bar of melody as [step, length] pairs (step null = rest). Strong beats (0 and 3) land
 * on chord tones; the notes between move by step. */
function melodyBar(rng: Rng, start: number, degree: number) {
  const out: [number | null, number][] = [];
  let step = start;
  let pos = 0;
  for (const len of pick(rng, THEME.rhythms)) {
    if (pos === 0 || pos === 3) {
      // Move to a nearby chord tone, but not the same note as the last strong beat.
      const from = step;
      step = nearestChordStep(from + Math.round((rng() - 0.5) * 4), degree);
      if (step === from) step = nearestChordStep(from + (rng() < 0.5 ? 2 : -2), degree);
      out.push([step, len]);
    } else {
      step = Math.max(LOW, Math.min(HIGH, step + pick(rng, [-1, -1, 1, 1, 2, -2])));
      out.push([rng() < THEME.restChance ? null : step, len]);
    }
    pos += len;
  }
  return out;
}

/** Last bar of a phrase: settle on the tonic, or a half cadence on the fifth, in the octave
 * nearest where the melody left off. */
const cadenceBar = (home: boolean, last: number): [number, number][] => {
  if (home) {
    const o = last >= 5 ? 7 : 0;
    return [
      [o + 2, 3],
      [o, 3],
    ];
  }
  const o = last >= 9 ? 7 : last >= 2 ? 0 : -7;
  return [
    [o + 5, 3],
    [o + 4, 3],
  ];
};

/** Compose one tune. Same seed, same tune. */
export function composeTune(seed: number): Tune {
  const rng = createRng(seed);
  const key: Key = pick(rng, THEME.keys);
  const notes: Note[] = [];
  const at = (bar: number, eighth = 0) => bar * EIGHTHS_PER_BAR + eighth;

  const phrases = [0, 1].map(() => {
    const prog = pick(rng, PROGRESSIONS);
    let step = pick(rng, [0, 2, 4, 7]);
    const bars = prog.slice(0, PHRASE_BARS - 1).map((degree) => {
      const bar = melodyBar(rng, step, degree);
      for (const [s] of bar) if (s !== null) step = s;
      return bar;
    });
    return { prog, bars, last: step };
  });

  let bar = 0;
  for (const phrase of phrases) {
    for (const home of [false, true]) {
      const chords = [...phrase.prog.slice(0, PHRASE_BARS - 1), home ? 0 : 4];
      const bars = [...phrase.bars, cadenceBar(home, phrase.last)];
      chords.forEach((degree, i) => {
        let pos = 0;
        for (const [step, len] of bars[i]!) {
          if (step !== null) {
            const midi = scaleNote(key.tonic, key.scale, step);
            const vel = pos === 0 ? 0.9 : pos === 3 ? 0.75 : 0.6;
            notes.push({ voice: 'melody', midi, at: at(bar, pos), len, vel });
          }
          pos += len;
        }
        accompany(notes, key, degree, at(bar), 1);
        bar++;
      });
    }
  }

  // Pad-only rest: tonic, a soft move away and back, so the next tune enters fresh.
  [0, 3, 0, 0].slice(0, REST_BARS).forEach((degree, i) => {
    accompany(notes, key, degree, at(bar), 0.6 - i * 0.1, true);
    bar++;
  });

  const [lo, hi] = THEME.tempo;
  return {
    notes,
    length: bar * EIGHTHS_PER_BAR,
    eighth: 60 / (3 * (lo + Math.floor(rng() * (hi - lo + 1)))),
  };
}

/** Pad chord for the bar, plus one bass note on the downbeat (none in the rest bars). */
function accompany(
  notes: Note[],
  key: Key,
  degree: number,
  start: number,
  vel: number,
  padOnly = false,
) {
  const { tonic, scale } = key;
  for (const step of triad(degree)) {
    const midi = scaleNote(tonic - 12, scale, step);
    notes.push({ voice: 'pad', midi, at: start, len: 6, vel: vel * THEME.padVel });
  }
  if (padOnly) return;
  const root = scaleNote(tonic - 24, scale, degree);
  notes.push({ voice: 'bass', midi: root, at: start, len: 3, vel: vel * 0.8 });
}

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
