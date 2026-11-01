import { t } from '../../i18n';
import { DEG } from '../../sim/math';
import { Rotator, setHidden, svgEl } from './parts';

/** Radius of the dial's face, its no-go wedge and the wind arrow's ends, in SVG units. */
const FACE = 57;
const WEDGE = 54;
const ARROW_TAIL = 57;
const ARROW_HEAD = 24;
const LETTER = 41;

const CARDINALS = ['N', 'E', 'S', 'W'] as const;

/**
 * The wind compass dial (Guillaume, round 3 D; issue #441): the boat points up and the card turns
 * with her heading, a thick arrow comes in from where the wind blows, and the no-go zone is a
 * solid hatched wedge each side of it, never red. Built once; a frame only turns groups.
 */
export class WindDial {
  readonly svg: SVGSVGElement;
  private readonly card: SVGGElement;
  private readonly cardTurn: Rotator;
  private readonly letters: SVGTextElement[] = [];
  private readonly wind: Rotator;
  private readonly wedges: SVGPathElement[];
  private readonly course: SVGGElement;
  private readonly courseTurn: Rotator;
  private readonly mark: SVGGElement;
  private readonly markTurn: Rotator;
  private noGoDeg = -1;
  private headingDeg = NaN;

  constructor() {
    this.svg = svgEl('svg', { viewBox: '-60 -60 120 120', 'aria-hidden': 'true' });
    this.svg.classList.add('hud-dial-face');
    const defs = svgEl('defs', {}, this.svg);
    const hatch = svgEl(
      'pattern',
      {
        id: 'hud-nogo-hatch',
        width: 5,
        height: 5,
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)',
      },
      defs,
    );
    svgEl('path', { d: 'M0 0V5', class: 'nogo-line' }, hatch);
    svgEl('circle', { r: FACE, class: 'face' }, this.svg);
    const wind = svgEl('g', {}, this.svg);
    this.wind = new Rotator(wind);
    this.wedges = [
      svgEl('path', { class: 'nogo' }, wind),
      svgEl('path', { class: 'nogo-hatch', fill: 'url(#hud-nogo-hatch)' }, wind),
    ];
    this.card = svgEl('g', { class: 'card' }, this.svg);
    this.cardTurn = new Rotator(this.card);
    svgEl('path', { class: 'ticks', d: ticks(false) }, this.card);
    svgEl('path', { class: 'ticks major', d: ticks(true) }, this.card);
    CARDINALS.forEach((name, i) => {
      const [x, y] = polar(i * 90, LETTER);
      const letter = svgEl('text', { x: x.toFixed(1), y: (y + 5).toFixed(1) }, this.card);
      letter.dataset.i18n = `compass.${name}`;
      letter.textContent = t(`compass.${name}`);
      letter.dataset.x = x.toFixed(1);
      letter.dataset.y = y.toFixed(1);
      this.letters.push(letter);
    });
    this.course = svgEl('g', { class: 'course' }, this.card);
    this.courseTurn = new Rotator(this.course, 1);
    svgEl('circle', { cy: -50, r: 4.5 }, this.course);
    this.mark = svgEl('g', { class: 'mark' }, this.card);
    this.markTurn = new Rotator(this.mark, 1);
    svgEl('path', { d: 'M0 -55L5 -48L0 -41L-5 -48Z' }, this.mark);
    svgEl('path', { class: 'lubber', d: 'M0 -53L5 -60H-5Z' }, this.svg);
    const hull = 'M0 -19C5 -14 7 -7 7 0V14C7 17 4 20 0 20S-7 17 -7 14V0C-7 -7 -5 -14 0 -19Z';
    svgEl('path', { class: 'boat-under', d: hull }, this.svg);
    svgEl('path', { class: 'boat', d: hull }, this.svg);
    const arrow = `M0 ${-ARROW_TAIL}V${-ARROW_HEAD - 8}`;
    svgEl('path', { class: 'arrow-under', d: arrow }, wind);
    svgEl('path', { class: 'arrow', d: arrow }, wind);
    svgEl('path', { class: 'arrow-head', d: `M0 ${-ARROW_HEAD}L-8 ${-ARROW_HEAD - 12}H8Z` }, wind);
  }

  /**
   * Radians throughout: `heading` hers, `windFrom` where it blows from, `noGo` each side of it;
   * `course` and `mark` are bearings to her course and to a quest's place, or null.
   */
  update(
    heading: number,
    windFrom: number,
    noGo: number,
    course: number | null,
    mark: number | null,
  ) {
    const deg = Math.round(heading / DEG / 0.5) * 0.5;
    if (deg !== this.headingDeg) {
      this.headingDeg = deg;
      this.cardTurn.set(-deg);
      // The letters ride the card but stay upright.
      for (const letter of this.letters)
        letter.setAttribute('transform', `rotate(${deg} ${letter.dataset.x} ${letter.dataset.y})`);
    }
    const noGoDeg = Math.round(noGo / DEG);
    if (noGoDeg !== this.noGoDeg) {
      this.noGoDeg = noGoDeg;
      const d = wedge(noGoDeg);
      for (const path of this.wedges) path.setAttribute('d', d);
    }
    this.wind.set((windFrom - heading) / DEG);
    setHidden(this.course, course === null);
    if (course !== null) this.courseTurn.set(course / DEG);
    setHidden(this.mark, mark === null);
    if (mark !== null) this.markTurn.set(mark / DEG);
  }
}

/** A point on the dial: `deg` clockwise from the top, `r` out from the middle. */
function polar(deg: number, r: number): [number, number] {
  return [Math.sin(deg * DEG) * r, -Math.cos(deg * DEG) * r];
}

/** The card's ticks every 10°, or only the four long ones at the cardinal points. */
function ticks(major: boolean): string {
  let d = '';
  for (let b = 0; b < 360; b += 10) {
    if (major !== (b % 90 === 0)) continue;
    const [x0, y0] = polar(b, WEDGE);
    const [x1, y1] = polar(b, major ? 47 : b % 30 === 0 ? 49.5 : 51);
    d += `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

/** The no-go wedge, `deg` each side of straight up. */
function wedge(deg: number): string {
  const [x, y] = polar(deg, WEDGE);
  return `M0 0L${(-x).toFixed(2)} ${y.toFixed(2)}A${WEDGE} ${WEDGE} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}
