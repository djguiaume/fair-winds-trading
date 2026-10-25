/* global console, window, document, localStorage, setTimeout, URL, URLSearchParams, structuredClone, Event */
// `npm run shots` (decision 0153): standard screenshots of the real game, instead of a Playwright
// script per review. It starts Vite itself, opens the game with `?debug`, gets past the menu, the
// level card, the tutorial offer and the harbour, sets the scene through `window.fwt` (the boat's
// `place`, `dock`, the view, the chart) and shoots each size.
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
import { ROOT, startVite } from './lib.mjs';

/** The three sizes every look review shows (desktop first, must look good in portrait). */
export const SIZES = {
  desktop: { width: 1280, height: 800 },
  landscape: { width: 844, height: 390, touch: true },
  portrait: { width: 390, height: 844, touch: true },
};

export const HELP = `npm run shots -- [options]          screenshots of the real game, PNG in --out

Where
  --sea ring|stress|phase4|file.json   the sea (a file: a map editor export, played as ?map=edited)
  --island a.json,b.json        island files to play instead of the shipped ones (builder exports)
  --at x,y                      boat at sea there (default: docked at the start port)
  --prologue                    a new voyage as a player who skips the tutorial meets it: alone at
                                sea, sails down, the rescue to play (0160); without it the tools
                                drop that story and start at the map's start, as before
  --heading deg                 boat heading, compass degrees (default: wind on the beam)
  --sail 0|1|2                  sails furled, half, full (default 2)
  --speed kn                    starting speed (default 5)
  --ship id                     sail this ship (sloop, schooner, fluyt, …)
  --hold Key:ms                 hold a key that long before the shot (e.g. ArrowUp:2500)
  --pad steps                   a fake game controller (0162): after the wait, connected, then
                                each step held in turn: button:ms or axis=value:ms
                                (e.g. "lx=0.8:1500,rb:100,y:100"); buttons a b x y lb rb lt rt view menu ls rs up down left right
  --port id                     docked at this port, port screen open
  --moor island                 moored at one of her islands' piers (owned first, decision 0159)
  --quest id:step               a quest started at that step, earlier steps paid (as a quest test)
  --tab market|orders|quay|shipyard   the port screen's tab
  --zoom z                      camera distance, 1 = default, larger = farther (no game limit)
  --look x,y                    camera on this map point instead of the boat
  --menu                        the title menu, before Set sail (the scene options are ignored)
  --chart                       the sea chart open; --chart-zoom n, --chart-pan Key:n,
                                --chart-panel legend|market|journal (default none)
  --charted                     every wind zone already sailed (named on the chart)
  --town id:level,…             towns at these levels; an empty island to found is founded first
                                (0157), so --town palm-key:1 shows Palm Key just founded
Map editor (editor.html instead of the game)
  --editor ring|phase4          the map editor on the ring, or the sea editor on the Phase 4 sea
  --select hit                  select what the chart tags so: island:sunreach, shape:coral-line-east,
                                area:sugar-bar, zone:the-trades, current:id, mark:3, waypoint:2, start
  --look x,y --zoom upp         centre the chart there, map units per pixel (default: the whole sea)
  --draft file.json             an editor draft to load (a map export, or a stored sea draft)
  --export                      the export dialog open (phase4: every file, changed or same)
  --builder id[:tab[:shape[:point]]]  the island builder on that island, e.g.
                                the-smoulder:lanes:river:0:2 (tab props|ground|lanes|spots)
Look
  --lang en|fr                  language (default en)
  --night  | --time s           night, or this game time in seconds (default 300, day)
  --weather  --storms           weather spells, moving storms (default off: steady breeze)
  --no-zones  --no-currents     wind zones, currents off (default on, like the game)
  --cards                       keep quest cards and dialogs open (default: closed, kept in a quest test)
  --wait ms                     settle time before the shot (default 1500)
  --click selector              click this before the shot (after the wait), e.g. a card's button,
                                then wait 800 ms; several in turn with ; (e.g. "#menu-btn;#menu-help")
                                (--pad and --click also work on --menu)
  --focus selector              this control focused as by the controller (decision 0163): the page
                                set to controller input, so the focus ring and button hints show
  --style a.css,b.css           these stylesheets added to the page before the shot (a mockup's look)
  --script a.js,b.js            these scripts run in the page, in order, after the focus is set
                                (a mockup's extra parts)
Output
  --sizes desktop,landscape,portrait   (default desktop)
  --name name                   file name, written as <name>-<size>.png (default: from the scene)
  --list shots.json             a JSON list of shots; each entry takes the options above as keys
                                (at: [x, y], sizes: [...]); options on the line are the defaults
  --out dir                     (default shots/)
  --json                        print the files as JSON
`;

const SEAS = { ring: '', stress: 'stress', phase4: 'phase4' };
const NUMBERS = ['heading', 'sail', 'speed', 'zoom', 'time', 'wait', 'chart-zoom'];

const pair = (v) => {
  if (Array.isArray(v)) return v.map(Number);
  const out = String(v).split(',').map(Number);
  if (out.length !== 2 || out.some((n) => !Number.isFinite(n))) throw new Error(`not x,y: ${v}`);
  return out;
};
const list = (v) => (Array.isArray(v) ? v : String(v).split(',').filter(Boolean));
/** The standard controller layout's buttons in the browser's order (src/input/gamepad.ts). */
const PAD_BUTTONS = 'a b x y lb rb lt rt view menu ls rs up down left right home'.split(' ');
const PAD_AXES = ['lx', 'ly', 'rx', 'ry'];
const padSteps = (v) =>
  list(v).map((step) => {
    const [what, ms] = String(step).split(':');
    const [name, value] = what.split('=');
    const axis = PAD_AXES.indexOf(name);
    const button = PAD_BUTTONS.indexOf(name);
    if (axis < 0 && button < 0) throw new Error(`no pad button or axis "${name}"`);
    return { axis, button, value: value === undefined ? 1 : Number(value), n: Number(ms) || 100 };
  });
const readAll = (v) =>
  list(v)
    .map((f) => readFileSync(resolve(ROOT, f), 'utf8'))
    .join('\n;\n');
const keyHold = (v) => {
  const [key, n] = String(v).split(':');
  return { key, n: Number(n) || 1 };
};

/** One shot from its options (command line or list entry, keys as on the command line). */
export function normalise(opts) {
  const o = { ...opts };
  for (const k of NUMBERS) if (o[k] !== undefined) o[k] = Number(o[k]);
  const sea = o.sea ?? 'ring';
  const shot = {
    sea,
    seaFile: sea in SEAS ? null : resolve(ROOT, sea),
    islands: o.island ? list(o.island).map((f) => resolve(ROOT, f)) : [],
    at: o.at !== undefined ? pair(o.at) : null,
    heading: o.heading ?? null,
    sail: o.sail ?? 2,
    speed: o.speed ?? 5,
    ship: o.ship ?? null,
    hold: o.hold ? keyHold(o.hold) : null,
    pad: o.pad ? padSteps(o.pad) : null,
    port: o.port ?? null,
    moor: o.moor ?? null,
    quest: o.quest ? String(o.quest).split(':') : null,
    tab: o.tab ?? null,
    zoom: o.zoom ?? null,
    look: o.look !== undefined ? pair(o.look) : null,
    menu: !!o.menu,
    chart: !!o.chart,
    chartZoom: o['chart-zoom'] ?? 0,
    chartPan: o['chart-pan'] ? keyHold(o['chart-pan']) : null,
    chartPanel: o['chart-panel'] ?? null,
    charted: !!o.charted,
    prologue: !!o.prologue,
    towns: list(o.town ?? []).map((t) => {
      const [id, level] = String(t).split(':');
      if (!id || !(Number(level) >= 1)) throw new Error(`not id:level: ${t}`);
      return [id, Number(level)];
    }),
    lang: o.lang ?? 'en',
    night: !!o.night,
    time: o.time ?? null,
    weather: !!o.weather || !!o.storms,
    storms: !!o.storms,
    zones: !o['no-zones'],
    currents: !o['no-currents'],
    cards: o.cards ?? !!o.url,
    wait: o.wait ?? 1500,
    click: o.click ? (Array.isArray(o.click) ? o.click.join(';') : String(o.click)) : null,
    focus: o.focus ?? null,
    style: o.style ? readAll(o.style) : null,
    script: o.script ? readAll(o.script) : null,
    sizes: list(o.sizes ?? 'desktop'),
    url: o.url ?? null,
    editor: o.editor === true ? 'ring' : (o.editor ?? null),
    select: o.select ?? null,
    builder: o.builder ? String(o.builder).split(':') : null,
    exportOpen: !!o.export,
    draft: o.draft ? resolve(ROOT, o.draft) : null,
    storage: o.storage ?? {},
  };
  for (const s of shot.sizes)
    if (!SIZES[s]) throw new Error(`unknown size ${s} (${Object.keys(SIZES)})`);
  if ([shot.at, shot.port, shot.moor].filter(Boolean).length > 1)
    throw new Error('--at, --port and --moor: pick one');
  if (shot.editor && !['ring', 'phase4'].includes(shot.editor))
    throw new Error(`--editor ring|phase4, not ${shot.editor}`);
  shot.name = o.name ?? defaultName(shot);
  return shot;
}

function defaultName(s) {
  if (s.editor)
    return ['editor', s.editor, s.select?.replace(/[:]/g, '-'), s.exportOpen && 'export']
      .filter(Boolean)
      .join('-');
  const sea = s.seaFile ? basename(s.seaFile, extname(s.seaFile)) : s.sea;
  const where = s.port ?? (s.at ? `${s.at[0]}_${s.at[1]}` : 'start');
  return [
    sea,
    s.menu ? 'menu' : where,
    s.chart && 'chart',
    s.night && 'night',
    s.lang !== 'en' && s.lang,
  ]
    .filter(Boolean)
    .join('-');
}

/** The shots asked for: the list file's entries over the command line's options, or just those. */
export function planShots(args) {
  const base = { ...args };
  delete base._;
  delete base.list;
  delete base.out;
  delete base.json;
  if (!args.list) return [normalise(base)];
  const entries = JSON.parse(readFileSync(resolve(ROOT, args.list), 'utf8'));
  if (!Array.isArray(entries)) throw new Error(`${args.list}: not a JSON list`);
  return entries.map((e, i) => normalise({ ...base, name: `shot-${i + 1}`, ...e }));
}

/** The game's address for a shot: the sea, `?debug`, and a quest test's own parameters. */
export function shotPath(shot) {
  if (shot.editor) return `/editor.html?debug${shot.editor === 'phase4' ? '&sea=phase4' : ''}`;
  if (shot.url) {
    const u = new URL(shot.url, 'http://x/');
    u.searchParams.set('debug', '');
    return `/${u.search}`;
  }
  const q = new URLSearchParams({ debug: '' });
  const map = shot.seaFile || shot.islands.length ? 'edited' : SEAS[shot.sea];
  if (map) q.set('map', map);
  // Island files tried on the Phase 4 sea: the edited map falls back to the grown sea (0161).
  if (map === 'edited' && !shot.seaFile && shot.sea === 'phase4') q.set('sea', 'phase4');
  return `/?${q}`;
}

/** What goes in the browser's storage before the game starts. */
export function seedStorage(shot) {
  const items = {
    'fwt.settings.v1': JSON.stringify({
      seenHelp: true,
      seenWindHint: true,
      seenPressHint: true,
      seenCurrentHint: true,
      musicVolume: 0,
      voices: false,
      language: shot.lang,
      dayNight: shot.night,
      weather: shot.weather,
      storms: shot.storms,
      windZones: shot.zones,
      currents: shot.currents,
    }),
    ...shot.storage,
  };
  if (shot.seaFile) items['fwt.editor.map.v1'] = readFileSync(shot.seaFile, 'utf8');
  if (shot.draft)
    items[shot.editor === 'phase4' ? 'fwt.editor.seas.v1' : 'fwt.editor.map.v1'] = readFileSync(
      shot.draft,
      'utf8',
    );
  if (shot.islands.length) {
    const designs = shot.islands.map((f) => JSON.parse(readFileSync(f, 'utf8')));
    items['fwt.editor.islands.v1'] = JSON.stringify(
      Object.fromEntries(designs.map((d) => [d.id, d])),
    );
  }
  return items;
}

const visible = (page, sel) =>
  page
    .locator(sel)
    .isVisible()
    .catch(() => false);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Past the title menu, the level card and the tutorial offer, as a player would click; then, unless
 * the shot is of the prologue, back to plain free play (decision 0160).
 */
async function enter(page, shot) {
  await page.waitForFunction(() => !!window.fwt, null, { timeout: 30000 });
  if (await visible(page, '#menu-play')) await page.click('#menu-play');
  await page
    .locator('#set-sail')
    .waitFor({ state: 'visible', timeout: 3000 })
    .catch(() => {});
  if (await visible(page, '#set-sail')) await page.click('#set-sail');
  await page
    .locator('#tutorial-free')
    .waitFor({ state: 'visible', timeout: 2000 })
    .catch(() => {});
  if (await visible(page, '#tutorial-free')) await page.click('#tutorial-free');
  if (!shot.prologue && !shot.url) await page.evaluate(() => window.fwt.freePlay?.());
}

async function setScene(page, shot) {
  if ((shot.at || shot.moor || (shot.port && !shot.url)) && (await visible(page, '#tp-undock')))
    await page.click('#tp-undock');
  const problem = await page.evaluate((s) => {
    const { world, view, trade } = window.fwt;
    if (s.time !== null) world.time = s.time;
    else if (s.night) world.time = s.nightTime;
    else if (!s.url) world.time = 300;
    if (s.ship) {
      const { captain } = world.trade;
      captain.ships[s.ship] ??= structuredClone(captain.ships[captain.activeShip]);
      captain.activeShip = s.ship;
      world.ship = trade.activeShip(world.trade);
    }
    if (s.quest) window.fwt.quests.testStart(s.quest[0], s.quest[1]);
    if (s.charted) world.trade.progress.zones = world.map.windZones.map((z) => z.id);
    for (const [id, level] of s.towns)
      if (!window.fwt.town(id, level)) return `no town ${id} on this sea`;
    if (s.at) {
      const beam = ((world.seaWind.from * 180) / Math.PI + 90) % 360;
      window.fwt.place(s.at[0], s.at[1], s.heading ?? beam, s.sail);
      world.boat.speedKn = s.speed;
    }
    if (s.port && !s.url && world.trade.dockedAt !== s.port && !window.fwt.dock(s.port))
      return `could not dock at ${s.port}`;
    if (s.moor) {
      const home = (world.trade.home.islands[s.moor] ??= { owned: true, offered: [], built: {} });
      home.owned = true;
      if (!window.fwt.moor(s.moor)) return `no pier to moor at on ${s.moor}`;
    }
    if (s.tab && world.trade.dockedAt) window.fwt.tradePanel.open(s.tab);
    if (s.zoom !== null) view.zoom = s.zoom;
    if (s.look) view.setFocus({ x: s.look[0], y: s.look[1] }, true);
    return null;
  }, shot);
  if (problem) throw new Error(problem);
}

/** Close quest cards and dialogs; the chart stays open if a step (a pad's Y) opened it. */
const closeCards = (page) =>
  page.evaluate(() => {
    for (const d of document.querySelectorAll('dialog[open]')) if (d.id !== 'chart') d.close();
  });

async function shootOne(browser, base, shot, size, file) {
  const { width, height, touch } = SIZES[size];
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: !!touch,
  });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript((items) => {
      if (window.top !== window) return;
      for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
    }, seedStorage(shot));
    if (shot.pad)
      await page.addInitScript(() => {
        // A standard pad the test drives through window.__fwPad (decision 0162).
        const pad = {
          id: 'fake standard pad',
          index: 0,
          connected: true,
          mapping: 'standard',
          timestamp: 0,
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        };
        window.__fwPad = pad;
        Object.defineProperty(window.navigator, 'getGamepads', { value: () => [pad] });
      });
    await page.goto(base + shotPath(shot));
    if (shot.editor) await shootEditor(page, shot);
    else if (shot.menu) {
      await page.locator('#menu-play').waitFor({ state: 'visible', timeout: 30000 });
      await pause(shot.wait);
      await act(page, shot);
    } else await shootScene(page, shot);
    if (!shot.editor) await dress(page, shot);
    await page.screenshot({ path: file });
  } finally {
    await context.close();
  }
  if (errors.length) throw new Error(`page error: ${errors[0]}`);
}

/** Connect the fake pad, then hold each step's button or stick for its time. */
async function drivePad(page, steps) {
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  for (const step of steps) {
    const set = (on) =>
      page.evaluate(
        ({ axis, button, value, on }) => {
          const pad = window.__fwPad;
          if (axis >= 0) pad.axes[axis] = on ? value : 0;
          else pad.buttons[button] = { pressed: on, touched: on, value: on ? value : 0 };
        },
        { ...step, on },
      );
    await set(true);
    await pause(step.n);
    await set(false);
    await pause(100);
  }
}

/** The map editor framed, the selection made and its checks run, ready for the shot. */
async function shootEditor(page, shot) {
  await page.waitForFunction(() => !!window.fwtEditor, null, { timeout: 30000 });
  await page.evaluate((s) => {
    if (s.look) window.fwtEditor.focus(s.look[0], s.look[1], s.zoom ?? undefined);
    if (s.select) window.fwtEditor.select(s.select);
    if (s.builder) {
      const [id, tab, kind, index, point] = s.builder;
      window.fwtEditor.builder(
        id,
        tab,
        kind ? `${kind}:${index}` : undefined,
        point !== undefined ? Number(point) : undefined,
      );
    }
  }, shot);
  // The sailing route checks run in a worker: wait for them (a few seconds on the grown sea).
  await page
    .waitForFunction(() => !document.querySelector('#ed-checks .pending'), null, {
      timeout: 60000,
    })
    .catch(() => {});
  if (shot.exportOpen) await page.click('#ed-export');
  await pause(Math.min(shot.wait, 600));
  // Clicks work in the editors too (e.g. open the island builder and pick a tool).
  await act(page, shot);
}

/** The pad's steps, then the clicks, as a player would. */
async function act(page, shot) {
  if (shot.pad) {
    // The pad plays the game, not a card left open over it.
    if (!shot.cards) await closeCards(page);
    await drivePad(page, shot.pad);
    await pause(600);
  }
  if (shot.click)
    for (const selector of shot.click.split(';')) {
      await page.click(selector.trim());
      await pause(800);
    }
}

/** A mockup's stylesheets, the controller's focus on a control, then the mockup's scripts. */
async function dress(page, shot) {
  if (shot.style) await page.addStyleTag({ content: shot.style });
  if (shot.focus) {
    const found = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      document.documentElement.dataset.input = 'pad';
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
      return true;
    }, shot.focus);
    if (!found) throw new Error(`no element ${shot.focus} to focus`);
  }
  if (shot.script) await page.evaluate(shot.script);
  if (shot.style || shot.script || shot.focus) await pause(300);
}

/** The game entered and the scene set, ready for the shot. */
async function shootScene(page, shot) {
  await enter(page, shot);
  await setScene(page, shot);
  if (shot.hold) {
    await page.keyboard.down(shot.hold.key);
    await pause(shot.hold.n);
    await page.keyboard.up(shot.hold.key);
  }
  await pause(shot.wait);
  await act(page, shot);
  if (!shot.cards) await closeCards(page);
  if (shot.chart) {
    await closeCards(page);
    await page.click('#chart-btn');
    await pause(600);
    for (let i = 0; i < shot.chartZoom; i++) await page.click('#chart-zoom-in');
    if (shot.chartPan) {
      await page.focus('#chart-map');
      for (let i = 0; i < shot.chartPan.n; i++) await page.keyboard.press(shot.chartPan.key);
    }
    // The panel beside the sea: none by default, so the whole sea shows.
    await page.evaluate((panel) => {
      for (const b of document.querySelectorAll('#chart [data-chart-close]'))
        if (b.offsetParent) b.click();
      if (panel) document.getElementById(`chart-${panel}-toggle`)?.click();
    }, shot.chartPanel);
    await pause(400);
  }
}

/** The night's middle, in game seconds, from the tuning file (decision 0068). */
function nightTime() {
  const w = JSON.parse(readFileSync(join(ROOT, 'src/data/tuning/weather.json'), 'utf8'));
  const { duskEnd, nightEnd } = w.daylight;
  return Math.round((duskEnd + nightEnd) / 2);
}

/** Takes the shots; returns the files written. Also used by `npm run quest -- play --shots`. */
export async function takeShots(shots, out) {
  const { chromium } = await import('playwright');
  mkdirSync(out, { recursive: true });
  const server = await startVite(true);
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const files = [];
  const night = nightTime();
  try {
    for (const shot of shots)
      for (const size of shot.sizes) {
        const file = join(out, `${shot.name}-${size}.png`);
        await shootOne(browser, base, { ...shot, nightTime: night }, size, file);
        files.push(file);
      }
  } finally {
    await browser.close();
    await server.close();
  }
  return files;
}

export async function run(args) {
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  let shots;
  try {
    shots = planShots(args);
  } catch (e) {
    console.log(`shots: ${e.message}`);
    return 1;
  }
  const out = resolve(ROOT, args.out ?? 'shots');
  try {
    const files = await takeShots(shots, out);
    if (args.json) console.log(JSON.stringify(files, null, 2));
    else console.log(`${files.length} shot${files.length === 1 ? '' : 's'} in ${out}`);
    return 0;
  } catch (e) {
    console.log(`shots: ${e.message}`);
    return 1;
  }
}
