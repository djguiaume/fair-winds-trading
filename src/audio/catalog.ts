import audio from '../data/audio.json';
import characterData from '../data/characters.json';
import { SEA_FILES } from '../data/grownMap';
import { SYNTHS } from './sfx';
import { SYNTH_VOICES, VOWELS, voiceFiles, type Voice } from './babble';
import type { Theme } from './composer';

/*
 * Every sound of the game, from `src/data/audio.json` (decision 0113, approved by Guillaume
 * 2026-10-23 with more sounds to come). A music track is either a recorded file or a theme the
 * composer plays live (a file in `src/data/music/`); an effect is either a recorded file or one of
 * the synthesised effects of `sfx.ts`. Recorded files live in `public/` and are named by their
 * path there (`audio/creak.ogg`). `volume` scales a sound against the others.
 */

export type MusicTrack = ({ theme: string } | { file: string }) & { volume?: number };
/** `pitch` (synthesised effects only) plays the same sound higher or lower: 2 is an octave up. */
export type SoundEffect = ({ synth: SynthEffect } | { file: string }) & {
  volume?: number;
  pitch?: number;
};

/** The effects made in code (`sfx.ts`); a new one needs code once. */
export const SYNTH_EFFECTS = Object.keys(SYNTHS) as SynthEffect[];
export type SynthEffect = keyof typeof SYNTHS;

/**
 * A sea's sound bed (decision 0209): the waves and the wind heard everywhere in that sea, and its
 * calls, the effects that come now and then. `tone` is a filter's frequency in Hz: lower is
 * duller, higher brighter; `level` is loudness before the Sounds volume.
 */
export interface SeaBed {
  /** The music track of `music` played while the boat is in this sea. */
  music?: string;
  waves: { level: number; tone: number; swellSec: number };
  wind: { level: number; tone: number };
  /** Calmer water close round an island (Sunreach's lagoon): `waves` times the bed's waves. */
  calm?: { island: string; within: number; waves: number }[];
  calls?: SeaCall[];
}

/**
 * An effect a sea plays every `every` seconds (a random wait between the two), only `near` a
 * place, only `away` from one, or only `when` a storm blows. Near a place it is louder the closer
 * the boat is.
 */
export interface SeaCall {
  effect: string;
  every: [number, number];
  near?: CallPlace;
  away?: CallPlace;
  when?: 'storm' | 'rain';
  volume?: number;
}

/** Islands by id (or `"any"` island), icebergs, steam vents or reefs, within `range` units. */
export type CallPlace = {
  range: number;
  islands?: string[] | 'any';
  bergs?: boolean;
  vents?: boolean;
  reefs?: boolean;
};

/** How the sails sound luffing in irons (`ambience.ts`). */
export const LUFF_STYLES = ['chop', 'flutter', 'slat', 'thrum', 'flog', 'billow'] as const;
export type LuffStyle = (typeof LUFF_STYLES)[number];

/** The boat's own sounds, wherever she sails: her wash, sails luffing in irons, rain on deck. */
export interface BoatSounds {
  wash: { level: number; tone: number; fullKn: number };
  /** `rate` is how many times a second the canvas flutters. */
  luff: { level: number; tone: number; rate: number; style?: LuffStyle };
  rain: { level: number; tone: number };
}

/** What the game plays when something happens; `pitch` by port or island for the dock bell. */
export interface SoundEvents {
  dock: { effect: string; pitch?: Record<string, number> };
  crash: { effect: string };
  bump: { effect: string };
  tack: { effect: string };
  /** A volcano erupting within `range` units: louder the closer (decision 0178). */
  eruption: { effect: string; range: number };
}

/** The whole of `audio.json`. */
export interface AudioData {
  music: Record<string, MusicTrack>;
  effects: Record<string, SoundEffect>;
  boat: BoatSounds;
  seas: Record<string, SeaBed>;
  events: SoundEvents;
  voices?: Record<string, Voice>;
}

/** The sea every bed but the outer seas' belongs to: the Windward Ring in the middle. */
export const RING = 'ring';

/** The themes in `src/data/music/`, by file name. */
export const THEMES: Readonly<Record<string, Theme>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<Theme>('../data/music/*.json', { eager: true, import: 'default' }),
  ).map(([path, theme]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), theme]),
);

export const AUDIO = audio as unknown as AudioData;
export const MUSIC = AUDIO.music;
export const EFFECTS = AUDIO.effects;
/** People's babble voices (decision 0132), named by `voice` in `characters.json`. */
export const VOICES = AUDIO.voices ?? {};
/** The sea beds by sea id (`ring` and each sea file's id), the boat's sounds, the events. */
export const SEA_BEDS = AUDIO.seas;
export const BOAT_SOUNDS = AUDIO.boat;
export const SOUND_EVENTS = AUDIO.events;
const MOOD_NAMES = ['neutral', 'pleased', 'worried'];

/** The address of a recorded file in `public/`, under the game's base path. */
export function soundUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`;
}

/**
 * What is wrong with the sound list: unknown themes, effects or voices, a sound both or neither
 * kind, a person whose voice is missing, a sea bed or event naming a sound that is not there, and,
 * given `fileExists` (a path in `public/`), a missing recorded file. `data` is an edited copy
 * (the sound desk, decision 0209); `seas` the sea ids a bed may be for.
 */
export function audioProblems(
  fileExists?: (file: string) => boolean,
  data: AudioData = AUDIO,
  seas: readonly string[] = [RING, ...Object.keys(SEA_FILES)],
): string[] {
  const problems: string[] = [];
  const { music = {}, effects = {}, voices = {} } = data;
  const kinds = (sound: object, keys: string[]) => keys.filter((k) => k in sound).length;
  const level = (v: unknown, max = 4) => typeof v === 'number' && v >= 0 && v <= max;
  for (const [id, track] of Object.entries(music)) {
    if (kinds(track, ['theme', 'file']) !== 1) problems.push(`music ${id}: one of theme or file`);
    else if ('theme' in track && !THEMES[track.theme])
      problems.push(`music ${id}: no theme "${track.theme}" in src/data/music/`);
  }
  for (const [id, effect] of Object.entries(effects)) {
    if (kinds(effect, ['synth', 'file']) !== 1) problems.push(`effect ${id}: one of synth or file`);
    else if ('synth' in effect && !(SYNTH_EFFECTS as readonly string[]).includes(effect.synth))
      problems.push(`effect ${id}: no synthesised effect "${effect.synth}"`);
    if (effect.volume !== undefined && !level(effect.volume))
      problems.push(`effect ${id}: volume from 0 to 4`);
    if (effect.pitch !== undefined && !(level(effect.pitch) && effect.pitch >= 0.25))
      problems.push(`effect ${id}: pitch from 0.25 to 4`);
  }
  const effect = (where: string, id: unknown) => {
    if (typeof id !== 'string' || !effects[id]) problems.push(`${where}: no effect "${id}"`);
  };
  const boat = data.boat;
  if (!boat) problems.push('boat: missing (wash, luff, rain)');
  else
    for (const part of ['wash', 'luff', 'rain'] as const) {
      const p = boat[part] as Record<string, unknown> | undefined;
      if (!p || !level(p.level, 1) || !(Number(p.tone) >= 50 && Number(p.tone) <= 12000))
        problems.push(`boat ${part}: level 0 to 1 and tone 50 to 12000 Hz`);
    }
  if (boat && !(boat.wash.fullKn > 0)) problems.push('boat wash: fullKn above 0');
  if (boat && !(boat.luff.rate > 0 && boat.luff.rate <= 30))
    problems.push('boat luff: rate 1 to 30');
  if (boat?.luff.style && !LUFF_STYLES.includes(boat.luff.style))
    problems.push(`boat luff: no style "${boat.luff.style}" (${LUFF_STYLES.join(', ')})`);
  for (const sea of seas) if (!data.seas?.[sea]) problems.push(`seas: no bed for sea "${sea}"`);
  for (const [id, bed] of Object.entries(data.seas ?? {})) {
    const where = `sea ${id}`;
    if (!seas.includes(id)) problems.push(`${where}: no such sea (${seas.join(', ')})`);
    if (bed.music !== undefined && !music[bed.music])
      problems.push(`${where}: no music "${bed.music}"`);
    for (const part of ['waves', 'wind'] as const) {
      const p = bed[part] as Record<string, unknown> | undefined;
      if (!p || !level(p.level, 1) || !(Number(p.tone) >= 50 && Number(p.tone) <= 12000))
        problems.push(`${where} ${part}: level 0 to 1 and tone 50 to 12000 Hz`);
    }
    if (!(bed.waves?.swellSec >= 2 && bed.waves.swellSec <= 30))
      problems.push(`${where} waves: swellSec 2 to 30`);
    for (const c of bed.calm ?? [])
      if (typeof c.island !== 'string' || !level(c.within, 4) || !level(c.waves, 1))
        problems.push(`${where} calm: island, within (times its radius) and waves 0 to 1`);
    (bed.calls ?? []).forEach((call, k) => {
      const at = `${where} call ${k + 1}`;
      effect(at, call.effect);
      const [lo, hi] = Array.isArray(call.every) ? call.every : [];
      if (!(Number(lo) >= 1 && Number(hi) >= Number(lo)))
        problems.push(`${at}: every [min, max] seconds, min 1 or more`);
      for (const [name, place] of [
        ['near', call.near],
        ['away', call.away],
      ] as const) {
        if (place === undefined) continue;
        const what = ['islands', 'bergs', 'vents', 'reefs'].filter((key) => key in place);
        if (what.length !== 1) problems.push(`${at} ${name}: one of islands, bergs, vents, reefs`);
        if (!(place.range > 0)) problems.push(`${at} ${name}: range above 0`);
        if (place.islands !== undefined && place.islands !== 'any' && !Array.isArray(place.islands))
          problems.push(`${at} ${name}: islands is a list of ids or "any"`);
      }
      if (call.when !== undefined && call.when !== 'storm' && call.when !== 'rain')
        problems.push(`${at}: when is "storm" or "rain"`);
    });
  }
  const events = data.events;
  if (!events) problems.push('events: missing');
  else {
    for (const name of ['dock', 'crash', 'bump', 'tack', 'eruption'] as const)
      effect(`event ${name}`, events[name]?.effect);
    for (const [port, pitch] of Object.entries(events.dock?.pitch ?? {}))
      if (!(level(pitch) && pitch >= 0.25)) problems.push(`event dock: ${port} pitch 0.25 to 4`);
    if (!(Number(events.eruption?.range) > 0)) problems.push('event eruption: range above 0');
  }
  for (const [id, voice] of Object.entries(voices)) problems.push(...voiceProblems(id, voice));
  for (const c of characterData.characters as { id: string; voice?: string }[])
    if (c.voice !== undefined && !voices[c.voice])
      problems.push(`character ${c.id}: no voice "${c.voice}" in audio.json voices`);
  if (fileExists) {
    const files = [
      ...Object.values(music).flatMap((m) => ('file' in m ? [m.file] : [])),
      ...Object.values(effects).flatMap((e) => ('file' in e ? [e.file] : [])),
      ...Object.values(voices).flatMap((v) => [
        ...voiceFiles(v),
        ...Object.values(v.moods ?? {}).flatMap((m) => voiceFiles(m as Voice)),
      ]),
    ];
    for (const file of files) if (!fileExists(file)) problems.push(`no file public/${file}`);
  }
  for (const id of ['sea'])
    if (!music[id]) problems.push(`music ${id}: missing (the game plays it)`);
  for (const id of ['creak', 'foghorn', 'thud', 'race-horn'])
    if (!effects[id]) problems.push(`effect ${id}: missing (the game plays it)`);
  return problems;
}

/** What is wrong with one voice. */
function voiceProblems(id: string, voice: Voice): string[] {
  const out: string[] = [];
  const kinds = ['synth', 'file', 'files'].filter((k) => k in voice).length;
  if (kinds !== 1) out.push(`voice ${id}: one of synth, file or files`);
  else if ('synth' in voice && !(SYNTH_VOICES as readonly string[]).includes(voice.synth))
    out.push(`voice ${id}: no synthesised voice "${voice.synth}"`);
  else if ('files' in voice && (!Array.isArray(voice.files) || voice.files.length === 0))
    out.push(`voice ${id}: files is a list of at least one clip`);
  const shapes: [string, object][] = [['', voice], ...Object.entries(voice.moods ?? {})];
  for (const [mood, shape] of shapes) {
    const where = mood ? `voice ${id} mood ${mood}` : `voice ${id}`;
    if (mood && !MOOD_NAMES.includes(mood)) out.push(`${where}: no mood "${mood}"`);
    for (const key of ['pitch', 'speed', 'volume'] as const) {
      const v = (shape as Record<string, unknown>)[key];
      if (v !== undefined && !(typeof v === 'number' && v > 0 && v <= 4))
        out.push(`${where}: ${key} must be a number above 0, up to 4`);
    }
    const wobble = (shape as Record<string, unknown>).wobble;
    if (wobble !== undefined && !(typeof wobble === 'number' && wobble >= 0 && wobble <= 1))
      out.push(`${where}: wobble must be 0 to 1`);
    const vowels = (shape as Record<string, unknown>).vowels;
    if (vowels !== undefined && !(typeof vowels === 'string' && /^[aeiou]+$/.test(vowels)))
      out.push(`${where}: vowels are letters from "${VOWELS}"`);
  }
  return out;
}
