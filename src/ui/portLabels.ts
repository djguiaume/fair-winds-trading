import type { ScreenPoint } from '../render/view';
import { type GoodId } from '../sim/goods';
import { DOCK_RANGE, DOCK_SPEED_KN, distanceToPort } from '../sim/trade';
import { navigationTarget, type World } from '../sim/world';
import { goodName, t } from '../i18n';

export type PortMarkerMode = 'approach' | 'objective' | 'all' | 'off';

const GOOD_ICONS: Record<GoodId, string> = {
  fish: '🐟',
  grain: '🌾',
  timber: '🪵',
  stone: '🪨',
};

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
    }
  > = new Map();

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

  private init() {
    this.container.innerHTML = '';
    const { map } = this.world;

    for (const port of map.ports) {
      const island = map.islands.find((i) => i.id === port.islandId);
      if (!island) continue;

      const produces = port.produces
        .map((g) => `${GOOD_ICONS[g as GoodId] ?? ''} ${goodName(g)}`)
        .join(', ');
      const wants = port.wants
        .map((g) => `${GOOD_ICONS[g as GoodId] ?? ''} ${goodName(g)}`)
        .join(', ');

      const el = document.createElement('button');
      el.className = 'port-marker';
      el.type = 'button';
      el.setAttribute('aria-label', t('port.setCourse', { name: port.name }));
      el.dataset.portId = port.id;
      el.hidden = true;

      el.innerHTML = `
        <span class="port-marker-box">
          <span class="port-marker-header">
            <span class="port-marker-icon" aria-hidden="true">⚓</span>
            <span class="port-marker-name">${port.name}</span>
          </span>
          <span class="port-marker-cue">${t('port.harbour')}</span>
          <span class="port-marker-tag">
            <span class="produces-tag">${produces}</span>
            <span class="sign-sep">·</span>
            <span class="wants-tag">${t('port.wants', { goods: wants })}</span>
          </span>
        </span>
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
      });
    }
  }

  update(project: (x: number, y: number) => ScreenPoint) {
    if (this.mode === 'off') {
      for (const entry of this.portElements.values()) {
        entry.root.hidden = true;
      }
      return;
    }

    const { map, boat, trade } = this.world;
    const currentWp = navigationTarget(this.world);
    const effectiveMode = this.isKidMode ? 'objective' : this.mode;

    for (const port of map.ports) {
      const entry = this.portElements.get(port.id);
      if (!entry) continue;

      const distToShore = distanceToPort(map, boat, port);
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
        entry.root.hidden = true;
        continue;
      }

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
      entry.root.classList.toggle('ready', canDock || isDocked);
      entry.root.setAttribute('aria-label', `${port.name}: ${cue}`);
      const s = project(entry.anchor.x, entry.anchor.y);
      if (s.onScreen) {
        entry.root.hidden = false;
        entry.root.classList.toggle('docked', isDocked);
        entry.root.style.transform = `translate(${s.x}px, ${s.y - 14}px)`;
      } else {
        // Hide off-screen markers to avoid screen edge clutter
        entry.root.hidden = true;
      }
    }
  }
}
