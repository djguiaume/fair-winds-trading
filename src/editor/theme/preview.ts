import {
  Dialog,
  TabBar,
  Toaster,
  button,
  card,
  listRow,
  panel,
  screenHeader,
} from '../../ui/components';
import { MomentBanner } from '../../ui/moments/banner';
import { raceBoardHtml } from '../../ui/moments/raceBoard';
import { stampOn } from '../../ui/moments/stamp';
import '../../ui/moments/moments.css';
import { h } from '../quest/form';
import { type Theme, themeCss } from '../../ui/theme/model';

/**
 * The Theme page's live preview (decision 0269): the eight components, by day and by night, on a
 * sea-coloured ground, painted with the page's working theme rather than the shipped one. The
 * same strip is what the art director sees in the screenshot of the components.
 */

const SCOPE = {
  root: '.th-preview',
  night: '.th-preview[data-night]',
  forcedDay: '.th-preview .ui-panel--day',
  forcedNight: '.th-preview .ui-panel--night',
};

/** The working theme's custom properties, for the preview boxes only. */
export function previewStyle(theme: Theme): string {
  return themeCss(theme, SCOPE);
}

function strip(night: boolean): HTMLElement {
  const box = document.createElement('div');
  box.className = 'th-preview';
  box.toggleAttribute('data-night', night);
  const header = screenHeader({
    title: night ? 'Harbour at night' : 'Harbour',
    onExit: () => {},
    legend: true,
  });
  header.legend!.textContent = 'A choose · B back';
  const tabs = new TabBar({
    tabs: [
      { id: 'market', label: 'Market' },
      { id: 'shipyard', label: 'Shipyard' },
      { id: 'quay', label: 'Quay' },
    ],
  });
  const buttons = document.createElement('div');
  buttons.className = 'th-row';
  buttons.append(
    button({ label: 'Set sail', variant: 'primary' }),
    button({ label: 'Later' }),
    button({ label: 'Sold out', disabled: true }),
    button({ label: 'New game', variant: 'danger' }),
  );
  const cards = document.createElement('div');
  cards.className = 'th-row';
  cards.append(
    card({ title: 'Captain', text: 'The standard voyage', selected: true, onPress: () => {} }),
    card({
      title: 'Deckhand',
      text: 'Kind winds, cheap repairs',
      selected: false,
      onPress: () => {},
    }),
  );
  const rows = panel(
    {},
    listRow({
      label: 'Fish',
      detail: 'Caught off Saltmere',
      value: '12',
      selected: true,
      onPress: () => {},
    }),
    listRow({ label: 'Timber', detail: 'Wanted in Port Calda', value: '48', onPress: () => {} }),
    listRow({ label: 'Hold', value: '6/20' }),
  );
  const dialog = new Dialog({
    title: 'Abandon the voyage?',
    text: 'Your cargo stays in port.',
    cancel: false,
    choices: [
      { label: 'Keep sailing', value: false },
      { label: 'Abandon', value: true, variant: 'danger' },
    ],
  });
  dialog.root.setAttribute('open', '');
  dialog.root.classList.add('th-dialog');
  const toaster = new Toaster({ set: () => 0 });
  toaster.show('Sold 4 fish for 36 gold', { kind: 'good' });
  toaster.root.classList.add('th-toasts');
  box.append(header.root, tabs.root, buttons, cards, rows, dialog.root, toaster.root);
  box.append(...moments());
  return box;
}

/** The moments (decision 0274): the arrival banner, the horn countdown, a stamped card, the board. */
function moments(): HTMLElement[] {
  const still = { set: () => 0 };
  const arrival = new MomentBanner('arrival', still);
  arrival.show('Saltmere', 'Home port', 0);
  const horn = new MomentBanner('horn', still);
  horn.show('Horn in 10', undefined, 0);
  const row = document.createElement('div');
  row.className = 'th-row th-moments';
  const stamped = panel({ tag: 'div' }, h('p', {}, 'Rook asks you to call at Port Calda.'));
  stamped.classList.add('th-stamped');
  stampOn(stamped, 'Step done');
  const board = document.createElement('div');
  board.innerHTML = raceBoardHtml(
    {
      times: [
        { medal: 'gold', sec: 61.2, gold: 0, won: true },
        { medal: 'silver', sec: 66.8, gold: 0, won: true },
        { medal: 'bronze', sec: 74.1, gold: 0, won: false },
      ],
      again: true,
      label: 'Medal times for your sloop',
      series: 'The Saltmere Regatta',
      best: 64.9,
      result: { sec: 64.9, medal: 2, rival: 63.2, gold: 40 },
    },
    '<li class="is-gold"><span class="race-medal"></span><b>1:01.2</b></li><li class="is-silver is-won"><span class="race-medal"></span><b>1:06.8</b></li>',
  );
  row.append(stamped, board);
  return [arrival.root, horn.root, row];
}

/** Both strips, day then night. */
export function previewStrips(): HTMLElement[] {
  return [strip(false), strip(true)];
}
