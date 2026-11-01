import { t } from '../../i18n';
import { el } from '../components/dom';
import { icon } from '../icons';
import { DEG } from '../../sim/math';
import { label, labelAttrs, setHidden, setText, svgEl } from './parts';

/** The tape's drawn width in SVG units; CSS scales it for a phone. */
const WIDTH = 420;
const HEIGHT = 34;
const NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** A race's or a timed run's clock in the strip (decisions 0213 and 0217). */
export interface StripClock {
  text: string;
  /** Near the par: the clock turns to the warning ink. */
  close: boolean;
}

/**
 * Top centre (issue #441): a compass tape round her heading with the course marked on it, and
 * under it the course ("Saltmere 37 m"), a race's or a run's clock and the race's give-up button.
 * The tape is drawn once, wide enough to wrap; a turn only slides it.
 */
export class HeadingStrip {
  readonly root = el('div', 'hud-strip hud-halo');
  /** The course line under the tape, `#navigation-target` as before. */
  readonly target = el('div', 'hud-target');
  readonly retire = el('button', 'hud-retire', '×');
  readonly name = el('b', 'hud-target-name');
  private readonly distance = el('span', 'hud-target-dist');
  private readonly clock = el('span', 'hud-clock');
  private readonly clockText = el('b', '');
  private readonly tape: SVGGElement;
  private readonly dest: SVGPathElement;
  private readonly pxPerDeg: number;
  private shownHeading = NaN;
  private shownDest = NaN;

  constructor(private readonly spanDeg: number) {
    this.pxPerDeg = WIDTH / (spanDeg * 2);
    const svg = svgEl('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, 'aria-hidden': 'true' });
    svg.classList.add('hud-tape');
    this.tape = svgEl('g', {}, svg);
    this.drawTape();
    this.dest = svgEl('path', { class: 'dest', d: 'M-7 32h14l-7-9z' }, svg);
    svgEl('path', { class: 'lubber', d: `M${WIDTH / 2 - 7} 0h14l-7 8z` }, svg);
    this.target.id = 'navigation-target';
    this.target.hidden = true;
    this.name.id = 'obj-name';
    this.distance.id = 'obj-dist';
    this.clock.id = 'obj-clock';
    this.clock.hidden = true;
    this.clock.innerHTML = icon('clock');
    this.clock.append(this.clockText);
    this.retire.id = 'obj-retire';
    this.retire.type = 'button';
    this.retire.hidden = true;
    labelAttrs(this.retire, { 'aria-label': 'regatta.retire', title: 'regatta.retire' });
    const bearing = label(el('span', 'sr-only'), 'hud.bearingTo');
    this.target.insertAdjacentHTML('afterbegin', icon('anchor'));
    this.target.append(bearing, this.name, this.distance, this.clock, this.retire);
    this.root.append(svg, this.target);
  }

  /** Ticks every 5°, longer at 15°, the points' names at 45°, over 360° plus a span each side. */
  private drawTape() {
    let ticks = '';
    let majors = '';
    const from = -this.spanDeg - 5;
    for (let d = Math.ceil(from / 5) * 5; d <= 360 + this.spanDeg + 5; d += 5) {
      const x = (d * this.pxPerDeg).toFixed(1);
      const b = ((d % 360) + 360) % 360;
      if (b % 45 === 0) {
        majors += `M${x} 20V32`;
        const name = svgEl('text', { x, y: 15, class: 'card' }, this.tape);
        const key = `compass.${NAMES[b / 45]!}` as const;
        name.dataset.i18n = key;
        name.textContent = t(key);
      } else {
        ticks += `M${x} ${b % 15 === 0 ? 24 : 27}V32`;
        if (b % 15 === 0)
          svgEl('text', { x, y: 17, class: 'num' }, this.tape).textContent = String(b);
      }
    }
    // Each tick twice: a wider ink line under the light one, the tape's 1 px halo.
    this.tape.prepend(
      svgEl('path', { class: 'tick-under', d: ticks }),
      svgEl('path', { class: 'tick-under major', d: majors }),
      svgEl('path', { class: 'tick', d: ticks }),
      svgEl('path', { class: 'tick major', d: majors }),
    );
  }

  /** Every visible frame: `heading` hers and `course` the bearing to her course, in radians. */
  update(heading: number, course: number | null) {
    const deg = Math.round(((((heading / DEG) % 360) + 360) % 360) * 4) / 4;
    if (deg !== this.shownHeading) {
      this.shownHeading = deg;
      this.tape.setAttribute(
        'transform',
        `translate(${(WIDTH / 2 - deg * this.pxPerDeg).toFixed(1)} 0)`,
      );
    }
    setHidden(this.dest, course === null);
    if (course === null) return;
    // Off the tape, the mark waits at its edge on the side to turn to.
    const off = ((((course / DEG - deg) % 360) + 540) % 360) - 180;
    const clamped = Math.max(-this.spanDeg, Math.min(this.spanDeg, Math.round(off)));
    if (clamped === this.shownDest) return;
    this.shownDest = clamped;
    this.dest.setAttribute(
      'transform',
      `translate(${(WIDTH / 2 + clamped * this.pxPerDeg).toFixed(1)} 0)`,
    );
    this.dest.classList.toggle('is-off', Math.abs(off) > this.spanDeg);
  }

  /** Every visible frame, so a new course shows at once: its name, and the race's × while racing. */
  showName(name: string, racing: boolean) {
    setHidden(this.target, !name && this.clock.hidden === true);
    setText(this.name, name);
    setHidden(this.retire, !racing);
    if (this.target.classList.contains('is-race') !== racing)
      this.target.classList.toggle('is-race', racing);
  }

  /** About eight times a second: the distance, and a race's or a run's clock if one runs. */
  showDetail(distance: string, clock: StripClock | null) {
    setText(this.distance, distance);
    setHidden(this.clock, !clock);
    if (!clock) return;
    setText(this.clockText, clock.text);
    this.clock.classList.toggle('is-close', clock.close);
  }
}
