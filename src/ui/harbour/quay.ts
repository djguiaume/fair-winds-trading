import { t } from '../../i18n';
import type { World } from '../../sim/world';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { portraitSvg } from '../portraits';
import { questCardBody } from '../questCard';
import type { QuayItem } from '../questView';
import { type TownWords, townWords } from './keeper';
import { badge } from './parts';
import './quay.css';

/**
 * The Quay tab (decisions 0141, 0213; issue #443): the people on the quay as a list with their
 * faces on the left, the picked person's card on the right (big portrait, name and role, the step
 * line, what they say, Take the job and Not now), and the town's growth under the list. The card
 * is the quest engine's own (`questCardBody`), its buttons turned into the v1.5 buttons.
 */
export function quayPane(
  world: World,
  people: readonly QuayItem[],
  selected: string | null,
  pick: (key: string) => void,
  picture: string | null,
): HTMLElement {
  const pane = el('section', 'hb-pane hb-quay');
  const list = el('div', 'hb-list hb-people');
  list.append(el('h3', 'hb-list-title', t('harbour.onTheQuay')));
  for (const item of people) list.append(personRow(item, item.key === selected, pick));
  const town = world.trade.dockedAt ? townWords(world, world.trade.dockedAt) : null;
  if (town) list.append(townCard(town));
  const chosen = people.find((p) => p.key === selected) ?? people[0];
  pane.append(list, chosen ? personCard(chosen) : emptyQuay(picture));
  return pane;
}

function personRow(item: QuayItem, selected: boolean, pick: (key: string) => void): HTMLElement {
  const { card } = item;
  const row = listRow({
    label: card.giver?.name ?? card.arc,
    detail: card.role,
    selected,
    onPress: () => pick(item.key),
  });
  row.classList.add('hb-row', 'hb-person');
  if (item.fresh) {
    row.classList.add('is-new');
    row.querySelector('.ui-row-label')!.append(badge(t('harbour.new'), true));
  }
  row.dataset.pick = `person:${item.key}`;
  row.querySelector('.ui-row-words')!.append(el('span', 'hb-person-line', personLine(item)));
  if (card.giver)
    row.insertAdjacentHTML(
      'afterbegin',
      portraitSvg(card.giver, { size: 56, mood: card.mood, variant: card.look }),
    );
  return row;
}

/** What the person is about, in one short line: their news, a job, or the step under way. */
function personLine({ card }: QuayItem): string {
  if (card.news) return card.news;
  if (card.kind === 'offer') return t('harbour.hasJob');
  if (card.kind === 'finished') return t('quest.arcDone', { name: card.arc });
  return t('quest.arcStep', { name: card.arc, n: card.stepNo, total: card.steps });
}

function personCard(item: QuayItem): HTMLElement {
  const { card } = item;
  const box = el('article', 'hb-detail hb-quay-card');
  if (item.fresh) box.classList.add('is-new');
  box.innerHTML = questCardBody(card, true);
  asComponentButtons(box);
  // The big portrait beside the tag, the name and the step line; what they say runs below.
  const top = el('div', 'hb-quay-top');
  const who = el('div', 'hb-quay-who');
  who.append(
    ...box.querySelectorAll(':scope > .quest-tag, :scope > .quest-head, :scope > .quest-arc'),
  );
  if (card.giver)
    top.insertAdjacentHTML(
      'afterbegin',
      portraitSvg(card.giver, { size: 120, mood: card.mood, variant: card.look }),
    );
  top.append(who);
  box.prepend(top);
  return box;
}

/**
 * The card's answers as the v1.5 buttons: its main answer sage (`data-pad-main`, where the pad's
 * focus starts), the others paper.
 */
function asComponentButtons(root: HTMLElement) {
  for (const b of root.querySelectorAll<HTMLButtonElement>('.d-btn')) {
    const main = b.classList.contains('brass');
    b.classList.remove('d-btn', 'brass', 'ghost');
    b.classList.add('ui-btn', main ? 'ui-btn--primary' : 'ui-btn--plain', 'ui-pressable');
    if (main) b.dataset.padMain = '';
  }
}

function emptyQuay(picture: string | null): HTMLElement {
  const box = el('div', 'hb-detail hb-quay-empty');
  if (picture) {
    const view = el('div', 'hb-quay-view');
    view.style.backgroundImage = `url('${picture}')`;
    box.append(view);
  }
  box.append(el('p', 'hb-muted', t('trade.quayEmpty')));
  return box;
}

/** "Village · 40%" over a sage bar, then what it grows into next. */
function townCard(town: TownWords): HTMLElement {
  const card = el('div', 'hb-town');
  card.title = town.hint;
  const level = el('p', 'hb-town-level');
  level.innerHTML = town.level;
  const bar = el('span', 'hb-town-bar');
  const fill = el('i', '');
  fill.style.width = `${Math.round(town.progress * 100)}%`;
  bar.append(fill);
  const next = el('p', 'hb-town-next');
  next.innerHTML = town.next;
  card.append(level, bar, next);
  return card;
}
