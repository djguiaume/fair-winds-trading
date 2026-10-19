import { SAIL_STEPS, trueWindAngle } from '../sim/boat';
import { DEG, bearingTo, distance, wrapPositive } from '../sim/math';
import { type PointOfSail, pointOfSail } from '../sim/ship';
import { hullCondition } from '../sim/hazards';
import { windTo } from '../sim/wind';
import { windFeedback } from './windFeedback';
import { type World, type WorldEvent, navigationTarget } from '../sim/world';
import type { ScreenPoint } from '../render/view';

import { GOODS } from '../sim/goods';
import { activeShip, capacity, cargoUsed, findPort } from '../sim/trade';
import { PortLabels } from './portLabels';
import { formatNumber, goodName, shipName, t } from '../i18n';

const POINT_OF_SAIL_TONE: Record<PointOfSail, '' | 'good' | 'bad'> = {
  'in-irons': '',
  'close-hauled': '',
  'beam-reach': 'good',
  'broad-reach': 'good',
  running: '',
};

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
}

function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Plain-DOM heads-up display with trading stats and port labels. */
export class Hud {
  private readonly speed = $('speed');
  private readonly pos = $('point-of-sail');
  private readonly pips = Array.from(document.querySelectorAll<HTMLElement>('.sail-pips i'));
  private readonly objective = $('navigation-target');
  private readonly objName = $('obj-name');
  private readonly objDist = $('obj-dist');
  private readonly windText = $('wind-text');
  private readonly cNoGo = $('c-nogo');
  private readonly cWind = $('c-wind');
  private readonly cBoat = $('c-boat');
  private readonly cWp = $('c-wp');
  private readonly wpArrow = $('wp-arrow');
  private readonly toast = $('toast');
  private readonly tiller = $('tiller');
  private readonly fps = $('fps');

  // Phase 1 persistent stats and docking
  private readonly hudGold = $('hud-gold');
  private readonly hudCargo = $('hud-cargo');
  private readonly hudHull = $('hud-hull');
  private readonly hudHullBox = $('hud-hull-box');
  private readonly hudShip = $('hud-ship');
  private readonly cargoBox = $('hud-cargo-box');
  private readonly cargoTooltip = $('hud-cargo-tooltip');
  private readonly dockBtn = $('dock-btn');
  private readonly dockPortName = $('dock-port-name');
  readonly portLabels: PortLabels;

  onDockClick: () => void = () => {};
  onPortClick: (portId: string) => void = () => {};

  private toastTimer = 0;
  private sinceText = 1;
  private sincePortLabels = 1;
  private ironsTime = 0;
  private noGoAngle = -1;
  private readonly compass = $('wind-compass');
  private readonly windTrigger = $('wind-help-trigger');
  private readonly windChip = $('upwind-chip');
  private readonly windHint = $('wind-first-hint');
  private readonly windHelp = $('wind-help') as HTMLDialogElement;
  private hintSeconds = 0;
  private seenWindHint: boolean;
  private returnFocus: HTMLElement | null = null;
  onWindHelpChange: () => void = () => {};

  constructor(
    private readonly world: World,
    private readonly windPreferences: { seen: boolean; markSeen: () => void },
    harbours: Record<string, { x: number; y: number }> = {},
  ) {
    this.seenWindHint = windPreferences.seen;
    const open = () => {
      this.returnFocus = document.activeElement as HTMLElement | null;
      this.dismissWindHint();
      this.windHelp.showModal();
      this.onWindHelpChange();
    };
    this.windTrigger.addEventListener('click', open);
    this.windChip.addEventListener('click', open);
    $('dismiss-wind-hint').addEventListener('click', () => {
      this.dismissWindHint();
      this.windTrigger.focus({ preventScroll: true });
    });
    $('close-wind-help').addEventListener('click', () => this.windHelp.close());
    this.windHelp.addEventListener('close', () => {
      this.onWindHelpChange();
      // The delayed chip disappears while paused. Restore focus to the permanent compass.
      const target =
        this.returnFocus?.isConnected && !this.returnFocus.hidden
          ? this.returnFocus
          : this.windTrigger;
      target.focus({ preventScroll: true });
    });

    this.portLabels = new PortLabels($('port-labels'), this.world, harbours);
    this.portLabels.onPortClick = (portId) => this.onPortClick(portId);

    this.dockBtn.addEventListener('click', () => {
      this.onDockClick();
    });

    this.cargoBox.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCargoTooltip();
      this.cargoBox.setAttribute('aria-expanded', String(!this.cargoTooltip.hidden));
    });

    document.addEventListener('click', () => {
      if (!this.cargoTooltip.hidden) this.cargoTooltip.hidden = true;
      this.cargoBox.setAttribute('aria-expanded', 'false');
    });
  }

  private dismissWindHint() {
    this.hintSeconds = 0;
    this.windHint.hidden = true;
    if (!this.seenWindHint) {
      this.seenWindHint = true;
      this.windPreferences.markSeen();
    }
  }

  private toggleCargoTooltip() {
    if (!this.cargoTooltip.hidden) {
      this.cargoTooltip.hidden = true;
      return;
    }
    const { captain } = this.world.trade;
    const items = GOODS.filter((g) => captain.cargo[g] > 0)
      .map((g) => `${goodName(g)}: <b>${captain.cargo[g]}</b>`)
      .join('<br>');

    this.cargoTooltip.innerHTML = items
      ? items
      : `<span class="muted">${t('hud.holdEmpty')}</span>`;
    this.cargoTooltip.hidden = false;
  }

  showToast(text: string, seconds = 2.5) {
    this.toast.textContent = text;
    this.toast.hidden = false;
    this.toastTimer = seconds;
  }

  handleEvents(events: WorldEvent[]) {
    for (const e of events) {
      if (e.type === 'waypoint') {
        this.showToast(
          t('toast.waypoint', { label: e.label, time: formatTime(e.seconds), next: e.next }),
          3.5,
        );
      } else if (e.type === 'reef-strike') {
        const pct = Math.round(hullCondition(this.world.trade) * 100);
        this.showToast(t('toast.reef', { pct }), 2.5);
      } else if (e.type === 'crash') {
        const pct = Math.round(hullCondition(this.world.trade) * 100);
        this.showToast(t(e.surface === 'pier' ? 'toast.crashPier' : 'toast.crash', { pct }), 2.5);
      } else if (e.type === 'bump' && this.toastTimer <= 0) {
        this.showToast(t('toast.bump'), 1.2);
      }
    }
  }

  setTiller(drag: { x: number; y: number; steer: number } | null) {
    this.tiller.hidden = !drag;
    if (!drag) return;
    this.tiller.style.transform = `translate(${drag.x}px, ${drag.y}px)`;
    (this.tiller.firstElementChild as HTMLElement).style.transform =
      `translateX(${drag.steer * 60}px)`;
  }

  setFps(fps: number | null) {
    this.fps.hidden = fps === null;
    if (fps !== null) this.fps.textContent = t('hud.fps', { n: fps.toFixed(0) });
  }

  /** `project` maps a sim position to screen pixels; `size` is the viewport. */
  update(
    dt: number,
    project: (x: number, y: number) => ScreenPoint,
    size: { w: number; h: number },
    active = true,
  ) {
    const { boat, wind, ship } = this.world;
    const wp = navigationTarget(this.world);

    // Rotations every frame (cheap attribute writes), text ~8 times a second.
    const rot = (el: HTMLElement, rad: number) =>
      el.setAttribute('transform', `rotate(${(rad / DEG).toFixed(1)})`);
    if (this.noGoAngle !== ship.noGoAngle) {
      this.noGoAngle = ship.noGoAngle;
      const x = 40 * Math.sin(ship.noGoAngle);
      const y = -40 * Math.cos(ship.noGoAngle);
      this.cNoGo.firstElementChild!.setAttribute('d', `M0 0 L${-x} ${y} A40 40 0 0 1 ${x} ${y} Z`);
    }
    rot(this.cNoGo, wind.from);
    rot(this.cWind, windTo(wind));
    rot(this.cBoat, boat.heading);
    this.cWp.style.display = wp ? '' : 'none';
    this.objective.hidden = !wp;
    if (wp) rot(this.cWp, bearingTo(boat, wp));

    const twa = trueWindAngle(boat.heading, wind);
    const irons = Math.abs(twa) < ship.noGoAngle;
    const cue = windFeedback(this.ironsTime, dt, {
      inNoGo: irons,
      sailsRaised: boat.sailStep > 0 && boat.sail > 0.05,
      docked: this.world.trade.dockedAt !== null,
      active,
    });
    this.ironsTime = cue.seconds;
    this.compass.classList.toggle('is-upwind', cue.amber);
    this.compass.classList.toggle('wind-pulse', cue.pulse);
    this.windChip.hidden = !cue.chip;
    const label = cue.amber ? t('wind.compassUpwind') : t('wind.compass');
    if (this.windTrigger.getAttribute('aria-label') !== label)
      this.windTrigger.setAttribute('aria-label', label);
    if (cue.chip && !this.seenWindHint) {
      this.hintSeconds = 7;
      this.seenWindHint = true;
      this.windPreferences.markSeen();
    }
    this.hintSeconds = cue.chip ? Math.max(0, this.hintSeconds - dt) : 0;
    this.windHint.hidden = this.hintSeconds <= 0;

    this.sinceText += dt;
    if (this.sinceText > 0.12) {
      this.sinceText = 0;
      this.speed.textContent = formatNumber(boat.speedKn, 1);
      const p = pointOfSail(ship, twa);
      this.pos.textContent = boat.sailStep === 0 ? t('hud.sailsDown') : t(`pos.${p}`);
      this.pos.className = `pos ${POINT_OF_SAIL_TONE[p]}`;
      const step = SAIL_STEPS[boat.sailStep] ?? 0;
      this.pips.forEach((pip, i) => pip.classList.toggle('on', step >= (i + 1) / this.pips.length));
      this.objName.textContent = wp?.label ?? '';
      this.objDist.textContent = wp ? t('unit.metres', { n: Math.round(distance(boat, wp)) }) : '';
      const fromDir = t(
        `compass.${COMPASS[Math.round(wrapPositive(wind.from) / (Math.PI / 4)) % 8]!}`,
      );
      // Name the lee so a sudden drop in speed reads as the island, not a bug (decision 0027).
      const lee = this.world.shelter > 0.25 ? ` · ${t('hud.lee')}` : '';
      this.windText.textContent = `${fromDir} · ${wind.speedKn.toFixed(0)} ${t('unit.knots')}${lee}`;

      document.body.classList.toggle('is-docked', Boolean(this.world.trade.dockedAt));
      // Captain stats & dock button
      const { trade, map } = this.world;
      this.hudGold.textContent = formatNumber(trade.captain.gold);
      this.hudCargo.textContent = `${cargoUsed(trade)} / ${capacity(trade)}`;
      this.hudShip.textContent = shipName(activeShip(trade));
      const hull = Math.round(hullCondition(trade) * 100);
      this.hudHullBox.hidden = hull >= 100;
      this.hudHull.textContent = t('unit.percent', { n: hull });
      this.hudHullBox.classList.toggle('is-low', hull < 50);

      if (trade.dockedAt) {
        this.dockBtn.hidden = false;
        const port = findPort(map, trade.dockedAt);
        this.dockPortName.textContent = port?.name ?? trade.dockedAt;
      } else {
        this.dockBtn.hidden = true;
      }
    }

    this.sincePortLabels += dt;
    if (this.sincePortLabels >= 0.1) {
      this.sincePortLabels = 0;
      this.portLabels.update(project);
    }

    // Arrow at the screen edge when the buoy is off-screen.
    const s = wp ? project(wp.x, wp.y) : null;
    this.wpArrow.hidden = !s || s.onScreen;
    if (s && !s.onScreen) {
      const cx = size.w / 2;
      const cy = size.h / 2;
      const b = project(boat.x, boat.y);
      let dx = s.x - b.x;
      let dy = s.y - b.y;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) [dx, dy] = [0, -1];
      const margin = 34;
      const k = Math.min(
        (cx - margin) / Math.abs(dx || 1e-6),
        (cy - margin - 60) / Math.abs(dy || 1e-6),
      );
      const ang = Math.atan2(dx, -dy);
      this.wpArrow.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px)`;
      (this.wpArrow.firstElementChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.hidden = true;
    }
  }
}
