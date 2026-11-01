import { leaveMs, playEnter } from '../motion';
import { SHIPPED_THEME } from '../theme/model';
import { el } from './dom';

/**
 * The one toast (decision 0269): a short line that rises in, waits, sinks away. One shows at a
 * time; the others wait in line, and the same line twice in a row shows once. One element is
 * reused, and only timers run: nothing per frame.
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
const PAGE_TIMERS: Timers = { set: (run, ms) => setTimeout(run, ms) };

export const TOAST_MS = 2400;

export class Toaster {
  readonly root: HTMLElement;
  private readonly line: HTMLElement;
  private readonly waiting: Waiting[] = [];
  private showing: Waiting | null = null;

  constructor(private readonly timers: Timers = PAGE_TIMERS) {
    this.root = el('div', 'ui-toasts');
    this.root.setAttribute('aria-live', 'polite');
    this.root.style.zIndex = String(SHIPPED_THEME.z.toast);
    this.line = el('p', 'ui-toast');
    this.line.hidden = true;
    this.root.append(this.line);
  }

  /** The line on screen now, if any. */
  get current(): string | null {
    return this.showing?.text ?? null;
  }

  get queued(): number {
    return this.waiting.length;
  }

  show(text: string, o: ToastOptions = {}) {
    const last = this.waiting.at(-1) ?? this.showing;
    if (last?.text === text) return;
    this.waiting.push({ text, kind: o.kind ?? 'info', ms: o.ms ?? TOAST_MS });
    if (!this.showing) this.next();
  }

  private next() {
    const toast = this.waiting.shift() ?? null;
    this.showing = toast;
    if (!toast) {
      this.line.hidden = true;
      return;
    }
    this.line.textContent = toast.text;
    this.line.dataset.kind = toast.kind;
    delete this.line.dataset.leave;
    this.line.hidden = false;
    playEnter(this.line, 'rise');
    this.timers.set(() => this.leave(), toast.ms);
  }

  private leave() {
    this.line.dataset.leave = '';
    this.timers.set(() => this.next(), leaveMs());
  }
}
