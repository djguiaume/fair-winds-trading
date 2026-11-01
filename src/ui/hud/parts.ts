import { type MessageKey, t } from '../../i18n';
import { DEG, wrapPositive } from '../../sim/math';

/**
 * Small helpers the sea HUD's clusters share (issue #441): SVG and text writes that touch the DOM
 * only when something changed, so a still frame costs nothing.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** An SVG element with its attributes. */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  parent?.append(node);
  return node;
}

/** Sets the text only when it differs, so an unchanged frame leaves the layout alone. */
export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Shows or hides only on a change. */
export function setHidden(node: HTMLElement | SVGElement, hidden: boolean): void {
  if (node.hasAttribute('hidden') !== hidden) node.toggleAttribute('hidden', hidden);
}

/**
 * Turns an SVG group, rounded to `step` degrees: a steady angle writes nothing and builds no
 * string, so a still frame allocates nothing.
 */
export class Rotator {
  private shown = NaN;

  constructor(
    private readonly node: SVGElement,
    private readonly step = 0.5,
  ) {}

  set(deg: number): void {
    const rounded = Math.round(deg / this.step) * this.step;
    if (rounded === this.shown) return;
    this.shown = rounded;
    this.node.setAttribute('transform', `rotate(${rounded})`);
  }
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Nearest of the eight compass points for a direction in radians, translated. */
export function compassPoint(rad: number): string {
  return t(`compass.${POINTS[Math.round(wrapPositive(rad) / (Math.PI / 4)) % 8]!}`);
}

/** The same point as words for a sentence: "to the west", "à l'ouest" (decision 0091). */
export function compassWords(rad: number): string {
  return t(`compassLong.${POINTS[Math.round(wrapPositive(rad) / (Math.PI / 4)) % 8]!}`);
}

/** A bearing in whole degrees, 0 to 359. */
export function degrees(rad: number): number {
  return Math.round(wrapPositive(rad) / DEG) % 360;
}

/** A label that follows a language change (`translateDom`), as the static markup's did. */
export function label<T extends HTMLElement>(node: T, key: MessageKey): T {
  node.dataset.i18n = key;
  node.textContent = t(key);
  return node;
}

/** Attributes that follow a language change, e.g. `{ 'aria-label': 'hud.mainMenu' }`. */
export function labelAttrs(node: HTMLElement, attrs: Record<string, MessageKey>): void {
  node.dataset.i18nAttr = Object.entries(attrs)
    .map(([attr, key]) => `${attr}:${key}`)
    .join(';');
  for (const [attr, key] of Object.entries(attrs)) node.setAttribute(attr, t(key));
}
