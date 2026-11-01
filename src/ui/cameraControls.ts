import { translateDom } from '../i18n';
import type { Input } from '../input/input';
import type { SeaPad } from '../input/gamepad';
import type { CameraOrbit } from '../render/cameraOrbit';
import { TUNING } from '../data/tuning';
import type { ChaseView } from '../render/chaseView';
import type { CameraRig } from '../render/cameraRig';
import type { SeaMotion } from '../render/seaMotion';
import { CompassCamera } from './compassCamera';
import type { Settings } from './settings';

/**
 * The player's hold on the sea camera (decision 0223): zoom and turns from the mouse, touch and
 * controller, the Settings switches' effect on it ("Turn the camera", "Camera comes back by itself",
 * and the comfort ones of decision 0250: gentle sea motion, camera riding the waves) and the HUD
 * compass that turns with the camera. `tilt` (degrees, `?perf&tilt=`) holds a tilt to measure.
 */
export class CameraControls {
  private readonly compass: CompassCamera;
  private readonly orbit: CameraOrbit;
  private readonly rig: CameraRig;
  private readonly motion: SeaMotion;
  private readonly chase: ChaseView;

  constructor(
    view: { rig: CameraRig; motion: SeaMotion },
    input: Input,
    private readonly settings: Settings,
    tilt = 0,
  ) {
    const rig = (this.rig = view.rig);
    this.motion = view.motion;
    const orbit = (this.orbit = rig.orbit);
    if (tilt) orbit.set(0, tilt);
    const chase = (this.chase = rig.chase);
    input.onZoom = (f) => (chase.active ? chase.zoomBy(f) : rig.setZoom(rig.zoom * f));
    input.onPinch = (f) => {
      if (!chase.pinch(f, rig.zoom <= TUNING.camera.zoomMin)) input.onZoom(f);
    };
    // The chase view follows the boat, so the player's turning waits until it is off.
    input.onCameraTurn = (dx, dy, device) => chase.active || orbit.drag(dx, dy, device);
    input.onCameraReset = () => orbit.reset();
    input.onCameraChase = () => chase.toggle();
    this.compass = new CompassCamera(document.getElementById('wind-compass')!, () => orbit.reset());
    this.sync();
    // The help card's mouse and controller lines name the camera's inputs too.
    const help = document.querySelector('.help-controls')!;
    const hint = (line: string, key: string, label = 'help.keyView') =>
      help
        .querySelector(line)!
        .insertAdjacentHTML('beforeend', ` · ${key} <span data-i18n="${label}"></span>`);
    hint('.keys', '<kbd data-i18n="help.rightDrag"></kbd>');
    hint('.keys', '<kbd>C</kbd>', 'help.keyChase');
    hint('.pad', '<kbd>R</kbd>');
    hint('.pad', '<kbd>R</kbd>', 'help.keyChase');
    translateDom(help);
  }

  /** The controller's zoom, turn and reset this frame. */
  pad(sea: SeaPad) {
    if (sea.zoom !== 1) this.rig.setZoom(this.rig.zoom * sea.zoom);
    if (!this.chase.active) this.orbit.turn(sea.turn);
    if (sea.resetCamera) this.pressCameraButton();
  }

  /**
   * The pad's one camera button (right stick in): back north-up when the camera is turned,
   * otherwise it switches the close chase view.
   */
  private pressCameraButton() {
    if (this.orbit.turned && !this.chase.active) this.orbit.reset();
    else this.chase.toggle();
  }

  /** Every frame: the compass follows the camera. */
  update() {
    this.compass.update(this.rig.viewHeading, this.orbit.turned && !this.chase.active);
  }

  /** Pushes the Settings switches to the camera and the sea motion. */
  sync() {
    this.orbit.enabled = this.settings.turnCamera;
    this.orbit.autoReturn = this.settings.cameraReturns;
    this.motion.gentle = this.settings.gentleMotion;
    this.motion.cameraBob = this.settings.cameraBob;
  }
}
