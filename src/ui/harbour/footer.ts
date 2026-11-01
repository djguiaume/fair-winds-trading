import type { PadButton } from '../../input/gamepad';
import { t } from '../../i18n';
import { button } from '../components/button';
import { el, onPress } from '../components/dom';
import { padGlyphFor } from '../padGlyphs';
import { type Character, type Mood, portraitSvg } from '../portraits';
import { esc } from './parts';

/**
 * The harbour's footer (issue #443): on the left a small paper plate with a face (someone on the
 * quay who would like a word, else the harbour keeper's line), the trade's status line, then the
 * pad's legend for this tab (only while a pad is in use, so the old floating hints pill stays off
 * this screen and never sits on Set sail), the tab's extra actions, and Set sail, the one sage
 * action, bottom right. A stray A never leaves port: the pad's focus never starts on Set sail.
 */
export interface FooterFace {
  who?: Character;
  mood?: Mood;
  look?: string;
  /** Markup: the name may be bold. */
  html: string;
  /** "Quay": the plate is a button to the Quay tab. */
  go?: () => void;
}

export interface FooterOptions {
  face?: FooterFace;
  status: string;
  legend: readonly [PadButton, string][];
  extras: readonly HTMLElement[];
  sailLabel: string;
  onSail: () => void;
  /** The ids' prefix, as the header's: Set sail is `tp-undock` at a port. */
  ids?: string;
}

export function harbourFooter(o: FooterOptions): HTMLElement {
  const foot = el('footer', 'hb-foot');
  if (o.face) foot.append(facePlate(o.face));
  const status = el('p', 'hb-status trade-status', o.status);
  status.setAttribute('role', 'status');
  const legend = el('div', 'hb-legend pad-legend');
  legend.setAttribute('aria-hidden', 'true');
  legend.innerHTML = o.legend
    .map(([key, label]) => `<span>${padGlyphFor(key)}${esc(label)}</span>`)
    .join('');
  const sail = button({
    label: o.sailLabel,
    variant: 'primary',
    icon: 'anchor',
    onPress: o.onSail,
  });
  sail.id = `${o.ids ?? 'tp'}-undock`;
  sail.classList.add('hb-sail');
  delete sail.dataset.padMain;
  sail.dataset.padStart = 'never';
  foot.append(status, legend, ...o.extras, sail);
  return foot;
}

function facePlate(f: FooterFace): HTMLElement {
  const plate = f.go ? el('button', 'hb-face ui-pressable') : el('div', 'hb-face');
  if (plate instanceof HTMLButtonElement) {
    plate.type = 'button';
    plate.id = 'tp-quay-hint';
  }
  const face = f.who ? portraitSvg(f.who, { size: 40, mood: f.mood, variant: f.look }) : '';
  plate.innerHTML = `${face}<span>${f.html}${f.go ? ` <em>${esc(t('harbour.toQuay'))}</em>` : ''}</span>`;
  onPress(plate, f.go);
  return plate;
}
