import { t } from '../../i18n';
import { listRow, panel } from '../components';
import { el } from '../components/dom';
import type { MenuRows } from './menuRows';
import type { Screen } from './stack';
import './screens.css';
import './title.css';

export interface PauseHost {
  resume(): void;
  chart(): void;
  settings(): void;
  /** Quit to the title (the host asks first). */
  quit(): void;
}

/**
 * Pause (issue #440): a small centred paper card over the dimmed sea, never the title page.
 * Resume is the one sage row; Esc and the pad's B resume too.
 */
export class PauseScreen implements MenuRows {
  readonly screen: Screen;
  readonly resume: HTMLElement;
  private readonly list = el('nav', 'pause-list');
  private readonly settingsRow: HTMLElement;
  private readonly status = el('p', 'pause-status');

  constructor(host: PauseHost) {
    this.resume = this.row('pause-resume', t('menu.resume'), host.resume, 'play');
    this.resume.classList.add('title-row--main');
    this.resume.dataset.padMain = '';
    this.row('pause-chart', t('pause.chart'), host.chart, 'map');
    this.settingsRow = this.row('pause-settings', t('menu.settings'), host.settings, 'gear');
    this.row('pause-quit', t('pause.quit'), host.quit, 'anchor');
    const card = panel(
      { edge: 'torn' },
      el('h1', 'pause-title', t('pause.title')),
      this.status,
      this.list,
    );
    card.classList.add('pause-card');
    const root = el('div', 'pause');
    root.id = 'pause';
    root.hidden = true;
    root.append(card);
    this.screen = { id: 'pause', root, enter: 'rise', back: host.resume };
  }

  /** The captain's gold and the hold, under the title. */
  update(status: string) {
    this.status.textContent = status;
  }

  addRow(id: string, label: string, press: () => void) {
    this.settingsRow.before(this.row(`pause-${id}`, label, press, 'sail', false));
  }

  private row(id: string, label: string, press: () => void, glyph: string, append = true) {
    const row = listRow({ label, icon: glyph, onPress: press });
    row.id = id;
    row.classList.add('pause-row');
    if (append) this.list.append(row);
    return row;
  }
}
