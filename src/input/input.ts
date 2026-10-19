import { clamp } from '../sim/math';

/**
 * Maps keyboard, mouse and touch to the same two actions (decision 0006):
 * steer (-1..1, held) and sail up/down (discrete steps).
 *
 * - Keyboard: ←/→ or A/D steer, ↑/↓ or W/S raise/lower sails.
 * - Touch or mouse: press anywhere on the sea and drag left/right to steer, like a tiller;
 *   the farther you drag, the harder you turn. Sail buttons live in the HUD.
 */
export class Input {
  private left = false;
  private right = false;
  private dragId: number | null = null;
  private dragOriginX = 0;
  private dragSteer = 0;
  private sailDelta = 0;
  /** Called on the first input of any kind (e.g. to hide the help card). */
  onActivity: () => void = () => {};
  /** Called when a drag starts/moves/ends, for the on-screen tiller indicator. */
  onDrag: (drag: { x: number; y: number; steer: number } | null) => void = () => {};
  onZoom: (factor: number) => void = () => {};

  constructor(private readonly surface: HTMLElement) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.releaseAll);
    surface.addEventListener('pointerdown', this.pointerDown);
    surface.addEventListener('pointermove', this.pointerMove);
    surface.addEventListener('pointerup', this.pointerUp);
    surface.addEventListener('pointercancel', this.pointerUp);
    surface.addEventListener('wheel', this.wheel, { passive: false });
  }

  /** Current steering: -1 = hard left, 1 = hard right. */
  get steer(): number {
    const keys = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    return keys !== 0 ? keys : this.dragSteer;
  }

  /** Sail steps requested since the last call (+ = raise). */
  takeSailDelta(): number {
    const d = this.sailDelta;
    this.sailDelta = 0;
    return d;
  }

  pressSail(delta: number) {
    this.sailDelta += delta;
    this.onActivity();
  }

  private keyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
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

  private releaseAll = () => {
    this.left = this.right = false;
    this.dragId = null;
    this.dragSteer = 0;
    this.onDrag(null);
  };

  /** Pixels of drag for full rudder, scaled to the screen so it feels the same on phone and PC. */
  private get dragRange() {
    return clamp(Math.min(window.innerWidth, window.innerHeight) * 0.14, 50, 110);
  }

  private pointerDown = (e: PointerEvent) => {
    if (this.dragId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.dragId = e.pointerId;
    this.dragOriginX = e.clientX;
    this.dragSteer = 0;
    this.surface.setPointerCapture(e.pointerId);
    this.onDrag({ x: e.clientX, y: e.clientY, steer: 0 });
    this.onActivity();
  };

  private pointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return;
    this.dragSteer = clamp((e.clientX - this.dragOriginX) / this.dragRange, -1, 1);
    this.onDrag({ x: this.dragOriginX, y: e.clientY, steer: this.dragSteer });
  };

  private pointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.dragId) return;
    this.dragId = null;
    this.dragSteer = 0;
    this.onDrag(null);
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.onZoom(Math.exp(e.deltaY * 0.001));
  };
}
