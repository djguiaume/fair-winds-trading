import './tune.css';
import { strToU8, zipSync } from 'fflate';
import { SHIPPED_TUNING, TUNING } from '../data/tuning';
import {
  ID_COLLECTIONS,
  type NumberMeta,
  TUNING_GROUPS,
  TUNING_META,
  metaPath,
} from '../data/tuning-meta';
import {
  type TuneChanges,
  applyChanges,
  changedFiles,
  currentChanges,
  liveValue,
  saveTuneChanges,
  setTuneValue,
  shippedValue,
  snapToMeta,
  tuneLink,
} from '../data/tuningEdits';
import { type BalanceCheck, levelName } from '../sim/balance';
import { topSpeedKn } from '../sim/boat';
import { DEG } from '../sim/math';
import type { SaveStorage } from '../sim/save';
import { type ShipClass, polarFraction } from '../sim/ship';
import { activeShip } from '../sim/trade';
import { stockLevels } from '../sim/upgrades';
import type { World } from '../sim/world';
import { qrSvg } from '../ui/qr';
import { BalanceRunner, type BalanceState } from './balanceCheck';

/**
 * The `?tune` panel (decision 0114): every number of `src/data/tuning/*.json` and of the
 * `sailing` and `unlock` parts of `src/data/ships/*.json` on a slider, applied to the live
 * `TUNING` while you sail. Built from `tuning-meta.ts`, so a value added there shows up here with
 * no UI code. Edits stay in this browser; Export rebuilds the changed files, Share packs them in
 * a link and QR code, and the balance check runs the economy simulation on them in a worker.
 * A testing tool in English, loaded only with `?tune`: players never download it.
 */

export interface TuneHost {
  world: World;
  /** The browser's own storage: the edit set lives there, apart from the tune voyage. */
  storage: SaveStorage | null;
  gameUrl: () => string;
  /** Start a fresh tune voyage (start gold and town numbers only show on a new one). */
  newVoyage: () => void;
}

type Group = keyof typeof TUNING_GROUPS;
type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const UI_KEY = 'fwt.tune.ui.v1';
const SVG = 'http://www.w3.org/2000/svg';

/** Section titles for nested groups; anything else is its key in words. */
const SECTION_NAMES: Record<string, string> = {
  'upgrades.effects': 'Upgrade effects',
  'upgrades.homePortLevel': 'Home port level for upgrades',
  'economy.market': 'Markets',
  'economy.market.equilibrium': 'Stock a market settles at',
  'economy.towns': 'Towns',
  'economy.orders': 'Delivery orders',
  'difficulty.levels': 'Level',
  'difficulty.steadyWind': 'Steady trade wind (Wind: steady)',
  'weather.default': 'Map weather',
  'weather.default.regions': 'Wind regions',
  'weather.default.kinds': 'Weather kind',
  'weather.default.storms': 'Storms on the map',
  'weather.storms': 'Storm wind',
  'weather.islands': 'Island lee and channels',
  'weather.force': 'Wind force',
  'weather.daylight': 'Day and night',
  'seamanship.boat': 'Boat',
  'seamanship.hazards': 'Reefs, shallows and crashes',
  'seamanship.harbour': 'Harbours',
  'seamanship.cargo': 'Cargo in a blow',
  'seamanship.boundaryBuoys': 'Boundary buoys',
};
const words = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const fmt = (v: number) => String(Number(v.toFixed(4)));

/** A row of the body that can redraw itself after an edit elsewhere (reset all, a shared link). */
interface Row {
  refresh(): void;
}

export class TunePanel {
  private readonly root = el('aside', 'tune');
  private readonly pill = button('tune-pill', 'Tuning', () => this.setOpen(true));
  private readonly countEl = el('span', 'tune-count');
  private readonly tabs = el('nav', 'tune-tabs');
  private readonly body = el('div', 'tune-body');
  private readonly balanceEl = el('section', 'tune-balance');
  private readonly sheet = el('div', 'tune-sheet');
  private rows: Row[] = [];
  private tab: Group = 'ships';
  private picks: Record<string, string> = {};
  private open = true;
  private balanceOpen = false;
  private saveTimer = 0;
  private readonly balance: BalanceRunner;
  private polar: (() => void) | null = null;

  constructor(private readonly host: TuneHost) {
    this.loadUi();
    this.balance = new BalanceRunner((s) => this.renderBalance(s));
    this.build();
    this.renderTab();
    this.updateCount();
    this.setOpen(this.open);
    this.balance.run(currentChanges());
  }

  // --- Frame ---------------------------------------------------------------------------------

  private build() {
    const head = el('header', 'tune-head');
    head.append(
      el('b', 'tune-title', 'Tuning'),
      el('span', 'tune-live', 'Live'),
      this.countEl,
      button('tune-hide', 'Hide', () => this.setOpen(false)),
    );
    const note = el(
      'div',
      'tune-note',
      'Edits stay in this browser, on a test voyage. Tap a name for help.',
    );
    for (const [group, name] of Object.entries(TUNING_GROUPS)) {
      const b = button('tune-tab', name, () => {
        this.tab = group as Group;
        this.saveUi();
        this.renderTab();
      });
      b.dataset.group = group;
      this.tabs.append(b);
    }
    const foot = el('footer', 'tune-foot');
    foot.append(
      button('tune-btn', 'Reset all', () => this.resetAll()),
      button('tune-btn', 'New voyage', () => {
        if (window.confirm('Start a new test voyage? Your tuning stays.')) this.host.newVoyage();
      }),
      button('tune-btn', 'Share', () => this.showShare()),
      button('tune-btn tune-primary', 'Export', () => this.showExport()),
    );
    this.sheet.hidden = true;
    this.balanceEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.tune-balance-head')) {
        this.balanceOpen = !this.balanceOpen;
        this.renderBalance(this.balance.state);
      }
    });
    this.root.append(head, note, this.tabs, this.body, this.balanceEl, foot, this.sheet);
    // Arrow keys on a slider must not steer the boat (the game listens on window).
    for (const type of ['keydown', 'keyup'] as const)
      this.root.addEventListener(type, (e) => e.stopPropagation());
    document.body.append(this.root, this.pill);
  }

  private setOpen(open: boolean) {
    this.open = open;
    this.root.hidden = !open;
    this.pill.hidden = open;
    this.saveUi();
  }

  private loadUi() {
    try {
      const ui = JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') as {
        tab?: string;
        open?: boolean;
        picks?: Record<string, string>;
      };
      if (ui.tab && ui.tab in TUNING_GROUPS) this.tab = ui.tab as Group;
      if (typeof ui.open === 'boolean') this.open = ui.open;
      if (isTree(ui.picks)) this.picks = ui.picks;
    } catch {
      // Defaults.
    }
  }

  private saveUi() {
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({ tab: this.tab, open: this.open, picks: this.picks }),
      );
    } catch {
      // Not kept: fine.
    }
  }

  /** After any edit: count, outlines, polar, storage and a new balance run. */
  private changed() {
    for (const r of this.rows) r.refresh();
    this.polar?.();
    this.updateCount();
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(
      () => saveTuneChanges(this.host.storage, currentChanges()),
      300,
    );
    this.balance.schedule(currentChanges());
  }

  private updateCount() {
    const changes = currentChanges();
    const n = Object.keys(changes).length;
    this.countEl.textContent = n === 0 ? 'shipped values' : `${n} change${n > 1 ? 's' : ''}`;
    this.countEl.classList.toggle('tune-has-changes', n > 0);
    this.pill.textContent = n === 0 ? 'Tuning' : `Tuning · ${n}`;
    const groups = new Set(Object.keys(changes).map((k) => k.split('.')[0]));
    for (const b of this.tabs.querySelectorAll<HTMLButtonElement>('.tune-tab')) {
      b.classList.toggle('tune-on', b.dataset.group === this.tab);
      b.classList.toggle('tune-dot', groups.has(b.dataset.group));
    }
  }

  // --- Body ----------------------------------------------------------------------------------

  private renderTab() {
    this.rows = [];
    this.polar = null;
    this.body.replaceChildren();
    this.renderNode(this.body, [this.tab], TUNING[this.tab]);
    this.body.scrollTop = 0;
    this.updateCount();
  }

  private renderNode(parent: HTMLElement, path: string[], value: unknown) {
    if (!isTree(value)) return this.renderLeaf(parent, path);
    const key = path.join('.');
    const entries = Object.entries(value);
    // A collection of things (ships, goods, levels, weather kinds): pick one, show its values.
    if (ID_COLLECTIONS.includes(key) && entries.every(([, v]) => isTree(v))) {
      const ids = entries.map(([id]) => id);
      const id = ids.includes(this.picks[key] ?? '') ? this.picks[key]! : ids[0]!;
      parent.append(this.picker(key, ids, id));
      if (key === 'ships') parent.append(this.shipCard(id));
      this.renderNode(parent, [...path, id], value[id]);
      return;
    }
    for (const [k, v] of entries) {
      const child = [...path, k];
      const childKey = child.join('.');
      const leafCollection =
        ID_COLLECTIONS.includes(childKey) && isTree(v) && Object.values(v).every((x) => !isTree(x));
      if (isTree(v) && !leafCollection) {
        const section = el('section', 'tune-section');
        section.append(el('h3', 'tune-h', SECTION_NAMES[childKey] ?? words(k)));
        parent.append(section);
        this.renderNode(section, child, v);
      } else if (isTree(v)) {
        for (const id of Object.keys(v)) this.renderLeaf(parent, [...child, id]);
      } else this.renderLeaf(parent, child);
    }
  }

  private picker(key: string, ids: string[], current: string) {
    const row = el('label', 'tune-picker');
    row.append(el('span', '', SECTION_NAMES[key] ?? words(key.split('.').pop()!)));
    const select = el('select', 'tune-select');
    const changes = Object.keys(currentChanges());
    for (const id of ids) {
      const o = el('option', '', this.itemName(key, id));
      o.value = id;
      if (changes.some((c) => c.startsWith(`${key}.${id}.`))) o.textContent += ' •';
      select.append(o);
    }
    select.value = current;
    select.addEventListener('change', () => {
      this.picks[key] = select.value;
      this.saveUi();
      this.renderTab();
    });
    row.append(select);
    return row;
  }

  private itemName(collection: string, id: string): string {
    const item = liveValue([...collection.split('.'), id]) as Tree | undefined;
    if (collection === 'goods') return `${String(item?.icon ?? '')} ${String(item?.name ?? id)}`;
    if (collection === 'ships') return `${String(item?.name ?? id)} · ${String(item?.line)}`;
    return typeof item?.name === 'string' ? item.name : words(id);
  }

  private renderLeaf(parent: HTMLElement, path: string[]) {
    const meta = TUNING_META[metaPath(path)];
    if (!meta || meta.kind === 'text' || meta.kind === 'polar') return;
    const parentKey = path.slice(0, -1).join('.');
    const suffix = ID_COLLECTIONS.includes(parentKey) ? ` ${path[path.length - 1]}` : '';
    if (meta.kind === 'toggle') {
      parent.append(this.toggleRow(path, meta.label + suffix, meta.help));
      return;
    }
    const value = liveValue(path);
    if (Array.isArray(value))
      value.forEach((_, i) =>
        parent.append(this.numberRow(path, i, `${meta.label}${suffix} · ${i + 1}`, meta)),
      );
    else parent.append(this.numberRow(path, null, meta.label + suffix, meta));
  }

  private rowFrame(label: string, help: string, unit?: string) {
    const row = el('div', 'tune-row');
    const name = button('tune-label', label, () => (helpEl.hidden = !helpEl.hidden));
    if (unit) name.append(el('small', '', ` ${unit}`));
    const reset = el('button', 'tune-reset', '↺');
    reset.type = 'button';
    reset.title = 'Back to the shipped value';
    const helpEl = el('div', 'tune-help', help);
    helpEl.hidden = true;
    row.append(name);
    return { row, reset, helpEl };
  }

  private numberRow(path: string[], index: number | null, label: string, meta: NumberMeta) {
    const { row, reset, helpEl } = this.rowFrame(label, meta.help, meta.unit);
    const read = (tree: 'live' | 'shipped') => {
      const v = tree === 'live' ? liveValue(path) : shippedValue(path);
      return (index === null ? v : (v as number[])[index]) as number;
    };
    const range = el('input', 'tune-range');
    Object.assign(range, { type: 'range', min: meta.min, max: meta.max, step: meta.step });
    const box = el('input', 'tune-number');
    Object.assign(box, { type: 'number', min: meta.min, max: meta.max, step: meta.step });
    box.inputMode = 'decimal';
    const shippedNote = el('span', 'tune-shipped');
    helpEl.append(shippedNote);
    const commit = (raw: number) => {
      if (!Number.isFinite(raw)) return;
      const v = snapToMeta(meta, raw);
      if (index === null) setTuneValue(path, v);
      else {
        const arr = [...(liveValue(path) as number[])];
        arr[index] = v;
        setTuneValue(path, arr);
      }
      this.changed();
    };
    range.addEventListener('input', () => commit(Number(range.value)));
    box.addEventListener('change', () => commit(Number(box.value)));
    reset.addEventListener('click', () => commit(read('shipped')));
    row.append(range, box, reset, helpEl);
    const refresh = () => {
      const live = read('live');
      const shipped = read('shipped');
      range.value = String(live);
      if (document.activeElement !== box) box.value = fmt(live);
      const changed = live !== shipped;
      row.classList.toggle('tune-changed', changed);
      reset.hidden = !changed;
      shippedNote.textContent = ` Shipped: ${fmt(shipped)}${meta.unit ? ` ${meta.unit}` : ''}.`;
    };
    refresh();
    this.rows.push({ refresh });
    return row;
  }

  private toggleRow(path: string[], label: string, help: string) {
    const { row, reset, helpEl } = this.rowFrame(label, help);
    const box = el('input', 'tune-check');
    box.type = 'checkbox';
    box.addEventListener('change', () => {
      setTuneValue(path, box.checked);
      this.changed();
    });
    reset.addEventListener('click', () => {
      setTuneValue(path, shippedValue(path));
      this.changed();
    });
    row.append(box, reset, helpEl);
    const refresh = () => {
      box.checked = liveValue(path) === true;
      const changed = !same(liveValue(path), shippedValue(path));
      row.classList.toggle('tune-changed', changed);
      reset.hidden = !changed;
    };
    refresh();
    this.rows.push({ refresh });
    return row;
  }

  // --- Ships: polar, top speed, sail this ship -----------------------------------------------

  private shipCard(id: string) {
    const card = el('div', 'tune-ship');
    const svg = svgEl('svg', { viewBox: '-14 -112 128 224', class: 'tune-polar' });
    const stats = el('div', 'tune-ship-stats');
    const sail = button('tune-btn tune-sail', 'Sail this ship', () => {
      const { trade } = this.host.world;
      trade.captain.ships[id] ??= stockLevels();
      trade.captain.activeShip = id;
      this.host.world.ship = activeShip(trade);
      this.polar?.();
    });
    card.append(svg, stats);
    const R = 100;
    const xy = (deg: number, f: number) => [
      f * R * Math.sin(deg * DEG),
      -f * R * Math.cos(deg * DEG),
    ];
    const curve = (ship: ShipClass) => {
      const pts: string[] = [];
      for (let a = 0; a <= 180; a += 2) {
        const [x, y] = xy(a, polarFraction(ship, a * DEG));
        pts.push(`${x!.toFixed(1)},${y!.toFixed(1)}`);
      }
      return pts.join(' ');
    };
    const best = (ship: ShipClass) =>
      ship.polar.reduce((b, p) => (p[1] > b[1] ? p : b), ship.polar[0]!);
    const top = (ship: ShipClass) => topSpeedKn(ship) * best(ship)[1];

    let dragging = -1;
    const draw = () => {
      const ship = TUNING.ships[id]!;
      const shipped = SHIPPED_TUNING.ships[id]!;
      svg.replaceChildren();
      const noGo = ship.noGoDeg;
      const [nx, ny] = xy(noGo, 1);
      svg.append(
        svgEl('path', { d: `M0 0 L0 ${-R} A${R} ${R} 0 0 1 ${nx} ${ny} Z`, class: 'tune-nogo' }),
      );
      for (const f of [0.25, 0.5, 0.75, 1])
        svg.append(
          svgEl('path', {
            d: `M0 ${-f * R} A${f * R} ${f * R} 0 0 1 0 ${f * R}`,
            class: 'tune-ring',
          }),
        );
      for (let a = 30; a < 180; a += 30) {
        const [x, y] = xy(a, 1);
        svg.append(svgEl('line', { x1: 0, y1: 0, x2: x!, y2: y!, class: 'tune-ring' }));
      }
      svg.append(
        svgEl('line', { x1: 0, y1: -R, x2: 0, y2: R, class: 'tune-axis' }),
        svgEl('text', { x: 3, y: -R - 3, class: 'tune-svg-label' }),
      );
      svg.lastChild!.textContent = 'wind ↓';
      if (!same(ship.polar, shipped.polar) || ship.noGoDeg !== shipped.noGoDeg)
        svg.append(svgEl('polyline', { points: curve(shipped), class: 'tune-curve-shipped' }));
      svg.append(svgEl('polyline', { points: curve(ship), class: 'tune-curve' }));
      ship.polar.forEach(([a, f], i) => {
        const [x, y] = xy(a, f);
        const dot = svgEl('circle', { cx: x!, cy: y!, r: 3.6, class: 'tune-handle' });
        if (!same(ship.polar[i], shipped.polar[i])) dot.classList.add('tune-handle-changed');
        // A wider invisible ring to grab with a finger.
        const hit = svgEl('circle', { cx: x!, cy: y!, r: 11, class: 'tune-hit' });
        hit.dataset.index = String(i);
        svg.append(dot, hit);
      });
      const bestNow = best(ship);
      const topNow = top(ship);
      const topShipped = top(shipped);
      const owned = this.host.world.trade.captain.activeShip === id;
      stats.replaceChildren();
      stats.innerHTML =
        `<div>Polar · drag the dots</div>` +
        `<div>Top speed <b>${topNow.toFixed(1)} kn</b>` +
        (Math.abs(topNow - topShipped) > 0.05 ? ` <s>${topShipped.toFixed(1)}</s>` : '') +
        `</div><div class="tune-dim">in a ${TUNING.seamanship.boat.referenceBreezeKn} kn breeze, full sails, stock</div>` +
        `<div>Best at <b>${bestNow[0]}°</b></div><div>No-go <b>±${noGo}°</b></div>`;
      sail.disabled = owned;
      sail.textContent = owned ? 'Sailing her now' : 'Sail this ship';
      stats.append(sail);
    };
    svg.addEventListener('pointerdown', (e) => {
      const t = e.target as SVGElement;
      if (!t.dataset.index) return;
      dragging = Number(t.dataset.index);
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    svg.addEventListener('pointermove', (e) => {
      if (dragging < 0) return;
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const polar = (liveValue(['ships', id, 'polar']) as number[][]).map((q) => [...q]);
      const a = polar[dragging]![0]!;
      // Distance along the dot's own ray: the angle stays, only the fraction moves.
      const along = (p.x * Math.sin(a * DEG) - p.y * Math.cos(a * DEG)) / R;
      polar[dragging]![1] = snapToMeta({ min: 0, max: 1, step: 0.01 }, along);
      setTuneValue(['ships', id, 'polar'], polar);
      this.changed();
    });
    const stop = () => (dragging = -1);
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);
    const reset = button('tune-reset tune-polar-reset', '↺ polar', () => {
      setTuneValue(['ships', id, 'polar'], shippedValue(['ships', id, 'polar']));
      this.changed();
    });
    card.append(reset);
    this.polar = () => {
      draw();
      reset.hidden = same(liveValue(['ships', id, 'polar']), shippedValue(['ships', id, 'polar']));
    };
    this.polar();
    return card;
  }

  // --- Reset, share, export ------------------------------------------------------------------

  private resetAll() {
    const n = Object.keys(currentChanges()).length;
    if (n === 0 || !window.confirm(`Put all ${n} changed values back to the shipped files?`))
      return;
    applyChanges({});
    this.renderTab();
    this.changed();
  }

  /** Replace every edit with a set from a link (called by the game when it opens one). */
  load(changes: TuneChanges) {
    applyChanges(changes);
    this.renderTab();
    this.changed();
  }

  private showSheet(title: string, content: HTMLElement[]) {
    const head = el('div', 'tune-sheet-head');
    head.append(
      el('b', '', title),
      button('tune-btn', 'Close', () => (this.sheet.hidden = true)),
    );
    this.sheet.replaceChildren(head, ...content);
    this.sheet.hidden = false;
  }

  private showShare() {
    const changes = currentChanges();
    const n = Object.keys(changes).length;
    if (n === 0) return this.showSheet('Share', [el('p', '', 'No changes to share yet.')]);
    const link = tuneLink(this.host.gameUrl(), changes);
    const qr = el('div', 'tune-qr');
    try {
      qr.innerHTML = qrSvg(link).svg;
    } catch {
      qr.textContent = 'Too many changes for a QR code: use the link.';
    }
    const text = el('textarea', 'tune-link');
    text.readOnly = true;
    text.value = link;
    const copy = button('tune-btn tune-primary', 'Copy link', () => {
      void navigator.clipboard?.writeText(link).then(() => (copy.textContent = 'Copied'));
    });
    this.showSheet('Share', [
      el(
        'p',
        '',
        `Scan or open on another device to try these ${n} change${n > 1 ? 's' : ''} there. It asks before replacing the tuning on that device.`,
      ),
      qr,
      text,
      copy,
    ]);
  }

  private showExport() {
    const files = changedFiles();
    if (files.length === 0)
      return this.showSheet('Export', [el('p', '', 'Nothing changed: the files are as shipped.')]);
    const list = el('ul', 'tune-files');
    for (const f of files) {
      const li = el('li');
      li.append(
        el('code', '', f.path),
        button('tune-btn', 'Download', () =>
          download(f.path.split('/').pop()!, f.text, 'application/json'),
        ),
        button('tune-btn', 'Copy', () => void navigator.clipboard?.writeText(f.text)),
      );
      list.append(li);
    }
    const zip = button('tune-btn tune-primary', 'Download all (.zip)', () => {
      const entries = Object.fromEntries(files.map((f) => [f.path, strToU8(f.text)]));
      download('fair-winds-tuning.zip', zipSync(entries), 'application/zip');
    });
    const howTo = el('p', 'tune-dim');
    howTo.innerHTML =
      'To put them in the game: on GitHub, open the folder (<code>src/data/tuning</code> or ' +
      '<code>src/data/ships</code>), <i>Add file › Upload files</i>, commit to a new branch and ' +
      'open a pull request; the tests check them, balance included. Or unzip at the top of the ' +
      'repository, or hand the share link to Claude.';
    this.showSheet('Export', [
      el(
        'p',
        '',
        `${files.length} changed file${files.length > 1 ? 's' : ''}, whole and formatted like the repository's own:`,
      ),
      list,
      zip,
      howTo,
    ]);
  }

  // --- Balance check -------------------------------------------------------------------------

  private renderBalance(s: BalanceState) {
    const checks: BalanceCheck[] = [...(s.economy ?? []), ...(s.difficulty ?? [])];
    const failed = checks.filter((c) => !c.ok);
    const head = el('button', 'tune-balance-head');
    head.type = 'button';
    const icon = s.error ? '!' : s.running ? '…' : failed.length ? '✗' : '✓';
    head.append(el('span', 'tune-balance-icon', icon), el('b', '', 'Balance check '));
    const status = s.error
      ? `could not run: ${s.error}`
      : s.running
        ? s.level
          ? `sailing ${levelName(s.level)}…`
          : 'sailing…'
        : failed.length
          ? `${failed.length} of ${checks.length} targets missed`
          : `all ${checks.length} targets hold`;
    head.append(el('span', '', status), el('span', 'tune-chev', this.balanceOpen ? '▾' : '▸'));
    this.balanceEl.className = [
      'tune-balance',
      s.error || failed.length ? 'tune-bad' : s.running ? '' : 'tune-good',
      s.running ? 'tune-running' : '',
    ].join(' ');
    const cutter = s.economy?.find((c) => c.id === 'sharp-cutter');
    const relaxed = s.economy?.find((c) => c.id === 'relaxed-cutter');
    const line = el('div', 'tune-balance-line');
    if (cutter && relaxed)
      line.innerHTML =
        `Cutter at <b>${cutter.actual}</b> sharp, <b>${relaxed.actual}</b> relaxed ` +
        `<span class="tune-dim">· target ${cutter.target} / ${relaxed.target} · ` +
        `${s.changes === 0 ? 'shipped values' : `with your ${s.changes} change${s.changes > 1 ? 's' : ''}`}</span>`;
    const parts: HTMLElement[] = [head, line];
    if (this.balanceOpen) {
      const list = el('ul', 'tune-checks');
      const add = (title: string, cs: BalanceCheck[] | null, pending: string) => {
        list.append(el('li', 'tune-checks-h', title));
        if (!cs) return list.append(el('li', 'tune-dim', pending));
        for (const c of cs) {
          const li = el('li', c.ok ? 'tune-ok' : 'tune-miss');
          li.append(
            el('span', 'tune-balance-icon', c.ok ? '✓' : '✗'),
            el('span', '', c.label),
            el('span', 'tune-actual', c.actual),
            el('span', 'tune-dim', `target ${c.target}`),
          );
          list.append(li);
        }
      };
      add('Captain level, 40 minutes (0046)', s.economy, 'running…');
      add('Each difficulty level, 2 hours (0083)', s.difficulty, 'running…');
      if (s.ms !== null)
        list.append(el('li', 'tune-dim', `Simulated in ${(s.ms / 1000).toFixed(1)} s.`));
      parts.push(list);
    }
    this.balanceEl.replaceChildren(...parts);
  }
}

function download(name: string, data: string | Uint8Array, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function openTunePanel(host: TuneHost): TunePanel {
  return new TunePanel(host);
}
