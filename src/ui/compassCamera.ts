import { translateDom } from '../i18n';
import './camera.css';

/**
 * The turned camera's way back (decision 0223): a "reset the view" button under the wind compass,
 * shown only while the camera is turned. The compass itself no longer turns with the camera: its
 * card turns with the boat, which points up whatever the camera does (issue #441).
 */
export class CompassCamera {
  private readonly reset: HTMLButtonElement;

  constructor(compass: HTMLElement, onReset: () => void) {
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

  /** `turned`: the camera is away from where it rests. */
  update(turned: boolean) {
    if (this.reset.hidden === turned) this.reset.hidden = !turned;
  }
}
