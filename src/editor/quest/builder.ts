import { strToU8, zipSync } from 'fflate';
import { ISLAND_DESIGNS } from '../../data/islands';
import { setLanguage } from '../../i18n';
import type { MapDef } from '../../sim/map';
import { clearAt } from '../../sim/mapChecks';
import type { Condition, QuestPoint } from '../../sim/questLibrary';
import {
  QUESTS,
  QUEST_DONE,
  STEP_MARKER_STYLES,
  type QuestDef,
  type QuestStep,
  checkQuestHooks,
  checkQuests,
} from '../../sim/quests';
import { TUTORIAL_QUEST } from '../../sim/tutorial';
import { CHARACTERS, MOODS, type Mood, portraitSvg } from '../../ui/portraits';
import { questCardBody } from '../../ui/questCard';
import type { QuestCardModel } from '../../ui/questView';
import audio from '../../data/audio.json';
import { type Layers, type View, drawChart } from '../chart';
import { History } from '../model';
import {
  EDITED_QUESTS_KEY,
  LANGS,
  type Lang,
  type Place,
  type QuestDoc,
  addPlace,
  checkPlaces,
  checkText,
  clock,
  conditionWords,
  exportFiles,
  getAt,
  isQuestDoc,
  newQuest,
  newStep,
  playUrl,
  questsNamed,
  renameQuest,
  renameStep,
  round1,
  seaStart,
  setAt,
  setText,
  stepPlaces,
  stepPort,
  storyColumns,
  textKeys,
  textOf,
} from './doc';
import {
  type FormContext,
  checkbox,
  conditionForm,
  h,
  numberInput,
  portOptions,
  rewardForm,
  row,
  segmented,
  select,
  textInput,
} from './form';
import '../../ui/quests.css';
import './quest.css';
import gamePage from '../../../index.html?raw';

/**
 * The quest builder (decision 0142): a page of the map editor that edits every quest file and
 * the quest text. Steps on the left, the step's places on the map editor's chart (or its card,
 * or the story of every quest) in the middle, the step's fields and the checks on the right.
 * The working copy stays in this browser; Export gives the files to commit.
 */

export interface QuestHost {
  /** The map being edited, and the same after prepareMap. */
  map(): MapDef;
  prepared(): MapDef;
  shipped(): MapDef;
  mapName(): string;
  close(): void;
}

const SHIPPED_QUESTS: QuestDef[] = structuredClone(QUESTS) as QuestDef[];
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
const SHIPPED_STEPS = new Map(SHIPPED_QUESTS.map((q) => [q.id, new Set(q.steps.map((s) => s.id))]));
const TUTORIAL_STEPS = { [TUTORIAL_QUEST.id]: TUTORIAL_QUEST.steps.map((s) => s.id) };

const shippedDoc = (): QuestDoc => ({
  quests: structuredClone(SHIPPED_QUESTS),
  text: { en: {}, fr: {} },
});

type Tab = 'goal' | 'card' | 'sea' | 'reward';
type Centre = 'chart' | 'card' | 'story';
type Tool = 'select' | 'add' | 'compass';

let host: QuestHost;
let open = false;
let doc: QuestDoc = shippedDoc();
const history = new History<QuestDoc>();
let questId = SHIPPED_QUESTS[0]?.id ?? '';
let stepId: string | null = null;
let tab: Tab = 'goal';
let centre: Centre = 'chart';
let tool: Tool = 'select';
let lang: Lang = 'en';
let showAll = true;
const view: View = { cx: 0, cy: 0, upp: 1 };

let root: HTMLElement;
const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;

export const questsOpen = () => open;

export function setupQuestBuilder(h: QuestHost) {
  host = h;
  root = document.getElementById('qb')!;
  root.innerHTML = `
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
  root.addEventListener('click', (e) => {
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
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-zoom]'))
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
  new ResizeObserver(() => open && centre === 'chart' && drawChartView()).observe($('.qb-map'));
  doc = loadDoc();
}

function loadDoc(): QuestDoc {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(EDITED_QUESTS_KEY) ?? 'null');
    if (isQuestDoc(raw)) return raw;
  } catch {
    /* No storage or an unreadable draft: start from the shipped quests. */
  }
  return shippedDoc();
}

export function openQuests() {
  open = true;
  document.getElementById('ed-top')!.hidden = true;
  document.getElementById('ed-main')!.hidden = true;
  root.hidden = false;
  if (!doc.quests.some((q) => q.id === questId)) questId = doc.quests[0]?.id ?? '';
  $('.qb-map-name').textContent = host.mapName();
  fit();
  render();
}

function close() {
  open = false;
  root.hidden = true;
  document.getElementById('ed-top')!.hidden = false;
  document.getElementById('ed-main')!.hidden = false;
  host.close();
}

// --- State ------------------------------------------------------------------------------------

const quest = () => doc.quests.find((q) => q.id === questId);
const step = () => quest()?.steps.find((s) => s.id === stepId);
const shippedQuest = (id: string) => SHIPPED_STEPS.has(id);
const shippedStep = (q: string, s: string) => SHIPPED_STEPS.get(q)?.has(s) ?? false;

/** Records undo, makes the change, saves and redraws everything. */
function edit(change: () => void) {
  history.record(doc);
  change();
  commit();
}

function commit() {
  const edited = JSON.stringify(doc) !== JSON.stringify(shippedDoc());
  try {
    if (edited) localStorage.setItem(EDITED_QUESTS_KEY, JSON.stringify(doc));
    else localStorage.removeItem(EDITED_QUESTS_KEY);
  } catch {
    /* Private mode: the builder still works, the edits last only while the page is open. */
  }
  render();
}

function undo() {
  const prior = history.undo(doc);
  if (prior) {
    doc = prior;
    commit();
  }
}
function redo() {
  const next = history.redo(doc);
  if (next) {
    doc = next;
    commit();
  }
}
function reset() {
  if (!confirm('Throw away every quest and text edit and go back to the shipped quests?')) return;
  history.record(doc);
  doc = shippedDoc();
  commit();
}

function exportDoc() {
  const files = exportFiles(doc, SHIPPED_RAW);
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

// --- Play from a step (part 2) -------------------------------------------------------------------

/**
 * The Play dialog: pick the open quest's step and where the boat starts (docked at a port, or at
 * sea short of the step's first place), then the game opens in a new tab on the edited map with
 * these quests, on a fresh voyage that keeps nothing (decision 0142).
 */
function openPlay() {
  const q = quest();
  const dialog = $<HTMLDialogElement>('.qb-play');
  if (!q) return;
  const map = host.prepared();
  let at = stepId ?? q.steps[0]?.id ?? '';
  let where: 'port' | 'sea' = 'port';
  let port = stepPort(
    q,
    q.steps.find((s) => s.id === at),
    map,
  );
  const draw = () => {
    const s = q.steps.find((x) => x.id === at);
    const sea = s ? seaStart(s, map, (x, y) => clearAt(map, x, y, 4)) : null;
    if (!sea && where === 'sea') where = 'port';
    const go = h('button', { type: 'button', class: 'primary' }, '▶ Play in a new tab');
    go.addEventListener('click', () => {
      const start = where === 'sea' && sea ? sea : { port };
      window.open(playUrl(q.id, at, start), '_blank');
      dialog.close();
    });
    const cancel = h('button', { type: 'button' }, 'Cancel');
    cancel.addEventListener('click', () => dialog.close());
    const starts: [string, string][] = [['port', 'Docked at a port']];
    if (sea) starts.push(['sea', 'At sea, near the place']);
    dialog.replaceChildren(
      h('h2', {}, `Play “${q.name}”`),
      row(
        'From step',
        select(
          q.steps.map((x, i): [string, string] => [x.id, `${i + 1}. ${x.id}`]),
          at,
          (v) => {
            at = v;
            port = stepPort(
              q,
              q.steps.find((x) => x.id === v),
              map,
            );
            draw();
          },
        ),
      ),
      row(
        'Start',
        segmented(starts, where, (v) => {
          where = v as 'port' | 'sea';
          draw();
        }),
      ),
      where === 'port'
        ? row(
            'Port',
            select(
              map.ports.map((x): [string, string] => [x.id, x.name]),
              port,
              (v) => (port = v),
            ),
          )
        : h(
            'p',
            { class: 'qb-note' },
            `At ${sea!.x}, ${sea!.y}, about 30 short of the step's first place, heading for it (or off the wind if it blows from there).`,
          ),
      h(
        'p',
        { class: 'qb-note' },
        'A fresh Captain voyage with the tutorial skipped: the quests this one waits on count as done, and the earlier steps pay their rewards. Nothing is saved. The test bar at the bottom restarts or skips the step.',
      ),
      h('div', { class: 'qb-play-actions' }, cancel, go),
    );
  };
  draw();
  dialog.showModal();
}

/** Keys while the builder is open; the map editor's own handler steps aside. */
document.addEventListener('keydown', (e) => {
  if (!open) return;
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
    if (tool !== 'select') setTool('select');
    else close();
  }
});

// --- Drawing ----------------------------------------------------------------------------------

function render() {
  const q = quest();
  $<HTMLButtonElement>('[data-act="undo"]').disabled = !history.canUndo;
  $<HTMLButtonElement>('[data-act="redo"]').disabled = !history.canRedo;
  $('.qb-edited').hidden = JSON.stringify(doc) === JSON.stringify(shippedDoc());
  $('.qb-crumb').textContent = q ? `${q.name}${step() ? ` › ${stepId}` : ''}` : '—';
  drawViews();
  drawQuestList();
  drawSteps();
  drawTabs();
  drawPanel();
  $('.qb-chart-box').hidden = centre !== 'chart';
  $('.qb-card-view').hidden = centre !== 'card';
  $('.qb-story').hidden = centre !== 'story';
  if (centre === 'chart') {
    setTool(tool);
    drawChartView();
  }
  if (centre === 'card') drawCardView();
  if (centre === 'story') drawStory();
  drawChecks();
}

function drawViews() {
  const nav = $('.qb-views');
  nav.replaceChildren(
    segmented(
      [
        ['chart', 'Chart'],
        ['card', 'Card & text'],
        ['story', 'Story'],
      ],
      centre,
      (v) => {
        centre = v as Centre;
        render();
      },
    ),
  );
}

const faceOf = (id: string | undefined, size: number, mood: Mood = 'neutral', look?: string) => {
  const c = CHARACTERS.find((p) => p.id === id);
  return c ? portraitSvg(c, { mood, variant: look, size }) : '<i>⚓</i>';
};

function drawQuestList() {
  const box = $('.qb-quests');
  box.replaceChildren(h('h2', {}, 'Quests ', h('small', {}, `${doc.quests.length} files`)));
  const list = h('ul');
  const order = storyColumns(doc.quests).flat();
  const sorted = [...doc.quests].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  for (const q of sorted) {
    const li = h('li', { class: q.id === questId ? 'on' : '', tabindex: '0' });
    li.innerHTML = `<span class="qb-face">${faceOf(q.giver, 30)}</span>`;
    li.append(
      h(
        'span',
        {},
        h('b', {}, q.name),
        h('small', {}, `${q.steps.length} step${q.steps.length === 1 ? '' : 's'}`),
      ),
    );
    if (q.main) li.append(h('em', { class: 'qb-tag main' }, 'main'));
    if (!shippedQuest(q.id)) li.append(h('em', { class: 'qb-tag new' }, 'new'));
    const pick = () => {
      questId = q.id;
      stepId = null;
      fit();
      render();
    };
    li.addEventListener('click', pick);
    li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
    list.append(li);
  }
  const tut = h('li', {
    class: 'dim',
    title: 'The tutorial keeps its own lesson format for now (decision 0142)',
  });
  tut.innerHTML = '<span class="qb-face"><i>⚓</i></span>';
  tut.append(
    h('span', {}, h('b', {}, 'First voyage'), h('small', {}, 'tutorial · not editable yet')),
  );
  list.append(tut);
  const add = h('button', { type: 'button', class: 'qb-add' }, '+ New quest');
  add.addEventListener('click', () =>
    edit(() => {
      const q = newQuest(doc, host.map());
      doc.quests.push(q);
      questId = q.id;
      stepId = null;
      setText(doc, 'en', `${q.text}.name`, q.name);
      setText(doc, 'fr', `${q.text}.name`, q.name);
      for (const l of LANGS) setText(doc, l, `${q.text}.first.title`, 'Call at the harbour');
    }),
  );
  box.append(list, add);
}

/** The first `timed` par of a goal, for `{par}` in the card. */
function parOf(c: unknown): number | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const cond = c as Condition;
  if (cond.is === 'timed') {
    const par = cond.par;
    return typeof par === 'number' ? par : ((par as Record<string, number>)?.captain ?? undefined);
  }
  if (Array.isArray(cond.of)) for (const m of cond.of) if (parOf(m) !== undefined) return parOf(m);
  return parOf(cond.of);
}

const stepTitle = (q: QuestDef, s: QuestStep, l: Lang = 'en') => {
  const par = parOf(s.goal);
  return (textOf(doc, l, `${q.text}.${s.id}.title`) ?? s.id).replace(
    '{par}',
    par === undefined ? '{par}' : clock(par),
  );
};

function drawSteps() {
  const box = $('.qb-steps');
  const q = quest();
  box.replaceChildren();
  if (!q) return;
  const head = h('div', { class: `qb-start${stepId === null ? ' on' : ''}`, tabindex: '0' });
  head.append(
    h('span', { class: 'qb-k' }, 'Starts'),
    ` ${conditionWords(q.start)}${q.offer ? ' · offered' : ''}${q.port ? ` at ${q.port}` : ''}`,
  );
  head.title = 'The quest itself: who, where, when it starts, its reward';
  head.addEventListener('click', () => {
    stepId = null;
    render();
  });
  box.append(h('h2', {}, q.name), head);
  const list = h('ol');
  q.steps.forEach((s, i) => {
    const li = h('li', { class: s.id === stepId ? 'on' : '', tabindex: '0' });
    const flags = [
      s.reward?.gold ? `<span class="qb-gold">+${s.reward.gold}</span>` : '',
      ...[
        s.clean && 'clean',
        s.marker,
        s.mood,
        s.speaker && `by ${s.speaker}`,
        s.compass && 'compass',
        s.wind && 'wind',
        s.sound && 'sound',
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
      stepId = s.id;
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
        if (stepId === s.id) stepId = null;
      });
    });
    tools.append(up, del);
    li.append(tools);
    list.append(li);
  });
  const add = h('button', { type: 'button', class: 'qb-add' }, '+ Add step');
  add.addEventListener('click', () =>
    edit(() => {
      const s = newStep(q, host.map());
      q.steps.push(s);
      stepId = s.id;
      for (const l of LANGS) setText(doc, l, `${q.text}.${s.id}.title`, 'New step');
    }),
  );
  const done = h('div', { class: 'qb-start qb-done' });
  done.append(
    h('span', { class: 'qb-k' }, 'Done'),
    ` ${textOf(doc, 'en', `${q.text}.done.title`) ?? 'no thanks card'}${q.reward ? ` · pays ${rewardWords(q)}` : ''}`,
  );
  box.append(list, add, done);
}

const rewardWords = (q: { reward?: QuestDef['reward'] }) =>
  Object.entries(q.reward ?? {})
    .map(
      ([k, v]) =>
        `${k} ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.keys(v as object).join(', ') : String(v)}`,
    )
    .join(' · ');

// --- Panel ------------------------------------------------------------------------------------

function drawTabs() {
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
    const b = h('button', { type: 'button', 'aria-pressed': String(t === tab) }, label);
    b.addEventListener('click', () => {
      tab = t;
      render();
    });
    nav.append(b);
  }
}

function formContext(q: QuestDef): FormContext {
  return { map: host.prepared(), quests: doc.quests, quest: q, edit };
}

function drawPanel() {
  const box = $('.qb-scroll');
  box.replaceChildren();
  const q = quest();
  if (!q) return;
  const s = step();
  if (!s) box.append(...questPanel(q));
  else if (tab === 'goal') box.append(...goalPanel(q, s));
  else if (tab === 'card') box.append(...cardPanel(q, s));
  else if (tab === 'sea') box.append(...seaPanel(s));
  else
    box.append(
      h('h2', {}, 'Step reward'),
      rewardForm(s.reward, formContext(q), (r) => (r ? (s.reward = r) : delete s.reward)),
    );
}

const characterOptions = (): [string, string][] =>
  CHARACTERS.map((c): [string, string] => [c.id, `${c.name} · ${c.role}`]);

function questPanel(q: QuestDef): HTMLElement[] {
  const ctx = formContext(q);
  const out: HTMLElement[] = [h('h2', {}, 'Quest ', h('small', {}, `${q.id}.json`))];
  const id = textInput(q.id, (v) => {
    const next = v.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (next && next !== q.id && !doc.quests.some((o) => o.id === next))
      edit(() => {
        renameQuest(doc, q.id, next);
        questId = next;
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
      'Main',
      checkbox(
        !!q.main,
        (on) => edit(() => (on ? (q.main = true) : delete q.main)),
        'story spine: arrival card',
      ),
    ),
  );
  out.push(conditionForm(q.start, ctx, false, (c) => (q.start = c), 'Starts when'));
  out.push(h('h2', {}, 'Quest cargo'));
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
    const key = v.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (key) edit(() => ((q.items ??= {})[key] = { space: 1 }));
  });
  name.placeholder = '+ item id (space 0: a passenger)';
  items.append(name);
  out.push(items);
  out.push(h('h2', {}, 'Pays when done'));
  out.push(rewardForm(q.reward, ctx, (r) => (r ? (q.reward = r) : delete q.reward)));
  if (!shippedQuest(q.id)) {
    const del = h('button', { type: 'button', class: 'qb-danger' }, 'Delete this quest');
    del.addEventListener('click', () => {
      if (!confirm(`Delete "${q.name}"?`)) return;
      edit(() => {
        doc.quests = doc.quests.filter((o) => o !== q);
        for (const l of LANGS)
          for (const key of Object.keys(doc.text[l]))
            if (key.startsWith(`${q.text}.`)) delete doc.text[l][key];
        questId = doc.quests[0]?.id ?? '';
      });
    });
    out.push(h('div', { class: 'ed-buttons' }, del));
  }
  return out;
}

function goalPanel(q: QuestDef, s: QuestStep): HTMLElement[] {
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
    const next = v.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (next && next !== s.id)
      edit(() => {
        renameStep(doc, q, s.id, next);
        if (s.id === next) stepId = next;
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
        ],
        s.choose ? 'choose' : 'goal',
        (v) =>
          edit(() => {
            if (v === 'choose' && !s.choose) {
              delete s.goal;
              s.choose = [{ id: 'one' }, { id: 'two' }];
            } else if (v === 'goal' && !s.goal) {
              delete s.choose;
              s.goal = { is: 'docked', port: q.port ?? 'home' };
            }
          }),
      ),
    ),
  );
  if (s.goal) out.push(conditionForm(s.goal, ctx, true, (c) => (s.goal = c), 'Done when'));
  else out.push(...choiceForm(q, s, ctx));
  const later = q.steps.slice(i + 1).map((o) => o.id);
  out.push(
    row(
      'Then',
      select(
        [
          ...later.map((o): [string, string] => [o, `step ${o}`]),
          [QUEST_DONE, 'the quest is done'],
        ],
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

function choiceForm(q: QuestDef, s: QuestStep, ctx: FormContext): HTMLElement[] {
  const out: HTMLElement[] = [];
  const opts = s.choose ?? [];
  const i = q.steps.indexOf(s);
  const later = q.steps.slice(i + 1).map((o) => o.id);
  opts.forEach((o, k) => {
    const box = h('div', { class: 'qb-cond' });
    const head = h(
      'div',
      { class: 'qb-cond-head' },
      h('span', { class: 'qb-k' }, `Option ${k + 1}`),
    );
    const id = textInput(o.id, (v) => {
      const next = v.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
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
          [
            ...later.map((p): [string, string] => [p, `step ${p}`]),
            [QUEST_DONE, 'the quest is done'],
          ],
          o.next,
          (v) => edit(() => (v ? (o.next = v) : delete o.next)),
          'as the step',
        ),
      ),
    );
    box.append(rewardForm(o.reward, ctx, (r) => (r ? (o.reward = r) : delete o.reward)));
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

function cardPanel(q: QuestDef, s: QuestStep): HTMLElement[] {
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
    centre = 'card';
    render();
  });
  out.push(h('div', { class: 'ed-buttons' }, go));
  return out;
}

function seaPanel(s: QuestStep): HTMLElement[] {
  const out: HTMLElement[] = [h('h2', {}, 'At sea ', h('small', {}, 'while the step is tracked'))];
  out.push(
    row(
      'Marker',
      segmented(
        STEP_MARKER_STYLES.map((m): [string, string] => [m, m]),
        s.marker ?? 'ring',
        (v) => edit(() => (v === 'ring' ? delete s.marker : (s.marker = v as QuestStep['marker']))),
      ),
    ),
  );
  const compass = h('span', { class: 'ed-pair' });
  for (const key of ['x', 'y'] as const)
    compass.append(
      numberInput(
        s.compass?.[key],
        (n) =>
          edit(() => {
            if (n === undefined) delete s.compass;
            else s.compass = { x: s.compass?.x ?? n, y: s.compass?.y ?? n, [key]: n };
          }),
        key,
      ),
    );
  const pick = h('button', { type: 'button', title: 'Click the chart to place it' }, '⌖');
  pick.addEventListener('click', () => {
    centre = 'chart';
    setTool('compass');
    render();
  });
  compass.append(pick);
  out.push(row('Compass', compass));
  const chart = h('span', { class: 'ed-pair' });
  chart.append(
    select(
      host.prepared().ports.map((p): [string, string] => [p.id, p.name]),
      s.chart?.port,
      (v) =>
        edit(() => (v ? (s.chart = { port: v, radius: s.chart?.radius ?? 60 }) : delete s.chart)),
      '—',
    ),
    numberInput(
      s.chart?.radius,
      (n) => s.chart && n !== undefined && edit(() => (s.chart!.radius = n)),
      'radius',
    ),
  );
  out.push(row('Chart circle', chart));
  const wind = h('span', { class: 'ed-pair' });
  wind.append(
    numberInput(
      s.wind?.speedKn,
      (n) => edit(() => (n === undefined ? delete s.wind : (s.wind = { ...s.wind, speedKn: n }))),
      'the sea’s',
    ),
    numberInput(
      s.wind?.fromDeg,
      (n) =>
        s.wind &&
        edit(() => {
          if (n === undefined) delete s.wind!.fromDeg;
          else s.wind!.fromDeg = n;
        }),
      'from °',
    ),
  );
  out.push(row('Wind (kn)', wind));
  const sound = h('span', { class: 'ed-pair' });
  sound.append(
    select(
      Object.keys(audio.effects),
      s.sound?.effect,
      (v) =>
        edit(() =>
          v ? (s.sound = { effect: v, everySec: s.sound?.everySec ?? 9 }) : delete s.sound,
        ),
      '—',
    ),
    numberInput(
      s.sound?.everySec,
      (n) => s.sound && n !== undefined && edit(() => (s.sound!.everySec = n)),
      'every s',
    ),
  );
  out.push(row('Sound', sound));
  return out;
}

// --- Checks -----------------------------------------------------------------------------------

function drawChecks() {
  const map = host.prepared();
  let problems: string[];
  try {
    problems = [
      ...checkQuests(doc.quests, map, TUTORIAL_STEPS),
      ...checkQuestHooks(map, Object.values(ISLAND_DESIGNS), doc.quests, [TUTORIAL_QUEST.id]),
      ...checkText(doc),
      ...checkPlaces(doc, map, (x, y) => clearAt(map, x, y, 0)),
    ];
  } catch (e) {
    problems = [`the checks stopped: ${String(e)}`];
  }
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
    p.includes(`quest ${questId} `) || p.includes(`quest ${questId}:`) ? 0 : 1;
  for (const p of [...problems].sort((a, b) => mine(a) - mine(b)))
    list.append(h('li', { class: 'error' }, `✗ ${p}`));
}

// --- Chart ------------------------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';
const layers: Layers = { names: true, course: false, harbours: true, grid: false, flow: true };
const svg = () => $<SVGSVGElement>('.qb-map');

const HINTS: Record<Tool, string> = {
  select:
    'Drag a ring to move it, its gold handle to size it · drag the sea to pan, wheel or pinch to zoom',
  add: 'Click the sea to add a place to this step’s reach points (or a timed run’s via points)',
  compass: 'Click the sea to put the step’s compass point there',
};
const TOOLS: [Tool, string, string][] = [
  ['select', '✥', 'Select and drag'],
  ['add', '◎', 'Add a place to reach'],
  ['compass', '✶', 'Put the compass point'],
];

function setTool(next: Tool) {
  tool = next;
  for (const b of root.querySelectorAll<HTMLButtonElement>('.qb-tools button'))
    b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  $('.qb-hint').textContent = step()
    ? HINTS[tool]
    : 'Pick a step on the left to see and move its places';
}

function fit() {
  const map = host.prepared();
  const s = step();
  const q = quest();
  const places = s ? stepPlaces(s, map) : (q?.steps ?? []).flatMap((o) => stepPlaces(o, map));
  const rect = svg().getBoundingClientRect();
  const size = Math.max(1, Math.min(rect.width || 600, rect.height || 600));
  if (!places.length) {
    view.cx = 0;
    view.cy = 0;
    view.upp = ((map.boundsRadius + 20) * 2) / size;
    return;
  }
  const xs = places.flatMap((p) => [p.x - p.within, p.x + p.within]);
  const ys = places.flatMap((p) => [p.y - p.within, p.y + p.within]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  view.cx = (x0 + x1) / 2;
  view.cy = (y0 + y1) / 2;
  view.upp = Math.max(0.15, (Math.max(x1 - x0, y1 - y0) + 140) / size);
}

function zoom(factor: number, at?: QuestPoint) {
  const p = at ?? { x: view.cx, y: view.cy };
  const upp = Math.min(4, Math.max(0.08, view.upp * factor));
  const k = upp / view.upp;
  view.cx = p.x - (p.x - view.cx) * k;
  view.cy = p.y - (p.y - view.cy) * k;
  view.upp = upp;
}

let places: Place[] = [];

function drawChartView() {
  const el = svg();
  const map = host.map();
  drawChart(el, {
    map,
    prepared: host.prepared(),
    shipped: host.shipped(),
    selection: null,
    layers,
    view,
  });
  const px = view.upp;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'qb-overlay');
  el.append(g);
  const add = (tag: string, a: Record<string, string | number>, text?: string) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
    if (text !== undefined) n.textContent = text;
    g.append(n);
    return n;
  };
  const label = (s: string, x: number, y: number, cls: string, size = 13) =>
    add(
      'text',
      { x, y: -y, class: `qb-l ${cls}`, 'font-size': size * px, 'stroke-width': 3.5 * px },
      s,
    );
  const q = quest();
  const s = step();
  const prepared = host.prepared();
  if (q && showAll)
    q.steps.forEach((o, k) => {
      if (o === s) return;
      for (const p of stepPlaces(o, prepared)) {
        if (p.kind === 'compass') add('path', { d: star(p.x, p.y, 5 * px), class: 'qb-ghost' });
        else add('circle', { cx: p.x, cy: -p.y, r: Math.max(p.within, 3 * px), class: 'qb-ghost' });
        if (p.kind !== 'chart') label(`${k + 1}.${p.no || '✶'}`, p.x, p.y - 1.5 * px, 'ghost', 11);
      }
    });
  places = s ? stepPlaces(s, prepared) : [];
  // Lines join points in order (reach in-order, a timed run's via).
  for (const kind of ['point', 'via'] as const) {
    const run = places.filter((p) => p.kind === kind && p.ordered);
    if (run.length > 1)
      add('polyline', { points: run.map((p) => `${p.x},${-p.y}`).join(' '), class: 'qb-order' });
  }
  places.forEach((p, i) => {
    if (p.kind === 'compass') {
      add('path', { d: star(p.x, p.y, 9 * px), class: 'qb-compass', 'data-hit': `qp:${i}` });
      label('compass', p.x, p.y + 12 * px, 'tip', 12);
      return;
    }
    add('circle', {
      cx: p.x,
      cy: -p.y,
      r: p.within,
      class: `qb-ring is-${p.kind}`,
      'data-hit': p.kind === 'chart' ? '' : `qp:${i}`,
    });
    if (p.kind !== 'chart') {
      add('circle', { cx: p.x, cy: -p.y, r: 5 * px, class: 'qb-handle', 'data-hit': `qp:${i}` });
      label(
        p.kind === 'spot' ? (p.no === 1 ? 'load' : 'unload') : String(p.no),
        p.x,
        p.y + p.within + 6 * px,
        'num',
        15,
      );
    } else label('chart circle', p.x, p.y + p.within + 4 * px, 'tip', 12);
    if (p.radiusPath)
      add('circle', {
        cx: p.x + p.within,
        cy: -p.y,
        r: 5 * px,
        class: 'qb-size',
        'data-hit': `qr:${i}`,
      });
  });
}

/** A four-point star, for the compass point. */
function star(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const d = k % 2 ? r * 0.35 : r;
    pts.push(`${x + Math.sin(a) * d},${-y - Math.cos(a) * d}`);
  }
  return `M${pts.join('L')}Z`;
}

type Drag =
  | { kind: 'place'; i: number; dx: number; dy: number }
  | { kind: 'radius'; i: number }
  | { kind: 'pan'; sx: number; sy: number; cx: number; cy: number };
let drag: Drag | null = null;

function setupChart() {
  const tools = $('.qb-tools');
  for (const [id, icon, label] of TOOLS) {
    const b = h('button', { type: 'button', title: label, 'aria-label': label }, icon);
    b.dataset.tool = id;
    b.addEventListener('click', () => setTool(tool === id ? 'select' : id));
    tools.append(b);
  }
  const all = h('button', { type: 'button', 'aria-pressed': 'true' }, 'All steps');
  all.addEventListener('click', () => {
    showAll = !showAll;
    all.setAttribute('aria-pressed', String(showAll));
    drawChartView();
  });
  const names = h('button', { type: 'button', 'aria-pressed': 'true' }, 'Names');
  names.addEventListener('click', () => {
    layers.names = !layers.names;
    names.setAttribute('aria-pressed', String(layers.names));
    drawChartView();
  });
  $('.qb-toggles').append(names, all);
  const el = svg();
  const toMap = (e: { clientX: number; clientY: number }) => {
    const rect = el.getBoundingClientRect();
    return {
      x: view.cx + (e.clientX - rect.left - rect.width / 2) * view.upp,
      y: view.cy - (e.clientY - rect.top - rect.height / 2) * view.upp,
    };
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    const p = toMap(e);
    const hit = (e.target as Element).closest('[data-hit]')?.getAttribute('data-hit') ?? '';
    const [kind = '', n] = hit.split(':');
    const s = step();
    if (s && tool !== 'select' && !kind.startsWith('q')) {
      if (tool === 'compass') edit(() => (s.compass = { x: round1(p.x), y: round1(p.y) }));
      else {
        history.record(doc);
        if (addPlace(s, p.x, p.y)) commit();
        else {
          history.discardIfSame(doc);
          alert(
            'This step has no reach or timed goal to add a place to. Pick “reach” in its goal first.',
          );
        }
      }
      return;
    }
    if (s && kind === 'qp') {
      const place = places[Number(n)]!;
      history.record(doc);
      drag = { kind: 'place', i: Number(n), dx: place.x - p.x, dy: place.y - p.y };
    } else if (s && kind === 'qr') {
      history.record(doc);
      drag = { kind: 'radius', i: Number(n) };
    } else drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cy: view.cy };
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'pan') {
      view.cx = drag.cx - (e.clientX - drag.sx) * view.upp;
      view.cy = drag.cy + (e.clientY - drag.sy) * view.upp;
      drawChartView();
      return;
    }
    const s = step();
    const place = places[drag.i];
    if (!s || !place) return;
    const p = toMap(e);
    if (drag.kind === 'place') {
      const target = getAt(s, place.path) as QuestPoint;
      target.x = round1(p.x + drag.dx);
      target.y = round1(p.y + drag.dy);
    } else if (place.radiusPath)
      setAt(s, place.radiusPath, Math.max(1, Math.round(Math.hypot(p.x - place.x, p.y - place.y))));
    drawChartView();
  });
  const end = () => {
    if (!drag) return;
    const was = drag;
    drag = null;
    if (was.kind === 'pan') return;
    history.discardIfSame(doc);
    commit();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0015), toMap(e));
      drawChartView();
    },
    { passive: false },
  );
  setTool('select');
}

// --- Card and text ------------------------------------------------------------------------------

function cardModel(q: QuestDef, s: QuestStep | undefined, l: Lang): QuestCardModel {
  const face = s?.speaker ?? q.giver;
  const giver = CHARACTERS.find((c) => c.id === face);
  const map = host.prepared();
  const portName = map.ports.find((p) => p.id === (s?.port ?? q.port ?? giver?.port))?.name;
  const role = giver && (textOf(doc, l, `character.${giver.id}.role`) ?? giver.role);
  const i = s ? q.steps.indexOf(s) : q.steps.length;
  const par = parOf(s?.goal);
  const fill = (text: string | undefined) =>
    text?.replace('{par}', par === undefined ? '{par}' : clock(par));
  const key = s ? `${q.text}.${s.id}` : `${q.text}.done`;
  const kind = !s ? 'finished' : s.choose ? 'choice' : i === 0 && q.offer ? 'offer' : 'step';
  const gold = (s ? s.reward?.gold : q.reward?.gold) ?? 0;
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
    speech: fill(textOf(doc, l, `${key}.copy`)),
    ask: fill(textOf(doc, l, `${key}.title`)),
    options: s?.choose?.map((o) => ({
      id: o.id,
      title: textOf(doc, l, `${key}.${o.id}.title`) ?? o.id,
      copy: textOf(doc, l, `${key}.${o.id}.copy`),
    })),
    main: !!q.main,
    reward: gold ? { gold, more: [] } : undefined,
    moreSteps: kind === 'offer' ? q.steps.length - 1 : undefined,
  };
}

function drawCardView() {
  const box = $('.qb-card-view');
  const q = quest();
  box.replaceChildren();
  if (!q) return;
  const s = step();
  box.append(
    h(
      'div',
      { class: 'ed-toggles qb-pv-toggles' },
      segmented(
        LANGS.map((l): [string, string] => [l, l.toUpperCase()]),
        lang,
        (v) => {
          lang = v as Lang;
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
  const model = cardModel(q, s, lang);
  setLanguage(lang);
  const body = questCardBody(model, !q.main);
  setLanguage('en');
  const card = h('div', { class: 'quest-card qb-card' });
  card.innerHTML = `${model.giver ? `<div class="quest-face">${portraitSvg(model.giver, { mood: model.mood, variant: model.look, size: 168 })}</div>` : ''}<div class="quest-body">${body}</div>`;
  box.append(h('div', { class: 'qb-card-host' }, card));
  // The text keys of this step (or the quest's name and thanks), English and French side by side.
  const keys = textKeys(q).filter(({ key }) =>
    s
      ? key.startsWith(`${q.text}.${s.id}.`)
      : key === `${q.text}.name` || key.startsWith(`${q.text}.done.`),
  );
  const table = h('table', { class: 'qb-text' });
  table.append(
    h('thead', {}, h('tr', {}, h('th'), h('th', {}, 'English'), h('th', {}, 'Français'))),
  );
  const body2 = h('tbody');
  for (const { key, label, long } of keys) {
    const tr = h('tr', {}, h('th', { title: key }, label));
    for (const l of LANGS) {
      const value = textOf(doc, l, key) ?? '';
      const input = long ? h('textarea', { rows: '4' }) : h('input', { type: 'text' });
      input.value = value;
      input.addEventListener('change', () => edit(() => setText(doc, l, key, input.value.trim())));
      tr.append(h('td', {}, input));
    }
    body2.append(tr);
  }
  table.append(body2);
  box.append(table);
  box.append(
    h(
      'p',
      { class: 'ed-note' },
      '{par} shows a timed step’s par as a clock, {dir} the direction of the step’s place (sound lines). An empty speech is left out of the card.',
    ),
  );
}

// --- Story --------------------------------------------------------------------------------------

function drawStory() {
  const box = $('.qb-story');
  box.replaceChildren();
  const quests = [
    { id: TUTORIAL_QUEST.id, start: { is: 'always' } as Condition },
    ...doc.quests.map((q) => ({ id: q.id, start: q.start })),
  ];
  const columns = storyColumns(quests);
  // Columns as wide as fit the view (the story scrolls past five or so).
  const GAP = 30,
    H = 92,
    VGAP = 14;
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
      class: `qb-node${id === questId ? ' on' : ''}${q ? '' : ' dim'}`,
      style: `left:${p.x}px;top:${p.y}px;width:${W}px;height:${H}px`,
    });
    node.innerHTML = `<span class="qb-face">${faceOf(q?.giver, 46)}</span>`;
    const info = h('div', {}, h('b', {}, q?.name ?? 'First voyage'));
    info.append(
      h(
        'small',
        {},
        q
          ? [q.giver, q.port, rewardWords(q)].filter(Boolean).join(' · ')
          : 'tutorial · its own format',
      ),
    );
    const pips = h('span', { class: 'qb-pips' });
    pips.innerHTML = '<i></i>'.repeat(Math.min(q?.steps.length ?? 6, 8));
    info.append(pips);
    node.append(info);
    if (q?.main) node.append(h('em', { class: 'qb-tag main' }, 'main'));
    if (q)
      node.addEventListener('click', () => {
        questId = q.id;
        stepId = null;
        render();
      });
    canvas.append(node);
  }
  box.append(
    canvas,
    h(
      'p',
      { class: 'qb-legend' },
      'A line is a start condition: the quest on the right starts once the one on the left is done (quest-done, quest-at, chose). Pick a quest to edit when it starts, on the right.',
    ),
  );
}
