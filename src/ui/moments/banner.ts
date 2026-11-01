import { PAGE_TIMERS, type Timers } from '../components/toast';
import { panel } from '../components';
import { el } from '../components/dom';
import { leaveMs, playEnter } from '../motion';
import { SHIPPED_THEME } from '../theme/model';

/**
 * A banner (decision 0274): a paper strip at the top centre with a title and a line under it. It
 * drops in, waits and sinks away; only timers run, nothing per frame. The arrival banner and the
 * race's countdown are two of these.
 */
export class MomentBanner {
  readonly root: HTMLElement;
  private readonly title = el('h2', 'moment-title');
  private readonly line = el('p', 'moment-line');
  private shown = 0;

  constructor(
    kind: string,
    private readonly timers: Timers = PAGE_TIMERS,
  ) {
    this.root = panel({ edge: 'torn', tag: 'div' }, this.title, this.line);
    this.root.classList.add('moment-banner', `moment-banner--${kind}`);
    this.root.style.zIndex = String(SHIPPED_THEME.z.toast);
    this.root.hidden = true;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /** The words on show now, to write only what changed. */
  get text(): string {
    return this.title.textContent ?? '';
  }

  /** Shows the banner for `ms` (0: until `hide`); a second `show` replaces the first. */
  show(title: string, line: string | undefined, ms: number) {
    const id = ++this.shown;
    this.write(title, line);
    delete this.root.dataset.leave;
    const wasHidden = this.root.hidden;
    this.root.hidden = false;
    if (wasHidden) playEnter(this.root, 'drop');
    if (ms > 0) this.timers.set(() => this.leave(id), ms);
  }

  /** Changes the words of a banner already shown (the countdown's numbers). */
  write(title: string, line?: string) {
    if (this.title.textContent !== title) this.title.textContent = title;
    const text = line ?? '';
    if (this.line.textContent !== text) this.line.textContent = text;
    this.line.hidden = !line;
  }

  hide() {
    this.shown++;
    this.root.hidden = true;
  }

  private leave(id: number) {
    if (id !== this.shown) return;
    this.root.dataset.leave = '';
    this.timers.set(() => {
      if (id === this.shown) this.root.hidden = true;
    }, leaveMs());
  }
}
