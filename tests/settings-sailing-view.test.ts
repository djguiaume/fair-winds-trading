// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../src/ui/settings';

describe('sailing view setting (issue #535)', () => {
  beforeEach(() => localStorage.clear());

  it('starts from above, survives a reload, and ignores a bad value', () => {
    const settings = loadSettings();
    expect(settings.sailingView).toBe('above');
    settings.sailingView = 'behind';
    saveSettings(settings);
    expect(loadSettings().sailingView).toBe('behind');
    localStorage.setItem('fwt.settings.v1', JSON.stringify({ sailingView: 'sideways' }));
    expect(loadSettings().sailingView).toBe('above');
  });
});
