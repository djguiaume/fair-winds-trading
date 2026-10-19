import { afterEach, describe, expect, it, vi } from 'vitest';
import { windFeedback } from '../src/ui/windFeedback';
import { loadSettings, saveSettings } from '../src/ui/settings';

const sailing = { inNoGo: true, sailsRaised: true, docked: false, active: true };

describe('quiet compass feedback', () => {
  it('keeps a brief tack free of pulses and text, then reveals help gradually', () => {
    const tack = windFeedback(0, 0.8, sailing);
    expect(tack.amber).toBe(true);
    expect(tack.pulse).toBe(false);
    expect(tack.chip).toBe(false);
    const lingering = windFeedback(tack.seconds, 0.5, sailing);
    expect(lingering.pulse).toBe(true);
    expect(lingering.chip).toBe(false);
    expect(windFeedback(lingering.seconds, 1.8, sailing).chip).toBe(true);
  });

  it.each([
    { ...sailing, inNoGo: false },
    { ...sailing, sailsRaised: false },
    { ...sailing, docked: true },
    { ...sailing, active: false },
  ])('clears feedback and the delay when sailing help is inappropriate: %j', (state) => {
    const result = windFeedback(10, 0.1, state);
    expect(result).toEqual({ seconds: 0, amber: false, pulse: false, chip: false });
    expect(windFeedback(result.seconds, 0.1, sailing).chip).toBe(false);
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
