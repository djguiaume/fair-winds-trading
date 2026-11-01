import { formatNumber, goodName, locale, t } from '../../i18n';
import { el } from '../components/dom';
import { screenHeader } from '../components/screenHeader';
import { type Tab, TabBar } from '../components/tabBar';
import { COIN, crateIcon } from '../icons';
import { badge } from './parts';

/**
 * The harbour's header on every tab (issue #443): the port's name in IM Fell with its line
 * ("Home port. Makes fish, wants grain and timber."), the tabs with their badges between the LB
 * and RB glyphs, the gold and the hold, and the close button (B on a pad).
 */
export interface HarbourTab extends Tab {
  /** A count on the tab: open orders, new faces on the quay. */
  badge?: number;
  quay?: boolean;
}

export interface WalletFigures {
  gold: number;
  used: number;
  cap: number;
  /** Quest cargo on deck (decision 0213), shown while there is some. */
  deck?: { used: number; cap: number };
}

export interface HarbourHeaderOptions {
  title: string;
  line: string;
  tabs: readonly HarbourTab[];
  selected: string;
  wallet: WalletFigures;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** The ids' prefix: `tp` for a port (`tp-close`, `tp-tab-market`), `home` for her island. */
  ids?: string;
}

export function harbourHeader(o: HarbourHeaderOptions): HTMLElement {
  const head = screenHeader({ title: o.title, exit: 'close', onExit: o.onClose });
  head.root.classList.add('hb-head');
  const ids = o.ids ?? 'tp';
  head.exit!.id = `${ids}-close`;
  const titles = el('div', 'hb-titles');
  head.title.replaceWith(titles);
  titles.append(head.title, el('p', 'hb-line', o.line));

  const bar = new TabBar({ tabs: o.tabs, selected: o.selected, onSelect: o.onSelect });
  for (const tab of o.tabs) {
    const b = bar.root.querySelector<HTMLElement>(`[data-tab="${tab.id}"]`)!;
    b.id = `${ids}-tab-${tab.id}`;
    if (tab.badge) b.append(badge(tab.badge, tab.quay));
  }
  head.exit!.before(bar.root, wallet(o.wallet));
  return head.root;
}

/** Gold and hold (and deck cargo) as ink figures; the trade ticks roll their numbers (0274). */
function wallet(w: WalletFigures): HTMLElement {
  const box = el('div', 'hb-wallet');
  const chip = (title: string, art: string, value: string) => {
    const c = el('span', 'hb-chip');
    c.title = title;
    c.innerHTML = `${art}<b>${value}</b>`;
    return c;
  };
  box.append(
    chip(t('hud.gold'), COIN, formatNumber(w.gold)),
    chip(t('hud.cargo'), crateIcon(w.cap > 0 ? w.used / w.cap : 0), `${w.used}/${w.cap}`),
  );
  if (w.deck)
    box.append(
      chip(
        t('hud.onDeck'),
        '<svg class="icon" aria-hidden="true"><use href="#i-deck" /></svg>',
        `${w.deck.used}/${w.deck.cap}`,
      ),
    );
  return box;
}

/** "Home port. Makes fish, wants grain and timber.": the port in one line under its name. */
export function portLine(o: {
  home: boolean;
  makes: readonly string[];
  wants: readonly string[];
  shipwright: boolean;
}): string {
  const list = (goods: readonly string[]) =>
    new Intl.ListFormat(locale(), { type: 'conjunction' }).format(
      goods.map((g) => goodName(g).toLowerCase()),
    );
  const makes = list(o.makes);
  const wants = list(o.wants);
  const trade =
    o.makes.length && o.wants.length
      ? t('harbour.lineTrade', { makes, wants })
      : o.makes.length
        ? t('harbour.lineMakes', { makes })
        : o.wants.length
          ? t('harbour.lineWants', { wants })
          : '';
  return [o.home ? t('harbour.lineHome') : '', trade, o.shipwright ? t('harbour.lineYard') : '']
    .filter(Boolean)
    .join(' ');
}
