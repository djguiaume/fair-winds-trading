import { renderDifficultyButtons, renderLevelCards } from './ui/levelCards';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from './data/maps';
import { STRESS_PREFIX, stressMap } from './data/stressMap';
import { PHASE4_PREFIX, grownMap } from './data/grownMap';
import {
  EDITED_PREFIX,
  EDITED_SEA_PREFIX,
  editedMap,
  editedSea,
  editedQuests,
  memoryStorage,
  prefixedStorage,
} from './data/editedMap';
import {
  TUNE_LINK_KEY,
  TUNE_PREFIX,
  applyChanges,
  decodeTuneCode,
  loadTuneChanges,
  saveTuneChanges,
} from './data/tuningEdits';
import { GamepadPoller, chartPad, padInUse, seaPad, type PadContext } from './input/gamepad';
import { PadFocus, type PadScreen } from './ui/padFocus';
import { Input } from './input/input';
import {
  FrameMonitor,
  QUALITY,
  type QualityLevel,
  guessQuality,
  lowerQuality,
} from './render/quality';
import { GameView } from './render/view';
import { SAIL_STEPS, createBoat, knotToUnits } from './sim/boat';
import { isFar, isRare, isSpecialty } from './sim/goods';
import { portNow, questsDone } from './sim/settlement';
import { foundSite, foundedSites, townLevels } from './sim/founding';
import { bearingTo, clamp } from './sim/math';
import { type SaveStorage, clearSave, loadGame, saveGame } from './sim/save';
import { LINK_KEY } from './sim/saveTransfer';
import { SLOOP, noGoAngle } from './sim/ship';
import * as trade from './sim/trade';
import { type Difficulty, isDifficulty, knobs } from './sim/difficulty';
import { daylightAt } from './sim/daylight';
import { hazeSwitches } from './sim/windZones';
import { QuestBook, useEditedQuests } from './sim/quests';
import { questTestFrom, sailableHeading, testBerth } from './sim/questTest';
import { QuestTestBar } from './ui/questTestBar';
import { type StepEffects, type StepWind, heldWind } from './sim/stepEffects';
import { QuestCard } from './ui/questCard';
import { QuestNote } from './ui/questNote';
import {
  cardFor,
  dueCard,
  journal,
  quayItems,
  questGoal,
  questPins,
  lessonFor,
  questTarget,
  trackedMarkers,
} from './ui/questView';
import { LESSONS_QUEST, TUTORIAL_QUEST, TutorialChoice, TutorialCoach } from './ui/tutorial';
import {
  type WorldEvent,
  createWorld,
  setPortDestination,
  refreshPiers,
  resetBoat,
  resetLand,
  startAtPrologue,
  syncWorldLand,
  holdStorms,
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
import type { Bench } from './perf/bench';
import type { PerfReadout } from './perf/perfReadout';
import { Music } from './audio/music';
import { wordCount } from './audio/babble';
import { SeaChart } from './ui/seaChart';
import {
  LANGUAGES,
  browserLanguages,
  detectLanguage,
  language,
  goodName,
  workshopName,
  goodSome,
  hasText,
  setLanguage,
  t,
  townLevelName,
  translateDom,
  useTextEdits,
} from './i18n';
import { TradePanel } from './ui/tradePanel';
import { HomePanel, buildingName, effectLine } from './ui/homePanel';
import { builtByIsland, giveHomeIsland, homeSpots, islandHome, offerHomeSpot } from './sim/home';
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
// The `?bench` device benchmark (decision 0154) sails a fresh voyage kept in memory with every
// hazard on and the shifting wind, so runs compare; it never saves the player's settings.
const benchMode = new URLSearchParams(location.search).has('bench');
if (benchMode)
  Object.assign(settings, {
    weather: true,
    storms: true,
    dayNight: true,
    windZones: true,
    currents: true,
    steadyWind: false,
  });
const keepSettings = () => {
  if (!benchMode) saveSettings(settings);
};
/** The running benchmark, once `?bench` has started it. */
let bench: Bench | null = null;

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
// The bigger-map test sea (decision 0115), `?map=stress`, and the Phase 4 sea as laid out so far
// (decision 0152), `?map=phase4`: each sails its own voyage too.
const mapParam = new URLSearchParams(location.search).get('map');
// The sea editor's grown sea (decision 0161): `?map=edited&sea=phase4`.
const editedPhase4 = mapParam === 'edited' && editedSea(location.search);
const phase4Sea = mapParam === 'phase4';
const stressTest = mapParam === 'stress';
const devSea = stressTest || phase4Sea;
const playtestMap =
  editedMap(location.search, browserStorage) ??
  (phase4Sea
    ? prepareMap(grownMap(PHASE1_SOURCE))
    : stressTest
      ? prepareMap(stressMap(PHASE1_SOURCE))
      : null);
// The quest builder's quests and text sail with the edited map (decision 0142). A quest played
// from one of its steps (`&quest=…&step=…`) starts a fresh voyage kept in memory only.
const playtestQuests =
  playtestMap && !devSea ? editedQuests(location.search, browserStorage) : null;
if (playtestQuests) {
  useEditedQuests(playtestQuests.quests);
  useTextEdits(playtestQuests.text);
}
const questTest = playtestMap && !devSea ? questTestFrom(location.search) : null;
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
  questTest || benchMode
    ? memoryStorage()
    : playtestMap && browserStorage
      ? prefixedStorage(
          browserStorage,
          phase4Sea
            ? PHASE4_PREFIX
            : stressTest
              ? STRESS_PREFIX
              : editedPhase4
                ? EDITED_SEA_PREFIX
                : EDITED_PREFIX,
        )
      : browserStorage;
const storage =
  tuneMode && voyageStorage ? prefixedStorage(voyageStorage, TUNE_PREFIX) : voyageStorage;
const world = createWorld(playtestMap ?? PHASE1_MAP, SLOOP);
if (playtestMap) {
  document.title = `${phase4Sea ? 'Phase 4 sea' : stressTest ? 'Stress test' : questTest ? 'Quest test' : editedPhase4 ? 'Edited Phase 4 sea' : 'Edited map'} · ${document.title}`;
  const badge = document.createElement('a');
  badge.href = editedPhase4 ? './editor.html?sea=phase4' : './editor.html';
  badge.textContent = phase4Sea
    ? 'Phase 4 sea (south laid out)'
    : stressTest
      ? 'Stress test sea'
      : editedPhase4
        ? 'Edited Phase 4 sea · back to editor'
        : 'Edited map · back to editor';
  badge.style.cssText =
    'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:50;padding:3px 10px;' +
    'border-radius:10px;background:#123246e6;color:#f3d37e;font:600 12px sans-serif;' +
    'text-decoration:none;';
  // A label only: the stress and Phase 4 seas have no editor page to go back to.
  if (devSea) {
    badge.removeAttribute('href');
    badge.style.pointerEvents = 'none';
  }
  // The quest test bar says it all (and links back) instead.
  if (!questTest) document.body.append(badge);
}
const resumedVoyage = storage ? loadGame(storage, world) : false;
let level: QualityLevel = settings.quality === 'auto' ? guessQuality() : settings.quality;
const view = new GameView(canvas, world, level);
// `?perf` test aids (decision 0148): `scale=0.7` draws fewer pixels, `fps=30` caps the frame rate.
const perfParams = new URLSearchParams(location.search);
const perfMode = perfParams.has('perf') || benchMode;
const perfScale = perfMode ? Math.min(1, Math.max(0.3, Number(perfParams.get('scale')) || 1)) : 1;
const frameCap = perfMode ? Math.max(0, Number(perfParams.get('fps')) || 0) : 0;
view.renderScale = perfScale;
const hud = new Hud(
  world,
  {
    seen: settings.seenWindHint,
    markSeen: () => {
      settings.seenWindHint = true;
      keepSettings();
    },
  },
  view.harbours,
);
// Press warning (decision 0078): a one-time "ease the sails" message, and a buzz and a creak
// when she crosses into red.
hud.seenPressHint = settings.seenPressHint;
hud.onPressHintSeen = () => {
  settings.seenPressHint = true;
  keepSettings();
};
// The first current met (decision 0140): a one-time hint, then a short "charted" line.
hud.seenCurrentHint = settings.seenCurrentHint;
hud.onCurrentHintSeen = () => {
  settings.seenCurrentHint = true;
  keepSettings();
};
// The first storm belt met (decision 0167): a one-time hint; its HUD line says the rest.
hud.seenBeltHint = settings.seenBeltHint;
hud.onBeltHintSeen = () => {
  settings.seenBeltHint = true;
  keepSettings();
};
hud.onPressDanger = () => {
  navigator.vibrate?.([70, 50, 70]);
  music.creak();
};
const input = new Input(stage);
const chart = new SeaChart($('chart') as HTMLDialogElement, world, view.harbours);
chart.fogBlur = QUALITY[level].chartFogBlur;
chart.onChange = () => {
  input.releaseAll();
  // A lesson may wait on the chart opening or closing (decision 0151).
  quests.check();
  refreshPause();
};
const tradePanel = new TradePanel($('trade-panel'), world);
// The home island (decision 0126). Rook's thanks gives it (decision 0127); `?home` gives it to the
// voyage being played and offers every arc spot, to try the build spots.
if (new URLSearchParams(location.search).has('home')) {
  giveHomeIsland(world.trade, world.map);
  for (const spot of homeSpots(world.map)) offerHomeSpot(world.trade, world.map, spot.id);
}
view.setHomeBuildings(builtByIsland(world.trade.home));
// What stands only before or after a quest (decision 0130).
view.setQuestsDone(questsDone(world.trade));
const homePanel = new HomePanel($('home-ui'), world);
homePanel.onChange = () => refreshPause();
homePanel.onBuilt = (building) => {
  view.setHomeBuildings(builtByIsland(world.trade.home));
  hud.showToast(t('home.built', { name: buildingName(building), effect: effectLine(building) }), 5);
  autosave();
};
homePanel.onRepaired = (gold) => {
  hud.showToast(t('trade.repaired', { gold }), 2.5);
  autosave();
};
homePanel.onStored = () => autosave();
// Quests (decision 0125), the tutorial too (decision 0151): saved with the voyage.
const quests = new QuestBook(world, undefined, {
  // A night step counts at any time when night is switched off (hazards stay optional).
  nightOk: () => !settings.dayNight || daylightAt(world.time).night >= 0.5,
  screen: () => (chart.isOpen ? 'chart' : tradePanel.isOpen ? 'market' : 'sea'),
});
// Whether a fresh voyage offers the tutorial: kept in the browser across voyages.
const tutorialChoice = new TutorialChoice(world.map.name, storage);
// A lesson under way in the browser's storage before 0151 moves into the voyage once.
const legacyLesson = resumedVoyage ? tutorialChoice.legacy() : null;
if (legacyLesson) quests.restore(TUTORIAL_QUEST, legacyLesson.step, legacyLesson.vars);
const tutorialRunning = () => quests.isRunning(TUTORIAL_QUEST);
const coach = new TutorialCoach(quests, view.harbours);
const tutorialOffer = $<HTMLDialogElement>('tutorial-offer');
// People's cards and the journal (decision 0124). `questSeen` holds the cards already shown this
// session (`<quest>:<step>`, `<quest>:offer`); `questThanks` the finished quests still to thank for.
const questCard = new QuestCard($<HTMLDialogElement>('quest-card'));
const questSeen = new Set<string>();
const questThanks = new Set<string>();
/**
 * A thanks card was shown in this harbour: a new offer waits for the next visit instead of
 * following it straight away (decision 0139), so one person speaks per call.
 */
let offersWait = false;
/** The main quest's card due now (decision 0141): the others speak on the Quay tab and in notes. */
function dueMainCard() {
  // While a lesson runs, its bubbles speak: an arc offered meanwhile (Kit's, at Saltmere) waits
  // for the next visit after it (decisions 0130, 0151).
  if (quests.lesson) return null;
  const docked = world.trade.dockedAt;
  return dueCard(quests, world.map, docked, questSeen, questThanks, (q) => !!q.main);
}
/**
 * A main quest's card, if one is due (decision 0141): docked, it is the arrival card, shown before
 * the harbour screen; it never covers the harbour screen, and waits for the next arrival instead.
 */
function showDueCard(): boolean {
  // The benchmark sails on through every card (decision 0154).
  if (bench || questCard.isOpen || tutorialOffer.open || tradePanel.isOpen) return false;
  const due = dueMainCard();
  const card = due && cardFor(quests, world.map, due.quest, due.kind);
  if (!due || !card) return false;
  if (due.kind === 'offer' && offersWait) return false;
  if (due.kind === 'finished') {
    questThanks.delete(due.quest);
    offersWait = true;
  } else if (due.kind === 'offer') questSeen.add(`${due.quest}:offer`);
  else questSeen.add(`${due.quest}:${quests.progress(due.quest)!.step}`);
  input.releaseAll();
  const docked = world.trade.dockedAt;
  questCard.show(card, docked ? trade.findPort(world.map, docked)?.name : undefined);
  music.speak(card.giver?.voice, wordCount(card.ask ?? card.speech), card.mood);
  refreshPause();
  return true;
}
/** Docked: the arrival card if a main quest has one, else straight to the harbour screen. */
function openHarbour() {
  if (!showDueCard()) tradePanel.open('market');
  refreshPause();
}
// Every other quest's news away from its harbour: a small note at sea (decision 0141).
const questNote = new QuestNote($<HTMLButtonElement>('quest-note'), $('captain-stats'));
questNote.onOpen = () => chart.open();
/** Sites founded so far (decision 0157): a new one opens its harbour and goes on the chart. */
let founded = foundedSites(world.map, world.trade).join();
function checkFounded() {
  const now = foundedSites(world.map, world.trade);
  if (now.join() === founded) return;
  const was = founded.split(',');
  founded = now.join();
  view.setSettlementLevels(townLevels(world.map, world.trade));
  hud.portLabels.rebuild();
  for (const id of now.filter((p) => !was.includes(p)))
    hud.showToast(t('toast.founded', { name: trade.findPort(world.map, id)?.name ?? id }), 5);
  autosave();
}
quests.onEvent = (e) => {
  const quest = quests.quests.find((q) => q.id === e.quest);
  if (e.type === 'landed') {
    hud.showToast(t('toast.landed', { qty: e.qty, good: goodName(e.good).toLowerCase() }), 3);
    return;
  }
  if (e.type === 'moved') {
    // A step took the boat to its place (decision 0164): sails down, camera with her.
    sailStep = world.boat.sailStep;
    // Land a quest raised or cleared where she arrives is in place before she is seen (0166).
    syncWorldLand(world, true);
    view.jumpToBoat();
    if (tradePanel.isOpen) tradePanel.close();
  }
  checkFounded();
  if (quest?.lesson) {
    // A lesson speaks in its own bubble, and its last one says it is done (decision 0151).
    // Without its coach (the tutorial skipped, decision 0160) it ends without a word.
    if (e.type === 'finished' && quests.isCoached(e.quest)) {
      coach.finished = e.quest;
      if (e.quest === TUTORIAL_QUEST) tutorialChoice.set('completed');
    }
    coach.render();
    refreshMenuTutorial();
    return;
  }
  // While a lesson runs, its bubble speaks for Rook's thanks (decision 0127).
  if (e.type === 'finished' && !quests.lesson) questThanks.add(e.quest);
  if (e.type === 'finished') view.setQuestsDone(questsDone(world.trade));
  if (quest?.main || quests.lesson) return;
  if (e.type === 'step' || e.type === 'choice' || e.type === 'finished') {
    const step = quests.progress(e.quest)?.step;
    const kind = e.type === 'finished' ? 'finished' : e.type;
    const card = step && cardFor(quests, world.map, e.quest, kind);
    if (card) questNote.push(`${e.quest}:${step}`, card);
  }
};
/** The captain's yes to an offer, on a card or on the Quay tab. */
function acceptQuest(id: string) {
  // The offer already said what the first step asks.
  const first = quests.quests.find((q) => q.id === id)?.steps[0];
  if (first) questSeen.add(`${id}:${first.id}`);
  quests.accept(id);
  autosave();
}
questCard.onAccept = acceptQuest;
questCard.onIgnore = (id) => {
  if (quests.ignore(id)) autosave();
};
tradePanel.quay = {
  items: () =>
    quests.lesson ? [] : quayItems(quests, world.map, world.trade.dockedAt, questSeen, questThanks),
  seen: (keys) => {
    for (const key of keys) questSeen.add(key);
  },
  act: (id, act, option) => {
    if (act === 'accept') acceptQuest(id);
    else if (act === 'later') questSeen.add(`${id}:offer`);
    else if (act === 'ignore') {
      if (quests.ignore(id)) autosave();
    } else if (act === 'choose' && option) {
      quests.choose(id, option);
      autosave();
    }
  },
};
questCard.onChoose = (id, option) => {
  quests.choose(id, option);
  autosave();
};
questCard.onClose = () => {
  // After the arrival card (or "To the market"), the harbour screen.
  if (!showDueCard() && world.trade.dockedAt && !tradePanel.isOpen) tradePanel.open('market');
  refreshPause();
};
// The tracked step's places at sea: gates, spots, landings (decision 0130), the prologue's wreck
// too while a lesson is about it (decisions 0139, 0151).
view.stepMarkers = () => trackedMarkers(quests);
view.questMarks = () => quests.runningMarks;
chart.questMarks = () => quests.runningMarks;
chart.quests = {
  markers: () => trackedMarkers(quests)?.points ?? [],
  pins: () => questPins(quests, world.map, questSeen),
  target: () => questTarget(quests, world.map),
  journal: () => journal(quests, world.map),
  track: (id) => {
    if (quests.track(id)) autosave();
  },
  takeUp: (id) => {
    if (!quests.unignore(id)) return;
    questSeen.delete(`${id}:offer`);
    autosave();
  },
};
tradePanel.uiMode = settings.uiMode;
hud.portLabels.isKidMode = settings.uiMode === 'kids';
hud.isKidMode = settings.uiMode === 'kids';
tradePanel.onUiModeChange = (mode) => {
  settings.uiMode = mode;
  hud.portLabels.isKidMode = mode === 'kids';
  hud.isKidMode = mode === 'kids';
  keepSettings();
};
const monitor = new FrameMonitor();
/** The `?perf` readout, once its chunk has loaded (decision 0148). */
let perf: PerfReadout | null = null;
let sailStep = world.boat.sailStep;

tradePanel.onAction = () => {
  world.ship = trade.activeShip(world.trade);
  // Goods handed over move a quest on while the market is still open.
  if (quests.check().length) showDueCard();
  coach.render();
  autosave();
};
tradePanel.onClose = () => {
  refreshPause();
  // A main quest's card that came due in the harbour (or at sea meanwhile).
  if (!world.trade.dockedAt) showDueCard();
};

hud.onDockClick = () => {
  if (world.trade.dockedAt) openHarbour();
};

hud.onPortClick = (portId: string) => {
  if (world.trade.dockedAt === portId) openHarbour();
  else if (trade.tryDock(world.trade, world.map, world.boat, portId)) {
    handleEvents([...trade.flushEconomy(world.trade, world.map), { type: 'docked', portId }]);
    quests.check();
  } else {
    if (setPortDestination(world, portId)) {
      const anchor = view.harbours[portId];
      if (anchor) Object.assign(world.destination!, anchor);
      quests.check();
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
    homePanel.isOpen ||
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
  if (tutorialChoice.shouldOffer(resumedVoyage) && !tutorialRunning()) tutorialOffer.showModal();
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
  keepSettings();
  if (mode === 'menu') menu.hidden = false;
  refreshPause();
}

/**
 * The title menu's lessons line: the tutorial until it is seen (start, continue at a step), then
 * the sailing lessons (decision 0164), which replace "Replay tutorial".
 */
function refreshMenuTutorial() {
  const lesson = lessonFor(quests, view.harbours);
  const unseen = tutorialChoice.status === 'unseen';
  const button = $('menu-tutorial') as HTMLButtonElement;
  // The first voyage's story running without its coach (0160) keeps the sea to itself.
  button.disabled = !lesson && quests.lesson !== undefined;
  $('menu-tutorial-label').textContent =
    lesson?.quest === TUTORIAL_QUEST
      ? t('menu.tutorialContinue')
      : lesson?.quest === LESSONS_QUEST
        ? t('menu.lessonsContinue')
        : unseen
          ? t('menu.tutorial')
          : t('menu.lessons');
  $('menu-tutorial-note').textContent = lesson
    ? t('menu.tutorialStep', {
        step: String(Math.max(1, lesson.stepNo)),
        total: String(lesson.steps),
      })
    : unseen
      ? t('menu.tutorialNote')
      : '';
}
refreshMenuTutorial();
// A course set or cleared on the chart may move a lesson on (decision 0151).
chart.onDestinationChange = () => quests.check();
tradePanel.onRender = () => coach.render();
coach.onOption = (quest, option) => {
  quests.choose(quest, option);
  coach.render();
  autosave();
};
coach.onSkip = (quest) => {
  // Skip leaves the lessons, not the story: the rescue and Rook's ride home (decision 0160).
  quests.coachOff(quest);
  if (quest === TUTORIAL_QUEST) tutorialChoice.set('skipped');
  coach.render();
  refreshMenuTutorial();
  autosave();
};
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
  coach.finished = null;
  quests.ask(TUTORIAL_QUEST);
  tutorialOffer.close();
  refreshPause();
});
/**
 * "Skip the lessons" (was "Free sailing", renamed by decision 0160): no lessons. A fresh voyage still plays the prologue's story without the coach
 * (decision 0160): alone at sea, sails down, the foghorn, the rescue, Rook's ride home. Otherwise
 * the tutorial stops, if it was running.
 */
function declineTutorial() {
  if (
    !resumedVoyage &&
    world.time < 60 &&
    !quests.progress(TUTORIAL_QUEST) &&
    startAtPrologue(world)
  ) {
    sailStep = world.boat.sailStep;
    quests.ask(TUTORIAL_QUEST);
    quests.coachOff(TUTORIAL_QUEST);
  } else quests.drop(TUTORIAL_QUEST);
  tutorialChoice.set('skipped');
  coach.render();
  refreshMenuTutorial();
}
$('tutorial-free').addEventListener('click', () => {
  declineTutorial();
  tutorialOffer.close();
  refreshPause();
});
tutorialOffer.addEventListener('cancel', declineTutorial);
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
  if (tutorialRunning() || quests.isRunning(LESSONS_QUEST)) {
    // Carry on with the lesson under way.
  } else if (tutorialChoice.status === 'unseen') tutorialOffer.showModal();
  else {
    // Seen the tutorial: Rook's sailing lessons, from wherever the boat is (decision 0164).
    coach.finished = null;
    quests.ask(LESSONS_QUEST);
    coach.render();
    refreshMenuTutorial();
    autosave();
  }
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
  goBack();
});
/** Esc, and B on a controller (decision 0163): close the screen on top, or pause at sea. */
function goBack() {
  if (tradePanel.isOpen) {
    tradePanel.close();
    refreshPause();
  } else if (homePanel.isOpen) homePanel.close();
  else if (!settingsPanel.hidden) closeSettings();
  else if (transfer.isOpen) transfer.close();
  else if (!help.hidden) closeHelp();
  else if (!newVoyage.hidden) {
    newVoyage.hidden = true;
    showMenu();
  } else if (mode === 'play') showMenu();
}
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

/**
 * Play a quest from one of its steps (decision 0142): a fresh Captain voyage with the tutorial
 * skipped, the quests before it finished, the boat docked at the asked port or at the asked spot
 * at sea, and the quest test bar on top. Restart reloads the page: the voyage is in memory only.
 */
function startQuestTest(test: NonNullable<typeof questTest>) {
  trade.startVoyage(world.trade, 'captain');
  applyLevelWind('captain');
  markDifficulty();
  levelPicked = true;
  const bar = new QuestTestBar(quests, test.quest);
  const started = quests.testStart(test.quest, test.step).length > 0;
  trade.syncMarketLevels(world.trade, world.map);
  refreshPiers(world);
  view.setHomeBuildings(builtByIsland(world.trade.home));
  view.setQuestsDone(questsDone(world.trade));
  const berth = test.port
    ? testBerth(world.map, world.trade, world.piers, test.port, world.ship.id)
    : null;
  const at = test.at ?? berth;
  if (at) {
    // At sea she lies off the wind, so the test can start straight away.
    const asked = (at.headingDeg * Math.PI) / 180;
    const heading = berth ? asked : sailableHeading(asked, world.wind.from, noGoAngle(world.ship));
    world.boat = createBoat(at.x, at.y, heading);
    world.destination = null;
    sailStep = world.boat.sailStep;
  }
  // The quests the test marked done raise or clear their land at once (decision 0166).
  resetLand(world);
  play();
  if (berth && test.port && trade.tryDock(world.trade, world.map, world.boat, test.port)) {
    handleEvents([
      ...trade.flushEconomy(world.trade, world.map),
      { type: 'docked', portId: test.port },
    ]);
  } else if (started) showDueCard();
  bar.update();
  bar.onRestart = () => {
    leaving = true;
    location.reload();
  };
  bar.onSkip = () => {
    quests.skipStep();
    showDueCard();
    bar.update();
  };
  const onEvent = quests.onEvent;
  quests.onEvent = (e) => {
    onEvent(e);
    bar.update();
  };
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
      keepSettings();
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

/*
 * Game controller (decision 0162): one poller, read once a frame in `tick` and only after a pad
 * has been seen. At sea and on the chart the buttons do what `src/data/controls.json` says; the
 * rest (menus, the harbour, cards) goes to `pad.onMenuPress`.
 */
const pad = new GamepadPoller();
pad.onConnect = (connected) => {
  document.body.classList.toggle('has-gamepad', connected);
  if (connected) hud.showToast(t('toast.padConnected'), 3);
};
/** Where pad presses go: the boat, the open chart, or a menu, dialog or card on top. */
function padContext(): PadContext {
  if (chart.isOpen && !questCard.isOpen && !tutorialOffer.open && !windHelp.open) return 'chart';
  return paused ? 'menu' : 'sea';
}
function readPad(now: number, dt: number) {
  const frame = pad.poll(now);
  if (!frame) return;
  const context = padContext();
  // Every frame: the stick over a menu, and a screen just opened or closed (by A or B) gets its
  // focus or loses its hints. Nothing is on top at sea or on the bare chart.
  padFocus.frame(frame, now);
  if (context === 'sea') {
    const sea = seaPad(frame, dt);
    input.setPadSteer(sea.steer);
    if (sea.sail) input.pressSail(sea.sail);
    if (sea.strike) input.setSail(0);
    if (sea.zoom !== 1) view.setZoom(view.getZoom() * sea.zoom);
    if (sea.harbour && world.trade.dockedAt) openHarbour();
    else if (sea.chart) chart.open();
    else if (sea.pause) showMenu();
    if (padInUse(frame)) input.onActivity();
    for (const p of sea.other) pad.onMenuPress(p, context);
  } else if (context === 'chart') {
    const c = chartPad(frame, dt);
    chart.panBy(c.panX, c.panY);
    if (c.zoom !== 1) chart.zoomBy(c.zoom);
    if (c.fit) chart.fit();
    if (c.close) chart.back();
    for (const p of c.other) pad.onMenuPress(p, context);
  } else for (const p of frame.presses) pad.onMenuPress(p, context);
}
/**
 * The screen on top that the pad's focus moves over (decision 0163), in the order Esc closes
 * them; a dialog (a quest card, the tutorial offer, wind help) first. The chart moves by itself.
 */
function padScreen(): PadScreen | null {
  const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
  const dialog = dialogs.filter((d) => d.id !== 'chart').pop();
  if (dialog)
    return {
      root: dialog,
      back: () => {
        // As Esc on a dialog: it may refuse (`cancel` prevented), else it closes.
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
      },
    };
  if (chart.isOpen) return null;
  const screen = (root: HTMLElement | null) => (root ? { root, back: goBack } : null);
  if (tradePanel.isOpen) return screen($('trade-panel'));
  if (homePanel.isOpen) return screen($('home-ui').querySelector<HTMLElement>('.home-card'));
  if (!settingsPanel.hidden) return screen(settingsPanel);
  if (transfer.isOpen) return screen($('transfer'));
  if (!help.hidden) return screen(help);
  if (!newVoyage.hidden) return screen(newVoyage);
  if (!menu.hidden) return screen(menu);
  return null;
}
const padFocus = new PadFocus(padScreen, document.getElementById('pad-hints'));
pad.onMenuPress = (p, context) => padFocus.press(p, context);
pad.onUsingPad((using) => padFocus.setUsing(using));
// Start in the pause menu sets sail again, as the menu's own button does.
padFocus.onResume = () => {
  if (started && !menu.hidden) playButton.click();
};
const showLog = $<HTMLInputElement>('show-log');
hud.onLogToggle = (shown) => {
  settings.showLog = shown;
  showLog.checked = shown;
  keepSettings();
};
hud.showLog = settings.showLog;
showLog.checked = settings.showLog;
showLog.addEventListener('change', () => {
  hud.showLog = showLog.checked;
  settings.showLog = showLog.checked;
  keepSettings();
});

// Day and night can be turned off for players who dislike sailing at night (decision 0068).
const dayNight = $<HTMLInputElement>('day-night');
view.dayNight = settings.dayNight;
dayNight.checked = settings.dayNight;
dayNight.addEventListener('change', () => {
  view.dayNight = dayNight.checked;
  settings.dayNight = dayNight.checked;
  keepSettings();
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
  // The storm belt's squalls (decision 0167) are storms in a wind zone: they need all three.
  world.stormBelt = settings.stormBelt;
  stormBelt.checked = settings.stormBelt;
  stormBelt.disabled = !settings.weather || !settings.storms || !settings.windZones;
};
// Wind zones (decision 0140) have their own switch, like every hazard.
const windZones = $<HTMLInputElement>('wind-zones');
const stormBelt = $<HTMLInputElement>('storm-belt');
syncWeather();
world.windZones = settings.windZones;
windZones.checked = settings.windZones;
windZones.addEventListener('change', () => {
  world.windZones = windZones.checked;
  settings.windZones = windZones.checked;
  syncWeather();
  keepSettings();
});
stormBelt.addEventListener('change', () => {
  settings.stormBelt = stormBelt.checked;
  syncWeather();
  keepSettings();
});
// Currents (decision 0140): their own switch too.
const currentsSwitch = $<HTMLInputElement>('currents');
world.currentsOn = settings.currents;
currentsSwitch.checked = settings.currents;
currentsSwitch.addEventListener('change', () => {
  world.currentsOn = currentsSwitch.checked;
  settings.currents = currentsSwitch.checked;
  keepSettings();
});
// Drifting icebergs (decision 0170): their own switch, like every hazard.
const bergsSwitch = $<HTMLInputElement>('bergs');
world.bergsOn = settings.bergs;
bergsSwitch.checked = settings.bergs;
bergsSwitch.addEventListener('change', () => {
  world.bergsOn = bergsSwitch.checked;
  settings.bergs = bergsSwitch.checked;
  keepSettings();
});
// Fog banks and ash clouds (decision 0169): one switch per haze the zone kinds name, made from
// the data so a new kind needs no code, placed after the Currents row.
const hazeOff = () => hazeSwitches().filter((id) => settings.haze[id] === false);
world.hazeOff = hazeOff();
{
  let after: Element | null = currentsSwitch.closest('.set-row');
  for (const id of hazeSwitches()) {
    const row = document.createElement('label');
    row.className = 'set-row';
    const name = document.createElement('span');
    name.className = 'set-name';
    const label = document.createElement('span');
    const note = document.createElement('small');
    for (const [el, key] of [
      [label, `settings.haze.${id}`],
      [note, `settings.haze.${id}Note`],
    ] as const) {
      el.dataset.i18n = key;
      el.textContent = hasText(key) ? t(key) : id;
    }
    name.append(label, note);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `haze-${id}`;
    input.className = 'switch';
    input.setAttribute('role', 'switch');
    input.checked = settings.haze[id] !== false;
    input.addEventListener('change', () => {
      settings.haze = { ...settings.haze, [id]: input.checked };
      world.hazeOff = hazeOff();
      keepSettings();
    });
    row.append(name, input);
    after?.after(row);
    after = row;
  }
}
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
    keepSettings();
  });
function applyLevelWind(level: Difficulty) {
  settings.steadyWind = knobs(level).steadyWind;
  syncWind();
  keepSettings();
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
  keepSettings();
});
storms.addEventListener('change', () => {
  settings.storms = storms.checked;
  syncWeather();
  keepSettings();
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
    keepSettings();
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
musicVolume.addEventListener('change', () => keepSettings());
// People's babble on their cards (decision 0132): a switch and a volume of their own.
const voices = $<HTMLInputElement>('voices');
const voiceVolume = $<HTMLInputElement>('voice-volume');
const voiceValue = $('voice-volume-value');
const applyVoices = () => {
  voiceValue.textContent = `${voiceVolume.value}%`;
  voiceVolume.disabled = !settings.voices;
  music.setVoiceVolume(settings.voices ? settings.voiceVolume : 0);
};
voices.checked = settings.voices;
voiceVolume.value = String(Math.round(settings.voiceVolume * 100));
applyVoices();
voices.addEventListener('change', () => {
  settings.voices = voices.checked;
  keepSettings();
  music.unlock();
  applyVoices();
});
voiceVolume.addEventListener('input', () => {
  settings.voiceVolume = Number(voiceVolume.value) / 100;
  music.unlock();
  applyVoices();
});
voiceVolume.addEventListener('change', () => keepSettings());
showFps.addEventListener('change', () => {
  settings.showFps = showFps.checked;
  keepSettings();
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
  chart.fogBlur = QUALITY[level].chartFogBlur;
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
      autosave();
      // "Not now" lasts one call: the offer comes back the next time you dock there.
      for (const key of questSeen) if (key.endsWith(':offer')) questSeen.delete(key);
      offersWait = false;
      // A step this dock finishes (Rook's "call at Saltmere") is thanked for, not asked again.
      quests.check();
      questNote.hide();
      openHarbour();
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
      const opened =
        (port && portNow(port, world.trade))?.levelProduces?.[String(e.level) as '2' | '3' | '4'] ??
        [];
      const specialty = opened.find(isSpecialty);
      // A far yard starts making its rare good (decision 0065), a main port its far good (0146).
      const rare = opened.find((g) => isRare(g) || isFar(g));
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
      view.setSettlementLevels(townLevels(world.map, world.trade));
      hud.portLabels.rebuild();
      if (tradePanel.isOpen) tradePanel.render();
      autosave();
    } else if (e.type === 'home-docked') {
      // Moored at one of your islands (decisions 0126, 0128): its spots show; a new one is said
      // out loud.
      const island = world.map.islands.find((i) => i.id === e.islandId)!;
      const name = island.name ?? island.id;
      const fresh = islandHome(world.trade.home, e.islandId).offered.length > 0;
      // The camera turns to the island, halfway between it and her, so both show.
      view.setFocus({
        x: (island.x * 2 + world.boat.x) / 3,
        y: (island.y * 2 + world.boat.y) / 3,
      });
      hud.showToast(t(fresh ? 'home.newSpot' : 'home.docked', { name }), fresh ? 4 : 2.5);
      autosave();
    } else if (e.type === 'home-undocked') {
      view.setFocus(null);
      homePanel.close();
      autosave();
    } else if (e.type === 'undocked') {
      const portName = trade.findPort(world.map, e.portId)?.name ?? e.portId;
      hud.showToast(t('toast.departed', { name: portName }), 1.5);
      // Thanks read on the Quay tab are said.
      for (const id of questThanks) if (questSeen.has(`${id}:done`)) questThanks.delete(id);
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

/**
 * Where to head when no course is set (decision 0139): the tracked quest's place, at sea only; a
 * running lesson is the tracked quest (decision 0151), so the wreck while a lesson is about it.
 */
function seaGoal(): { x: number; y: number; label: string } | null {
  if (world.trade.dockedAt) return null;
  return questGoal(quests, world.map, view.harbours);
}

/**
 * The tracked quest's step, whose `wind` and `sound` the sea plays (decision 0139): the same step
 * data for the tutorial (always tracked while it runs, decision 0151) and every quest.
 */
function seaStep(): { key: string; step: StepEffects; wind: StepWind | undefined } | null {
  const step = quests.trackedStep;
  // A quest's own breeze holds over its steps that have none (decision 0164).
  return step ? { key: `${quests.tracked}:${step.id}`, step, wind: quests.trackedWind } : null;
}

// --- Main loop: fixed-step simulation, render once per frame ----------------------------------
let accumulator = 0;
let last = performance.now();
let frame = 0;
let coachTick = 0;
/** The step whose sound plays, and the seconds until it sounds again. */
let soundKey: string | undefined;
let soundIn = 0;

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  // A few ms of slack so a 30 fps cap lands on every second 60 Hz refresh.
  if (frameCap && now - last < 1000 / frameCap - 4) return;
  const rawMs = now - last;
  const dt = Math.min(0.1, rawMs / 1000);
  last = now;

  readPad(now, dt);
  const sailDelta = input.takeSailDelta();
  const sailTarget = input.takeSailTarget();
  if (bench && !paused) driveBench(rawMs / 1000);
  if (!paused) {
    if (sailTarget !== null) sailStep = sailTarget;
    sailStep = clamp(sailStep + sailDelta, 0, SAIL_STEPS.length - 1);
    accumulator += dt;
    let steps = 0;
    while (!paused && accumulator >= SIM_STEP && steps < 6) {
      const controls = { steer: input.steer, sailStep };
      const sea = seaStep();
      world.calmWind = heldWind(sea?.wind, world.map);
      // No storms while a quest that holds them runs: the tutorial (decision 0072).
      holdStorms(world, 'quest', quests.holdsStorms);
      handleEvents(stepWorld(world, controls, SIM_STEP));
      if (quests.update(SIM_STEP, controls).length) showDueCard();
      // A step's sound (the prologue's foghorn) calls every few seconds, the first at once.
      if (sea?.key !== soundKey) {
        soundKey = sea?.key;
        soundIn = 0;
      }
      const sound = sea?.step.sound;
      if (sound && (soundIn -= SIM_STEP) <= 0) {
        music.effectNamed(sound.effect);
        const place = seaGoal();
        if (place) hud.stepSound(sound.effect, bearingTo(world.boat, place));
        soundIn = sound.everySec;
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
  const compass = quests.trackedStep?.compass;
  hud.mark = quests.compassOf(quests.trackedStep);
  // Rook waits on the wreck while a step points at it (decision 0127).
  view.castawayWaiting = compass === 'wreck';
  hud.goal = seaGoal();
  hud.update(dt, (x, y) => view.project(x, y), size, !paused, hudVisible);
  questNote.update(dt, mode === 'play' && !paused && hudVisible, (key) => questSeen.has(key));
  homePanel.update((x, y) => view.project(x, y));
  // Coach marks follow moving targets (port signs) about ten times a second.
  if (++coachTick % 6 === 0) coach.place();

  // The benchmark keeps one level throughout so its passes compare (decision 0154).
  if (monitor.sample(dt) && !benchMode && settings.quality === 'auto' && level !== 'low') {
    setLevel(lowerQuality(level));
  }
  hud.setFps(settings.showFps ? monitor.fps : null, hudVisible);
  if (perf) {
    const info = view.renderer.info.render;
    const canvas = view.renderer.domElement;
    perf.frame({
      ms: rawMs,
      counting: mode === 'play' && !paused && hudVisible,
      level,
      qualitySetting: settings.quality,
      drawCalls: info.calls,
      triangles: info.triangles,
      canvas: {
        width: canvas.width,
        height: canvas.height,
        pixelRatio: view.renderer.getPixelRatio(),
      },
    });
  }
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
      speak: (voice, mood) => {
        music.unlock();
        music.speak(voice, 5, mood);
      },
    }),
  );
}

/**
 * One benchmark frame (decision 0154): the boat is put on the route (the sim still runs the wind,
 * weather, towns and wake around it); each pass starts from the same game time at its own
 * drawing resolution.
 */
function driveBench(sec: number) {
  if (!bench) return;
  const step = bench.step(sec);
  const pass = bench.config.passes[step.pass]!;
  if (step.passStarted) {
    world.time = bench.config.startTime;
    view.renderScale = pass.scale;
    resize();
    perf?.startPass(pass.label);
  }
  if (step.done) {
    bench = null;
    perf?.finishBench();
    view.renderScale = perfScale;
    resize();
    sailStep = 0;
    world.boat.sailStep = 0;
    return;
  }
  const passes = bench.config.passes.length;
  perf?.setBenchLine(
    `Benchmark ${step.pass + 1}/${passes} · ${pass.label} · ${Math.ceil(step.left)} s left`,
  );
  world.boat.x = step.pose.x;
  world.boat.y = step.pose.y;
  world.boat.heading = step.pose.heading;
  world.boat.speedKn = bench.config.speedKn;
  world.boat.drift = { x: 0, y: 0 };
  world.destination = null;
  sailStep = SAIL_STEPS.length - 1;
}

/** `?bench`: a fresh captain's voyage, no tutorial, then the route (decision 0154). */
function startBench(created: Bench) {
  trade.startVoyage(world.trade, 'captain');
  markDifficulty();
  levelPicked = true;
  tutorialChoice.set('skipped');
  const [x, y] = created.config.route[0]!;
  world.boat = createBoat(x, y, 0);
  bench = created;
  play();
}

// The `?perf` readout (decision 0148) for device tests: its own chunk, like the tuning panel.
// `?bench` loads the benchmark with it and starts once both are in.
if (perfMode) {
  void Promise.all([import('./perf/perfReadout'), benchMode ? import('./perf/bench') : null]).then(
    ([{ PerfReadout }, benchModule]) => {
      const sea = phase4Sea
        ? 'Phase 4 sea'
        : stressTest
          ? 'stress test sea'
          : playtestMap
            ? 'edited map'
            : "today's sea";
      const created = benchModule
        ? new benchModule.Bench(benchModule.BENCHMARK, knotToUnits())
        : null;
      perf = new PerfReadout({
        version: __APP_VERSION__,
        sea: [
          sea,
          perfScale !== 1 ? `scale ${perfScale}` : '',
          frameCap ? `cap ${frameCap} fps` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        bench: created
          ? `(${created.config.passes.length} passes of ${Math.round(created.passSec)} s, ` +
            `${Math.round(created.route.length)} units at ${created.config.speedKn} kn, ` +
            `level ${level} fixed, all hazards on)`
          : undefined,
        switches: () =>
          [
            ...(
              ['weather', 'storms', 'dayNight', 'windZones', 'stormBelt', 'currents'] as const
            ).map((k) => `${k} ${settings[k] ? 'on' : 'off'}`),
            ...hazeSwitches().map((id) => `${id} ${settings.haze[id] !== false ? 'on' : 'off'}`),
          ].join(', '),
      });
      if (created) startBench(created);
    },
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
  /** Dock at a port as a player would, from the berth a quest test uses (`npm run shots`, 0153). */
  const dock = (portId: string) => {
    const berth = testBerth(world.map, world.trade, world.piers, portId, world.ship.id);
    if (!berth) return false;
    world.boat = createBoat(berth.x, berth.y, (berth.headingDeg * Math.PI) / 180);
    world.destination = null;
    sailStep = world.boat.sailStep;
    syncWorldLand(world, true);
    hud.onPortClick(portId);
    return world.trade.dockedAt === portId;
  };
  /**
   * Moor at one of her islands' piers, as a player would (`npm run shots -- --moor skerry`,
   * decision 0159): the boat waits stopped by the pier and moors on the next step.
   */
  const moor = (islandId: string) => {
    const berth = testBerth(world.map, world.trade, world.piers, islandId, world.ship.id);
    if (!berth) return false;
    world.boat = createBoat(berth.x, berth.y, (berth.headingDeg * Math.PI) / 180);
    world.boat.sailStep = sailStep = 0;
    world.boat.sail = SAIL_STEPS[0]!;
    world.destination = null;
    syncWorldLand(world, true);
    return true;
  };
  /**
   * A quest started at a step as a quest test starts it (`npm run shots -- --quest id:step`):
   * the quests before it done, and the props, marks and lights that stand after them shown.
   */
  const questAt = (questId: string, stepId: string) => {
    const started = quests.testStart(questId, stepId).length > 0;
    trade.syncMarketLevels(world.trade, world.map);
    refreshPiers(world);
    view.setQuestsDone(questsDone(world.trade));
    return started;
  };
  /** Put the boat at sea at a point, heading in degrees, sails at a step (0 furled … 2 full). */
  const place = (x: number, y: number, headingDeg: number, step = SAIL_STEPS.length - 1) => {
    world.boat = createBoat(x, y, (headingDeg * Math.PI) / 180);
    world.boat.sailStep = sailStep = clamp(Math.round(step), 0, SAIL_STEPS.length - 1);
    world.boat.sail = SAIL_STEPS[sailStep]!;
    world.destination = null;
    syncWorldLand(world, true);
  };
  /**
   * A town as the shots need it (`npm run shots -- --town palm-key:2`, decision 0157): an empty
   * island founded first, as the `found` reward does, then grown to the level.
   */
  const town = (portId: string, level: number) => {
    foundSite(world.trade, world.map, portId);
    const s = world.trade.settlements.byPort[portId];
    if (!s) return false;
    s.level = level;
    trade.syncMarketLevels(world.trade, world.map);
    refreshPiers(world);
    checkFounded();
    view.setSettlementLevels(townLevels(world.map, world.trade));
    return true;
  };
  /**
   * Free play as before decision 0160, for the tools (`npm run shots`, the performance run): the
   * prologue a skipped tutorial still plays is dropped and the boat goes back to the map's start.
   */
  const freePlay = () => {
    if (!quests.isRunning(TUTORIAL_QUEST)) return;
    quests.drop(TUTORIAL_QUEST);
    resetBoat(world);
    sailStep = world.boat.sailStep;
  };
  Object.assign(window, {
    fwt: {
      world,
      view,
      input,
      trade,
      tradePanel,
      homePanel,
      quests,
      coach,
      chart,
      newGame,
      dock,
      moor,
      place,
      questAt,
      town,
      freePlay,
    },
  });
}

// A quest played from one of its steps (decision 0142): last, once everything above is set up.
if (questTest) startQuestTest(questTest);
