import { t } from '../../i18n';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { portraitSvg } from '../portraits';
import type { JournalEntry, JournalStory } from '../questView';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface JournalHooks {
  track(quest: string): void;
  /** Offer an ignored quest again (decision 0141). */
  takeUp(quest: string): void;
}

/**
 * The Journal page (decision 0124, issue #444): the tracked quest on top, its giver's face, its
 * pips and steps, then the others as list rows. A started quest's row tracks it, an ignored one's
 * offers it again, a finished one's opens to its story and closes again.
 */
export class JournalPage {
  /** The finished quest open, told again; null: none. */
  private storyOpen: string | null = null;
  private entries: JournalEntry[] = [];

  constructor(
    private readonly list: HTMLElement,
    private readonly hooks: JournalHooks,
  ) {}

  render(entries: JournalEntry[]) {
    this.entries = entries;
    const tracked = entries.find((e) => e.state === 'tracked');
    if (!entries.some((e) => e.quest === this.storyOpen && e.story)) this.storyOpen = null;
    const parts: Node[] = [];
    if (tracked) parts.push(trackedCard(tracked));
    const others = entries.filter((e) => e !== tracked);
    if (others.length)
      parts.push(el('h4', 'chart-page-rule', t(tracked ? 'journal.others' : 'journal.people')));
    for (const e of others) {
      parts.push(this.row(e));
      if (this.storyOpen === e.quest && e.story) parts.push(storyList(e.story));
    }
    this.list.replaceChildren(...parts);
  }

  private row(e: JournalEntry): HTMLElement {
    const press = this.pressFor(e);
    const row = listRow({ label: e.who ?? e.arc, detail: rowLine(e), onPress: press?.run });
    row.classList.add('chart-journal-row', `is-${e.state}`);
    row.insertAdjacentHTML(
      'afterbegin',
      `<span class="chart-face">${face(e, 40)}${e.state === 'offered' ? '<i class="chart-face-alert">!</i>' : ''}</span>`,
    );
    if (press) row.dataset[press.key] = e.quest;
    if (e.story?.length) {
      const open = this.storyOpen === e.quest;
      row.setAttribute('aria-expanded', String(open));
      row.classList.toggle('is-open', open);
      row.append(el('i', 'chart-chevron'));
    }
    return row;
  }

  /** What pressing a row does, and the data attribute that says so; none for an offer. */
  private pressFor(e: JournalEntry) {
    if (e.state === 'active') return { key: 'track', run: () => this.hooks.track(e.quest) };
    if (e.state === 'ignored') return { key: 'takeUp', run: () => this.hooks.takeUp(e.quest) };
    if (!e.story?.length) return null;
    return {
      key: 'open',
      run: () => {
        this.storyOpen = this.storyOpen === e.quest ? null : e.quest;
        this.render(this.entries);
        this.list
          .querySelector<HTMLElement>(`[data-open="${CSS.escape(e.quest)}"]`)
          ?.focus({ preventScroll: true });
      },
    };
  }
}

const face = (e: JournalEntry, size: number) =>
  e.giver ? portraitSvg(e.giver, { size, mood: e.state === 'done' ? 'pleased' : 'neutral' }) : '';

/** A row's second line: asks, set aside, done (and what was chosen), or the step it is on. */
function rowLine(e: JournalEntry): string {
  if (e.state === 'offered') return t('journal.asks');
  if (e.state === 'ignored') return t('journal.ignored');
  if (e.state === 'done') {
    const done = e.chose.length
      ? t('journal.doneChose', { option: e.chose.join(', ') })
      : t('journal.done');
    return e.who ? `${e.arc} · ${done}` : done;
  }
  return `${e.arc} · ${t('journal.step', { n: e.stepNo, total: e.steps })}`;
}

/** The tracked quest: the giver, the arc, the step pips and the step lines. */
function trackedCard(e: JournalEntry): HTMLElement {
  const card = el('div', 'chart-tracked');
  const pips = Array.from(
    { length: e.steps },
    (_, i) => `<i class="${i < e.stepNo ? 'on' : ''}"></i>`,
  ).join('');
  const steps = e.lines
    .map((l) => {
      const mark = l.state === 'done' ? '✓' : l.state === 'now' ? '!' : '';
      const title = l.state === 'later' ? t('journal.later') : l.title;
      const progress = l.progress ? ` <b>${escapeHtml(l.progress)}</b>` : '';
      return `<li class="is-${l.state}"><span class="chart-check" aria-hidden="true">${mark}</span><span>${escapeHtml(title)}${progress}</span></li>`;
    })
    .join('');
  card.innerHTML = `<div class="chart-tracked-who">${face(e, 64)}<div>${
    e.who ? `<small>${escapeHtml(e.who)}</small>` : ''
  }<b>${escapeHtml(e.arc)}</b><span class="chart-tracked-step"><span class="quest-pips" aria-hidden="true">${pips}</span> ${escapeHtml(
    t('journal.step', { n: e.stepNo, total: e.steps }),
  )}</span></div></div><ul class="chart-steps">${steps}</ul>`;
  return card;
}

/** A finished quest told again: its steps, what was said, the answer, the thanks. */
function storyList(story: readonly JournalStory[]): HTMLElement {
  const list = el('ol', 'chart-story');
  list.innerHTML = story
    .map((l) =>
      l.thanks
        ? `<li class="is-thanks"><p class="chart-said">${escapeHtml(l.copy!)}</p></li>`
        : `<li><span class="chart-check" aria-hidden="true">✓</span><div>${
            l.title ? `<b>${escapeHtml(l.title)}</b>` : ''
          }${l.copy ? `<p class="chart-said">${escapeHtml(l.copy)}</p>` : ''}${
            l.chose ? `<p class="chart-chose">${escapeHtml(l.chose)}</p>` : ''
          }</div></li>`,
    )
    .join('');
  return list;
}
