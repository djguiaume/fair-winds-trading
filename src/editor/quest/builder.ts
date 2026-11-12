import { strToU8, zipSync } from 'fflate';
import { exportFiles, questProblems } from './doc';
import { h, segmented } from './form';
import { drawCardView } from './cardView';
import { setupChart } from './chartInput';
import { drawChartView, fit, setTool, zoom } from './chartView';
import { drawQuestList, drawSteps } from './lists';
import { drawPanel, drawTabs } from './panel';
import { openPlay } from './play';
import {
  $,
  type Centre,
  type QuestHost,
  history,
  isEdited,
  loadDoc,
  qb,
  quest,
  redo,
  reset,
  setRender,
  step,
  undo,
} from './state';
import { drawStory } from './storyView';
import '../../ui/quests/index.css';
import './quest.css';
import gamePage from '../../../index.html?raw';

/**
 * The quest builder (decision 0142): a page of the map editor that edits every quest file and
 * the quest text. Steps on the left (lists.ts), the step's places on the map editor's chart
 * (chartView.ts, chartInput.ts), its card (cardView.ts) or the story of every quest (storyView.ts)
 * in the middle, the step's fields (panel.ts) and the checks on the right. What is open is in
 * state.ts. The working copy stays in this browser; Export gives the files to commit.
 */

const SHIPPED_RAW: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../data/quests/*.json', {
      eager: true,
      query: '?raw',
      import: 'default',
    }),
  ).map(([path, text]) => [
    path
      .split('/')
      .pop()!
      .replace(/\.json$/, ''),
    text,
  ]),
);

export const questsOpen = () => qb.open;

export function setupQuestBuilder(host: QuestHost) {
  qb.host = host;
  qb.root = document.getElementById('qb')!;
  qb.root.innerHTML = `
    <header class="ed-top">
      <h1>Quest builder</h1>
      <span class="ed-file"><span class="qb-map-name"></span> › <b class="qb-crumb"></b>
        <span class="qb-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← <span class="qb-long">Map</span></button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶<span class="qb-long"> Undo</span></button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷<span class="qb-long"> Redo</span></button>
        <button data-act="reset" title="Back to the quests shipped with the game">Reset</button>
        <button data-act="play" title="Play the open quest from one of its steps, in a new tab">▶<span class="qb-long"> Play from step…</span></button>
        <button data-act="export" class="primary" title="Download the changed quest and text files">Export</button>
      </nav>
    </header>
    <main class="qb-main">
      <aside class="qb-left">
        <nav class="qb-views"></nav>
        <section class="qb-quests"></section>
        <section class="qb-steps"></section>
      </aside>
      <section class="qb-centre">
        <div class="qb-chart-box">
          <aside class="ed-tools qb-tools"></aside>
          <section class="ed-chart">
            <svg class="qb-map" tabindex="0" aria-label="Chart"></svg>
            <div class="ed-toggles qb-toggles"></div>
            <div class="ed-zoom">
              <button data-zoom="in" aria-label="Zoom in">+</button>
              <button data-zoom="out" aria-label="Zoom out">−</button>
              <button data-zoom="fit" aria-label="Fit the step">⤢</button>
            </div>
            <p class="ed-hint qb-hint"></p>
          </section>
        </div>
        <section class="qb-card-view" hidden></section>
        <section class="qb-story" hidden></section>
      </section>
      <aside class="ed-panel qb-panel">
        <nav class="qb-tabs"></nav>
        <div class="qb-scroll"></div>
        <div class="ed-check-box qb-checks">
          <h2>Checks <small>same code as the tests</small></h2>
          <ul class="ed-checks"></ul>
        </div>
      </aside>
    </main>
    <dialog class="qb-play" aria-label="Play from a step"></dialog>`;
  qb.root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'back') close();
    else if (act === 'undo') undo();
    else if (act === 'redo') redo();
    else if (act === 'reset') reset();
    else if (act === 'export') exportDoc();
    else if (act === 'play') openPlay();
  });
  for (const b of qb.root.querySelectorAll<HTMLButtonElement>('[data-zoom]'))
    b.addEventListener('click', () => {
      if (b.dataset.zoom === 'fit') fit();
      else zoom(b.dataset.zoom === 'in' ? 1 / 1.4 : 1.4);
      drawChartView();
    });
  setupChart();
  // The card's icons (coin, pin) live in the game page's inline sprites.
  const page = new DOMParser().parseFromString(gamePage, 'text/html');
  for (const sprite of page.querySelectorAll('svg.icon-sprite')) {
    (sprite as SVGElement).style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.append(document.importNode(sprite, true));
  }
  new ResizeObserver(() => qb.open && qb.centre === 'chart' && drawChartView()).observe(
    $('.qb-map'),
  );
  setRender(render);
  qb.doc = loadDoc();
}

export function openQuests() {
  qb.open = true;
  document.getElementById('ed-top')!.hidden = true;
  document.getElementById('ed-main')!.hidden = true;
  qb.root.hidden = false;
  if (!qb.doc.quests.some((q) => q.id === qb.questId)) qb.questId = qb.doc.quests[0]?.id ?? '';
  $('.qb-map-name').textContent = qb.host.mapName();
  fit();
  render();
}

function close() {
  qb.open = false;
  qb.root.hidden = true;
  document.getElementById('ed-top')!.hidden = false;
  document.getElementById('ed-main')!.hidden = false;
  qb.host.close();
}

function exportDoc() {
  const files = exportFiles(qb.doc, SHIPPED_RAW);
  if (!files.length) {
    alert('Nothing to export: the quests and their text are as shipped.');
    return;
  }
  const save = (name: string, data: BlobPart, type: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  if (files.length === 1)
    save(files[0]!.path.split('/').pop()!, files[0]!.text, 'application/json');
  else
    save(
      'fair-winds-quests.zip',
      zipSync(Object.fromEntries(files.map((f) => [f.path, strToU8(f.text)]))),
      'application/zip',
    );
}

/** Keys while the builder is open; the map editor's own handler steps aside. */
document.addEventListener('keydown', (e) => {
  if (!qb.open) return;
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  } else if (e.key === 'Escape') {
    if (qb.tool !== 'select') setTool('select');
    else close();
  }
});

/** Redraws the whole page from the working copy and what is open. */
function render() {
  const q = quest();
  const { centre } = qb;
  $<HTMLButtonElement>('[data-act="undo"]').disabled = !history.canUndo;
  $<HTMLButtonElement>('[data-act="redo"]').disabled = !history.canRedo;
  $('.qb-edited').hidden = !isEdited();
  $('.qb-crumb').textContent = q ? `${q.name}${step() ? ` › ${qb.stepId}` : ''}` : '—';
  drawViews();
  drawQuestList();
  drawSteps();
  drawTabs();
  drawPanel();
  $('.qb-chart-box').hidden = centre !== 'chart';
  $('.qb-card-view').hidden = centre !== 'card';
  $('.qb-story').hidden = centre !== 'story';
  if (centre === 'chart') {
    setTool(qb.tool);
    drawChartView();
  }
  if (centre === 'card') drawCardView();
  if (centre === 'story') drawStory();
  drawChecks();
}

function drawViews() {
  $('.qb-views').replaceChildren(
    segmented(
      [
        ['chart', 'Chart'],
        ['card', 'Card & text'],
        ['story', 'Story'],
      ],
      qb.centre,
      (v) => {
        qb.centre = v as Centre;
        render();
      },
    ),
  );
}

function drawChecks() {
  const problems = questProblems(qb.doc, qb.host.prepared());
  const list = $('.qb-checks ul');
  list.replaceChildren();
  if (!problems.length) {
    for (const ok of [
      'ids, conditions, rewards, people and ports known (checkQuests)',
      'props, buoys and trade name real quests',
      'English and French text for every step',
      'every place at sea is in clear water',
    ])
      list.append(h('li', { class: 'ok' }, `✓ ${ok}`));
    return;
  }
  // The open quest's problems first.
  const mine = (p: string) =>
    p.includes(`quest ${qb.questId} `) || p.includes(`quest ${qb.questId}:`) ? 0 : 1;
  for (const p of [...problems].sort((a, b) => mine(a) - mine(b)))
    list.append(h('li', { class: 'error' }, `✗ ${p}`));
}
