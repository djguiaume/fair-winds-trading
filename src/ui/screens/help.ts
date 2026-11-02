import { type MessageKey, t } from '../../i18n';
import { card, panel, screenHeader } from '../components';
import { el } from '../components/dom';
import { HELP_ART } from './helpArt';
import type { Screen } from './stack';
import './screens.css';
import './help.css';

/** The four cards, in order: a picture, a title and a line, all from `help.*`. */
const CARDS = ['wind', 'tack', 'trade', 'press'] as const;
const ART = { wind: 'wind', tack: 'tack', trade: 'trade', press: 'strong' } as const;

/** One control, a key cap and what it does; `padKey` lets the controller glyph replace the cap. */
type Control = { key: string; word: MessageKey; padKey?: string };

const keyboard = (): Control[] => [
  { key: '← →', word: 'help.keySteer' },
  { key: '↑ ↓', word: 'help.keySails' },
  { key: 'M', word: 'help.keyMap' },
  { key: 'Esc', word: 'help.keyMenu' },
  { key: t('help.rightDrag'), word: 'help.keyView' },
  { key: 'C', word: 'help.keyChase' },
];

const pad = (): Control[] => [
  { key: 'L', word: 'help.keySteer' },
  { key: 'LB RB', word: 'help.keySails', padKey: 'lb rb' },
  { key: 'B', word: 'help.padStop', padKey: 'b' },
  { key: 'View', word: 'help.keyMap', padKey: 'view' },
  { key: 'R', word: 'help.keyView' },
  { key: 'R', word: 'help.keyChase' },
  { key: '☰', word: 'help.keyMenu' },
];

function controlLine(cls: string, label: MessageKey, items: Control[]): HTMLElement {
  const line = el('p', `help-line ${cls}`);
  line.append(el('b', '', t(label)));
  items.forEach((c, i) => {
    const kbd = el('kbd', '', c.key);
    if (c.padKey) kbd.dataset.padKey = c.padKey;
    line.append(kbd, ` ${t(c.word)}${i < items.length - 1 ? ' · ' : ''}`);
  });
  return line;
}

/**
 * How to play (decision 0269, issue #445): four cards with a pen drawing each, then the controls
 * for touch, keyboard and pad. Touch devices skip the keyboard line; the pad line shows once a
 * pad is seen (decision 0162).
 */
export class HelpScreen {
  readonly screen: Screen;

  constructor(close: () => void) {
    const header = screenHeader({ title: t('menu.help'), exit: 'close', onExit: close });
    const cards = el('div', 'help-cards');
    for (const id of CARDS) {
      const media = el('span', 'help-art-box');
      media.innerHTML = HELP_ART[ART[id]]();
      cards.append(card({ title: t(`help.${id}Title`), text: t(`help.${id}Copy`), media }));
    }
    const controls = el('div', 'help-controls');
    controls.append(
      controlLine('help-touch', 'help.touch', []),
      controlLine('help-keys', 'help.keyboard', keyboard()),
      controlLine('help-pad', 'help.pad', pad()),
    );
    controls.querySelector('.help-touch')!.append(t('help.touchLine'));
    const body = el('div', 'help-body');
    body.append(cards, controls);
    const root = panel({ edge: 'torn' }, header.root, body);
    root.id = 'help';
    root.classList.add('help-screen');
    root.hidden = true;
    this.screen = { id: 'help', root, back: close };
  }
}
