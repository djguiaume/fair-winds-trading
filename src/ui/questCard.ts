import { formatNumber, t } from '../i18n';
import { type MenuAction, PAD } from '../input/gamepad';
import { COIN, icon } from './icons';
import { padGlyph } from './padGlyphs';
import { portraitSvg } from './portraits';
import { type QuestCardModel, cardTag } from './questView';

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The controller button that does a card's answer, as a glyph shown only while the pad is in use
 * (decision 0163): the first button `controls.json` › `menu` gives the action, named for the pad.
 */
function padFor(action: MenuAction): string {
  const button = PAD.menu.actions[action][0];
  return button ? padGlyph(button) : '';
}

const TAG_KEY = { new: 'quest.tagNew', next: 'quest.tagNext', done: 'quest.tagDone' } as const;

/**
 * What a card says, the same on the arrival card and on the Quay tab (decision 0141): its tag
 * (new job, next, done), the person and the arc with its step pips, their words, the ask boxed with
 * where it happens, the reward, then the answers. `inline` is the Quay tab's form: a step or thanks
 * card has no button there, and the buttons name their quest.
 */
export function questCardBody(c: QuestCardModel, inline = false): string {
  const tag = cardTag(c.kind);
  const pips = Array.from(
    { length: c.steps },
    (_, i) => `<i class="${i < c.stepNo ? 'on' : ''}"></i>`,
  ).join('');
  const ask =
    c.ask && c.kind !== 'choice'
      ? `<div class="quest-ask">${c.good ? icon(c.good) : '<span class="quest-pin" aria-hidden="true">!</span>'}<b>${esc(c.ask)}</b>${
          c.progress ? ` <span class="quest-count">${esc(c.progress)}</span>` : ''
        }${c.where ? `<span class="quest-where">· ${esc(c.where)}</span>` : ''}</div>`
      : '';
  const more =
    c.moreSteps === undefined
      ? []
      : [t(c.moreSteps === 1 ? 'quest.moreStep' : 'quest.moreSteps', { n: c.moreSteps })];
  const reward = c.reward
    ? `<div class="quest-reward">${esc(t('quest.reward'))} ${
        c.reward.gold ? `<b>${formatNumber(c.reward.gold)}</b>${COIN}` : ''
      }${[...c.reward.more, ...more]
        .map((m, i) => `<span>${i || c.reward!.gold ? '· ' : ''}${esc(m)}</span>`)
        .join('')}</div>`
    : '';
  const q = inline ? ` data-quest="${esc(c.quest)}"` : '';
  // On the card dialog each answer carries its controller button: A does the focused answer, B is
  // the dialog's Esc (Not now), X the screen's extra action (Don't offer again). The Quay tab's
  // inline cards share their screen with others, so they keep the focus ring alone.
  // A presses the focused answer, so its glyph shows on that one only (quests.css).
  const press = inline ? '' : `<span class="pad-press">${padFor('press')}</span>`;
  let actions = '';
  if (c.kind === 'offer')
    actions = `<button type="button" class="d-btn brass" data-act="accept"${q}>${press}${icon('anchor')}${esc(t('quest.accept'))}</button><button type="button" class="d-btn" data-act="later"${q}>${inline ? '' : padFor('back')}${esc(t('quest.notNow'))}</button>${
      c.main
        ? ''
        : `<button type="button" class="d-btn ghost" data-act="ignore"${q}${inline ? '' : ' data-pad="secondary"'}>${inline ? '' : padFor('secondary')}${esc(t('quest.ignore'))}</button>`
    }`;
  else if (c.kind === 'choice')
    actions = (c.options ?? [])
      .map(
        (o) =>
          `<button type="button" class="d-btn quest-option" data-act="choose" data-option="${esc(o.id)}"${q}><b>${press}${esc(o.title)}</b>${o.copy ? `<span>${esc(o.copy)}</span>` : ''}</button>`,
      )
      .join('');
  else if (!inline)
    actions = `<button type="button" class="d-btn brass" data-act="close">${press}${esc(t('quest.close'))}</button>`;
  return `<span class="quest-tag is-${tag}">${esc(t(TAG_KEY[tag]))}</span>
      <header class="quest-head"><h2>${esc(c.giver?.name ?? c.arc)}</h2>${
        c.role ? `<span class="quest-role">${esc(c.role)}</span>` : ''
      }</header>
      <div class="quest-arc"><span>${esc(
        c.kind === 'finished'
          ? t('quest.arcDone', { name: c.arc })
          : t('quest.arcStep', { name: c.arc, n: c.stepNo, total: c.steps }),
      )}</span><span class="quest-pips" aria-hidden="true">${pips}</span></div>
      ${c.speech ? `<p class="quest-speech">${esc(c.speech)}</p>` : ''}
      ${ask}${reward}
      ${actions ? `<div class="quest-actions${c.kind === 'choice' ? ' is-choice' : ''}">${actions}</div>` : ''}`;
}

/**
 * The card of a main quest (decisions 0124, 0141): the giver's portrait over the card's edge, then
 * `questCardBody`. Docked, it is the arrival card: it greets the captain before the harbour screen,
 * under the harbour's name, with "To the market" below. A bottom card on wide screens, a bottom
 * sheet in portrait (quests.css). Every other quest speaks on the Quay tab instead.
 */
export class QuestCard {
  onAccept: (quest: string) => void = () => {};
  onChoose: (quest: string, option: string) => void = () => {};
  onIgnore: (quest: string) => void = () => {};
  onClose: (card: QuestCardModel) => void = () => {};
  private card: QuestCardModel | null = null;

  constructor(private readonly dialog: HTMLDialogElement) {
    dialog.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button[data-act]');
      if (!button || !this.card) return;
      const card = this.card;
      const act = button.dataset.act!;
      // The answer first, then the close: what comes next (another card from the same person)
      // is due by the time `onClose` looks for it.
      if (act === 'accept') this.onAccept(card.quest);
      else if (act === 'choose') this.onChoose(card.quest, button.dataset.option!);
      else if (act === 'ignore') this.onIgnore(card.quest);
      this.close();
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

  /** `arrival`: the harbour's name, when the card greets the captain on docking. */
  show(card: QuestCardModel, arrival?: string) {
    this.card = card;
    this.dialog.dataset.kind = card.kind;
    this.dialog.classList.toggle('is-arrival', !!arrival);
    const face = card.giver
      ? `<div class="quest-face">${portraitSvg(card.giver, { mood: card.mood, variant: card.look, size: 168 })}</div>`
      : '';
    this.dialog.innerHTML = `${
      arrival
        ? `<header class="quest-arrival"><h1>${esc(arrival)}</h1><small>${esc(t('quest.arrival'))}</small></header>`
        : ''
    }${face}<div class="quest-body">${questCardBody(card)}</div>${
      arrival
        ? `<button type="button" class="quest-to-market" data-act="market">${card.kind === 'offer' ? '' : padFor('back')}${esc(t('quest.toMarket'))}</button>`
        : ''
    }`;
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>('.quest-actions button')?.focus();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }
}
