import controls from '../data/controls.json';

/**
 * Game controllers through the browser's Gamepad API (decision 0162): an Xbox or any pad the
 * browser reports with the "standard" mapping, over USB or Bluetooth, no plugin.
 *
 * One poller for the whole game. It reads `navigator.getGamepads()` once a frame, and only once
 * a pad has been seen, so a phone or tablet without one pays nothing. Buttons have names (the
 * standard layout below); what each does is in `src/data/controls.json` › `gamepad`, one action
 * map per context (`sea`, `chart`, and the menus' own section).
 */

/** The standard mapping's buttons, in the order the browser numbers them. */
export const PAD_BUTTONS = [
  'a',
  'b',
  'x',
  'y',
  'lb',
  'rb',
  'lt',
  'rt',
  'view',
  'menu',
  'ls',
  'rs',
  'up',
  'down',
  'left',
  'right',
  'home',
] as const;
export type PadButton = (typeof PAD_BUTTONS)[number];

/** The two sticks: left x/y, right x/y (-1..1, y down), after the dead zone. */
export const PAD_AXES = ['lx', 'ly', 'rx', 'ry'] as const;
export type PadAxis = (typeof PAD_AXES)[number];

/** Who gets the pad's presses: the boat, the open chart, or whatever menu or card is up. */
export type PadContext = 'sea' | 'chart' | 'menu';

export interface PadPress {
  button: PadButton;
  /** A press held long enough to repeat (D-pad and menus), not a new press. */
  repeat: boolean;
}

/** One frame of the pad: the sticks, the buttons held, and the presses since the last frame. */
export interface PadFrame {
  axes: Record<PadAxis, number>;
  held: ReadonlySet<PadButton>;
  presses: PadPress[];
}

export interface PadConfig {
  deadZone: number;
  /** How far an analog trigger goes down before it counts as pressed. */
  triggerPress: number;
  repeatDelayMs: number;
  repeatEveryMs: number;
}

export type SeaAction =
  'steerLeft' | 'steerRight' | 'sailUp' | 'sailDown' | 'strike' | 'harbour' | 'chart' | 'pause';
export type ChartAction =
  'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'zoomIn' | 'zoomOut' | 'fit' | 'close';

export interface PadControls extends PadConfig {
  sea: {
    steerAxis: PadAxis;
    zoomAxis: PadAxis;
    zoomPerSec: number;
    actions: Record<SeaAction, PadButton[]>;
  };
  chart: {
    panX: PadAxis;
    panY: PadAxis;
    panPxPerSec: number;
    /** Zoom factor per trigger press (and per hold repeat). */
    zoomStep: number;
    actions: Record<ChartAction, PadButton[]>;
  };
}

export const PAD = controls.gamepad as PadControls;

/** Problems in a controls file: unknown buttons or axes, actions with no button, bad numbers. */
export function controlProblems(c: PadControls = PAD): string[] {
  const out: string[] = [];
  const buttons = new Set<string>(PAD_BUTTONS);
  const axes = new Set<string>(PAD_AXES);
  if (!(c.deadZone >= 0 && c.deadZone < 1)) out.push('deadZone must be 0..1');
  if (!(c.triggerPress > 0 && c.triggerPress <= 1)) out.push('triggerPress must be 0..1');
  if (!(c.repeatDelayMs > 0 && c.repeatEveryMs > 0)) out.push('repeat timings must be > 0');
  const contexts = { sea: c.sea, chart: c.chart } as Record<
    string,
    { actions: Record<string, string[]> } & Record<string, unknown>
  >;
  for (const [name, ctx] of Object.entries(contexts)) {
    for (const key of ['steerAxis', 'zoomAxis', 'panX', 'panY'])
      if (key in ctx && !axes.has(ctx[key] as string))
        out.push(`${name}.${key}: no axis "${String(ctx[key])}"`);
    for (const [action, list] of Object.entries(ctx.actions)) {
      if (!list.length) out.push(`${name}.${action}: no button`);
      for (const b of list) if (!buttons.has(b)) out.push(`${name}.${action}: no button "${b}"`);
    }
  }
  return out;
}

/** Whether any of an action's buttons is held. */
export const holding = (frame: PadFrame, list: readonly PadButton[]) =>
  list.some((b) => frame.held.has(b));

/** Whether a press is one of an action's buttons. */
export const isFor = (press: PadPress, list: readonly PadButton[]) => list.includes(press.button);

/** A stick axis past the dead zone, rescaled so it still starts from 0 and reaches ±1. */
export function shapeAxis(value: number, deadZone: number): number {
  const mag = Math.abs(value);
  if (!(mag > deadZone)) return 0;
  return (Math.sign(value) * Math.min(1, mag - deadZone)) / (1 - deadZone);
}

/** The slice of the browser's Gamepad this code reads (easy to fake in tests). */
export interface PadLike {
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** When each held button went down and when it last repeated (ms). */
export type HeldSince = Map<PadButton, { down: number; repeated: number }>;

/**
 * Read one pad into a frame. Pure apart from `since`, which carries held buttons from frame to
 * frame: a fresh press is reported once, a held one again after `repeatDelayMs`, then every
 * `repeatEveryMs`.
 */
export function readPad(pad: PadLike, since: HeldSince, now: number, c: PadConfig): PadFrame {
  const held = new Set<PadButton>();
  const presses: PadPress[] = [];
  PAD_BUTTONS.forEach((name, i) => {
    const b = pad.buttons[i];
    if (!b) return;
    const analog = name === 'lt' || name === 'rt';
    if (analog ? b.value >= c.triggerPress || (b.pressed && b.value === 0) : b.pressed)
      held.add(name);
  });
  for (const name of held) {
    const was = since.get(name);
    if (!was) {
      since.set(name, { down: now, repeated: now });
      presses.push({ button: name, repeat: false });
    } else if (
      now - was.down >= c.repeatDelayMs &&
      now - was.repeated >= (was.repeated === was.down ? c.repeatDelayMs : c.repeatEveryMs)
    ) {
      was.repeated = now;
      presses.push({ button: name, repeat: true });
    }
  }
  for (const name of [...since.keys()]) if (!held.has(name)) since.delete(name);
  const axis = (i: number) => shapeAxis(pad.axes[i] ?? 0, c.deadZone);
  return { axes: { lx: axis(0), ly: axis(1), rx: axis(2), ry: axis(3) }, held, presses };
}

/** Whether a frame shows the player using the pad (a button or a stick past the dead zone). */
export const padInUse = (f: PadFrame) => f.held.size > 0 || PAD_AXES.some((a) => f.axes[a] !== 0);

/**
 * The game's one poller. `poll(now)` once a frame returns the first standard pad's frame, or
 * null without one. Other code (the menus, decision 0162) listens with `onPress` and `onUsingPad`
 * instead of reading pads itself.
 */
export class GamepadPoller {
  private seen = false;
  private since: HeldSince = new Map();
  private pressListeners: ((press: PadPress) => void)[] = [];
  private usingListeners: ((using: boolean) => void)[] = [];
  private using = false;
  /** Called when a pad is connected or the last one goes. */
  onConnect: (connected: boolean) => void = () => {};
  /**
   * Presses the boat and the chart leave alone, and every press while a menu, dialog, the
   * harbour or a card is up: the menus' focus code takes them (main.ts calls this).
   */
  onMenuPress: (press: PadPress, context: PadContext) => void = () => {};

  constructor(
    private readonly nav: { getGamepads?: () => (PadLike | null)[] } = navigator as never,
    target: Pick<Window, 'addEventListener'> | null = typeof window === 'undefined' ? null : window,
    private readonly config: PadConfig = PAD,
  ) {
    if (!target) return;
    target.addEventListener('gamepadconnected', () => {
      this.seen = true;
      this.onConnect(true);
    });
    target.addEventListener('gamepaddisconnected', () => {
      if (!this.pad()) {
        this.since.clear();
        this.setUsing(false);
        this.onConnect(false);
      }
    });
    // Back on the keyboard, mouse or a finger: menus drop their pad focus ring.
    const away = () => this.setUsing(false);
    target.addEventListener('keydown', away, true);
    target.addEventListener('pointerdown', away, true);
  }

  /** A pad is plugged in and has been seen this session. */
  get connected(): boolean {
    return this.seen && !!this.pad();
  }

  /** The last input came from the pad (for focus rings and button hints). */
  get usingPad(): boolean {
    return this.using;
  }

  /** Every button press (and hold repeat), whatever the context handles. Returns an unsubscribe. */
  onPress(listener: (press: PadPress) => void): () => void {
    this.pressListeners.push(listener);
    return () => (this.pressListeners = this.pressListeners.filter((l) => l !== listener));
  }

  onUsingPad(listener: (using: boolean) => void): () => void {
    this.usingListeners.push(listener);
    return () => (this.usingListeners = this.usingListeners.filter((l) => l !== listener));
  }

  poll(now: number): PadFrame | null {
    if (!this.seen) return null;
    const pad = this.pad();
    if (!pad) return null;
    const frame = readPad(pad, this.since, now, this.config);
    if (padInUse(frame)) this.setUsing(true);
    for (const press of frame.presses) for (const l of this.pressListeners) l(press);
    return frame;
  }

  private pad(): PadLike | null {
    const pads = this.nav.getGamepads?.() ?? [];
    let any: PadLike | null = null;
    for (const p of pads) {
      if (!p?.connected) continue;
      if (p.mapping === 'standard') return p;
      any ??= p;
    }
    // A pad without the standard mapping usually still has A/B/X/Y and a left stick first.
    return any;
  }

  private setUsing(using: boolean) {
    if (using === this.using) return;
    this.using = using;
    for (const l of this.usingListeners) l(using);
  }
}

/** What the pad asks of the boat this frame. */
export interface SeaPad {
  /** Rudder -1..1: the D-pad full over, else the stick. */
  steer: number;
  /** Sail steps (+ raise). */
  sail: number;
  /** All sails down: the boat stops and docks near a port (decision 0094). */
  strike: boolean;
  harbour: boolean;
  chart: boolean;
  pause: boolean;
  /** Camera zoom factor (< 1 closer), like the mouse wheel. */
  zoom: number;
  /** Presses no sea action took, for the menus' focus code. */
  other: PadPress[];
}

export function seaPad(f: PadFrame, dt: number, c: PadControls['sea'] = PAD.sea): SeaPad {
  const a = c.actions;
  const dpad = (holding(f, a.steerRight) ? 1 : 0) - (holding(f, a.steerLeft) ? 1 : 0);
  const out: SeaPad = {
    steer: dpad !== 0 ? dpad : f.axes[c.steerAxis],
    sail: 0,
    strike: false,
    harbour: false,
    chart: false,
    pause: false,
    zoom: Math.exp(f.axes[c.zoomAxis] * c.zoomPerSec * dt),
    other: [],
  };
  for (const p of f.presses) {
    // Held sail buttons do not run the sails up and down: one step per press, like the keys.
    if (isFor(p, a.sailUp)) out.sail += p.repeat ? 0 : 1;
    else if (isFor(p, a.sailDown)) out.sail -= p.repeat ? 0 : 1;
    else if (p.repeat || isFor(p, a.steerLeft) || isFor(p, a.steerRight)) continue;
    else if (isFor(p, a.strike)) out.strike = true;
    else if (isFor(p, a.harbour)) out.harbour = true;
    else if (isFor(p, a.chart)) out.chart = true;
    else if (isFor(p, a.pause)) out.pause = true;
    else out.other.push(p);
  }
  return out;
}

/** What the pad asks of the open chart this frame. */
export interface ChartPad {
  /** Screen pixels to slide the view. */
  panX: number;
  panY: number;
  /** Zoom factor (1 = none). */
  zoom: number;
  fit: boolean;
  close: boolean;
  other: PadPress[];
}

export function chartPad(f: PadFrame, dt: number, c: PadControls['chart'] = PAD.chart): ChartPad {
  const a = c.actions;
  const dx = (holding(f, a.panRight) ? 1 : 0) - (holding(f, a.panLeft) ? 1 : 0);
  const dy = (holding(f, a.panDown) ? 1 : 0) - (holding(f, a.panUp) ? 1 : 0);
  const speed = c.panPxPerSec * dt;
  const out: ChartPad = {
    panX: (dx !== 0 ? dx : f.axes[c.panX]) * speed,
    panY: (dy !== 0 ? dy : f.axes[c.panY]) * speed,
    zoom: 1,
    fit: false,
    close: false,
    other: [],
  };
  for (const p of f.presses) {
    if (isFor(p, a.zoomIn)) out.zoom *= c.zoomStep;
    else if (isFor(p, a.zoomOut)) out.zoom /= c.zoomStep;
    else if (p.repeat || [a.panLeft, a.panRight, a.panUp, a.panDown].some((l) => isFor(p, l)))
      continue;
    else if (isFor(p, a.fit)) out.fit = true;
    else if (isFor(p, a.close)) out.close = true;
    else out.other.push(p);
  }
  return out;
}
