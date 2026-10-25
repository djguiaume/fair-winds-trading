import audio from '../data/audio.json';
import characterData from '../data/characters.json';
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
export type SoundEffect = ({ synth: SynthEffect } | { file: string }) & { volume?: number };

/** The effects made in code (`sfx.ts`); a new one needs code once. */
export const SYNTH_EFFECTS = ['creak', 'foghorn', 'thud'] as const;
export type SynthEffect = (typeof SYNTH_EFFECTS)[number];

/** The themes in `src/data/music/`, by file name. */
export const THEMES: Readonly<Record<string, Theme>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<Theme>('../data/music/*.json', { eager: true, import: 'default' }),
  ).map(([path, theme]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), theme]),
);

export const MUSIC = audio.music as Record<string, MusicTrack>;
export const EFFECTS = audio.effects as Record<string, SoundEffect>;
/** People's babble voices (decision 0132), named by `voice` in `characters.json`. */
export const VOICES = (audio as { voices?: Record<string, Voice> }).voices ?? {};
const MOOD_NAMES = ['neutral', 'pleased', 'worried'];

/** The address of a recorded file in `public/`, under the game's base path. */
export function soundUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`;
}

/**
 * What is wrong with the sound list: unknown themes, effects or voices, a sound both or neither
 * kind, a person whose voice is missing and, given `fileExists` (a path in `public/`), a missing
 * recorded file.
 */
export function audioProblems(fileExists?: (file: string) => boolean): string[] {
  const problems: string[] = [];
  const kinds = (sound: object, keys: string[]) => keys.filter((k) => k in sound).length;
  for (const [id, track] of Object.entries(MUSIC)) {
    if (kinds(track, ['theme', 'file']) !== 1) problems.push(`music ${id}: one of theme or file`);
    else if ('theme' in track && !THEMES[track.theme])
      problems.push(`music ${id}: no theme "${track.theme}" in src/data/music/`);
  }
  for (const [id, effect] of Object.entries(EFFECTS)) {
    if (kinds(effect, ['synth', 'file']) !== 1) problems.push(`effect ${id}: one of synth or file`);
    else if ('synth' in effect && !(SYNTH_EFFECTS as readonly string[]).includes(effect.synth))
      problems.push(`effect ${id}: no synthesised effect "${effect.synth}"`);
  }
  for (const [id, voice] of Object.entries(VOICES)) problems.push(...voiceProblems(id, voice));
  for (const c of characterData.characters as { id: string; voice?: string }[])
    if (c.voice !== undefined && !VOICES[c.voice])
      problems.push(`character ${c.id}: no voice "${c.voice}" in audio.json voices`);
  if (fileExists) {
    const files = [
      ...Object.values(MUSIC).flatMap((m) => ('file' in m ? [m.file] : [])),
      ...Object.values(EFFECTS).flatMap((e) => ('file' in e ? [e.file] : [])),
      ...Object.values(VOICES).flatMap((v) => [
        ...voiceFiles(v),
        ...Object.values(v.moods ?? {}).flatMap((m) => voiceFiles(m as Voice)),
      ]),
    ];
    for (const file of files) if (!fileExists(file)) problems.push(`no file public/${file}`);
  }
  for (const id of ['sea'])
    if (!MUSIC[id]) problems.push(`music ${id}: missing (the game plays it)`);
  for (const id of ['creak', 'foghorn', 'thud'])
    if (!EFFECTS[id]) problems.push(`effect ${id}: missing (the game plays it)`);
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
