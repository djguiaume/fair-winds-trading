import { LANGS, conditionWords, newQuest, newStep, setText, storyColumns, textOf } from './doc';
import { h } from './form';
import { faceOf, rewardWords, stepTitle } from './labels';
import { fit } from './chartView';
import { $, edit, pickQuest, qb, quest, render, shippedQuest, shippedStep } from './state';

/* The quest builder's left column: every quest file, then the open quest's steps. */

export function drawQuestList() {
  const { doc } = qb;
  const box = $('.qb-quests');
  box.replaceChildren(h('h2', {}, 'Quests ', h('small', {}, `${doc.quests.length} files`)));
  const list = h('ul');
  // The story in order, then the standing orders (decision 0214).
  const order = [...storyColumns(doc.quests).flat(), ...doc.quests.map((q) => q.id)];
  const sorted = [...doc.quests].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  for (const q of sorted) {
    const li = h('li', { class: q.id === qb.questId ? 'on' : '', tabindex: '0' });
    li.innerHTML = `<span class="qb-face">${faceOf(q.giver, 30)}</span>`;
    li.append(
      h(
        'span',
        {},
        h('b', {}, q.name),
        h(
          'small',
          {},
          `${q.steps.length} ${q.repeat ? 'ask' : 'step'}${q.steps.length === 1 ? '' : 's'}`,
        ),
      ),
    );
    if (q.main) li.append(h('em', { class: 'qb-tag main' }, 'main'));
    if (q.lesson) li.append(h('em', { class: 'qb-tag main' }, 'lesson'));
    if (q.repeat) li.append(h('em', { class: 'qb-tag' }, 'standing'));
    if (q.race) li.append(h('em', { class: 'qb-tag' }, 'race'));
    if (!shippedQuest(q.id)) li.append(h('em', { class: 'qb-tag new' }, 'new'));
    const pick = () => {
      pickQuest(q.id);
      fit();
      render();
    };
    li.addEventListener('click', pick);
    li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
    list.append(li);
  }
  const add = h('button', { type: 'button', class: 'qb-add' }, '+ New quest');
  add.addEventListener('click', () =>
    edit(() => {
      const q = newQuest(qb.doc, qb.host.map());
      qb.doc.quests.push(q);
      pickQuest(q.id);
      setText(qb.doc, 'en', `${q.text}.name`, q.name);
      setText(qb.doc, 'fr', `${q.text}.name`, q.name);
      for (const l of LANGS) setText(qb.doc, l, `${q.text}.first.title`, 'Call at the harbour');
    }),
  );
  box.append(list, add);
}

export function drawSteps() {
  const box = $('.qb-steps');
  const q = quest();
  box.replaceChildren();
  if (!q) return;
  const head = h('div', { class: `qb-start${qb.stepId === null ? ' on' : ''}`, tabindex: '0' });
  head.append(
    h('span', { class: 'qb-k' }, 'Starts'),
    ` ${conditionWords(q.start)}${q.offer ? ' · offered' : ''}${q.port ? ` at ${q.port}` : ''}`,
  );
  head.title = 'The quest itself: who, where, when it starts, its reward';
  head.addEventListener('click', () => {
    qb.stepId = null;
    render();
  });
  box.append(h('h2', {}, q.name), head);
  const list = h('ol');
  q.steps.forEach((s, i) => {
    const li = h('li', { class: s.id === qb.stepId ? 'on' : '', tabindex: '0' });
    const flags = [
      s.reward?.gold ? `<span class="qb-gold">+${s.reward.gold}</span>` : '',
      s.reward?.order ? '<span class="qb-gold">+order</span>' : '',
      ...[
        s.clean && 'clean',
        s.teach && 'teach',
        s.marker,
        s.mood,
        s.speaker && `by ${s.speaker}`,
        s.compass && 'compass',
        s.wind && 'wind',
        s.moveTo && 'moves boat',
        s.sound && 'sound',
        s.music && 'music',
      ]
        .filter(Boolean)
        .map((f) => `<em>${String(f)}</em>`),
    ].join('');
    li.innerHTML = `<span class="qb-no">${i + 1}</span><div><b></b><small class="qb-goal"></small><span class="qb-flags">${flags}</span></div>`;
    li.querySelector('b')!.textContent = stepTitle(q, s);
    li.querySelector('small')!.textContent = s.choose
      ? `choice: ${s.choose.map((o) => o.id).join(' / ')}`
      : conditionWords(s.goal);
    li.addEventListener('click', () => {
      qb.stepId = s.id;
      fit();
      render();
    });
    const tools = h('span', { class: 'qb-step-tools' });
    const up = h('button', { type: 'button', title: 'Move up' }, '↑');
    up.disabled = i === 0;
    up.addEventListener('click', (e) => {
      e.stopPropagation();
      edit(() => q.steps.splice(i - 1, 0, ...q.steps.splice(i, 1)));
    });
    const del = h('button', { type: 'button', title: 'Delete this step' }, '✕');
    del.disabled = q.steps.length < 2;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (
        shippedStep(q.id, s.id) &&
        !confirm(`Delete the shipped step "${s.id}"? Saves at that step would lose their place.`)
      )
        return;
      edit(() => {
        q.steps.splice(i, 1);
        if (qb.stepId === s.id) qb.stepId = null;
      });
    });
    tools.append(up, del);
    li.append(tools);
    list.append(li);
  });
  const add = h('button', { type: 'button', class: 'qb-add' }, '+ Add step');
  add.addEventListener('click', () =>
    edit(() => {
      const s = newStep(q, qb.host.map());
      q.steps.push(s);
      qb.stepId = s.id;
      for (const l of LANGS) setText(qb.doc, l, `${q.text}.${s.id}.title`, 'New step');
    }),
  );
  const done = h('div', { class: 'qb-start qb-done' });
  done.append(
    h('span', { class: 'qb-k' }, 'Done'),
    // A standing order thanks on each ask, and asks again (decision 0214).
    q.repeat
      ? ' each ask thanks in its own words, then the next ask in turn after calls elsewhere'
      : ` ${textOf(qb.doc, 'en', `${q.text}.done.title`) ?? 'no thanks card'}${q.reward ? ` · pays ${rewardWords(q)}` : ''}`,
  );
  box.append(list, add, done);
}
