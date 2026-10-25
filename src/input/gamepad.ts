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
  /** How often the buttons are read between frames (ms), so a quick tap is never missed. */
  sampleEveryMs?: number;
  /** How far an analog trigger goes down before it counts as pressed. */
  triggerPress: number;
  repeatDelayMs: number;
  repeatEveryMs: number;
}

export type SeaAction =
  | 'steerLeft'
  | 'steerRight'
  | 'sailUp'
  | 'sailDown'
  | 'strike'
  | 'harbour'
  | 'chart'
  | 'pause'
  | 'skipLesson';
export type ChartAction =
  | 'panLeft'
  | 'panRight'
  | 'panUp'
  | 'panDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'fit'
  | 'close'
  | 'pick'
  | 'skipLesson'
  | 'nextGood'
  | 'tabPrev'
  | 'tabNext';
/** Menus, the port screen, cards (decision 0163): move the focus, press it, back, tabs, resume. */
export type MenuAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'press'
  | 'back'
  | 'secondary'
  | 'tabPrev'
  | 'tabNext'
  | 'resume';

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
    /** How near the middle cross (screen px) a port must be for A to pick it. */
    pickReachPx: number;
    actions: Record<ChartAction, PadButton[]>;
  };
  menu: {
    /** The stick that moves the focus like the D-pad, and how far it must lean to count. */
    moveX: PadAxis;
    moveY: PadAxis;
    stickPress: number;
    /** How long the button hints stay up after a screen opens. */
    hintsSeconds: number;
    actions: Record<MenuAction, PadButton[]>;
  };
}

export const PAD = controls.gamepad as PadControls;

/**
 * Pad makers and their buttons' names (decision 0186): the standard layout numbers buttons by
 * place, so the bottom face button is "A" on an Xbox pad, "✕" on a PlayStation pad and "B" on a
 * Switch pad. A pad whose id (its USB vendor or name) has a `match` word gets that brand's names;
 * the first brand is the default. Data: `controls.json` › `padBrands`.
 */
export interface PadBrand {
  match: string[];
  names: Partial<Record<PadButton, string>>;
  /** Names that differ in a language (`fr`: the Xbox View button is "Affichage"). */
  lang?: Record<string, Partial<Record<PadButton, string>>>;
}
export const PAD_BRANDS = controls.padBrands as Record<string, PadBrand>;

/** The brand a pad's id names (case does not matter), else the first brand. */
export function padBrand(id: string, brands: Record<string, PadBrand> = PAD_BRANDS): string {
  const lower = id.toLowerCase();
  const names = Object.keys(brands);
  return (
    names.find((b) => brands[b]!.match.some((w) => lower.includes(w.toLowerCase()))) ?? names[0]!
  );
}

/** Problems in `padBrands`: none, unknown buttons, empty names, a brand without names. */
export function brandProblems(brands: Record<string, PadBrand> = PAD_BRANDS): string[] {
  const out: string[] = [];
  const buttons = new Set<string>(PAD_BUTTONS);
  if (!Object.keys(brands).length) out.push('padBrands: needs at least one brand');
  for (const [name, b] of Object.entries(brands)) {
    for (const [button, label] of Object.entries(b.names)) {
      if (!buttons.has(button)) out.push(`padBrands.${name}: no button "${button}"`);
      if (!label?.trim()) out.push(`padBrands.${name}.${button}: empty name`);
    }
    for (const button of ['a', 'b', 'x', 'y'] as const)
      if (!b.names[button]) out.push(`padBrands.${name}: no name for ${button}`);
    if (b.match.some((w) => !w.trim())) out.push(`padBrands.${name}.match: an empty word`);
    for (const [lang, names] of Object.entries(b.lang ?? {}))
      for (const button of Object.keys(names))
        if (!buttons.has(button)) out.push(`padBrands.${name}.lang.${lang}: no button "${button}"`);
  }
  return out;
}

/** Problems in a controls file: unknown buttons or axes, actions with no button, bad numbers. */
export function controlProblems(c: PadControls = PAD): string[] {
  const out: string[] = [];
  const buttons = new Set<string>(PAD_BUTTONS);
  const axes = new Set<string>(PAD_AXES);
  if (!(c.deadZone >= 0 && c.deadZone < 1)) out.push('deadZone must be 0..1');
  if (c.sampleEveryMs !== undefined && !(c.sampleEveryMs >= 0 && c.sampleEveryMs <= 50))
    out.push('sampleEveryMs must be 0..50 (0: once a frame only)');
  if (!(c.triggerPress > 0 && c.triggerPress <= 1)) out.push('triggerPress must be 0..1');
  if (!(c.repeatDelayMs > 0 && c.repeatEveryMs > 0)) out.push('repeat timings must be > 0');
  if (!(c.menu.stickPress > 0 && c.menu.stickPress <= 1)) out.push('menu.stickPress must be 0..1');
  const contexts = { sea: c.sea, chart: c.chart, menu: c.menu } as Record<
    string,
    { actions: Record<string, string[]> } & Record<string, unknown>
  >;
  for (const [name, ctx] of Object.entries(contexts)) {
    for (const key of ['steerAxis', 'zoomAxis', 'panX', 'panY', 'moveX', 'moveY'])
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
  /** The browser's name for the pad, with its USB vendor (`054c` is Sony). */
  id?: string;
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

/**
 * Pad buttons as the keys Edge sends for them (on Xbox, decision 0183): `KeyboardEvent.key`.
 * The thumbsticks' keys move like the D-pad.
 */
export const KEY_BUTTONS: Readonly<Record<string, PadButton>> = {
  GamepadA: 'a',
  GamepadB: 'b',
  GamepadX: 'x',
  GamepadY: 'y',
  GamepadLeftShoulder: 'lb',
  GamepadRightShoulder: 'rb',
  GamepadLeftTrigger: 'lt',
  GamepadRightTrigger: 'rt',
  GamepadView: 'view',
  GamepadMenu: 'menu',
  GamepadLeftThumbstickButton: 'ls',
  GamepadRightThumbstickButton: 'rs',
  GamepadDPadUp: 'up',
  GamepadDPadDown: 'down',
  GamepadDPadLeft: 'left',
  GamepadDPadRight: 'right',
  GamepadLeftThumbstickUp: 'up',
  GamepadLeftThumbstickDown: 'down',
  GamepadLeftThumbstickLeft: 'left',
  GamepadLeftThumbstickRight: 'right',
};

/** How soon after a pad button's key the Gamepad API's report of it is the same press (ms). */
const KEY_ECHO_MS = 300;

/** How often `poll` looks for a pad no `gamepadconnected` event announced (ms). */
const LOOK_EVERY_MS = 1000;

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
  /** When `poll` last looked for a pad no event announced (ms). */
  private lookedAt = -Infinity;
  /** Pad buttons that came as keys ("GamepadA"): presses for the next frame, and those held. */
  private keyPresses: PadPress[] = [];
  private keyHeld = new Set<PadButton>();
  /** Presses `sample` found since the last frame. */
  private sampled: PadPress[] = [];
  /** When each button last came as a key (the last frame's time), to drop the API's echo. */
  private keyAt = new Map<PadButton, number>();
  private lastNow = 0;
  /** When a pad button was last down (for `padClick`). */
  private lastHeldAt = -Infinity;
  /** A key or click that may mean the player left the pad, waiting to see (`away`). */
  private awayAt: number | null = null;
  /** The Gamepad API has reported a press: keys for pad buttons are echoes from then on. */
  private apiPresses = false;
  private pressListeners: ((press: PadPress) => void)[] = [];
  private usingListeners: ((using: boolean) => void)[] = [];
  private using = false;
  /** Called when a pad is connected or the last one goes. */
  onConnect: (connected: boolean) => void = () => {};
  /** The pad's brand (`padBrands`), known once a pad is seen; changes with the pad. */
  brand = Object.keys(PAD_BRANDS)[0]!;
  private padId: string | undefined;
  /** Called when the pad in use is of another brand than before (decision 0186). */
  onBrand: (brand: string) => void = () => {};
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
    target.addEventListener('gamepadconnected', () => this.found());
    target.addEventListener('gamepaddisconnected', () => {
      if (!this.pad()) {
        this.since.clear();
        this.setUsing(false);
        this.onConnect(false);
      }
    });
    // Back on the keyboard, mouse or a finger: menus drop their pad focus ring. Not when the
    // event comes from the pad itself: Edge on Xbox also turns pad buttons into keys ("GamepadA")
    // or a pointer click (decision 0183), and dropping the ring on those swallowed every press.
    target.addEventListener(
      'keydown',
      (e) => {
        const button = KEY_BUTTONS[(e as KeyboardEvent).key];
        if (button) return this.keyButton(button, true, e as KeyboardEvent);
        this.away();
      },
      true,
    );
    target.addEventListener(
      'keyup',
      (e) => {
        const button = KEY_BUTTONS[(e as KeyboardEvent).key];
        if (button) this.keyButton(button, false, e as KeyboardEvent);
      },
      true,
    );
    target.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.padClick(e)) this.away();
      },
      true,
    );
    // The rest of the pad's pointer click (Edge on Xbox) is stopped too.
    for (const type of ['pointerup', 'mousedown', 'mouseup', 'click'])
      target.addEventListener(type, (e) => this.padClick(e), true);
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
    // Some browsers (Edge on Xbox) never send `gamepadconnected` for a pad that was already
    // there: look for one once a second until one is seen.
    if (!this.seen && now - this.lookedAt >= LOOK_EVERY_MS) {
      this.lookedAt = now;
      if (this.pad()) this.found();
    }
    const pad = this.seen ? this.pad() : null;
    if (pad && pad.id !== this.padId) this.noteBrand(pad);
    const keys = this.keyPresses.splice(0);
    if (!pad && !keys.length && !this.keyHeld.size) return null;
    const frame: PadFrame = pad
      ? readPad(pad, this.since, now, this.config)
      : { axes: { lx: 0, ly: 0, rx: 0, ry: 0 }, held: new Set(), presses: [] };
    // Presses `sample` caught between frames come first, in the order they happened.
    frame.presses.unshift(...this.sampled.splice(0));
    this.lastNow = now;
    if (frame.held.size) this.lastHeldAt = now;
    if (this.awayAt !== null) {
      if (padInUse(frame)) this.awayAt = null;
      else if (now - this.awayAt > KEY_ECHO_MS) {
        this.awayAt = null;
        this.setUsing(false);
      }
    }
    if (frame.presses.some((p) => !p.repeat)) {
      // A button the browser sent as a key a moment ago, and the Gamepad API only now: the key
      // already counted it, so the D-pad does not move twice (Guillaume: "random" on Xbox).
      frame.presses = frame.presses.filter((p) => {
        const at = this.keyAt.get(p.button);
        if (p.repeat || at === undefined || now - at > KEY_ECHO_MS) return true;
        this.keyAt.delete(p.button);
        return false;
      });
      // The Gamepad API reports presses: from now on it alone counts, the keys are echoes.
      this.apiPresses = true;
    }
    for (const [b, at] of this.keyAt) if (now - at > KEY_ECHO_MS) this.keyAt.delete(b);
    if (keys.length || this.keyHeld.size) {
      const held = new Set(frame.held);
      for (const b of this.keyHeld) held.add(b);
      frame.held = held;
      frame.presses.push(...keys);
    }
    if (padInUse(frame) || keys.length) this.setUsing(true);
    for (const press of frame.presses) for (const l of this.pressListeners) l(press);
    return frame;
  }

  /**
   * Read the pad's buttons between frames (decision 0183): the browser only shows a button's
   * state when asked, so a tap shorter than a frame (Xbox at 30 fps) was sometimes missed while
   * the stick, which is held, always worked. `main.ts` calls this every `sampleEveryMs`; the
   * presses it finds join the next frame's.
   */
  sample(now: number) {
    if (!this.seen) return;
    const pad = this.pad();
    if (pad) this.sampled.push(...readPad(pad, this.since, now, this.config).presses);
  }

  private found() {
    if (this.seen) return;
    this.seen = true;
    const pad = this.pad();
    if (pad) this.noteBrand(pad);
    this.onConnect(true);
  }

  private noteBrand(pad: PadLike) {
    this.padId = pad.id;
    const brand = padBrand(pad.id ?? '');
    if (brand === this.brand) return;
    this.brand = brand;
    this.onBrand(brand);
  }

  /**
   * Edge on Xbox's pointer mode clicks where its cursor is when A is pressed, while the Gamepad
   * API also reports A (decision 0183): the click moved the focus or pressed a second control,
   * and A felt unreliable. Once the API reports presses, a real pointer event while a pad button
   * is down or just released is the pad's: it is stopped. True when it was.
   */
  private padClick(e: Event): boolean {
    if (!e.isTrusted || !this.apiPresses) return false;
    const now = typeof performance === 'undefined' ? this.lastNow : performance.now();
    if (!this.padHeld() && now - this.lastHeldAt > KEY_ECHO_MS) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    return true;
  }

  /**
   * A key or a click: back on the keyboard, mouse or a finger, unless the pad made it. Edge on
   * Xbox can send the pad's key (an arrow) or click a moment before the Gamepad API shows the
   * button, so the switch waits `KEY_ECHO_MS` for the pad; dropping the focus ring at once made
   * the next pad press only show the focus again, and the D-pad felt random.
   */
  private away() {
    if (!this.using || this.padHeld()) return;
    if (!this.seen) return this.setUsing(false);
    this.awayAt ??= this.lastNow;
  }

  /** A pad button the browser sent as a key: a press for the next frame, unless the pad has it. */
  private keyButton(button: PadButton, down: boolean, e: KeyboardEvent) {
    // Keep the browser from acting on it (GamepadB is its Back).
    e.preventDefault?.();
    if (!down) {
      this.keyHeld.delete(button);
      return;
    }
    // The Gamepad API reports the same button (now, or since it first reported a press): the
    // frame has it already.
    if (this.apiPresses || this.padHeld()) return;
    this.keyHeld.add(button);
    this.keyAt.set(button, this.lastNow);
    this.keyPresses.push({ button, repeat: !!e.repeat });
  }

  /** Whether a pad has a button down or a stick leaning right now (its own key or click). */
  private padHeld(): boolean {
    const pad = this.pad();
    if (!pad) return false;
    return (
      pad.buttons.some((b) => b?.pressed || (b?.value ?? 0) >= this.config.triggerPress) ||
      pad.axes.some((a) => Math.abs(a) > 0.5)
    );
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
  /** Skip the lesson whose card is up (decision 0183). */
  skipLesson: boolean;
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
    skipLesson: false,
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
    else if (isFor(p, a.skipLesson)) out.skipLesson = true;
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
  /** Set a course to the port under the cross in the middle (decision 0183). */
  pick: boolean;
  /** Skip the lesson whose bubble is up. */
  skipLesson: boolean;
  /** Show the next good's prices on the ports (decision 0196). */
  nextGood: boolean;
  /** The previous (-1) or next (1) tab, 0 for none (decision 0196). */
  tab: number;
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
    pick: false,
    skipLesson: false,
    nextGood: false,
    tab: 0,
    other: [],
  };
  for (const p of f.presses) {
    if (isFor(p, a.zoomIn)) out.zoom *= c.zoomStep;
    else if (isFor(p, a.zoomOut)) out.zoom /= c.zoomStep;
    else if (p.repeat || [a.panLeft, a.panRight, a.panUp, a.panDown].some((l) => isFor(p, l)))
      continue;
    else if (isFor(p, a.fit)) out.fit = true;
    else if (isFor(p, a.close)) out.close = true;
    else if (isFor(p, a.pick)) out.pick = true;
    else if (isFor(p, a.skipLesson)) out.skipLesson = true;
    else if (isFor(p, a.nextGood)) out.nextGood = true;
    else if (isFor(p, a.tabPrev)) out.tab = -1;
    else if (isFor(p, a.tabNext)) out.tab = 1;
    else out.other.push(p);
  }
  return out;
}
