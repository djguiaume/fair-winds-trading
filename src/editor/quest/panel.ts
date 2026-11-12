import type { QuestStep } from '../../sim/quests';
import { h } from './form';
import { questPanel } from './questPanel';
import { rewardForm } from './rewardForm';
import { seaPanel } from './seaPanel';
import { $, type Tab, edit, formContext, qb, quest, render, step } from './state';
import { cardPanel, goalPanel } from './stepPanel';

/* The quest builder's right panel: the quest's own fields, or the open step's in four tabs. */

export function drawTabs() {
  const nav = $('.qb-tabs');
  nav.replaceChildren();
  if (!step()) {
    nav.append(h('span', { class: 'qb-k' }, 'The quest'));
    return;
  }
  for (const [t, label] of [
    ['goal', 'Goal'],
    ['card', 'Card'],
    ['sea', 'Sea'],
    ['reward', 'Reward'],
  ] as [Tab, string][]) {
    const b = h('button', { type: 'button', 'aria-pressed': String(t === qb.tab) }, label);
    b.addEventListener('click', () => {
      qb.tab = t;
      render();
    });
    nav.append(b);
  }
}

export function drawPanel() {
  const box = $('.qb-scroll');
  box.replaceChildren();
  const q = quest();
  if (!q) return;
  const s = step();
  if (!s) box.append(...questPanel(q));
  else if (qb.tab === 'goal') box.append(...goalPanel(q, s));
  else if (qb.tab === 'card') box.append(...cardPanel(q, s));
  else if (qb.tab === 'sea') box.append(...seaPanel(s));
  else
    box.append(
      h('h2', {}, 'Step reward'),
      rewardForm(s.reward, formContext(q), (r) => (r ? (s.reward = r) : delete s.reward)),
      ...chartsPanel(s),
    );
}

/** Chart areas the step lifts as soon as it begins (fog of war, decision 0156). */
function chartsPanel(s: QuestStep): HTMLElement[] {
  const areas = qb.host.prepared().fog?.areas ?? [];
  if (!areas.length && !s.charts?.length) return [];
  const out: HTMLElement[] = [h('h2', {}, 'Lifts the fog when the step begins')];
  for (const area of areas) {
    const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
    box.checked = !!s.charts?.includes(area.id);
    box.addEventListener('change', () =>
      edit(() => {
        const next = new Set(s.charts ?? []);
        if (box.checked) next.add(area.id);
        else next.delete(area.id);
        if (next.size) s.charts = areas.map((a) => a.id).filter((id) => next.has(id));
        else delete s.charts;
      }),
    );
    out.push(h('label', { class: 'qb-check' }, box, ` ${area.name} `, h('small', {}, area.id)));
  }
  return out;
}
