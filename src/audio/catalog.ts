import audio from '../data/audio.json';
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
export const SYNTH_EFFECTS = ['creak', 'foghorn'] as const;
export type SynthEffect = (typeof SYNTH_EFFECTS)[number];

/** The themes in `src/data/music/`, by file name. */
export const THEMES: Readonly<Record<string, Theme>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<Theme>('../data/music/*.json', { eager: true, import: 'default' }),
  ).map(([path, theme]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), theme]),
);

export const MUSIC = audio.music as Record<string, MusicTrack>;
export const EFFECTS = audio.effects as Record<string, SoundEffect>;

/** The address of a recorded file in `public/`, under the game's base path. */
export function soundUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`;
}

/** What is wrong with the sound list: unknown themes or effects, a sound both or neither kind. */
export function audioProblems(): string[] {
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
  for (const id of ['sea'])
    if (!MUSIC[id]) problems.push(`music ${id}: missing (the game plays it)`);
  for (const id of ['creak', 'foghorn'])
    if (!EFFECTS[id]) problems.push(`effect ${id}: missing (the game plays it)`);
  return problems;
}
