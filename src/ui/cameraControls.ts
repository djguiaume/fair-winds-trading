import type { Input } from '../input/input';
import type { SeaPad } from '../input/gamepad';
import type { CameraOrbit } from '../render/cameraOrbit';
import { TUNING } from '../data/tuning';
import type { ChaseView } from '../render/chaseView';
import type { CameraRig } from '../render/cameraRig';
import type { SeaMotion } from '../render/seaMotion';
import { CompassCamera } from './compassCamera';
import type { Hud } from './hud';
import { type Settings, saveSettings } from './settings';

/**
 * The player's hold on the sea camera (decision 0223): zoom and turns from the mouse, touch and
 * controller, the Settings switches' effect on it ("Turn the camera", "Camera comes back by itself",
 * and the comfort ones of decision 0250: gentle sea motion, camera riding the waves) and the HUD
 * compass that turns with the camera, and the remembered sailing view (issue #535). `start` holds a tilt to measure (degrees, `?perf&tilt=`) or
 * starts in the chase view (`?perf&chase=1`).
 */
export class CameraControls {
  private readonly compass: CompassCamera;
  private readonly orbit: CameraOrbit;
  private readonly rig: CameraRig;
  private readonly motion: SeaMotion;
  private readonly chase: ChaseView;
  private quiet = false;
  /** The view last written to the settings, so a switch from any input is saved once. */
  private savedBehind: boolean;
  /** A measuring run (`?perf&chase=1`) must not change the player's saved view. */
  private readonly remember: boolean;

  constructor(
    view: { rig: CameraRig; motion: SeaMotion },
    input: Input,
    private readonly settings: Settings,
    private readonly hud: Hud,
    start: { tilt: number; chase: boolean } = { tilt: 0, chase: false },
  ) {
    const rig = (this.rig = view.rig);
    this.motion = view.motion;
    const orbit = (this.orbit = rig.orbit);
    if (start.tilt) orbit.set(0, start.tilt);
    const chase = (this.chase = rig.chase);
    this.savedBehind = settings.sailingView === 'behind';
    chase.active = this.savedBehind || start.chase;
    this.remember = !start.chase;
    // Any key, touch or stick wakes the faded view and sea buttons (art bible section 13).
    input.onActivity = () => hud.wakeControls();
    input.onZoom = (f) => (chase.active ? chase.zoomBy(f) : rig.setZoom(rig.zoom * f));
    input.onPinch = (f) => {
      if (!chase.pinch(f, rig.zoom <= TUNING.camera.zoomMin)) input.onZoom(f);
    };
    // The chase view follows the boat, so the player's turning waits until it is off.
    input.onCameraTurn = (dx, dy, device) => chase.active || orbit.drag(dx, dy, device);
    input.onCameraReset = () => orbit.reset();
    input.onCameraChase = () => chase.toggle();
    this.compass = new CompassCamera(
      document.getElementById('wind-compass')!,
      () => orbit.reset(),
      () => chase.toggle(),
    );
    this.sync();
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

  /** Every frame: the reset button shows while the camera is turned. */
  update() {
    this.compass.update(this.orbit.turned && !this.chase.active);
    this.compass.setChase(this.chase.active);
    this.hud.portLabels.chase = this.chase.active;
    this.keepView();
    // One HUD in both views: only the player's Quiet HUD switch thins it.
    const quiet = this.settings.quietHud;
    if (quiet === this.quiet) return;
    this.quiet = quiet;
    this.hud.quiet = quiet;
  }

  /** The view switched from the key, the pad, a pinch or the button is the one Settings keeps. */
  private keepView() {
    const behind = this.chase.active;
    if (!this.remember || behind === this.savedBehind) return;
    this.savedBehind = behind;
    this.settings.sailingView = behind ? 'behind' : 'above';
    saveSettings(this.settings);
  }

  /** Pushes the Settings switches to the camera and the sea motion. */
  sync() {
    const behind = this.settings.sailingView === 'behind';
    if (behind !== this.savedBehind) {
      this.savedBehind = behind;
      this.chase.active = behind;
    }
    this.orbit.enabled = this.settings.turnCamera;
    this.orbit.autoReturn = this.settings.cameraReturns;
    this.motion.gentle = this.settings.gentleMotion;
    this.motion.cameraBob = this.settings.cameraBob;
  }
}
