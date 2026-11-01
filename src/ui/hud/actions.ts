import { type MessageKey, goodName, t } from '../../i18n';
import { PAD, type SeaAction } from '../../input/gamepad';
import { GOODS } from '../../sim/goods';
import type { TradeState } from '../../sim/trade';
import { el } from '../components/dom';
import { icon } from '../icons';
import { padGlyphFor, padSymbol } from '../padGlyphs';
import { label, labelAttrs, setHidden, setText } from './parts';

/** The pad button a sea action names on its button, if the controls give it one. */
function padFor(action: SeaAction) {
  return PAD.sea.actions[action].find((b) => !['up', 'down', 'left', 'right'].includes(b));
}

/**
 * Bottom left (issue #441): Map, Cargo and Menu as words on the scene with the pad's buttons
 * (decisions 0199, 0201), and "Trade at …" once moored while the pier's sign is off screen.
 * Cargo opens the hold's list above it. `#chart-btn`, `#menu-btn` and `#dock-btn` keep their ids:
 * main.ts, the lessons' coach marks and the screenshot tool find them by those.
 */
export class Actions {
  readonly root = el('div', 'hud-actions hud-halo');
  readonly chart = el('button', 'hud-action');
  readonly cargo = el('button', 'hud-action');
  readonly menu = el('button', 'hud-action');
  readonly dock = el('button', 'hud-dock');
  readonly hold = el('div', 'hud-hold hud-plate');
  private readonly dockName = el('b', '');
  /** Quest cargo aboard, a line each, for the hold list (decision 0213). */
  questCargo: () => string[] = () => [];

  constructor() {
    this.action(this.chart, 'chart-btn', 'map', 'hud.map', 'hud.openChart');
    const chartPad = padFor('chart');
    if (chartPad) this.chart.insertAdjacentHTML('beforeend', padSymbol(chartPad));
    this.chart.setAttribute('aria-haspopup', 'dialog');
    this.action(this.cargo, 'cargo-btn', 'crate', 'hud.cargoButton', 'hud.cargo');
    this.cargo.setAttribute('aria-expanded', 'false');
    this.cargo.setAttribute('aria-controls', 'hud-cargo-tooltip');
    this.action(this.menu, 'menu-btn', 'menu', 'hud.menu', 'hud.mainMenu');
    const pausePad = padFor('pause');
    if (pausePad) this.menu.insertAdjacentHTML('beforeend', padSymbol(pausePad));
    this.dock.id = 'dock-btn';
    this.dock.hidden = true;
    labelAttrs(this.dock, { 'aria-label': 'hud.openTrade' });
    const harbourPad = padFor('harbour');
    this.dock.innerHTML = `${harbourPad ? padGlyphFor(harbourPad) : ''}${icon('anchor')}`;
    const words = el('span', 'hud-dock-text');
    words.append(label(el('span', ''), 'hud.tradeAt'), ' ', this.dockName);
    this.dock.append(words);
    this.hold.id = 'hud-cargo-tooltip';
    this.hold.hidden = true;
    this.root.append(this.chart, this.cargo, this.menu, this.dock, this.hold);
  }

  private action(
    b: HTMLButtonElement,
    id: string,
    iconId: string,
    key: MessageKey,
    aria: MessageKey,
  ) {
    b.id = id;
    b.type = 'button';
    labelAttrs(b, { 'aria-label': aria });
    b.innerHTML = icon(iconId);
    b.append(label(el('span', ''), key));
  }

  /** The Trade button while moored at `port` and its pier's sign is off screen; null hides it. */
  showDock(port: string | null) {
    setHidden(this.dock, port === null);
    if (port !== null) setText(this.dockName, port);
  }

  /** Opens or folds the hold's list: each good aboard, then the quest cargo on deck. */
  toggleHold(trade: TradeState) {
    const open = this.hold.hidden;
    this.hold.hidden = !open;
    this.cargo.setAttribute('aria-expanded', String(open));
    if (!open) return;
    const { cargo } = trade.captain;
    const rows = GOODS.filter((g) => cargo[g] > 0).map((g) => {
      const row = el('span', 'hud-hold-row', `${goodName(g)}: `);
      row.append(el('b', '', String(cargo[g])));
      return row;
    });
    const deck = this.questCargo();
    if (deck.length)
      rows.push(
        el('small', '', t('hud.onDeck')),
        ...deck.map((l) => el('span', 'hud-hold-row', l)),
      );
    if (!rows.length) rows.push(el('span', 'is-muted', t('hud.holdEmpty')));
    this.hold.replaceChildren(...rows);
  }

  /** Folds the hold's list (a tap anywhere else). */
  closeHold() {
    if (this.hold.hidden) return;
    this.hold.hidden = true;
    this.cargo.setAttribute('aria-expanded', 'false');
  }
}
