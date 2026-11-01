import { describe, expect, it } from 'vitest';
import {
  findToken,
  parseTheme,
  setToken,
  shippedTheme,
  themeText,
  tokens,
} from '../src/editor/theme/doc';
import { contrast, themeProblems } from '../src/ui/theme/checks';
import { SHIPPED_THEME, dayTokens, layoutFor, nightTokens, themeCss } from '../src/ui/theme/model';

// The UI theme as data (decision 0269): theme.json, its CSS, its rules and its edits.
describe('UI theme', () => {
  it('ships with no problems', () => {
    expect(themeProblems(shippedTheme())).toEqual([]);
  });

  it('writes the chart-table tokens, the type scale and style E', () => {
    const day = dayTokens(SHIPPED_THEME);
    expect(day['--ui-paper']).toBe('#efe6d1');
    expect(day['--ui-sage']).toBe('#4a6d41');
    expect(day['--fs-micro']).toBe('11px');
    expect(day['--ui-dur-base']).toBe('200ms');
    expect(day['--ui-touch-target']).toBe('44px');
    expect(day['--ui-paper-night-fill']).toBe('rgb(185 171 138 / 0.8)');
    expect(day['--ui-edge-torn-day']).toMatch(/^url\("data:image\/svg\+xml,/);
    // Style E keeps its names and values until the screens are rebuilt.
    expect(day['--brass']).toBe('#e8c46a');
    expect(day['--on-paper-green']).toBe('#2f7a3a');
  });

  it('dims the paper and the torn edge at night', () => {
    const night = nightTokens(SHIPPED_THEME);
    expect(night['--ui-surface']).toBe('var(--ui-paper-night-fill)');
    expect(night['--ui-edge-torn']).toBe('var(--ui-edge-torn-night)');
    expect(night['--paper']).toBe('#a59d86');
  });

  it('scopes its CSS to the page or a preview box', () => {
    expect(themeCss(SHIPPED_THEME)).toMatch(/^:root \{[\s\S]*\n:root\[data-night\] \{/);
    const box = themeCss(SHIPPED_THEME, { root: '.box', night: '.box[data-night]' });
    expect(box.startsWith('.box {')).toBe(true);
    expect(box).not.toContain(':root');
  });

  it('measures contrast as WCAG does', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#23303a', '#efe6d1')).toBeGreaterThan(4.5);
  });

  it('refuses unreadable text, reserved colours, white, tiny type and slow motion', () => {
    const t = shippedTheme();
    t.colour['ink-muted'] = '#b0a890';
    t.colour.sage = '#e8c46a';
    t.colour.paper = '#ffffff';
    t.type.micro = 9;
    t.duration.slow = 600;
    t.touch.target = 30;
    const problems = themeProblems(t).join('\n');
    expect(problems).toMatch(/colour\.ink-muted on colour\.paper reads at/);
    expect(problems).toMatch(/colour\.sage: .*the player's brass/);
    expect(problems).toMatch(/colour\.paper: .*whiter than/);
    expect(problems).toMatch(/type\.micro is 9px/);
    expect(problems).toMatch(/duration\.slow is 600 ms/);
    expect(problems).toMatch(/touch\.target is 30px/);
  });

  it('puts each window in one of the two breakpoints', () => {
    expect(layoutFor(844, 390)).toBe('phone');
    expect(layoutFor(1440, 900)).toBe('desktop');
    expect(layoutFor(900, 700)).toBe('mid');
  });
});

describe('theme edits (Theme page and npm run theme)', () => {
  it('lists every token by its path, with its kind', () => {
    const list = tokens(SHIPPED_THEME);
    expect(list.find((t) => t.path === 'about')).toBeUndefined();
    expect(findToken(SHIPPED_THEME, 'colour.sage')).toMatchObject({ kind: 'colour' });
    expect(findToken(SHIPPED_THEME, 'duration.base')).toMatchObject({ kind: 'number', value: 200 });
    expect(findToken(SHIPPED_THEME, 'legacy.root.brass')).toMatchObject({ kind: 'colour' });
    expect(findToken(SHIPPED_THEME, 'edges.torn.path')).toMatchObject({ kind: 'text' });
  });

  it('sets a token from typed text, or says why not', () => {
    const t = shippedTheme();
    expect(setToken(t, 'colour.sage', '#3f6a3a')).toBeNull();
    expect(t.colour.sage).toBe('#3f6a3a');
    expect(setToken(t, 'duration.base', '180')).toBeNull();
    expect(t.duration.base).toBe(180);
    expect(setToken(t, 'duration.base', 'fast')).toMatch(/takes a number/);
    expect(setToken(t, 'colour.ink', 'navy')).toMatch(/#rrggbb/);
    expect(setToken(t, 'colour.nope', '#000000')).toMatch(/no token/);
    expect(SHIPPED_THEME.colour.sage).toBe('#4a6d41');
  });

  it('reads back its own file and refuses one missing a token', () => {
    const text = themeText(shippedTheme());
    expect(parseTheme(text)).toEqual(SHIPPED_THEME);
    const broken = JSON.parse(text);
    delete broken.colour.ink;
    expect(parseTheme(JSON.stringify(broken))).toMatch(/colour\.ink is missing/);
    expect(parseTheme('{')).toMatch(/not JSON/);
  });
});
