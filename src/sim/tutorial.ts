import { goodName, t } from '../i18n';
import { GOODS, isGood, type GoodId } from './goods';
import { type BoatControls } from './boat';
import { type SaveStorage } from './save';
import { isDiscovered } from './shipyards';
import { findPort, cargoUsed } from './trade';
import { type World, holdStorms } from './world';

export const TUTORIAL_STEPS = [
  'chart',
  'choose-port',
  'sails',
  'wind',
  'dock',
  'buy',
  'choose-delivery',
  'deliver',
  'sell',
] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
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
  step: 'chart',
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
        if (this.isActive && TUTORIAL_STEPS.indexOf(p.step) >= 2 && !p.origin)
          this.progress.step = 'chart';
        if (this.isActive && ['deliver', 'sell'].includes(p.step) && (!p.delivery || !p.good))
          this.progress.step = 'choose-delivery';
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
    const id = ['sails', 'wind', 'dock', 'buy'].includes(this.step)
      ? this.origin
      : ['deliver', 'sell'].includes(this.step)
        ? this.delivery
        : null;
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
    if (this.isActive && this.step === 'chart') this.go('choose-port');
  }

  destinationSelected() {
    if (!this.isActive) return;
    const target = this.world.destination;
    if (!target || !findPort(this.world.map, target.portId)) {
      if (['sails', 'wind', 'dock'].includes(this.step)) this.go('choose-port');
      else if (['deliver', 'sell'].includes(this.step)) this.go('choose-delivery');
      return;
    }
    if (['chart', 'choose-port', 'sails', 'wind', 'dock'].includes(this.step)) {
      this.progress.origin = target.portId;
      this.ownedTarget = target;
      if (this.step === 'chart' || this.step === 'choose-port') this.go('sails');
      else this.publish();
    } else if (
      ['choose-delivery', 'deliver', 'sell'].includes(this.step) &&
      target.portId !== this.origin
    ) {
      this.progress.delivery = target.portId;
      this.ownedTarget = target;
      this.go('deliver');
      this.observe();
    }
  }
  /** Lightweight numeric checks at simulation frequency; DOM changes only on lesson transitions. */
  observe(controls?: BoatControls, dt = 0) {
    // No storms while the lesson runs (decision 0072).
    holdStorms(this.world, 'tutorial', this.isActive);
    if (!this.isActive) return;
    const { boat, trade } = this.world;
    if (this.step === 'choose-delivery' || this.step === 'deliver' || this.step === 'sell') {
      if (!this.good || trade.captain.cargo[this.good] === 0) {
        this.progress.good = GOODS.find((g) => trade.captain.cargo[g] > 0) ?? null;
        if (!this.good) {
          this.clearTarget();
          this.progress.delivery = null;
          this.go('choose-port');
          return;
        }
        this.publish();
      }
    }
    if (this.step === 'sails' && controls) {
      if (controls.sailStep === 0) this.lowered = true;
      if (this.lowered && controls.sailStep > 0) this.raised = true;
      if (Math.abs(controls.steer) > 0.15) this.steeringSeconds += dt;
      if (boat.speedKn > 0.7) this.movingSeconds += dt;
      if (this.lowered && this.raised && this.steeringSeconds >= 0.3 && this.movingSeconds >= 1)
        this.go('wind');
    }
    if (this.step === 'buy' && trade.dockedAt !== this.origin) this.go('dock');
    if (this.step === 'sell' && trade.dockedAt !== this.delivery) this.go('deliver');
    if (this.step === 'dock' && trade.dockedAt === this.origin) this.go('buy');
    if (this.step === 'deliver' && trade.dockedAt === this.delivery) this.go('sell');
  }
  continueLesson() {
    if (!this.isActive) return;
    if (this.step === 'sails') this.go('wind');
    else if (this.step === 'wind') {
      this.go('dock');
      this.observe();
    } else if (this.step === 'buy' && this.hasCargo) {
      this.progress.good = GOODS.find((g) => this.world.trade.captain.cargo[g] > 0)!;
      this.go('choose-delivery');
    }
  }
  /** The UI calls this only after a successful real buy/sell, never for upgrades or failed trades. */
  traded(kind: 'buy' | 'sell', good: GoodId | null) {
    if (!this.isActive) return;
    const dock = this.world.trade.dockedAt;
    if (this.step === 'buy' && kind === 'buy' && dock === this.origin && good) {
      this.progress.good = good;
      this.go('choose-delivery');
    } else if (
      this.step === 'sell' &&
      kind === 'sell' &&
      dock === this.delivery &&
      (good === null || good === this.good)
    ) {
      this.clearTarget();
      this.progress.status = 'completed';
      this.finishedNotice = true;
      this.publish();
    } else if (
      ['choose-delivery', 'deliver', 'sell'].includes(this.step) &&
      this.good &&
      this.world.trade.captain.cargo[this.good] === 0
    ) {
      // Cargo sold early: use another held good, or teach buying at the current harbour again.
      this.progress.good = GOODS.find((g) => this.world.trade.captain.cargo[g] > 0) ?? null;
      if (!this.good && dock) {
        this.progress.origin = dock;
        this.progress.delivery = null;
        this.go('buy');
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
    switch (this.step) {
      case 'chart':
      case 'choose-port': {
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
      case 'choose-delivery':
        return this.buyer?.id ?? null;
      case 'deliver':
      case 'sell':
        return this.delivery;
      default:
        return this.origin;
    }
  }
  /** The good whose Buy or Sell button the coach mark points at in the market. */
  get pointerGood(): GoodId | null {
    if (this.step === 'buy') return this.producedGood ?? null;
    if (this.step === 'sell') return this.good;
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
    const cargo = this.good ? goodName(this.good) : t('tutorial.yourCargo');
    const produced = this.producedGood;
    const buyer = this.buyer;
    const step = this.step;
    const params = { origin: origin ?? '', delivery: delivery ?? '', cargo };
    const text = (part: 'title' | 'copy', extra: Record<string, string> = {}) =>
      t(`lesson.${step}.${part}`, { ...params, ...extra });
    switch (step) {
      case 'chart':
      case 'choose-port':
        return { title: text('title'), copy: text('copy'), action: 'chart', continueText: null };
      case 'sails':
        return {
          title: text('title'),
          copy: text('copy'),
          action: null,
          continueText: t('lesson.sails.continue'),
        };
      case 'wind':
        return {
          title: text('title'),
          copy: text('copy'),
          action: 'tips',
          continueText: t('lesson.wind.continue'),
        };
      case 'dock':
      case 'deliver':
        return { title: text('title'), copy: text('copy'), action: 'chart', continueText: null };
      case 'buy':
        return {
          title: text('title'),
          copy: text('copy', {
            good: produced ? goodName(produced) : t('tutorial.producedGood'),
          }),
          action: 'market',
          continueText: this.hasCargo ? t('lesson.buy.continue') : null,
        };
      case 'choose-delivery':
        return {
          title: text('title'),
          copy: text('copy', {
            buyer: buyer ? t('lesson.choose-delivery.buyer', { name: buyer.name, cargo }) : '',
          }),
          action: 'chart',
          continueText: null,
        };
      case 'sell':
        return { title: text('title'), copy: text('copy'), action: 'market', continueText: null };
    }
  }
}
