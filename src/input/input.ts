import { clamp } from '../sim/math';
import { TouchCamera } from './touchCamera';

/** Two right-button presses this close (ms) are a double right-click: the camera resets. */
const DOUBLE_CLICK_MS = 350;

/**
 * Maps keyboard, mouse and touch to the same two actions (decision 0006):
 * steer (-1..1, held) and sail up/down (discrete steps).
 *
 * - Keyboard: ←/→ or A/D steer, ↑/↓ or W/S raise/lower sails.
 * - Game controller (decision 0162): read by `GamepadPoller`, fed in with `setPadSteer` and
 *   `pressSail`.
 * - Touch or mouse: press anywhere on the sea and drag left/right to steer, like a tiller;
 *   the farther you drag, the harder you turn. The sail lever lives in the HUD.
 * - The camera (decision 0223): a right-button drag or two fingers turn and tilt it, a pinch
 *   zooms; a double right-click or Home resets it.
 */
export class Input {
  private left = false;
  private right = false;
  private dragId: number | null = null;
  private dragOriginX = 0;
  private dragSteer = 0;
  private padSteer = 0;
  private orbitId: number | null = null;
  private orbitX = 0;
  private orbitY = 0;
  private lastRightDown = -Infinity;
  private readonly touchCamera = new TouchCamera();
  private sailDelta = 0;
  private sailTarget: number | null = null;
  private enabled = true;
  /** Called on the first input of any kind (e.g. to hide the help card). */
  onActivity: () => void = () => {};
  /** Called when a drag starts/moves/ends, for the on-screen tiller indicator. */
  onDrag: (drag: { x: number; y: number; steer: number } | null) => void = () => {};
  onZoom: (factor: number) => void = () => {};
  /** A camera drag of (dx, dy) CSS pixels, by right-button mouse or two fingers. */
  onCameraTurn: (dx: number, dy: number, device: 'mouse' | 'touch') => void = () => {};
  onCameraReset: () => void = () => {};
  /** The key that switches the close chase view. */
  onCameraChase: () => void = () => {};
  /** Two fingers spreading (< 1, zoom in) or closing (> 1); by default a zoom, like the wheel. */
  onPinch: (factor: number) => void = (factor) => this.onZoom(factor);

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.releaseAll();
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  constructor(private readonly surface: HTMLElement) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.releaseAll);
    surface.addEventListener('pointerdown', this.pointerDown);
    surface.addEventListener('pointermove', this.pointerMove);
    surface.addEventListener('pointerup', this.pointerUp);
    surface.addEventListener('pointercancel', this.pointerUp);
    surface.addEventListener('wheel', this.wheel, { passive: false });
    // The right button turns the camera, so the browser's menu stays shut over the sea.
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    this.touchCamera.onTurn = (dx, dy) => this.onCameraTurn(dx, dy, 'touch');
    this.touchCamera.onPinch = (factor) => this.onPinch(factor);
  }

  /** Current steering: -1 = hard left, 1 = hard right. */
  get steer(): number {
    if (!this.enabled) return 0;
    const keys = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    if (keys !== 0) return keys;
    return this.padSteer !== 0 ? this.padSteer : this.dragSteer;
  }

  /** The controller's rudder this frame (decision 0162), -1..1; keys still win. */
  setPadSteer(steer: number) {
    this.padSteer = this.enabled ? clamp(steer, -1, 1) : 0;
  }

  /** Sail steps requested since the last call (+ = raise). */
  takeSailDelta(): number {
    if (!this.enabled) {
      this.sailDelta = 0;
      return 0;
    }
    const d = this.sailDelta;
    this.sailDelta = 0;
    return d;
  }

  /** Sail setting picked on the HUD lever since the last call, or null. */
  takeSailTarget(): number | null {
    const target = this.enabled ? this.sailTarget : null;
    this.sailTarget = null;
    return target;
  }

  /** Jump straight to a sail step (the HUD lever), instead of one step up or down. */
  setSail(step: number) {
    if (!this.enabled) return;
    this.sailTarget = step;
    this.sailDelta = 0;
    this.onActivity();
  }

  pressSail(delta: number) {
    if (!this.enabled) return;
    this.sailDelta += delta;
    this.onActivity();
  }

  private keyDown = (e: KeyboardEvent) => {
    if (
      !this.enabled ||
      document.querySelector('dialog[open]') ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    let handled = true;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.right = true;
        break;
      case 'ArrowUp':
      case 'KeyW':
        if (!e.repeat) this.sailDelta += 1;
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (!e.repeat) this.sailDelta -= 1;
        break;
      case 'Home':
        this.onCameraReset();
        break;
      case 'KeyC':
        if (!e.repeat) this.onCameraChase();
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.onActivity();
    }
  };

  private keyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.right = false;
  };

  releaseAll = () => {
    this.left = this.right = false;
    this.dragId = null;
    this.dragSteer = 0;
    this.padSteer = 0;
    this.sailDelta = 0;
    this.sailTarget = null;
    this.orbitId = null;
    this.touchCamera.clear();
    this.onDrag(null);
  };

  /** Pixels of drag for full rudder, scaled to the screen so it feels the same on phone and PC. */
  private get dragRange() {
    return clamp(Math.min(window.innerWidth, window.innerHeight) * 0.14, 50, 110);
  }

  private pointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button === 2) return this.orbitDown(e);
    // A second finger makes the touch the camera's: the steering drag lets go (rudder back to 0).
    if (e.pointerType === 'touch' && this.touchCamera.down(e.pointerId, e.clientX, e.clientY)) {
      this.surface.setPointerCapture(e.pointerId);
      if (this.dragId !== null) this.endDrag();
      return;
    }
    if (this.dragId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.dragId = e.pointerId;
    this.dragOriginX = e.clientX;
    this.dragSteer = 0;
    this.surface.setPointerCapture(e.pointerId);
    this.onDrag({ x: e.clientX, y: e.clientY, steer: 0 });
    this.onActivity();
  };

  private orbitDown(e: PointerEvent) {
    if (e.timeStamp - this.lastRightDown < DOUBLE_CLICK_MS) this.onCameraReset();
    this.lastRightDown = e.timeStamp;
    this.orbitId = e.pointerId;
    this.orbitX = e.clientX;
    this.orbitY = e.clientY;
    this.surface.setPointerCapture(e.pointerId);
    this.onActivity();
  }

  private pointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.touchCamera.move(e.pointerId, e.clientX, e.clientY);
    if (e.pointerId === this.orbitId) {
      this.onCameraTurn(e.clientX - this.orbitX, e.clientY - this.orbitY, 'mouse');
      this.orbitX = e.clientX;
      this.orbitY = e.clientY;
    }
    if (e.pointerId !== this.dragId) return;
    this.dragSteer = clamp((e.clientX - this.dragOriginX) / this.dragRange, -1, 1);
    this.onDrag({ x: this.dragOriginX, y: e.clientY, steer: this.dragSteer });
  };

  private pointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') this.touchCamera.up(e.pointerId);
    if (e.pointerId === this.orbitId) this.orbitId = null;
    if (e.pointerId === this.dragId) this.endDrag();
  };

  private endDrag() {
    this.dragId = null;
    this.dragSteer = 0;
    this.onDrag(null);
  }

  private wheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.onZoom(Math.exp(e.deltaY * 0.001));
  };
}
