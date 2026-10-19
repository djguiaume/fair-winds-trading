import { describe, expect, it } from 'vitest';
import { classifySupport } from '../src/ui/fullscreen';

describe('classifySupport', () => {
  it('uses the API when the browser offers it (desktop, Android, iPad)', () => {
    expect(classifySupport({ apiEnabled: true, standalone: false, iphone: false })).toBe('api');
  });
  it('suggests the home screen on iPhone, where pages cannot go fullscreen', () => {
    expect(classifySupport({ apiEnabled: false, standalone: false, iphone: true })).toBe(
      'home-screen',
    );
  });
  it('shows nothing when already launched from the home screen', () => {
    expect(classifySupport({ apiEnabled: false, standalone: true, iphone: true })).toBe(
      'standalone',
    );
    expect(classifySupport({ apiEnabled: true, standalone: true, iphone: false })).toBe(
      'standalone',
    );
  });
  it('hides the option elsewhere without the API', () => {
    expect(classifySupport({ apiEnabled: false, standalone: false, iphone: false })).toBe('none');
  });
});
