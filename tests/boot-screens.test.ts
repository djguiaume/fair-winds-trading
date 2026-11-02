import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs tool module
import { withSplashLogo } from '../tools/fw/identitySplash.mjs';
import boot from '../src/i18n/boot.json';
import en from '../src/i18n/en.json';
import fr from '../src/i18n/fr.json';
import theme from '../src/data/ui/theme.json';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('boot texts', () => {
  it('give the same keys in both languages', () => {
    expect(Object.keys(boot.fr).sort()).toEqual(Object.keys(boot.en).sort());
  });

  it('keep the tagline the title shows', () => {
    expect(boot.en.tagline).toBe(en['menu.tagline']);
    expect(boot.fr.tagline).toBe(fr['menu.tagline']);
  });
});

describe('the loading screen', () => {
  const css = read('src/ui/splash.css');
  const fallback = (name: string) =>
    css.match(new RegExp(`var\\(--ui-${name}, (#[0-9a-f]{6})\\)`))?.[1];

  it('falls back to the theme colours it paints before the theme loads', () => {
    const c = theme.colour;
    expect(fallback('paper')).toBe(c.paper);
    expect(fallback('ink')).toBe(c.ink);
    expect(fallback('ink-muted')).toBe(c['ink-muted']);
    expect(fallback('sage')).toBe(c.sage);
  });

  it('carries the logo of the sprite in index.html', () => {
    const html = read('index.html');
    expect(withSplashLogo(html, read('src/ui/sprite/logo.svg'))).toBe(html);
  });
});
