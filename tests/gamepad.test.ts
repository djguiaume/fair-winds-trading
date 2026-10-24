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

  it('at sea: stick steers, bumpers step the sails, B strikes them, Y opens the chart', () => {
    const since: HeldSince = new Map();
    let f = seaPad(readPad(fakePad(['rb'], [0.6, 0, 0, 0]), since, 0, PAD), 1 / 60);
    expect(f.steer).toBeCloseTo(0.5);
    expect(f.sail).toBe(1);
    // Holding the bumper does not run the sails up.
    f = seaPad(readPad(fakePad(['rb', 'left'], [0.6, 0, 0, 0]), since, 5000, PAD), 1 / 60);
    expect(f.sail).toBe(0);
    expect(f.steer).toBe(-1);
    f = seaPad(readPad(fakePad(['lb', 'b', 'y']), new Map(), 0, PAD), 1 / 60);
    expect(f).toMatchObject({ sail: -1, strike: true, chart: true, pause: false, zoom: 1 });
    f = seaPad(readPad(fakePad(['menu', 'x']), new Map(), 0, PAD), 1 / 60);
    expect(f.pause).toBe(true);
    // X is free at sea: it goes on to the menus.
    expect(f.other).toEqual([{ button: 'x', repeat: false }]);
    // Right stick up zooms the camera in.
    expect(seaPad(readPad(fakePad([], [0, 0, 0, -1]), new Map(), 0, PAD), 0.5).zoom).toBeLessThan(
      1,
    );
  });

  it('on the chart: stick pans, triggers zoom, B closes', () => {
    const f = chartPad(readPad(fakePad(['rt', 'b'], [-1, 0, 0, 0]), new Map(), 0, PAD), 0.1);
    expect(f.panX).toBeCloseTo(-PAD.chart.panPxPerSec * 0.1);
    expect(f.panY).toBe(0);
    expect(f.zoom).toBe(PAD.chart.zoomStep);
    expect(f.close).toBe(true);
  });

  it('polls nothing until a pad is seen, then tells listeners', () => {
    const listeners: Record<string, (() => void)[]> = {};
    const target = {
      addEventListener: (type: string, fn: () => void) => (listeners[type] ??= []).push(fn),
    } as unknown as Window;
    let reads = 0;
    let pads: (PadLike | null)[] = [fakePad(['a'])];
    const poller = new GamepadPoller(
      {
        getGamepads: () => {
          reads++;
          return pads;
        },
      },
      target,
    );
    expect(poller.poll(0)).toBeNull();
    expect(reads).toBe(0);
    const presses: string[] = [];
    const using: boolean[] = [];
    poller.onPress((p) => presses.push(p.button));
    poller.onUsingPad((u) => using.push(u));
    for (const fn of listeners.gamepadconnected ?? []) fn();
    expect(poller.poll(16)?.held.has('a')).toBe(true);
    expect(presses).toEqual(['a']);
    expect(using).toEqual([true]);
    for (const fn of listeners.keydown ?? []) fn();
    expect(poller.usingPad).toBe(false);
    pads = [null];
    for (const fn of listeners.gamepaddisconnected ?? []) fn();
    expect(poller.poll(32)).toBeNull();
  });
});
