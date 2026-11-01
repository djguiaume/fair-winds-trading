import THEME_JSON from '../../data/ui/theme.json';

/**
 * The UI theme as data (decision 0269): `src/data/ui/theme.json` turned into CSS custom
 * properties. Pure, so the game, the editors' Theme page, `npm run theme` and the tests share the
 * same tokens and the same CSS.
 */

/** A 9-slice edge (torn paper, brushed wash): an outline in a square, cut `slice` px in. */
export interface Edge {
  size: number;
  slice: number;
  path: string;
}

export interface Theme {
  about: string;
  colour: Record<string, string>;
  night: { 'paper-opacity': number };
  font: Record<string, string>;
  type: Record<string, number>;
  space: Record<string, number>;
  radius: Record<string, number>;
  elevation: Record<string, string>;
  duration: { fast: number; base: number; slow: number };
  easing: Record<string, string>;
  press: { scale: number };
  z: { screen: number; dialog: number; toast: number };
  touch: { target: number; 'row-min': number; 'row-max': number; 'level-card': number };
  breakpoints: { 'phone-max-height': number; 'desktop-min-width': number };
  /** The sea HUD's sizes (issue #441): its safe margin, the compass, the speed digits, the tape. */
  hud: Record<string, number>;
  /** The harbour screen's sizes (issue #443): the port strip, the ledger's margin, rows, panes. */
  harbour: Record<string, number>;
  edges: Record<string, Edge>;
  /** Style E (decision 0220): the tokens of the screens not rebuilt yet, by surface. */
  legacy: {
    root: Record<string, string>;
    night: Record<string, string>;
    'on-paper': Record<string, string>;
  };
}

export const SHIPPED_THEME: Theme = THEME_JSON;

/** How each flat group of tokens is named and written in CSS. */
const CSS_GROUPS: Record<string, { prefix: string; unit?: string }> = {
  colour: { prefix: '--ui-' },
  font: { prefix: '--ui-font-' },
  type: { prefix: '--fs-', unit: 'px' },
  space: { prefix: '--ui-space-', unit: 'px' },
  radius: { prefix: '--ui-radius-', unit: 'px' },
  elevation: { prefix: '--ui-shadow-' },
  duration: { prefix: '--ui-dur-', unit: 'ms' },
  easing: { prefix: '--ui-ease-' },
  press: { prefix: '--ui-press-' },
  z: { prefix: '--ui-z-' },
  touch: { prefix: '--ui-touch-', unit: 'px' },
  hud: { prefix: '--ui-hud-', unit: 'px' },
  harbour: { prefix: '--ui-harbour-', unit: 'px' },
};

/**
 * Where the CSS goes: the page (`:root`) or a preview box in the editors, and the panels forced
 * to the day or the night look whatever the scene does.
 */
export interface ThemeScope {
  root: string;
  night: string;
  forcedDay: string;
  forcedNight: string;
}
export const PAGE_SCOPE: ThemeScope = {
  root: ':root',
  night: ':root[data-night]',
  forcedDay: '.ui-panel--day',
  forcedNight: '.ui-panel--night',
};

/**
 * The roles the components paint with, by day and by night: panels (80% night paper), faces of
 * buttons and cards, a turned-off face, muted text, the chosen row's wash and the two edges.
 */
const ROLES: Record<string, [day: string, night: string]> = {
  '--ui-surface': ['var(--ui-paper)', 'var(--ui-paper-night-fill)'],
  '--ui-face': ['var(--ui-paper)', 'var(--ui-paper-night)'],
  '--ui-face-off': ['var(--ui-paper-off)', 'var(--ui-paper-night-off)'],
  '--ui-muted': ['var(--ui-ink-muted)', 'var(--ui-ink-muted-night)'],
  '--ui-wash': ['var(--ui-sage-wash)', 'var(--ui-sage-wash-night)'],
  '--ui-edge-torn': ['var(--ui-edge-torn-day)', 'var(--ui-edge-torn-night)'],
  '--ui-edge-brushed': ['var(--ui-edge-brushed-day)', 'var(--ui-edge-brushed-night)'],
};
const roles = (time: 0 | 1) =>
  Object.fromEntries(Object.entries(ROLES).map(([name, values]) => [name, values[time]]));

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** `#rrggbb` at an opacity, as CSS. */
export function withOpacity(hex: string, opacity: number): string {
  return `rgb(${rgb(hex).join(' ')} / ${opacity})`;
}

/** An edge as a CSS image filled with one colour: no CSS filters, cheap on old tablets. */
export function edgeImage(edge: Edge, fill: string, opacity = 1): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${edge.size}" height="${edge.size}" ` +
    `viewBox="0 0 ${edge.size} ${edge.size}"><path d="${edge.path}" fill="${fill}"` +
    (opacity < 1 ? ` fill-opacity="${opacity}"` : '') +
    '/></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const declare = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

/** Every custom property of the day theme, by name. */
export function dayTokens(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [group, { prefix, unit = '' }] of Object.entries(CSS_GROUPS))
    for (const [key, value] of Object.entries(theme[group as keyof Theme] as object))
      vars[`${prefix}${key}`] = `${value}${typeof value === 'number' ? unit : ''}`;
  const c = theme.colour;
  const opacity = theme.night['paper-opacity'];
  vars['--ui-paper-night-fill'] = withOpacity(c['paper-night'] ?? '#000000', opacity);
  const fills: Record<string, [string, string, number]> = {
    torn: [c.paper ?? '', c['paper-night'] ?? '', opacity],
    brushed: [c['sage-wash'] ?? '', c['sage-wash-night'] ?? '', 1],
  };
  for (const [name, edge] of Object.entries(theme.edges)) {
    const [day, night, nightOpacity] = fills[name] ?? [c.paper ?? '', c['paper-night'] ?? '', 1];
    vars[`--ui-edge-${name}-day`] = edgeImage(edge, day);
    vars[`--ui-edge-${name}-night`] = edgeImage(edge, night, nightOpacity);
    vars[`--ui-edge-${name}-slice`] = String(edge.slice);
    vars[`--ui-edge-${name}-width`] = `${edge.slice}px`;
  }
  Object.assign(vars, roles(0));
  for (const [key, value] of Object.entries(theme.legacy.root)) vars[`--${key}`] = value;
  for (const [key, value] of Object.entries(theme.legacy['on-paper']))
    vars[`--on-paper-${key}`] = value;
  return vars;
}

/** What changes when the scene is dark (`data-night`, decision 0220 and issue #326). */
export function nightTokens(theme: Theme): Record<string, string> {
  const vars = roles(1);
  for (const [key, value] of Object.entries(theme.legacy.night)) vars[`--${key}`] = value;
  return vars;
}

/** The theme as a stylesheet. */
export function themeCss(theme: Theme, scope: ThemeScope = PAGE_SCOPE): string {
  const block = (selector: string, vars: Record<string, string>) =>
    `${selector} {\n${declare(vars)}\n}\n`;
  return (
    block(scope.root, dayTokens(theme)) +
    block(scope.night, nightTokens(theme)) +
    block(scope.forcedDay, roles(0)) +
    block(scope.forcedNight, roles(1))
  );
}

export type Layout = 'phone' | 'desktop' | 'mid';

/** Which of the two breakpoints a window falls in: phone landscape (short) or desktop (wide). */
export function layoutFor(width: number, height: number, theme: Theme = SHIPPED_THEME): Layout {
  if (height <= theme.breakpoints['phone-max-height']) return 'phone';
  if (width >= theme.breakpoints['desktop-min-width']) return 'desktop';
  return 'mid';
}
