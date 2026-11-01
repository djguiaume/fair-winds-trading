import { t } from '../../i18n';
import type { Difficulty } from '../../sim/difficulty';
import { button, panel, screenHeader } from '../components';
import { el } from '../components/dom';
import { levelCards } from '../levelCards';
import type { Screen } from './stack';
import './screens.css';

export interface NewVoyageHost {
  /** The level the voyage starts on when nothing was picked. */
  initial: Difficulty;
  /** Set sail on the chosen level. */
  sail(level: Difficulty): void;
  /** Close: back to the title. */
  close(): void;
}

/**
 * New voyage (decision 0083, issue #440): the three levels as three paper cards over the sea, the
 * boat in view above them, one line each; Set sail is the one sage action.
 */
export class NewVoyageScreen {
  readonly screen: Screen;
  private chosen: Difficulty;
  private readonly picker: ReturnType<typeof levelCards>;

  constructor(host: NewVoyageHost) {
    this.chosen = host.initial;
    this.picker = levelCards((id) => {
      this.chosen = id;
      this.picker.mark(id);
    });
    const header = screenHeader({ title: t('level.title'), exit: 'close', onExit: host.close });
    header.title.after(el('p', 'nv-sub', t('level.sub')));
    const cards = el('div', 'nv-cards');
    cards.id = 'level-cards';
    cards.setAttribute('role', 'radiogroup');
    cards.append(...this.picker.cards);
    const sail = button({ label: t('level.setSail'), variant: 'primary', icon: 'sail' });
    sail.id = 'set-sail';
    sail.addEventListener('click', () => host.sail(this.chosen));
    const foot = el('div', 'nv-foot');
    foot.append(el('p', 'nv-note', t('level.note')), sail);
    const root = panel({ edge: 'torn' }, header.root, cards, foot);
    root.id = 'new-voyage';
    root.classList.add('nv');
    root.hidden = true;
    this.screen = {
      id: 'new-voyage',
      root,
      back: host.close,
      onShow: () => {
        this.picker.mark(this.chosen);
        this.picker.cards
          .find((c) => c.dataset.level === this.chosen)
          ?.focus({ preventScroll: true });
      },
    };
  }

  /** The level in view, for a voyage whose level changed elsewhere (Settings). */
  choose(level: Difficulty) {
    this.chosen = level;
    this.picker.mark(level);
  }
}
