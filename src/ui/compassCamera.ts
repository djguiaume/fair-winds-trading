import { translateDom } from '../i18n';
import './camera.css';

/**
 * The camera's two buttons under the wind compass: a "reset the view" button (decision 0223) shown
 * only while the camera is turned, and the close chase view's switch (decision 0272) for touch. The compass itself no longer turns with the camera: its
 * card turns with the boat, which points up whatever the camera does (issue #441).
 */
export class CompassCamera {
  private readonly reset: HTMLButtonElement;
  private readonly chase: HTMLButtonElement;

  constructor(compass: HTMLElement, onReset: () => void, onChase: () => void) {
    this.reset = this.button('camera-reset', 'hud.cameraReset', onReset);
    this.reset.hidden = true;
    this.reset.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9.5A7 7 0 1 1 5 14.5" />' +
      '<path d="M4.5 4.5v5h5" /></svg>';
    this.chase = this.button('camera-chase', 'hud.cameraChase', onChase);
    this.chase.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l4-9h4l2 4h6l2 5z" />' +
      '<path d="M3 20.5h18" /></svg>';
    compass.append(this.chase, this.reset);
    translateDom(compass);
  }

  private button(id: string, name: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'camera-reset';
    button.type = 'button';
    button.dataset.i18nAttr = `aria-label:${name}`;
    button.addEventListener('click', onClick);
    return button;
  }

  /** The chase view is on: its button shows pressed. */
  setChase(on: boolean) {
    this.chase.setAttribute('aria-pressed', String(on));
  }

  /** `turned`: the camera is away from where it rests. */
  update(turned: boolean) {
    if (this.reset.hidden === turned) this.reset.hidden = !turned;
  }
}
