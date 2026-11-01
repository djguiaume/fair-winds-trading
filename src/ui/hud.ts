import { TUNING } from '../data/tuning';
import { trueWindAngle } from '../sim/boat';
import { DIFFICULTIES } from '../sim/difficulty';
import { damageStage, hullCondition } from '../sim/hazards';
import { DEG, bearingTo, distance, wrapAngle } from '../sim/math';
import type { QuestBook } from '../sim/quests';
import { SHIP_CLASSES, noGoAngle, pointOfSail } from '../sim/ship';
import { capacity, cargoUsed, findPort } from '../sim/trade';
import { type World, type WorldEvent, navigationTarget } from '../sim/world';
import type { ScreenPoint } from '../render/view';
import { t } from '../i18n';
import { BoatLabels } from './boatLabels';
import type { HazardKind } from './hazardMarker';
import { PortLabels } from './portLabels';
import { SeaLines } from './seaLines';
import { Actions } from './hud/actions';
import { HeadingStrip, type StripClock } from './hud/headingStrip';
import { IdleFade } from './hud/idleFade';
import { Instrument } from './hud/instrument';
import { PressWarning } from './hud/pressWarning';
import { SeaToasts } from './hud/seaToasts';
import { Status, type StatusFrame, trackedQuestLine } from './hud/status';
import { applyHudTokens } from './hud/tokens';
import { WindCompass, type WindFrame } from './hud/windCompass';
import { EdgeArrow } from './hud/edgeArrow';
import { setHidden } from './hud/parts';
import './hud/hud.css';
import './hud/overlays.css';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
}

/** Seconds as a clock, "1:45". */
const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The sea HUD (issue #441, round 3 D): three clusters on the scene instead of nine plates. Top
 * left the status, top centre the heading strip, top right the wind compass; bottom right the
 * instrument and bottom left the actions. Text sits on the sea with a hard ink halo; only the
 * compass and the instrument have a faint ink backing. The quiet HUD keeps those two alone, and
 * the status and the strip fade back after a while without a change.
 */
export class Hud {
  private readonly root = $('hud');
  readonly status = new Status();
  readonly strip = new HeadingStrip(TUNING.hud.tapeSpanDeg);
  readonly compass = new WindCompass();
  readonly instrument = new Instrument();
  readonly actions = new Actions();
  readonly toasts: SeaToasts;
  readonly press: PressWarning;
  readonly portLabels: PortLabels;
  private readonly boatLabels: BoatLabels;
  private readonly seaLines: SeaLines;
  private readonly edge = new EdgeArrow($('wp-arrow'));
  private readonly tiller = $('tiller');
  private readonly fps = $('fps');
  private readonly hullBar = $('hull-bar');
  private readonly windHelp = $('wind-help') as HTMLDialogElement;
  private readonly statusFade = new IdleFade();
  private readonly stripFade = new IdleFade();
  private wokeHeading = 0;
  /** A timed run's line when no course is set ("Run to Saltmere"), kept between text ticks. */
  private runName = '';
  /** Reused each text tick, so the status costs no new objects. */
  private readonly frame: StatusFrame = {
    gold: 0,
    used: 0,
    capacity: 0,
    hull: 100,
    stage: 0,
    deck: 0,
    deckRoom: 0,
  };
  private readonly wind: WindFrame = { heading: 0, windFrom: 0, noGo: 0, course: null, mark: null };

  /** A place the compass marks the direction of: the prologue's wreck (decision 0127). */
  mark: { x: number; y: number } | null = null;
  /**
   * Where to head when no course is set (decision 0139): the wreck during the prologue, else the
   * tracked quest's place. The strip and the edge arrow show it like a course.
   */
  goal: { x: number; y: number; label: string } | null = null;
  /** A timed run under way (decision 0213): its clock shows in the strip. */
  run: { sec: number; par: number; to: string } | null = null;
  /** A race under way (decision 0217): its line and clock; the strip's × gives it up. */
  race: { label: string; short: string; sec: number | null } | null = null;
  /** The quests, for the tracked one's line under the status. */
  quests: QuestBook | null = null;
  onRetire: () => void = () => {};
  onQuestOpen: () => void = () => {};
  onDockClick: () => void = () => {};
  onSailStep: (step: number) => void = () => {};
  onPortClick: (portId: string) => void = () => {};
  onWindHelpChange: () => void = () => {};

  private sinceText = 1;
  private sinceQuest = Infinity;
  private wasVisible = false;
  private hintSeconds = 0;
  private seenWindHint: boolean;
  private returnFocus: HTMLElement | null = null;

  constructor(
    private readonly world: World,
    private readonly windPreferences: { seen: boolean; markSeen: () => void },
    harbours: Record<string, { x: number; y: number }> = {},
  ) {
    this.seenWindHint = windPreferences.seen;
    applyHudTokens(this.root);
    const { status, strip, compass, instrument, actions } = this;
    this.root.append(status.root, strip.root, compass.root, instrument.root, actions.root);
    this.toasts = new SeaToasts($('toast'), world);
    this.press = new PressWarning(world, $('press-glow'), (text, sec) => this.showToast(text, sec));
    this.seaLines = new SeaLines(compass.lines, (sog) => instrument.showSog(sog));
    this.portLabels = new PortLabels($('port-labels'), world, harbours);
    this.portLabels.onPortClick = (portId) => this.onPortClick(portId);
    this.boatLabels = new BoatLabels($('boat-labels'), world);
    instrument.onStep = (step) => this.onSailStep(step);
    strip.retire.addEventListener('click', () => this.onRetire());
    status.quest.addEventListener('click', () => this.onQuestOpen());
    actions.dock.addEventListener('click', () => this.onDockClick());
    actions.cargo.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.toggleHold(world.trade);
    });
    document.addEventListener('click', () => actions.closeHold());
    this.initWindHelp();
  }

  /** The dial and the chip open the sailing tips; closing gives the focus back. */
  private initWindHelp() {
    const { compass, windHelp } = this;
    const open = () => {
      this.returnFocus = document.activeElement as HTMLElement | null;
      this.dismissWindHint();
      windHelp.showModal();
      this.onWindHelpChange();
    };
    compass.trigger.addEventListener('click', open);
    compass.chip.addEventListener('click', open);
    compass.hintClose.addEventListener('click', () => {
      this.dismissWindHint();
      compass.trigger.focus({ preventScroll: true });
    });
    $('close-wind-help').addEventListener('click', () => windHelp.close());
    windHelp.addEventListener('close', () => {
      this.onWindHelpChange();
      // The delayed chip disappears while paused: fall back to the dial, which always stays.
      const back = this.returnFocus;
      (back?.isConnected && !back.hidden ? back : compass.trigger).focus({ preventScroll: true });
    });
  }

  private dismissWindHint() {
    this.hintSeconds = 0;
    this.compass.hint.hidden = true;
    if (!this.seenWindHint) {
      this.seenWindHint = true;
      this.windPreferences.markSeen();
    }
  }

  /** Settings › Quiet HUD: only the wind compass and the instrument stay at sea. */
  set quiet(on: boolean) {
    this.root.toggleAttribute('data-quiet', on);
  }

  /** Settings › Wind compass off: the dial goes, but only on the hardest level (Guillaume). */
  compassOff = false;

  set isKidMode(on: boolean) {
    this.compass.isKidMode = on;
  }

  /** Quest cargo aboard, a line each, for the hold list (decision 0213). */
  set questCargo(lines: () => string[]) {
    this.actions.questCargo = lines;
  }

  showToast(text: string, seconds = 2.5, hazard?: HazardKind) {
    this.toasts.show(text, seconds, hazard);
  }

  hideToast() {
    this.toasts.hide();
  }

  stepSound(effect: string, bearing: number) {
    this.toasts.stepSound(effect, bearing);
  }

  handleEvents(events: WorldEvent[]) {
    this.toasts.handle(events);
  }

  setTiller(drag: { x: number; y: number; steer: number } | null) {
    this.tiller.hidden = !drag;
    if (!drag) return;
    this.tiller.style.transform = `translate(${drag.x}px, ${drag.y}px)`;
    (this.tiller.firstElementChild as HTMLElement).style.transform =
      `translateX(${drag.steer * 60}px)`;
  }

  setFps(fps: number | null, visible = true) {
    if (!visible) return;
    this.fps.hidden = fps === null;
    if (fps !== null) this.fps.textContent = t('hud.fps', { n: fps.toFixed(0) });
  }

  /**
   * `project` maps sim positions to pixels; `size` is the viewport. `active` runs the sailing cues;
   * `visible` draws: a paused game keeps its instruments on screen.
   */
  update(
    dt: number,
    project: (x: number, y: number) => ScreenPoint,
    size: { w: number; h: number },
    active = true,
    visible = true,
  ) {
    const { world, compass } = this;
    const { boat, wind, ship } = world;
    this.toasts.tick(dt);
    compass.tick(dt, wind.speedKn);
    this.press.update(project, active, visible);
    const twa = trueWindAngle(boat.heading, wind);
    const sailing = boat.sailStep > 0 && boat.sail > 0.05;
    const docked = world.trade.dockedAt !== null;
    compass.cue.update(dt, Math.abs(twa) < noGoAngle(ship) && sailing && !docked && active);
    if (compass.cue.chip && !this.seenWindHint) {
      this.hintSeconds = 7;
      this.seenWindHint = true;
      this.windPreferences.markSeen();
    }
    this.hintSeconds = compass.cue.chip ? Math.max(0, this.hintSeconds - dt) : 0;
    const resumed = visible && !this.wasVisible;
    this.wasVisible = visible;
    if (!visible) return;
    if (resumed) {
      this.sinceText = 1;
      this.sinceQuest = Infinity;
    }

    const wp = navigationTarget(world) ?? this.goal;
    const f = this.wind;
    f.heading = boat.heading;
    f.windFrom = wind.from;
    f.noGo = noGoAngle(ship);
    f.course = wp ? bearingTo(boat, wp) : null;
    f.mark = this.mark ? bearingTo(boat, this.mark) : null;
    compass.update(f, this.hintSeconds > 0);
    this.strip.update(boat.heading, f.course);
    this.showCourse(wp);
    this.instrument.showPress(this.press.level);

    this.sinceText += dt;
    if (this.sinceText > 0.12) {
      this.showText(this.sinceText, wp, twa);
      this.sinceText = 0;
    }
    this.sinceQuest += dt;
    if (this.sinceQuest > 1 && this.quests) {
      this.sinceQuest = 0;
      this.status.showQuest(trackedQuestLine(this.quests, world.map));
    }
    this.placeOverlays(dt, project, size, wp, resumed);
  }

  /** The words and numbers, about eight times a second. */
  private showText(dt: number, wp: { x: number; y: number; label: string } | null, twa: number) {
    const { world, compass, instrument } = this;
    const { boat, ship, trade } = world;
    instrument.showText(boat.speedKn, boat.heading, boat.sailStep);
    const point = boat.sailStep === 0 ? null : pointOfSail(ship, twa);
    compass.showText(world, point, world.shelter > 0.25, dt);
    this.seaLines.show(world);
    this.showStrip(dt, wp);
    this.showStatus(dt);
    const hardest = trade.difficulty === DIFFICULTIES[DIFFICULTIES.length - 1];
    setHidden(compass.trigger, this.compassOff && hardest);
  }

  /** Every visible frame: the course's name, a race's line or a run's (decisions 0213, 0217). */
  private showCourse(wp: { label: string } | null) {
    const { race } = this;
    const phone = document.documentElement.dataset.layout === 'phone';
    this.strip.showName(
      (race && (phone ? race.short : race.label)) ?? wp?.label ?? this.runName,
      !!race,
    );
  }

  /** The distance, a race's or a run's clock, and the strip's idle fade. */
  private showStrip(dt: number, wp: { x: number; y: number; label: string } | null) {
    const { run, race, world } = this;
    const runTo = run && findPort(world.map, run.to)?.name;
    this.runName = runTo ? t('quest.run.clock', { to: runTo }) : '';
    let time: StripClock | null = null;
    if (race?.sec != null) time = { text: clock(race.sec), close: false };
    else if (run && !race)
      time = { text: `${clock(run.sec)} / ${clock(run.par)}`, close: run.par - run.sec < 20 };
    const dist = wp ? t('unit.metres', { n: Math.round(distance(world.boat, wp)) }) : '';
    this.strip.showDetail(dist, time);
    // A big turn wakes the strip as a new course does.
    if (Math.abs(wrapAngle(world.boat.heading - this.wokeHeading)) / DEG > TUNING.hud.wakeTurnDeg) {
      this.wokeHeading = world.boat.heading;
      this.stripFade.wake();
    }
    const shown = `${race?.label ?? wp?.label ?? this.runName}|${time ? 1 : 0}`;
    if (this.stripFade.update(dt, shown, TUNING.hud.idleFadeSec))
      this.strip.root.toggleAttribute('data-idle', this.stripFade.faded);
  }

  private showStatus(dt: number) {
    const { trade } = this.world;
    const s = this.frame;
    s.gold = trade.captain.gold;
    s.used = cargoUsed(trade);
    s.capacity = capacity(trade);
    const condition = hullCondition(trade);
    s.hull = Math.round(condition * 100);
    s.stage = damageStage(condition);
    s.deck = trade.quests.hold ?? 0;
    s.deckRoom = SHIP_CLASSES[trade.captain.activeShip]!.deck;
    this.status.show(s);
    const shown = `${s.gold}|${s.used}|${s.hull}|${s.deck}|${this.status.questText}`;
    if (this.statusFade.update(dt, shown, TUNING.hud.idleFadeSec))
      this.status.root.toggleAttribute('data-idle', this.statusFade.faded);
  }

  /** Things pinned to the scene: the hull bar, the port and boat signs, the edge arrow. */
  private placeOverlays(
    dt: number,
    project: (x: number, y: number) => ScreenPoint,
    size: { w: number; h: number },
    wp: { x: number; y: number } | null,
    resumed: boolean,
  ) {
    const { boat } = this.world;
    const hull = this.frame.hull;
    this.hullBar.hidden = hull >= 100;
    if (hull < 100) {
      this.hullBar.dataset.stage = String(this.frame.stage);
      (this.hullBar.firstElementChild as HTMLElement).style.width = `${hull}%`;
      const b = project(boat.x, boat.y);
      this.hullBar.style.transform = `translate(${b.x.toFixed(0)}px, ${(b.y - 52).toFixed(0)}px)`;
    }
    this.portLabels.update(project, dt, resumed);
    this.boatLabels.update(project);
    // One Trade button at a time: the pier sign's, or this one when the sign is off screen.
    const dockedAt = this.world.trade.dockedAt;
    if (dockedAt && !this.portLabels.dockShown(dockedAt))
      this.actions.showDock(findPort(this.world.map, dockedAt)?.name ?? dockedAt);
    else this.actions.showDock(null);
    this.edge.update(project, size, boat, wp);
  }
}
