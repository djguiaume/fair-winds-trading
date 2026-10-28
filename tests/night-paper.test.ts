// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { setNightPaper } from '../src/ui/nightPaper';

describe('night paper', () => {
  it('flags the root at night and clears it by day', () => {
    const root = document.createElement('div');
    setNightPaper(1, root);
    expect(root.hasAttribute('data-night')).toBe(true);
    setNightPaper(0.2, root);
    expect(root.hasAttribute('data-night')).toBe(false);
  });
});
