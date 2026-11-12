import { QUEST_DONE, type QuestDef, type QuestStep } from '../../sim/quests';
import { CHARACTERS, MOODS } from '../../ui/portraits';
import { renameStep } from './doc';
import {
  type FormContext,
  checkbox,
  conditionForm,
  h,
  jsonField,
  portOptions,
  row,
  segmented,
  select,
  textInput,
} from './form';
import { characterOptions, faceOf, slug } from './labels';
import { rewardForm } from './rewardForm';
import { edit, formContext, qb, render, shippedStep } from './state';

/* The quest builder panel's Goal and Card tabs for the open step. */

export function goalPanel(q: QuestDef, s: QuestStep): HTMLElement[] {
  const ctx = formContext(q);
  const i = q.steps.indexOf(s);
  const out: HTMLElement[] = [
    h(
      'h2',
      {},
      `Step ${i + 1} `,
      h('small', {}, shippedStep(q.id, s.id) ? 'shipped: id locked' : 'new'),
    ),
  ];
  const id = textInput(s.id, (v) => {
    const next = slug(v);
    if (next && next !== s.id)
      edit(() => {
        renameStep(qb.doc, q, s.id, next);
        if (s.id === next) qb.stepId = next;
      });
    else render();
  });
  id.disabled = shippedStep(q.id, s.id);
  out.push(row('Id', id));
  out.push(
    row(
      'Kind',
      segmented(
        [
          ['goal', 'a goal'],
          ['choose', 'a choice'],
          ['both', 'goal + buttons'],
        ],
        s.choose && s.goal ? 'both' : s.choose ? 'choose' : 'goal',
        (v) =>
          edit(() => {
            if (v !== 'goal' && !s.choose)
              s.choose = v === 'both' ? [{ id: 'continue' }] : [{ id: 'one' }, { id: 'two' }];
            if (v !== 'choose' && !s.goal) s.goal = { is: 'docked', port: q.port ?? 'home' };
            if (v === 'goal') delete s.choose;
            if (v === 'choose') delete s.goal;
          }),
      ),
    ),
  );
  if (s.goal) out.push(conditionForm(s.goal, ctx, true, (c) => (s.goal = c), 'Done when'));
  if (s.choose) out.push(...choiceForm(q, s, ctx));
  // Ways back, vars filled and a lesson's coach mark (decision 0151): edited as JSON for now.
  out.push(
    jsonField(
      'Lesson (JSON)',
      { unless: s.unless, set: s.set, coach: s.coach },
      (v) => {
        for (const key of ['unless', 'set', 'coach'] as const) {
          const next = v[key];
          if (next === undefined) delete s[key];
          else (s as unknown as Record<string, unknown>)[key] = next;
        }
      },
      edit,
    ),
  );
  const later = laterSteps(q, s);
  // A standing order's ask ends the round (decision 0214).
  if (!q.repeat)
    out.push(
      row(
        'Then',
        select(
          thenOptions(later),
          s.next,
          (v) => edit(() => (v ? (s.next = v) : delete s.next)),
          later[0] ? `the next step (${later[0]})` : 'the quest is done',
        ),
      ),
    );
  out.push(
    row(
      'Clean',
      checkbox(
        !!s.clean,
        (on) => edit(() => (on ? (s.clean = true) : delete s.clean)),
        'a reef or shore starts it over',
      ),
    ),
  );
  if (q.lesson)
    out.push(
      row(
        'Teach',
        checkbox(
          !!s.teach,
          (on) => edit(() => (on ? (s.teach = true) : delete s.teach)),
          'teaching only: passed by when the tutorial is skipped',
        ),
      ),
    );
  out.push(
    row(
      'Where',
      select(
        portOptions(ctx.map),
        s.port,
        (v) => edit(() => (v ? (s.port = v) : delete s.port)),
        '— (its places)',
      ),
    ),
  );
  return out;
}

/** The ids of the steps after `s`, which a step or an option can jump to. */
const laterSteps = (q: QuestDef, s: QuestStep) =>
  q.steps.slice(q.steps.indexOf(s) + 1).map((o) => o.id);

const thenOptions = (later: string[]): [string, string][] => [
  ...later.map((o): [string, string] => [o, `step ${o}`]),
  [QUEST_DONE, 'the quest is done'],
];

function choiceForm(q: QuestDef, s: QuestStep, ctx: FormContext): HTMLElement[] {
  const out: HTMLElement[] = [];
  const opts = s.choose ?? [];
  const later = laterSteps(q, s);
  opts.forEach((o, k) => {
    const box = h('div', { class: 'qb-cond' });
    const head = h(
      'div',
      { class: 'qb-cond-head' },
      h('span', { class: 'qb-k' }, `Option ${k + 1}`),
    );
    const id = textInput(o.id, (v) => {
      const next = slug(v);
      if (next && !opts.some((p) => p.id === next)) edit(() => (o.id = next));
    });
    id.disabled = shippedStep(q.id, s.id);
    head.append(id);
    if (opts.length > 2) {
      const x = h('button', { type: 'button' }, '✕');
      x.addEventListener('click', () => edit(() => opts.splice(k, 1)));
      head.append(x);
    }
    box.append(head);
    box.append(
      row(
        'Then',
        select(
          thenOptions(later),
          o.next,
          (v) => edit(() => (v ? (o.next = v) : delete o.next)),
          'as the step',
        ),
      ),
    );
    box.append(rewardForm(o.reward, ctx, (r) => (r ? (o.reward = r) : delete o.reward)));
    // An option shown only while a condition holds (decision 0151).
    if (o.if)
      box.append(
        conditionForm(
          o.if,
          ctx,
          false,
          (c) => (o.if = c),
          'Shown when',
          () => delete o.if,
        ),
      );
    else {
      const only = h('button', { type: 'button', class: 'qb-add' }, '+ shown only when…');
      only.addEventListener('click', () => edit(() => (o.if = { is: 'has-cargo' })));
      box.append(only);
    }
    out.push(box);
  });
  const add = h('button', { type: 'button', class: 'qb-add' }, '+ option');
  add.addEventListener('click', () =>
    edit(() => {
      const ids = opts.map((o) => o.id);
      let n = opts.length + 1;
      while (ids.includes(`option-${n}`)) n++;
      opts.push({ id: `option-${n}` });
    }),
  );
  out.push(add);
  return out;
}

export function cardPanel(q: QuestDef, s: QuestStep): HTMLElement[] {
  const out: HTMLElement[] = [h('h2', {}, 'Who speaks')];
  out.push(
    row(
      'Speaker',
      select(
        characterOptions(),
        s.speaker,
        (v) => edit(() => (v ? (s.speaker = v) : delete s.speaker)),
        `the giver (${q.giver ?? 'nobody'})`,
      ),
    ),
  );
  const face = s.speaker ?? q.giver;
  const moods = h('div', { class: 'qb-moods' });
  for (const m of MOODS) {
    const b = h('button', { type: 'button', 'aria-pressed': String((s.mood ?? 'neutral') === m) });
    b.innerHTML = `${faceOf(face, 56, m, s.look)}<span>${m}</span>`;
    b.addEventListener('click', () => edit(() => (m === 'neutral' ? delete s.mood : (s.mood = m))));
    moods.append(b);
  }
  out.push(moods);
  const looks = Object.keys(CHARACTERS.find((c) => c.id === face)?.looks ?? {});
  out.push(
    row(
      'Look',
      select(looks, s.look, (v) => edit(() => (v ? (s.look = v) : delete s.look)), 'everyday'),
    ),
  );
  out.push(h('p', { class: 'ed-note' }, 'The words are edited in the middle: Card & text.'));
  const go = h('button', { type: 'button' }, 'Card & text →');
  go.addEventListener('click', () => {
    qb.centre = 'card';
    render();
  });
  out.push(h('div', { class: 'ed-buttons' }, go));
  return out;
}
