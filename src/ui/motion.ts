import './motion.css';
import { SHIPPED_THEME } from './theme/model';

/**
 * The UI's motion (decision 0269): screen transitions, toast slides, number rolls; the pressed
 * button's scale is CSS (`motion.css`). Durations and easings are theme tokens. Nothing runs while
 * the UI is idle: transitions are CSS animations, and number rolls ask for animation frames only
 * while a number is rolling, without allocating per frame. `prefers-reduced-motion` turns it all
 * off: screens and toasts just appear, numbers jump to their value.
 */

export type Enter = 'fade' | 'slide' | 'rise';

let reducedQuery: MediaQueryList | null | undefined;

/** Whether the player asked their system for less motion. */
export function reducedMotion(): boolean {
  if (reducedQuery === undefined)
    reducedQuery =
      typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  return reducedQuery?.matches ?? false;
}

/** For tests: forget the cached media query. */
export function resetMotionQuery() {
  reducedQuery = undefined;
}

const clearing = new WeakSet<HTMLElement>();
const clearEnter = (e: AnimationEvent) => {
  const el = e.currentTarget as HTMLElement;
  if (e.target === el) delete el.dataset.enter;
};

/** Plays an element's way in (`data-enter`, `motion.css`), from the start if it was playing. */
export function playEnter(el: HTMLElement, kind: Enter): void {
  if (el.dataset.enter) {
    delete el.dataset.enter;
    // Reading the layout restarts the animation; only on a screen change, never per frame.
    void el.offsetWidth;
  }
  if (reducedMotion()) return;
  if (!clearing.has(el)) {
    clearing.add(el);
    el.addEventListener('animationend', clearEnter);
  }
  el.dataset.enter = kind;
}

/** How long a way out (`data-leave`) takes, so its element can be hidden after it. */
export const leaveMs = () => (reducedMotion() ? 0 : SHIPPED_THEME.duration.fast);

interface Roll {
  el: HTMLElement;
  from: number;
  to: number;
  shown: number;
  start: number;
  format: (n: number) => string;
}

/** What a number roll needs from the page; a test passes its own clock. */
export interface FrameClock {
  now(): number;
  request(step: (now: number) => void): void;
}
const PAGE_CLOCK: FrameClock = {
  now: () => performance.now(),
  request: (step) => requestAnimationFrame(step),
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const plain = (n: number) => String(n);

/**
 * Whole numbers that roll to their new value (gold, cargo, a price). Rolls live in a pool: a
 * finished one is kept for the next, so a frame allocates nothing but the changed text.
 */
export class NumberRolls {
  private rolls: Roll[] = [];
  private active = 0;
  private running = false;
  private readonly step = (now: number) => this.frame(now);

  constructor(
    private readonly clock: FrameClock = PAGE_CLOCK,
    private readonly ms: number = SHIPPED_THEME.duration.slow,
  ) {}

  /** Number of numbers rolling now. */
  get rolling() {
    return this.active;
  }

  /** Rolls `el` from the number it shows to `to`; `format` writes it (default: digits). */
  roll(el: HTMLElement, to: number, format: (n: number) => string = plain): void {
    const now = this.clock.now();
    let roll = this.find(el);
    const shown = roll ? roll.shown : Number(el.dataset.value ?? to);
    el.dataset.value = String(to);
    if (reducedMotion() || shown === to) {
      if (roll) this.drop(roll);
      el.textContent = format(to);
      return;
    }
    if (!roll) roll = this.take(el);
    Object.assign(roll, { from: shown, to, shown, start: now, format });
    if (!this.running) {
      this.running = true;
      this.clock.request(this.step);
    }
  }

  private find(el: HTMLElement): Roll | undefined {
    for (let i = 0; i < this.active; i++) if (this.rolls[i]!.el === el) return this.rolls[i];
    return undefined;
  }

  private take(el: HTMLElement): Roll {
    const roll = this.rolls[this.active] ?? {
      el,
      from: 0,
      to: 0,
      shown: 0,
      start: 0,
      format: plain,
    };
    roll.el = el;
    this.rolls[this.active++] = roll;
    return roll;
  }

  /** Moves a finished roll past the active ones, keeping it for reuse. */
  private drop(roll: Roll) {
    const i = this.rolls.indexOf(roll);
    const last = this.active - 1;
    this.rolls[i] = this.rolls[last]!;
    this.rolls[last] = roll;
    this.active--;
  }

  private frame(now: number) {
    for (let i = this.active - 1; i >= 0; i--) {
      const r = this.rolls[i]!;
      const t = Math.min(1, (now - r.start) / this.ms);
      const value = Math.round(r.from + (r.to - r.from) * easeOut(t));
      if (value !== r.shown) {
        r.shown = value;
        r.el.textContent = r.format(value);
      }
      if (t >= 1) this.drop(r);
    }
    this.running = this.active > 0;
    if (this.running) this.clock.request(this.step);
  }
}
