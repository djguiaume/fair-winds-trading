/**
 * Background music composer (decision 0045). Pure and seeded: turns a seed into one
 * "tune", a list of timed notes, with no Web Audio in sight so it can be tested and reused.
 *
 * Every tune is 16 bars in AABB form, each phrase played twice (first ending open on the
 * dominant, then closed on the tonic), so it sounds composed rather than random. A few bars of
 * pad alone follow before the next tune, which gets a new seed: the music never loops exactly.
 *
 * Time is counted in eighth notes; a bar is 6 of them (6/8, two dotted-quarter beats).
 *
 * The theme, what makes it this tune and not another, is data (decision 0111): tempo, keys and
 * scales, bar rhythms, chord progressions, melody moves, rests and loudness come from a file in
 * `src/data/music/`, picked by `src/data/audio.json`. The form above (AABB, 6/8, cadences, chord
 * tones on the strong beats) and the sound itself (`synth.ts`) stay code.
 */
import { createRng, type Rng } from '../sim/rng';
import fairWinds from '../data/music/fair-winds.json';

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

/** A theme file in `src/data/music/` (decision 0111). Steps are scale steps, 0 = tonic. */
export interface Theme {
  name: string;
  /** Dotted-quarter beats per minute, picked per tune in [min, max]. */
  tempo: [number, number];
  /** Scales as semitones above the tonic, by name. */
  scales: Record<string, number[]>;
  /** The keys a tune can be in: tonic as a MIDI note, and a scale name. */
  keys: { tonic: number; scale: string }[];
  /** Bar rhythms in eighths; each sums to 6. */
  rhythms: number[][];
  /** Progressions as scale degrees (0 = tonic chord), one chord per bar; the 4th bar is replaced
   * by the cadence chord. */
  progressions: number[][];
  /** Where a phrase's melody may start. */
  startSteps: number[];
  /** Lowest and highest melody step. */
  range: [number, number];
  /** How far a strong-beat note may jump before it settles on a chord tone. */
  leap: number;
  /** Steps a weak-beat note moves by, picked evenly (repeat one to make it likelier). */
  moves: number[];
  /** Chance a weak-beat melody note becomes a rest, to give the tune room to breathe. */
  restChance: number;
  /** Melody loudness on the downbeat, the second beat and the notes between. */
  accents: [number, number, number];
  /** Pad chord loudness. */
  padVel: number;
  /** Bass note loudness. */
  bassVel: number;
  /** Chords of the pad-only bars between tunes, as degrees. */
  restBars: number[];
  /** Echo send on the flute, 0..1. */
  echo: number;
}

/**
 * "Fair Winds", the sailing theme Guillaume picked (decision 0045): a sea-folk air on a flute
 * over quiet chords and one bass note per bar. A first, fuller version felt crowded, so this is
 * the light-band take: long notes, a few gaps in the melody, no ornaments, a light echo. Keys:
 * D major, G major, D dorian, A dorian (dorian is the minor of old sea tunes).
 */
export const THEME: Readonly<Theme> = fairWinds as unknown as Theme;

type Key = { tonic: number; scale: readonly number[] };

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** MIDI note of scale step `step` (can be negative or past an octave). */
export function scaleNote(tonic: number, scale: readonly number[], step: number): number {
  const octave = Math.floor(step / scale.length);
  return tonic + octave * 12 + scale[step - octave * scale.length]!;
}

/** Scale steps of the triad built on `degree`. */
const triad = (degree: number) => [degree, degree + 2, degree + 4];

/** Nearest step to `from` whose pitch class is one of the chord's. */
function nearestChordStep(theme: Theme, from: number, degree: number) {
  const tones = triad(degree).map((s) => mod(s, 7));
  let best = from;
  let bestDist = Infinity;
  const [low, high] = theme.range;
  for (let s = low; s <= high; s++) {
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
function melodyBar(theme: Theme, rng: Rng, start: number, degree: number) {
  const out: [number | null, number][] = [];
  let step = start;
  let pos = 0;
  const [low, high] = theme.range;
  for (const len of pick(rng, theme.rhythms)) {
    if (pos === 0 || pos === 3) {
      // Move to a nearby chord tone, but not the same note as the last strong beat.
      const from = step;
      step = nearestChordStep(theme, from + Math.round((rng() - 0.5) * theme.leap), degree);
      if (step === from) step = nearestChordStep(theme, from + (rng() < 0.5 ? 2 : -2), degree);
      out.push([step, len]);
    } else {
      step = Math.max(low, Math.min(high, step + pick(rng, theme.moves)));
      out.push([rng() < theme.restChance ? null : step, len]);
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

/** Compose one tune of `theme`. Same seed, same tune. */
export function composeTune(seed: number, theme: Theme = THEME): Tune {
  const rng = createRng(seed);
  const picked = pick(rng, theme.keys);
  const key: Key = { tonic: picked.tonic, scale: theme.scales[picked.scale]! };
  const notes: Note[] = [];
  const at = (bar: number, eighth = 0) => bar * EIGHTHS_PER_BAR + eighth;

  const phrases = [0, 1].map(() => {
    const prog = pick(rng, theme.progressions);
    let step = pick(rng, theme.startSteps);
    const bars = prog.slice(0, PHRASE_BARS - 1).map((degree) => {
      const bar = melodyBar(theme, rng, step, degree);
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
            const [down, second, between] = theme.accents;
            const vel = pos === 0 ? down : pos === 3 ? second : between;
            notes.push({ voice: 'melody', midi, at: at(bar, pos), len, vel });
          }
          pos += len;
        }
        accompany(theme, notes, key, degree, at(bar), 1);
        bar++;
      });
    }
  }

  // Pad-only rest: tonic, a soft move away and back, so the next tune enters fresh.
  theme.restBars.forEach((degree, i) => {
    accompany(theme, notes, key, degree, at(bar), 0.6 - i * 0.1, true);
    bar++;
  });

  const [lo, hi] = theme.tempo;
  return {
    notes,
    length: bar * EIGHTHS_PER_BAR,
    eighth: 60 / (3 * (lo + Math.floor(rng() * (hi - lo + 1)))),
  };
}

/** Pad chord for the bar, plus one bass note on the downbeat (none in the rest bars). */
function accompany(
  theme: Theme,
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
    notes.push({ voice: 'pad', midi, at: start, len: 6, vel: vel * theme.padVel });
  }
  if (padOnly) return;
  const root = scaleNote(tonic - 24, scale, degree);
  notes.push({ voice: 'bass', midi: root, at: start, len: 3, vel: vel * theme.bassVel });
}

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
