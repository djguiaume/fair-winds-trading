import { type MessageKey, t } from '../../i18n';
import { PAD, type PadButton } from '../../input/gamepad';
import { el } from '../components/dom';
import { TabBar } from '../components/tabBar';
import { labelAttrs, label } from '../hud/parts';
import { icon } from '../icons';
import { padGlyphFor } from '../padGlyphs';
import { SHIPPED_THEME } from '../theme/model';
import { signal } from '../theme/signals';
import { grainImage } from './grain';
import { keyStrip, legendPage } from './legend';

/** The chart's book tabs (decision 0196, issue #444): the sea, then full pages over it. */
export const CHART_TABS = ['map', 'journal', 'hold', 'market', 'legend'] as const;
export type ChartTab = (typeof CHART_TABS)[number];

const TABS: Record<ChartTab, { key: MessageKey; icon: string }> = {
  map: { key: 'chart.tabMap', icon: 'map' },
  journal: { key: 'journal.title', icon: 'flag' },
  hold: { key: 'chart.tabHold', icon: 'deck' },
  market: { key: 'chart.tabPrices', icon: 'trend' },
  legend: { key: 'chart.legendTitle', icon: 'info' },
};

/** The parts of the chart its code reaches for. */
export interface ChartParts {
  svg: SVGSVGElement;
  cross: HTMLElement;
  title: HTMLElement;
  course: HTMLElement;
  courseText: HTMLElement;
  clearCourse: HTMLButtonElement;
  pricesOn: HTMLElement;
  pricesText: HTMLElement;
  clearPrices: HTMLButtonElement;
  close: HTMLButtonElement;
  book: TabBar;
  journalBadge: HTMLElement;
  compass: HTMLElement;
  dial: HTMLElement;
  wind: HTMLElement;
  zoomIn: HTMLButtonElement;
  zoomOut: HTMLButtonElement;
  fit: HTMLButtonElement;
  status: HTMLElement;
  pages: Record<Exclude<ChartTab, 'map'>, HTMLElement>;
  journal: HTMLElement;
  hold: HTMLElement;
  marketGoods: HTMLElement;
  marketTitle: HTMLElement;
  prices: HTMLElement;
}

const button = (id: string, cls: string, html: string, aria: Record<string, MessageKey>) => {
  const b = el('button', cls);
  b.type = 'button';
  b.id = id;
  b.innerHTML = html;
  labelAttrs(b, aria);
  return b;
};

/**
 * Builds the chart table in its dialog (round 3 D, issue #444): the paper sea, the title
 * cartouche top left, the book tabs down the right edge, the compass rose and its key bottom left,
 * the zoom bottom right, the pad's buttons along the foot, and one paper page per tab.
 */
export function buildChart(dialog: HTMLDialogElement, onTab: (tab: ChartTab) => void): ChartParts {
  dialog.classList.add('chart', 'ui-panel--day');
  const ink = SHIPPED_THEME.colour.ink ?? '#23303a';
  const light = SHIPPED_THEME.chart.uncharted ?? '#f4ecd9';
  dialog.style.setProperty('--chart-grain', grainImage(ink, light));
  // The storm's chevrons and a race's course wear the game's own signal colours.
  dialog.style.setProperty('--chart-storm', signal('storm amber'));
  dialog.style.setProperty('--chart-race', signal('regatta yellow'));
  const viewport = el('div', 'chart-viewport');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'chart-map';
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', t('chart.mapLabel'));
  svg.dataset.i18nAttr = 'aria-label:chart.mapLabel';
  // A controller's cross: A sets a course to the port under it (decision 0183).
  const cross = el('div', 'chart-cross');
  cross.setAttribute('aria-hidden', 'true');
  viewport.append(svg, cross);

  const cartouche = el('header', 'chart-cartouche');
  const title = el('h2', 'chart-cartouche-title');
  title.id = 'chart-title';
  const sub = label(el('p', 'chart-cartouche-sub'), 'chart.subtitle');
  const line = (id: string, clearId: string, clearKey: MessageKey) => {
    const root = el('p', 'chart-cartouche-line');
    root.id = id;
    root.hidden = true;
    const text = el('span', '');
    const clear = button(clearId, 'chart-line-clear', icon('close'), {
      'aria-label': clearKey,
      title: clearKey,
    });
    root.append(text, clear);
    return { root, text, clear };
  };
  const course = line('chart-course', 'chart-clear-target', 'chart.clearTarget');
  course.text.id = 'chart-course-text';
  const prices = line('chart-prices-on', 'chart-clear-prices', 'chart.namesOnly');
  cartouche.append(title, sub, course.root, prices.root);

  const close = button('close-chart', 'ui-header-exit chart-close ui-pressable', icon('close'), {
    'aria-label': 'chart.back',
    title: 'chart.back',
  });
  close.dataset.padClose = '';

  const book = new TabBar({
    tabs: CHART_TABS.map((id) => ({ id, label: t(TABS[id].key) })),
    selected: 'map',
    onSelect: (id) => onTab(id as ChartTab),
  });
  book.root.classList.add('chart-book');
  labelAttrs(book.root, { 'aria-label': 'chart.title' });
  let journalBadge = el('span', '');
  for (const b of book.root.querySelectorAll<HTMLButtonElement>('.ui-tab')) {
    const id = b.dataset.tab as ChartTab;
    b.id = `chart-tab-${id}`;
    b.dataset.chartTab = id;
    b.innerHTML = icon(TABS[id].icon, 'chart-tab-icon');
    b.append(label(el('span', 'chart-tab-label'), TABS[id].key));
    if (id === 'journal') {
      journalBadge = el('span', 'tab-badge chart-journal-badge');
      journalBadge.hidden = true;
      b.append(journalBadge);
      b.hidden = true;
    }
  }

  const compass = el('aside', 'chart-rose');
  compass.id = 'chart-compass';
  labelAttrs(compass, { 'aria-label': 'chart.localWind' });
  const dial = el('div', 'chart-dial');
  const wind = el('span', 'chart-wind');
  wind.id = 'chart-wind';
  compass.append(dial, wind, keyStrip());

  const zoom = el('div', 'chart-zoom');
  const zoomIn = button('chart-zoom-in', 'chart-zoom-btn', '+', { 'aria-label': 'chart.zoomIn' });
  const zoomOut = button('chart-zoom-out', 'chart-zoom-btn', '−', {
    'aria-label': 'chart.zoomOut',
  });
  const fit = button('chart-fit', 'chart-zoom-btn', '⤢', {
    'aria-label': 'chart.fit',
    title: 'chart.fit',
  });
  zoom.append(zoomIn, zoomOut, fit);

  const status = el('p', 'chart-status');
  status.id = 'chart-status';
  status.setAttribute('role', 'status');

  const page = (id: Exclude<ChartTab, 'map'>, ...body: Node[]) => {
    const root = el('section', 'chart-page');
    root.id = `chart-${id}-panel`;
    root.hidden = true;
    const head = label(el('h3', 'chart-page-title'), TABS[id].key);
    head.id = `chart-${id}-head`;
    root.setAttribute('aria-labelledby', head.id);
    root.append(head, ...body);
    return root;
  };
  const list = (id: string, cls: string) => {
    const node = el('div', cls);
    node.id = id;
    return node;
  };
  const journal = list('chart-journal-list', 'chart-page-list');
  const hold = list('chart-hold-list', 'chart-page-list');
  const marketGoods = list('chart-market-goods', 'chart-market-goods');
  labelAttrs(marketGoods, { 'aria-label': 'chart.goodToCompare' });
  marketGoods.setAttribute('role', 'group');
  const marketTitle = el('h4', 'chart-page-rule');
  marketTitle.id = 'chart-market-title';
  const pricesTable = list('chart-prices', 'chart-prices');
  const marketSide = el('div', 'chart-market-table');
  marketSide.append(marketTitle, pricesTable);
  const marketBody = el('div', 'chart-market');
  marketBody.append(marketGoods, marketSide);
  const pages = {
    journal: page('journal', journal),
    hold: page('hold', hold),
    market: page('market', marketBody),
    legend: page('legend', ...legendPage()),
  };

  const tutorial = el('div', '');
  tutorial.id = 'tutorial-chart';
  dialog.replaceChildren(
    viewport,
    cartouche,
    compass,
    zoom,
    padBar(),
    status,
    ...Object.values(pages),
    book.root,
    close,
    tutorial,
  );
  return {
    svg,
    cross,
    title,
    course: course.root,
    courseText: course.text,
    clearCourse: course.clear,
    pricesOn: prices.root,
    pricesText: prices.text,
    clearPrices: prices.clear,
    close,
    book,
    journalBadge,
    compass,
    dial,
    wind,
    zoomIn,
    zoomOut,
    fit,
    status,
    pages,
    journal,
    hold,
    marketGoods,
    marketTitle,
    prices: pricesTable,
  };
}

/** The pad's buttons on the map, from `controls.json` (shown only while the pad is in use). */
function padBar(): HTMLElement {
  const a = PAD.chart.actions;
  const items: [PadButton[], MessageKey][] = [
    [a.pick.slice(0, 1), 'chart.padCourse'],
    [[...a.zoomOut.slice(0, 1), ...a.zoomIn.slice(0, 1)], 'chart.padZoom'],
    [[...a.tabPrev.slice(0, 1), ...a.tabNext.slice(0, 1)], 'pad.tabs'],
    [a.nextGood.slice(0, 1), 'chart.tabPrices'],
    [a.close.slice(0, 1), 'pad.back'],
  ];
  const bar = el('div', 'chart-padbar pad-only');
  bar.setAttribute('aria-hidden', 'true');
  for (const [buttons, key] of items) {
    const item = el('span', 'chart-padbar-item');
    item.innerHTML = buttons.map(padGlyphFor).join('');
    item.append(label(el('span', ''), key));
    bar.append(item);
  }
  return bar;
}
