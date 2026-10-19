import { PHASE1_MAP } from './data/maps';
import { Input } from './input/input';
import { FrameMonitor, type QualityLevel, guessQuality, lowerQuality } from './render/quality';
import { GameView } from './render/view';
import { SAIL_STEPS } from './sim/boat';
import { clamp } from './sim/math';
import { type SaveStorage, clearSave, loadGame, saveGame } from './sim/save';
import { SLOOP } from './sim/ship';
import * as trade from './sim/trade';
import {
  type WorldEvent,
  createWorld,
  setPortDestination,
  resetBoat,
  stepWorld,
} from './sim/world';
import {
  classifySupport,
  isFullscreen,
  onFullscreenChange,
  probeSupport,
  toggleFullscreen,
} from './ui/fullscreen';
import { Hud } from './ui/hud';
import { loadSettings, saveSettings } from './ui/settings';
import { SeaChart } from './ui/seaChart';
import { TradePanel } from './ui/tradePanel';

declare const __BUILD_REVISION__: string;
const release = document.getElementById('build-revision');
if (release) release.textContent = __BUILD_REVISION__;

const SIM_STEP = 1 / 60;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
const canvas = $<HTMLCanvasElement>('scene');

// three.js needs WebGL2 (iOS 15+, Android Chrome since ~2017). Say so instead of a blank page.
if (!document.createElement('canvas').getContext('webgl2')) {
  $('help').innerHTML =
    '<div class="panel card"><h1>Fair Winds Trading</h1><p>Sorry, this browser does not support WebGL2, which the game needs. Try updating the browser or the system (iOS 15+ on iPad).</p></div>';
  throw new Error('WebGL2 not available');
}

const settings = loadSettings();
const world = createWorld(PHASE1_MAP, SLOOP);
// Progress (gold, ships, cargo, markets, position) auto-saves to the browser (decision 0015).
const storage: SaveStorage | null = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
if (storage) loadGame(storage, world);
let level: QualityLevel = settings.quality === 'auto' ? guessQuality() : settings.quality;
const view = new GameView(canvas, world, level);
const hud = new Hud(
  world,
  {
    seen: settings.seenWindHint,
    markSeen: () => {
      settings.seenWindHint = true;
      saveSettings(settings);
    },
  },
  view.harbours,
);
const input = new Input(stage);
const chart = new SeaChart($('chart') as HTMLDialogElement, world, view.harbours);
chart.onChange = () => {
  input.releaseAll();
  refreshPause();
};
const tradePanel = new TradePanel($('trade-panel'), world);
tradePanel.uiMode = settings.uiMode;
hud.portLabels.isKidMode = settings.uiMode === 'kids';
tradePanel.onUiModeChange = (mode) => {
  settings.uiMode = mode;
  hud.portLabels.isKidMode = mode === 'kids';
  saveSettings(settings);
};
const monitor = new FrameMonitor();
let sailStep = world.boat.sailStep;

tradePanel.onAction = () => {
  world.ship = trade.activeShip(world.trade);
  autosave();
};
tradePanel.onClose = () => {
  refreshPause();
};

hud.onDockClick = () => {
  if (world.trade.dockedAt) {
    tradePanel.open('market');
    refreshPause();
  }
};

hud.onPortClick = (portId: string) => {
  if (world.trade.dockedAt === portId) {
    tradePanel.open('market');
    refreshPause();
  } else if (trade.tryDock(world.trade, world.map, world.boat, portId)) {
    handleEvents([{ type: 'docked', portId }]);
  } else {
    if (setPortDestination(world, portId)) {
      const anchor = view.harbours[portId];
      if (anchor) Object.assign(world.destination!, anchor);
      hud.showToast(`Course set for ${world.destination!.label}`, 2);
    }
  }
};

// --- Main menu, help card and pause ------------------------------------------------------------
// The game opens on the title menu with the scene running behind it (decision 0017). The
// simulation is paused while the menu or the help card is up.
const menu = $('menu');
const help = $('help');
const windHelp = $<HTMLDialogElement>('wind-help');
const helpClose = $('start');
const settingsPanel = $('settings');
const playButton = $('menu-play');
let mode: 'menu' | 'play' = 'menu';
let started = false;
let paused = true;

function refreshPause() {
  paused =
    mode === 'menu' ||
    !settingsPanel.hidden ||
    !help.hidden ||
    tradePanel.isOpen ||
    windHelp.open ||
    chart.isOpen;
  input.setEnabled(!paused);
}

hud.onWindHelpChange = () => {
  input.releaseAll();
  refreshPause();
};

function showMenu() {
  mode = 'menu';
  document.body.classList.add('in-menu');
  help.hidden = true;
  settingsPanel.hidden = true;
  if (tradePanel.isOpen) tradePanel.close();
  menu.hidden = false;
  playButton.textContent = started ? 'Resume' : 'Set sail';
  refreshPause();
  playButton.focus({ preventScroll: true });
}

function play() {
  mode = 'play';
  started = true;
  document.body.classList.remove('in-menu');
  menu.hidden = true;
  if (!settings.seenHelp) openHelp();
  refreshPause();
}

function openHelp() {
  helpClose.textContent = mode === 'menu' ? 'Back' : 'Set sail';
  menu.hidden = true;
  help.hidden = false;
  refreshPause();
}

function closeHelp() {
  help.hidden = true;
  settings.seenHelp = true;
  saveSettings(settings);
  if (mode === 'menu') menu.hidden = false;
  refreshPause();
}

playButton.addEventListener('click', play);
$('menu-help').addEventListener('click', openHelp);
$('menu-settings').addEventListener('click', () => {
  menu.hidden = true;
  settingsPanel.hidden = false;
});
$('menu-btn').addEventListener('click', showMenu);
helpClose.addEventListener('click', closeHelp);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat && mode === 'play' && (chart.isOpen || !paused)) {
    e.preventDefault();
    if (chart.isOpen) chart.close();
    else chart.open();
    return;
  }
  if (e.code !== 'Escape' || windHelp.open || chart.isOpen) return;
  if (tradePanel.isOpen) {
    tradePanel.close();
    refreshPause();
  } else if (!settingsPanel.hidden) closeSettings();
  else if (!help.hidden) closeHelp();
  else if (mode === 'play') showMenu();
});
help.hidden = true;
showMenu();

// --- Fullscreen --------------------------------------------------------------------------------
const fsSupport = classifySupport(probeSupport());
const fsMenuButton = $('menu-fullscreen');
fsMenuButton.hidden = fsSupport !== 'api';
$('fs-hint').hidden = fsSupport !== 'home-screen';
const describeFullscreen = () => {
  const on = isFullscreen();
  fsMenuButton.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
};
for (const button of [fsMenuButton]) {
  button.addEventListener('click', () => void toggleFullscreen());
}
onFullscreenChange(describeFullscreen);
describeFullscreen();

// --- Controls ----------------------------------------------------------------------------------
input.onDrag = (d) => hud.setTiller(d);
input.onZoom = (f) => view.setZoom(view.getZoom() * f);
for (const [id, delta] of [
  ['sail-up', 1],
  ['sail-down', -1],
] as const) {
  $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.pressSail(delta);
  });
}

// --- Settings panel ----------------------------------------------------------------------------
const qualitySelect = $<HTMLSelectElement>('quality');
const showFps = $<HTMLInputElement>('show-fps');
const qualityNow = $('quality-now');
qualitySelect.value = settings.quality;
showFps.checked = settings.showFps;
const describeQuality = () => (qualityNow.textContent = `Now using: ${level}`);
describeQuality();

$('chart-btn').addEventListener('click', () => chart.open());
function closeSettings() {
  settingsPanel.hidden = true;
  if (mode === 'menu') menu.hidden = false;
  refreshPause();
}
$('close-settings').addEventListener('click', closeSettings);
qualitySelect.addEventListener('change', () => {
  settings.quality = qualitySelect.value as typeof settings.quality;
  saveSettings(settings);
  setLevel(settings.quality === 'auto' ? guessQuality() : settings.quality);
});
showFps.addEventListener('change', () => {
  settings.showFps = showFps.checked;
  saveSettings(settings);
});
$('shift-wind').addEventListener('click', () => {
  world.windOffsetDeg = (world.windOffsetDeg + 45) % 360;
  hud.showToast('The wind shifts…', 1.5);
});
$('reset-boat').addEventListener('click', () => {
  resetBoat(world);
  sailStep = world.boat.sailStep;
  settingsPanel.hidden = true;
  refreshPause();
});
const resetSaveBtn = document.getElementById('reset-save');
resetSaveBtn?.addEventListener('click', () => {
  if (window.confirm('Start a new voyage? Your gold, cargo and upgrades will be reset.')) {
    if (storage) clearSave(storage);
    window.location.reload();
  }
});

function setLevel(next: QualityLevel) {
  if (next === level) return;
  level = next;
  view.setQuality(level);
  describeQuality();
}

// --- Resize ------------------------------------------------------------------------------------
const size = { w: 1, h: 1 };
function resize() {
  size.w = stage.clientWidth;
  size.h = stage.clientHeight;
  view.resize(size.w, size.h);
}
window.addEventListener('resize', resize);
resize();

// --- Docking, trading and automatic saves --------------------------------
const AUTOSAVE_SECONDS = 15;
let lastSave = world.time;
function autosave() {
  if (storage) saveGame(storage, world);
  lastSave = world.time;
}
function handleEvents(events: WorldEvent[]) {
  hud.handleEvents(events);
  for (const e of events) {
    if (e.type === 'docked') {
      const portName = trade.findPort(world.map, e.portId)?.name ?? e.portId;
      hud.showToast(`Docked at ${portName}`, 2.5);
      tradePanel.open('market');
      refreshPause();
      autosave();
    } else if (e.type === 'undocked') {
      const portName = trade.findPort(world.map, e.portId)?.name ?? e.portId;
      hud.showToast(`Departed ${portName}`, 1.5);
      if (tradePanel.isOpen) {
        tradePanel.close();
        refreshPause();
      }
      autosave();
    }
  }
  if (world.time - lastSave >= AUTOSAVE_SECONDS) autosave();
}
window.addEventListener('pagehide', autosave);

// --- Main loop: fixed-step simulation, render once per frame ----------------------------------
let accumulator = 0;
let last = performance.now();
let frame = 0;

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  const sailDelta = input.takeSailDelta();
  if (!paused) {
    sailStep = clamp(sailStep + sailDelta, 0, SAIL_STEPS.length - 1);
    accumulator += dt;
    let steps = 0;
    while (!paused && accumulator >= SIM_STEP && steps < 6) {
      handleEvents(stepWorld(world, { steer: input.steer, sailStep }, SIM_STEP));
      accumulator -= SIM_STEP;
      steps++;
    }
    if (steps === 6) accumulator = 0;
  }

  if (!chart.isOpen) view.render(dt);
  hud.update(dt, (x, y) => view.project(x, y), size, !paused);

  if (monitor.sample(dt) && settings.quality === 'auto' && level !== 'low') {
    setLevel(lowerQuality(level));
  }
  hud.setFps(settings.showFps ? monitor.fps : null);
}

// Stop rendering while the tab is hidden (battery on phones and tablets).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    autosave();
    cancelAnimationFrame(frame);
  } else {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
});
frame = requestAnimationFrame(tick);

// `?debug` exposes the game objects in the console (used by screenshot scripts too). Until the
// trade panel lands, trading works from there, e.g. `fwt.trade.buy(fwt.world.trade, 'fish', 5)`.
if (new URLSearchParams(location.search).has('debug')) {
  const newGame = () => {
    if (storage) clearSave(storage);
    location.reload();
  };
  Object.assign(window, { fwt: { world, view, input, trade, newGame } });
}
