import { renderDifficultyButtons, renderLevelCards } from './ui/levelCards';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from './data/maps';
import { STRESS_PREFIX, stressMap } from './data/stressMap';
import { EDITED_PREFIX, editedMap, prefixedStorage } from './data/editedMap';
import {
  TUNE_LINK_KEY,
  TUNE_PREFIX,
  applyChanges,
  decodeTuneCode,
  loadTuneChanges,
  saveTuneChanges,
} from './data/tuningEdits';
import { Input } from './input/input';
import { FrameMonitor, type QualityLevel, guessQuality, lowerQuality } from './render/quality';
import { GameView } from './render/view';
import { SAIL_STEPS } from './sim/boat';
import { isRare, isSpecialty } from './sim/goods';
import { settlementLevels } from './sim/settlement';
import { clamp } from './sim/math';
import { type SaveStorage, clearSave, loadGame, saveGame } from './sim/save';
import { LINK_KEY } from './sim/saveTransfer';
import { SLOOP } from './sim/ship';
import * as trade from './sim/trade';
import { type Difficulty, isDifficulty, knobs } from './sim/difficulty';
import { daylightAt } from './sim/daylight';
import { QuestBook } from './sim/quests';
import { QuestCard } from './ui/questCard';
import { cardFor, dueCard, journal, questPins, questTarget } from './ui/questView';
import { TUTORIAL_QUEST, TUTORIAL_STEPS, Tutorial } from './sim/tutorial';
import { TutorialCoach } from './ui/tutorial';
import {
  type WorldEvent,
  createWorld,
  setPortDestination,
  resetBoat,
  startAtPrologue,
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
import { Music } from './audio/music';
import { SeaChart } from './ui/seaChart';
import {
  LANGUAGES,
  browserLanguages,
  detectLanguage,
  language,
  goodName,
  workshopName,
  goodSome,
  setLanguage,
  t,
  townLevelName,
  translateDom,
} from './i18n';
import { TradePanel } from './ui/tradePanel';
import { TransferPanel } from './ui/transferPanel';

declare const __APP_VERSION__: string;
declare const __BUILD_REVISION__: string;
const appVersion = document.getElementById('app-version');
if (appVersion) appVersion.textContent = `v${__APP_VERSION__}`;
const release = document.getElementById('build-revision');
if (release) release.textContent = __BUILD_REVISION__;

const SIM_STEP = 1 / 60;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');

// Language: the player's choice, else the browser's, else English (decision 0037).
const settings = loadSettings();

// Background music (decision 0045): browsers only allow sound after a tap or key press, so the
// first one anywhere starts it (iOS only honours some event types, so listen to several).
const music = new Music(settings.musicVolume);
const unlockAudio = () => music.unlock();
for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const) {
  window.addEventListener(type, unlockAudio, { capture: true, once: true });
}
setLanguage(settings.language ?? detectLanguage(browserLanguages()));
// Level cards and the Settings level switch come from difficulty.json (decision 0113).
renderLevelCards(document.getElementById('level-cards')!);
renderDifficultyButtons(document.getElementById('difficulty')!);
translateDom();
const canvas = $<HTMLCanvasElement>('scene');

// three.js needs WebGL2 (iOS 15+, Android Chrome since ~2017). Say so instead of a blank page.
if (!document.createElement('canvas').getContext('webgl2')) {
  const help = $('help');
  help.innerHTML = `<div class="sheet-body"><h2>${t('game.title')}</h2><p>${t('webgl.unsupported')}</p></div>`;
  help.hidden = false;
  throw new Error('WebGL2 not available');
}

// Progress (gold, ships, cargo, markets, position) auto-saves to the browser (decision 0015).
const browserStorage: SaveStorage | null = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
// "Play this map" from the map editor (decision 0095): its own map, save and tutorial progress.
// The bigger-map test sea (decision 0115), `?map=stress`: its own voyage too.
const stressTest = new URLSearchParams(location.search).get('map') === 'stress';
const playtestMap =
  editedMap(location.search, browserStorage) ??
  (stressTest ? prepareMap(stressMap(PHASE1_SOURCE)) : null);
// The `?tune` panel (decision 0114): the edits kept in this browser apply before the world is
// built, and tune mode sails its own test voyage so the real one is never touched. A shared link
// (`?tune#tune=…`) asks before it replaces them.
const tuneMode = new URLSearchParams(location.search).has('tune');
if (tuneMode) {
  const shared = location.hash.includes(`#${TUNE_LINK_KEY}=`)
    ? decodeTuneCode(location.hash)
    : null;
  if (shared) {
    const n = Object.keys(shared).length;
    if (
      window.confirm(
        `Load ${n} tuning change${n === 1 ? '' : 's'} from this link? They replace the tuning in this browser.`,
      )
    )
      saveTuneChanges(browserStorage, shared);
    history.replaceState(null, '', location.pathname + location.search);
  }
  applyChanges(loadTuneChanges(browserStorage));
}
const voyageStorage =
  playtestMap && browserStorage
    ? prefixedStorage(browserStorage, stressTest ? STRESS_PREFIX : EDITED_PREFIX)
    : browserStorage;
const storage =
  tuneMode && voyageStorage ? prefixedStorage(voyageStorage, TUNE_PREFIX) : voyageStorage;
const world = createWorld(playtestMap ?? PHASE1_MAP, SLOOP);
if (playtestMap) {
  document.title = `${stressTest ? 'Stress test' : 'Edited map'} · ${document.title}`;
  const badge = document.createElement('a');
  badge.href = './editor.html';
  badge.textContent = stressTest ? 'Stress test sea' : 'Edited map · back to editor';
  badge.style.cssText =
    'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:50;padding:3px 10px;' +
    'border-radius:10px;background:#123246e6;color:#f3d37e;font:600 12px sans-serif;' +
    'text-decoration:none;';
  // A label only: the stress sea has no editor page to go back to.
  if (stressTest) {
    badge.removeAttribute('href');
    badge.style.pointerEvents = 'none';
  }
  document.body.append(badge);
}
const resumedVoyage = storage ? loadGame(storage, world) : false;
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
// Press warning (decision 0078): a one-time "ease the sails" message, and a buzz and a creak
// when she crosses into red.
hud.seenPressHint = settings.seenPressHint;
hud.onPressHintSeen = () => {
  settings.seenPressHint = true;
  saveSettings(settings);
};
hud.onPressDanger = () => {
  navigator.vibrate?.([70, 50, 70]);
  music.creak();
};
const input = new Input(stage);
const chart = new SeaChart($('chart') as HTMLDialogElement, world, view.harbours);
chart.onChange = () => {
  input.releaseAll();
  if (chart.isOpen) tutorial.chartOpened();
  refreshPause();
};
const tradePanel = new TradePanel($('trade-panel'), world);
const tutorial = new Tutorial(world, view.harbours, storage, resumedVoyage);
// Quests (decision 0125): every quest file but the tutorial's, saved with the voyage. The
// tutorial counts as done for them once it is finished or skipped.
const quests = new QuestBook(world, undefined, {
  // The tutorial counts as done unless it is running: finished, skipped, or never offered (a
  // voyage from before it), so Rook's thanks and the arcs reach every voyage (decision 0127).
  doneElsewhere: (id) => id === TUTORIAL_QUEST.id && !tutorial.isActive,
  atElsewhere: (id, step) => id === TUTORIAL_QUEST.id && tutorial.reached(step),
  // A night step counts at any time when night is switched off (hazards stay optional).
  nightOk: () => !settings.dayNight || daylightAt(world.time).night >= 0.5,
});
const coach = new TutorialCoach(tutorial);
const tutorialOffer = $<HTMLDialogElement>('tutorial-offer');
// People's cards and the journal (decision 0124). `questSeen` holds the cards already shown this
// session (`<quest>:<step>`, `<quest>:offer`); `questThanks` the finished quests still to thank for.
const questCard = new QuestCard($<HTMLDialogElement>('quest-card'));
const questSeen = new Set<string>();
const questThanks = new Set<string>();
function showDueCard() {
  if (questCard.isOpen || tutorialOffer.open) return;
  const due = dueCard(quests, world.map, world.trade.dockedAt, questSeen, questThanks);
  const card = due && cardFor(quests, world.map, due.quest, due.kind);
  if (!due || !card) return;
  if (due.kind === 'finished') questThanks.delete(due.quest);
  else if (due.kind === 'offer') questSeen.add(`${due.quest}:offer`);
  else questSeen.add(`${due.quest}:${quests.progress(due.quest)!.step}`);
  input.releaseAll();
  questCard.show(card);
  refreshPause();
}
quests.onEvent = (e) => {
  // While the tutorial runs, its own lesson card speaks for Rook's thanks (decision 0127).
  if (e.type === 'finished' && !tutorial.isActive) questThanks.add(e.quest);
};
questCard.onAccept = (id) => {
  // The offer already said what the first step asks.
  const first = quests.quests.find((q) => q.id === id)?.steps[0];
  if (first) questSeen.add(`${id}:${first.id}`);
  quests.accept(id);
  autosave();
};
questCard.onChoose = (id, option) => {
  quests.choose(id, option);
  autosave();
};
questCard.onClose = () => {
  refreshPause();
  showDueCard();
};
chart.quests = {
  pins: () => questPins(quests, world.map, questSeen),
  target: () => questTarget(quests, world.map),
  journal: () => journal(quests, world.map),
  track: (id) => {
    if (quests.track(id)) autosave();
  },
};
tradePanel.uiMode = settings.uiMode;
hud.portLabels.isKidMode = settings.uiMode === 'kids';
hud.isKidMode = settings.uiMode === 'kids';
tradePanel.onUiModeChange = (mode) => {
  settings.uiMode = mode;
  hud.portLabels.isKidMode = mode === 'kids';
  hud.isKidMode = mode === 'kids';
  saveSettings(settings);
};
const monitor = new FrameMonitor();
let sailStep = world.boat.sailStep;

tradePanel.onAction = () => {
  world.ship = trade.activeShip(world.trade);
  // Goods handed over move a quest on while the market is still open.
  if (quests.check().length) showDueCard();
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
    handleEvents([...trade.flushEconomy(world.trade, world.map), { type: 'docked', portId }]);
    tutorial.observe();
  } else {
    if (setPortDestination(world, portId)) {
      const anchor = view.harbours[portId];
      if (anchor) Object.assign(world.destination!, anchor);
      tutorial.destinationSelected();
      hud.showToast(t('toast.courseSet', { name: world.destination!.label }), 2);
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
const newVoyage = $('new-voyage');
const playButton = $('menu-play');
// Move a voyage to another device by QR code or file (decision 0066). The QR links back here.
const transfer = new TransferPanel(
  $('transfer'),
  world,
  storage,
  () => location.origin + location.pathname,
);
let mode: 'menu' | 'play' = 'menu';
let started = false;
let paused = true;

function refreshPause() {
  paused =
    mode === 'menu' ||
    !settingsPanel.hidden ||
    !newVoyage.hidden ||
    !help.hidden ||
    transfer.isOpen ||
    tradePanel.isOpen ||
    windHelp.open ||
    chart.isOpen ||
    tutorialOffer.open ||
    questCard.isOpen;
  coach.setSurface(
    mode === 'menu' ||
      !settingsPanel.hidden ||
      !help.hidden ||
      transfer.isOpen ||
      windHelp.open ||
      tutorialOffer.open
      ? null
      : chart.isOpen
        ? 'chart'
        : tradePanel.isOpen
          ? 'market'
          : 'sea',
  );
  input.setEnabled(!paused);
}

hud.onWindHelpChange = () => {
  input.releaseAll();
  refreshPause();
};

function showMenu() {
  mode = 'menu';
  document.body.classList.add('in-menu');
  document.body.classList.toggle('at-title', !started);
  help.hidden = true;
  settingsPanel.hidden = true;
  newVoyage.hidden = true;
  if (transfer.isOpen) transfer.close();
  if (tradePanel.isOpen) tradePanel.close();
  // Pause shows the voyage under the same menu (decision 0061).
  menu.classList.toggle('is-paused', started);
  $('menu-status').hidden = !started;
  $('menu-gold').textContent = String(world.trade.captain.gold);
  $('menu-cargo').textContent = `${trade.cargoUsed(world.trade)}/${trade.capacity(world.trade)}`;
  $('menu-play-label').textContent = started ? t('menu.resume') : t('menu.play');
  $('menu-play-icon').setAttribute('href', started ? '#i-play' : '#i-sail');
  menu.hidden = false;
  refreshPause();
  playButton.focus({ preventScroll: true });
}

/*
 * New voyage (decision 0083): a fresh voyage starts by picking a difficulty level. Captain is
 * preselected; the level can be changed later in Settings.
 */
let chosenLevel: Difficulty = world.trade.difficulty;
let levelPicked = resumedVoyage;
const levelCards = [...newVoyage.querySelectorAll<HTMLButtonElement>('.level-card')];
const markLevelCards = () => {
  for (const c of levelCards)
    c.setAttribute('aria-checked', String(c.dataset.level === chosenLevel));
};
for (const c of levelCards)
  c.addEventListener('click', () => {
    if (isDifficulty(c.dataset.level)) chosenLevel = c.dataset.level;
    markLevelCards();
  });
function openNewVoyage() {
  menu.hidden = true;
  markLevelCards();
  newVoyage.hidden = false;
  refreshPause();
  levelCards.find((c) => c.dataset.level === chosenLevel)?.focus({ preventScroll: true });
}
$('close-new-voyage').addEventListener('click', () => {
  newVoyage.hidden = true;
  showMenu();
});
$('set-sail').addEventListener('click', () => {
  trade.startVoyage(world.trade, chosenLevel);
  applyLevelWind(chosenLevel);
  markDifficulty();
  levelPicked = true;
  newVoyage.hidden = true;
  autosave();
  play();
});

function play() {
  if (!levelPicked) {
    openNewVoyage();
    return;
  }
  mode = 'play';
  started = true;
  document.body.classList.remove('in-menu', 'at-title');
  menu.hidden = true;
  tutorial.resume();
  if (tutorial.shouldOffer(resumedVoyage)) tutorialOffer.showModal();
  refreshPause();
}

function openHelp() {
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

tutorial.onChange = () => {
  coach.render();
  $('menu-tutorial-label').textContent = tutorial.isActive
    ? t('menu.tutorialContinue')
    : tutorial.status === 'unseen'
      ? t('menu.tutorial')
      : t('menu.tutorialReplay');
  $('menu-tutorial-note').textContent = tutorial.isActive
    ? t('menu.tutorialStep', {
        step: String(TUTORIAL_STEPS.indexOf(tutorial.step) + 1),
        total: String(TUTORIAL_STEPS.length),
      })
    : tutorial.status === 'unseen'
      ? t('menu.tutorialNote')
      : '';
};
tutorial.onChange();
chart.onDestinationChange = () => tutorial.destinationSelected();
tradePanel.onTrade = (kind, good) => tutorial.traded(kind, good);
tradePanel.onRender = () => coach.render();
coach.onChart = () => {
  if (tradePanel.isOpen) tradePanel.close();
  chart.open();
};
coach.onMarket = () => {
  if (world.trade.dockedAt) tradePanel.open('market');
  else coach.onChart();
  refreshPause();
};
coach.onTips = () => $('wind-help-trigger').click();
$('tutorial-start').addEventListener('click', () => {
  // A fresh voyage taking the tutorial begins alone at sea (decision 0127).
  if (!resumedVoyage && world.time < 60) {
    startAtPrologue(world);
    sailStep = world.boat.sailStep;
  }
  tutorial.start();
  tutorialOffer.close();
  refreshPause();
});
$('tutorial-free').addEventListener('click', () => {
  tutorial.skip();
  tutorialOffer.close();
  refreshPause();
});
tutorialOffer.addEventListener('cancel', () => tutorial.skip());
tutorialOffer.addEventListener('close', () => {
  refreshPause();
  $('menu-btn').focus({ preventScroll: true });
});
$('menu-tutorial').addEventListener('click', () => {
  // Enter play without automatically showing the first-voyage offer a second time.
  mode = 'play';
  started = true;
  document.body.classList.remove('in-menu', 'at-title');
  menu.hidden = true;
  if (tutorial.isActive) tutorial.resume();
  else tutorialOffer.showModal();
  refreshPause();
});
playButton.addEventListener('click', play);
$('menu-help').addEventListener('click', openHelp);
$('menu-settings').addEventListener('click', () => {
  menu.hidden = true;
  settingsPanel.hidden = false;
  $('close-settings').focus({ preventScroll: true });
});
$('menu-transfer').addEventListener('click', () => {
  menu.hidden = true;
  transfer.open('send');
  refreshPause();
});
transfer.onClose = () => {
  if (mode === 'menu') menu.hidden = false;
  refreshPause();
};
transfer.onReplaced = () => {
  // The incoming voyage is stored; reload into it without the autosave writing this one back.
  leaving = true;
  window.location.reload();
};
$('menu-btn').addEventListener('click', showMenu);
helpClose.addEventListener('click', closeHelp);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat && mode === 'play' && (chart.isOpen || !paused)) {
    e.preventDefault();
    if (chart.isOpen) chart.close();
    else chart.open();
    return;
  }
  if (e.code !== 'Escape' || windHelp.open || chart.isOpen || tutorialOffer.open) return;
  if (tradePanel.isOpen) {
    tradePanel.close();
    refreshPause();
  } else if (!settingsPanel.hidden) closeSettings();
  else if (transfer.isOpen) transfer.close();
  else if (!help.hidden) closeHelp();
  else if (!newVoyage.hidden) {
    newVoyage.hidden = true;
    showMenu();
  } else if (mode === 'play') showMenu();
});
help.hidden = true;
showMenu();
// Opened from a QR code scanned with a camera app: offer that voyage straight away.
if (location.hash.startsWith(`#${LINK_KEY}=`)) {
  const link = location.href;
  history.replaceState(null, '', location.pathname + location.search);
  menu.hidden = true;
  transfer.openWithCode(link);
  refreshPause();
}

// --- Fullscreen --------------------------------------------------------------------------------
const fsSupport = classifySupport(probeSupport());
const fsMenuButton = $('menu-fullscreen');
fsMenuButton.hidden = fsSupport !== 'api';
$('fs-hint').hidden = fsSupport !== 'home-screen';
const describeFullscreen = () => {
  const label = isFullscreen() ? t('menu.exitFullscreen') : t('menu.fullscreen');
  fsMenuButton.setAttribute('aria-label', label);
  fsMenuButton.title = label;
};
for (const button of [fsMenuButton]) {
  button.addEventListener('click', () => void toggleFullscreen());
}
onFullscreenChange(describeFullscreen);
describeFullscreen();

// --- Install as an app (decision 0039) ---------------------------------------------------------
// Only in builds: in dev a service worker would cache Vite's modules and fight hot reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // No service worker (private mode, blocked): the game still runs, just not installable.
    });
  });
}

// --- Language switcher ------------------------------------------------------------------------
// Each language is named in its own words, without flags (decision 0037). Switching saves the
// voyage and reloads, so every panel is rebuilt in the new language.
// The menu footer shows short codes (EN, FR), the settings the full names.
$('menu-language').setAttribute('aria-label', t('menu.language'));
for (const [group, short] of [
  [$('menu-language'), true],
  [$('settings-language'), false],
] as const) {
  for (const lang of LANGUAGES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = lang.id;
    b.textContent = short ? lang.id.toUpperCase() : lang.name;
    if (short) b.setAttribute('aria-label', lang.name);
    b.dataset.language = lang.id;
    b.setAttribute('aria-pressed', String(lang.id === language()));
    b.addEventListener('click', () => {
      if (lang.id === language()) return;
      settings.language = lang.id;
      saveSettings(settings);
      autosave();
      window.location.reload();
    });
    group.append(b);
  }
}

// --- Controls ----------------------------------------------------------------------------------
input.onDrag = (d) => hud.setTiller(d);
input.onZoom = (f) => view.setZoom(view.getZoom() * f);
hud.onSailStep = (step) => input.setSail(step);
const showLog = $<HTMLInputElement>('show-log');
hud.onLogToggle = (shown) => {
  settings.showLog = shown;
  showLog.checked = shown;
  saveSettings(settings);
};
hud.showLog = settings.showLog;
showLog.checked = settings.showLog;
showLog.addEventListener('change', () => {
  hud.showLog = showLog.checked;
  settings.showLog = showLog.checked;
  saveSettings(settings);
});

// Day and night can be turned off for players who dislike sailing at night (decision 0068).
const dayNight = $<HTMLInputElement>('day-night');
view.dayNight = settings.dayNight;
dayNight.checked = settings.dayNight;
dayNight.addEventListener('change', () => {
  view.dayNight = dayNight.checked;
  settings.dayNight = dayNight.checked;
  saveSettings(settings);
});

// Weather and storms can be turned off like every hazard (decision 0067; pirates will follow in
// Phase 5). Without weather there are no storms either, so that switch is greyed out.
const weatherSwitch = $<HTMLInputElement>('weather');
const storms = $<HTMLInputElement>('storms');
const syncWeather = () => {
  world.dynamicWeather = settings.weather;
  world.storms = settings.storms;
  weatherSwitch.checked = settings.weather;
  storms.checked = settings.storms;
  storms.disabled = !settings.weather;
};
syncWeather();
// Wind: steady trade wind or the shifting wind (decision 0083); the level sets its default.
const windButtons = [...$('wind-choice').querySelectorAll<HTMLButtonElement>('[data-wind]')];
const syncWind = () => {
  world.steadyWind = settings.steadyWind;
  for (const b of windButtons)
    b.setAttribute('aria-checked', String((b.dataset.wind === 'steady') === settings.steadyWind));
};
syncWind();
for (const b of windButtons)
  b.addEventListener('click', () => {
    settings.steadyWind = b.dataset.wind === 'steady';
    syncWind();
    saveSettings(settings);
  });
function applyLevelWind(level: Difficulty) {
  settings.steadyWind = knobs(level).steadyWind;
  syncWind();
  saveSettings(settings);
}

// Difficulty (decision 0083): changeable at any time; it moves the Wind choice to the level's default.
const difficultyButtons = [...$('difficulty').querySelectorAll<HTMLButtonElement>('[data-level]')];
function markDifficulty() {
  for (const b of difficultyButtons)
    b.setAttribute('aria-checked', String(b.dataset.level === world.trade.difficulty));
}
markDifficulty();
for (const b of difficultyButtons)
  b.addEventListener('click', () => {
    const level = b.dataset.level;
    if (!isDifficulty(level) || level === world.trade.difficulty) return;
    trade.setDifficulty(world.trade, level);
    chosenLevel = level;
    applyLevelWind(level);
    markDifficulty();
    autosave();
  });

weatherSwitch.addEventListener('change', () => {
  settings.weather = weatherSwitch.checked;
  syncWeather();
  saveSettings(settings);
});
storms.addEventListener('change', () => {
  settings.storms = storms.checked;
  syncWeather();
  saveSettings(settings);
});

// --- Settings panel ----------------------------------------------------------------------------
const qualityButtons = [...$('quality').querySelectorAll<HTMLButtonElement>('[data-quality]')];
const showFps = $<HTMLInputElement>('show-fps');
const qualityNow = $('quality-now');
const markQuality = () => {
  for (const b of qualityButtons)
    b.setAttribute('aria-checked', String(b.dataset.quality === settings.quality));
};
markQuality();
showFps.checked = settings.showFps;
const describeQuality = () =>
  (qualityNow.textContent = t('settings.nowUsing', { level: t(`settings.${level}`) }));
describeQuality();

$('chart-btn').addEventListener('click', () => chart.open());
function closeSettings() {
  settingsPanel.hidden = true;
  if (mode === 'menu') menu.hidden = false;
  refreshPause();
}
$('close-settings').addEventListener('click', closeSettings);
for (const b of qualityButtons)
  b.addEventListener('click', () => {
    settings.quality = b.dataset.quality as typeof settings.quality;
    saveSettings(settings);
    markQuality();
    setLevel(settings.quality === 'auto' ? guessQuality() : settings.quality);
  });
const musicVolume = $<HTMLInputElement>('music-volume');
const musicValue = $('music-volume-value');
musicVolume.value = String(Math.round(settings.musicVolume * 100));
musicValue.textContent = `${musicVolume.value}%`;
musicVolume.addEventListener('input', () => {
  musicValue.textContent = `${musicVolume.value}%`;
  settings.musicVolume = Number(musicVolume.value) / 100;
  music.unlock();
  music.setVolume(settings.musicVolume);
});
musicVolume.addEventListener('change', () => saveSettings(settings));
showFps.addEventListener('change', () => {
  settings.showFps = showFps.checked;
  saveSettings(settings);
});
// A testing aid, not a player setting: only with ?debug (decision 0061).
$('shift-wind').hidden = !new URLSearchParams(location.search).has('debug');
$('shift-wind').addEventListener('click', () => {
  world.windOffsetDeg = (world.windOffsetDeg + 45) % 360;
  hud.showToast(t('toast.windShifts'), 1.5);
});
$('reset-boat').addEventListener('click', () => {
  resetBoat(world);
  sailStep = world.boat.sailStep;
  settingsPanel.hidden = true;
  refreshPause();
});
const resetSaveBtn = document.getElementById('reset-save');
resetSaveBtn?.addEventListener('click', () => {
  if (window.confirm(t('settings.confirmNewGame'))) {
    leaving = true;
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
/** Set while the page reloads into a new or transferred voyage: nothing may save over it. */
let leaving = false;
function autosave() {
  if (leaving) return;
  if (storage) saveGame(storage, world);
  lastSave = world.time;
}
function handleEvents(events: WorldEvent[]) {
  hud.handleEvents(events);
  for (const e of events) {
    if (e.type === 'docked') {
      const portName = trade.findPort(world.map, e.portId)?.name ?? e.portId;
      // Ramming the pier also stops you in range: keep the damage toast, the harbour shows repair.
      const hurt = events.some((x) => x.type === 'crash' || x.type === 'reef-strike');
      if (!hurt) hud.showToast(t('toast.docked', { name: portName }), 2.5);
      tradePanel.open('market');
      refreshPause();
      autosave();
      // "Not now" lasts one call: the offer comes back the next time you dock there.
      for (const key of questSeen) if (key.endsWith(':offer')) questSeen.delete(key);
      showDueCard();
    } else if (e.type === 'discovered') {
      const portName = trade.findPort(world.map, e.portId)?.name ?? e.portId;
      hud.showToast(t('toast.discovered', { name: portName }), 4);
      autosave();
    } else if (e.type === 'help-order') {
      // A neglected town asks for help: its order pays extra (decision 0069).
      const order = world.trade.contracts.byPort[e.portId];
      const portName = trade.findPort(world.map, e.portId)?.name ?? e.portId;
      if (order)
        hud.showToast(
          t('toast.help', {
            name: portName,
            qty: order.qty,
            good: goodName(order.good).toLowerCase(),
          }),
          5,
        );
      if (tradePanel.isOpen) tradePanel.render();
    } else if (e.type === 'level-up') {
      // A town grew (decision 0059): new wants on its sign, and the island grows with it.
      const port = trade.findPort(world.map, e.portId);
      const portName = port?.name ?? e.portId;
      // A new town opens its workshop: say what it makes now (decision 0063).
      const opened = port?.levelProduces?.[String(e.level) as '2' | '3' | '4'] ?? [];
      const specialty = opened.find(isSpecialty);
      // A far yard starts making its rare good (decision 0065).
      const rare = opened.find(isRare);
      hud.showToast(
        rare
          ? t('toast.rareGood', { name: portName, good: goodName(rare) })
          : specialty
            ? t('toast.workshop', {
                name: portName,
                workshop: workshopName(specialty),
                good: goodSome(specialty),
              })
            : t('toast.levelUp', { name: portName, level: townLevelName(e.level) }),
        5,
      );
      view.setSettlementLevels(settlementLevels(world.trade));
      hud.portLabels.rebuild();
      if (tradePanel.isOpen) tradePanel.render();
      autosave();
    } else if (e.type === 'undocked') {
      const portName = trade.findPort(world.map, e.portId)?.name ?? e.portId;
      hud.showToast(t('toast.departed', { name: portName }), 1.5);
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
let coachTick = 0;
let foghornIn = 1.5;

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  const sailDelta = input.takeSailDelta();
  const sailTarget = input.takeSailTarget();
  if (!paused) {
    if (sailTarget !== null) sailStep = sailTarget;
    sailStep = clamp(sailStep + sailDelta, 0, SAIL_STEPS.length - 1);
    accumulator += dt;
    let steps = 0;
    while (!paused && accumulator >= SIM_STEP && steps < 6) {
      const controls = { steer: input.steer, sailStep };
      handleEvents(stepWorld(world, controls, SIM_STEP));
      tutorial.observe(controls, SIM_STEP);
      if (quests.update(SIM_STEP).length) showDueCard();
      // The foghorn sounds every few seconds until the wreck is in sight (decision 0127).
      foghornIn -= SIM_STEP;
      if (tutorial.isActive && tutorial.step === 'foghorn' && foghornIn <= 0) {
        music.foghorn();
        foghornIn = 9;
      }
      accumulator -= SIM_STEP;
      steps++;
    }
    if (steps === 6) accumulator = 0;
  }

  if (!chart.isOpen && !tutorialOffer.open) view.render(dt);
  // Pause menus and translucent sheets leave sea instruments visible. Only the title's
  // CSS rule and the opaque, full-screen chart cover the entire HUD.
  const hudVisible = !(mode === 'menu' && !started) && !chart.isOpen;
  hud.mark = tutorial.mark;
  view.castawayWaiting = tutorial.mark !== null;
  hud.update(dt, (x, y) => view.project(x, y), size, !paused, hudVisible);
  // Coach marks follow moving targets (port signs) about ten times a second.
  if (++coachTick % 6 === 0) coach.place();

  if (monitor.sample(dt) && settings.quality === 'auto' && level !== 'low') {
    setLevel(lowerQuality(level));
  }
  hud.setFps(settings.showFps ? monitor.fps : null, hudVisible);
}

// Stop rendering while the tab is hidden (battery on phones and tablets).
document.addEventListener('visibilitychange', () => {
  music.setHidden(document.hidden);
  if (document.hidden) {
    autosave();
    cancelAnimationFrame(frame);
  } else {
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
});
frame = requestAnimationFrame(tick);

// The tuning panel loads only in tune mode, as its own chunk: players never download it.
if (tuneMode) {
  void import('./tune/tunePanel').then(({ openTunePanel }) =>
    openTunePanel({
      world,
      storage: browserStorage,
      gameUrl: () => location.origin + location.pathname,
      newVoyage: () => {
        leaving = true;
        if (storage) clearSave(storage);
        location.reload();
      },
    }),
  );
}

// `?debug` exposes the game objects in the console (used by screenshot scripts too). Until the
// trade panel lands, trading works from there, e.g. `fwt.trade.buy(fwt.world.trade, 'fish', 5)`.
if (new URLSearchParams(location.search).has('debug')) {
  const newGame = () => {
    leaving = true;
    if (storage) clearSave(storage);
    location.reload();
  };
  Object.assign(window, {
    fwt: { world, view, input, trade, tradePanel, quests, tutorial, newGame },
  });
}
