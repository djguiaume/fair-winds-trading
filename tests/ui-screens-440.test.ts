// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { PHASE1_MAP } from '../src/data/maps';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { SettingsApplier } from '../src/ui/screens/settings/apply';
import { loadSettings } from '../src/ui/settings';
import { PauseScreen } from '../src/ui/screens/pause';
import { NewVoyageScreen } from '../src/ui/screens/newVoyage';
import { choiceRow, sliderRow, switchRow } from '../src/ui/screens/settings/rows';
import { TitleScreen, type TitleState } from '../src/ui/screens/title';

/** The title, pause, New voyage and Settings rows of issue #440, without the game behind them. */

const noop = () => {};
const host = {
  play: noop,
  newVoyage: noop,
  freeSailing: noop,
  settings: noop,
  help: noop,
  lessons: noop,
  transfer: noop,
  setLanguage: noop,
};
const lessons = { label: 'Learn to sail & trade', note: '9 short steps', disabled: false };
const text = (root: HTMLElement, selector: string) => root.querySelector(selector)!.textContent;

describe('title', () => {
  it('makes the one main row Continue with the save line, and offers New voyage second', () => {
    setLanguage('en');
    const title = new TitleScreen(host);
    const state: TitleState = {
      primary: 'Continue',
      saveLine: 'Saltmere, day 12, 150 gold',
      offerNew: true,
      lessons,
    };
    title.update(state);
    const root = title.screen.root;
    expect(text(root, '#menu-play .ui-row-label')).toBe('Continue');
    expect(text(root, '#menu-play .ui-row-value')).toBe('Saltmere, day 12, 150 gold');
    expect(root.querySelector<HTMLElement>('#menu-new')!.hidden).toBe(false);
    expect(root.querySelectorAll('.title-row--main')).toHaveLength(1);
    title.update({ ...state, primary: 'New voyage', saveLine: null, offerNew: false });
    expect(text(root, '#menu-play .ui-row-label')).toBe('New voyage');
    expect(root.querySelector<HTMLElement>('#menu-new')!.hidden).toBe(true);
  });

  it('leaves Free Sailing out inside a session and takes a row before Settings', () => {
    const title = new TitleScreen({ ...host, freeSailing: null });
    title.addRow('menu-free-setup', 'Change ship or place', noop);
    const ids = [...title.screen.root.querySelectorAll('.title-menu > *')].map((r) => r.id);
    expect(ids).toEqual(['menu-play', 'menu-new', 'menu-free-setup', 'menu-settings']);
  });

  it('presses through to the host and marks the language in use', () => {
    const play = vi.fn();
    const setLanguageTo = vi.fn();
    const title = new TitleScreen({ ...host, play, setLanguage: setLanguageTo });
    title.screen.root.querySelector<HTMLElement>('#menu-play')!.click();
    expect(play).toHaveBeenCalledOnce();
    const fr = title.screen.root.querySelector<HTMLElement>('[data-language=fr]')!;
    fr.click();
    expect(setLanguageTo).toHaveBeenCalledWith('fr');
    expect(
      title.screen.root.querySelector('[data-language=en]')!.getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('pause', () => {
  it('has Resume, Chart, Settings and Quit to title, with Resume as the main row', () => {
    const pause = new PauseScreen({ resume: noop, chart: noop, settings: noop, quit: noop });
    const ids = [...pause.screen.root.querySelectorAll('.pause-list > *')].map((r) => r.id);
    expect(ids).toEqual(['pause-resume', 'pause-chart', 'pause-settings', 'pause-quit']);
    expect(pause.resume.classList.contains('title-row--main')).toBe(true);
    expect(pause.screen.back).toBeTypeOf('function');
  });
});

describe('new voyage', () => {
  it('sails on the level picked, preselected from the voyage', () => {
    const sail = vi.fn();
    const voyage = new NewVoyageScreen({ initial: 'captain', sail, close: noop });
    const root = voyage.screen.root;
    voyage.screen.onShow?.();
    expect(root.querySelector('[data-level=captain]')!.getAttribute('aria-checked')).toBe('true');
    root.querySelector<HTMLElement>('[data-level=fair]')!.click();
    root.querySelector<HTMLElement>('#set-sail')!.click();
    expect(sail).toHaveBeenCalledWith('fair');
  });
});

describe('settings rows', () => {
  it('a switch reads its value on refresh, writes on change, and greys out when disabled', () => {
    let on = false;
    let off = true;
    const row = switchRow({
      id: 'storms',
      key: 'settings.storms',
      get: () => on,
      set: (v) => (on = v),
      disabled: () => off,
    });
    row.refresh();
    const box = row.root.querySelector<HTMLInputElement>('input')!;
    expect(box.disabled).toBe(true);
    expect(row.root.querySelector('.ui-row-detail')!.textContent).toContain('no storms');
    off = false;
    row.refresh();
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(on).toBe(true);
  });

  it('a choice marks the chosen option', () => {
    let now = 'a';
    const row = choiceRow({
      id: 'c',
      key: 'settings.wind',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      get: () => now,
      set: (id) => (now = id),
    });
    row.root.querySelector<HTMLElement>('[data-choice=b]')!.click();
    row.refresh();
    expect(row.root.querySelector('[data-choice=b]')!.getAttribute('aria-checked')).toBe('true');
    expect(row.root.querySelector('[data-choice=a]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('a slider shows its percent, writes on input and saves when the drag ends', () => {
    let value = 60;
    const commit = vi.fn();
    const row = sliderRow({
      id: 's',
      key: 'settings.music',
      get: () => value,
      set: (v) => (value = v),
      commit,
    });
    row.refresh();
    const range = row.root.querySelector<HTMLInputElement>('input')!;
    expect(row.root.querySelector('output')!.textContent).toBe('60%');
    range.value = '25';
    range.dispatchEvent(new Event('input'));
    range.dispatchEvent(new Event('change'));
    expect(value).toBe(25);
    expect(row.root.querySelector('output')!.textContent).toBe('25%');
    expect(commit).toHaveBeenCalledOnce();
  });
});

describe('settings applier', () => {
  it('pushes every setting to the world, the view and the HUD', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const view = {
      effects: { shadows: true, occlusion: true, toneMapping: true, haze: true, reflection: true },
      setWaves: vi.fn(),
      dayNight: true,
      eruptions: true,
      wakeStyles: true,
    };
    const hud = { showLog: true };
    const camera = { sync: vi.fn() };
    const padGlyphs = vi.fn();
    const applier = new SettingsApplier({ world, view, hud, camera, padGlyphs });
    const settings = loadSettings();
    Object.assign(settings, {
      weather: false,
      ships: false,
      showLog: false,
      dayNight: false,
      haze: { fog: false },
      effects: { shadows: false },
      padGlyphs: 'playstation',
    });
    applier.apply(settings);
    expect(world.dynamicWeather).toBe(false);
    expect(world.traffic.on).toBe(false);
    expect(world.hazeOff).toContain('fog');
    expect(view.dayNight).toBe(false);
    expect(view.effects.shadows).toBe(false);
    expect(hud.showLog).toBe(false);
    expect(padGlyphs).toHaveBeenCalledWith('playstation');
    // Turning the ships back on starts them afresh; an unchanged setting is not re-sent.
    settings.ships = true;
    world.traffic.fresh = false;
    applier.apply(settings);
    expect(world.traffic.fresh).toBe(true);
    expect(view.setWaves).toHaveBeenCalledOnce();
    expect(padGlyphs).toHaveBeenCalledOnce();
  });
});
