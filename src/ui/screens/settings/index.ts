import { t } from '../../../i18n';
import { TabBar, panel, screenHeader } from '../../components';
import { el } from '../../components/dom';
import type { Screen } from '../stack';
import type { RowHost, SettingsContext } from './context';
import { controlsTab } from './controls';
import { displayTab } from './display';
import { gameTab } from './game';
import { type SettingRow, text } from './rows';
import { soundTab } from './sound';
import '../screens.css';

/** One group of rows under a small heading; an empty title makes a plain group. */
export interface SettingGroup {
  title: string;
  rows: SettingRow[];
}

type TabBuilder = (ctx: SettingsContext, host: RowHost) => SettingGroup[];

const TABS: readonly { id: string; build: TabBuilder }[] = [
  { id: 'game', build: gameTab },
  { id: 'display', build: displayTab },
  { id: 'sound', build: soundTab },
  { id: 'controls', build: controlsTab },
];

/**
 * Settings (decision 0269, issue #440): four tabs of list rows on one torn paper page, LB and RB
 * between them. Only the tab in view is on the page; every row refreshes after any change, and
 * again each time the screen shows, since the game can change a setting too (the speed log's own
 * toggle at sea).
 */
export class SettingsScreen {
  readonly screen: Screen;
  private readonly rows: SettingRow[] = [];
  private readonly pages = new Map<string, HTMLElement>();

  constructor(ctx: SettingsContext, close: () => void) {
    const host: RowHost = {
      changed: () => {
        ctx.changed();
        this.refresh();
      },
    };
    const header = screenHeader({ title: t('settings.title'), exit: 'close', onExit: close });
    const body = el('div', 'set-body');
    for (const { id, build } of TABS) {
      const page = el('div', 'set-page');
      page.hidden = id !== TABS[0]!.id;
      page.dataset.tab = id;
      for (const group of build(ctx, host)) page.append(this.group(group));
      this.pages.set(id, page);
      body.append(page);
    }
    const tabs = new TabBar({
      tabs: TABS.map(({ id }) => ({ id, label: text(`settings.tab.${id}`) })),
      onSelect: (id) => {
        for (const [key, page] of this.pages) page.hidden = key !== id;
      },
    });
    const root = panel({ edge: 'torn' }, header.root, tabs.root, body);
    root.id = 'settings';
    root.classList.add('set-screen');
    root.hidden = true;
    this.screen = { id: 'settings', root, back: close, onShow: () => this.refresh() };
  }

  refresh() {
    for (const row of this.rows) row.refresh();
  }

  private group({ title, rows }: SettingGroup): HTMLElement {
    const section = el('section', 'set-group');
    if (title) section.append(el('h2', 'set-heading', title));
    const list = el('div', 'set-list');
    for (const row of rows) {
      list.append(row.root);
      this.rows.push(row);
    }
    section.append(list);
    return section;
  }
}
