import { t } from '../../i18n';
import { el } from '../components/dom';
import { WIND_FORCES, createWindGauge, updateWindGauge } from '../../sim/windStrength';
import type { PointOfSail } from '../../sim/ship';
import { WindCue } from '../windFeedback';
import { WindDial } from './windDial';
import { WindLines } from './windLines';
import { compassPoint, label, labelAttrs, setHidden, setText } from './parts';
import type { World } from '../../sim/world';
import './compass.css';

/** What the compass needs from the boat this frame (radians), passed in fields, not objects. */
export interface WindFrame {
  heading: number;
  windFrom: number;
  noGo: number;
  course: number | null;
  mark: number | null;
}

/**
 * Top right (Guillaume's must, issue #441): the wind compass on its own dial with the point of
 * sail and the breeze beside it, and under them the weather's lines. Tapping the dial opens the
 * sailing tips; a boat held in the wind turns it amber, then pulses, then offers the help chip.
 */
export class WindCompass {
  readonly root = el('div', 'hud-wind');
  /** The dial, a button that opens the sailing tips (`#wind-help`). */
  readonly trigger = el('button', 'hud-dial');
  readonly chip = label(el('button', 'hud-chip'), 'wind.chip');
  readonly hint = el('div', 'hud-hint');
  readonly hintClose = el('button', 'hud-hint-close', '×');
  readonly dial = new WindDial();
  readonly cue = new WindCue();
  private readonly pos = el('b', 'hud-pos');
  private readonly breeze = el('span', 'hud-breeze-text');
  private readonly gust = label(el('span', 'hud-gust'), 'wind.gust');
  /** The lines under the breeze; `SeaLines` adds the current and the waves to them. */
  readonly lines = el('span', 'hud-lines');
  private readonly windLines: WindLines;
  private gauge = createWindGauge(0);
  private gaugeReady = false;
  /** Kids mode says the strength as a plain word and hides the knots. */
  isKidMode = false;

  constructor() {
    this.root.id = 'wind-compass';
    this.pos.id = 'point-of-sail';
    this.breeze.id = 'wind-text';
    this.gust.id = 'wind-gust';
    const weather = this.line('weather-text');
    const forecast = this.line('wind-forecast');
    const belt = this.line('belt-text');
    this.windLines = new WindLines(weather, forecast, belt);
    const breeze = el('span', 'hud-breeze');
    breeze.append(this.breeze, this.gust);
    this.gust.hidden = true;
    this.chip.id = 'upwind-chip';
    this.chip.type = 'button';
    this.chip.setAttribute('aria-haspopup', 'dialog');
    this.chip.setAttribute('aria-controls', 'wind-help');
    this.chip.hidden = true;
    this.hint.id = 'wind-first-hint';
    this.hint.hidden = true;
    this.hintClose.id = 'dismiss-wind-hint';
    this.hintClose.type = 'button';
    labelAttrs(this.hintClose, { 'aria-label': 'wind.dismissHint' });
    this.hint.append(label(el('span', ''), 'wind.hint'), this.hintClose);
    const text = el('div', 'hud-wind-text hud-halo');
    text.append(this.pos, breeze, this.lines, this.chip, this.hint);
    this.trigger.id = 'wind-help-trigger';
    this.trigger.type = 'button';
    this.trigger.setAttribute('aria-haspopup', 'dialog');
    this.trigger.setAttribute('aria-controls', 'wind-help');
    labelAttrs(this.trigger, { 'aria-label': 'wind.compass' });
    this.trigger.append(this.dial.svg);
    this.root.append(text, this.trigger);
  }

  private line(id: string): HTMLElement {
    const line = el('span', 'hud-line');
    line.id = id;
    line.hidden = true;
    this.lines.append(line);
    return line;
  }

  /** Every frame: the strength gauge keeps time even while the HUD is hidden. */
  tick(dt: number, windKn: number) {
    if (!this.gaugeReady) {
      this.gauge = createWindGauge(windKn);
      this.gaugeReady = true;
    }
    updateWindGauge(this.gauge, windKn, dt);
  }

  /** Every visible frame: the dial and the cue's classes. */
  update(f: WindFrame, hintShown: boolean) {
    this.dial.update(f.heading, f.windFrom, f.noGo, f.course, f.mark);
    const { cue } = this;
    this.root.classList.toggle('is-upwind', cue.amber);
    this.root.classList.toggle('wind-pulse', cue.pulse);
    setHidden(this.chip, !cue.chip);
    setHidden(this.gust, this.gauge.gust <= 0);
    setHidden(this.hint, !hintShown);
    const label = cue.amber ? t('wind.compassUpwind') : t('wind.compass');
    if (this.trigger.getAttribute('aria-label') !== label)
      this.trigger.setAttribute('aria-label', label);
  }

  /** About eight times a second: the words. `point` is null with the sails down. */
  showText(world: World, point: PointOfSail | null, lee: boolean, dt: number) {
    setText(this.pos, point ? t(`pos.${point}`) : t('hud.sailsDown'));
    this.pos.dataset.point = point ?? 'down';
    const { force } = this.gauge;
    this.root.dataset.force = String(force);
    const word = t(`${this.isKidMode ? 'kidsWind' : 'windForce'}.${WIND_FORCES[force]}`);
    const { wind } = world;
    const breeze = this.isKidMode
      ? word
      : t('hud.breeze', { force: word, dir: compassPoint(wind.from), kn: wind.speedKn.toFixed(0) });
    // Name the lee so a sudden drop in speed reads as the island, not a bug (decision 0027).
    setText(this.breeze, lee ? `${breeze} · ${t('hud.lee')}` : breeze);
    this.windLines.show(world, dt);
  }
}
