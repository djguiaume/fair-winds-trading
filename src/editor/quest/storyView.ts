import { NS } from './chartView';
import { conditionWords, questsNamed, storyColumns } from './doc';
import { h } from './form';
import { faceOf, rewardWords } from './labels';
import { $, pickQuest, qb, render } from './state';

/* The quest builder's Story view: every quest in story order, joined by its start conditions. */

const GAP = 30;
const H = 92;
const VGAP = 14;

export function drawStory() {
  const box = $('.qb-story');
  box.replaceChildren();
  const { doc } = qb;
  // The standing orders (decision 0214) are listed under the story, not in it.
  const quests = doc.quests.filter((q) => !q.repeat).map((q) => ({ id: q.id, start: q.start }));
  const columns = storyColumns(quests);
  // Columns as wide as fit the view (the story scrolls past five or so).
  const W = Math.max(150, Math.min(190, (box.clientWidth - 32) / columns.length - GAP));
  const at = new Map<string, { x: number; y: number }>();
  const tallest = Math.max(...columns.map((c) => c.length));
  columns.forEach((col, ci) =>
    col.forEach((id, ri) =>
      at.set(id, {
        x: 16 + ci * (W + GAP),
        y: 16 + ri * (H + VGAP) + ((tallest - col.length) * (H + VGAP)) / 2,
      }),
    ),
  );
  const width = 32 + columns.length * (W + GAP);
  const height = 32 + tallest * (H + VGAP);
  const links = document.createElementNS(NS, 'svg');
  links.setAttribute('class', 'qb-links');
  links.setAttribute('width', String(width));
  links.setAttribute('height', String(height));
  for (const q of quests)
    for (const from of questsNamed(q.start)) {
      const a = at.get(from);
      const b = at.get(q.id);
      if (!a || !b) continue;
      const [x1, y1, x2, y2] = [a.x + W, a.y + H / 2, b.x, b.y + H / 2];
      const path = document.createElementNS(NS, 'path');
      const mid = (x1 + x2) / 2;
      path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`);
      links.append(path);
    }
  const canvas = h('div', {
    class: 'qb-story-canvas',
    style: `width:${width}px;height:${height}px`,
  });
  canvas.append(links);
  for (const { id } of quests) {
    const p = at.get(id)!;
    const q = doc.quests.find((o) => o.id === id);
    const node = h('div', {
      class: `qb-node${id === qb.questId ? ' on' : ''}${q ? '' : ' dim'}`,
      style: `left:${p.x}px;top:${p.y}px;width:${W}px;height:${H}px`,
    });
    node.innerHTML = `<span class="qb-face">${faceOf(q?.giver, 46)}</span>`;
    const info = h('div', {}, h('b', {}, q?.name ?? id));
    info.append(
      h(
        'small',
        {},
        q
          ? [q.lesson ? 'lesson' : q.giver, q.port, rewardWords(q)].filter(Boolean).join(' · ')
          : '',
      ),
    );
    const pips = h('span', { class: 'qb-pips' });
    pips.innerHTML = '<i></i>'.repeat(Math.min(q?.steps.length ?? 6, 8));
    info.append(pips);
    node.append(info);
    if (q?.main) node.append(h('em', { class: 'qb-tag main' }, 'main'));
    if (q) node.addEventListener('click', () => openQuest(q.id));
    canvas.append(node);
  }
  box.append(
    canvas,
    h(
      'p',
      { class: 'qb-legend' },
      'A line is a start condition: the quest on the right starts once the one on the left is done (quest-done, quest-at, chose). Pick a quest to edit when it starts, on the right.',
    ),
    ...standingOrders(),
  );
}

/** The standing orders as chips under the story, with the quest each waits for. */
function standingOrders(): HTMLElement[] {
  const standing = h('div', { class: 'qb-standing' });
  for (const q of qb.doc.quests.filter((o) => o.repeat)) {
    const chip = h('button', {
      type: 'button',
      class: `qb-node is-standing${q.id === qb.questId ? ' on' : ''}`,
    });
    chip.innerHTML = `<span class="qb-face">${faceOf(q.giver, 30)}</span>`;
    chip.append(
      h(
        'span',
        {},
        h('b', {}, q.name),
        h('small', {}, `${q.port} · after ${conditionWords(q.start)}`),
      ),
    );
    chip.addEventListener('click', () => openQuest(q.id));
    standing.append(chip);
  }
  return standing.childElementCount
    ? [h('h3', { class: 'qb-legend' }, 'Standing orders: they ask again (0214)'), standing]
    : [];
}

function openQuest(id: string) {
  pickQuest(id);
  render();
}
