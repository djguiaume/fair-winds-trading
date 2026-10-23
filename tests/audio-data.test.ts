import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { EFFECTS, MUSIC, THEMES, VOICES, audioProblems, soundUrl } from '../src/audio/catalog';
import {
  MAX_SECONDS,
  MAX_SYLLABLES,
  babblePlan,
  voiceFor,
  voiceFiles,
  wordCount,
} from '../src/audio/babble';
import { CHARACTERS } from '../src/ui/portraits';
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

// Decision 0132 (storyteller brief 0129): people babble on their cards, as data.
describe('babble voices (decision 0132)', () => {
  it('gives every person a voice that audio.json has, and every file is in public/', () => {
    expect(audioProblems((file) => existsSync(`public/${file}`))).toEqual([]);
    for (const c of CHARACTERS) expect(VOICES[c.voice ?? ''], c.id).toBeDefined();
  });

  it('refuses a voice of both kinds, a bad number, an unknown mood and a missing file', () => {
    const voices = VOICES as Record<string, unknown>;
    const saved = { ...VOICES };
    try {
      voices.a = { synth: 'babble', file: 'audio/voices/a.ogg' };
      voices.b = { synth: 'whistle' };
      voices.c = { synth: 'babble', pitch: -1, vowels: 'xyz', moods: { angry: { speed: 2 } } };
      voices.d = { files: ['audio/voices/nobody.ogg'] };
      const problems = audioProblems(() => false).join('\n');
      expect(problems).toContain('voice a: one of synth, file or files');
      expect(problems).toContain('no synthesised voice "whistle"');
      expect(problems).toContain('voice c: pitch must be');
      expect(problems).toContain('voice c: vowels are letters');
      expect(problems).toContain('no mood "angry"');
      expect(problems).toContain('no file public/audio/voices/nobody.ogg');
    } finally {
      for (const k of Object.keys(voices)) if (!(k in saved)) delete voices[k];
    }
  });

  it('says about one syllable a word, at most eight and 1.5 s, in the voice’s vowels', () => {
    const maren = VOICES.maren!;
    expect(wordCount('Bring timber to Westholm')).toBe(4);
    expect(wordCount('Rush bread to Saltmere in 2:20')).toBe(6);
    const plan = babblePlan(maren as never, 4, 7);
    expect(plan).toHaveLength(4);
    expect(babblePlan(maren as never, 4, 7)).toEqual(plan);
    for (const s of plan) expect('eia').toContain(s.vowel);
    const long = babblePlan({ speed: 0.5 }, 30);
    expect(long.length).toBeLessThanOrEqual(MAX_SYLLABLES);
    const end = long.at(-1)!;
    expect(end.at + end.len).toBeLessThanOrEqual(MAX_SECONDS);
    // Rook speaks lower than Maren; a mood changes the numbers.
    const hz = (v: object) => babblePlan(v, 6, 3).reduce((a, s) => a + s.hz, 0) / 6;
    expect(hz(VOICES.rook!)).toBeLessThan(hz(maren));
    expect(hz(voiceFor(maren, 'pleased'))).toBeGreaterThan(hz(maren));
    expect(voiceFiles(maren)).toEqual([]);
    expect(voiceFiles({ files: ['audio/voices/ness-1.ogg'] })).toEqual(['audio/voices/ness-1.ogg']);
  });
});
