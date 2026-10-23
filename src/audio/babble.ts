/**
 * Babble voices (decision 0132, from the storyteller brief 0129): when a person's card opens they
 * "speak" a short burble of made-up syllables, one per word of the card's ask, at most about
 * 1.5 s. Nothing is recorded, so a changed line never needs recording again, and it sounds the
 * same in every language.
 *
 * A generated voice is a few numbers in `src/data/audio.json` › `voices`; a recorded one is one
 * or a few short clips in `public/audio/voices/`, picked at random and cut to length. The plan
 * (which syllables, how high, how long) is plain data, so it is tested without a sound card.
 *
 * Budget for old phones: one oscillator, two band-pass filters and one gain per syllable, at most
 * eight syllables, each unhooked when it ends.
 */

/** Numbers of a generated voice; a mood can change any of them. */
export interface BabbleShape {
  /** 1 = a middle voice (about 180 Hz); 0.8 lower, 1.4 higher. */
  pitch?: number;
  /** 1 = about seven syllables a second; higher talks faster. */
  speed?: number;
  /** How much each syllable's pitch wanders, 0 (flat) to about 0.4 (sing-song). */
  wobble?: number;
  /** The vowels the voice favours, from "aeiou"; people of one port share them (their accent). */
  vowels?: string;
}

export type VoiceSound =
  ({ synth: 'babble' } & BabbleShape) | { file: string } | { files: string[] };

export type VoiceMood = Partial<BabbleShape> & { file?: string; files?: string[]; volume?: number };

export type Voice = VoiceSound & {
  volume?: number;
  /** Changes for a mood of the card: `{ "pleased": { "pitch": 1.1 } }`. */
  moods?: Record<string, VoiceMood>;
};

/** The synthesised voices; a new kind needs code once. */
export const SYNTH_VOICES = ['babble'] as const;
export const VOWELS = 'aeiou';

/** Two formants (Hz) per vowel: enough to tell "ah" from "ee" through a toy voice box. */
const FORMANTS: Record<string, [number, number]> = {
  a: [800, 1200],
  e: [500, 1900],
  i: [320, 2300],
  o: [500, 900],
  u: [350, 750],
};

export const MAX_SYLLABLES = 8;
export const MAX_SECONDS = 1.5;
const BASE_HZ = 180;
const SYLLABLE_SEC = 0.11;
const GAP_SEC = 0.035;

export interface Syllable {
  /** Seconds from the start. */
  at: number;
  len: number;
  hz: number;
  vowel: string;
}

/** A voice with a mood's changes applied. */
export function voiceFor(voice: Voice, mood?: string): Voice {
  const change = mood ? voice.moods?.[mood] : undefined;
  if (!change) return voice;
  return { ...voice, ...change } as Voice;
}

/** A small seeded random number source, so a card says the same thing twice in tests. */
function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}

/** The syllables a generated voice says for `words` words. */
export function babblePlan(shape: BabbleShape, words: number, seed = 1): Syllable[] {
  const rand = random(seed);
  const speed = Math.max(0.3, shape.speed ?? 1);
  const wobble = Math.max(0, shape.wobble ?? 0.1);
  const base = BASE_HZ * Math.max(0.3, shape.pitch ?? 1);
  const vowels = [...(shape.vowels ?? VOWELS)].filter((v) => v in FORMANTS);
  const count = Math.min(MAX_SYLLABLES, Math.max(2, Math.round(words)));
  const out: Syllable[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    const len = (SYLLABLE_SEC * (0.75 + rand() * 0.5)) / speed;
    if (at + len > MAX_SECONDS) break;
    // Talk falls a little towards the end of a sentence.
    const fall = 1 - (0.08 * i) / count;
    out.push({
      at,
      len,
      hz: base * fall * (1 + wobble * (rand() * 2 - 1)),
      vowel: vowels[Math.floor(rand() * vowels.length)] ?? 'a',
    });
    at += len + GAP_SEC / speed;
  }
  return out;
}

/** How many words a line has, for the number of syllables. */
export function wordCount(text: string | undefined): number {
  return text ? text.split(/\s+/).filter((w) => /\p{L}|\d/u.test(w)).length : 0;
}

/** Play a generated voice's syllables at `level`. */
export function playBabble(
  ctx: BaseAudioContext,
  destination: AudioNode,
  level: number,
  syllables: readonly Syllable[],
) {
  const t0 = ctx.currentTime + 0.03;
  for (const s of syllables) {
    const t = t0 + s.at;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(s.hz * 1.04, t);
    osc.frequency.linearRampToValueAtTime(s.hz, t + s.len * 0.6);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.015);
    env.gain.setValueAtTime(level * 0.8, t + s.len * 0.7);
    env.gain.linearRampToValueAtTime(0, t + s.len);
    env.connect(destination);
    const filters = FORMANTS[s.vowel]!.map((freq, i) => {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = 6;
      const share = ctx.createGain();
      share.gain.value = i === 0 ? 1.6 : 0.9;
      osc.connect(band).connect(share).connect(env);
      return [band, share] as const;
    });
    osc.start(t);
    osc.stop(t + s.len + 0.02);
    osc.onended = () => {
      env.disconnect();
      for (const [band, share] of filters) {
        band.disconnect();
        share.disconnect();
      }
    };
  }
}

/** Play a recorded clip, cut to `secs` with a short fade so it never clicks. */
export function playClip(
  ctx: BaseAudioContext,
  destination: AudioNode,
  level: number,
  buffer: AudioBuffer,
  secs = MAX_SECONDS,
) {
  const t = ctx.currentTime + 0.03;
  const len = Math.min(buffer.duration, secs);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, t);
  gain.gain.setValueAtTime(level, t + Math.max(0, len - 0.08));
  gain.gain.linearRampToValueAtTime(0, t + len);
  source.connect(gain).connect(destination);
  source.start(t, 0, len);
}

/** The clip files of a voice (none for a generated one). */
export function voiceFiles(voice: Voice): string[] {
  if ('files' in voice && Array.isArray(voice.files)) return voice.files;
  if ('file' in voice && typeof voice.file === 'string') return [voice.file];
  return [];
}
