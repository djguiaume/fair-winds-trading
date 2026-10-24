/*
 * Quest builder mockup (decision 0142, proposed). Static: nothing here is wired, it only lays out
 * the screens with the game's own pieces so the pictures look like the real thing.
 */
import '../../../src/editor/editor.css';
import '../../../src/ui/quests.css';
import './quest-builder.css';
import { PHASE1_SOURCE, prepareMap } from '../../../src/data/maps';
import { drawChart } from '../../../src/editor/chart';
import { setLanguage } from '../../../src/i18n';
import fr from '../../../src/i18n/fr.json';
import en from '../../../src/i18n/en.json';
import { CHARACTERS, portraitSvg } from '../../../src/ui/portraits';
import { questCardBody } from '../../../src/ui/questCard';
import type { QuestCardModel } from '../../../src/ui/questView';
import quest from '../../../src/data/quests/saltmere-shoals.json';

const view = new URLSearchParams(location.search).get('view') ?? 'steps';
const app = document.getElementById('app')!;
document.body.dataset.view = view;
setLanguage('en');

const who = (id: string) => CHARACTERS.find((c) => c.id === id)!;
const face = (id: string, size: number, mood: 'neutral' | 'pleased' | 'worried' = 'neutral') =>
  portraitSvg(who(id), { mood, size });
const EN = en as Record<string, string>;
const FR = fr as Record<string, string>;

// --- Shell pieces ------------------------------------------------------------------------------

const top = (crumb: string, extra = '') => `
  <header class="ed-top qb-top">
    <h1>Quest builder</h1>
    <span class="ed-file">Windward Ring › <b>${crumb}</b> <span class="qb-dim">saltmere-shoals.json</span>
      <span class="qb-edited">· ● edited</span></span>
    <nav class="ed-actions">
      <button class="qb-long">← Map</button>
      <button>↶<span class="qb-long"> Undo</span></button>
      <button>↷<span class="qb-long"> Redo</span></button>
      ${extra}
      <button>▶ <span class="qb-long">Play from step…</span><span class="qb-short">Play</span></button>
      <button class="primary">Export<span class="qb-long"> quest + text</span></button>
    </nav>
  </header>`;

const modeTabs = (on: string) => `
  <nav class="qb-modes">
    ${['Map', 'Islands', 'Quests'].map((m) => `<button aria-pressed="${m === on}">${m}</button>`).join('')}
  </nav>`;

const QUESTS: { id: string; name: string; giver?: string; tag?: string; steps: number; dim?: boolean }[] = [
  { id: 'first-voyage', name: 'First voyage', tag: 'tutorial', steps: 14, dim: true },
  { id: 'rooks-thanks', name: 'Rook’s thanks', giver: 'rook', tag: 'main', steps: 1 },
  { id: 'saltmere-shoals', name: 'Where the shoals went', giver: 'kit', steps: 3 },
  { id: 'calda-slipway', name: 'The last keel', giver: 'ines', steps: 3 },
  { id: 'westholm-mill', name: 'The mill on the hill', giver: 'maren', steps: 3 },
  { id: 'stonehaven-light', name: 'A light on the Teeth', giver: 'ada', steps: 3 },
  { id: 'fair-winds', name: 'Fair winds', giver: 'rook', tag: 'main', steps: 1 },
];

const questList = () => `
  <section class="qb-quests">
    <h2>Quests <small>7 files</small></h2>
    <ul>
      ${QUESTS.map(
        (q) => `<li class="${q.id === 'saltmere-shoals' ? 'on' : ''} ${q.dim ? 'dim' : ''}">
          <span class="qb-face">${q.giver ? face(q.giver, 30) : '<i>⚓</i>'}</span>
          <span><b>${q.name}</b><small>${q.steps} step${q.steps > 1 ? 's' : ''}</small></span>
          ${q.tag ? `<em class="qb-tag ${q.tag}">${q.tag}</em>` : ''}
        </li>`,
      ).join('')}
    </ul>
    <button class="qb-add">+ New quest</button>
  </section>`;

interface StepCard {
  id: string;
  no: number;
  title: string;
  goal: string;
  reward: string;
  flags: string[];
}
const STEPS: StepCard[] = [
  {
    id: 'gulls',
    no: 1,
    title: EN['quest.saltmere-shoals.gulls.title']!,
    goal: 'reach 3 places · any order · within 10',
    reward: '100',
    flags: ['gulls', 'clean', 'worried'],
  },
  {
    id: 'channel',
    no: 2,
    title: EN['quest.saltmere-shoals.channel.title']!,
    goal: 'reach 3 gates · in order · within 10',
    reward: '150',
    flags: ['clean'],
  },
  {
    id: 'catch',
    no: 3,
    title: EN['quest.saltmere-shoals.catch.title']!.replace('{par}', '1:50'),
    goal: 'all of: carry 6 catch Saltmere → Calda · timed, par 2:30 / 1:50 / 1:30',
    reward: '250',
    flags: ['{par}'],
  },
];

const stepList = (on: string) => `
  <section class="qb-steps">
    <h2>Where the shoals went</h2>
    <div class="qb-start">
      <span class="qb-k">Starts</span> when <b>Rook’s thanks</b> is done ·
      <b>offered</b> by Kit Marlow at Saltmere
    </div>
    <ol>
      ${STEPS.map(
        (s) => `<li class="${s.id === on ? 'on' : ''}">
          <span class="qb-no">${s.no}</span>
          <div>
            <b>${s.title}</b>
            <small class="qb-goal">${s.goal}</small>
            <span class="qb-flags"><span class="qb-gold">+${s.reward}</span>${s.flags
              .map((f) => `<em>${f}</em>`)
              .join('')}</span>
          </div>
        </li>`,
      ).join('')}
    </ol>
    <button class="qb-add">+ Add step</button>
    <div class="qb-start qb-done">
      <span class="qb-k">Done</span> Kit’s thanks · pays <b>a building spot on Skerry</b> (spot-3)
    </div>
    <div class="qb-after">
      <span class="qb-k">After it</span>
      4 buoys on the gap, 3 fishing boats (map marks) · Saltmere smokes fish from level 2
    </div>
  </section>`;

const checks = (warn = true) => `
  <div class="ed-check-box qb-checks">
    <h2>Checks</h2>
    <ul class="ed-checks">
      <li class="ok">✓ ids, conditions and rewards known (checkQuests)</li>
      <li class="ok">✓ ports, people, goods and spots exist</li>
      <li class="ok">✓ every place at sea is in clear water</li>
      <li class="ok">✓ English and French text for every step</li>
      ${
        warn
          ? '<li class="warning">⚠ (new) gate 2 → 3: 3 tacks for a sloop at the base wind</li>'
          : ''
      }
      <li class="ok">✓ hooks: props, buoys and trade name real quests</li>
    </ul>
  </div>`;

// --- The chart, with the quest's places drawn over it ---------------------------------------

const NS = 'http://www.w3.org/2000/svg';
function chart(...args: Parameters<typeof drawQuestChart>) {
  // In dev the CSS arrives after this script: draw once the layout has settled.
  setTimeout(() => drawQuestChart(...args), 400);
}
function drawQuestChart(host: HTMLElement, cx: number, cy: number, upp: number, opts: { after?: boolean; step?: number } = {}) {
  const svg = host.querySelector<SVGSVGElement>('svg.qb-map')!;
  const map = structuredClone(PHASE1_SOURCE);
  drawChart(svg, {
    map,
    prepared: prepareMap(map),
    shipped: PHASE1_SOURCE,
    selection: null,
    layers: { names: true, course: false, harbours: true, grid: false },
    view: { cx, cy, upp },
  });
  const px = upp;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'qb-overlay');
  svg.append(g);
  const el = (tag: string, a: Record<string, string | number>, text?: string) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
    if (text) n.textContent = text;
    g.append(n);
    return n;
  };
  const label = (s: string, x: number, y: number, cls = '', size = 13) =>
    el('text', { x, y: -y, class: `qb-l ${cls}`, 'font-size': size * px, 'stroke-width': 3.5 * px }, s);
  const steps = quest.steps;
  const gulls = (steps[0]!.goal as { points: { x: number; y: number }[] }).points;
  const gates = (steps[1]!.goal as { points: { x: number; y: number }[] }).points;

  const ghost = (pts: { x: number; y: number }[], name: string) =>
    pts.forEach((p, i) => {
      el('circle', { cx: p.x, cy: -p.y, r: 10, class: 'qb-ghost' });
      label(`${name} ${i + 1}`, p.x, p.y - 2.5, 'ghost', 11);
    });
  const live = (pts: { x: number; y: number }[], pick: number, ordered: boolean, tip: string) => {
    if (ordered)
      el('polyline', { points: pts.map((p) => `${p.x},${-p.y}`).join(' '), class: 'qb-order' });
    pts.forEach((p, i) => {
      el('circle', { cx: p.x, cy: -p.y, r: 10, class: `qb-ring ${i === pick ? 'pick' : ''}` });
      el('circle', { cx: p.x, cy: -p.y, r: 5 * px, class: 'qb-handle' });
      el('circle', { cx: p.x + 10, cy: -p.y, r: 4.5 * px, class: 'qb-size' });
      label(String(i + 1), p.x, p.y + 12, 'num', 15);
    });
    const p = pts[pick]!;
    label(tip, p.x + 13, p.y - 15, 'tip', 12);
  };
  // Step 3, faded: the timed run to Port Calda.
  el('path', { d: 'M 262 120 C 245 0 210 -90 175 -240', class: 'qb-run' });
  label('step 3 · catch to Port Calda, timed ↑', 232, 120, 'ghost', 12);
  if (opts.step === 1) {
    ghost(gates, 'gate');
    live(gulls, 0, false, 'gulls 1 · x 205 · y 8 · within 10');
    gulls.forEach((p) => label('〰', p.x, p.y + 3, 'gull', 13));
  } else {
    ghost(gulls, 'gulls');
    live(gates, 1, true, 'gate 2 · x 134 · y 66 · within 10');
  }
  if (opts.after)
    (map.marks ?? [])
      .filter((m) => (m.tags ?? []).includes('after:saltmere-shoals'))
      .forEach((m) => {
        el('circle', {
          cx: m.x,
          cy: -m.y,
          r: 3.2,
          class: m.type === 'fishing-boat' ? 'qb-mark boat' : `qb-mark ${m.type}`,
        });
      });
}

const chartBox = (hint: string, toggles: string[] = ['Names', 'All steps', 'After the quest']) => `
  <section class="ed-chart qb-chart">
    <svg class="qb-map"></svg>
    <div class="ed-toggles">${toggles
      .map((x, i) => `<button aria-pressed="${i < 2}">${x}</button>`)
      .join('')}</div>
    <div class="ed-zoom"><button>+</button><button>−</button><button>⤢</button></div>
    <p class="ed-hint">${hint}</p>
  </section>`;

const tools = () => `
  <aside class="ed-tools qb-tools">
    <button aria-pressed="true" title="Select and drag">✥</button>
    <button title="Add a place to reach">◎</button>
    <button title="Compass point">✶</button>
    <button title="Chart circle">◌</button>
    <button title="Spot at sea (hold)">⚓</button>
  </aside>`;

// --- Panels -------------------------------------------------------------------------------

const tabs = (on: string) => `
  <nav class="qb-tabs">${['Goal', 'Card', 'Sea', 'Reward']
    .map((x) => `<button aria-pressed="${x === on}">${x}</button>`)
    .join('')}</nav>`;

const row = (k: string, v: string) => `<label class="ed-row"><span>${k}</span>${v}</label>`;
const sel = (v: string) => `<select><option>${v}</option></select>`;
const num = (v: string | number) => `<input value="${v}" />`;
const seg = (opts: string[], on: number) =>
  `<span class="qb-seg">${opts.map((o, i) => `<button aria-pressed="${i === on}">${o}</button>`).join('')}</span>`;

const goalPanel = () => `
  ${tabs('Goal')}
  <div class="qb-scroll">
    <h2>Step 2 <small>id <code>channel</code> · shipped, locked</small></h2>
    <div class="qb-cond">
      <div class="qb-cond-head">
        <span class="qb-k">Done when</span>
        <select class="qb-kind"><option>reach · sail to places at sea</option></select>
      </div>
      <div class="qb-points">
        <div class="qb-pt"><b>1</b> x <input value="119.2" /> y <input value="52.6" /> <button>⌖</button><button>✕</button></div>
        <div class="qb-pt on"><b>2</b> x <input value="134" /> y <input value="66" /> <button>⌖</button><button>✕</button></div>
        <div class="qb-pt"><b>3</b> x <input value="148.8" /> y <input value="79.4" /> <button>⌖</button><button>✕</button></div>
        <p class="ed-note">Click the chart with ◎ to add a gate, drag a ring to move it.</p>
      </div>
      ${row('Within', num(10))}
      ${row('Order', seg(['any', 'in order'], 1))}
      ${row('Slow to', `<span class="ed-pair">${num('— kn')}${num('— s held')}</span>`)}
      ${row('At night', '<input type="checkbox" />')}
      <div class="ed-buttons"><button>Wrap in all / any</button><button>not</button></div>
    </div>
    <hr />
    ${row('Then', sel('next step (3 · catch)'))}
    ${row('Clean', '<span><input type="checkbox" checked /> a reef or shore starts it over</span>')}
    ${row('Where', sel('— (places on the chart)'))}
  </div>
  ${checks()}`;

const seaPanel = () => `
  ${tabs('Sea')}
  <div class="qb-scroll">
    <h2>Step 1 <small>at sea while tracked</small></h2>
    ${row('Marker', seg(['ring', 'gulls'], 1))}
    ${row('Compass', `<span class="ed-pair">${num('—')}${num('—')}<button>⌖</button></span>`)}
    ${row('Chart circle', `<span class="ed-pair">${sel('—')}${num('r')}</span>`)}
    ${row('Wind', `<span class="ed-pair">${num('sea’s')}${num('from °')}</span>`)}
    ${row('Sound', `<span class="ed-pair">${sel('—')}${num('every s')}</span>`)}
  </div>`;

const MOODS = ['neutral', 'pleased', 'worried'] as const;
const cardPanel = () => `
  ${tabs('Card')}
  <div class="qb-scroll">
    <h2>Step 2 <small>who speaks</small></h2>
    ${row('Speaker', sel('Kit Marlow (giver)'))}
    <div class="qb-moods">${MOODS.map(
      (m) => `<button aria-pressed="${m === 'neutral'}">${face('kit', 64, m)}<span>${m}</span></button>`,
    ).join('')}</div>
    ${row('Look', sel('everyday'))}
    <hr />
    <h2>Text <small>quest.saltmere-shoals.channel</small></h2>
    <ul class="ed-checks">
      <li class="ok">✓ English and French written</li>
      <li class="ok">✓ copy 3 lines on desktop, 5 on a phone</li>
      <li class="ok">✓ the same {par} and {dir} in both languages</li>
    </ul>
    <p class="ed-note">Words go to <code>src/i18n/en.json</code> and <code>fr.json</code>; the export
    gives both files with only these keys changed.</p>
  </div>`;

// --- The card preview and the text table ------------------------------------------------------

function cardModel(lang: Record<string, string>): QuestCardModel {
  return {
    quest: 'saltmere-shoals',
    kind: 'step',
    giver: who('kit'),
    mood: 'neutral',
    role: lang === FR ? 'Pêcheuse · Saltmere' : 'Fisher · Saltmere',
    arc: lang['quest.saltmere-shoals.name']!,
    stepNo: 2,
    steps: 3,
    speech: lang['quest.saltmere-shoals.channel.copy'],
    ask: lang['quest.saltmere-shoals.channel.title'],
    where: lang === FR ? '3 portes, sur la carte' : '3 gates, marked on the chart',
    reward: { gold: 150, more: [] },
    main: false,
  };
}
const card = (lang: Record<string, string>) => {
  setLanguage(lang === FR ? 'fr' : 'en');
  const html = `
  <dialog class="quest-card qb-card" open>
    <div class="quest-face">${portraitSvg(who('kit'), { mood: 'neutral', size: 168 })}</div>
    <div class="quest-body">${questCardBody(cardModel(lang), true)}</div>
  </dialog>`;
  setLanguage('en');
  return html;
};

const textTable = () => `
  <table class="qb-text">
    <thead><tr><th></th><th>English</th><th>Français</th></tr></thead>
    <tbody>
      ${(['title', 'copy'] as const)
        .map(
          (k) => `<tr><th>${k === 'title' ? 'Ask' : 'Speech'}</th>${[EN, FR]
            .map((l) => {
              const v = l[`quest.saltmere-shoals.channel.${k}`]!;
              return `<td>${k === 'title' ? `<input value="${v}" />` : `<textarea rows="4">${v}</textarea>`}</td>`;
            })
            .join('')}</tr>`,
        )
        .join('')}
      <tr><th>Insert</th><td colspan="2"><span class="ed-chips"><span class="ed-chip">{par}</span><span class="ed-chip">{dir}</span><span class="qb-dim">· timed steps and sounds only</span></span></td></tr>
    </tbody>
  </table>`;

// --- Story view: every quest and what starts it ------------------------------------------------

const node = (id: string, x: number, y: number, extra = '') => {
  const q = QUESTS.find((n) => n.id === id)!;
  return `<div class="qb-node ${q.id === 'saltmere-shoals' ? 'on' : ''} ${q.dim ? 'dim' : ''}" style="left:${x}px;top:${y}px">
    <span class="qb-face">${q.giver ? face(q.giver, 46) : '<i>⚓</i>'}</span>
    <div><b>${q.name}</b><small>${extra}</small>
    <span class="qb-pips">${'<i></i>'.repeat(Math.min(q.steps, 6))}${q.steps > 6 ? '…' : ''}</span></div>
    ${q.tag ? `<em class="qb-tag ${q.tag}">${q.tag}</em>` : ''}
  </div>`;
};

const story = () => `
  <section class="qb-story">
    <svg class="qb-links" viewBox="0 0 900 640">
      <path d="M 160 320 L 184 320" />
      ${[95, 245, 395, 545]
        .map((y) => `<path d="M 344 320 C 358 320 354 ${y} 368 ${y}" /><path d="M 528 ${y} C 542 ${y} 538 320 552 320" />`)
        .join('')}
    </svg>
    ${node('first-voyage', 0, 285, 'tutorial · own lesson format')}
    ${node('rooks-thanks', 184, 285, 'home · pays Skerry')}
    ${node('saltmere-shoals', 368, 60, 'Kit · Saltmere · spot-3')}
    ${node('calda-slipway', 368, 210, 'Ines · Calda · spot-1')}
    ${node('westholm-mill', 368, 360, 'Maren · Westholm · spot-2')}
    ${node('stonehaven-light', 368, 510, 'Ada · Stonehaven · spot-4')}
    <div class="qb-end">${node('fair-winds', 0, 0, 'all four done · 200')}</div>
    <p class="qb-legend">A line is a <b>start</b> condition: the quest on the right starts once the one on the left is done. Drag from a quest’s edge to another to link them.</p>
  </section>`;

const questPanel = () => `
  <div class="qb-scroll">
    <h2>Quest <small>saltmere-shoals.json</small></h2>
    ${row('Id', '<input value="saltmere-shoals" disabled />')}
    ${row('Name', '<input value="Where the shoals went" />')}
    ${row('Giver', sel('Kit Marlow · Fisher'))}
    ${row('Card at', sel('Saltmere'))}
    ${row('Asks first', '<span><input type="checkbox" checked /> offer: “I’ll bring it / Not now”</span>')}
    ${row('Main', '<span><input type="checkbox" /> story spine: arrival card</span>')}
    <div class="qb-cond">
      <div class="qb-cond-head"><span class="qb-k">Starts when</span>
      <select class="qb-kind"><option>quest-done · a quest is finished</option></select></div>
      ${row('Quest', sel('Rook’s thanks'))}
    </div>
    <h2>Quest cargo</h2>
    <div class="ed-chips"><span class="ed-chip">catch · 1 space <button>✕</button></span><select><option>+ item</option></select></div>
    <h2>Pays when done</h2>
    ${row('Gold', num('—'))}
    ${row('Spot', '<span class="ed-chips"><span class="ed-chip">Skerry · spot-3 <button>✕</button></span></span>')}
    ${row('Level up', '<span class="ed-chips"><select><option>+ port</option></select></span>')}
    ${row('Standing', '<span class="ed-chips"><select><option>+ port</option></select></span>')}
  </div>
  ${checks(false)}`;

// --- Test-play dialog -------------------------------------------------------------------------

const playDialog = () => `
  <div class="qb-veil"></div>
  <div class="qb-dialog">
    <h2>Play from a step</h2>
    <p class="ed-note">Opens the game in a new tab on this map and these quests. Your own voyage is
    not touched (it plays in the editor’s own save, like “Play this map”).</p>
    <div class="qb-pick">
      ${STEPS.map(
        (s) => `<label class="${s.no === 3 ? 'on' : ''}"><input type="radio" name="s" ${s.no === 3 ? 'checked' : ''}/> <b>${s.no}</b> ${s.title}</label>`,
      ).join('')}
      <label><input type="radio" name="s" /> <b>✓</b> Kit’s thanks (quest done: see what changes after)</label>
    </div>
    <h3>Set up for step 3</h3>
    <ul class="qb-setup">
      <li>✓ Rook’s thanks done, Skerry is yours</li>
      <li>✓ Steps 1 and 2 done, their 250 paid</li>
      <li>✓ Docked at Saltmere, 6 catch aboard: the run starts as you leave</li>
    </ul>
    ${row('Ship', sel('Fluyt (level 2)'))}
    ${row('Difficulty', seg(['Fair', 'Captain', 'Salt'], 1))}
    ${row('Time', seg(['day', 'night'], 0))}
    ${row('Wind', sel('the map’s (from NE · 14 kn)'))}
    <div class="qb-bar-demo">
      <span class="qb-k">In the game</span>
      <div class="qb-testbar">QUEST TEST · Where the shoals went · 3/3 catch · 0:42 / 1:50
        <button>↺ step</button><button>⏭ skip</button><button>✕</button></div>
    </div>
    <div class="ed-buttons qb-right"><button>Cancel</button><button class="primary">▶ Play</button></div>
  </div>`;

// --- Views ----------------------------------------------------------------------------------

const desk = (left: string, centre: string, right: string, crumb = 'Where the shoals went › 2 · channel') => `
  ${top(crumb)}
  <main class="qb-main">
    <aside class="qb-left">${modeTabs('Quests')}${left}</aside>
    ${centre}
    <aside class="ed-panel qb-panel">${right}</aside>
  </main>`;

const HINT =
  'Drag a ring to move it, its edge to size it · ◎ adds a gate · faded: the quest’s other steps';

if (view === 'steps' || view === 'play') {
  app.innerHTML = desk(
    questList() + stepList('channel'),
    `<div class="qb-centre">${tools()}${chartBox(HINT)}</div>`,
    goalPanel(),
  );
  if (view === 'play') app.insertAdjacentHTML('beforeend', playDialog());
  chart(app, 190, 0, 0.36);
} else if (view === 'card') {
  app.innerHTML = desk(
    questList() + stepList('channel'),
    `<section class="qb-preview">
      <div class="ed-toggles qb-pv-toggles">
        <span class="qb-seg"><button aria-pressed="true">Quay tab</button><button>At sea note</button></span>
        <span class="qb-seg"><button aria-pressed="true">EN</button><button>FR</button></span>
        <span class="qb-seg"><button aria-pressed="true">Mood as set</button><button>All three</button></span>
      </div>
      <div class="qb-card-host">${card(EN)}</div>
      ${textTable()}
    </section>`,
    cardPanel(),
  );
} else if (view === 'story') {
  app.innerHTML = `
    ${top('Story')}
    <main class="qb-main">
      <aside class="qb-left">${modeTabs('Quests')}${questList()}</aside>
      ${story()}
      <aside class="ed-panel qb-panel">${questPanel()}</aside>
    </main>`;
} else if (view === 'sea') {
  // Phone landscape: steps rail, chart, one panel.
  app.innerHTML = `
    ${top('Shoals › 1 · gulls')}
    <main class="qb-main qb-land">
      <aside class="qb-rail">${STEPS.map((s) => `<button aria-pressed="${s.no === 1}">${s.no}</button>`).join('')}<button>+</button><button>◷</button></aside>
      <div class="qb-centre">${chartBox('', ['All steps'])}</div>
      <aside class="ed-panel qb-panel">${seaPanel()}</aside>
    </main>`;
  chart(app, 180, 20, 0.45, { step: 1 });
} else if (view === 'portrait' || view === 'portrait-card') {
  const isCard = view === 'portrait-card';
  app.innerHTML = `
    ${top('Shoals › 2')}
    <div class="qb-pickers">${sel('Where the shoals went')}${sel('2 · Sail through the reef gap')}</div>
    ${
      isCard
        ? `<section class="qb-preview qb-port-card"><div class="qb-card-host">${card(FR)}</div></section>`
        : `<div class="qb-centre qb-port-chart">${chartBox('', ['All steps'])}</div>`
    }
    <aside class="ed-panel qb-panel qb-port-panel">${isCard ? cardPanel() : goalPanel()}</aside>`;
  if (!isCard) chart(app, 175, 15, 0.62);
}

// The card's icons live in the game's inline sprite (index.html).
fetch('../../../index.html')
  .then((r) => r.text())
  .then((html) => {
    const start = html.indexOf('<svg class="icon-sprite"');
    if (start < 0) return;
    // The sprite holds nested svgs: take everything up to its closing tag by counting.
    let depth = 0;
    const re = /<svg\b|<\/svg>/g;
    re.lastIndex = start;
    let end = start;
    for (let k = re.exec(html); k; k = re.exec(html)) {
      depth += k[0] === '</svg>' ? -1 : 1;
      if (depth === 0) {
        end = k.index + 6;
        break;
      }
    }
    document.body.insertAdjacentHTML('afterbegin', html.slice(start, end));
  });
