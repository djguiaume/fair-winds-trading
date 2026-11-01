import type { UiEvent } from '../../audio/catalog';
import { formatNumber } from '../../i18n';
import { type FrameClock, NumberRolls, playEnter } from '../motion';

/** What a sale or a purchase changes on the harbour screen's two chips. */
export interface TradeSnapshot {
  gold: number;
  used: number;
  cap: number;
}

/**
 * Trade ticks (decision 0274): after a buy or a sale the gold rolls to its new value, the hold
 * fills (or empties) the same way, the chips tick, and a coin sounds. The screen redraws after
 * each deal, so `traded` marks it and `settle` (called after the redraw) puts the old numbers
 * back and rolls them to the new ones.
 */
export class TradeTicks {
  private last: TradeSnapshot | null = null;
  private dealt = false;
  private readonly rolls: NumberRolls;

  constructor(
    private readonly read: () => TradeSnapshot,
    private readonly play: (event: UiEvent) => void,
    rollMs: number,
    clock?: FrameClock,
  ) {
    this.rolls = new NumberRolls(clock, rollMs);
  }

  /** Numbers rolling now, for the idle check. */
  get rolling() {
    return this.rolls.rolling;
  }

  /** A deal was made; the redraw comes next. */
  traded() {
    this.dealt = true;
    this.play('coin');
  }

  /** The harbour screen was drawn (or redrawn) inside `root`. */
  settle(root: ParentNode) {
    const now = this.read();
    const before = this.last ?? now;
    this.last = now;
    if (!this.dealt) return;
    this.dealt = false;
    const [gold, hold] = root.querySelectorAll<HTMLElement>('.hb-chip b');
    if (gold && before.gold !== now.gold) this.roll(gold, before.gold, now.gold, formatNumber);
    if (hold && before.used !== now.used)
      this.roll(hold, before.used, now.used, (n) => `${n}/${now.cap}`);
  }

  private roll(num: HTMLElement, from: number, to: number, format: (n: number) => string) {
    num.dataset.value = String(from);
    num.textContent = format(from);
    this.rolls.roll(num, to, format);
    if (num.parentElement) playEnter(num.parentElement, 'pulse');
  }
}
