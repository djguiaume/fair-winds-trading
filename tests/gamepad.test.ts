import { describe, expect, it } from 'vitest';
import {
  GamepadPoller,
  PAD,
  PAD_BUTTONS,
  chartPad,
  controlProblems,
  readPad,
  seaPad,
  shapeAxis,
  type HeldSince,
  type PadButton,
  type PadLike,
} from '../src/input/gamepad';

/** A standard pad with these buttons down and these stick values. */
function fakePad(down: PadButton[] = [], axes: number[] = [0, 0, 0, 0]): PadLike {
  return {
    connected: true,
    mapping: 'standard',
    axes,
    buttons: PAD_BUTTONS.map((b) => ({
      pressed: down.includes(b),
      value: down.includes(b) ? 1 : 0,
    })),
  };
}

describe('game controller (decision 0162)', () => {
  it('the controls file names real buttons and axes', () => {
    expect(controlProblems()).toEqual([]);
    const bad = structuredClone(PAD);
    (bad.sea.actions.sailUp as string[]) = ['rb', 'start'];
    bad.sea.actions.pause = [];
    expect(controlProblems(bad)).toEqual(['sea.sailUp: no button "start"', 'sea.pause: no button']);
  });

  it('sticks have a dead zone and still reach full', () => {
    expect(shapeAxis(0.1, 0.2)).toBe(0);
    expect(shapeAxis(-0.2, 0.2)).toBe(0);
    expect(shapeAxis(0.6, 0.2)).toBeCloseTo(0.5);
    expect(shapeAxis(-1, 0.2)).toBe(-1);
  });

  it('reports a press once, then repeats while held', () => {
    const since: HeldSince = new Map();
    const at = (ms: number, down: PadButton[]) =>
      readPad(fakePad(down), since, ms, PAD).presses.map(
        (p) => `${p.button}${p.repeat ? '+' : ''}`,
      );
    expect(at(0, ['up'])).toEqual(['up']);
    expect(at(100, ['up'])).toEqual([]);
    expect(at(PAD.repeatDelayMs, ['up'])).toEqual(['up+']);
    expect(at(PAD.repeatDelayMs + 10, ['up'])).toEqual([]);
    expect(at(PAD.repeatDelayMs + PAD.repeatEveryMs, ['up'])).toEqual(['up+']);
    expect(at(2000, [])).toEqual([]);
    expect(at(2010, ['up'])).toEqual(['up']);
  });

  it('an analog trigger counts once pressed far enough', () => {
    const pad = fakePad();
    const rt = PAD_BUTTONS.indexOf('rt');
    (pad.buttons as { pressed: boolean; value: number }[])[rt] = { pressed: true, value: 0.2 };
    expect(readPad(pad, new Map(), 0, PAD).held.has('rt')).toBe(false);
    (pad.buttons as { pressed: boolean; value: number }[])[rt] = { pressed: true, value: 0.8 };
    expect(readPad(pad, new Map(), 0, PAD).held.has('rt')).toBe(true);
  });

  it('at sea: stick steers, bumpers step the sails, B strikes them, View opens the chart', () => {
    const since: HeldSince = new Map();
    let f = seaPad(readPad(fakePad(['rb'], [0.6, 0, 0, 0]), since, 0, PAD), 1 / 60);
    expect(f.steer).toBeCloseTo(0.5);
    expect(f.sail).toBe(1);
    // Holding the bumper does not run the sails up.
    f = seaPad(readPad(fakePad(['rb', 'left'], [0.6, 0, 0, 0]), since, 5000, PAD), 1 / 60);
    expect(f.sail).toBe(0);
    expect(f.steer).toBe(-1);
    f = seaPad(readPad(fakePad(['lb', 'b', 'view']), new Map(), 0, PAD), 1 / 60);
    expect(f).toMatchObject({ sail: -1, strike: true, chart: true, pause: false, zoom: 1 });
    f = seaPad(readPad(fakePad(['menu', 'x']), new Map(), 0, PAD), 1 / 60);
    expect(f.pause).toBe(true);
    // X is free at sea: it goes on to the menus.
    expect(f.other).toEqual([{ button: 'x', repeat: false }]);
    // The map is on View, as in most console games; Y skips a lesson's bubble (decision 0183).
    expect(seaPad(readPad(fakePad(['y']), new Map(), 0, PAD), 1 / 60)).toMatchObject({
      chart: false,
      skipLesson: true,
      other: [],
    });
    // Right stick up zooms the camera in.
    expect(seaPad(readPad(fakePad([], [0, 0, 0, -1]), new Map(), 0, PAD), 0.5).zoom).toBeLessThan(
      1,
    );
    // Right stick sideways turns the camera to look right; a click on it resets (decision 0223).
    const turn = seaPad(readPad(fakePad([], [0, 0, 1, 0]), new Map(), 0, PAD), 0.5);
    expect(turn.turn).toBeCloseTo((PAD.sea.orbitDegPerSec * 0.5 * Math.PI) / 180);
    expect(seaPad(readPad(fakePad(['rs']), new Map(), 0, PAD), 1 / 60)).toMatchObject({
      resetCamera: true,
      other: [],
    });
  });

  it('on the chart: stick pans, triggers zoom, B closes', () => {
    const f = chartPad(readPad(fakePad(['rt', 'b'], [-1, 0, 0, 0]), new Map(), 0, PAD), 0.1);
    expect(f.panX).toBeCloseTo(-PAD.chart.panPxPerSec * 0.1);
    expect(f.panY).toBe(0);
    expect(f.zoom).toBe(PAD.chart.zoomStep);
    expect(f.close).toBe(true);
  });

  it('polls nothing until a pad is seen, then tells listeners', () => {
    const { poller, fire, reads, setPads } = rig([]);
    expect(poller.poll(0)).toBeNull();
    expect(reads()).toBe(1); // one look for a pad no event announced
    expect(poller.poll(500)).toBeNull();
    expect(reads()).toBe(1); // and not again within the second
    setPads([fakePad(['a'])]);
    const presses: string[] = [];
    const using: boolean[] = [];
    poller.onPress((p) => presses.push(p.button));
    poller.onUsingPad((u) => using.push(u));
    fire('gamepadconnected');
    expect(poller.poll(516)?.held.has('a')).toBe(true);
    expect(presses).toEqual(['a']);
    expect(using).toEqual([true]);
    setPads([fakePad()]);
    fire('keydown', { key: 'ArrowUp' });
    // The pad gets a moment to show it made the key (Edge on Xbox), then the ring goes.
    poller.poll(600);
    expect(poller.usingPad).toBe(true);
    poller.poll(1000);
    expect(poller.usingPad).toBe(false);
    setPads([null]);
    fire('gamepaddisconnected');
    expect(poller.poll(1032)).toBeNull();
  });

  it('finds a pad the browser never announced (Edge on Xbox, decision 0183)', () => {
    const { poller } = rig([fakePad(['a'])]);
    const connected: boolean[] = [];
    poller.onConnect = (c) => connected.push(c);
    expect(poller.poll(0)?.presses.map((p) => p.button)).toEqual(['a']);
    expect(connected).toEqual([true]);
  });

  it("keeps the pad's focus when the pad's own key or click arrives", () => {
    const { poller, fire, setPads } = rig([fakePad()]);
    fire('gamepadconnected');
    setPads([fakePad(['a'])]);
    poller.poll(0);
    expect(poller.usingPad).toBe(true);
    fire('pointerdown'); // Edge's pointer mode clicks with A too
    fire('keydown', { key: 'Enter' });
    expect(poller.usingPad).toBe(true);
  });

  it('takes pad buttons sent as keys once, and not twice with the Gamepad API', () => {
    const { poller, fire, setPads } = rig([]);
    let prevented = 0;
    const key = (k: string, extra = {}) => ({
      key: k,
      preventDefault: () => prevented++,
      ...extra,
    });
    fire('keydown', key('GamepadDPadDown'));
    const f = poller.poll(0)!;
    expect(f.presses).toEqual([{ button: 'down', repeat: false }]);
    expect(f.held.has('down')).toBe(true);
    expect(poller.usingPad).toBe(true);
    fire('keyup', key('GamepadDPadDown'));
    expect(poller.poll(16)).toBeNull();
    fire('keydown', key('GamepadB'));
    expect(prevented).toBe(3); // the browser does not go Back
    poller.poll(32);
    // Both at once: the Gamepad API's frame has the press, the key adds nothing.
    setPads([fakePad()]);
    fire('gamepadconnected');
    poller.poll(48);
    setPads([fakePad(['a'])]);
    fire('keydown', key('GamepadA'));
    expect(poller.poll(64)!.presses.map((p) => p.button)).toEqual(['a']);
  });

  it('moves once when Edge sends the D-pad as a key before the Gamepad API shows it', () => {
    const { poller, fire, setPads } = rig([fakePad()]);
    fire('gamepadconnected');
    poller.poll(0);
    const key = { key: 'GamepadDPadDown', preventDefault: () => {} };
    fire('keydown', key); // the key first…
    expect(poller.poll(16)!.presses.map((p) => p.button)).toEqual(['down']);
    setPads([fakePad(['down'])]); // …then the API: the same press, not a second one
    expect(poller.poll(32)!.presses).toEqual([]);
    setPads([fakePad()]);
    poller.poll(48);
    // The API reports presses now: later keys for pad buttons are only echoes.
    fire('keydown', key);
    expect(poller.poll(64)!.presses).toEqual([]);
  });

  it('keeps the focus ring when an arrow key comes just before the pad shows the D-pad', () => {
    const { poller, fire, setPads } = rig([fakePad(['a'])]);
    fire('gamepadconnected');
    poller.poll(0);
    setPads([fakePad()]);
    poller.poll(16);
    fire('keydown', { key: 'ArrowDown' }); // Edge's key for the D-pad
    setPads([fakePad(['down'])]);
    poller.poll(32);
    poller.poll(600);
    expect(poller.usingPad).toBe(true);
  });

  it("stops Edge's pointer click that comes with the pad's A (decision 0183)", () => {
    const { poller, fire, setPads } = rig([fakePad()]);
    fire('gamepadconnected');
    poller.poll(0);
    setPads([fakePad(['a'])]);
    poller.poll(16); // the API reports A
    let stopped = 0;
    const click = (isTrusted: boolean) => ({
      isTrusted,
      preventDefault: () => {},
      stopImmediatePropagation: () => stopped++,
    });
    fire('pointerdown', click(true));
    fire('click', click(true));
    expect(stopped).toBe(2);
    fire('click', click(false)); // the game's own el.click() goes through
    expect(stopped).toBe(2);
    expect(poller.usingPad).toBe(true);
  });

  it('takes the D-pad as keys when only the bumpers come through the API (decision 0199)', () => {
    // Edge on Xbox in pointer mode: LB/RB/LT/RT reach the Gamepad API, the D-pad and A only
    // come as keys. A bumper once pressed must not make every later D-pad key an "echo".
    const { poller, fire, setPads } = rig([fakePad()]);
    fire('gamepadconnected');
    poller.poll(0);
    setPads([fakePad(['rb'])]);
    expect(poller.poll(16)!.presses.map((p) => p.button)).toEqual(['rb']);
    setPads([fakePad()]);
    poller.poll(32);
    fire('keydown', { key: 'GamepadDPadDown', preventDefault: () => {} });
    expect(poller.poll(48)!.presses.map((p) => p.button)).toEqual(['down']);
    fire('keyup', { key: 'GamepadDPadDown', preventDefault: () => {} });
    poller.poll(64);
    fire('keydown', { key: 'GamepadA', preventDefault: () => {} });
    expect(poller.poll(80)!.presses.map((p) => p.button)).toEqual(['a']);
  });

  it('on a TV: arrows and Enter are the pad, always in use, its cursor clicks stopped', () => {
    const { poller, fire } = rig([fakePad()], true);
    expect(poller.usingPad).toBe(true);
    fire('gamepadconnected');
    poller.poll(0);
    let stopped = 0;
    const key = (k: string) => ({
      key: k,
      preventDefault: () => {},
      stopImmediatePropagation: () => stopped++,
    });
    fire('keydown', key('ArrowDown'));
    expect(poller.poll(16)!.presses.map((p) => p.button)).toEqual(['down']);
    expect(stopped).toBe(1); // the arrow does not also steer the boat as a key
    fire('keyup', key('ArrowDown'));
    poller.poll(32);
    fire('keydown', key('Enter'));
    expect(poller.poll(48)!.presses.map((p) => p.button)).toEqual(['a']);
    // The cursor's click that came with A is the pad's: stopped, the focus stays.
    const click = {
      isTrusted: true,
      preventDefault: () => {},
      stopImmediatePropagation: () => stopped++,
    };
    fire('pointerdown', click);
    expect(stopped).toBe(4); // arrow down and up, Enter, the click
    fire('keyup', key('Enter'));
    fire('keydown', { key: 'q' });
    poller.poll(2000);
    expect(poller.usingPad).toBe(true);
  });

  it('catches a tap shorter than a frame by reading between frames (decision 0183)', () => {
    const { poller, fire, setPads } = rig([fakePad()]);
    fire('gamepadconnected');
    poller.poll(0);
    setPads([fakePad(['a'])]);
    poller.sample(8); // down…
    setPads([fakePad()]);
    poller.sample(16); // …and up again before the frame
    const f = poller.poll(33)!;
    expect(f.presses).toEqual([{ button: 'a', repeat: false }]);
    expect(f.held.size).toBe(0);
    expect(poller.poll(50)!.presses).toEqual([]); // once
  });
});

/** A poller over fake pads, with the events it listens to. */
function rig(start: (PadLike | null)[], tv = false) {
  const listeners: Record<string, ((e?: unknown) => void)[]> = {};
  let pads = start;
  let reads = 0;
  const target = {
    addEventListener: (type: string, fn: (e?: unknown) => void) =>
      (listeners[type] ??= []).push(fn),
  } as unknown as Window;
  const poller = new GamepadPoller(
    {
      getGamepads: () => {
        reads++;
        return pads;
      },
    },
    target,
    PAD,
    tv,
  );
  const fire = (type: string, e: unknown = {}) => listeners[type]?.forEach((fn) => fn(e));
  return { poller, fire, reads: () => reads, setPads: (p: (PadLike | null)[]) => (pads = p) };
}
