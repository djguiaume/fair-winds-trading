import './hazard.css';

/**
 * Hazard markers (decision 0070): one look for every danger, on the sea chart and in the warning
 * toast. A round badge with the hazard's icon, its name in the port-name lettering, and chevrons
 * for the way it is moving; a hazard that covers an area (a storm) also gets a soft dark cloud for
 * its reach. Storms use it now; pirates (Phase 5) add a kind with their own icon and a red badge.
 */
export type HazardKind = 'storm';

export interface Hazard {
  kind: HazardKind;
  /** Centre in map units (y north). */
  x: number;
  y: number;
  /** Direction of travel, unit vector (y north); none = not moving. */
  dx?: number;
  dy?: number;
  /** Radius of the area it covers, in map units; none = a single ship. */
  reach?: number;
  /** 0..1: fades the marker in and out as the hazard forms and leaves. */
  strength: number;
}

const NS = 'http://www.w3.org/2000/svg';
const ICON: Record<HazardKind, string> = { storm: '#i-storm' };
const CLOUD = 'hazard-cloud';

function el(tag: string, attrs: Record<string, string | number>, parent: Element) {
  const e = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value));
  parent.append(e);
  return e;
}

/** The soft cloud for a hazard's reach: one radial gradient per chart drawing. */
function cloudGradient(svg: SVGSVGElement) {
  if (svg.querySelector(`#${CLOUD}`)) return;
  const defs = el('defs', {}, svg);
  const g = el('radialGradient', { id: CLOUD }, defs);
  el('stop', { offset: 0, class: 'hazard-cloud-core' }, g);
  el('stop', { offset: 0.55, class: 'hazard-cloud-mid' }, g);
  el('stop', { offset: 1, class: 'hazard-cloud-edge' }, g);
}

/**
 * Draws a hazard on the chart. `px` is map units per screen pixel (so the badge, label and
 * chevrons keep their screen size at every zoom); `label` is the translated name.
 */
export function drawHazard(parent: SVGElement, hazard: Hazard, px: number, label: string) {
  const svg = parent instanceof SVGSVGElement ? parent : parent.ownerSVGElement!;
  const cx = hazard.x,
    cy = -hazard.y;
  const g = el(
    'g',
    {
      class: `chart-hazard hazard-${hazard.kind}`,
      opacity: Math.min(1, hazard.strength * 1.3).toFixed(2),
      role: 'img',
      'aria-label': label,
    },
    parent,
  );
  if (hazard.reach) {
    cloudGradient(svg);
    el('circle', { cx, cy, r: hazard.reach, fill: `url(#${CLOUD})` }, g);
  }
  // Chevrons the way it moves, from inside the cloud (or just off the badge), fading out ahead.
  if (hazard.dx !== undefined && hazard.dy !== undefined) {
    const ux = hazard.dx,
      uy = -hazard.dy;
    const size = 20 * px;
    const start = hazard.reach ? hazard.reach * 0.45 : 26 * px;
    for (let i = 0; i < 3; i++) {
      const x = cx + ux * (start + i * size * 0.9),
        y = cy + uy * (start + i * size * 0.9);
      const points = [
        [x + ux * size * 0.5, y + uy * size * 0.5],
        [x - ux * size * 0.3 - uy * size * 0.55, y - uy * size * 0.3 + ux * size * 0.55],
        [x - ux * size * 0.1, y - uy * size * 0.1],
        [x - ux * size * 0.3 + uy * size * 0.55, y - uy * size * 0.3 - ux * size * 0.55],
      ];
      el(
        'polygon',
        {
          points: points.map((p) => p.join(',')).join(' '),
          class: 'hazard-chevron',
          opacity: 1 - i * 0.22,
        },
        g,
      );
    }
  }
  const r = 17 * px;
  el('circle', { cx, cy, r, class: 'hazard-badge' }, g);
  el('use', { href: ICON[hazard.kind], x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, g);
  // The name sits on the side it comes from, so it never covers the chevrons ahead of it.
  const size = 14 * px;
  const back = r + 14 * px;
  const moving = hazard.dx !== undefined && hazard.dy !== undefined;
  const [lx, ly] = moving ? [cx - hazard.dx! * back, cy + hazard.dy! * back] : [cx, cy - back];
  const name = el(
    'text',
    { x: lx, y: ly + size * 0.35, class: 'hazard-name', style: `font-size: ${size}px` },
    g,
  );
  name.textContent = label.toUpperCase();
  return g;
}

/** The same badge as a small inline icon, for the warning toast. */
export function hazardBadge(kind: HazardKind): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `hazard-toast-badge hazard-${kind}`);
  svg.setAttribute('viewBox', '-18 -18 36 36');
  svg.setAttribute('aria-hidden', 'true');
  el('circle', { r: 17, class: 'hazard-badge' }, svg);
  el('use', { href: ICON[kind], x: -17, y: -17, width: 34, height: 34 }, svg);
  return svg;
}
