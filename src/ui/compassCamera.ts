import { translateDom } from '../i18n';
import { DEG } from '../sim/math';
import './camera.css';

/** The rose is turned again only once the camera has turned this far (degrees). */
const STEP_DEG = 0.5;
const SVG = 'http://www.w3.org/2000/svg';

/**
 * The HUD compass turns with the camera (decision 0223): its rose (wind, no-go zone, boat, course
 * marks and the N E S W letters) is drawn for the map, so it turns by the camera's heading and the
 * top of the compass stays the top of the screen. The letters turn back so they stay upright. The
 * "reset the view" button beside it shows only while the camera is turned.
 */
export class CompassCamera {
  private readonly rose: SVGGElement;
  private readonly letters: SVGTextElement[];
  private readonly reset: HTMLButtonElement;
  private shownDeg = 0;

  constructor(compass: HTMLElement, onReset: () => void) {
    // Everything on the face but the face itself turns.
    const svg = compass.querySelector('svg')!;
    this.rose = document.createElementNS(SVG, 'g');
    this.rose.id = 'c-rose';
    this.rose.append(...[...svg.children].filter((c) => !c.classList.contains('face')));
    svg.append(this.rose);
    this.letters = [...this.rose.querySelectorAll<SVGTextElement>('text')];
    this.reset = document.createElement('button');
    this.reset.id = 'camera-reset';
    this.reset.className = 'camera-reset';
    this.reset.type = 'button';
    this.reset.hidden = true;
    this.reset.dataset.i18nAttr = 'aria-label:hud.cameraReset';
    this.reset.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9.5A7 7 0 1 1 5 14.5" />' +
      '<path d="M4.5 4.5v5h5" /></svg>';
    this.reset.addEventListener('click', onReset);
    compass.append(this.reset);
    translateDom(compass);
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
