/* global console, window, document, localStorage, setTimeout, URL, URLSearchParams, structuredClone, Event */
// `npm run shots` (decision 0153): standard screenshots of the real game, instead of a Playwright
// script per review. It starts Vite itself, opens the game with `?debug`, gets past the menu, the
// level card, the tutorial offer and the harbour, sets the scene through `window.fwt` (the boat's
// `place`, `dock`, the view, the chart) and shoots each size.
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
import { ROOT, startVite } from './lib.mjs';

/**
 * The three sizes every look review shows (desktop first, must look good in portrait), and `tv`:
 * Edge on an Xbox at 1080p, whose user agent turns on TV mode (decision 0183).
 */
export const SIZES = {
  desktop: { width: 1280, height: 800 },
  landscape: { width: 844, height: 390, touch: true },
  portrait: { width: 390, height: 844, touch: true },
  tv: {
    width: 1920,
    height: 1080,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  },
};

export const HELP = `npm run shots -- [options]          screenshots of the real game, PNG in --out

Where
  --sea phase4|ring|stress|file.json   the sea (default phase4, the game's own grown sea, 0198;
                                ring = the Windward Ring alone; a file: a map editor export, or a
                                sea file merged round the ring, played as ?map=edited)
  --island a.json,b.json        island files to play instead of the shipped ones (builder exports)
  --at x,y                      boat at sea there (default: docked at the start port)
  --prologue                    a new voyage as a player who skips the tutorial meets it: alone at
                                sea, sails down, the rescue to play (0160); without it the tools
                                drop that story and start at the map's start, as before
  --heading deg                 boat heading, compass degrees (default: wind on the beam)
  --sail 0|1|2                  sails furled, half, full (default 2)
  --speed kn                    starting speed (default 5)
  --ship id                     sail this ship (sloop, schooner, fluyt, …)
  --hull pct                    her hull at this condition, 0 to 100 (decision 0208: the model
                                shows scuffs below 75, patches below 50, torn sails below 25)
  --crash ms                    a crash's splash and planks at her bow this long before the shot
                                (after the wait; e.g. --crash 250 for the splash in the air)
  --hold Key:ms                 hold a key that long before the shot (e.g. ArrowUp:2500)
  --pad steps                   a fake game controller (0162): after the wait, connected, then
                                each step held in turn: button:ms or axis=value:ms
                                (e.g. "lx=0.8:1500,rb:100,y:100"); buttons a b x y lb rb lt rt view menu ls rs up down left right
  --port id                     docked at this port, port screen open
  --moor island                 moored at one of her islands' piers (owned first, decision 0159),
                                at sea with its harbour screen closed
  --offer spot-2,…              plots given on the --moor island and not built: staked, their
                                giver's card on mooring (with --cards), decision 0210
  --built spot-1=workshop,…     buildings standing on the --moor island
  --island-tab                  its harbour screen open on the Island tab; --choose spot-2: that
                                plot chosen (half screen, the camera on the plot, its ring)
  --quest id:step               a quest started at that step, earlier steps paid (as a quest test)
  --tab market|orders|quay|shipyard   the port screen's tab
  --zoom z                      camera distance, 1 = default, larger = farther (no game limit)
  --look x,y                    camera on this map point instead of the boat
  --menu                        the title menu, before Set sail (the scene options are ignored)
  --chart                       the sea chart open (--pad and --click then play on it); --chart-zoom n, --chart-pan Key:n,
                                --chart-panel journal|market|legend: that tab (default the map)
  --charted                     every wind zone sailed and every chart area handed over (all named)
  --town id:level,…             towns at these levels; an empty island to found is founded first
                                (0157), so --town palm-key:1 shows Palm Key just founded
Map editor (editor.html instead of the game)
  --editor phase4|ring          the sea editor on the game's sea (default), or the ring alone
  --select hit                  select what the chart tags so: island:sunreach, shape:coral-line-east, fleet:kits-boats,
                                area:sugar-bar, zone:the-trades, current:id, mark:3, waypoint:2, start
  --look x,y --zoom upp         centre the chart there, map units per pixel (default: the whole sea)
  --draft file.json             an editor draft to load (a map export, or a stored sea draft)
  --export                      the export dialog open (phase4: every file, changed or same)
  --builder id[:tab[:shape[:point]]]  the island builder on that island, e.g.
                                the-smoulder:lanes:river:0:2 (tab props|ground|lanes|spots)
Look
  --lang en|fr                  language (default en)
  --query padlog                more of the game's URL options, e.g. padlog (the controller log, 0201)
  --night  | --time s           night, or this game time in seconds (default 300, day)
  --weather  --storms           weather spells, moving storms (default off: steady breeze)
  --no-zones  --no-currents     wind zones, currents off (default on, like the game)
  --no-belt                     Settings › Storm belt off (0167)
  --quality low|medium|high|ultra  Settings › Quality (default: the game's auto guess; ultra:
                                the desktop and Xbox look, decision 0221)
  --erupt island                this volcano erupts as the scene is set (0178); give it time to
                                build, e.g. --wait 6000. --no-eruptions: the Eruptions switch off
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
  --save-link                   also print the scene as a save link on the Pages game, to play
                                from there (e.g. --script a test save's set-up, then --save-link)
  --sizes desktop,landscape,portrait,tv   (default desktop; tv = Xbox Edge at 1080p)
  --name name                   file name, written as <name>-<size>.png (default: from the scene)
  --list shots.json             a JSON list of shots; each entry takes the options above as keys
                                (at: [x, y], sizes: [...]); options on the line are the defaults
  --out dir                     (default shots/)
  --json                        print the files as JSON
`;

const PAGES = 'https://djguiaume.github.io/fair-winds-trading/';

// The game's own sea is the grown one (decision 0198): `phase4` (or `game`) needs no `?map=`.
const SEAS = { phase4: '', game: '', ring: 'ring', stress: 'stress' };
const NUMBERS = ['heading', 'sail', 'speed', 'zoom', 'time', 'wait', 'chart-zoom', 'hull', 'crash'];

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
  const sea = o.sea === 'game' ? 'phase4' : (o.sea ?? 'phase4');
  const shot = {
    sea,
    seaFile: sea in SEAS ? null : resolve(ROOT, sea),
    islands: o.island ? list(o.island).map((f) => resolve(ROOT, f)) : [],
    at: o.at !== undefined ? pair(o.at) : null,
    heading: o.heading ?? null,
    sail: o.sail ?? 2,
    speed: o.speed ?? 5,
    ship: o.ship ?? null,
    hull: o.hull ?? null,
    crash: o.crash ?? null,
    hold: o.hold ? keyHold(o.hold) : null,
    pad: o.pad ? padSteps(o.pad) : null,
    port: o.port ?? null,
    moor: o.moor ?? null,
    offer: list(o.offer ?? []),
    built: list(o.built ?? []).map((b) => String(b).split('=')),
    islandTab: !!o['island-tab'] || !!o.choose,
    choose: o.choose ?? null,
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
    query: o.query ?? null,
    night: !!o.night,
    time: o.time ?? null,
    weather: !!o.weather || !!o.storms,
    storms: !!o.storms,
    zones: !o['no-zones'],
    belt: !o['no-belt'],
    quality: o.quality ?? null,
    currents: !o['no-currents'],
    erupt: o.erupt ?? null,
    eruptions: !o['no-eruptions'],
    cards: o.cards ?? !!o.url,
    wait: o.wait ?? 1500,
    click: o.click ? (Array.isArray(o.click) ? o.click.join(';') : String(o.click)) : null,
    focus: o.focus ?? null,
    style: o.style ? readAll(o.style) : null,
    script: o.script ? readAll(o.script) : null,
    saveLink: !!o['save-link'],
    sizes: list(o.sizes ?? 'desktop'),
    url: o.url ?? null,
    editor: o.editor === true ? 'phase4' : (o.editor ?? null),
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
  if (shot.editor) return `/editor.html?debug${shot.editor === 'ring' ? '&sea=ring' : ''}`;
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
  for (const [k, v] of new URLSearchParams(shot.query ?? '')) q.set(k, v);
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
      stormBelt: shot.belt ?? true,
      ...(shot.quality ? { quality: shot.quality } : {}),
      currents: shot.currents,
      eruptions: shot.eruptions,
    }),
    ...shot.storage,
  };
  if (shot.seaFile) items['fwt.editor.map.v1'] = shot.seaMap ?? readFileSync(shot.seaFile, 'utf8');
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

/** The camera on a map point at once, not gliding there from the boat (runs in the page). */
function lookAt(at) {
  const { view } = window.fwt;
  view.setFocus({ x: at[0], y: at[1] }, true);
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
    if (s.hull !== null) window.fwt.hull(s.hull);
    if (s.quest && !window.fwt.questAt(s.quest[0], s.quest[1]))
      return `no quest step ${s.quest.join(':')}`;
    if (s.charted) {
      // Zone names show only over charted water (Phase 4 review), so the areas are handed over too.
      world.trade.progress.zones = world.map.windZones.map((z) => z.id);
      world.trade.progress.areas = (world.map.fog?.areas ?? []).map((a) => a.id);
    }
    for (const [id, level] of s.towns)
      if (!window.fwt.town(id, level)) return `no town ${id} on this sea`;
    if (s.at) {
      const beam = ((world.seaWind.from * 180) / Math.PI + 90) % 360;
      window.fwt.place(s.at[0], s.at[1], s.heading ?? beam, s.sail);
      world.boat.speedKn = s.speed;
    }
    if (s.port && !s.url && world.trade.dockedAt !== s.port && !window.fwt.dock(s.port))
      return `could not dock at ${s.port}`;
    // Plots given and buildings standing: on the --moor island, else the home island (0210).
    const own = s.moor ?? (s.offer.length || s.built.length ? world.map.homeIsland : null);
    if (own) {
      const home = (world.trade.home.islands[own] ??= { owned: true, offered: [], built: {} });
      home.owned = true;
      for (const spot of s.offer) if (!home.offered.includes(spot)) home.offered.push(spot);
      for (const [spot, building] of s.built) home.built[spot] = building;
      window.fwt.showHome();
    }
    if (s.moor) {
      if (!window.fwt.moor(s.moor)) return `no pier to moor at on ${s.moor}`;
    }
    if (s.tab && world.trade.dockedAt) window.fwt.tradePanel.open(s.tab);
    if (s.zoom !== null) view.zoom = s.zoom;
    if (s.look) view.setFocus({ x: s.look[0], y: s.look[1] }, true);
    if (s.erupt && !view.erupt(s.erupt, true)) return `no volcano on ${s.erupt}`;
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
  const { width, height, touch, userAgent } = SIZES[size];
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: !!touch,
    ...(userAgent ? { userAgent } : {}),
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
    // Editors too: a script can open the quest builder on a step (decision 0184).
    await dress(page, shot);
    await page.screenshot({ path: file });
    // The voyage as set for the shot, as a save link to play from (Menu › Move your voyage, 0066).
    if (shot.saveLink && !shot.linked) {
      shot.linked = true;
      const code = await page.evaluate(() => window.fwt.saveCode());
      console.log(`${shot.name}: ${PAGES}#voyage=${code}`);
    }
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
  // The harbour screen's port picture (decision 0211) shows once the browser has decoded it.
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('.port-view, .quay-view')].map((el) => {
        const url = window.getComputedStyle(el).backgroundImage.match(/url\("(.*)"\)/)?.[1];
        if (!url) return null;
        const image = new window.Image();
        image.src = url;
        return image.decode().catch(() => null);
      }),
    ),
  );
  await pause(100);
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
  if (shot.crash !== null) {
    await page.evaluate(() => window.fwt.impact());
    await pause(shot.crash);
  }
  // Mooring by an island of hers turns the camera and leaving it frees it (0128): look again.
  if (shot.look && !shot.editor && !shot.url) await page.evaluate(lookAt, shot.look);
  // With the chart, the pad and the clicks play on the chart (its cross, its flags), so they act
  // once it is open.
  if (!shot.chart) await act(page, shot);
  if (!shot.cards) await closeCards(page);
  // Moored at her island (decision 0210): its harbour screen, or the island at sea. A plot's
  // card closed above opens the Island tab as its close event lands, so that comes first.
  if (!shot.cards && !shot.editor && !shot.url) {
    await pause(300);
    const moved = await page.evaluate((s) => {
      const { homePanel, world } = window.fwt;
      if (!world.trade.home.docked) return false;
      if (s.islandTab) {
        homePanel.open(s.choose ?? undefined);
        return !!s.choose;
      }
      const open = homePanel.isOpen;
      homePanel.close();
      return open;
    }, shot);
    // The camera glides to the chosen plot, or back to the island.
    if (moved) await pause(1800);
  }
  if (shot.chart) {
    // Docked (--port): the chart opens from the sea, so the port screen is left first; a card
    // closed after it can bring it back a moment later, so until it stays away.
    for (let i = 0, clear = 0; i < 8 && clear < 2; i++) {
      await closeCards(page);
      await pause(500);
      if (await page.isVisible('#tp-close')) {
        clear = 0;
        await page.click('#tp-close');
      } else clear++;
    }
    await page.click('#chart-btn');
    await pause(600);
    for (let i = 0; i < shot.chartZoom; i++) await page.click('#chart-zoom-in');
    if (shot.chartPan) {
      await page.focus('#chart-map');
      for (let i = 0; i < shot.chartPan.n; i++) await page.keyboard.press(shot.chartPan.key);
    }
    // The chart's tab (decision 0196): the map by default.
    await page.evaluate((tab) => {
      if (tab) document.getElementById(`chart-tab-${tab}`)?.click();
    }, shot.chartPanel);
    await pause(400);
    await act(page, shot);
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
  // A sea file (src/data/seas/*.json or a copy) is played merged round the ring, like the chart's.
  for (const shot of shots)
    if (shot.seaFile && !('boundsRadius' in JSON.parse(readFileSync(shot.seaFile, 'utf8')))) {
      const { loadSea } = await server.ssrLoadModule('/tools/fw/seas.ts');
      shot.seaMap = JSON.stringify(loadSea(shot.seaFile).map);
    }
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
