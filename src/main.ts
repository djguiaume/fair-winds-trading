import { maxHull } from './sim/hazards';
import { renderDifficultyButtons, renderLevelCards } from './ui/levelCards';
import { GAME_MAP, PHASE1_MAP, PHASE1_SOURCE, RING_PREFIX, prepareMap } from './data/maps';
import { STRESS_PREFIX, stressMap } from './data/stressMap';
import { PHASE4_PREFIX } from './data/grownMap';
import { TUNING } from './data/tuning';
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
import { GamepadPoller, PAD, chartPad, padInUse, seaPad, type PadContext } from './input/gamepad';
import { PadFocus, type PadScreen } from './ui/padFocus';
import { Input } from './input/input';
import {
  FrameMonitor,
  QUALITY,
  type QualityLevel,
  forceAntialias,
  guessQuality,
  lowerQuality,
} from './render/quality';
import { GameView } from './render/view';
import { SAIL_STEPS, createBoat, knotToUnits } from './sim/boat';
import { isFar, isGood, isRare, isSpecialty } from './sim/goods';
import { portNow, questsDone } from './sim/settlement';
import { foundSite, foundedSites, townLevels } from './sim/founding';
import { bearingTo, clamp } from './sim/math';
import { type SaveStorage, clearSave, loadGame, saveGame, serializeWorld } from './sim/save';
import { LINK_KEY, encodeSaveCode } from './sim/saveTransfer';
import { SLOOP, noGoAngle } from './sim/ship';
import * as trade from './sim/trade';
import { type Difficulty, isDifficulty, knobs } from './sim/difficulty';
import { daylightAt } from './sim/daylight';
import { hazeSwitches } from './sim/windZones';
import { type QuestEvent, QuestBook, roundStep, useEditedQuests } from './sim/quests';
import { questTestFrom, sailableHeading, testBerth } from './sim/questTest';
import { QuestTestBar } from './ui/questTestBar';
import { type StepEffects, type StepWind, syncSea } from './sim/stepEffects';
import { QuestCard } from './ui/questCard';
import { QuestNote } from './ui/questNote';
import {
  cardFor,
  cargoLines,
  dueCard,
  journal,
  newsLine,
  parClock,
  type QuayItem,
  quayItems,
  questGoal,
  questPins,
  lessonFor,
  plotParams,
  plotQuest,
  questTarget,
  trackedMarkers,
} from './ui/questView';
import { gateMid } from './sim/regatta';
import {
  flownPennant,
  raceBookCards,
  raceHud,
  raceResultCard,
  starterLine,
} from './ui/regattaView';
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
import { CameraControls } from './ui/cameraControls';
import { loadSettings, saveSettings } from './ui/settings';
import { addEffectSwitches, addQualityButtons } from './ui/graphicsSettings';
import { wireViewSwitches } from './ui/viewSwitches';
import { wireSeaSwitches } from './ui/seaSwitches';
import type { Bench } from './perf/bench';
import type { PerfReadout } from './perf/perfReadout';
import { perfOptions } from './perf/perfOptions';
import { Music } from './audio/music';
import { SeaListener } from './audio/listener';
import { wordCount } from './audio/babble';
import { SeaChart, questCourse } from './ui/seaChart';
import {
  LANGUAGES,
  browserLanguages,
  detectLanguage,
  language,
  goodName,
  workshopName,
  formatNumber,
  goodSome,
  setLanguage,
  setTextVariant,
  t,
  tOptional,
  townLevelName,
  translateDom,
  useTextEdits,
} from './i18n';
import { TradePanel } from './ui/tradePanel';
import { boatLooksIn } from './ui/boatLooks/host';
import { HomePanel, buildingName, effectLine } from './ui/homePanel';
import {
  PLOT_CAMERA,
  giveHomeIsland,
  homeLooks,
  homeSpots,
  islandHome,
  offerHomeSpot,
  spotPosition,
} from './sim/home';
import { character, firstName } from './ui/portraits';
import { TransferPanel } from './ui/transferPanel';
import { startTvMode } from './input/tv';
import { PadLog } from './ui/padLog';
import { usePadBrand } from './ui/padGlyphs';
import { askConfirm } from './ui/confirmDialog';
import { WayOfPlaying, firstWay } from './input/wayOfPlaying';

declare const __APP_VERSION__: string;
declare const __BUILD_REVISION__: string;
const appVersion = document.getElementById('app-version');
if (appVersion) appVersion.textContent = `v${__APP_VERSION__}`;
const release = document.getElementById('build-revision');
if (release) release.textContent = __BUILD_REVISION__;

// A console's browser on a TV (decision 0183): hand the pad to the game, keep clear of the
// screen's edges, keep Back in the game. Before any screen is built.
const tvMode = startTvMode();
// The first guess at the way of playing, before any input, for texts that name controls (0184).
const firstGuess = firstWay((q) => typeof matchMedia === 'function' && matchMedia(q).matches);
setTextVariant(firstGuess);

const SIM_STEP = 1 / 60;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');

// Language: the player's choice, else the browser's, else English (decision 0037).
const settings = loadSettings(location.search);
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
// The game sails the grown sea: the Windward Ring in the middle, the four seas round it (decision
// 0198). "Play this map" from the map editor (decision 0095) sails its own map, save and tutorial
// progress; so do the bigger-map test sea (decision 0115), `?map=stress`, and the ring alone
// (`?map=ring`, how the game was before 0198). `?map=phase4` still opens the voyage sailed there
// while the grown sea was a dev sea (decision 0152), on the game's own sea.
const mapParam = new URLSearchParams(location.search).get('map');
// The sea editor's grown sea (decision 0161): `?map=edited&sea=phase4`.
const editedPhase4 = mapParam === 'edited' && editedSea(location.search);
const phase4Voyage = mapParam === 'phase4';
const stressTest = mapParam === 'stress';
const ringAlone = mapParam === 'ring';
const devSea = stressTest || ringAlone;
const playtestMap =
  editedMap(location.search, browserStorage) ??
  (ringAlone ? PHASE1_MAP : stressTest ? prepareMap(stressMap(PHASE1_SOURCE)) : null);
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
    : (playtestMap || phase4Voyage) && browserStorage
      ? prefixedStorage(
          browserStorage,
          phase4Voyage
            ? PHASE4_PREFIX
            : stressTest
              ? STRESS_PREFIX
              : ringAlone
                ? RING_PREFIX
                : editedPhase4
                  ? EDITED_SEA_PREFIX
                  : EDITED_PREFIX,
        )
      : browserStorage;
const storage =
  tuneMode && voyageStorage ? prefixedStorage(voyageStorage, TUNE_PREFIX) : voyageStorage;
const world = createWorld(playtestMap ?? GAME_MAP, SLOOP);
if (playtestMap) {
  document.title = `${stressTest ? 'Stress test' : ringAlone ? 'Ring alone' : questTest ? 'Quest test' : editedPhase4 ? 'Edited Phase 4 sea' : 'Edited map'} · ${document.title}`;
  const badge = document.createElement('a');
  badge.href = editedPhase4 ? './editor.html?sea=phase4' : './editor.html?sea=ring';
  badge.textContent = stressTest
    ? 'Stress test sea'
    : ringAlone
      ? 'The Windward Ring alone (test)'
      : editedPhase4
        ? 'Edited Phase 4 sea · back to editor'
        : 'Edited map · back to editor';
  badge.style.cssText =
    'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:50;padding:3px 10px;' +
    'border-radius:10px;background:#123246e6;color:#f3d37e;font:600 12px sans-serif;' +
    'text-decoration:none;';
  // A label only: the stress sea and the ring alone have no editor page to go back to.
  if (devSea) {
    badge.removeAttribute('href');
    badge.style.pointerEvents = 'none';
  }
  // The quest test bar says it all (and links back) instead.
  if (!questTest) document.body.append(badge);
}
const resumedVoyage = storage ? loadGame(storage, world) : false;
let level: QualityLevel = settings.quality === 'auto' ? guessQuality() : settings.quality;
const { perfMode, perfScale, frameCap, tilt, antialias } = perfOptions(location.search, benchMode);
if (antialias) forceAntialias();
const view = new GameView(canvas, world, level);
// The sea's sound where she sails, and the effects of what happens (decision 0209).
const seaListener = new SeaListener(
  music,
  (x, y) => view.volcanoSounds(x, y),
  () => world.hazeOff.includes('ash'),
);
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
tradePanel.harbourPicture = (portId) => view.harbourPicture?.(portId) ?? null;
// The home island (decision 0126). Rook's thanks gives it (decision 0127); `?home` gives it to the
// voyage being played and offers every arc spot, to try the build spots.
if (new URLSearchParams(location.search).has('home')) {
  giveHomeIsland(world.trade, world.map);
  for (const spot of homeSpots(world.map)) offerHomeSpot(world.trade, world.map, spot.id);
}
const homePanel = new HomePanel($('home-ui'), world);
/** The captain's islands as they stand: buildings, staked plots, the chosen plot's ring (0210). */
function showHome() {
  view.setHomeBuildings(homeLooks(world.trade.home, world.map, homePanel.chosen));
}
showHome();
// What stands only before or after a quest (decision 0130).
view.setQuestsDone(questsDone(world.trade));
homePanel.onChange = () => refreshPause();
homePanel.giverOf = (island, spot) => {
  const quest = plotQuest(quests.quests, world.map, island, spot);
  const giver = quest?.giver ? character(quest.giver) : undefined;
  const port = quest?.port ? trade.findPort(world.map, quest.port)?.name : undefined;
  // First names, as people say them: "Maren's plot".
  return giver ? { name: firstName(giver.name), port: port ?? '' } : undefined;
};
/** The camera's zoom before a plot was chosen, given back after. */
let zoomBeforePlot: number | null = null;
/** Moored at her island: the camera halfway between it and her, so both show. */
function homeFocus(islandId: string) {
  const island = world.map.islands.find((i) => i.id === islandId)!;
  view.setFocus({ x: (island.x * 2 + world.boat.x) / 3, y: (island.y * 2 + world.boat.y) / 3 });
}
// A plot chosen on the Island tab (decision 0210): the camera turns to it beside the half
// screen, closer in, and its ring shows; let go, the island again.
homePanel.onChosen = (islandId, spotId) => {
  const island = world.map.islands.find((i) => i.id === islandId);
  const spot = spotId ? homeSpots(world.map, islandId).find((s) => s.id === spotId) : undefined;
  if (island && spot) {
    zoomBeforePlot ??= view.getZoom();
    view.setZoom(PLOT_CAMERA.zoom);
    const wide = innerWidth > innerHeight && innerWidth >= 700;
    view.setFocus(
      spotPosition(island, spot),
      false,
      wide ? { x: -PLOT_CAMERA.side, y: 0 } : { x: 0, y: -PLOT_CAMERA.top },
    );
  } else {
    if (zoomBeforePlot !== null) view.setZoom(zoomBeforePlot);
    zoomBeforePlot = null;
    if (world.trade.home.docked) homeFocus(world.trade.home.docked);
  }
  showHome();
};
homePanel.onBuilt = (building) => {
  showHome();
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
// The regatta pennant won flies at her masthead (decision 0217).
view.setPennant(flownPennant(quests));
boatLooksIn($('trade-panel'), { world, quests, settings, autosave }, () => level);
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
  // for the next visit after it (decisions 0130, 0151). A lesson step someone speaks (Rook at the
  // rescue) is their card, with the coach or without (decision 0185).
  const lesson = quests.lesson;
  if (lesson) {
    const { quest, step } = lesson;
    if (!step.speaker || questSeen.has(`${quest.id}:${step.id}`)) return null;
    return { quest: quest.id, kind: step.choose ? ('choice' as const) : ('step' as const) };
  }
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
  if (!due || !card) return showStopCard();
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
/**
 * A quest under way with news at this stop (decision 0213, Guillaume's pick): its card greets the
 * captain before the harbour screen, like a main quest's, with what just happened on top (cargo
 * loaded or left on the quay, unloaded, handed over, a step done and paid, a run to start). One
 * card per quest, in turn; offers still wait on the Quay tab (0141).
 */
function showStopCard(): boolean {
  const docked = world.trade.dockedAt;
  if (!docked || quests.lesson) return false;
  const item = quayNow().find((p) => p.fresh && p.card.kind !== 'offer');
  if (!item) return false;
  questSeen.add(item.key);
  if (item.newsKey) questSeen.add(item.newsKey);
  if (item.card.kind === 'finished') questThanks.delete(item.card.quest);
  input.releaseAll();
  questCard.show(item.card, trade.findPort(world.map, docked)?.name);
  music.speak(item.card.giver?.voice, wordCount(item.card.news ?? item.card.ask), item.card.mood);
  refreshPause();
  return true;
}
/**
 * Moored at her island with a plot given and not built (decision 0210): its giver waits by the
 * stake, once a session, and their card goes on to the Island tab on that plot.
 */
function showPlotCard(islandId: string): boolean {
  if (bench || questCard.isOpen) return false;
  const spots = homeSpots(world.map, islandId);
  for (const spot of islandHome(world.trade.home, islandId).offered) {
    const quest = plotQuest(quests.quests, world.map, islandId, spot);
    if (!quest || questSeen.has(`${quest.id}:plot`)) continue;
    const card = cardFor(quests, world.map, quest.id, 'finished');
    const speech = tOptional(`${quest.text}.plot.copy`, plotParams(world.map, quest));
    if (!card || !speech) continue;
    questSeen.add(`${quest.id}:plot`);
    const n = spots.findIndex((s) => s.id === spot) + 1;
    Object.assign(card, {
      kind: 'step',
      speech,
      ask: t('home.plotCard.title'),
      where: t('home.plotCard.where', { n, name: firstName(card.giver?.name ?? '') }),
      reward: undefined,
      plot: { island: islandId, spot },
    });
    input.releaseAll();
    const island = world.map.islands.find((i) => i.id === islandId);
    questCard.show(card, island?.name ?? islandId);
    music.speak(card.giver?.voice, wordCount(card.speech), card.mood);
    refreshPause();
    return true;
  }
  return false;
}
/** Docked: the arrival card if a main quest has one, else straight to the harbour screen. */
function openHarbour() {
  // A card already up (Rook's thanks, shown as the dock moved his lesson on) opens the harbour
  // screen itself when it closes (decision 0190).
  if (!questCard.isOpen && !showDueCard()) tradePanel.open('market');
  refreshPause();
}
/**
 * News at a spot at sea (decision 0213): quest cargo loaded at a mooring with no harbour (Ines's
 * mast) or left there for want of room, as a note with the person's face, once per line.
 */
function seaNews() {
  if (world.trade.dockedAt || quests.lesson) return;
  for (const news of quests.news()) {
    const card = cardFor(quests, world.map, news.quest, 'step');
    if (!card) continue;
    card.news = newsLine(quests, world.map, news);
    const key = `news:${news.quest}:${news.step}@sea:${card.news}`;
    if (questSeen.has(key)) continue;
    questSeen.add(key);
    questNote.push(key, card);
  }
}
/** A timed run's clock in the course pill (decision 0213): the time against par. */
function showRunClock() {
  const run = world.trade.dockedAt ? undefined : quests.runs()[0];
  hud.run = run ? { sec: run.sec, par: run.par, to: run.to } : null;
  // A race's line and clock (decision 0217).
  hud.race = world.trade.dockedAt ? null : raceHud(quests);
}
/** Steps done during this call, quest → gold paid (decision 0213): "Done! +150 gold". */
const paidHere = new Map<string, number>();
/** The people of this harbour on the Quay tab, with their dock news (decisions 0141, 0213). */
function quayNow(): QuayItem[] {
  if (quests.lesson) return [];
  const docked = world.trade.dockedAt;
  return [
    ...quayItems(quests, world.map, docked, questSeen, questThanks, paidHere),
    // The regatta book: races sailed from here, to sail again (decision 0217). Never news.
    ...raceBookCards(quests, world.map, docked).map((card) => ({
      key: `${card.quest}:book`,
      card,
      fresh: false,
    })),
  ];
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
  if (e.type === 'paid') {
    // Said on the next card of the Quay while alongside; at sea the note says it (decision 0213).
    if (world.trade.dockedAt) paidHere.set(e.quest, (paidHere.get(e.quest) ?? 0) + e.gold);
    return;
  }
  if (e.type === 'run') {
    // A timed run under way, over par or made (decision 0213): a line at once, the clock at sea.
    const words = {
      to: trade.findPort(world.map, e.to)?.name ?? e.to,
      from: trade.findPort(world.map, e.from)?.name ?? e.from,
      par: parClock(e.par),
      time: parClock(e.sec),
    };
    hud.showToast(t(`quest.run.${e.state}`, words), e.state === 'made' ? 5 : 4);
    return;
  }
  if (e.type === 'erupt') {
    // A story eruption (decision 0178): seen once the boat is in sight of the volcano.
    view.erupt(e.island);
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
  if (quest?.race) {
    raceEvent(e);
    return;
  }
  if (quest?.lesson) {
    // Asked again, a lesson's people cards speak again (decision 0185).
    if (e.type === 'started')
      for (const key of questSeen) if (key.startsWith(`${e.quest}:`)) questSeen.delete(key);
    // A lesson speaks in its own bubble, and its last one says it is done (decision 0151).
    // Without its coach (the tutorial skipped, decision 0160) it ends without a word.
    if (e.type === 'finished' && quests.isCoached(e.quest)) {
      coach.finished = e.quest;
      if (e.quest === TUTORIAL_QUEST) tutorialChoice.set('completed');
    }
    coach.render();
    refreshMenuTutorial();
    // A lesson step someone speaks shows their card at once, wherever the step came from (0185).
    if ((e.type === 'step' || e.type === 'choice') && quests.lesson?.step.speaker) showDueCard();
    return;
  }
  // While a lesson runs, its bubble speaks for Rook's thanks (decision 0127).
  if (e.type === 'finished' && !quests.lesson) questThanks.add(e.quest);
  if (e.type === 'finished') {
    view.setQuestsDone(questsDone(world.trade));
    view.setPennant(flownPennant(quests));
    // A plot given is staked on her island at once (decision 0210).
    showHome();
  }
  if (quest?.main || quests.lesson) return;
  if (e.type === 'step' || e.type === 'choice' || e.type === 'finished') {
    const step = quests.progress(e.quest)?.step;
    const kind = e.type === 'finished' ? 'finished' : e.type;
    const card = step && cardFor(quests, world.map, e.quest, kind);
    if (card) questNote.push(`${e.quest}:${step}`, card);
  }
};
/**
 * A race's events (decision 0217): the starter's line at the start, the horn, the result card
 * at once wherever she finishes, a give-up; no thanks card or note, the result card says it all.
 */
function raceEvent(e: QuestEvent) {
  const quest = quests.quests.find((q) => q.id === e.quest)!;
  if (e.type === 'started') {
    const line = starterLine(quest);
    if (line) hud.showToast(line, 6);
  } else if (e.type === 'horn') {
    music.effectNamed('race-horn');
    hud.showToast(t('regatta.hornToast'), 3);
  } else if (e.type === 'retired') hud.showToast(t('regatta.retired'), 4);
  else if (e.type === 'raced') {
    // The committee boat's horn as she crosses the line: a horn, never a gun (no weapons in
    // the game, the storyteller's rule for the regatta, decision 0217).
    music.effectNamed('finish-horn');
    view.setPennant(flownPennant(quests));
    const card = raceResultCard(quests, world.map, e);
    if (card && !bench) {
      input.releaseAll();
      hud.hideToast();
      questCard.show(card);
      music.speak(card.giver?.voice, wordCount(card.speech), card.mood);
      refreshPause();
    }
  } else if (e.type === 'finished') {
    view.setQuestsDone(questsDone(world.trade));
    view.setPennant(flownPennant(quests));
    // The Cup on her pier once it is won (decision 0217).
    showHome();
  }
  if (e.type !== 'horn') autosave();
}
/** "Race again", on the result card or the regatta book (decision 0217). */
function raceAgain(id: string) {
  if (!quests.raceAgain(id).length) return;
  if (tradePanel.isOpen) tradePanel.close();
}
questCard.onAgain = raceAgain;
hud.onRetire = () => {
  const race = quests.race();
  if (race) quests.retire(race.quest.id);
};
/** The captain's yes to an offer, on a card or on the Quay tab. */
function acceptQuest(id: string) {
  const quest = quests.quests.find((q) => q.id === id);
  // A standing order's new ask is news again, its thanks too (decision 0214).
  if (quest?.repeat)
    for (const key of questSeen) if (key.startsWith(`${id}:`)) questSeen.delete(key);
  // The offer already said what the first step asks.
  const first = quest && roundStep(quest, quests.progress(id));
  if (first) questSeen.add(`${id}:${first.id}`);
  quests.accept(id);
  autosave();
}
questCard.onAccept = acceptQuest;
questCard.onIgnore = (id) => {
  if (quests.ignore(id)) autosave();
};
/**
 * Goods handed straight to a quest's person (decision 0213): paid as a sale here, then the quest
 * counts them like any goods leaving the hold alongside.
 */
function handOverGoods(id: string, good: string, n: number) {
  if (!isGood(good)) return;
  const res = trade.handOver(world.trade, good, n, world.map);
  if (!res.ok) return;
  const who = cardFor(quests, world.map, id, 'step')?.giver?.name ?? '';
  hud.showToast(t('quest.handedToast', { who: firstName(who), gold: formatNumber(res.gold) }), 3);
  world.ship = trade.activeShip(world.trade);
  quests.check();
  coach.render();
  autosave();
}
questCard.onHandOver = handOverGoods;
// Quest cargo in the hold lists, at sea and in harbour (decision 0213).
hud.questCargo = tradePanel.questCargo = chart.questCargo = () => cargoLines(quests);
tradePanel.quay = {
  items: quayNow,
  seen: (fresh) => {
    for (const { key, newsKey } of fresh) {
      questSeen.add(key);
      if (newsKey) questSeen.add(newsKey);
    }
    // The first new face on the Quay speaks as their card shows, like a main quest's card (0197).
    const { card } = fresh[0]!;
    music.speak(card.giver?.voice, wordCount(card.ask ?? card.speech), card.mood);
  },
  act: (id, act, option) => {
    if (act === 'accept') acceptQuest(id);
    else if (act === 'later') questSeen.add(`${id}:offer`);
    else if (act === 'ignore') {
      if (quests.ignore(id)) autosave();
    } else if (act === 'choose' && option) {
      quests.choose(id, option);
      autosave();
    } else if (act === 'again') raceAgain(id);
  },
  // The Quay shows the news inline as it renders again.
  hand: handOverGoods,
};
questCard.onChoose = (id, option) => {
  quests.choose(id, option);
  autosave();
};
questCard.onClose = (card) => {
  // A lesson's people card closed without its answer (Esc, To the market): the lesson goes on as
  // if answered, since nothing else would show that step again (decision 0185). Its next card,
  // if any, is then due below.
  const lesson = quests.lesson;
  if (
    lesson?.quest.id === card.quest &&
    lesson.step.speaker &&
    questSeen.has(`${card.quest}:${lesson.step.id}`)
  ) {
    const first = quests.options(card.quest)[0];
    if (first) {
      quests.choose(card.quest, first.id);
      autosave();
    }
  }
  // A plot's card at her island goes on to the Island tab on that plot (decision 0210).
  if (card.plot) {
    if (world.trade.home.docked === card.plot.island) homePanel.open(card.plot.spot);
    refreshPause();
    return;
  }
  // After the arrival card (or "To the market"), the harbour screen.
  if (!showDueCard() && world.trade.dockedAt && !tradePanel.isOpen) tradePanel.open('market');
  refreshPause();
};
// The tracked step's places at sea: gates, spots, landings (decision 0130), the prologue's wreck
// too while a lesson is about it (decisions 0139, 0151).
view.stepMarkers = () => trackedMarkers(quests);
view.questMarks = () => quests.runningMarks;
chart.questMarks = () => quests.runningMarks;
chart.raceCourse = () => {
  const race = quests.race();
  if (!race) return null;
  const { start, marks, finish } = race.course;
  return [gateMid(start), ...marks, gateMid(finish)];
};
chart.quests = {
  markers: () => trackedMarkers(quests)?.points ?? [],
  pins: () => questPins(quests, world.map, questSeen),
  target: () => questTarget(quests, world.map),
  goal: () => questGoal(quests, world.map, view.harbours),
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
hud.portLabels.isKidMode = hud.isKidMode = settings.uiMode === 'kids';
tradePanel.onUiModeChange = (mode) => {
  settings.uiMode = mode;
  hud.portLabels.isKidMode = hud.isKidMode = mode === 'kids';
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

hud.onPortClick = async (portId: string) => {
  // Mid-race (decision 0217) the captain is asked first: docking gives the race up.
  const race = world.dockHeld ? quests.race() : null;
  if (race && trade.canDock(world.trade, world.map, world.boat, portId)) {
    const yes = await askConfirm({
      title: t('regatta.leaveTitle'),
      text: t('regatta.leaveText'),
      ok: t('regatta.leaveOk'),
    });
    if (!yes) return;
    quests.retire(race.quest.id);
  }
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
  // The tutorial seen on an earlier voyage (New game in Settings) is not offered again, but the
  // fresh voyage still starts with the prologue's story, without the coach (decisions 0160, 0185).
  if (tutorialChoice.status !== 'unseen') startUncoachedPrologue();
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
  if (!startUncoachedPrologue()) quests.drop(TUTORIAL_QUEST);
  tutorialChoice.set('skipped');
  coach.render();
  refreshMenuTutorial();
}
/**
 * A fresh voyage's prologue without the coach (decision 0160): alone at sea at the map's
 * prologue start, sails down. False on a voyage under way or a map without a prologue.
 */
function startUncoachedPrologue(): boolean {
  if (
    resumedVoyage ||
    world.time >= 60 ||
    quests.progress(TUTORIAL_QUEST) ||
    quests.isDone(TUTORIAL_QUEST) ||
    !startAtPrologue(world)
  )
    return false;
  sailStep = world.boat.sailStep;
  quests.ask(TUTORIAL_QUEST);
  quests.coachOff(TUTORIAL_QUEST);
  coach.render();
  refreshMenuTutorial();
  return true;
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
  } else if (homePanel.isOpen) homePanel.back();
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
  showHome();
  view.setQuestsDone(questsDone(world.trade));
  view.setPennant(flownPennant(quests));
  // Land that stands after the quests before this step rises (or sinks) before she is placed.
  syncWorldLand(world, true);
  const berth = test.port
    ? testBerth(world.map, world.trade, world.piers, test.port, world.ship.id, world.land)
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
hud.onSailStep = (step) => input.setSail(step);

/*
 * Game controller (decision 0162): one poller, read once a frame in `tick` and only after a pad
 * has been seen. At sea and on the chart the buttons do what `src/data/controls.json` says; the
 * rest (menus, the harbour, cards) goes to `pad.onMenuPress`.
 */
// On a TV the arrows and Enter are the pad's too (Edge's pointer mode, decision 0199).
// `?padlog`: what the controller really sends, on screen, for a photo from the Xbox (0201).
const padLog = new URLSearchParams(location.search).has('padlog') ? new PadLog() : null;
const pad = new GamepadPoller(undefined, undefined, undefined, tvMode);
if (padLog) pad.onPress((p) => padLog.press(p.button, p.repeat));
// The pad's own button names on glyphs and in texts: A on Xbox, ✕ on PlayStation (decision 0186).
usePadBrand(pad.brand);
// Buttons are read between frames too, so a quick tap is never missed (decision 0183).
if (PAD.sampleEveryMs) setInterval(() => pad.sample(performance.now()), PAD.sampleEveryMs);
pad.onBrand = (brand) => {
  usePadBrand(brand);
  coach.render();
};
pad.onConnect = (connected) => {
  document.body.classList.toggle('has-gamepad', connected);
  if (connected) hud.showToast(t('toast.padConnected'), 3);
};
/** Where pad presses go: the boat, the open chart, or a menu, dialog or card on top. */
function padContext(): PadContext {
  // The chart's map tab plays the cross; its pages (journal, prices, legend) are menus (0196).
  if (chart.isOpen && !questCard.isOpen && !tutorialOffer.open && !windHelp.open)
    return chart.currentTab === 'map' ? 'chart' : 'menu';
  return paused ? 'menu' : 'sea';
}
function readPad(now: number, dt: number) {
  const frame = pad.poll(now);
  // A screen that opens while the pad is in use gets its focus even in a frame the pad sends
  // nothing (decision 0199): on a TV the pad is "in use" before the browser shows it.
  if (!frame) return padFocus.frame(null, now);
  const context = padContext();
  // Every frame: the stick over a menu, and a screen just opened or closed (by A or B) gets its
  // focus or loses its hints. Nothing is on top at sea or on the bare chart.
  padFocus.frame(frame, now);
  if (context === 'sea') {
    const sea = seaPad(frame, dt);
    input.setPadSteer(sea.steer);
    if (sea.sail) input.pressSail(sea.sail);
    if (sea.strike) input.setSail(0);
    camera.pad(sea);
    // A presses the tutorial bubble's main button first, Y skips its lesson (decision 0183).
    if (sea.harbour && coach.padPress('main')) {
      /* the bubble took it */
    } else if (sea.skipLesson && coach.padPress('skip')) {
      /* the lesson stops */
    } else if (sea.harbour && world.trade.dockedAt) openHarbour();
    else if (sea.chart) chart.open();
    else if (sea.pause) showMenu();
    if (padInUse(frame)) input.onActivity();
    for (const p of sea.other) pad.onMenuPress(p, context);
  } else if (context === 'chart') {
    const c = chartPad(frame, dt);
    chart.padMove(c.panX, c.panY);
    if (c.zoom !== 1) chart.zoomBy(c.zoom);
    if (c.fit) chart.fit();
    if (c.close) chart.back();
    // Y skips the lesson (0183).
    // A: the port or pin under the cross, else the lesson bubble's button, else her own mark there
    // (decision 0212).
    if (c.pick && !chart.pickAtCross(PAD.chart.pickReachPx) && !coach.padPress('main'))
      chart.markAtCross();
    if (c.skipLesson) coach.padPress('skip');
    if (c.nextGood) chart.nextGood();
    if (c.tab) chart.stepTab(c.tab);
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
  // The chart's pages take the focus like the port screen's tabs; the map tab has the cross.
  if (chart.isOpen)
    return chart.currentTab === 'map' ? null : { root: $('chart'), back: () => chart.back() };
  const screen = (root: HTMLElement | null) => (root ? { root, back: goBack } : null);
  if (tradePanel.isOpen) return screen($('trade-panel'));
  if (homePanel.isOpen) return screen($('home-ui').querySelector<HTMLElement>('.home-screen'));
  if (!settingsPanel.hidden) return screen(settingsPanel);
  if (transfer.isOpen) return screen($('transfer'));
  if (!help.hidden) return screen(help);
  if (!newVoyage.hidden) return screen(newVoyage);
  if (!menu.hidden) return screen(menu);
  return null;
}
const padFocus = new PadFocus(padScreen, document.getElementById('pad-hints'));
pad.onMenuPress = (p, context) => padFocus.press(p, context);
// The port screen redraws on each tab and sale: the hints pill follows what it shows (0192).
const portRendered = tradePanel.onRender;
tradePanel.onRender = () => {
  portRendered();
  padFocus.refreshHints();
};
// Texts that name controls follow the way of playing: touch, keys or pad (decision 0184).
const way = new WayOfPlaying(window, firstGuess);
way.onChange = (w) => {
  setTextVariant(w);
  coach.render();
};
pad.onUsingPad((using) => {
  padFocus.setUsing(using);
  way.setPad(using);
  // The chart's map tab plays the cross: no ring left on its close button (decision 0196).
  if (using && chart.isOpen && chart.currentTab === 'map') chart.setTab('map');
});
// On a TV the pad is the only input from the start: the focus ring and pad texts are up at once.
if (pad.usingPad) {
  padFocus.setUsing(true, false);
  way.setPad(true);
}
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

const camera = new CameraControls(view, input, settings, keepSettings, tilt);

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
// Eruptions (decision 0178) and wake styles (issue #418): what the sea shows, each switchable.
wireViewSwitches(view, settings, keepSettings);
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
// The sea's hazards each have a switch (currents, waves, bergs, other ships, haze).
wireSeaSwitches(world, settings, keepSettings);
world.traffic.cap = TUNING.seamanship.traffic.atOnce[level];
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
const qualityButtons = addQualityButtons($('quality'));
const showFps = $<HTMLInputElement>('show-fps');
const qualityNow = $('quality-now');
const markQuality = () => {
  for (const b of qualityButtons)
    b.setAttribute('aria-checked', String(b.dataset.quality === settings.quality));
};
markQuality();
showFps.checked = settings.showFps;
// Waves (decision 0250) and graphics effects (0221): a switch each, under the level that draws it.
const qualityRow = $('quality').closest('.set-row')!;
const showEffects = addEffectSwitches(qualityRow, settings, view, keepSettings);
const describeQuality = () => {
  qualityNow.textContent = t('settings.nowUsing', { level: t(`settings.${level}`) });
  showEffects(level);
};
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
// Effects and the sea's bed (decision 0209): their own volume.
const soundVolume = $<HTMLInputElement>('sound-volume');
const soundValue = $('sound-volume-value');
soundVolume.value = String(Math.round(settings.soundVolume * 100));
soundValue.textContent = `${soundVolume.value}%`;
music.setSoundVolume(settings.soundVolume);
soundVolume.addEventListener('input', () => {
  soundValue.textContent = `${soundVolume.value}%`;
  settings.soundVolume = Number(soundVolume.value) / 100;
  music.unlock();
  music.setSoundVolume(settings.soundVolume);
});
soundVolume.addEventListener('change', () => keepSettings());
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
resetSaveBtn?.addEventListener('click', async () => {
  // The game's own question: the browser's box leaves fullscreen on Xbox (decision 0183).
  const yes = await askConfirm({
    title: t('settings.newGame'),
    text: t('settings.confirmNewGame'),
    ok: t('settings.newGame'),
  });
  if (yes) {
    leaving = true;
    if (storage) clearSave(storage);
    window.location.reload();
  }
});

function setLevel(next: QualityLevel) {
  if (next === level) return;
  level = next;
  view.setQuality(level);
  world.traffic.cap = TUNING.seamanship.traffic.atOnce[level];
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
  seaListener.hear(events);
  for (const e of events) {
    if (e.type === 'crash' || e.type === 'reef-strike') {
      // She shows the knock (decision 0208): a splash and planks afloat; the sea listener plays
      // the thud, louder the harder she hit (decision 0209).
      view.impact();
    }
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
      // Moored at one of your islands (decisions 0126, 0128, 0210): the camera turns to the
      // island, and its harbour screen opens, after the card of whoever staked a plot there.
      homeFocus(e.islandId);
      if (!showPlotCard(e.islandId)) homePanel.open();
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
      paidHere.clear();
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
 * A course set for the quest's place follows it to the step's next place, and ends with the quest
 * or when another quest is tracked away to nowhere (decision 0212).
 */
function followQuestCourse() {
  const course = world.destination;
  if (course?.kind !== 'quest') return;
  const goal = questGoal(quests, world.map, view.harbours);
  if (goal) world.destination = questCourse(goal);
  else world.destination = null;
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
      syncSea(world, sea?.wind, quests.race());
      // No storms while a quest that holds them runs: the tutorial (decision 0072).
      holdStorms(world, 'quest', quests.holdsStorms);
      // A pier touched mid-race is a bump, not the harbour (decision 0217): retire with × first.
      world.dockHeld = quests.race()?.state === 'sequence' || quests.race()?.state === 'racing';
      handleEvents(stepWorld(world, controls, SIM_STEP));
      if (quests.update(SIM_STEP, controls).length) showDueCard();
      // A step's sound (the prologue's foghorn) calls every few seconds, the first at once.
      if (sea?.key !== soundKey) {
        soundKey = sea?.key;
        soundIn = 0;
      }
      // A step's music holds over the sea's while it runs, and the regatta's theme while a race is
      // under way (decision 0209).
      music.holdTrack(sea?.step.music ?? (quests.race() ? 'regatta' : null));
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
  if (!paused) seaListener.update(world, dt);
  // Pause menus and translucent sheets leave sea instruments visible. Only the title's
  // CSS rule and the opaque, full-screen chart cover the entire HUD.
  const hudVisible = !(mode === 'menu' && !started) && !chart.isOpen;
  const compass = quests.trackedStep?.compass;
  hud.mark = quests.compassOf(quests.trackedStep);
  // Rook waits on the wreck while a step points at it (decision 0127).
  view.castawayWaiting = compass === 'wreck';
  hud.goal = seaGoal();
  followQuestCourse();
  hud.update(dt, (x, y) => view.project(x, y), size, !paused, hudVisible);
  camera.update();
  if (coachTick % 15 === 0) seaNews();
  showRunClock();
  questNote.update(dt, mode === 'play' && !paused && hudVisible, (key) => questSeen.has(key));
  homePanel.update();
  // Coach marks follow moving targets (port signs) about ten times a second.
  if (++coachTick % 6 === 0) coach.place();

  // The benchmark keeps one level throughout so its passes compare (decision 0154).
  if (monitor.sample(dt) && !benchMode && settings.quality === 'auto')
    setLevel(lowerQuality(level));
  hud.setFps(settings.showFps ? monitor.fps : null, hudVisible);
  perf?.frame({
    ms: rawMs,
    counting: mode === 'play' && !paused && hudVisible,
    level,
    qualitySetting: settings.quality,
    renderer: view.renderer,
  });
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
      const sea = stressTest
        ? 'stress test sea'
        : ringAlone
          ? 'ring alone'
          : playtestMap
            ? 'edited map'
            : 'grown sea';
      const created = benchModule
        ? new benchModule.Bench(benchModule.BENCHMARK, knotToUnits())
        : null;
      perf = new PerfReadout({
        version: __APP_VERSION__,
        sea: [
          sea,
          perfScale !== 1 ? `scale ${perfScale}` : '',
          frameCap ? `cap ${frameCap} fps` : '',
          antialias ? 'antialias forced on' : '',
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
            `waves ${view.wavesOn ? 'on' : 'off'}`,
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
    const berth = testBerth(world.map, world.trade, world.piers, portId, world.ship.id, world.land);
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
    const berth = testBerth(
      world.map,
      world.trade,
      world.piers,
      islandId,
      world.ship.id,
      world.land,
    );
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
    view.setPennant(flownPennant(quests));
    showHome();
    // Land that stands after these quests rises now, while the boat is still at her start: moored
    // there next, the land would wait for her to sail out of sight (0166, Phase 4 review).
    syncWorldLand(world, true);
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
  /** Her hull at `percent` condition, as after so many knocks (`npm run shots -- --hull`, 0208). */
  const hull = (percent: number) => {
    const { captain } = world.trade;
    captain.hullDamage[captain.activeShip] = maxHull(world.trade) * (1 - percent / 100);
  };
  /** A crash's splash and planks at her bow, without the damage (`--crash`, decision 0208). */
  const impact = () => view.impact();
  Object.assign(window, {
    fwt: {
      world,
      view,
      input,
      trade,
      tradePanel,
      homePanel,
      showHome,
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
      music,
      hull,
      impact,
      /** The voyage as a save code, as Move your voyage sends it (`npm run shots -- --save-link`). */
      saveCode: () => encodeSaveCode(serializeWorld(world), world.map),
    },
  });
}

// A quest played from one of its steps (decision 0142): last, once everything above is set up.
if (questTest) startQuestTest(questTest);
