import { type Enter, playEnter } from '../motion';
import type { PadScreen } from '../padFocus';

/**
 * The screen stack (decision 0269): the title or pause menu and the screens opened over it
 * (settings, help, voyage transfer, new voyage) as push, replace and pop instead of `hidden`
 * toggles wired by hand. Only the top screen shows; the one under it comes back when it pops.
 * Each push plays the screen's way in (motion.ts, off with `prefers-reduced-motion`); the way
 * out is immediate, so a closed screen never takes clicks. Esc and B call the top's `back`.
 */
export interface Screen {
  id: string;
  root: HTMLElement;
  /** What Esc and B do on it; popping it by default. */
  back?: () => void;
  /** Its way in when pushed (default `slide`); `fade` when it comes back from under another. */
  enter?: Enter;
  /** Runs as it shows, after its root is unhidden (focus a control, redraw). */
  onShow?: () => void;
  /** Runs as it hides, before its root is hidden (stop a camera). */
  onHide?: () => void;
}

export class ScreenStack {
  private readonly screens: Screen[] = [];

  /** `onChange` runs after every change (the game's pause follows the stack). */
  constructor(private readonly onChange: () => void = () => {}) {}

  get top(): Screen | null {
    return this.screens.at(-1) ?? null;
  }

  get depth(): number {
    return this.screens.length;
  }

  has(id: string): boolean {
    return this.screens.some((s) => s.id === id);
  }

  /** Whether the screen is the one showing. */
  showing(id: string): boolean {
    return this.top?.id === id;
  }

  /** Opens a screen over the others; one already in the stack moves to the top. */
  push(screen: Screen) {
    this.lower();
    this.drop(screen.id);
    this.screens.push(screen);
    this.raise(screen.enter ?? 'slide');
    this.onChange();
  }

  /** Swaps the top screen for another (the menu's Play becoming New voyage). */
  replace(screen: Screen) {
    this.lower();
    this.screens.pop();
    this.drop(screen.id);
    this.screens.push(screen);
    this.raise(screen.enter ?? 'slide');
    this.onChange();
  }

  /** Closes the top screen; the one under it comes back. */
  pop() {
    if (!this.screens.length) return;
    this.lower();
    this.screens.pop();
    this.raise('fade');
    this.onChange();
  }

  /** Closes one screen wherever it is: the top pops, one under it just leaves the stack. */
  close(id: string) {
    if (this.showing(id)) this.pop();
    else if (this.has(id)) {
      this.drop(id);
      this.onChange();
    }
  }

  /** Only these screens, the last on top (the pause menu over the sea: `reset(menu)`). */
  reset(...screens: Screen[]) {
    this.lower();
    this.screens.length = 0;
    this.screens.push(...screens);
    for (const s of screens) s.root.hidden = true;
    this.raise(screens.at(-1)?.enter ?? 'fade');
    this.onChange();
  }

  /** Esc or B: the top screen's `back`, which pops it unless it says otherwise. */
  back() {
    const top = this.top;
    if (!top) return;
    if (top.back) top.back();
    else this.pop();
  }

  /** The top screen for the pad's focus (padFocus.ts), or null over the open sea. */
  padScreen(): PadScreen | null {
    const top = this.top;
    return top ? { root: top.root, back: () => this.back() } : null;
  }

  private lower() {
    const top = this.top;
    if (!top) return;
    top.onHide?.();
    top.root.hidden = true;
  }

  private raise(enter: Enter) {
    const top = this.top;
    if (!top) return;
    top.root.hidden = false;
    playEnter(top.root, enter);
    top.onShow?.();
  }

  private drop(id: string) {
    const at = this.screens.findIndex((s) => s.id === id);
    if (at >= 0) this.screens.splice(at, 1);
  }
}
