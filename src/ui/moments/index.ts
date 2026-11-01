import './moments.css';
import type { UiEvent } from '../../audio/catalog';
import { TUNING } from '../../data/tuning';
import { t } from '../../i18n';
import { isDiscovered } from '../../sim/shipyards';
import { cargoUsed, capacity } from '../../sim/trade';
import type { World } from '../../sim/world';
import { Toaster } from '../components';
import { connectUiSounds } from '../uiSound';
import { motionMode } from '../motionMode';
import { ArrivalWatch, arrivalSpots, taglineOf } from './arrival';
import { MomentBanner } from './banner';
import { TradeTicks } from './tradeTicks';

/** How often the sea is checked for a port in sight or a horn coming, seconds. */
const EVERY = 0.25;

export interface MomentsHost {
  world: World;
  /** Plays the sound of an interface event. */
  play(event: UiEvent): void;
  /** Seconds to the race's horn while the countdown runs, else null. */
  raceLeft(): number | null;
}

/**
 * The game's moments (decision 0274): what answers an event with something to see and hear. The
 * arrival banner, the race's countdown, the trade ticks and the toasts live here; the quest stamp
 * and the finish board are drawn on the cards (`stamp.ts`, `raceBoard.ts`). Everything is a timer
 * or a CSS animation, the sea is looked at four times a second, and nothing allocates then.
 */
export class Moments {
  /** The arrival banner, also the race's give-up line. */
  readonly banner = new MomentBanner('arrival');
  /** The race's "Horn in 10". */
  readonly horn = new MomentBanner('horn');
  readonly toaster = new Toaster();
  readonly trade: TradeTicks;
  private readonly watch: ArrivalWatch;
  private since = EVERY;
  private counting = false;

  constructor(private readonly host: MomentsHost) {
    const { world } = host;
    connectUiSounds(host.play);
    this.watch = new ArrivalWatch(arrivalSpots(world.map), TUNING.ui);
    this.trade = new TradeTicks(
      () => ({
        gold: world.trade.captain.gold,
        used: cargoUsed(world.trade),
        cap: capacity(world.trade),
      }),
      host.play,
      TUNING.ui.tradeRollMs,
    );
    const layer = document.createElement('div');
    layer.className = 'moments';
    layer.append(this.banner.root, this.horn.root);
    document.body.append(layer, this.toaster.root);
  }

  /** Each frame at sea; `covered`: a screen is over the sea, so nothing is announced. */
  update(dt: number, covered: boolean) {
    this.since += Math.max(0, dt);
    if (this.since < EVERY) return;
    this.since = 0;
    this.countdown(covered);
    // A port entered under a screen is announced when the sea is back, not lost.
    if (covered || motionMode() === 'off') return;
    const { boat, trade } = this.host.world;
    const id = this.watch.step(boat.x, boat.y, trade.dockedAt, (port) => isDiscovered(trade, port));
    if (id) this.announce(id);
  }

  private announce(id: string) {
    const port = this.host.world.map.ports.find((p) => p.id === id);
    if (!port) return;
    this.banner.show(port.name, taglineOf(id), TUNING.ui.arrivalMs);
    this.host.play('arrival');
  }

  private countdown(covered: boolean) {
    const left = this.host.raceLeft();
    const on = left !== null && !covered && left <= TUNING.ui.countdownFrom;
    if (on) this.horn.show(t('regatta.horn', { n: Math.ceil(left) }), undefined, 0);
    else if (this.counting) this.horn.hide();
    this.counting = on;
  }
}
