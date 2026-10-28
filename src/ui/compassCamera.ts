import { DEG } from '../sim/math';

/** The rose is turned again only once the camera has turned this far (degrees). */
const STEP_DEG = 0.5;

/**
 * The HUD compass turns with the camera (decision 0223): its rose (wind, no-go zone, boat, course
 * marks and the N E S W letters) is drawn for the map, so it turns by the camera's heading and the
 * top of the compass stays the top of the screen. The letters turn back so they stay upright. The
 * "reset the view" button beside it shows only while the camera is turned.
 */
export class CompassCamera {
  private readonly rose: Element;
  private readonly letters: SVGTextElement[];
  private readonly reset: HTMLButtonElement;
  private shownDeg = 0;

  constructor(root: ParentNode, onReset: () => void) {
    this.rose = root.querySelector('#c-rose')!;
    this.letters = [...this.rose.querySelectorAll<SVGTextElement>('text')];
    this.reset = root.querySelector<HTMLButtonElement>('#camera-reset')!;
    this.reset.addEventListener('click', onReset);
  }

  /** `heading`: the bearing the camera looks toward (radians); `turned`: away from north-up. */
  update(heading: number, turned: boolean) {
    if (this.reset.hidden === turned) this.reset.hidden = !turned;
    const deg = Math.round(heading / DEG / STEP_DEG) * STEP_DEG;
    if (deg === this.shownDeg) return;
    this.shownDeg = deg;
    this.rose.setAttribute('transform', deg ? `rotate(${-deg})` : '');
    for (const letter of this.letters) letter.style.transform = deg ? `rotate(${deg}deg)` : '';
  }
}
