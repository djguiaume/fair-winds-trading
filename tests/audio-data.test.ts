import { describe, expect, it } from 'vitest';
import { EFFECTS, MUSIC, THEMES, audioProblems, soundUrl } from '../src/audio/catalog';
import { composeTune, THEME, type Theme } from '../src/audio/composer';

// Decision 0113: every sound is listed in src/data/audio.json; the music theme is a data file.
describe('sounds and music as data (decision 0113)', () => {
  it('the sound list is sound', () => {
    expect(audioProblems()).toEqual([]);
    expect(MUSIC.sea).toEqual({ theme: 'fair-winds' });
    expect(EFFECTS.creak).toEqual({ synth: 'creak', volume: 1.6 });
    expect(THEMES['fair-winds']).toBe(THEME);
    expect(soundUrl('audio/creak.ogg')).toMatch(/\/audio\/creak\.ogg$/);
  });

  it('a new theme is a new tune, from the file only', () => {
    const slow: Theme = {
      ...structuredClone(THEME),
      name: 'Slow air',
      tempo: [60, 62],
      keys: [{ tonic: 65, scale: 'major' }],
      restChance: 0.3,
    };
    const a = composeTune(3, slow);
    const b = composeTune(3);
    expect(a).not.toEqual(b);
    const bpm = 60 / (3 * a.eighth);
    expect(bpm).toBeGreaterThanOrEqual(60 - 0.01);
    expect(bpm).toBeLessThanOrEqual(62 + 0.01);
    // F major: every melody note is in the scale.
    const fMajor = [0, 2, 4, 5, 7, 9, 11].map((s) => (65 + s) % 12);
    for (const n of a.notes) expect(fMajor).toContain(n.midi % 12);
  });
});
