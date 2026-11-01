import { formatNumber } from '../../i18n';
import { PAD, type PadButton, type SeaAction } from '../../input/gamepad';
import type { PressLevel } from '../../sim/world';
import { el } from '../components/dom';
import { padGlyphFor } from '../padGlyphs';
import { compassPoint, degrees, label, labelAttrs, setHidden, setText } from './parts';
import './instrument.css';

/** The sail steps, left to right as on the mockup: Down, Half, Full. */
const STEPS = [
  { step: 0, id: 'sail-none', key: 'hud.sailNone' },
  { step: 1, id: 'sail-half', key: 'hud.sailHalf' },
  { step: 2, id: 'sail-full', key: 'hud.sailFull' },
] as const;

/** The first pad button of a sea action, leaving out the D-pad (not a button a player looks for). */
function padButton(action: SeaAction): PadButton | undefined {
  return PAD.sea.actions[action].find((b) => !['up', 'down', 'left', 'right'].includes(b));
}

/**
 * Bottom right (issue #441): the speed in knots, the biggest number on screen, her heading, the
 * speed over the ground in a current, and the sails as Down, Half and Full between the pad's
 * sail buttons. Always on its faint ink backing, so it never sits over land unbacked. The sails
 * turn amber, then red, as the wind presses her too hard (decision 0078).
 */
export class Instrument {
  readonly root = el('div', 'hud-instr hud-backed hud-halo');
  /** The sails control, `#sail-lever` as before (the lessons' coach marks point at it). */
  readonly sails = el('div', 'hud-sails');
  readonly buttons: HTMLButtonElement[];
  readonly sog = el('span', '');
  readonly sogLine = el('span', 'hud-sog');
  private readonly speed = el('span', 'hud-speed-n');
  private readonly heading = el('span', '');
  private shownStep = -1;
  private shownPress: PressLevel | null = null;
  private drag: number | null = null;
  /** The player picked a sail step (0 = down). */
  onStep: (step: number) => void = () => {};

  constructor() {
    this.speed.id = 'speed';
    this.heading.id = 'heading';
    this.sog.id = 'sog';
    this.sogLine.id = 'log-sog';
    this.sogLine.hidden = true;
    const speed = el('div', 'hud-speed');
    speed.append(this.speed, label(el('small', ''), 'unit.knots'));
    const heading = el('div', 'hud-hdg');
    heading.append(label(el('small', ''), 'hud.heading'), ' ', this.heading);
    this.sogLine.append(label(el('small', ''), 'hud.sog'), ' ', this.sog);
    this.sails.id = 'sail-lever';
    this.sails.setAttribute('role', 'group');
    labelAttrs(this.sails, { 'aria-label': 'hud.sails' });
    this.buttons = STEPS.map(({ step, id, key }) => {
      const b = el('button', 'hud-sail');
      b.id = id;
      b.type = 'button';
      b.dataset.step = String(step);
      b.setAttribute('aria-pressed', 'false');
      b.append(label(el('span', ''), key));
      return b;
    });
    const down = padButton('sailDown');
    const up = padButton('sailUp');
    if (down) this.sails.insertAdjacentHTML('beforeend', padGlyphFor(down));
    this.sails.append(...this.buttons);
    if (up) this.sails.insertAdjacentHTML('beforeend', padGlyphFor(up));
    this.root.append(speed, heading, this.sogLine, this.sails);
    this.initDrag();
  }

  /** Tap a step or slide along them; keyboard players press the step buttons. */
  private initDrag() {
    const pick = (clientX: number) => {
      let best = this.buttons[0]!;
      let bestGap = Infinity;
      for (const b of this.buttons) {
        const r = b.getBoundingClientRect();
        const gap = Math.abs(clientX - (r.left + r.width / 2));
        if (gap < bestGap) [best, bestGap] = [b, gap];
      }
      this.choose(Number(best.dataset.step));
    };
    this.sails.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!(e.target as Element).closest('.hud-sail')) return;
      e.preventDefault();
      this.drag = e.pointerId;
      this.sails.setPointerCapture?.(e.pointerId);
      pick(e.clientX);
    });
    this.sails.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.drag) pick(e.clientX);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.drag) this.drag = null;
    };
    this.sails.addEventListener('pointerup', release);
    this.sails.addEventListener('pointercancel', release);
    for (const b of this.buttons) {
      // Pointer presses are handled above; this catches Enter and Space on a focused step.
      b.addEventListener('click', (e) => {
        if (e.detail === 0) this.choose(Number(b.dataset.step));
      });
    }
  }

  private choose(step: number) {
    if (step === this.shownStep) return;
    this.showStep(step);
    this.onStep(step);
  }

  private showStep(step: number) {
    if (step === this.shownStep) return;
    this.shownStep = step;
    this.sails.dataset.step = String(step);
    for (const b of this.buttons)
      b.setAttribute('aria-pressed', String(Number(b.dataset.step) === step));
  }

  /** About eight times a second. The sails follow the boat unless the player is sliding them. */
  showText(speedKn: number, heading: number, sailStep: number) {
    setText(this.speed, formatNumber(speedKn, 1));
    setText(this.heading, `${degrees(heading)}° ${compassPoint(heading)}`);
    if (this.drag === null) this.showStep(sailStep);
  }

  /** In a current (decision 0140): her speed over the ground; `null` hides it. */
  showSog(text: string | null) {
    setHidden(this.sogLine, text === null);
    if (text !== null) setText(this.sog, text);
  }

  /** The press warning on the sails (decision 0078), written only on a change. */
  showPress(level: PressLevel) {
    if (level === this.shownPress) return;
    this.shownPress = level;
    this.sails.dataset.press = String(level);
  }
}
