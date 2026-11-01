import { reservedColourProblem } from '../../sim/cosmeticChecks';
import type { Theme } from './model';

/**
 * The theme's rules (decision 0269), held by `npm run check`, `npm run theme -- check` and the
 * editors' Theme page: readable text (WCAG AA, 4.5:1) on every surface, none of the colours the
 * game keeps for signals (the player's brass, storm amber, regatta yellow, edge-buoy red) and
 * nothing whiter than the tablets' bloom limit, sizes a finger and the art bible allow, and
 * motion that stays short.
 */

const HEX = /^#[0-9a-f]{6}$/i;
export const MIN_CONTRAST = 4.5;
const MIN_TYPE = 11;
const MIN_TOUCH = 44;
/** The sea HUD keeps this far from every screen edge (art director, issue #441). */
const MIN_HUD_MARGIN = 12;
const DURATION = { min: 150, max: 250 };

/** Text colour on a background, both colour tokens. */
export const CONTRAST_PAIRS: readonly [text: string, on: string][] = [
  ['ink', 'paper'],
  ['ink-muted', 'paper'],
  ['ink', 'paper-night'],
  ['ink-muted-night', 'paper-night'],
  ['ink', 'sage-wash'],
  ['ink', 'sage-wash-night'],
  ['on-sage', 'sage'],
  // Danger is for words and small marks only, never a filled button (art director, v1.5).
  ['danger', 'paper'],
];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function colourProblems(theme: Theme): string[] {
  const out: string[] = [];
  for (const [key, hex] of Object.entries(theme.colour)) {
    if (!HEX.test(hex)) {
      out.push(`colour.${key} is not a #rrggbb colour: ${hex}`);
      continue;
    }
    const reserved = reservedColourProblem(hex);
    if (reserved) out.push(`colour.${key}: ${reserved}`);
  }
  for (const [text, on] of CONTRAST_PAIRS) {
    const a = theme.colour[text];
    const b = theme.colour[on];
    if (!a || !b) out.push(`colour.${!a ? text : on} is missing`);
    else if (HEX.test(a) && HEX.test(b) && contrast(a, b) < MIN_CONTRAST)
      out.push(
        `colour.${text} on colour.${on} reads at ${contrast(a, b).toFixed(2)}:1, under ${MIN_CONTRAST}:1`,
      );
  }
  const opacity = theme.night['paper-opacity'];
  if (!(opacity > 0 && opacity <= 1)) out.push(`night.paper-opacity must be over 0, at most 1`);
  return out;
}

function sizeProblems(theme: Theme): string[] {
  const out: string[] = [];
  for (const [key, px] of Object.entries(theme.type))
    if (!Number.isInteger(px) || px < MIN_TYPE)
      out.push(`type.${key} is ${px}px: whole pixels, ${MIN_TYPE} or more (art bible)`);
  const { target, 'row-min': rowMin, 'row-max': rowMax } = theme.touch;
  if (target < MIN_TOUCH) out.push(`touch.target is ${target}px, under ${MIN_TOUCH}px`);
  if (rowMin < target) out.push(`touch.row-min (${rowMin}px) is under touch.target`);
  if (rowMax < rowMin) out.push(`touch.row-max (${rowMax}px) is under touch.row-min`);
  for (const group of ['hud', 'harbour'] as const)
    for (const [key, px] of Object.entries(theme[group]))
      if (!Number.isInteger(px) || px <= 0)
        out.push(`${group}.${key} must be whole pixels, over 0`);
  for (const key of ['margin', 'margin-phone'])
    if (!((theme.hud[key] ?? 0) >= MIN_HUD_MARGIN))
      out.push(`hud.${key} must be ${MIN_HUD_MARGIN}px or more (the HUD's safe margin)`);
  for (const group of ['space', 'radius', 'z'] as const)
    for (const [key, n] of Object.entries(theme[group]))
      if (!Number.isFinite(n) || n < 0) out.push(`${group}.${key} must be a number, 0 or more`);
  return out;
}

function motionProblems(theme: Theme): string[] {
  const out: string[] = [];
  for (const [key, ms] of Object.entries(theme.duration))
    if (!(ms >= DURATION.min && ms <= DURATION.max))
      out.push(`duration.${key} is ${ms} ms: keep it ${DURATION.min} to ${DURATION.max} ms`);
  const { scale } = theme.press;
  if (!(scale >= 0.9 && scale <= 1)) out.push(`press.scale is ${scale}: keep it 0.9 to 1`);
  return out;
}

function shapeProblems(theme: Theme): string[] {
  const out: string[] = [];
  for (const [name, e] of Object.entries(theme.edges)) {
    if (!/^M[\d.\sLZ-]+Z$/.test(e.path))
      out.push(`edges.${name}.path is not a closed M…L…Z outline`);
    if (!(e.slice > 0 && e.slice * 2 < e.size))
      out.push(`edges.${name}.slice must be over 0 and under half its size`);
  }
  if (!theme.edges.torn) out.push('edges.torn is missing (the paper panels use it)');
  const bp = theme.breakpoints;
  if (!(bp['phone-max-height'] > 0 && bp['desktop-min-width'] > 0))
    out.push('breakpoints must be over 0');
  const texts: [string, Record<string, string>][] = [
    ['font', theme.font],
    ['elevation', theme.elevation],
    ['easing', theme.easing],
    ['legacy.root', theme.legacy.root],
    ['legacy.night', theme.legacy.night],
    ['legacy.on-paper', theme.legacy['on-paper']],
  ];
  for (const [group, values] of texts)
    for (const [key, value] of Object.entries(values))
      if (typeof value !== 'string' || !value.trim() || /[;{}]/.test(value))
        out.push(`${group}.${key} must be one CSS value`);
  return out;
}

/** Every rule the theme breaks, as one line each; empty when it is fine. */
export function themeProblems(theme: Theme): string[] {
  return [
    ...colourProblems(theme),
    ...sizeProblems(theme),
    ...motionProblems(theme),
    ...shapeProblems(theme),
  ];
}
