import { TEXT_VARIANTS, type TextVariant, setLanguage } from '../../i18n';
import type { QuestDef, QuestStep } from '../../sim/quests';
import { CHARACTERS, type Mood, portraitSvg } from '../../ui/portraits';
import { questCardBody } from '../../ui/questCard';
import type { QuestCardModel } from '../../ui/questView';
import {
  LANGS,
  type Lang,
  WAY_NAMES,
  fillWords,
  plotWords,
  setText,
  textKeys,
  textOf,
} from './doc';
import { h, segmented } from './form';
import { fillPar, parOf } from './labels';
import { $, edit, qb, quest, render, step } from './state';

/* The quest builder's Card & text view: the open step's card as the game draws it, and its text. */

function cardModel(q: QuestDef, s: QuestStep | undefined, l: Lang): QuestCardModel {
  const { doc } = qb;
  const face = s?.speaker ?? q.giver;
  const giver = CHARACTERS.find((c) => c.id === face);
  const map = qb.host.prepared();
  const portName = map.ports.find((p) => p.id === (s?.port ?? q.port ?? giver?.port))?.name;
  const role = giver && (textOf(doc, l, `character.${giver.id}.role`) ?? giver.role);
  const i = s ? q.steps.indexOf(s) : q.steps.length;
  const par = parOf(s?.goal);
  const words = plotWords(doc, map, q, l);
  const fill = (text: string | undefined) => text && fillWords(fillPar(text, par), words);
  const key = s ? `${q.text}.${s.id}` : `${q.text}.done`;
  // Each ask of a standing order is offered on its own, and thanked in its own words (0214).
  const kind = !s
    ? 'finished'
    : s.choose
      ? 'choice'
      : (i === 0 || q.repeat) && q.offer
        ? 'offer'
        : 'step';
  const gold = (s ? s.reward?.gold : q.reward?.gold) ?? 0;
  const { speechWay } = qb;
  return {
    quest: q.id,
    kind,
    giver,
    mood: (s?.mood as Mood | undefined) ?? (s ? 'neutral' : 'pleased'),
    look: s?.look,
    role: role ? [role, portName].filter(Boolean).join(' · ') : undefined,
    arc: textOf(doc, l, `${q.text}.name`) ?? q.name,
    stepNo: Math.min(i + 1, q.steps.length),
    steps: q.steps.length,
    round: q.repeat && s ? i + 1 : undefined,
    progress: q.repeat && typeof s?.goal?.qty === 'number' ? `0 / ${s.goal.qty}` : undefined,
    // The version for the way of playing picked under the speech, else the default (0184).
    speech: fill(
      (speechWay && textOf(doc, l, `${key}.copy@${speechWay}`)) || textOf(doc, l, `${key}.copy`),
    ),
    ask: fill(textOf(doc, l, `${key}.title`)),
    options: s?.choose?.map((o) => ({
      id: o.id,
      title: textOf(doc, l, `${key}.${o.id}.title`) ?? o.id,
      copy: textOf(doc, l, `${key}.${o.id}.copy`),
    })),
    main: !!q.main,
    reward: gold ? { gold, more: [] } : undefined,
    moreSteps: kind === 'offer' && !q.repeat ? q.steps.length - 1 : undefined,
  };
}

export function drawCardView() {
  const box = $('.qb-card-view');
  const q = quest();
  box.replaceChildren();
  if (!q) return;
  const s = step();
  const { lang } = qb;
  box.append(
    h(
      'div',
      { class: 'ed-toggles qb-pv-toggles' },
      segmented(
        LANGS.map((l): [string, string] => [l, l.toUpperCase()]),
        lang,
        (v) => {
          qb.lang = v as Lang;
          render();
        },
      ),
      h(
        'span',
        { class: 'ed-note' },
        s
          ? `Step ${q.steps.indexOf(s) + 1}: ${s.id}`
          : 'The quest’s thanks card (pick a step on the left for its card)',
      ),
    ),
  );
  // A standing order's ask has its own thanks card under it (decision 0214).
  const models = [cardModel(q, s, lang)];
  if (q.repeat && s) {
    const ask = models[0]!;
    models.push({
      ...ask,
      kind: 'finished',
      mood: 'pleased',
      speech: textOf(qb.doc, lang, `${q.text}.${s.id}.thanks`),
      progress: undefined,
      reward: undefined,
      round: ask.round,
    });
  }
  for (const model of models) {
    setLanguage(lang);
    const body = questCardBody(model, !q.main);
    setLanguage('en');
    const card = h('div', { class: 'quest-card qb-card' });
    card.innerHTML = `${model.giver ? `<div class="quest-face">${portraitSvg(model.giver, { mood: model.mood, variant: model.look, size: 168 })}</div>` : ''}<div class="quest-body">${body}</div>`;
    box.append(h('div', { class: 'qb-card-host' }, card));
  }
  box.append(textTable(q, s));
  box.append(
    h(
      'p',
      { class: 'ed-note' },
      '{par} shows a timed step’s par as a clock, {dir} the direction of the step’s place (sound lines). An empty speech is left out of the card.',
    ),
  );
}

/** The text keys of this step (or the quest's name and thanks), English and French side by side. */
function textTable(q: QuestDef, s: QuestStep | undefined): HTMLElement {
  const { doc } = qb;
  const keys = textKeys(q).filter(({ key }) =>
    s
      ? key.startsWith(`${q.text}.${s.id}.`)
      : key === `${q.text}.name` ||
        key.startsWith(`${q.text}.done.`) ||
        // The quest cargo's names, for the dock news (decision 0213).
        key.startsWith('quest.item.'),
  );
  const table = h('table', { class: 'qb-text' });
  table.append(
    h('thead', {}, h('tr', {}, h('th'), h('th', {}, 'English'), h('th', {}, 'Français'))),
  );
  const body = h('tbody');
  for (const line of keys) {
    const { label, long } = line;
    // Speech has a default and a version per way of playing (decision 0184): tabs pick which one
    // the two languages edit, and the card above shows it.
    const way = line.variants ? qb.speechWay : null;
    const key = way ? `${line.key}@${way}` : line.key;
    const head = h('th', { title: key }, label);
    if (line.variants) head.append(wayTabs(line.key, way));
    const tr = h('tr', {}, head);
    for (const l of LANGS) {
      const value = textOf(doc, l, key) ?? '';
      const input = long ? h('textarea', { rows: '4' }) : h('input', { type: 'text' });
      input.value = value;
      if (way) input.placeholder = textOf(doc, l, line.key) ?? '';
      input.addEventListener('change', () =>
        edit(() => setText(qb.doc, l, key, input.value.trim())),
      );
      tr.append(h('td', {}, input));
    }
    body.append(tr);
  }
  table.append(body);
  return table;
}

/** The tabs under a speech: its default, and a version for each way of playing (0184). */
function wayTabs(baseKey: string, way: TextVariant | null): HTMLElement {
  const tabs = h('div', { class: 'qb-ways', role: 'tablist' });
  for (const w of [null, ...TEXT_VARIANTS]) {
    const k = w ? `${baseKey}@${w}` : baseKey;
    const written = LANGS.some((l) => !!textOf(qb.doc, l, k));
    const b = h(
      'button',
      {
        type: 'button',
        role: 'tab',
        'aria-selected': String(w === way),
        class: written ? 'written' : '',
        title: w
          ? `What a player on ${WAY_NAMES[w]} reads; empty = the default`
          : 'What every player reads when no version for their way of playing is written',
      },
      w ? WAY_NAMES[w] : 'default',
    );
    b.addEventListener('click', () => {
      qb.speechWay = w;
      drawCardView();
    });
    tabs.append(b);
  }
  return tabs;
}
