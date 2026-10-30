import { describe, expect, it } from 'vitest';
import { TV, isTv, startTvMode, tvProblems, type TvConfig, type TvWindow } from '../src/input/tv';

const XBOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

/** A window with just what TV mode touches, recording what it did. */
function fakeWindow(userAgent: string, search = '') {
  const listeners: Record<string, (() => void)[]> = {};
  const vars: Record<string, string> = {};
  const classes = new Set<string>();
  const pushed: unknown[] = [];
  const win = {
    navigator: { userAgent } as TvWindow['navigator'],
    location: { search },
    history: {
      state: null as unknown,
      pushState(state: unknown) {
        pushed.push(state);
        this.state = state;
      },
    },
    document: {
      documentElement: {
        classList: { add: (c: string) => classes.add(c) },
        style: { setProperty: (k: string, v: string) => (vars[k] = v) },
      },
    },
    addEventListener: (type: string, l: () => void) => (listeners[type] ??= []).push(l),
  };
  const fire = (type: string) => listeners[type]?.forEach((l) => l());
  return { win: win as unknown as TvWindow, raw: win, listeners, vars, classes, pushed, fire };
}

describe('TV mode (decision 0183)', () => {
  it('has a valid data section', () => {
    expect(tvProblems()).toEqual([]);
    const bad: TvConfig = { ...TV, userAgents: [], safeMargin: { x: 0.5, y: 0.05 } };
    expect(tvProblems(bad)).toEqual([
      'tv.userAgents: needs at least one non-empty word',
      'tv.safeMargin.x must be 0..0.2',
    ]);
  });

  it('knows Edge on Xbox, and ?tv wins over the user agent', () => {
    expect(isTv(XBOX, '')).toBe(true);
    expect(isTv(DESKTOP, '')).toBe(false);
    expect(isTv(DESKTOP, '?tv')).toBe(true);
    expect(isTv(XBOX, '?map=phase4&tv=0')).toBe(false);
  });

  it('does nothing on a desktop browser', () => {
    const f = fakeWindow(DESKTOP);
    expect(startTvMode(f.win)).toBe(false);
    expect(f.raw.navigator.gamepadInputEmulation).toBeUndefined();
    expect(f.classes.size).toBe(0);
    expect(Object.keys(f.listeners)).toEqual([]);
  });

  it('hands the pad to the game and keeps clear of the edges on Xbox', () => {
    const f = fakeWindow(XBOX);
    expect(startTvMode(f.win)).toBe(true);
    expect(f.raw.navigator.gamepadInputEmulation).toBe('gamepad');
    expect(f.classes.has('tv')).toBe(true);
    expect(f.vars['--tv-safe-x']).toBe(`${TV.safeMargin.x * 100}vw`);
    expect(f.vars['--tv-safe-y']).toBe(`${TV.safeMargin.y * 100}vh`);
  });

  it('keeps one extra history entry so Back stays in the game', () => {
    const f = fakeWindow(XBOX);
    startTvMode(f.win);
    expect(f.pushed).toHaveLength(0); // not before the player touches the page
    f.fire('pointerdown');
    f.fire('keydown');
    expect(f.pushed).toHaveLength(1);
    f.raw.history.state = null; // Back took it away
    f.fire('popstate');
    expect(f.pushed).toHaveLength(2);
  });
});

describe('controller texts and the chart cross (decision 0183)', () => {
  it('A on the chart picks the port under the cross, Y skips the lesson', async () => {
    const { PAD, chartPad, readPad, PAD_BUTTONS } = await import('../src/input/gamepad');
    const pad = (down: string[]) => ({
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: PAD_BUTTONS.map((b) => ({
        pressed: down.includes(b),
        value: down.includes(b) ? 1 : 0,
      })),
    });
    expect(chartPad(readPad(pad(['a']), new Map(), 0, PAD), 1 / 60)).toMatchObject({
      pick: true,
      other: [],
    });
    expect(chartPad(readPad(pad(['y']), new Map(), 0, PAD), 1 / 60)).toMatchObject({
      skipLesson: true,
    });
  });
});
