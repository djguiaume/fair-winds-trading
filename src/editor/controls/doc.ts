import shipped from '../../data/controls.json';
import { formatJson } from '../../data/jsonFormat';
import {
  PAD_AXES,
  PAD_BUTTONS,
  type PadBrand,
  type PadControls,
  brandProblems,
  controlProblems,
} from '../../input/gamepad';
import { type TvConfig, tvProblems } from '../../input/tv';

/**
 * The controls file as the controls page edits it (decision 0189): the pad's numbers and
 * buttons in each place (`gamepad`), TV mode (`tv`) and each pad maker's button names
 * (`padBrands`). Pure, so `npm run check` and the tests use the same checks and export.
 */
export interface ControlsDoc {
  gamepad: PadControls;
  tv: TvConfig;
  padBrands: Record<string, PadBrand>;
}

/** Where the page keeps its working copy in this browser. */
export const EDITED_CONTROLS_KEY = 'fwt-editor-controls';

export const shippedControls = (): ControlsDoc => structuredClone(shipped) as ControlsDoc;

/** The places a pad plays in, with their actions, as the page lists them. */
export const PAD_PLACES = ['sea', 'chart', 'menu'] as const;
export type PadPlace = (typeof PAD_PLACES)[number];
export const PLACE_NAMES: Record<PadPlace, string> = {
  sea: 'At sea',
  chart: 'Sea chart',
  menu: 'Menus and cards',
};

/** A place's settings that are numbers, and those that name a stick axis. */
export function placeFields(doc: ControlsDoc, place: PadPlace) {
  const p = doc.gamepad[place] as unknown as Record<string, unknown>;
  const axes: string[] = [];
  const numbers: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (k === 'actions') continue;
    if (typeof v === 'number') numbers.push(k);
    else if (typeof v === 'string' && (PAD_AXES as readonly string[]).includes(v)) axes.push(k);
  }
  return { axes, numbers };
}

/** The pad-wide numbers (dead zone, repeat timings…). */
export const padNumbers = (doc: ControlsDoc) =>
  Object.keys(doc.gamepad).filter(
    (k) => typeof (doc.gamepad as unknown as Record<string, unknown>)[k] === 'number',
  );

/** Turn a button on or off for an action, keeping the buttons in the pad's order. */
export function toggleButton(list: string[], button: string): string[] {
  const on = new Set(list);
  if (on.has(button)) on.delete(button);
  else on.add(button);
  return PAD_BUTTONS.filter((b) => on.has(b));
}

/** Every problem in the file, the same checks the game's tests and `npm run check` run. */
export function controlsProblems(doc: ControlsDoc): string[] {
  return [...controlProblems(doc.gamepad), ...tvProblems(doc.tv), ...brandProblems(doc.padBrands)];
}

/** Whether something parsed from a file or the browser looks like a controls file. */
export function isControlsDoc(v: unknown): v is ControlsDoc {
  const d = v as ControlsDoc | null;
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.gamepad === 'object' &&
    typeof d.tv === 'object' &&
    typeof d.padBrands === 'object'
  );
}

/** The file's text, byte for byte as `src/data/controls.json` is written. */
export const controlsText = (doc: ControlsDoc) => formatJson(doc);
