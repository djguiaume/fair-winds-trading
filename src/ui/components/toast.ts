import { leaveMs, playEnter } from '../motion';
import { SHIPPED_THEME } from '../theme/model';
import { el } from './dom';

/**
 * The one toast (decision 0269): a short line that drops in at the top centre, waits, sinks away.
 * At most two show at once (decision 0274); the others wait in line, and the same line twice in a
 * row shows once. Two elements are reused, and only timers run: nothing per frame.
 */
export type ToastKind = 'info' | 'good' | 'bad';

export interface ToastOptions {
  kind?: ToastKind;
  /** How long it stays, in ms. */
  ms?: number;
}

interface Waiting {
  text: string;
  kind: ToastKind;
  ms: number;
}

/** Timers, passed in so a test can run them by hand. */
export interface Timers {
  set(run: () => void, ms: number): unknown;
}
export const PAGE_TIMERS: Timers = { set: (run, ms) => setTimeout(run, ms) };

export const TOAST_MS = 2400;
export const MAX_TOASTS = 2;

interface Slot {
  line: HTMLElement;
  showing: Waiting | null;
}

export class Toaster {
  readonly root: HTMLElement;
  private readonly slots: Slot[] = [];
  private readonly waiting: Waiting[] = [];

  constructor(private readonly timers: Timers = PAGE_TIMERS) {
    this.root = el('div', 'ui-toasts');
    this.root.setAttribute('aria-live', 'polite');
    this.root.style.zIndex = String(SHIPPED_THEME.z.toast);
    for (let i = 0; i < MAX_TOASTS; i++) {
      const line = el('p', 'ui-toast');
      line.hidden = true;
      this.slots.push({ line, showing: null });
      this.root.append(line);
    }
  }

  /** The oldest line on screen now, if any. */
  get current(): string | null {
    return this.slots.find((s) => s.showing)?.showing?.text ?? null;
  }

  /** How many lines are on screen. */
  get visible(): number {
    return this.slots.filter((s) => s.showing).length;
  }

  get queued(): number {
    return this.waiting.length;
  }

  show(text: string, o: ToastOptions = {}) {
    const last = this.waiting.at(-1)?.text ?? this.newest();
    if (last === text) return;
    this.waiting.push({ text, kind: o.kind ?? 'info', ms: o.ms ?? TOAST_MS });
    this.fill();
  }

  /** The line shown last, to ignore the same line twice in a row. */
  private newest(): string | undefined {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const text = this.slots[i]!.showing?.text;
      if (text) return text;
    }
    return undefined;
  }

  private fill() {
    for (const slot of this.slots) {
      if (slot.showing) continue;
      const toast = this.waiting.shift();
      if (!toast) return;
      this.start(slot, toast);
    }
  }

  private start(slot: Slot, toast: Waiting) {
    const { line } = slot;
    slot.showing = toast;
    line.textContent = toast.text;
    line.dataset.kind = toast.kind;
    delete line.dataset.leave;
    line.hidden = false;
    playEnter(line, 'drop');
    this.timers.set(() => this.leave(slot), toast.ms);
  }

  private leave(slot: Slot) {
    slot.line.dataset.leave = '';
    this.timers.set(() => {
      slot.showing = null;
      slot.line.hidden = true;
      this.fill();
    }, leaveMs());
  }
}
