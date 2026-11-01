import { padGlyph } from '../padGlyphs';
import { uiSound } from '../uiSound';
import { el } from './dom';

/**
 * The one tab bar (decision 0269): `role="tab"` buttons between the LB and RB glyphs, which show
 * only while the pad is in use. LB/RB (padFocus.ts) and the arrow keys step through the tabs;
 * a click, a tap or A picks one.
 */
export interface Tab {
  id: string;
  label: string;
}

export interface TabBarOptions {
  tabs: readonly Tab[];
  selected?: string;
  onSelect?: (id: string) => void;
}

export class TabBar {
  readonly root: HTMLElement;
  private readonly buttons: HTMLButtonElement[];
  private current: string;

  constructor(private readonly o: TabBarOptions) {
    this.root = el('div', 'ui-tabs');
    this.root.setAttribute('role', 'tablist');
    this.buttons = o.tabs.map((tab) => {
      const b = el('button', 'ui-tab ui-pressable', tab.label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.tab = tab.id;
      b.addEventListener('click', () => this.select(tab.id));
      return b;
    });
    this.root.insertAdjacentHTML('afterbegin', padGlyph('lb', 'bumper'));
    this.root.append(...this.buttons);
    this.root.insertAdjacentHTML('beforeend', padGlyph('rb', 'bumper'));
    this.root.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      this.step(step);
      this.buttons.find((b) => b.dataset.tab === this.current)?.focus();
    });
    this.current = '';
    this.select(o.selected ?? o.tabs[0]?.id ?? '', false);
  }

  get selected(): string {
    return this.current;
  }

  /** Picks a tab; `notify` false for a change the caller made itself. */
  select(id: string, notify = true) {
    if (!this.o.tabs.some((t) => t.id === id) || id === this.current) return;
    this.current = id;
    for (const b of this.buttons) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    if (notify) {
      uiSound('tab');
      this.o.onSelect?.(id);
    }
  }

  /** The next (1) or previous (-1) tab, round the ends. */
  step(by: number) {
    const tabs = this.o.tabs;
    const at = tabs.findIndex((t) => t.id === this.current);
    this.select(tabs[(at + by + tabs.length) % tabs.length]!.id);
  }
}
