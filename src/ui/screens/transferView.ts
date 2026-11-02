import { t } from '../../i18n';
import { TabBar, button, panel, screenHeader } from '../components';
import { el } from '../components/dom';
import { canScan } from '../qrScanner';
import './screens.css';
import './transfer.css';

/** The pieces the panel wires up: its screen, its panes and every control. */
export interface TransferView {
  root: HTMLElement;
  tabs: TabBar;
  panes: { send: HTMLElement; receive: HTMLElement; confirm: HTMLElement };
  qr: HTMLElement;
  copy: HTMLButtonElement;
  copyLabel: HTMLElement;
  download: HTMLButtonElement;
  scanView: HTMLElement;
  video: HTMLVideoElement;
  scanStart: HTMLButtonElement;
  scanStop: HTMLButtonElement;
  paste: HTMLTextAreaElement;
  load: HTMLButtonElement;
  openFile: HTMLButtonElement;
  file: HTMLInputElement;
  error: HTMLElement;
  here: HTMLElement;
  incoming: HTMLElement;
  replace: HTMLButtonElement;
  keep: HTMLButtonElement;
  close: () => void;
}

/** A button with its label in a span the caller can reword (Copy code → Copied). */
function labelled(label: string, icon: string, variant: 'primary' | 'plain' = 'plain') {
  const b = button({ label, icon, variant });
  return { b, label: b.querySelector<HTMLElement>('.ui-btn-label')! };
}

function sendPane(v: Partial<TransferView>): HTMLElement {
  const qr = el('div', 'qr-box');
  const figure = el('figure', 'qr-card');
  figure.append(qr, el('figcaption', '', t('transfer.scanThis')));
  const steps = el('ol', 'transfer-steps');
  steps.innerHTML = `<li>${t('transfer.how1')}</li><li>${t('transfer.how2')}</li>`;
  const copy = labelled(t('transfer.copy'), 'copy');
  const download = button({ label: t('transfer.download'), icon: 'file' });
  const actions = el('div', 'transfer-actions');
  actions.append(copy.b, download);
  const side = el('div', 'transfer-side');
  side.append(
    el('h2', 'transfer-head', t('transfer.howTitle')),
    steps,
    actions,
    el('p', 'transfer-note', t('transfer.copyNote')),
  );
  const pane = el('div', 'transfer-pane');
  pane.append(figure, side);
  Object.assign(v, { qr, copy: copy.b, copyLabel: copy.label, download });
  return pane;
}

function receivePane(v: Partial<TransferView>): HTMLElement {
  const video = el('video', '');
  video.playsInline = true;
  video.muted = true;
  const scanView = el('div', 'scan-view');
  scanView.hidden = true;
  scanView.append(video, el('span', 'scan-frame'));
  const scanStart = button({ label: t('transfer.scan'), icon: 'camera', variant: 'primary' });
  scanStart.hidden = !canScan();
  const scanStop = button({ label: t('transfer.stopScan') });
  scanStop.hidden = true;
  const scan = el('div', 'scan-card');
  scan.append(scanView, scanStart, scanStop, el('p', 'transfer-note', t('transfer.scanHint')));
  const paste = el('textarea', 'transfer-paste');
  paste.rows = 3;
  paste.spellcheck = false;
  paste.autocomplete = 'off';
  paste.placeholder = t('transfer.pastePlaceholder');
  const load = button({ label: t('transfer.load') });
  const openFile = button({ label: t('transfer.openFile'), icon: 'file' });
  const file = el('input', '');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.hidden = true;
  const actions = el('div', 'transfer-actions');
  actions.append(load, openFile, file);
  const error = el('p', 'transfer-error', '');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const side = el('div', 'transfer-side');
  side.append(el('h2', 'transfer-head', t('transfer.pasteTitle')), paste, actions, error);
  const pane = el('div', 'transfer-pane');
  pane.append(scan, side);
  Object.assign(v, { video, scanView, scanStart, scanStop, paste, load, openFile, file, error });
  return pane;
}

/** Replace the voyage? Both voyages side by side; Keep mine is the safe, first answer. */
function confirmPane(v: Partial<TransferView>): HTMLElement {
  const here = el('dl', '');
  const incoming = el('dl', '');
  const cardOf = (title: string, rows: HTMLElement, cls = '') => {
    const c = el('div', `voyage-card ${cls}`);
    c.append(el('h3', '', title), rows);
    return c;
  };
  const cards = el('div', 'voyage-cards');
  cards.append(
    cardOf(t('transfer.here'), here),
    el('span', 'voyage-arrow', '→'),
    cardOf(t('transfer.incoming'), incoming, 'is-incoming'),
  );
  const keep = button({ label: t('transfer.keep'), variant: 'primary' });
  const replace = button({ label: t('transfer.replace'), variant: 'danger' });
  const actions = el('div', 'transfer-actions');
  actions.append(keep, replace);
  const pane = el('div', 'transfer-pane transfer-confirm');
  pane.append(
    el('h2', 'transfer-head', t('transfer.replaceTitle')),
    cards,
    el('p', 'transfer-note', t('transfer.replaceNote')),
    actions,
  );
  Object.assign(v, { here, incoming, keep, replace });
  return pane;
}

/** "Move your voyage" (decision 0066) on the components: a header, Send and Receive tabs, panes. */
export function buildTransfer(close: () => void, onTab: (tab: 'send' | 'receive') => void) {
  const v: Partial<TransferView> = { close };
  const header = screenHeader({ title: t('transfer.title'), exit: 'close', onExit: close });
  const tabs = new TabBar({
    tabs: [
      { id: 'send', label: t('transfer.send') },
      { id: 'receive', label: t('transfer.receive') },
    ],
    onSelect: (id) => onTab(id as 'send' | 'receive'),
  });
  const panes = { send: sendPane(v), receive: receivePane(v), confirm: confirmPane(v) };
  const body = el('div', 'transfer-body');
  body.append(panes.send, panes.receive, panes.confirm);
  const root = panel({ edge: 'torn' }, header.root, tabs.root, body);
  root.id = 'transfer';
  root.classList.add('transfer-screen');
  root.hidden = true;
  return Object.assign(v, { root, tabs, panes }) as TransferView;
}
