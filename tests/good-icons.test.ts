import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import goods from '../src/data/tuning/goods.json';

describe('good icons (decision 0049)', () => {
  it('gives every good a symbol in the sprite, the far goods too', () => {
    const sprite = ['ui', 'goods']
      .map((n) => readFileSync(`src/ui/sprite/${n}.svg`, 'utf8'))
      .join('');
    const missing = Object.keys(goods).filter((id) => !sprite.includes(`<symbol id="i-${id}"`));
    expect(missing).toEqual([]);
  });
});
