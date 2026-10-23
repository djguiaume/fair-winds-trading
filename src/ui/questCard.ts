import { t } from '../i18n';
import { icon } from './icons';
import { portraitSvg } from './portraits';
import type { QuestCardModel } from './questView';

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The quest card (decision 0123): the giver's portrait over the card's edge, their name and role,
 * the arc and its step pips, what they say, the ask in a brass box, then the buttons. An offer asks
 * "I'll bring it" / "Not now"; a choice shows one button per option; a step or the thanks close
 * with "Fair winds". A bottom card on wide screens, a bottom sheet in portrait (quests.css).
 */
export class QuestCard {
  onAccept: (quest: string) => void = () => {};
  onChoose: (quest: string, option: string) => void = () => {};
  onClose: (card: QuestCardModel) => void = () => {};
  private card: QuestCardModel | null = null;

  constructor(private readonly dialog: HTMLDialogElement) {
    dialog.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button[data-act]');
      if (!button || !this.card) return;
      const card = this.card;
      const act = button.dataset.act!;
      this.close();
      if (act === 'accept') this.onAccept(card.quest);
      else if (act === 'choose') this.onChoose(card.quest, button.dataset.option!);
    });
    dialog.addEventListener('close', () => {
      const card = this.card;
      this.card = null;
      if (card) this.onClose(card);
    });
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  get current(): QuestCardModel | null {
    return this.card;
  }

  show(card: QuestCardModel) {
    this.card = card;
    this.dialog.dataset.kind = card.kind;
    this.dialog.innerHTML = this.render(card);
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>('.quest-actions button')?.focus();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  private render(c: QuestCardModel): string {
    const pips = Array.from(
      { length: c.steps },
      (_, i) => `<i class="${i < c.stepNo ? 'on' : ''}"></i>`,
    ).join('');
    const face = c.giver
      ? `<div class="quest-face">${portraitSvg(c.giver, { mood: c.mood, variant: c.look, size: 168 })}</div>`
      : '';
    const ask =
      c.ask && c.kind !== 'choice'
        ? `<div class="quest-ask">${c.good ? icon(c.good) : ''}<b>${esc(c.ask)}</b>${
            c.progress ? ` <span class="quest-count">${esc(c.progress)}</span>` : ''
          }</div>`
        : '';
    let actions: string;
    if (c.kind === 'offer')
      actions = `<button type="button" class="d-btn brass" data-act="accept">${icon('anchor')}${esc(t('quest.accept'))}</button><button type="button" class="d-btn" data-act="later">${esc(t('quest.notNow'))}</button>`;
    else if (c.kind === 'choice')
      actions = (c.options ?? [])
        .map(
          (o) =>
            `<button type="button" class="d-btn quest-option" data-act="choose" data-option="${esc(o.id)}"><b>${esc(o.title)}</b>${o.copy ? `<span>${esc(o.copy)}</span>` : ''}</button>`,
        )
        .join('');
    else
      actions = `<button type="button" class="d-btn brass" data-act="close">${esc(t('quest.close'))}</button>`;
    return `${face}<div class="quest-body">
      <header class="quest-head"><h2>${esc(c.giver?.name ?? c.arc)}</h2>${
        c.role ? `<span class="quest-role">${esc(c.role)}</span>` : ''
      }</header>
      <div class="quest-arc"><span>${esc(
        c.kind === 'finished'
          ? t('quest.arcDone', { name: c.arc })
          : t('quest.arcStep', { name: c.arc, n: c.stepNo, total: c.steps }),
      )}</span><span class="quest-pips" aria-hidden="true">${pips}</span></div>
      ${c.speech ? `<p class="quest-speech">${esc(c.speech)}</p>` : ''}
      ${ask}
      <div class="quest-actions${c.kind === 'choice' ? ' is-choice' : ''}">${actions}</div>
    </div>`;
  }
}
