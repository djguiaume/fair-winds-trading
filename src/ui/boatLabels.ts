import type { ScreenPoint } from '../render/view';
import { TUNING } from '../data/tuning';
import type { World } from '../sim/world';
import { t } from '../i18n';

/**
 * The name of the other boat she passes close by (decision 0215): "Adze, out of Calda", in the
 * port signs' style, fading in over the last third of `traffic.labelRange`. One at a time, the
 * nearest; never a boat lying at a harbour or on her nets.
 */
export class BoatLabels {
  private readonly el: HTMLElement;
  private shown = '';

  constructor(
    container: HTMLElement,
    private readonly world: World,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'boat-label';
    this.el.hidden = true;
    container.appendChild(this.el);
  }

  update(project: (x: number, y: number) => ScreenPoint) {
    const { traffic, boat: me, map, time } = this.world;
    const range = TUNING.seamanship.traffic.labelRange;
    let near: (typeof traffic.boats)[number] | null = null;
    let nearD = range;
    if (traffic.on)
      for (const b of traffic.boats) {
        if (!b.awake || time < b.waitUntil) continue;
        const d = Math.hypot(b.boat.x - me.x, b.boat.y - me.y);
        if (d < nearD) {
          nearD = d;
          near = b;
        }
      }
    const p = near ? project(near.boat.x, near.boat.y) : null;
    if (!near || !p?.onScreen) {
      this.el.hidden = true;
      return;
    }
    if (this.shown !== near.name) {
      this.shown = near.name;
      const port = map.ports.find((q) => q.id === near.fleet.home)?.name ?? near.fleet.home;
      this.el.textContent = t('traffic.label', { name: near.name, port });
    }
    this.el.hidden = false;
    this.el.style.opacity = Math.min(1, (range - nearD) / (range / 3)).toFixed(2);
    this.el.style.transform = `translate(${p.x.toFixed(0)}px, ${(p.y - 40).toFixed(0)}px) translate(-50%, -100%)`;
  }
}
