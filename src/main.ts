import { PHASE0_MAP } from './data/maps';
import { Input } from './input/input';
import { FrameMonitor, type QualityLevel, guessQuality, lowerQuality } from './render/quality';
import { GameView } from './render/view';
import { SAIL_STEPS } from './sim/boat';
import { clamp } from './sim/math';
import { SLOOP } from './sim/ship';
import { createWorld, resetBoat, stepWorld } from './sim/world';
import { Hud } from './ui/hud';
import { loadSettings, saveSettings } from './ui/settings';

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
const world = createWorld(PHASE0_MAP, SLOOP);
let level: QualityLevel = settings.quality === 'auto' ? guessQuality() : settings.quality;
const view = new GameView(canvas, world, level);
const hud = new Hud(world);
const input = new Input(stage);
const monitor = new FrameMonitor();
let sailStep = world.boat.sailStep;

// --- Help card -------------------------------------------------------------------------------
const help = $('help');
let paused = !settings.seenHelp;
help.hidden = settings.seenHelp;
const closeHelp = () => {
  help.hidden = true;
  paused = false;
  settings.seenHelp = true;
  saveSettings(settings);
};
$('start').addEventListener('click', closeHelp);
$('help-btn').addEventListener('click', () => {
  help.hidden = false;
  paused = true;
});

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
const settingsPanel = $('settings');
const qualitySelect = $<HTMLSelectElement>('quality');
const showFps = $<HTMLInputElement>('show-fps');
const qualityNow = $('quality-now');
qualitySelect.value = settings.quality;
showFps.checked = settings.showFps;
const describeQuality = () => (qualityNow.textContent = `Now using: ${level}`);
describeQuality();

$('settings-btn').addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});
$('close-settings').addEventListener('click', () => (settingsPanel.hidden = true));
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

// --- Main loop: fixed-step simulation, render once per frame ----------------------------------
let accumulator = 0;
let last = performance.now();
let frame = 0;

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  sailStep = clamp(sailStep + input.takeSailDelta(), 0, SAIL_STEPS.length - 1);
  if (!paused) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= SIM_STEP && steps < 6) {
      hud.handleEvents(stepWorld(world, { steer: input.steer, sailStep }, SIM_STEP));
      accumulator -= SIM_STEP;
      steps++;
    }
    if (steps === 6) accumulator = 0;
  }

  view.render(dt);
  hud.update(dt, (x, y) => view.project(x, y), size);

  if (monitor.sample(dt) && settings.quality === 'auto' && level !== 'low') {
    setLevel(lowerQuality(level));
  }
  hud.setFps(settings.showFps ? monitor.fps : null);
}

// Stop rendering while the tab is hidden (battery on phones and tablets).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frame);
  } else {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
});
frame = requestAnimationFrame(tick);

// `?debug` exposes the game objects in the console (used by screenshot scripts too).
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { fwt: { world, view, input } });
}
