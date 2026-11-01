import type { World } from '../../sim/world';

/**
 * What every layer of the sea chart draws with (issue #444): one SVG in map units, y flipped so
 * north is up, and the sizes that keep marks and words the same on screen at every zoom.
 */

const NS = 'http://www.w3.org/2000/svg';

export type Attrs = Record<string, string | number>;
/** Adds an SVG element to the chart (or to `parent`) and returns it. */
export type Shape = (tag: string, attrs: Attrs, parent?: Element) => SVGElement;

export function shaper(root: Element): Shape {
  return (tag, attrs, parent = root) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    parent.append(node);
    return node;
  };
}

/** One drawing of the chart: its world, its SVG and its two screen scales. */
export interface Paint {
  world: World;
  svg: SVGSVGElement;
  shape: Shape;
  /** Map units per screen pixel. */
  unit: number;
  /** The same for marks and words, a little bigger on large screens. */
  px: number;
}

/** An outline in map coordinates (y north) as SVG points (y down). */
export const points = (outline: readonly (readonly number[])[]) =>
  outline.map(([x, y]) => `${x},${-y!}`).join(' ');

/** A box in chart coordinates (y down), for keeping labels apart. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

export const box = (cx: number, cy: number, w: number, h: number): Box => ({
  x0: cx - w / 2,
  y0: cy - h / 2,
  x1: cx + w / 2,
  y1: cy + h / 2,
});

/** Overlapping area of two boxes, used to choose the clearest side for a label. */
export const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** The box round an outline in map coordinates, in chart coordinates. */
export function boxOf(outline: readonly (readonly number[])[]): Box {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x!);
    x1 = Math.max(x1, x!);
    y0 = Math.min(y0, -y!);
    y1 = Math.max(y1, -y!);
  }
  return { x0, y0, x1, y1 };
}

/** A shape the keyboard and a click both press: Enter or Space click it. */
export function pressable(node: Element, label: string) {
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');
  node.setAttribute('aria-label', label);
  node.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    if (key !== 'Enter' && key !== ' ') return;
    e.preventDefault();
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}
