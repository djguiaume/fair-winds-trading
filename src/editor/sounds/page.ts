import { AUDIO, RING, SYNTH_EFFECTS, type AudioData, audioProblems } from '../../audio/catalog';
import { DESK_SEA, type DeskSea, LiveSea, playEffect, renderJob } from '../../audio/desk';
import { formatQuestJson } from '../../data/jsonFormat';
import { History } from '../model';
import { h, numberInput, row, select } from '../quest/form';
import './sounds.css';

/**
 * The Sounds page of the editors (decision 0209): everything in `src/data/audio.json` but the
 * people's voices (the quest builder has those), each sound with a play button: the effects and
 * their pitch, each sea's bed and calls (listened to live with the boat's wind, speed and
 * luffing), the boat's own sounds, what the game plays on its events, a bell per port, and the
 * music. Same checks as `npm run check -- --only audio`; `npm run sound` renders the same sounds
 * to files. The working copy stays in this browser; Export gives the file to commit.
 */

const EDITED_KEY = 'fwt.editedAudio';
const SEAS = Object.keys(AUDIO.seas);
type Section = 'effects' | 'boat' | 'events' | 'music' | `sea:${string}`;
const SECTIONS: [Section, string][] = [
  ['effects', 'Effects'],
  ...SEAS.map((s): [Section, string] => [`sea:${s}`, s === RING ? 'Sea: the ring' : `Sea: ${s}`]),
  ['boat', 'The boat'],
  ['events', 'Events and bells'],
  ['music', 'Music'],
];

let root: HTMLElement;
let onClose = () => {};
let open = false;
let section: Section = 'effects';
let doc: AudioData = loadDoc();
const history = new History<AudioData>();
const text = (d: AudioData) => formatQuestJson(d);
const shipped = () => structuredClone(AUDIO);

let ctx: AudioContext | null = null;
let live: LiveSea | null = null;
let liveSea = '';
const listen: DeskSea = structuredClone(DESK_SEA);
let tune: AudioBufferSourceNode | null = null;

function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function loadDoc(): AudioData {
  try {
    const saved = JSON.parse(localStorage.getItem(EDITED_KEY) ?? 'null') as AudioData | null;
    if (saved && saved.effects && saved.seas) return saved;
  } catch {
    /* Nothing saved, or private mode. */
  }
  return shipped();
}

export const soundsOpen = () => open;

export function setupSoundsPage(close: () => void) {
  onClose = close;
  root = document.getElementById('sd')!;
  root.innerHTML = `
    <header class="ed-top">
      <h1>Sounds</h1>
      <span class="ed-file">src/data/audio.json <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="stop" title="Stop every sound">■ Stop</button>
        <button data-act="reset" title="Back to the sounds shipped with the game">Reset</button>
        <button data-act="export" class="primary">Export audio.json</button>
      </nav>
    </header>
    <main class="cp-main">
      <nav class="cp-sections"></nav>
      <section class="cp-form"></section>
      <aside class="cp-side"><h2>Checks</h2><ul class="ed-checks cp-checks"></ul>
        <p class="ed-note">npm run sound -- sea north (or effect, music, tour) records these to files.</p></aside>
    </main>`;
  const acts: Record<string, () => void> = {
    back: closePage,
    undo,
    redo,
    stop: stopAll,
    reset,
    export: exportDoc,
  };
  root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act) acts[act]?.();
  });
}

export function openSounds() {
  open = true;
  document.getElementById('ed-top')!.hidden = true;
  document.getElementById('ed-main')!.hidden = true;
  root.hidden = false;
  render();
}

function closePage() {
  stopAll();
  open = false;
  root.hidden = true;
  document.getElementById('ed-top')!.hidden = false;
  document.getElementById('ed-main')!.hidden = false;
  onClose();
}

// --- Edits ------------------------------------------------------------------------------------

function edit(change: () => void) {
  history.record(doc);
  change();
  commit();
}

function commit() {
  const edited = text(doc) !== text(shipped());
  try {
    if (edited) localStorage.setItem(EDITED_KEY, JSON.stringify(doc));
    else localStorage.removeItem(EDITED_KEY);
  } catch {
    /* Private mode: the edits last while the page is open. */
  }
  live?.update(doc, liveSea, listen);
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
  if (!confirm('Throw away every sound edit and go back to the shipped file?')) return;
  history.record(doc);
  doc = shipped();
  commit();
}

function exportDoc() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text(doc)], { type: 'application/json' }));
  a.download = 'audio.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener('keydown', (e) => {
  if (!open) return;
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (e.key === 'Escape') closePage();
});

// --- Listening --------------------------------------------------------------------------------

function stopAll() {
  live?.stop();
  live = null;
  liveSea = '';
  tune?.stop();
  tune = null;
  if (open) render();
}

function play(id: string, pitch = 1) {
  const c = audio();
  playEffect(c, c.destination, doc, id, 1, pitch);
}

function playButton(onClick: () => void, title = 'Play') {
  const b = h('button', { type: 'button', class: 'sd-play', title }, '▶');
  b.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });
  return b;
}

async function playMusic(track: string) {
  stopAll();
  const c = audio();
  const samples = await renderJob(doc, { kind: 'music', track, secs: 40, seed: Date.now() % 1000 });
  const buffer = c.createBuffer(1, samples.length, 44100);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  tune = c.createBufferSource();
  tune.buffer = buffer;
  tune.connect(c.destination);
  tune.start();
}

// --- Drawing ----------------------------------------------------------------------------------

function render() {
  root.querySelector<HTMLElement>('.cp-edited')!.hidden = text(doc) === text(shipped());
  root.querySelector('.cp-sections')!.replaceChildren(
    ...SECTIONS.map(([id, label]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(id === section) }, label);
      b.addEventListener('click', () => {
        section = id;
        render();
      });
      return b;
    }),
  );
  root.querySelector('.cp-form')!.replaceChildren(...drawSection());
  const problems = audioProblems(undefined, doc);
  root
    .querySelector('.cp-checks')!
    .replaceChildren(
      ...(problems.length
        ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
        : [h('li', { class: 'ok' }, '✓ The sound list passes every check')]),
    );
}

function drawSection(): HTMLElement[] {
  if (section === 'effects') return drawEffects();
  if (section === 'boat') return drawBoat();
  if (section === 'events') return drawEvents();
  if (section === 'music') return drawMusic();
  return drawSea(section.slice('sea:'.length));
}

function heading(title: string, about = '') {
  return h('div', { class: 'cp-head' }, h('h2', {}, title), about ? h('p', {}, about) : '');
}

const num = (value: number | undefined, set: (v: number) => void, placeholder = '') =>
  numberInput(value, (v) => v !== undefined && edit(() => set(v)), placeholder);

function drawEffects(): HTMLElement[] {
  const out = [
    heading(
      'Effects',
      'Every effect is a synthesiser of the game played at a volume and a pitch (2 = an octave up): one bell rings at every port, a gull pitched up is a tern. A new synthesiser needs code once (src/audio/sfx.ts).',
    ),
  ];
  const grid = h('div', { class: 'sd-grid' }, h('b', {}, 'effect'), h('b', {}, 'synth'));
  grid.append(h('b', {}, 'volume'), h('b', {}, 'pitch'), h('span'));
  for (const [id, effect] of Object.entries(doc.effects)) {
    grid.append(h('code', {}, id));
    if ('synth' in effect) {
      grid.append(
        select([...SYNTH_EFFECTS], effect.synth, (v) =>
          edit(() => ((effect as { synth: string }).synth = v)),
        ),
      );
    } else grid.append(h('span', {}, effect.file));
    grid.append(num(effect.volume, (v) => (effect.volume = v), '1'));
    grid.append(
      numberInput(
        effect.pitch,
        (v) => edit(() => (v === undefined || v === 1 ? delete effect.pitch : (effect.pitch = v))),
        '1',
      ),
    );
    grid.append(playButton(() => play(id)));
  }
  out.push(grid);
  return out;
}

function listenPanel(sea: string): HTMLElement {
  const here = listen.here;
  const box = h('div', { class: 'sd-listen' });
  const playing = live && liveSea === sea;
  const go = h('button', { type: 'button', class: 'primary' }, playing ? '■ Stop' : '▶ Listen');
  go.addEventListener('click', () => {
    if (playing) return stopAll();
    stopAll();
    live = new LiveSea(audio(), doc, sea, listen);
    liveSea = sea;
    render();
  });
  const slider = (label: string, value: number, max: number, set: (v: number) => void) => {
    const input = h('input', { type: 'range', min: '0', max: String(max), step: '1' });
    input.value = String(value);
    const out = h('output', {}, String(value));
    input.addEventListener('input', () => {
      set(Number(input.value));
      out.textContent = input.value;
      live?.update(doc, liveSea, listen);
    });
    return h('label', { class: 'sd-slider' }, h('span', {}, label), input, out);
  };
  const tick = (label: string, value: boolean, set: (v: boolean) => void) => {
    const box = h('input', { type: 'checkbox' });
    box.checked = value;
    box.addEventListener('change', () => {
      set(box.checked);
      live?.update(doc, liveSea, listen);
    });
    return h('label', { class: 'sd-tick' }, box, ` ${label}`);
  };
  box.append(
    go,
    slider('wind kn', here.windKn, 35, (v) => (here.windKn = v)),
    slider('speed kn', here.speedKn, 12, (v) => (here.speedKn = v)),
    slider('rain %', Math.round(here.rain * 100), 100, (v) => (here.rain = v / 100)),
    tick('luffing in irons', here.luffing, (v) => (here.luffing = v)),
    tick('docked', here.docked, (v) => (here.docked = v)),
    tick('every place near', listen.near, (v) => (listen.near = v)),
    tick('storm', listen.storm, (v) => (listen.storm = v)),
  );
  return box;
}

/** A JSON field for a list the form does not draw field by field (calls, calm places). */
function jsonField(value: unknown, set: (v: unknown) => void): HTMLTextAreaElement {
  const area = h('textarea', { class: 'sd-json', spellcheck: 'false', rows: '8' });
  area.value = JSON.stringify(value ?? [], null, 1);
  area.addEventListener('change', () => {
    try {
      const v: unknown = JSON.parse(area.value);
      edit(() => set(v));
    } catch {
      area.classList.add('sd-bad');
    }
  });
  return area;
}

function drawSea(sea: string): HTMLElement[] {
  const bed = doc.seas[sea];
  if (!bed) return [heading(sea, 'No bed for this sea.')];
  const calls = h('div', { class: 'sd-calls' });
  for (const call of bed.calls ?? [])
    calls.append(
      h(
        'span',
        {},
        playButton(() => play(call.effect), `Play ${call.effect}`),
        ` ${call.effect} every ${call.every[0]}–${call.every[1]} s`,
        call.near ? ` near ${placeText(call.near)}` : '',
        call.away ? ` away from ${placeText(call.away)}` : '',
        call.when ? ` when ${call.when}` : '',
      ),
    );
  return [
    heading(
      sea === RING ? 'The ring' : `The ${sea} sea`,
      'Its waves and wind (tone is the filter in Hz: lower is duller), its theme, and the calls heard now and then. Listen with the boat’s wind, speed and luffing.',
    ),
    listenPanel(sea),
    row(
      'music',
      select(Object.keys(doc.music), bed.music, (v) =>
        edit(() => (v ? (bed.music = v) : delete bed.music)),
      ),
    ),
    row(
      'waves level',
      num(bed.waves.level, (v) => (bed.waves.level = v)),
    ),
    row(
      'waves tone',
      num(bed.waves.tone, (v) => (bed.waves.tone = v)),
    ),
    row(
      'swell s',
      num(bed.waves.swellSec, (v) => (bed.waves.swellSec = v)),
    ),
    row(
      'wind level',
      num(bed.wind.level, (v) => (bed.wind.level = v)),
    ),
    row(
      'wind tone',
      num(bed.wind.tone, (v) => (bed.wind.tone = v)),
    ),
    h('h3', {}, 'Calls'),
    calls,
    jsonField(bed.calls, (v) => (bed.calls = v as typeof bed.calls)),
    h('h3', {}, 'Calm water'),
    h(
      'p',
      { class: 'ed-note' },
      'Inside `within` times an island’s radius the waves are `waves` times as loud (a lagoon).',
    ),
    jsonField(bed.calm, (v) =>
      Array.isArray(v) && v.length ? (bed.calm = v as typeof bed.calm) : delete bed.calm,
    ),
  ];
}

function placeText(p: {
  islands?: string[] | 'any';
  bergs?: boolean;
  vents?: boolean;
  range: number;
}) {
  const what = p.islands
    ? p.islands === 'any'
      ? 'any island'
      : p.islands.join(', ')
    : p.bergs
      ? 'icebergs'
      : p.vents
        ? 'steam vents'
        : 'reefs';
  return `${what} (${p.range})`;
}

function drawBoat(): HTMLElement[] {
  const { wash, luff, rain } = doc.boat;
  return [
    heading(
      'The boat',
      'Her own sounds in every sea: the wash along the hull (full at fullKn), the sails luffing in irons (rate: flutters a second), rain on deck.',
    ),
    listenPanel(RING),
    row(
      'wash level',
      num(wash.level, (v) => (wash.level = v)),
    ),
    row(
      'wash tone',
      num(wash.tone, (v) => (wash.tone = v)),
    ),
    row(
      'wash full kn',
      num(wash.fullKn, (v) => (wash.fullKn = v)),
    ),
    row(
      'luff level',
      num(luff.level, (v) => (luff.level = v)),
    ),
    row(
      'luff tone',
      num(luff.tone, (v) => (luff.tone = v)),
    ),
    row(
      'luff rate',
      num(luff.rate, (v) => (luff.rate = v)),
    ),
    row(
      'rain level',
      num(rain.level, (v) => (rain.level = v)),
    ),
    row(
      'rain tone',
      num(rain.tone, (v) => (rain.tone = v)),
    ),
  ];
}

function drawEvents(): HTMLElement[] {
  const ev = doc.events;
  const effects = Object.keys(doc.effects);
  const pick = (name: keyof typeof ev) =>
    row(
      name,
      select(effects, ev[name].effect, (v) => edit(() => (ev[name].effect = v))),
      playButton(() => play(ev[name].effect)),
    );
  const bells = h('div', { class: 'sd-grid sd-bells' });
  for (const [port, pitch] of Object.entries(ev.dock.pitch ?? {}))
    bells.append(
      h('code', {}, port),
      num(pitch, (v) => (ev.dock.pitch![port] = v)),
      playButton(() => play(ev.dock.effect, pitch)),
    );
  return [
    heading(
      'Events and bells',
      'What the game plays when she docks, crashes, bumps, tacks or gybes, and when a volcano erupts within range. The dock bell rings at each port’s pitch: big towns lower, outposts a handbell.',
    ),
    pick('dock'),
    pick('crash'),
    pick('bump'),
    pick('tack'),
    pick('eruption'),
    row(
      'eruption range',
      num(ev.eruption.range, (v) => (ev.eruption.range = v)),
    ),
    h('h3', {}, 'Bells by port'),
    bells,
  ];
}

function drawMusic(): HTMLElement[] {
  const rows = Object.entries(doc.music).map(([id, track]) =>
    row(
      id,
      h('span', {}, 'theme' in track ? `src/data/music/${track.theme}.json` : track.file),
      'theme' in track ? playButton(() => void playMusic(id), 'Play 40 s') : '',
    ),
  );
  return [
    heading(
      'Music',
      'One variation of Fair Winds per sea (the sea bed picks it) and the regatta’s, which a quest step holds with `music`. A theme is a file in src/data/music/; ■ Stop ends a tune.',
    ),
    ...rows,
  ];
}
