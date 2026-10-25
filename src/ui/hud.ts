import { knobs } from '../sim/difficulty';
import { trueWindAngle } from '../sim/boat';
import { DEG, bearingTo, distance, wrapPositive } from '../sim/math';
import { type PointOfSail, noGoAngle, pointOfSail } from '../sim/ship';
import { hullCondition } from '../sim/hazards';
import { windForecast } from '../sim/forecast';
import { USUAL_WEATHER, windTo } from '../sim/wind';
import { WIND_FORCES, createWindGauge, updateWindGauge } from '../sim/windStrength';
import { windFeedback } from './windFeedback';
import { PAD, type PadButton, type SeaAction } from '../input/gamepad';
import { padGlyphFor, padSymbol } from './padGlyphs';
import {
  type PressLevel,
  type World,
  type WorldEvent,
  navigationTarget,
  pressLevel,
} from '../sim/world';
import type { ScreenPoint } from '../render/view';

import { GOODS } from '../sim/goods';
import { capacity, cargoUsed, findPort } from '../sim/trade';
import { PortLabels } from './portLabels';
import { type HazardKind, hazardBadge } from './hazardMarker';
import { screenBearing } from './screenBearing';
import { formatNumber, goodName, t, tOptional, weatherName, zoneKindName } from '../i18n';

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

/** Nearest of the eight compass points for a direction in radians, translated. */
function compassPoint(rad: number): string {
  return t(`compass.${compassIndex(rad)}`);
}

/** The same point as words for a sentence: "to the west", "à l'ouest" (decision 0091). */
function compassWords(rad: number): string {
  return t(`compassLong.${compassIndex(rad)}`);
}

function compassIndex(rad: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round(wrapPositive(rad) / (Math.PI / 4)) % 8]!;
}

function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Plain-DOM heads-up display with trading stats and port labels. */
export class Hud {
  private readonly speed = $('speed');
  private readonly heading = $('heading');
  private readonly pos = $('point-of-sail');
  /** Speed over the ground and the current, shown only while in a current (decision 0140). */
  private readonly sogBox = $('log-sog');
  private readonly sog = $('sog');
  private readonly currentText = $('current-text');
  private readonly speedLog = $('speed-log');
  private readonly logToggle = $('log-toggle');
  private readonly lever = $('sail-lever');
  private readonly leverButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#sail-lever button[data-step]'),
  );
  private leverDrag: number | null = null;
  /** Press warning (decision 0078): the sails control turns amber, then red, and the lee edge of
   * the screen glows the same colour. */
  private readonly pressGlow = $('press-glow');
  private press: PressLevel = 0;
  private shownPress: PressLevel | null = null;
  private glowAngle = NaN;
  /** The one-time "ease the sails" message has been shown. */
  seenPressHint = false;
  /** The first current's hint was shown (decision 0140); main.ts keeps it in the settings. */
  seenCurrentHint = false;
  onCurrentHintSeen: () => void = () => {};
  /** The storm belt's one-time hint has shown (decision 0167). */
  seenBeltHint = false;
  onBeltHintSeen: () => void = () => {};
  onPressHintSeen: () => void = () => {};
  /** She just crossed into red: main buzzes the phone and plays a creak. */
  onPressDanger: () => void = () => {};
  private shownSail = -1;
  private readonly objective = $('navigation-target');
  private readonly objArrow = $('obj-arrow');
  private readonly objName = $('obj-name');
  private readonly objDist = $('obj-dist');
  private readonly windText = $('wind-text');
  private readonly weatherText = $('weather-text');
  private readonly forecastText = $('wind-forecast');
  private readonly beltText = $('belt-text');
  private sinceForecast = Infinity;
  private readonly cNoGo = $('c-nogo');
  private readonly cBand = $('c-band');
  private readonly cWind = $('c-wind');
  private readonly cWindScale = $('c-wind-scale');
  private readonly windForceText = $('wind-force');
  private readonly windGust = $('wind-gust');
  private readonly windBars = Array.from(document.querySelectorAll<HTMLElement>('.wind-gauge i'));
  private windGauge = createWindGauge(0);
  private windGaugeInitialized = false;
  private shownForce = -1;
  private shownKids: boolean | null = null;
  /** Kids mode shows the strength as a big plain word and hides the knots. */
  isKidMode = false;
  private readonly cBoat = $('c-boat');
  private readonly cWp = $('c-wp');
  private readonly cMark = $('c-mark');
  /** A place the compass marks the direction of: the prologue's wreck (decision 0127). */
  mark: { x: number; y: number } | null = null;
  /**
   * Where to head when no course is set (decision 0139): the wreck during the prologue, else the
   * tracked quest's place. The objective panel and the edge arrow show it like a course.
   */
  goal: { x: number; y: number; label: string } | null = null;
  private readonly wpArrow = $('wp-arrow');
  private readonly toast = $('toast');
  private readonly tiller = $('tiller');
  private readonly fps = $('fps');

  // Phase 1 persistent stats and docking
  private readonly hudGold = $('hud-gold');
  private readonly hudCargo = $('hud-cargo');
  private readonly hudHull = $('hud-hull');
  private readonly hudHullBox = $('hud-hull-box');
  private readonly hullBar = $('hull-bar');
  private readonly cargoFill = $('hud-cargo-fill');
  private readonly cargoBox = $('hud-cargo-box');
  private readonly cargoTooltip = $('hud-cargo-tooltip');
  private readonly dockBtn = $('dock-btn');
  private readonly dockPortName = $('dock-port-name');
  readonly portLabels: PortLabels;

  onDockClick: () => void = () => {};
  /** The player picked a sail step on the lever (0 = down). */
  onSailStep: (step: number) => void = () => {};
  /** The player showed or folded the speed log. */
  onLogToggle: (shown: boolean) => void = () => {};
  onPortClick: (portId: string) => void = () => {};

  private toastTimer = 0;
  private sinceText = 1;
  private wasVisible = false;
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

    this.seaGlyphs();
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

    this.logToggle.addEventListener('click', () => {
      this.showLog = this.speedLog.classList.contains('is-folded');
      this.onLogToggle(this.showLog);
    });
    this.initLever();
  }

  /** Speed log at the top right (decision 0049): on by default, folds to a small button. */
  set showLog(shown: boolean) {
    this.speedLog.classList.toggle('is-folded', !shown);
    this.logToggle.setAttribute('aria-pressed', String(shown));
    if (shown) this.sinceText = 1;
  }

  get showLog(): boolean {
    return !this.speedLog.classList.contains('is-folded');
  }

  /** Sail lever: tap a notch or drag along it; keyboard users press the notch buttons. */
  private initLever() {
    const track = this.lever.querySelector<HTMLElement>('.lever-track')!;
    const pick = (clientY: number) => {
      let best = this.leverButtons[0]!;
      let bestGap = Infinity;
      for (const b of this.leverButtons) {
        const r = b.getBoundingClientRect();
        const gap = Math.abs(clientY - (r.top + r.height / 2));
        if (gap < bestGap) [best, bestGap] = [b, gap];
      }
      const step = Number(best.dataset.step);
      if (step !== this.shownSail) {
        this.showSail(step);
        this.onSailStep(step);
      }
    };
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      this.leverDrag = e.pointerId;
      track.setPointerCapture?.(e.pointerId);
      pick(e.clientY);
    });
    track.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.leverDrag) pick(e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.leverDrag) this.leverDrag = null;
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    for (const b of this.leverButtons) {
      // Pointer presses are handled above; this catches Enter / Space on a focused notch.
      b.addEventListener('click', (e) => {
        if (e.detail !== 0) return;
        const step = Number(b.dataset.step);
        this.showSail(step);
        this.onSailStep(step);
      });
    }
  }

  private showSail(step: number) {
    if (step === this.shownSail) return;
    this.shownSail = step;
    this.lever.dataset.step = String(step);
    for (const b of this.leverButtons)
      b.setAttribute('aria-pressed', String(Number(b.dataset.step) === step));
  }

  /** Strength gauge under the compass (decision 0040): bars, a word and a short gust cue. */
  private updateWindStrength(dt: number, speedKn: number, visible: boolean) {
    if (!this.windGaugeInitialized) {
      this.windGauge = createWindGauge(speedKn);
      this.windGaugeInitialized = true;
    }
    this.windGauge = updateWindGauge(this.windGauge, speedKn, dt);
    if (!visible) return;
    const { force, gust } = this.windGauge;
    const kids = this.isKidMode;
    if (force !== this.shownForce || kids !== this.shownKids) {
      this.shownForce = force;
      this.shownKids = kids;
      this.compass.dataset.force = String(force);
      this.compass.classList.toggle('is-kids', kids);
      this.windBars.forEach((bar, i) => bar.classList.toggle('on', i <= force));
      this.windForceText.textContent = t(
        `${kids ? 'kidsWind' : 'windForce'}.${WIND_FORCES[force]}`,
      );
      // The arrow grows a little bolder as the wind rises; its length and direction stay.
      this.cWindScale.setAttribute('transform', `scale(${(0.8 + force * 0.12).toFixed(2)} 1)`);
    }
    this.windGust.hidden = gust <= 0;
  }

  /** Press warning (decision 0078): cheap class and custom-property writes, only on change. */
  private updatePress(
    project: (x: number, y: number) => ScreenPoint,
    active: boolean,
    visible: boolean,
  ) {
    const level = active ? pressLevel(this.world, this.press) : 0;
    if (level !== this.press) {
      if (level === 2 && this.press < 2) this.onPressDanger();
      this.press = level;
      if (level > 0 && !this.seenPressHint) {
        this.seenPressHint = true;
        this.onPressHintSeen();
        // On a level that keeps the cargo (Fair winds) the warning is a lesson (decision 0083).
        const hint =
          knobs(this.world.trade.difficulty).cargoLost === 0
            ? 'toast.pressHintFair'
            : 'toast.pressHint';
        this.showToast(t(hint), 5);
      }
    }
    if (!visible) return;
    if (this.shownPress !== level) {
      this.shownPress = level;
      this.lever.dataset.press = String(level);
      this.pressGlow.dataset.press = String(level);
    }
    if (level === 0) return;
    // The glow sits on the lee side, where she leans: the way the wind blows, on screen.
    const { boat, wind } = this.world;
    const to = windTo(wind);
    const lee = { x: boat.x + Math.sin(to), y: boat.y + Math.cos(to) };
    const deg = Math.round(screenBearing(project, boat, lee) / DEG);
    if (!(Math.abs(deg - this.glowAngle) < 2)) {
      this.glowAngle = deg;
      this.pressGlow.style.setProperty('--lee', `${deg}deg`);
    }
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

  /** A step's sound plays (decision 0139): said in words too, for a muted phone, if it has words. */
  stepSound(effect: string, bearing: number) {
    const line = tOptional(`toast.${effect}`, { dir: compassWords(bearing) });
    if (line) this.showToast(line, 3);
  }
  showToast(text: string, seconds = 2.5, hazard?: HazardKind) {
    this.toast.textContent = text;
    // Hazard warnings carry the same badge as the chart (decision 0070).
    if (hazard) this.toast.prepend(hazardBadge(hazard));
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
        this.showToast(
          t(
            e.surface === 'pier'
              ? 'toast.crashPier'
              : e.surface === 'boat'
                ? 'toast.crashBoat'
                : e.surface === 'ice'
                  ? 'toast.crashIce'
                  : 'toast.crash',
            { pct },
          ),
          2.5,
        );
      } else if (e.type === 'storm-near') {
        this.showToast(t('toast.stormNear', { dir: compassWords(e.bearing) }), 4, 'storm');
      } else if (e.type === 'belt-near') {
        if (!this.seenBeltHint) {
          this.seenBeltHint = true;
          this.onBeltHintSeen();
          this.showToast(t('toast.beltHint', { name: zoneName(this.world, e.zone) }), 7, 'storm');
        }
      } else if (e.type === 'overboard') {
        this.showToast(t('toast.overboard', { n: e.qty, good: goodName(e.good).toLowerCase() }), 3);
      } else if (e.type === 'current-charted') {
        const name = this.world.map.currents?.find((c) => c.id === e.id)?.name ?? '';
        if (!this.seenCurrentHint) {
          this.seenCurrentHint = true;
          this.onCurrentHintSeen();
          this.showToast(t('toast.currentHint'), 6);
        } else this.showToast(t('toast.currentCharted', { name }), 3);
      } else if (e.type === 'zone-charted') {
        const zone = this.world.map.windZones?.find((z) => z.id === e.id);
        if (zone?.name)
          this.showToast(
            t('toast.zoneCharted', { name: zone.name, kind: zoneKindName(zone.kind) }),
            3,
          );
      } else if (e.type === 'area-charted') {
        this.showToast(t('toast.areaCharted', { name: e.name }), 3);
      } else if (e.type === 'too-shallow' && this.toastTimer <= 0) {
        this.showToast(t('toast.tooShallow'), 3);
      } else if (e.type === 'bump' && this.toastTimer <= 0) {
        this.showToast(t('toast.bump'), 1.2);
      }
    }
  }

  /** The storm belt near the boat (decision 0167): squalls or a lull there, and for how long. */
  private showBelt() {
    const belt = this.world.belt;
    if (this.beltText.hidden !== !belt) this.beltText.hidden = !belt;
    if (!belt) return;
    // About a minute or two; seconds by tens only in the last minute and a half.
    const s = belt.changeSec;
    const time =
      s >= 90
        ? t('unit.minutes', { n: Math.round(s / 60) })
        : t('unit.seconds', { n: Math.max(10, Math.round(s / 10) * 10) });
    this.beltText.toggleAttribute('data-squalls', belt.squalls);
    // Two short lines, split at the dot, so it fits the compass panel even on a phone.
    const text = t(belt.squalls ? 'hud.beltSqualls' : 'hud.beltLull', {
      name: zoneName(this.world, belt.zone),
      time: time.replace(' ', '\u00a0'),
    });
    // Keep "30 s" and "2 min" on one line.
    if (this.beltText.dataset.text !== text) {
      this.beltText.dataset.text = text;
      this.beltText.replaceChildren(
        ...text.split(' · ').map((line) => {
          const span = document.createElement('span');
          span.textContent = line;
          return span;
        }),
      );
    }
  }

  setTiller(drag: { x: number; y: number; steer: number } | null) {
    this.tiller.hidden = !drag;
    if (!drag) return;
    this.tiller.style.transform = `translate(${drag.x}px, ${drag.y}px)`;
    (this.tiller.firstElementChild as HTMLElement).style.transform =
      `translateX(${drag.steer * 60}px)`;
  }

  setFps(fps: number | null, visible = true) {
    if (!visible) return;
    this.fps.hidden = fps === null;
    if (fps !== null) this.fps.textContent = t('hud.fps', { n: fps.toFixed(0) });
  }

  /** `project` maps sim positions to pixels; `size` is the viewport. `active` controls
   * sailing cues; `visible` controls rendering. Paused instruments can still be visible. */

  /**
   * In a current (decision 0140): SOG under the speed and "Current 1.8 kn E" (where it flows)
   * under the wind. Both go with the log's eye toggle, and away in still water.
   */
  private showCurrent() {
    const { water, sogKn } = this.world;
    const kn = Math.hypot(water.east, water.north);
    const shown = this.showLog && !!water.id && kn >= 0.2;
    this.sogBox.hidden = !shown;
    this.currentText.hidden = !shown;
    if (!shown) return;
    this.sog.textContent = `${formatNumber(sogKn, 1)} ${t('unit.knots')}`;
    this.currentText.textContent = t('hud.current', {
      n: formatNumber(kn, 1),
      dir: compassPoint(Math.atan2(water.east, water.north)),
    });
  }

  /** The weather glass's forecast under the wind (decision 0136), twice a second. */
  private showForecast(dt: number) {
    this.sinceForecast += dt;
    if (this.sinceForecast < 0.5) return;
    this.sinceForecast = 0;
    const f = windForecast(this.world);
    this.forecastText.hidden = !f;
    if (!f) return;
    const minutes = f.aheadSec % 60 === 0;
    const time = t(minutes ? 'unit.minutes' : 'unit.seconds', {
      n: minutes ? f.aheadSec / 60 : Math.round(f.aheadSec),
    });
    const storm = f.storm > 0.15;
    const weather = storm ? 'storm' : f.kind;
    const extra = weather === USUAL_WEATHER ? '' : ` · ${weatherName(weather)}`;
    this.forecastText.toggleAttribute('data-storm', storm);
    this.forecastText.textContent = t('hud.forecast', {
      time,
      dir: compassPoint(f.from),
      kn: f.speedKn.toFixed(0),
      extra,
    });
  }
  update(
    dt: number,
    project: (x: number, y: number) => ScreenPoint,
    size: { w: number; h: number },
    active = true,
    visible = true,
  ) {
    const { boat, wind, ship } = this.world;
    const wp = navigationTarget(this.world) ?? this.goal;
    // Time-dependent cues still advance while the opaque chart or title hides the HUD.
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.hidden = true;
    }
    this.updateWindStrength(dt, wind.speedKn, visible);
    this.updatePress(project, active, visible);
    const twa = trueWindAngle(boat.heading, wind);
    const irons = Math.abs(twa) < noGoAngle(ship);
    const cue = windFeedback(this.ironsTime, dt, {
      inNoGo: irons,
      sailsRaised: boat.sailStep > 0 && boat.sail > 0.05,
      docked: this.world.trade.dockedAt !== null,
      active,
    });
    this.ironsTime = cue.seconds;
    if (cue.chip && !this.seenWindHint) {
      this.hintSeconds = 7;
      this.seenWindHint = true;
      this.windPreferences.markSeen();
    }
    this.hintSeconds = cue.chip ? Math.max(0, this.hintSeconds - dt) : 0;
    const resumed = visible && !this.wasVisible;
    this.wasVisible = visible;
    if (!visible) return;
    if (resumed) this.sinceText = 1;

    // Rotations every frame (cheap attribute writes), text ~8 times a second.
    const rot = (el: HTMLElement, rad: number) =>
      el.setAttribute('transform', `rotate(${(rad / DEG).toFixed(1)})`);
    if (this.noGoAngle !== noGoAngle(ship)) {
      this.noGoAngle = noGoAngle(ship);
      const x = 40 * Math.sin(this.noGoAngle);
      const y = -40 * Math.cos(this.noGoAngle);
      this.cNoGo.firstElementChild!.setAttribute('d', `M0 0 L${-x} ${y} A40 40 0 0 1 ${x} ${y} Z`);
    }
    rot(this.cNoGo, wind.from);
    rot(this.cBand, wind.from);
    rot(this.cWind, windTo(wind));
    rot(this.cBoat, boat.heading);
    this.cWp.style.display = wp ? '' : 'none';
    this.objective.hidden = !wp;
    if (wp) rot(this.cWp, bearingTo(boat, wp));
    this.cMark.style.display = this.mark ? '' : 'none';
    if (this.mark) rot(this.cMark, bearingTo(boat, this.mark));
    const targetAngle = wp ? screenBearing(project, boat, wp) : 0;
    if (wp) this.objArrow.style.transform = `rotate(${targetAngle}rad)`;
    const targetName = wp?.label ?? '';
    if (this.objName.textContent !== targetName) this.objName.textContent = targetName;

    this.compass.classList.toggle('is-upwind', cue.amber);
    this.compass.classList.toggle('wind-pulse', cue.pulse);
    this.windChip.hidden = !cue.chip;
    const label = cue.amber ? t('wind.compassUpwind') : t('wind.compass');
    if (this.windTrigger.getAttribute('aria-label') !== label)
      this.windTrigger.setAttribute('aria-label', label);
    this.windHint.hidden = this.hintSeconds <= 0;

    this.sinceText += dt;
    if (this.sinceText > 0.12) {
      this.sinceText = 0;
      if (this.showLog) {
        this.speed.textContent = formatNumber(boat.speedKn, 1);
        const hdg = Math.round(wrapPositive(boat.heading) / DEG) % 360;
        this.heading.textContent = `${hdg}° ${compassPoint(boat.heading)}`;
        const p = pointOfSail(ship, twa);
        this.pos.textContent = boat.sailStep === 0 ? t('hud.sailsDown') : t(`pos.${p}`);
        this.pos.className = `pos ${boat.sailStep === 0 ? '' : POINT_OF_SAIL_TONE[p]}`;
      }
      this.showCurrent();
      if (this.leverDrag === null) this.showSail(boat.sailStep);
      this.objDist.textContent = wp ? t('unit.metres', { n: Math.round(distance(boat, wp)) }) : '';
      const fromDir = compassPoint(wind.from);
      // Name the lee so a sudden drop in speed reads as the island, not a bug (decision 0027).
      const lee = this.world.shelter > 0.25 ? ` · ${t('hud.lee')}` : '';
      this.windText.textContent = `${fromDir} · ${wind.speedKn.toFixed(0)} ${t('unit.knots')}${lee}`;
      // Weather only shows when it is not a plain breeze, in line with the quiet HUD (0067).
      const { weather } = this.world;
      const kind = weather.storm > 0.15 ? 'storm' : weather.kind;
      this.weatherText.hidden = kind === USUAL_WEATHER;
      if (this.weatherText.dataset.kind !== kind) {
        this.weatherText.dataset.kind = kind;
        this.weatherText.textContent = weatherName(kind);
      }
      this.showForecast(dt);
      this.showBelt();

      document.body.classList.toggle('is-docked', Boolean(this.world.trade.dockedAt));
      // Captain stats & dock button
      const { trade, map } = this.world;
      this.hudGold.textContent = formatNumber(trade.captain.gold);
      const used = cargoUsed(trade);
      const cap = capacity(trade);
      this.hudCargo.textContent = `${used}/${cap}`;
      // The crate icon fills with the hold instead of a bar (decision 0049).
      const fill = 16 * Math.min(1, cap > 0 ? used / cap : 0);
      this.cargoFill.setAttribute('y', (20 - fill).toFixed(1));
      this.cargoFill.setAttribute('height', fill.toFixed(1));
      this.cargoBox.classList.toggle('is-full', used >= cap);
      const hull = Math.round(hullCondition(trade) * 100);
      this.hudHullBox.hidden = hull >= 100;
      this.hudHull.textContent = t('unit.percent', { n: hull });
      this.hudHullBox.classList.toggle('is-low', hull < 50);
      this.hullBar.hidden = hull >= 100;
      this.hullBar.classList.toggle('is-low', hull < 50);
      (this.hullBar.firstElementChild as HTMLElement).style.width = `${hull}%`;

      if (trade.dockedAt) {
        const port = findPort(map, trade.dockedAt);
        this.dockPortName.textContent = port?.name ?? trade.dockedAt;
      }
    }

    if (!this.hullBar.hidden) {
      const b = project(boat.x, boat.y);
      this.hullBar.style.transform = `translate(${b.x.toFixed(0)}px, ${(b.y - 52).toFixed(0)}px)`;
    }

    this.portLabels.update(project, dt, resumed);
    // One Trade button at a time: the port sign's, or this one when the sign is off screen.
    const dockedAt = this.world.trade.dockedAt;
    const showDock = dockedAt !== null && !this.portLabels.dockShown(dockedAt);
    if (this.dockBtn.hidden === showDock) this.dockBtn.hidden = !showDock;

    // Arrow at the screen edge when the buoy is off-screen.
    const s = wp ? project(wp.x, wp.y) : null;
    this.wpArrow.hidden = !s || s.onScreen;
    if (s && !s.onScreen) {
      const cx = size.w / 2;
      const cy = size.h / 2;
      const dx = Math.sin(targetAngle);
      const dy = -Math.cos(targetAngle);
      const margin = 34;
      const k = Math.min(
        (cx - margin) / Math.abs(dx || 1e-6),
        (cy - margin - 60) / Math.abs(dy || 1e-6),
      );
      this.wpArrow.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px)`;
      (this.wpArrow.firstElementChild as HTMLElement).style.transform = `rotate(${targetAngle}rad)`;
    }
  }

  /**
   * The pad's buttons on the sea's own buttons (decision 0199), as console games show them, only
   * while the pad is in use: A on Trade, the bumpers on the sail lever, and View's symbol in place
   * of the Map button's icon (decision 0201). The menu button's icon already is the Menu
   * button's, so it gets none. From `controls.json` › `gamepad.sea`; the D-pad is left out (it is
   * not a button a player looks for).
   */
  private seaGlyphs() {
    const first = (action: SeaAction): PadButton | undefined =>
      PAD.sea.actions[action].find((b) => !['up', 'down', 'left', 'right'].includes(b));
    const put = (id: string, action: SeaAction, where: InsertPosition = 'afterbegin') => {
      const button = first(action);
      if (button) $(id).insertAdjacentHTML(where, padGlyphFor(button));
    };
    put('dock-btn', 'harbour');
    const chart = first('chart');
    if (chart) $('chart-btn').insertAdjacentHTML('afterbegin', padSymbol(chart));
    put('sail-full', 'sailUp', 'beforeend');
    put('sail-none', 'sailDown', 'beforeend');
  }
}

/** A wind zone's name for the HUD, its id when it has none. */
function zoneName(world: World, id: string): string {
  return world.map.windZones?.find((z) => z.id === id)?.name ?? id;
}
