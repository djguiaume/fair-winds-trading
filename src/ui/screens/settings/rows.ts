import { hasText, t } from '../../../i18n';
import { listRow } from '../../components';
import { el } from '../../components/dom';

/**
 * The Settings controls, each one a list row (decision 0269): a name and a note on the left, the
 * control on the right. A row reads its value from the game on `refresh` and writes it back with
 * `set`; the screen refreshes every row after any change, so rows that depend on each other
 * (Storms need Weather) never go stale.
 */
/** A text by key, the key itself while a language lacks it. */
export const text = (key: string): string => (hasText(key) ? t(key) : key);

export interface SettingRow {
  root: HTMLElement;
  refresh(): void;
}

interface RowText {
  /** Name text key; the note is `<key>Note` when the text files have it. */
  key: string;
  /** A note that is not a text key (the graphics level in use). */
  detail?: () => string;
}

interface RowState {
  disabled?: () => boolean;
  hidden?: () => boolean;
}

function noteOf(o: RowText): string | undefined {
  const note = `${o.key}Note`;
  return o.detail?.() ?? (hasText(note) ? t(note) : undefined);
}

/** The row's frame; `refresh` keeps its note and visibility current. */
function frame(o: RowText & RowState, control: HTMLElement, sync: () => void): SettingRow {
  const root = listRow({ label: text(o.key), detail: noteOf(o) });
  root.classList.add('set-row');
  root.append(control);
  const detail = root.querySelector('.ui-row-detail');
  return {
    root,
    refresh() {
      root.hidden = o.hidden?.() ?? false;
      const note = noteOf(o);
      if (detail && note) detail.textContent = note;
      if (note) root.title = note;
      sync();
    },
  };
}

export interface SwitchSpec extends RowText, RowState {
  id: string;
  get(): boolean;
  set(on: boolean): void;
}

export function switchRow(o: SwitchSpec): SettingRow {
  const box = el('input', 'ui-switch');
  box.type = 'checkbox';
  box.id = o.id;
  box.setAttribute('role', 'switch');
  box.addEventListener('change', () => o.set(box.checked));
  const row = frame(o, box, () => {
    box.checked = o.get();
    box.disabled = o.disabled?.() ?? false;
  });
  // The whole row is the target, not only the small switch.
  row.root.addEventListener('click', (e) => {
    if (e.target !== box && !box.disabled) box.click();
  });
  return row;
}

export interface ChoiceSpec<T extends string> extends RowText, RowState {
  id: string;
  options: readonly { id: T; label: string }[];
  /** The options as equal tiles under the name, for a choice of a few big options. */
  tiles?: boolean;
  get(): T;
  set(id: T): void;
}

export function choiceRow<T extends string>(o: ChoiceSpec<T>): SettingRow {
  const group = el('div', o.tiles ? 'ui-choice ui-choice--tiles' : 'ui-choice');
  group.style.setProperty('--tiles', String(o.options.length));
  group.id = o.id;
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', text(o.key));
  const buttons = o.options.map((option) => {
    const b = el('button', 'ui-choice-option ui-pressable', option.label);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.choice = option.id;
    b.addEventListener('click', () => o.set(option.id));
    return b;
  });
  group.append(...buttons);
  const row = frame(o, group, () => {
    const now = o.get();
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.choice === now));
  });
  row.root.classList.toggle('set-row--tiles', Boolean(o.tiles));
  return row;
}

export interface SliderSpec extends RowText, RowState {
  id: string;
  /** 0 to 100. */
  get(): number;
  set(percent: number): void;
  /** The drag ended: save. */
  commit(): void;
}

export function sliderRow(o: SliderSpec): SettingRow {
  const range = el('input', 'ui-slider');
  range.type = 'range';
  range.id = o.id;
  range.min = '0';
  range.max = '100';
  range.step = '5';
  range.setAttribute('aria-label', text(o.key));
  const value = el('output', 'ui-slider-value');
  value.htmlFor = o.id;
  range.addEventListener('input', () => {
    value.textContent = `${range.value}%`;
    o.set(Number(range.value));
  });
  range.addEventListener('change', o.commit);
  const control = el('span', 'ui-slider-box');
  control.append(range, value);
  return frame(o, control, () => {
    range.value = String(o.get());
    value.textContent = `${range.value}%`;
    range.disabled = o.disabled?.() ?? false;
  });
}

export interface ActionSpec extends RowText, RowState {
  control: HTMLElement;
}

/** A row whose control is a button or anything made elsewhere (New game, the lessons). */
export function actionRow(o: ActionSpec, sync: () => void = () => {}): SettingRow {
  return frame(o, o.control, sync);
}
