import { afterEach, describe, expect, it, vi } from 'vitest';
import { WindCue } from '../src/ui/windFeedback';
import { loadSettings, saveSettings } from '../src/ui/settings';

describe('quiet compass feedback', () => {
  it('keeps a brief tack free of pulses and text, then reveals help gradually', () => {
    const cue = new WindCue();
    cue.update(0.8, true);
    expect(cue.amber).toBe(true);
    expect(cue.pulse).toBe(false);
    expect(cue.chip).toBe(false);
    cue.update(0.5, true);
    expect(cue.pulse).toBe(true);
    expect(cue.chip).toBe(false);
    cue.update(1.8, true);
    expect(cue.chip).toBe(true);
  });

  it('clears feedback and the delay when sailing help is inappropriate', () => {
    const cue = new WindCue();
    cue.update(10, true);
    cue.update(0.1, false);
    expect({ ...cue }).toEqual({ seconds: 0, amber: false, pulse: false, chip: false });
    cue.update(0.1, true);
    expect(cue.chip).toBe(false);
  });
});

describe('first compass hint preference', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('defaults older settings to an unseen hint and remembers when it has been shown', () => {
    let value = JSON.stringify({ quality: 'low', seenHelp: true, showFps: true });
    vi.stubGlobal('localStorage', {
      getItem: () => value,
      setItem: (_key: string, next: string) => {
        value = next;
      },
    });
    const settings = loadSettings();
    expect(settings.seenWindHint).toBe(false);
    expect(settings.quality).toBe('low');
    settings.seenWindHint = true;
    saveSettings(settings);
    expect(loadSettings().seenWindHint).toBe(true);
  });
  it('still works when persistence is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    });
    expect(loadSettings().seenWindHint).toBe(false);
    expect(() => saveSettings({ ...loadSettings(), seenWindHint: true })).not.toThrow();
  });
});
