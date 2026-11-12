import type { QuestDef } from '../../sim/quests';
import { pickOnChart } from './chartView';
import { LANGS, renameQuest } from './doc';
import {
  checkbox,
  conditionForm,
  h,
  jsonField,
  numberInput,
  portOptions,
  row,
  select,
  textInput,
} from './form';
import { characterOptions, slug } from './labels';
import { raceRows } from './raceRows';
import { rewardForm } from './rewardForm';
import { questSeaRows } from './seaPanel';
import { edit, formContext, qb, render, shippedQuest } from './state';

/* The quest builder panel's page for the quest itself: who, where, when it starts, its reward. */

export function questPanel(q: QuestDef): HTMLElement[] {
  const ctx = formContext(q);
  const out: HTMLElement[] = [h('h2', {}, 'Quest ', h('small', {}, `${q.id}.json`))];
  const id = textInput(q.id, (v) => {
    const next = slug(v);
    if (next && next !== q.id && !qb.doc.quests.some((o) => o.id === next))
      edit(() => {
        renameQuest(qb.doc, q.id, next);
        qb.questId = next;
      });
    else render();
  });
  id.disabled = shippedQuest(q.id);
  id.title = id.disabled ? 'Shipped: saves know the quest by this id' : 'Its file name too';
  out.push(row('Id', id));
  out.push(
    row(
      'Name',
      textInput(q.name, (v) => v && edit(() => (q.name = v))),
    ),
  );
  // A lesson, its storms and its vars (decision 0151): edited as JSON for now.
  out.push(
    jsonField(
      'Lesson (JSON)',
      { lesson: q.lesson, storms: q.storms, vars: q.vars },
      (v) => {
        for (const key of ['lesson', 'storms', 'vars'] as const) {
          if (v[key] === undefined) delete q[key];
          else (q as unknown as Record<string, unknown>)[key] = v[key];
        }
      },
      edit,
    ),
  );
  out.push(
    row(
      'Giver',
      select(
        characterOptions(),
        q.giver,
        (v) => edit(() => (v ? (q.giver = v) : delete q.giver)),
        '—',
      ),
    ),
  );
  out.push(
    row(
      'Card at',
      select(
        portOptions(ctx.map),
        q.port,
        (v) => edit(() => (v ? (q.port = v) : delete q.port)),
        '—',
      ),
    ),
  );
  out.push(
    row(
      'Asks first',
      checkbox(
        !!q.offer,
        (on) => edit(() => (on ? (q.offer = true) : delete q.offer)),
        'offer: “I’ll bring it / Not now”',
      ),
    ),
  );
  out.push(
    row(
      'Standing order',
      checkbox(
        !!q.repeat,
        (on) =>
          edit(() => {
            if (!on) return delete q.repeat;
            q.repeat = true;
            q.offer = true;
          }),
        'asks again: one step per ask, in turn, after calls elsewhere (0214)',
      ),
    ),
  );
  out.push(
    row(
      'Main',
      checkbox(
        !!q.main,
        (on) => edit(() => (on ? (q.main = true) : delete q.main)),
        'story spine: arrival card',
      ),
    ),
  );
  out.push(...raceRows(q, ctx, edit, characterOptions(), () => pickOnChart('storm')));
  out.push(...questSeaRows(q));
  out.push(conditionForm(q.start, ctx, false, (c) => (q.start = c), 'Starts when'));
  out.push(h('h2', {}, 'Quest cargo'), cargoRows(q));
  out.push(h('h2', {}, 'Pays when done'));
  out.push(rewardForm(q.reward, ctx, (r) => (r ? (q.reward = r) : delete q.reward)));
  if (!shippedQuest(q.id)) out.push(deleteButton(q));
  return out;
}

/** The quest's own cargo: an item id and the hold space it takes (0: a passenger). */
function cargoRows(q: QuestDef): HTMLElement {
  const items = h('div', { class: 'qb-items' });
  for (const [item, def] of Object.entries(q.items ?? {})) {
    const x = h('button', { type: 'button', title: 'Remove' }, '✕');
    x.addEventListener('click', () =>
      edit(() => {
        delete q.items![item];
        if (!Object.keys(q.items!).length) delete q.items;
      }),
    );
    items.append(
      h(
        'div',
        { class: 'qb-item' },
        h('b', {}, item),
        ' space ',
        numberInput(
          def.space,
          (n) => n !== undefined && edit(() => (def.space = Math.max(0, Math.round(n)))),
        ),
        x,
      ),
    );
  }
  const name = textInput('', (v) => {
    const key = slug(v);
    if (key) edit(() => ((q.items ??= {})[key] = { space: 1 }));
  });
  name.placeholder = '+ item id (space 0: a passenger)';
  items.append(name);
  return items;
}

/** Deletes a quest made in the builder, with its text. */
function deleteButton(q: QuestDef): HTMLElement {
  const del = h('button', { type: 'button', class: 'qb-danger' }, 'Delete this quest');
  del.addEventListener('click', () => {
    if (!confirm(`Delete "${q.name}"?`)) return;
    edit(() => {
      const { doc } = qb;
      doc.quests = doc.quests.filter((o) => o !== q);
      for (const l of LANGS)
        for (const key of Object.keys(doc.text[l]))
          if (key.startsWith(`${q.text}.`)) delete doc.text[l][key];
      qb.questId = doc.quests[0]?.id ?? '';
    });
  });
  return h('div', { class: 'ed-buttons' }, del);
}
