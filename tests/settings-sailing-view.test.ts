// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { TOP_VIEW, cameraCycle } from '../src/render/chaseView';
import { loadSettings, saveSettings } from '../src/ui/settings';

describe('sailing view setting (issue #535, decision 0312)', () => {
  beforeEach(() => localStorage.clear());

  it('starts from above, survives a reload, and ignores a bad value', () => {
    const settings = loadSettings();
    expect(settings.sailingView).toBe(TOP_VIEW);
    settings.sailingView = 'c';
    saveSettings(settings);
    expect(loadSettings().sailingView).toBe('c');
    localStorage.setItem('fwt.settings.v1', JSON.stringify({ sailingView: 'sideways' }));
    expect(loadSettings().sailingView).toBe(TOP_VIEW);
  });

  it('reads a save from before the cycle: above is the top view, behind the first framing', () => {
    localStorage.setItem('fwt.settings.v1', JSON.stringify({ sailingView: 'above' }));
    expect(loadSettings().sailingView).toBe(TOP_VIEW);
    localStorage.setItem('fwt.settings.v1', JSON.stringify({ sailingView: 'behind' }));
    expect(loadSettings().sailingView).toBe(cameraCycle().find((v) => v !== TOP_VIEW));
  });
});
