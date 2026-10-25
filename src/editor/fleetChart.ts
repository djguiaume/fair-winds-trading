import type { MapDef } from '../sim/map';
import { laneOf } from '../sim/traffic';
import type { Selection } from './model';

/**
 * The other boats' fleets on the editor's chart (decision 0214): each lane as a dotted line from
 * its home harbour through its marks, a fishing fleet's grounds as a ring, the fleet's name by
 * its home end. Handles for the selected one's marks. Hits: `fleet:id`, `fpoint:id:k`,
 * `finsert:id:k` (k counts the marks of `path`).
 */

type El = (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element;

const pts = (points: readonly { x: number; y: number }[]) =>
  points.map((p) => `${p.x},${-p.y}`).join(' ');

export function drawFleets(
  el: El,
  map: MapDef,
  prepared: MapDef,
  selection: Selection,
  px: number,
) {
  // Fleets from one harbour list their names one under another.
  const labels = new Map<string, number>();
  for (const fleet of map.traffic ?? []) {
    const on = selection?.kind === 'fleet' && selection.id === fleet.id;
    let lane: { x: number; y: number }[];
    try {
      lane = laneOf(prepared, fleet);
    } catch {
      continue;
    }
    const hit = `fleet:${fleet.id}`;
    const kind = `c-fleet c-fleet-${fleet.kind}${on ? ' on' : ''}`;
    if (lane.length >= 2) {
      el('polyline', {
        points: pts(lane),
        class: kind,
        'stroke-dasharray': `${3 * px} ${5 * px}`,
      });
      el('polyline', { points: pts(lane), class: 'c-fleet-hit', 'data-hit': hit });
    }
    if (fleet.grounds) {
      const [x, y, r] = fleet.grounds;
      el('circle', { cx: x, cy: -y, r, class: `${kind} c-fleet-grounds`, 'data-hit': hit });
    }
    const home = lane[0];
    if (home) {
      const key = `${Math.round(home.x)},${Math.round(home.y)}`;
      const row = labels.get(key) ?? 0;
      labels.set(key, row + 1);
      const label = el('text', {
        x: home.x + 6 * px,
        y: -home.y - 6 * px + row * 13 * px,
        class: 'c-fleet-label',
      });
      label.textContent = `${fleet.names.join(', ')} (${fleet.kind})`;
      label.setAttribute('font-size', String(11 * px));
    }
    if (!on) continue;
    const path = fleet.path ?? [];
    for (let k = 0; k + 1 < path.length; k++) {
      const [x, y] = path[k]!;
      const [nx, ny] = path[k + 1]!;
      el('circle', {
        cx: (x + nx) / 2,
        cy: -(y + ny) / 2,
        r: 3.5 * px,
        class: 'c-add',
        'data-hit': `finsert:${fleet.id}:${k}`,
      });
    }
    path.forEach(([x, y], k) =>
      el('circle', {
        cx: x,
        cy: -y,
        r: 5.5 * px,
        class: `c-handle${selection.point === k ? ' on' : ''}`,
        'data-hit': `fpoint:${fleet.id}:${k}`,
      }),
    );
  }
}
