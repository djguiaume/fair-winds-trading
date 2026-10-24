import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import goods from '../src/data/tuning/goods.json';

describe('good icons (decision 0049)', () => {
  it('gives every good a symbol in the sprite, the far goods too', () => {
    const html = readFileSync('index.html', 'utf8');
    const missing = Object.keys(goods).filter((id) => !html.includes(`<symbol id="i-${id}"`));
    expect(missing).toEqual([]);
  });
});
