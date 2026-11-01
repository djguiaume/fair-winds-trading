import { t } from '../../i18n';
import { knobs } from '../../sim/difficulty';
import { DEG } from '../../sim/math';
import { windTo } from '../../sim/wind';
import { type PressLevel, type World, pressLevel } from '../../sim/world';
import type { ScreenPoint } from '../../render/view';
import { screenBearing } from '../screenBearing';

/**
 * The press warning (decision 0078): when the wind presses her too hard the sails turn amber, then
 * red, and the lee edge of the screen glows the same colour. The first time, a toast says what to
 * do; crossing into red buzzes the phone and creaks. Cheap writes, only on a change.
 */
export class PressWarning {
  level: PressLevel = 0;
  private shown: PressLevel | null = null;
  private glowAngle = NaN;
  /** A point a step downwind of her, reused each frame. */
  private readonly lee = { x: 0, y: 0 };
  /** The one-time "ease the sails" message has been shown. */
  seenHint = false;
  onHintSeen: () => void = () => {};
  /** She just crossed into red. */
  onDanger: () => void = () => {};

  constructor(
    private readonly world: World,
    private readonly glow: HTMLElement,
    private readonly toast: (text: string, seconds: number) => void,
  ) {}

  /** Every frame: the level, and on screen the glow's side. */
  update(project: (x: number, y: number) => ScreenPoint, active: boolean, visible: boolean) {
    const level = active ? pressLevel(this.world, this.level) : 0;
    if (level !== this.level) {
      if (level === 2 && this.level < 2) this.onDanger();
      this.level = level;
      if (level > 0 && !this.seenHint) {
        this.seenHint = true;
        this.onHintSeen();
        // On a level that keeps the cargo (Fair winds) the warning is a lesson (decision 0083).
        const keeps = knobs(this.world.trade.difficulty).cargoLost === 0;
        this.toast(t(keeps ? 'toast.pressHintFair' : 'toast.pressHint'), 5);
      }
    }
    if (!visible) return;
    if (this.shown !== level) {
      this.shown = level;
      this.glow.dataset.press = String(level);
    }
    if (level === 0) return;
    // The glow sits on the lee side, where she leans: the way the wind blows, on screen.
    const { boat, wind } = this.world;
    const to = windTo(wind);
    this.lee.x = boat.x + Math.sin(to);
    this.lee.y = boat.y + Math.cos(to);
    const deg = Math.round(screenBearing(project, boat, this.lee) / DEG);
    if (Math.abs(deg - this.glowAngle) < 2) return;
    this.glowAngle = deg;
    this.glow.style.setProperty('--lee', `${deg}deg`);
  }
}
