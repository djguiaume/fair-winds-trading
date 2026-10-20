import { describe, expect, it } from 'vitest';
import { composeTune, EIGHTHS_PER_BAR, scaleNote, THEME } from '../src/audio/composer';

describe('music composer (decision 0045)', () => {
  it('is deterministic for a seed', () => {
    expect(composeTune(7)).toEqual(composeTune(7));
  });

  it('varies from seed to seed', () => {
    const melody = (seed: number) =>
      composeTune(seed)
        .notes.filter((n) => n.voice === 'melody')
        .map((n) => n.midi)
        .join();
    expect(new Set([1, 2, 3, 4, 5].map(melody)).size).toBeGreaterThan(3);
  });

  it('keeps every note inside the tune, in whole bars, with sane pitches and tempo', () => {
    for (let seed = 0; seed < 50; seed++) {
      const tune = composeTune(seed);
      expect(tune.length % EIGHTHS_PER_BAR).toBe(0);
      const bpm = 60 / (3 * tune.eighth);
      expect(bpm).toBeGreaterThanOrEqual(THEME.tempo[0] - 0.01);
      expect(bpm).toBeLessThanOrEqual(THEME.tempo[1] + 0.01);
      for (const n of tune.notes) {
        expect(n.at).toBeGreaterThanOrEqual(0);
        expect(n.at + n.len).toBeLessThanOrEqual(tune.length);
        expect(n.midi).toBeGreaterThanOrEqual(26);
        expect(n.midi).toBeLessThanOrEqual(96);
        expect(n.vel).toBeGreaterThan(0);
      }
    }
  });

  it('never lets a melody note cross a bar line', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const n of composeTune(seed).notes.filter((x) => x.voice === 'melody')) {
        expect(Math.floor(n.at / EIGHTHS_PER_BAR)).toBe(
          Math.floor((n.at + n.len - 1) / EIGHTHS_PER_BAR),
        );
      }
    }
  });

  it('stays light: at most one bass note and one chord under each bar', () => {
    for (let seed = 0; seed < 20; seed++) {
      const tune = composeTune(seed);
      for (let at = 0; at < tune.length; at += EIGHTHS_PER_BAR) {
        const bar = tune.notes.filter((n) => n.at >= at && n.at < at + EIGHTHS_PER_BAR);
        expect(bar.filter((n) => n.voice === 'bass').length).toBeLessThanOrEqual(1);
        expect(bar.filter((n) => n.voice === 'pad').length).toBe(3);
      }
    }
  });

  it('ends each half on the tonic', () => {
    for (let seed = 0; seed < 20; seed++) {
      const tune = composeTune(seed);
      const melody = tune.notes.filter((n) => n.voice === 'melody');
      // The closing rest bar is a tonic chord: its lowest note names the key.
      const end = tune.length - EIGHTHS_PER_BAR;
      const closing = tune.notes.filter((n) => n.at === end);
      const tonicClass = Math.min(...closing.map((n) => n.midi)) % 12;
      for (const bar of [7, 15]) {
        const last = melody.filter((n) => Math.floor(n.at / EIGHTHS_PER_BAR) === bar).at(-1);
        expect(last && last.midi % 12).toBe(tonicClass);
      }
    }
  });

  it('maps scale steps across octaves', () => {
    const major = [0, 2, 4, 5, 7, 9, 11];
    expect(scaleNote(60, major, 0)).toBe(60);
    expect(scaleNote(60, major, 7)).toBe(72);
    expect(scaleNote(60, major, -1)).toBe(59);
    expect(scaleNote(60, major, 9)).toBe(76);
  });
});
