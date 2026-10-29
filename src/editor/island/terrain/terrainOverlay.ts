import type { TerrainMarks } from './terrainTool';

/** The SVG element maker of the builder's overlay. */
type Make = (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element;

/**
 * What the terrain tools draw over the island (issue #271): where a stroke has spoiled the coast
 * or a berth, the brush's footprint (its soft edge dashed, amber where it would touch protected
 * town terraces), and a slope's two ends with their heights. In radius units, `u` per pixel;
 * `unit` is the world units of one radius unit, for the height labels.
 */
export function drawTerrainMarks(el: Make, u: number, unit: number, marks: TerrainMarks) {
  for (const w of marks.warnings)
    el('circle', { cx: w.at[0], cy: w.at[1], r: 5 * u, class: 'i-terrain-warning' });
  const { at, brush, slope } = marks;
  if (at) {
    el('circle', {
      cx: at[0],
      cy: at[1],
      r: brush.radius,
      class: `i-terrain-brush${marks.blocked ? ' blocked' : ''}`,
    });
    if (brush.falloff > 0 && brush.falloff < 1)
      el('circle', {
        cx: at[0],
        cy: at[1],
        r: brush.radius * (1 - brush.falloff),
        class: 'i-terrain-core',
      });
  }
  if (!slope) return;
  const [a, b] = slope as [number[], number[]];
  el('line', { x1: a[0]!, y1: a[1]!, x2: b[0]!, y2: b[1]!, class: 'i-terrain-slope' });
  for (const p of slope) {
    el('circle', { cx: p[0]!, cy: p[1]!, r: 5 * u, class: 'i-terrain-end' });
    const label = el('text', {
      x: p[0]! + 8 * u,
      y: p[1]! - 8 * u,
      class: 'i-label',
      'font-size': 13 * u,
      'stroke-width': 3.5 * u,
    });
    label.textContent = (p[2]! * unit).toFixed(1);
  }
}
