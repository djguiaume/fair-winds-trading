import { t } from '../i18n';
import { portraitSvg } from './portraits';
import type { QuestCardModel } from './questView';

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** How long a note stays, in seconds; it fades over the last one. */
const NOTE_SEC = 6;

/**
 * The small note at sea (decision 0141): a quest that is not a main one moved on or finished away
 * from its person's harbour. Their face, "Kit · step 2 of 3" and the ask, under the captain's gold;
 * it fades by itself and a tap opens the journal. Notes wait their turn, and wait while a screen
 * covers the sea.
 */
export class QuestNote {
  onOpen: () => void = () => {};
  private queue: { key: string; card: QuestCardModel }[] = [];
  private left = 0;

  constructor(
    private readonly el: HTMLButtonElement,
    /** What the note sits under (the captain's gold). */
    private readonly under: HTMLElement,
  ) {
    el.addEventListener('click', () => {
      this.hide();
      this.onOpen();
    });
  }

  /** A note for this card, unless one for the same `key` is already waiting. */
  push(key: string, card: QuestCardModel) {
    if (this.queue.some((n) => n.key === key)) return;
    this.queue.push({ key, card });
  }

  get isShowing(): boolean {
    return !this.el.hidden;
  }

  /** `free`: nothing covers the sea. `skip`: a note no longer worth showing (seen meanwhile). */
  update(dt: number, free: boolean, skip: (key: string) => boolean = () => false) {
    if (this.left > 0) {
      this.left -= dt;
      // The stats above can grow while it shows (the deck chip, a run's clock, decision 0213).
      this.place();
      this.el.classList.toggle('is-fading', this.left < 1);
      if (this.left <= 0) this.hide();
      return;
    }
    if (!free) return;
    let next = this.queue.shift();
    while (next && skip(next.key)) next = this.queue.shift();
    if (next) this.show(next.card);
  }

  private show(c: QuestCardModel) {
    const who = c.giver?.name ?? c.arc;
    const step =
      c.kind === 'finished'
        ? t('journal.done')
        : t('journal.step', { n: c.stepNo, total: c.steps });
    this.el.innerHTML = `${
      c.giver
        ? `<span class="quest-note-face">${portraitSvg(c.giver, { size: 52, mood: c.mood })}</span>`
        : ''
    }<span class="quest-note-text"><b>${esc(`${who} · ${step}`)}</b>${
      (c.news ?? c.ask) ? `<span>${esc(c.news ?? c.ask!)}</span>` : ''
    }<small>${esc(t('quest.noteHint'))}</small></span>`;
    this.place();
    this.el.classList.remove('is-fading');
    this.el.hidden = false;
    this.left = NOTE_SEC;
  }

  private place() {
    const top = `${Math.round(this.under.getBoundingClientRect().bottom + 8)}px`;
    if (this.el.style.top !== top) this.el.style.top = top;
  }

  hide() {
    this.el.hidden = true;
    this.left = 0;
  }
}
