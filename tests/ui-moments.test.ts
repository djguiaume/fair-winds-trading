// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO, EVENT_NAMES, UI_EVENTS, audioProblems } from '../src/audio/catalog';
import { SYNTHS } from '../src/audio/synths';
import { UI_SYNTHS } from '../src/audio/uiSfx';
import { TUNING } from '../src/data/tuning';
import { setLanguage, t } from '../src/i18n';
import { PHASE1_MAP } from '../src/data/maps';
import { ArrivalWatch, arrivalSpots, taglineOf } from '../src/ui/moments/arrival';
import { Moments } from '../src/ui/moments';
import { MomentBanner } from '../src/ui/moments/banner';
import { placeOf, raceBoardHtml } from '../src/ui/moments/raceBoard';
import { forgetStamps, stampCard, stampWord } from '../src/ui/moments/stamp';
import { TradeTicks } from '../src/ui/moments/tradeTicks';
import { playEnter, reducedMotion, resetMotionQuery } from '../src/ui/motion';
import { setMotionMode } from '../src/ui/motionMode';
import { setNightPaper } from '../src/ui/nightPaper';
import { connectUiSounds } from '../src/ui/uiSound';
import { button } from '../src/ui/components';
import type { QuestCardModel } from '../src/ui/questView';
import type { RaceCardInfo } from '../src/ui/regattaView';

// The moments and the interface's sounds (decision 0274).
afterEach(() => {
  setMotionMode(null);
  connectUiSounds(null);
  resetMotionQuery();
  vi.unstubAllGlobals();
  forgetStamps();
  document.body.replaceChildren();
});
beforeEach(() => {
  setLanguage('en');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

const range = { arrivalRadius: 10, arrivalRearm: 30 };
const spots = [
  { id: 'saltmere', x: 0, y: 0 },
  { id: 'calda', x: 100, y: 0 },
];

describe('arrival watch', () => {
  it('announces a port once on entering its waters, and again only after sailing away', () => {
    const watch = new ArrivalWatch(spots, range);
    const known = () => true;
    expect(watch.step(50, 0, null, known)).toBeNull();
    expect(watch.step(8, 0, null, known)).toBe('saltmere');
    expect(watch.step(5, 0, null, known)).toBeNull();
    expect(watch.step(20, 0, null, known)).toBeNull(); // still inside the re-arm range
    expect(watch.step(40, 0, null, known)).toBeNull(); // out: armed again
    expect(watch.step(9, 0, null, known)).toBe('saltmere');
  });

  it('stays silent while docked and for the port she leaves from', () => {
    const watch = new ArrivalWatch(spots, range);
    expect(watch.step(0, 0, 'saltmere', () => true)).toBeNull();
    expect(watch.step(4, 0, null, () => true)).toBeNull(); // just undocked
    expect(watch.step(60, 0, null, () => true)).toBeNull();
    expect(watch.step(95, 0, null, () => true)).toBe('calda');
  });

  it('leaves out a port she has not found', () => {
    const watch = new ArrivalWatch(spots, range);
    expect(watch.step(0, 0, null, (id) => id !== 'saltmere')).toBeNull();
  });

  it('finds the harbours of the map and names the taglines in both languages', () => {
    const real = arrivalSpots(PHASE1_MAP);
    expect(real.length).toBeGreaterThan(5);
    expect(real.map((s) => s.id)).toContain('saltmere');
    expect(taglineOf('saltmere')).toBe('Home port');
    setLanguage('fr');
    expect(taglineOf('saltmere')).toBe("Port d'attache");
    expect(taglineOf('no-such-port')).toBeUndefined();
  });
});

describe('banner', () => {
  it('drops in, waits, sinks, and a new show replaces the old one', () => {
    const timers: (() => void)[] = [];
    const banner = new MomentBanner('arrival', { set: (run) => timers.push(run) });
    banner.show('Saltmere', 'Home port', 2000);
    expect(banner.visible).toBe(true);
    expect(banner.root.dataset.enter).toBe('drop');
    banner.show('Calda', undefined, 2000);
    timers.shift()!(); // the first show's time is up, but it is not the latest
    expect(banner.root.dataset.leave).toBeUndefined();
    timers.shift()!();
    expect(banner.root.dataset.leave).toBe('');
    timers.shift()!();
    expect(banner.visible).toBe(false);
    expect(banner.root.querySelector('.moment-line')!.hasAttribute('hidden')).toBe(true);
  });
});

describe('motion mode', () => {
  it('Reduced and Off hold still whatever the device says; Full moves', () => {
    const el = document.createElement('div');
    setMotionMode('reduced');
    expect(reducedMotion()).toBe(true);
    playEnter(el, 'drop');
    expect(el.dataset.enter).toBeUndefined();
    setMotionMode('full');
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    resetMotionQuery();
    expect(reducedMotion()).toBe(false);
    setMotionMode(null); // until chosen, the device decides
    expect(reducedMotion()).toBe(true);
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it('cross-fades the paper over the dusk, not at all when motion is reduced', () => {
    vi.useFakeTimers();
    const root = document.createElement('html');
    setNightPaper(0.8, root);
    expect(root.hasAttribute('data-night')).toBe(true);
    expect(root.hasAttribute('data-dusk')).toBe(true);
    vi.advanceTimersByTime(TUNING.ui.duskFadeMs + 1);
    expect(root.hasAttribute('data-dusk')).toBe(false);
    setMotionMode('reduced');
    setNightPaper(0.1, root);
    expect(root.hasAttribute('data-night')).toBe(false);
    expect(root.hasAttribute('data-dusk')).toBe(false);
    vi.useRealTimers();
  });
});

const card = (over: Partial<QuestCardModel>): QuestCardModel =>
  ({
    quest: 'q',
    kind: 'step',
    mood: 'neutral',
    arc: 'Arc',
    stepNo: 2,
    steps: 3,
    main: true,
    ...over,
  }) as QuestCardModel;

describe('quest stamp', () => {
  it('stamps a step done and a quest complete, once, and never an offer or a race', () => {
    const played: string[] = [];
    connectUiSounds((e) => played.push(e));
    expect(stampWord(card({ kind: 'offer', stepNo: 1 }))).toBeNull();
    expect(stampWord(card({ stepNo: 1 }))).toBeNull();
    expect(stampWord(card({ kind: 'finished', race: {} as RaceCardInfo }))).toBeNull();
    const host = document.createElement('div');
    stampCard(host, card({ kind: 'finished' }));
    stampCard(host, card({ kind: 'finished' }));
    expect(host.querySelectorAll('.moment-stamp')).toHaveLength(1);
    expect(host.textContent).toBe(t('moments.stamp.complete'));
    expect(host.querySelector<HTMLElement>('.moment-stamp')!.dataset.enter).toBe('stamp');
    expect(played).toEqual(['stamp']);
  });

  it('draws nothing with Motion off, but the thump still sounds', () => {
    const played: string[] = [];
    connectUiSounds((e) => played.push(e));
    setMotionMode('off');
    const host = document.createElement('div');
    stampCard(host, card({ kind: 'step' }));
    expect(host.children).toHaveLength(0);
    expect(played).toEqual(['stamp']);
  });
});

describe('trade ticks', () => {
  it('rolls the gold and the hold from their old values after the redraw', () => {
    const frames: ((now: number) => void)[] = [];
    let now = 0;
    const clock = { now: () => now, request: (f: (n: number) => void) => frames.push(f) };
    const state = { gold: 100, used: 2, cap: 10 };
    const played: string[] = [];
    const ticks = new TradeTicks(
      () => ({ ...state }),
      (e) => played.push(e),
      400,
      clock,
    );
    const draw = () => {
      const root = document.createElement('div');
      root.innerHTML = `<span class="port-chip"><b>${state.gold}</b></span><span class="port-chip"><b>${state.used}/${state.cap}</b></span>`;
      return root;
    };
    ticks.settle(draw()); // the screen opens: remembers 100 gold
    state.gold = 160;
    state.used = 5;
    ticks.traded();
    const root = draw();
    ticks.settle(root);
    const [gold, hold] = root.querySelectorAll('b');
    expect(played).toEqual(['coin']);
    expect(gold!.textContent).toBe('100');
    expect(hold!.textContent).toBe('2/10');
    expect(gold!.parentElement!.dataset.enter).toBe('pulse');
    now = 400;
    frames.shift()!(now);
    expect(gold!.textContent).toBe('160');
    expect(hold!.textContent).toBe('5/10');
    expect(ticks.rolling).toBe(0);
    ticks.settle(draw()); // a plain redraw rolls nothing
    expect(frames).toHaveLength(0);
  });
});

describe('finish board', () => {
  const info = (result: RaceCardInfo['result']): RaceCardInfo => ({
    times: [{ medal: 'gold', sec: 61, gold: 0, won: false }],
    again: true,
    label: 'Medal times for your sloop',
    series: 'The Saltmere Regatta',
    best: 62.3,
    result,
  });

  it('places only: first with no rival ahead, second with a medal, third without', () => {
    expect(placeOf({ medal: 2 })).toBe('first');
    expect(placeOf({ medal: 1, rival: 60 })).toBe('second');
    expect(placeOf({ medal: 0, rival: 60 })).toBe('third');
  });

  it('shows the place line, the times and the medal list', () => {
    const html = raceBoardHtml(info({ sec: 65.4, medal: 1, rival: 63, gold: 20 }), '<li>x</li>');
    expect(html).toContain('Second, close behind.');
    expect(html).toContain('1:05.4');
    expect(html).toContain('1:03.0');
    expect(html).toContain('is-bronze');
    expect(html).toContain('<li>x</li>');
    setLanguage('fr');
    expect(raceBoardHtml(info({ sec: 70, medal: 0, rival: 60, gold: 0 }), '')).toContain(
      'Troisième, et bien rentré.',
    );
  });
});

describe('interface sounds', () => {
  it('has an effect for every event and a synth for every effect', () => {
    expect(audioProblems()).toEqual([]);
    for (const name of UI_EVENTS) {
      expect(EVENT_NAMES).toContain(name);
      const effect = AUDIO.effects[AUDIO.events[name].effect]!;
      expect('synth' in effect && SYNTHS[effect.synth], name).toBeTypeOf('function');
    }
  });

  it('plays each interface synth on the audio clock without throwing', () => {
    const node: unknown = new Proxy(() => node, {
      get: (_t, key) =>
        key === 'currentTime'
          ? 0
          : key === 'sampleRate'
            ? 44100
            : key === 'connect'
              ? () => node
              : node,
      apply: () => node,
    });
    const ctx = {
      currentTime: 0,
      sampleRate: 44100,
      createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
      createOscillator: () => node,
      createGain: () => node,
      createBiquadFilter: () => node,
      createBufferSource: () => node,
    } as unknown as BaseAudioContext;
    for (const play of Object.values(UI_SYNTHS))
      expect(() => play(ctx, node as AudioNode, 0.5, 1)).not.toThrow();
  });

  it('is heard from a pressed component: confirm for primary, error when soft-disabled', () => {
    const played: string[] = [];
    connectUiSounds((e) => played.push(e));
    button({ label: 'Go', variant: 'primary', onPress: () => {} }).click();
    button({ label: 'Later', onPress: () => {} }).click();
    button({ label: 'No', disabled: true, onPress: () => {} }).click();
    expect(played).toEqual(['confirm', 'press', 'error']);
  });
});

describe('moments at sea', () => {
  const stub = () => {
    const saltmere = arrivalSpots(PHASE1_MAP).find((s) => s.id === 'saltmere')!;
    const world = {
      map: PHASE1_MAP,
      boat: { x: saltmere.x + 300, y: saltmere.y },
      trade: { dockedAt: null as string | null, progress: { discovered: ['saltmere'] } },
    };
    const played: string[] = [];
    let left: number | null = null;
    const moments = new Moments({
      world: world as never,
      play: (e) => played.push(e),
      raceLeft: () => left,
    });
    return { world, saltmere, played, moments, setLeft: (n: number | null) => (left = n) };
  };

  it('announces a port once as the boat comes in, with its tagline and a chime', () => {
    const { world, saltmere, played, moments } = stub();
    moments.update(0.3, false);
    expect(moments.banner.visible).toBe(false);
    world.boat.x = saltmere.x + 20;
    moments.update(0.3, true); // a screen is over the sea: nothing is said yet
    expect(moments.banner.visible).toBe(false);
    moments.update(0.3, false);
    expect(moments.banner.visible).toBe(true);
    expect(moments.banner.root.textContent).toContain('Home port');
    expect(played).toEqual(['arrival']);
    moments.update(0.3, false);
    expect(played).toEqual(['arrival']);
  });

  it('says nothing with Motion off, and counts down to the horn from ten', () => {
    const { moments, setLeft } = stub();
    setLeft(12);
    moments.update(0.3, false);
    expect(moments.horn.visible).toBe(false);
    setLeft(9.2);
    moments.update(0.3, false);
    expect(moments.horn.visible).toBe(true);
    expect(moments.horn.text).toBe('Horn in 10');
    setLeft(null);
    moments.update(0.3, false);
    expect(moments.horn.visible).toBe(false);
    setMotionMode('off');
    const quiet = stub();
    quiet.world.boat.x = quiet.saltmere.x + 10;
    quiet.moments.update(0.3, false);
    expect(quiet.moments.banner.visible).toBe(false);
  });
});
