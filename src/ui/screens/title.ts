import { LANGUAGES, language, t } from '../../i18n';
import { icon } from '../icons';
import { listRow, panelClasses } from '../components';
import { el } from '../components/dom';
import type { MenuRows } from './menuRows';
import type { Screen } from './stack';
import keyArt from './art/title-key.jpg';
import './screens.css';

export interface TitleHost {
  /** Continue the saved voyage, or open New voyage when there is none. */
  play(): void;
  /** New voyage over a saved one (the host asks first). */
  newVoyage(): void;
  /** The Free Sailing row: a reload into its session; null inside a session. */
  freeSailing: (() => void) | null;
  settings(): void;
  help(): void;
  lessons(): void;
  transfer(): void;
  setLanguage(id: string): void;
}

/** What the title shows of the voyage and the lessons; the host refreshes it on every show. */
export interface TitleState {
  /** The main row: Continue for a saved voyage, New voyage for none, Set sail in Free Sailing. */
  primary: string;
  /** "Saltmere, day 12, 150 gold" for a saved voyage, null for none. */
  saveLine: string | null;
  /** New voyage as a second row, over a saved voyage. */
  offerNew: boolean;
  lessons: { label: string; note: string; disabled: boolean };
}

/**
 * The title (decision 0268, title 6 of the v1.5 kit): a full-height torn logbook page on the left
 * with the stacked logo, the tagline and the menu; the key art on the right, a golden-hour grade
 * of the cover. Continue is the one sage row; the rest are plain rows of the same size, and a
 * small line under them holds How to play, the lessons, Move your voyage and the language.
 */
export class TitleScreen implements MenuRows {
  readonly screen: Screen;
  private readonly list = el('nav', 'title-menu');
  private readonly play: HTMLElement;
  private readonly fresh: HTMLElement;
  private readonly lessons: HTMLButtonElement;
  private readonly settingsRow: HTMLElement;

  constructor(host: TitleHost) {
    this.play = this.row('menu-play', t('menu.newVoyage'), host.play);
    this.play.classList.add('title-row--main');
    this.play.dataset.padMain = '';
    this.fresh = this.row('menu-new', t('menu.newVoyage'), host.newVoyage);
    this.fresh.hidden = true;
    if (host.freeSailing)
      this.row('menu-free', t('menu.free'), host.freeSailing, t('menu.freeNote'));
    this.settingsRow = this.row('menu-settings', t('menu.settings'), host.settings);
    this.lessons = this.link('menu-tutorial', host.lessons);
    const small = el('div', 'title-small');
    small.append(
      this.link('menu-help', host.help, t('menu.help')),
      this.lessons,
      this.link('menu-transfer', host.transfer, t('menu.transfer')),
      this.fullscreen(),
      this.languages(host.setLanguage),
    );
    const page = el('section', `${panelClasses('torn', 'day')} title-page`);
    page.append(this.brand(), this.list, small, this.hint(), this.version());
    const art = el('img', 'title-art');
    art.src = keyArt;
    art.alt = '';
    art.decoding = 'async';
    const root = el('div', 'title');
    root.id = 'menu';
    root.hidden = true;
    root.append(art, page);
    this.screen = { id: 'menu', root, enter: 'fade', back: () => {} };
  }

  /** The state of the voyage: Continue with its save line, or New voyage as the main row. */
  update(state: TitleState) {
    this.play.querySelector('.ui-row-label')!.textContent = state.primary;
    this.play.querySelector('.ui-row-value')!.textContent = state.saveLine ?? '';
    this.fresh.hidden = !state.offerNew;
    this.lessons.querySelector('.title-link-label')!.textContent = state.lessons.label;
    this.lessons.title = state.lessons.note;
    this.lessons.disabled = state.lessons.disabled;
  }

  /** A row before Settings (Free Sailing's setup and way out). */
  addRow(id: string, label: string, press: () => void) {
    this.settingsRow.before(this.row(id, label, press));
  }

  private row(id: string, label: string, press: () => void, detail?: string) {
    const row = listRow({
      label,
      detail,
      value: id === 'menu-play' ? '' : undefined,
      onPress: press,
    });
    row.id = id;
    row.classList.add('title-row');
    this.list.append(row);
    return row;
  }

  private link(id: string, press: () => void, label = '') {
    const b = el('button', 'title-link ui-pressable');
    b.id = id;
    b.type = 'button';
    const words = el('span', 'title-link-label', label);
    words.id = `${id}-label`;
    b.append(words);
    b.addEventListener('click', press);
    return b;
  }

  private brand() {
    const logo = el('div', 'logo');
    logo.setAttribute('role', 'img');
    logo.setAttribute('aria-label', t('game.title'));
    logo.innerHTML =
      '<svg class="logo-rose" aria-hidden="true"><use href="#i-logo" /></svg>' +
      '<svg class="logo-word" aria-hidden="true"><use href="#i-wordmark" /></svg>' +
      '<svg class="logo-band" aria-hidden="true"><use href="#i-banderole" /></svg>';
    const tagline = el('p', 'title-tagline', t('menu.tagline'));
    const brand = el('div', 'title-brand');
    brand.append(logo, tagline);
    return brand;
  }

  /** Shown only where the browser can go fullscreen (main.ts decides). */
  private fullscreen() {
    const b = el('button', 'title-link title-icon ui-pressable');
    b.id = 'menu-fullscreen';
    b.type = 'button';
    b.hidden = true;
    b.innerHTML = icon('fullscreen');
    return b;
  }

  /** Each language in its own short code; a switch reloads the game in it (decision 0037). */
  private languages(set: (id: string) => void) {
    const group = el('div', 'title-languages');
    group.id = 'menu-language';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', t('menu.language'));
    for (const lang of LANGUAGES) {
      const b = el('button', 'title-lang ui-pressable', lang.id.toUpperCase());
      b.type = 'button';
      b.lang = lang.id;
      b.setAttribute('aria-label', lang.name);
      b.dataset.language = lang.id;
      b.setAttribute('aria-pressed', String(lang.id === language()));
      b.addEventListener('click', () => lang.id !== language() && set(lang.id));
      group.append(b);
    }
    return group;
  }

  private hint() {
    const p = el('p', 'title-hint');
    p.id = 'fs-hint';
    p.hidden = true;
    p.innerHTML = t('menu.fsHint');
    return p;
  }

  private version() {
    const p = el('p', 'title-version');
    p.append(el('b', 'app-version'), el('span', 'build-revision'));
    p.firstElementChild!.id = 'app-version';
    p.lastElementChild!.id = 'build-revision';
    return p;
  }
}
