import { hasText, t } from '../i18n';
import { QUALITY, QUALITY_LEVELS, type QualityLevel } from '../render/quality';
import type { GraphicsEffects } from '../render/ultraPipeline';
import type { Settings } from './settings';
import './graphicsSettings.css';

/** Settings › Graphics: after Auto (in the page), a button per level, lowest first (0247). */
export function addQualityButtons(group: HTMLElement): HTMLButtonElement[] {
  for (const level of QUALITY_LEVELS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.dataset.quality = level;
    button.dataset.i18n = `settings.${level}`;
    button.textContent = t(`settings.${level}`);
    group.append(button);
  }
  return [...group.querySelectorAll<HTMLButtonElement>('[data-quality]')];
}

/** A Settings switch row (label, note, switch), its texts from `key` and `key`Note. */
export function switchRow(
  id: string,
  key: string,
  checked: boolean,
  change: (on: boolean) => void,
) {
  const row = document.createElement('label');
  row.className = 'set-row';
  const name = document.createElement('span');
  name.className = 'set-name';
  const label = document.createElement('span');
  const note = document.createElement('small');
  for (const [el, k] of [
    [label, key],
    [note, `${key}Note`],
  ] as const) {
    el.dataset.i18n = k;
    el.textContent = hasText(k) ? t(k) : id;
  }
  name.append(label, note);
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.className = 'switch';
  input.setAttribute('role', 'switch');
  input.checked = checked;
  input.addEventListener('change', () => change(input.checked));
  row.append(name, input);
  return row;
}

/** The effects the switches cover; the water's reflection also shows on High. */
const EFFECTS: readonly (keyof GraphicsEffects)[] = [
  'shadows',
  'occlusion',
  'toneMapping',
  'haze',
  'reflection',
];

/** What the switches drive: the view's effects and its waves. */
interface GraphicsView {
  effects: GraphicsEffects;
  setWaves(choice: boolean | null): void;
}

/**
 * Settings › Waves (decision 0250), then one switch per graphics effect (decision 0221), placed
 * after `after`. Waves follows the level (`graphics.json › quality.*.waves`: off on Low and
 * Ultra-low) until the player flips it, then their choice holds on every level; off draws the
 * classic sea without the waves' shader. An effect shows only on the levels that draw it; left
 * out of `settings.effects` = on. Returns a function that shows the rows for the level in use.
 */
export function addEffectSwitches(
  after: Element,
  settings: Settings,
  view: GraphicsView,
  keep: () => void,
): (level: QualityLevel) => void {
  const { effects } = view;
  const rows = new Map<keyof GraphicsEffects, HTMLElement>();
  effects.msaa = settings.effects.msaa !== false;
  view.setWaves(settings.waves);
  const waves = switchRow('waves', 'settings.waves', false, (on) => {
    settings.waves = on;
    view.setWaves(on);
    keep();
  });
  after.after(waves);
  let previous: Element = waves;
  for (const id of EFFECTS) {
    effects[id] = settings.effects[id] !== false;
    const row = switchRow(`fx-${id}`, `settings.fx.${id}`, effects[id], (on) => {
      effects[id] = on;
      settings.effects = { ...settings.effects, [id]: on };
      keep();
    });
    previous.after(row);
    previous = row;
    rows.set(id, row);
  }
  return (level) => {
    const profile = QUALITY[level];
    waves.querySelector('input')!.checked = settings.waves ?? profile.waves;
    for (const [id, row] of rows)
      row.hidden = id === 'reflection' ? !profile.waterReflection : !profile.ultra;
  };
}
