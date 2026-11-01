import {
  PAD,
  isFor,
  shapeAxis,
  type MenuAction,
  type PadControls,
  type PadContext,
  type PadFrame,
  type PadButton,
  type PadPress,
} from '../input/gamepad';
import { type MessageKey, t } from '../i18n';
import { padName } from './padGlyphs';

/**
 * A game controller in the menus, the port screen and on cards (decision 0163). The D-pad or the
 * left stick moves a real DOM focus to the nearest control in that direction, A presses it, B goes
 * back (like Esc), X does the screen's extra action (Sell all), LB/RB switch tabs, LT/RT step an
 * amount (the market's lot, decision 0192), the right stick scrolls a long screen and Start resumes
 * from the pause menu; the buttons are the `menu` section of `src/data/controls.json`. The focus
 * highlight (brass ring, `menus.css`) and the button hints only show while the pad is the last
 * input: `html[data-input=pad]`.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The screen on top that takes the pad: its element and what "back" does there. */
export interface PadScreen {
  root: HTMLElement;
  back: () => void;
}

const DIRECTIONS: readonly MenuAction[] = ['up', 'down', 'left', 'right'];
/** Actions that repeat while held, like the D-pad. */
const REPEATING: readonly MenuAction[] = [...DIRECTIONS, 'less', 'more'];

/** What a press asks of the menus, or null for a button they do not use. */
export function menuAction(press: PadPress, c: PadControls['menu'] = PAD.menu): MenuAction | null {
  for (const [action, buttons] of Object.entries(c.actions) as [
    MenuAction,
    PadControls['menu']['actions'][MenuAction],
  ][])
    if (isFor(press, buttons)) return action;
  return null;
}

/** The way the stick leans, once it leans past `stickPress`; the stronger axis wins. */
export function stickDirection(x: number, y: number, press: number): Direction | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < press) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

/** The stick as a held D-pad: a move when it leans, again after the delay, then every so often. */
export class StickRepeat {
  private dir: Direction | null = null;
  private down = 0;
  private repeated = 0;

  step(dir: Direction | null, now: number, delayMs: number, everyMs: number): Direction | null {
    if (dir !== this.dir) {
      this.dir = dir;
      this.down = this.repeated = now;
      return dir;
    }
    if (!dir) return null;
    const wait = this.repeated === this.down ? delayMs : everyMs;
    if (now - this.repeated < wait) return null;
    this.repeated = now;
    return dir;
  }
}

/**
 * The box to move to from `from`, going `dir`: only boxes whose centre lies beyond `from`'s centre
 * that way count; the nearest edge wins, a box off to the side costs twice its sideways gap, so a
 * column or a row is followed before a jump across. -1 when nothing lies that way.
 */
export function nearestInDirection(from: Box, boxes: readonly Box[], dir: Direction): number {
  const cx = (from.left + from.right) / 2;
  const cy = (from.top + from.bottom) / 2;
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    const bx = (b.left + b.right) / 2;
    const by = (b.top + b.bottom) / 2;
    let ahead: number;
    let side: number;
    let drift: number;
    if (dir === 'up' || dir === 'down') {
      if (dir === 'down' ? by <= cy + 1 : by >= cy - 1) return;
      ahead = dir === 'down' ? b.top - from.bottom : from.top - b.bottom;
      side = Math.max(0, b.left - from.right, from.left - b.right);
      drift = Math.abs(bx - cx);
    } else {
      if (dir === 'right' ? bx <= cx + 1 : bx >= cx - 1) return;
      ahead = dir === 'right' ? b.left - from.right : from.left - b.right;
      side = Math.max(0, b.top - from.bottom, from.top - b.bottom);
      drift = Math.abs(by - cy);
    }
    const score = Math.max(0, ahead) + side * 2 + drift * 0.1;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

const FOCUSABLE =
  'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
const TABS = '[role="tab"], .tab-btn';
/** A row of choices LT/RT step through (the lot ×1 ×5 ×10), the chosen one `aria-pressed`. */
const STEPS = '[data-pad="steps"]';
/** A greyed control the pad can still reach and read (decision 0192), but not press. */
const SOFT_OFF = '[aria-disabled="true"]';
/** A screen's header and footer bars (the port's are sticky). */
const BARS = 'header, footer';

/**
 * Greyed buttons a pad can still reach (decision 0192): a `disabled` button takes no focus, so a
 * Shipyard where nothing is affordable yet had nothing to move to, and the focus fell off a Sell
 * button that greyed after the last sale. They become `aria-disabled` (styled the same); a click
 * on one is stopped by `guardSoftDisabled`.
 */
export function softDisable(root: ParentNode) {
  for (const b of root.querySelectorAll<HTMLButtonElement>('button[disabled]')) {
    b.disabled = false;
    b.setAttribute('aria-disabled', 'true');
  }
}

/** Stop clicks (pointer, keyboard or pad) on `aria-disabled` controls inside `root`. */
export function guardSoftDisabled(root: HTMLElement) {
  root.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element | null)?.closest?.(SOFT_OFF)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}
/** Close buttons: the pad starts elsewhere, B already closes (`data-pad-close`: the v1.5 header). */
const CLOSE =
  '.close-btn, #tp-close, .d-btn.red.square, [data-chart-close], .home-close, [data-pad-close]';

function shown(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.closest('[hidden], [inert]')) return false;
  if (typeof el.checkVisibility === 'function')
    return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  return el.getClientRects().length > 0;
}

/** The controls the pad can reach on a screen, in page order. */
export function reachable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(shown);
}

/**
 * Where the focus starts on a screen: its main button (brass, or a v1.5 primary button marked
 * `data-pad-main`), else its first control. A button marked `data-pad-start="never"` (the port's
 * Set sail, decision 0192) is the last resort, so a stray A on a Shipyard with nothing affordable
 * yet does not leave port.
 */
export function startOf(controls: readonly HTMLElement[]): HTMLElement | null {
  const open = controls.filter((el) => !el.matches(CLOSE) && !el.matches(TABS));
  const first = open.filter((el) => el.dataset.padStart !== 'never');
  return (
    first.find((el) => el.matches('.brass, [data-pad-main]') && !el.matches(SOFT_OFF)) ??
    first[0] ??
    open[0] ??
    controls[0] ??
    null
  );
}

/** A control's likeness, to find it again when its screen redraws (the market after a sale). */
function likeness(el: HTMLElement): string {
  const data = Object.entries(el.dataset)
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const classes = [...el.classList].filter((c) => !['active', 'selected', 'is-new'].includes(c));
  return [el.tagName, el.id, ...classes.sort(), ...data].join(' ');
}

export class PadFocus {
  private screen: HTMLElement | null = null;
  private last: { like: string; index: number } | null = null;
  private stick = new StickRepeat();
  private using = false;
  /** The pad just took over: its first move or A only shows where the focus is. */
  private waking = false;
  /** The control that carries the ring's mark (`data-pad-focus`). */
  private marked: HTMLElement | null = null;
  private hintsTimer: ReturnType<typeof setTimeout> | undefined;
  /** When the right stick last scrolled (0: it is not leaning). */
  private scrolledAt = 0;
  /** Start in the pause menu: back to the sea. */
  onResume: () => void = () => {};

  constructor(
    private readonly screenOf: () => PadScreen | null,
    private readonly hints: HTMLElement | null,
    private readonly c: PadControls = PAD,
  ) {}

  /**
   * The pad is (or is no longer) the last input: show or hide the focus ring and hints. `wake`:
   * the next move or A only shows where the focus is (not on a TV, where the ring is always up).
   */
  setUsing(using: boolean, wake = true) {
    this.using = using;
    document.documentElement.dataset.input = using ? 'pad' : 'pointer';
    if (!using) this.showHints(false);
    else {
      this.screen = null;
      this.waking = !!this.settle() && wake;
    }
  }

  /**
   * Every frame while a menu, the port screen or a card is up: the stick, a screen that just
   * opened (focus its main button), a focused control that went away when its screen redrew.
   */
  frame(f: PadFrame | null, now: number) {
    if (!this.using) return;
    const screen = this.settle();
    if (!screen || !f) return;
    const dir = this.stick.step(
      stickDirection(f.axes[this.c.menu.moveX], f.axes[this.c.menu.moveY], this.c.menu.stickPress),
      now,
      this.c.repeatDelayMs,
      this.c.repeatEveryMs,
    );
    if (dir) this.move(screen, dir);
    const lean = shapeAxis(f.axes[this.c.menu.scrollY] ?? 0, this.c.deadZone);
    if (lean) this.scroll(screen, lean, now);
    else this.scrolledAt = 0;
  }

  /**
   * The right stick scrolls the screen (decision 0192): the box round the focused control that
   * scrolls, else the screen's own; the focus follows when it scrolls out of sight.
   */
  private scroll(screen: PadScreen, lean: number, now: number) {
    const dt = this.scrolledAt ? Math.min(0.1, (now - this.scrolledAt) / 1000) : 1 / 60;
    this.scrolledAt = now;
    const box = scroller(document.activeElement as HTMLElement | null, screen.root);
    if (!box) return;
    const before = reachable(box).map((c) => [c, c.getBoundingClientRect().top] as const);
    box.scrollTop += lean * this.c.menu.scrollPxPerSec * dt;
    const el = document.activeElement as HTMLElement | null;
    if (!el || !box.contains(el) || inSight(el)) return;
    // The focused control went out of sight: take the nearest one that scrolled into it (not a
    // header's tab, lot or close button, which stay put).
    const moved = before
      .filter(([c, top]) => c.getBoundingClientRect().top !== top && inSight(c))
      .map(([c]) => c);
    const next = lean > 0 ? moved[0] : moved[moved.length - 1];
    if (next) this.focus(next, reachable(screen.root), false);
  }

  /** LT/RT: a focused slider moves a notch, else the screen's row of choices (the lot). */
  private step(screen: PadScreen, el: HTMLElement | null, step: number) {
    if (el instanceof HTMLInputElement && el.type === 'range' && screen.root.contains(el)) {
      if (step > 0) el.stepUp();
      else el.stepDown();
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const group = [...screen.root.querySelectorAll<HTMLElement>(STEPS)].find(shown);
    if (!group) return;
    const choices = [...group.querySelectorAll<HTMLElement>('[aria-pressed]')].filter(shown);
    const at = choices.findIndex((c) => c.getAttribute('aria-pressed') === 'true');
    const next = choices[Math.max(0, Math.min(choices.length - 1, at + step))];
    if (next && next !== choices[at]) next.click();
  }

  press(p: PadPress, context: PadContext) {
    if (context === 'chart') return;
    const action = menuAction(p, this.c.menu);
    if (!action || (p.repeat && !REPEATING.includes(action))) return;
    const screen = this.settle();
    const waking = this.waking;
    this.waking = false;
    if (waking && (action === 'press' || DIRECTIONS.includes(action))) return;
    if (action === 'resume') {
      if (context === 'menu') this.onResume();
      return;
    }
    if (!screen) return;
    const el = document.activeElement as HTMLElement | null;
    switch (action) {
      case 'press':
        if (
          el &&
          screen.root.contains(el) &&
          !el.matches(SOFT_OFF) &&
          !(el instanceof HTMLInputElement && el.type === 'range')
        )
          el.click();
        break;
      case 'back':
        screen.back();
        break;
      case 'secondary': {
        // The screen's one extra action (Sell all), marked `data-pad="secondary"` with its glyph.
        const extra = [...screen.root.querySelectorAll<HTMLElement>('[data-pad="secondary"]')].find(
          shown,
        );
        extra?.click();
        break;
      }
      case 'less':
      case 'more':
        this.step(screen, el, action === 'more' ? 1 : -1);
        break;
      case 'tabPrev':
      case 'tabNext':
        this.tab(screen, action === 'tabNext' ? 1 : -1);
        break;
      default:
        this.move(screen, action as Direction);
    }
  }

  /** The screen on top, with the focus inside it (put back or at its start when it is not). */
  private settle(): PadScreen | null {
    const screen = this.screenOf();
    if (!screen) {
      this.screen = null;
      this.showHints(false);
      this.mark(null);
      return null;
    }
    const opened = screen.root !== this.screen;
    this.screen = screen.root;
    const active = document.activeElement as HTMLElement | null;
    const inside =
      !!active && active !== screen.root && screen.root.contains(active) && shown(active);
    if (opened || !inside) {
      const controls = reachable(screen.root);
      const back = !opened && this.last ? this.findAgain(controls, this.last) : null;
      const keep = opened && inside && !active!.matches(CLOSE) ? active : null;
      const target = back ?? keep ?? startOf(controls);
      if (target && target !== active) this.focus(target, controls);
    }
    if (opened) this.showHints(true, screen.root);
    const now = document.activeElement as HTMLElement | null;
    this.mark(now && now !== screen.root && screen.root.contains(now) ? now : null);
    return screen;
  }

  /**
   * The ring's mark (decision 0203): Edge on Xbox's pointer mode can leave the page without the
   * browser's focus, so `:focus` never matches and the ring did not show although the focus moved
   * (Guillaume's `?padlog` photo). The control the pad is on carries `data-pad-focus` too.
   */
  private mark(el: HTMLElement | null) {
    if (this.marked === el) return;
    this.marked?.removeAttribute('data-pad-focus');
    this.marked = el;
    el?.setAttribute('data-pad-focus', '');
  }

  private move(screen: PadScreen, dir: Direction) {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !screen.root.contains(el)) return;
    if (
      el instanceof HTMLInputElement &&
      el.type === 'range' &&
      (dir === 'left' || dir === 'right')
    ) {
      if (dir === 'right') el.stepUp();
      else el.stepDown();
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    // Never onto a close button (B already closes): up from Set sail landed on ✕ (decision 0192).
    const all = reachable(screen.root).filter((c) => c !== el && !c.matches(CLOSE));
    // A screen's own controls before its header and footer bars, which stay on screen while it
    // scrolls: down from an upgrade went to the footer over the ships below (decision 0192).
    const inner = el.closest(BARS) ? all : all.filter((c) => !c.closest(BARS));
    const near = (list: HTMLElement[]) =>
      nearestInDirection(
        el.getBoundingClientRect(),
        list.map((c) => c.getBoundingClientRect()),
        dir,
      );
    let controls = inner;
    let i = near(inner);
    if (i < 0 && inner !== all) i = near((controls = all));
    if (i >= 0) this.focus(controls[i]!, reachable(screen.root));
  }

  private tab(screen: PadScreen, step: number) {
    const tabs = [...screen.root.querySelectorAll<HTMLElement>(TABS)].filter(shown);
    if (tabs.length < 2) return;
    const current = tabs.findIndex(
      (t) =>
        t.getAttribute('aria-selected') === 'true' ||
        t.getAttribute('aria-pressed') === 'true' ||
        t.classList.contains('active'),
    );
    const next = tabs[(Math.max(0, current) + step + tabs.length) % tabs.length]!;
    next.click();
    // The tab's screen redraws: start on its main button rather than on the tab row.
    this.last = null;
    queueMicrotask(() => {
      const controls = reachable(screen.root);
      const start = startOf(controls);
      if (start) this.focus(start, controls);
      this.refreshHints();
    });
  }

  private focus(el: HTMLElement, controls: readonly HTMLElement[], reveal = true) {
    el.focus({ preventScroll: true });
    this.mark(el);
    if (reveal) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const like = likeness(el);
    this.last = { like, index: controls.filter((c) => likeness(c) === like).indexOf(el) };
  }

  private findAgain(controls: readonly HTMLElement[], last: { like: string; index: number }) {
    const same = controls.filter((c) => likeness(c) === last.like);
    return same[last.index] ?? same[same.length - 1] ?? null;
  }

  /**
   * The button hints pill: up while a screen is open with the pad (or for `hintsSeconds`), listing
   * what works there (decision 0192): A Choose, B Back, LB RB Tabs, LT RT Amount. It is
   * a popover where the browser has them, so it shows above a modal card (both in the top layer).
   */
  private showHints(show: boolean, root?: HTMLElement) {
    const hints = this.hints;
    if (!hints) return;
    clearTimeout(this.hintsTimer);
    const popover = typeof hints.showPopover === 'function';
    const hide = () => {
      hints.classList.remove('show');
      if (popover) this.hintsTimer = setTimeout(() => hints.hidePopover(), 400);
    };
    // A screen whose controls carry their own glyphs (a quest card) needs no pill over them.
    if (!show || !root || root.dataset.padHints === 'off') {
      if (hints.classList.contains('show')) hide();
      return;
    }
    hints.innerHTML = hintsHtml(hintsFor(root, this.c.menu.actions));
    if (popover) {
      // Shown again, so it lands above whatever card opened last.
      if (hints.matches(':popover-open')) hints.hidePopover();
      hints.showPopover();
    }
    hints.classList.add('show');
    if (this.c.menu.hintsSeconds > 0)
      this.hintsTimer = setTimeout(hide, this.c.menu.hintsSeconds * 1000);
  }

  /** The screen redrew (a tab switched, the lot row came or went): its hints again. */
  refreshHints() {
    const hints = this.hints;
    if (!hints || !this.screen || !hints.classList.contains('show')) return;
    hints.innerHTML = hintsHtml(hintsFor(this.screen, this.c.menu.actions));
  }
}

/** Whether a control's middle can be seen (not scrolled away, not under a footer bar). */
function inSight(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint?.((r.left + r.right) / 2, (r.top + r.bottom) / 2);
  return !!hit && el.contains(hit);
}

/** The nearest box round `el` (or the screen) that scrolls up and down, else null. */
function scroller(el: HTMLElement | null, root: HTMLElement): HTMLElement | null {
  const scrolls = (b: HTMLElement) =>
    b.scrollHeight > b.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(b).overflowY);
  for (let b = el; b && root.contains(b); b = b.parentElement) if (scrolls(b)) return b;
  return [root, ...root.querySelectorAll<HTMLElement>('*')].find(scrolls) ?? null;
}

export interface Hint {
  buttons: PadButton[];
  /** Also shown beside its control (the LB/RB glyphs at the tab bar's ends): dropped when narrow. */
  extra?: boolean;
  label: MessageKey;
}

/** What the pill lists on a screen: always A and B, then tabs and the lot row when it has them. */
export function hintsFor(root: HTMLElement, actions: PadControls['menu']['actions']): Hint[] {
  const first = (a: MenuAction) => actions[a].slice(0, 1);
  const out: Hint[] = [
    { buttons: first('press'), label: 'pad.choose' },
    { buttons: first('back'), label: 'pad.back' },
  ];
  if ([...root.querySelectorAll<HTMLElement>(TABS)].filter(shown).length > 1)
    out.push({
      buttons: [...first('tabPrev'), ...first('tabNext')],
      label: 'pad.tabs',
      extra: true,
    });
  if ([...root.querySelectorAll<HTMLElement>(STEPS)].some(shown))
    out.push({ buttons: [...first('less'), ...first('more')], label: 'pad.amount', extra: true });
  return out;
}

const BUMPERS = new Set<string>(['lb', 'rb', 'lt', 'rt']);

function hintsHtml(hints: readonly Hint[]): string {
  return hints
    .map(
      (h) =>
        `<span${h.extra ? ' class="extra"' : ''}>${h.buttons
          .map(
            (b) =>
              `<i class="pad-key ${BUMPERS.has(b) ? 'bumper' : b}" data-pad-key="${b}">${padName(b)}</i>`,
          )
          .join('')}<span>${t(h.label)}</span></span>`,
    )
    .join('');
}
