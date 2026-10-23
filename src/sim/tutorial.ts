import { goodSome, goodThe, t } from '../i18n';
import firstVoyage from '../data/quests/first-voyage.json';
import { GOODS, isGood, type GoodId } from './goods';
import { type BoatControls } from './boat';
import { type SaveStorage } from './save';
import { isDiscovered } from './shipyards';
import { findPort, cargoUsed } from './trade';
import { type World, holdStorms } from './world';

/*
 * The first-voyage tutorial (decisions 0025, 0061) as data (decision 0113): it is the first quest,
 * `src/data/quests/first-voyage.json`, and its lessons, in order, are the quest's steps. A step says which harbour it is about, which port a
 * pick on the chart sets, where the coach mark points, and, in `on`, which step each event leads
 * to. The events are the small library below, watched by this class; a new kind of event (say,
 * "reefed in a gale") needs code once, a new lesson or a new order of lessons does not. Step text
 * is `<text>.<id>.title`, `.copy` and, with a Continue button, `.continue` (`lesson.chart.title`).
 * The same format is meant for later quests (Guillaume, 2026-10-23); this class runs this one.
 */

/** The two harbours a lesson can be about: where the cargo is bought, and where it is sold. */
export type LessonPort = 'origin' | 'delivery';

/**
 * What finishes or rewinds a step. Each is a real action of the player, never one made for them:
 * - `chart-opened`: the chart was opened;
 * - `port-picked`: a harbour was picked on the chart (it becomes the step's `picks` port);
 * - `destination-cleared`: the course was cleared;
 * - `sails-practised`: sails lowered and raised again, a touch of steering and a little way on;
 * - `continue`: the lesson's Continue button (shown per `continue`);
 * - `docked` / `left-port`: alongside the step's `port`, or no longer;
 * - `bought` / `sold`: a real trade at the step's `port` (`sold`: the lesson's cargo);
 * - `cargo-gone`: at sea with none of the lesson's goods left aboard;
 * - `cargo-sold`: the lesson's goods sold early in a harbour, which becomes the new `origin`.
 */
export const TUTORIAL_EVENTS = [
  'chart-opened',
  'port-picked',
  'destination-cleared',
  'sails-practised',
  'continue',
  'docked',
  'left-port',
  'bought',
  'sold',
  'cargo-gone',
  'cargo-sold',
] as const;
export type TutorialEvent = (typeof TUTORIAL_EVENTS)[number];

/** Where a coach mark can point (decision 0061), by surface; `src/ui/tutorial.ts` has the selectors. */
export type CoachTarget =
  | 'chart-button'
  | 'sail-lever'
  | 'wind-compass'
  | 'port-marker'
  | 'dock-button'
  | 'chart-port'
  | 'close-chart'
  | 'buy-button'
  | 'sell-button';

export interface TutorialStepDef {
  id: string;
  /** The button the lesson card offers: open the chart, the market, or the sailing tips. */
  action?: 'chart' | 'market' | 'tips';
  /** The harbour the step sails to or trades at: the course on resume, `docked` and `left-port`. */
  port?: LessonPort;
  /** Which lesson port a harbour picked on the chart sets during this step. */
  picks?: LessonPort;
  /** The step follows the cargo aboard (`cargo-gone`, `cargo-sold`). */
  cargo?: boolean;
  /** When the lesson shows a Continue button: always, or once there is cargo aboard. */
  continue?: 'always' | 'with-cargo';
  /** The harbour the coach mark points at on the chart; default the step's `port`, else `origin`. */
  pointer?: 'nearest-port' | 'buyer' | LessonPort;
  /** The good whose market button the coach mark points at: the origin's own, or the cargo. */
  pointerGood?: 'produced' | 'cargo';
  /** The element the coach mark points at on each surface. */
  coach: { sea?: CoachTarget; chart?: CoachTarget; market?: CoachTarget };
  /** The step each event leads to; `done` finishes the tutorial. */
  on: Partial<Record<TutorialEvent, string>>;
}

/** A quest file: its steps, when it starts and what finishing it pays. */
export interface QuestDef {
  /** Stored nowhere yet; the tutorial's progress keeps its own storage key. */
  id: string;
  /** English name, for editors and lists. */
  name: string;
  /** When it starts: `offered` is offered on a fresh voyage and from the menu (the tutorial). */
  start: 'offered';
  /** Prefix of the step text keys. */
  text: string;
  /** Paid once, when a step leads to `done`. */
  reward: { gold: number };
  steps: TutorialStepDef[];
}

/** The tutorial: the first quest. */
export const TUTORIAL_QUEST = firstVoyage as QuestDef;
export const TUTORIAL: readonly TutorialStepDef[] = TUTORIAL_QUEST.steps;
export const TUTORIAL_STEPS: readonly string[] = TUTORIAL.map((s) => s.id);
export type TutorialStep = string;
/** The `on` target that finishes the tutorial. */
export const TUTORIAL_DONE = 'done';

const stepDef = (id: string): TutorialStepDef => TUTORIAL.find((s) => s.id === id) ?? TUTORIAL[0]!;
/** The first step that sets a lesson port from the chart: where a lesson missing it restarts. */
const picking = (port: LessonPort) => TUTORIAL.find((s) => s.picks === port)!.id;
/** From the first step that sails to the origin on, a lesson needs to know the origin. */
const NEEDS_ORIGIN = TUTORIAL.findIndex((s) => s.port === 'origin');

type Status = 'unseen' | 'active' | 'skipped' | 'completed';
interface Progress {
  status: Status;
  step: TutorialStep;
  origin: string | null;
  delivery: string | null;
  good: GoodId | null;
}
const fresh = (): Progress => ({
  status: 'unseen',
  step: TUTORIAL_STEPS[0]!,
  origin: null,
  delivery: null,
  good: null,
});

/** Observes real actions. Never moves the boat, changes wind, grants cargo or trades for the player. */
export class Tutorial {
  private progress = fresh();
  private ownedTarget: World['destination'] = null;
  private lowered = false;
  private raised = false;
  private steeringSeconds = 0;
  private movingSeconds = 0;
  finishedNotice = false;
  onChange: () => void = () => {};
  readonly key: string;

  constructor(
    private readonly world: World,
    private readonly harbours: Record<string, { x: number; y: number }>,
    private readonly storage: SaveStorage | null,
    resumedVoyage = true,
  ) {
    this.key = `fwt.tutorial.v1.${world.map.name}`;
    try {
      const p = JSON.parse(storage?.getItem(this.key) ?? 'null') as Progress | null;
      const port = (id: unknown) =>
        id === null || (typeof id === 'string' && Boolean(findPort(world.map, id)));
      if (
        p &&
        ['unseen', 'active', 'skipped', 'completed'].includes(p.status) &&
        TUTORIAL_STEPS.includes(p.step) &&
        port(p.origin) &&
        port(p.delivery) &&
        (p.good === null || isGood(p.good))
      ) {
        this.progress = p;
        // Incomplete/corrupt context restarts the lesson, never the voyage.
        if (this.isActive && TUTORIAL_STEPS.indexOf(p.step) >= NEEDS_ORIGIN && !p.origin)
          this.progress.step = picking('origin');
        if (this.isActive && this.def.port === 'delivery' && (!p.delivery || !p.good))
          this.progress.step = picking('delivery');
      }
    } catch {
      /* Private storage, old or malformed tutorial state: no impact on the voyage. */
    }
    // An unfinished lesson belongs to its voyage; completed/skipped choices are remembered.
    if (!resumedVoyage && this.isActive) this.progress = fresh();
  }
  get status() {
    return this.progress.status;
  }
  get step() {
    return this.progress.step;
  }
  /** The current step's entry in the quest file. */
  get def(): TutorialStepDef {
    return stepDef(this.step);
  }
  get isActive() {
    return this.status === 'active';
  }
  get good() {
    return this.progress.good;
  }
  get origin() {
    return this.progress.origin;
  }
  get delivery() {
    return this.progress.delivery;
  }
  shouldOffer(resumedVoyage: boolean) {
    return !resumedVoyage && this.status === 'unseen';
  }
  get hasCargo() {
    return cargoUsed(this.world.trade) > 0;
  }

  private publish() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.progress));
    } catch {
      /* optional */
    }
    this.onChange();
  }
  private go(step: TutorialStep) {
    this.progress.step = step;
    this.publish();
  }
  /** The step the current one's `event` leads to, if any. */
  private next(event: TutorialEvent): string | undefined {
    return this.def.on[event];
  }
  private portOf(role: LessonPort | undefined): string | null {
    return role === 'delivery' ? this.delivery : role === 'origin' ? this.origin : null;
  }
  private firstCargo(): GoodId | null {
    return GOODS.find((g) => this.world.trade.captain.cargo[g] > 0) ?? null;
  }
  private clearTarget() {
    if (this.ownedTarget && this.world.destination === this.ownedTarget)
      this.world.destination = null;
    this.ownedTarget = null;
  }
  start() {
    this.clearTarget();
    this.progress = { ...fresh(), status: 'active' };
    this.lowered = this.raised = false;
    this.steeringSeconds = this.movingSeconds = 0;
    this.finishedNotice = false;
    this.publish();
  }
  /** Called only when entering play, not during construction or on the title screen. */
  resume() {
    if (!this.isActive || this.world.destination) return;
    const id = this.portOf(this.def.port);
    const port = id ? findPort(this.world.map, id) : null;
    const anchor = id ? this.harbours[id] : null;
    if (port && anchor) {
      this.ownedTarget = { portId: port.id, label: port.name, ...anchor };
      this.world.destination = this.ownedTarget;
    }
    this.observe();
  }
  skip() {
    this.clearTarget();
    this.progress.status = 'skipped';
    this.finishedNotice = false;
    this.publish();
  }
  dismissFinished() {
    this.finishedNotice = false;
    this.onChange();
  }
  chartOpened() {
    const next = this.isActive ? this.next('chart-opened') : undefined;
    if (next) this.go(next);
  }

  destinationSelected() {
    if (!this.isActive) return;
    const target = this.world.destination;
    if (!target || !findPort(this.world.map, target.portId)) {
      const next = this.next('destination-cleared');
      if (next) this.go(next);
      return;
    }
    const { picks } = this.def;
    const next = this.next('port-picked');
    if (picks === 'origin') {
      this.progress.origin = target.portId;
      this.ownedTarget = target;
      if (next) this.go(next);
      else this.publish();
    } else if (picks === 'delivery' && target.portId !== this.origin) {
      this.progress.delivery = target.portId;
      this.ownedTarget = target;
      this.go(next ?? this.step);
      this.observe();
    }
  }
  /** Lightweight numeric checks at simulation frequency; DOM changes only on lesson transitions. */
  observe(controls?: BoatControls, dt = 0) {
    // No storms while the lesson runs (decision 0072).
    holdStorms(this.world, 'tutorial', this.isActive);
    if (!this.isActive) return;
    const { boat, trade } = this.world;
    if (this.def.cargo) {
      if (!this.good || trade.captain.cargo[this.good] === 0) {
        this.progress.good = this.firstCargo();
        if (!this.good) {
          this.clearTarget();
          this.progress.delivery = null;
          this.go(this.next('cargo-gone') ?? picking('origin'));
          return;
        }
        this.publish();
      }
    }
    const { on, port } = this.def;
    if (on['sails-practised'] && controls) {
      if (controls.sailStep === 0) this.lowered = true;
      if (this.lowered && controls.sailStep > 0) this.raised = true;
      if (Math.abs(controls.steer) > 0.15) this.steeringSeconds += dt;
      if (boat.speedKn > 0.7) this.movingSeconds += dt;
      if (this.lowered && this.raised && this.steeringSeconds >= 0.3 && this.movingSeconds >= 1)
        this.go(on['sails-practised']);
    } else if (on['left-port'] && trade.dockedAt !== this.portOf(port)) this.go(on['left-port']);
    else if (on.docked && trade.dockedAt === this.portOf(port)) this.go(on.docked);
  }
  /** The lesson's Continue button, when `continue` shows it. */
  get canContinue(): boolean {
    const when = this.def.continue;
    return when === 'always' || (when === 'with-cargo' && this.hasCargo);
  }
  continueLesson() {
    const next = this.isActive && this.canContinue ? this.next('continue') : undefined;
    if (!next) return;
    const to = stepDef(next);
    if (to.cargo) this.progress.good = this.firstCargo();
    this.go(next);
    // A step that watches the harbour may be done already (alongside when it starts).
    if (to.on.docked || to.on['left-port']) this.observe();
  }
  /** The UI calls this only after a successful real buy/sell, never for upgrades or failed trades. */
  traded(kind: 'buy' | 'sell', good: GoodId | null) {
    if (!this.isActive) return;
    const dock = this.world.trade.dockedAt;
    const here = dock === this.portOf(this.def.port);
    const bought = kind === 'buy' ? this.next('bought') : undefined;
    const sold = kind === 'sell' ? this.next('sold') : undefined;
    if (bought && here && good) {
      this.progress.good = good;
      this.go(bought);
    } else if (sold && here && (good === null || good === this.good)) {
      if (sold === TUTORIAL_DONE) {
        this.clearTarget();
        this.world.trade.captain.gold += TUTORIAL_QUEST.reward.gold;
        this.progress.status = 'completed';
        this.finishedNotice = true;
        this.publish();
      } else this.go(sold);
    } else if (this.def.cargo && this.good && this.world.trade.captain.cargo[this.good] === 0) {
      // Cargo sold early: use another held good, or teach buying at the current harbour again.
      this.progress.good = this.firstCargo();
      const next = this.next('cargo-sold');
      if (!this.good && dock && next) {
        this.progress.origin = dock;
        this.progress.delivery = null;
        this.go(next);
      } else this.publish();
    }
  }

  /** What the first harbour makes: the cheap good the buy lesson suggests. */
  private get producedGood(): GoodId | undefined {
    return this.world.map.ports.find((p) => p.id === this.origin)?.produces[0];
  }
  /** A charted port that wants the cargo aboard, for the delivery lesson. */
  private get buyer() {
    return this.world.map.ports.find(
      (p) =>
        p.id !== this.origin &&
        this.good &&
        p.wants.includes(this.good) &&
        isDiscovered(this.world.trade, p.id),
    );
  }
  /** The harbour the coach mark points at on the chart (decision 0061). */
  get pointerPort(): string | null {
    const pointer = this.def.pointer ?? this.def.port ?? 'origin';
    if (pointer === 'nearest-port') {
      // The nearest charted harbour: the easiest first trip.
      const { boat, map, trade } = this.world;
      let best: string | null = null;
      let bestDistance = Infinity;
      for (const port of map.ports) {
        if (!isDiscovered(trade, port.id)) continue;
        const at = this.harbours[port.id] ?? map.islands.find((i) => i.id === port.islandId);
        if (!at) continue;
        const distance = Math.hypot(at.x - boat.x, at.y - boat.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = port.id;
        }
      }
      return best;
    }
    if (pointer === 'buyer') return this.buyer?.id ?? null;
    return this.portOf(pointer);
  }
  /** The good whose Buy or Sell button the coach mark points at in the market. */
  get pointerGood(): GoodId | null {
    const pointer = this.def.pointerGood;
    if (pointer === 'produced') return this.producedGood ?? null;
    if (pointer === 'cargo') return this.good;
    return null;
  }

  get lesson(): {
    title: string;
    copy: string;
    action: 'chart' | 'market' | 'tips' | null;
    continueText: string | null;
  } {
    const origin = this.origin
      ? findPort(this.world.map, this.origin)?.name
      : t('tutorial.yourPort');
    const delivery = this.delivery
      ? findPort(this.world.map, this.delivery)?.name
      : t('tutorial.anotherPort');
    const cargo = this.good ? goodThe(this.good) : t('tutorial.yourCargo');
    const produced = this.producedGood;
    const buyer = this.buyer;
    const { id, action } = this.def;
    // Every lesson text can use these: {origin}, {delivery}, {cargo}, {good} (what the origin
    // makes) and {buyer} (a sentence naming a port that wants the cargo, or nothing).
    const params = {
      origin: origin ?? '',
      delivery: delivery ?? '',
      cargo,
      good: produced ? goodSome(produced) : t('tutorial.producedGood'),
      buyer: buyer ? t('lesson.choose-delivery.buyer', { name: buyer.name, cargo }) : '',
    };
    const key = (part: string) => `${TUTORIAL_QUEST.text}.${id}.${part}` as Parameters<typeof t>[0];
    return {
      title: t(key('title'), params),
      copy: t(key('copy'), params),
      action: action ?? null,
      continueText: this.canContinue ? t(key('continue')) : null,
    };
  }
}
