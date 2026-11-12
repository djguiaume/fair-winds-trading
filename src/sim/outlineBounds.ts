import type { TerrainDef } from './map';

/** A box on the map: x and y from min to max. */
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const outlineBoxes = new WeakMap<TerrainDef['outline'], Box>();

/** An outline's box, kept while the outline lives (generated island outlines keep their identity). */
export function boundsOf(outline: TerrainDef['outline']): Box {
  let bounds = outlineBoxes.get(outline);
  if (!bounds) {
    bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const [x, y] of outline) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
    outlineBoxes.set(outline, bounds);
  }
  return bounds;
}

/** True when two boxes, the first grown by `pad`, do not meet. */
export function apart(a: Box, pad: number, b: Box): boolean {
  return (
    a.maxX + pad < b.minX || a.minX - pad > b.maxX || a.maxY + pad < b.minY || a.minY - pad > b.maxY
  );
}
