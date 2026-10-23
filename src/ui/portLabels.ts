import type { ScreenPoint } from '../render/view';
import { type GoodId } from '../sim/goods';
import { isDiscovered } from '../sim/shipyards';
import { unitSellPrice } from '../sim/market';
import { producesAt, wantsAt, settlementLevel } from '../sim/settlement';
import { DOCK_RANGE, DOCK_SPEED_KN, distanceToPort } from '../sim/trade';
import { navigationTarget, type World } from '../sim/world';
import { goodName, t } from '../i18n';

export type PortMarkerMode = 'approach' | 'objective' | 'all' | 'off';

const COIN = '<svg class="icon coin" aria-hidden="true"><use href="#i-coin" /></svg>';
/** A colour goods icon from the HUD's SVG sprite (decision 0049). */
const goodIcon = (good: string) =>
  `<svg class="icon" aria-hidden="true"><use href="#i-${good}" /></svg>`;

export class PortLabels {
  private readonly portElements: Map<
    string,
    {
      root: HTMLElement;
      boxEl: HTMLElement;
      nameEl: HTMLElement;
      tagEl: HTMLElement;
      anchor: { x: number; y: number };
      cue: HTMLElement;
      dock: HTMLElement;
      prices: { good: GoodId; el: HTMLElement }[];
    }
  > = new Map();

  private sinceContent = 1;

  mode: PortMarkerMode = 'approach';
  isKidMode = false;
  onPortClick: (portId: string) => void = () => {};

  constructor(
    private readonly container: HTMLElement,
    private readonly world: World,
    private readonly harbours: Record<string, { x: number; y: number }> = {},
  ) {
    this.init();
  }

  /** Redraw the signs, e.g. after a town grows and wants more goods (decision 0059). */
  rebuild() {
    this.portElements.clear();
    this.init();
  }

  private init() {
    this.container.innerHTML = '';
    const { map } = this.world;

    for (const port of map.ports) {
      const island = map.islands.find((i) => i.id === port.islandId);
      if (!island) continue;

      const produces = producesAt(map, this.world.trade, port.id)
        .map((g) => `<span title="${goodName(g)}">${goodIcon(g)}</span>`)
        .join('');
      const wants = wantsAt(map, this.world.trade, port.id)
        .map(
          (g) =>
            `<span class="sign-good" title="${goodName(g)}">${goodIcon(g)}<b data-price="${g}"></b>${COIN}</span>`,
        )
        .join('');

      const el = document.createElement('button');
      el.className = 'port-marker';
      el.type = 'button';
      el.setAttribute('aria-label', t('port.setCourse', { name: port.name }));
      el.dataset.portId = port.id;
      el.hidden = true;

      el.innerHTML = `
        <span class="port-marker-box">
          <span class="port-marker-header">
            <svg class="icon port-marker-icon" aria-hidden="true"><use href="#i-anchor" /></svg>
            <span class="port-marker-name">${port.name}</span>
          </span>
          <span class="port-marker-tag">
            <span class="wants-tag"><small>${t('port.wantsLabel')}</small>${wants}</span>
            <span class="produces-tag"><small>${t('port.makesLabel')}</small>${produces}</span>
          </span>
          <span class="port-marker-cue">${t('port.harbour')}</span>
        </span>
        <span class="port-marker-dock" hidden>
          <svg class="icon" aria-hidden="true"><use href="#i-anchor" /></svg>
          <span class="port-marker-dock-text"></span>
        </span>
        <span class="port-marker-stem" aria-hidden="true"></span>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPortClick(port.id);
      });

      this.container.appendChild(el);

      this.portElements.set(port.id, {
        root: el,
        anchor: this.harbours[port.id] ?? island,
        cue: el.querySelector('.port-marker-cue')!,
        boxEl: el.querySelector('.port-marker-box')!,
        nameEl: el.querySelector('.port-marker-name')!,
        tagEl: el.querySelector('.port-marker-tag')!,
        dock: el.querySelector('.port-marker-dock')!,
        prices: Array.from(el.querySelectorAll<HTMLElement>('[data-price]')).map((p) => ({
          good: p.dataset.price as GoodId,
          el: p,
        })),
      });
    }
  }

  /** True while this port's sign is on screen with its Dock/Trade button showing. */
  dockShown(portId: string): boolean {
    const entry = this.portElements.get(portId);
    return Boolean(entry && !entry.root.hidden && !entry.dock.hidden);
  }

  update(project: (x: number, y: number) => ScreenPoint, dt = 0.12) {
    this.sinceContent += dt;
    const refreshContent = this.sinceContent >= 0.12;
    if (refreshContent) this.sinceContent = 0;
    if (this.mode === 'off') {
      for (const entry of this.portElements.values()) {
        if (!entry.root.hidden) entry.root.hidden = true;
      }
      return;
    }

    const { map, boat, trade } = this.world;
    const currentWp = navigationTarget(this.world);
    const effectiveMode = this.isKidMode ? 'objective' : this.mode;

    for (const port of map.ports) {
      const entry = this.portElements.get(port.id);
      if (!entry) continue;

      if (!isDiscovered(trade, port.id)) {
        if (!entry.root.hidden) entry.root.hidden = true;
        continue;
      }
      const distToShore = distanceToPort(
        map,
        boat,
        port,
        settlementLevel(this.world.trade, port.id),
        this.world.ship.id,
      );
      const isDocked = trade.dockedAt === port.id;
      const isObjective = currentWp?.label === port.name;

      let shouldShow = false;

      if (effectiveMode === 'approach') {
        // Show the pier early enough to plan the approach.
        shouldShow = distToShore <= 100 || isDocked;
      } else if (effectiveMode === 'objective') {
        // The selected destination and nearby harbours remain identifiable.
        shouldShow = isObjective || isDocked || distToShore <= 100;
      } else if (effectiveMode === 'all') {
        shouldShow = distToShore <= 160 || isDocked;
      }

      if (!shouldShow) {
        if (!entry.root.hidden) entry.root.hidden = true;
        continue;
      }

      const s = project(entry.anchor.x, entry.anchor.y);
      if (s.onScreen) {
        // Only content is throttled. Pier motion follows the rendered camera every frame.
        if (refreshContent || entry.root.hidden) {
          const canDock = distToShore <= DOCK_RANGE && boat.speedKn < DOCK_SPEED_KN;
          const cue = isDocked
            ? t('port.cueDocked')
            : canDock
              ? t('port.cueCanDock')
              : distToShore <= DOCK_RANGE
                ? t(boat.sailStep > 0 ? 'port.cueLowerSails' : 'port.cueSlowDown')
                : distToShore <= DOCK_RANGE + 12
                  ? t('port.cueCloser')
                  : t('port.cueTrading');
          if (entry.cue.textContent !== cue) entry.cue.textContent = cue;
          // A brass Dock (or Trade, once moored) button replaces the cue when it is one tap away.
          const ready = canDock || isDocked;
          entry.cue.hidden = ready;
          entry.dock.hidden = !ready;
          if (ready) {
            const label = t(isDocked ? 'port.tradeBtn' : 'port.dockBtn');
            const text = entry.dock.lastElementChild!;
            if (text.textContent !== label) text.textContent = label;
          }
          // What the port pays today for the goods it wants.
          const market = trade.markets[port.id];
          for (const p of entry.prices) {
            const price = market
              ? String(unitSellPrice(p.good, market.stock[p.good], market.spread))
              : '';
            if (p.el.textContent !== price) p.el.textContent = price;
          }
          if (entry.root.classList.contains('ready') !== ready)
            entry.root.classList.toggle('ready', ready);
          const ariaLabel = `${port.name}: ${cue}`;
          if (entry.root.getAttribute('aria-label') !== ariaLabel)
            entry.root.setAttribute('aria-label', ariaLabel);
        }
        if (entry.root.hidden) entry.root.hidden = false;
        if (entry.root.classList.contains('docked') !== isDocked)
          entry.root.classList.toggle('docked', isDocked);
        // Composite the existing sign rather than repainting its shadow and SVGs as it moves.
        const transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) translate(-50%, -100%)`;
        if (entry.root.style.transform !== transform) entry.root.style.transform = transform;
      } else {
        // Hide off-screen markers to avoid screen edge clutter
        if (!entry.root.hidden) entry.root.hidden = true;
      }
    }
  }
}
