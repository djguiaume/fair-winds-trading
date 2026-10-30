import { translateDom } from '../i18n';
import type { Input } from '../input/input';
import type { SeaPad } from '../input/gamepad';
import type { CameraOrbit } from '../render/cameraOrbit';
import type { CameraRig } from '../render/cameraRig';
import type { SeaMotion } from '../render/seaMotion';
import { CompassCamera } from './compassCamera';
import type { Settings } from './settings';

/** The Settings switches, built after "Day and night": id, setting, name and note keys. */
const SWITCHES = [
  ['turn-camera', 'turnCamera', 'settings.turnCamera', 'settings.turnCameraNote'],
  ['camera-returns', 'cameraReturns', 'settings.cameraReturns', 'settings.cameraReturnsNote'],
  ['gentle-motion', 'gentleMotion', 'settings.gentleMotion', 'settings.gentleMotionNote'],
  ['camera-bob', 'cameraBob', 'settings.cameraBob', 'settings.cameraBobNote'],
] as const;

/**
 * The player's hold on the sea camera (decision 0223): zoom and turns from the mouse, touch and
 * controller, the Settings switches ("Turn the camera", "Camera comes back by itself", and the
 * comfort ones of decision 0250: gentle sea motion, camera riding the waves) and the HUD compass
 * that turns with the camera. `tilt` (degrees, `?perf&tilt=`) holds a tilt to measure.
 */
export class CameraControls {
  private readonly compass: CompassCamera;
  private readonly orbit: CameraOrbit;
  private readonly rig: CameraRig;
  private readonly motion: SeaMotion;

  constructor(
    view: { rig: CameraRig; motion: SeaMotion },
    input: Input,
    private readonly settings: Settings,
    keep: () => void,
    tilt = 0,
  ) {
    const rig = (this.rig = view.rig);
    this.motion = view.motion;
    const orbit = (this.orbit = rig.orbit);
    if (tilt) orbit.set(0, tilt);
    input.onZoom = (f) => rig.setZoom(rig.zoom * f);
    input.onCameraTurn = (dx, dy, device) => orbit.drag(dx, dy, device);
    input.onCameraReset = () => orbit.reset();
    this.compass = new CompassCamera(document.getElementById('wind-compass')!, () => orbit.reset());
    let after = document.getElementById('day-night')!.closest('.set-row')!;
    for (const [id, key, name, note] of SWITCHES) {
      const row = document.createElement('label');
      row.className = 'set-row';
      row.innerHTML =
        `<span class="set-name"><span data-i18n="${name}"></span><small data-i18n="${note}">` +
        `</small></span><input type="checkbox" id="${id}" class="switch" role="switch" />`;
      translateDom(row);
      after.after(row);
      after = row;
      const box = row.querySelector('input')!;
      box.checked = settings[key];
      box.addEventListener('change', () => {
        settings[key] = box.checked;
        this.sync();
        keep();
      });
    }
    this.sync();
    // The help card's mouse and controller lines name the camera's inputs too.
    const help = document.querySelector('.help-controls')!;
    const hint = (line: string, key: string) =>
      help
        .querySelector(line)!
        .insertAdjacentHTML('beforeend', ` · ${key} <span data-i18n="help.keyView"></span>`);
    hint('.keys', '<kbd data-i18n="help.rightDrag"></kbd>');
    hint('.pad', '<kbd>R</kbd>');
    translateDom(help);
  }

  /** The controller's zoom, turn and reset this frame. */
  pad(sea: SeaPad) {
    if (sea.zoom !== 1) this.rig.setZoom(this.rig.zoom * sea.zoom);
    this.orbit.turn(sea.turn);
    if (sea.resetCamera) this.orbit.reset();
  }

  /** Every frame: the compass follows the camera. */
  update() {
    this.compass.update(this.orbit.heading, this.orbit.turned);
  }

  private sync() {
    this.orbit.enabled = this.settings.turnCamera;
    this.orbit.autoReturn = this.settings.cameraReturns;
    this.motion.gentle = this.settings.gentleMotion;
    this.motion.cameraBob = this.settings.cameraBob;
    const returns = document.getElementById('camera-returns') as HTMLInputElement;
    returns.disabled = !this.settings.turnCamera;
  }
}
