import type { Aboard } from '../../audio/catalog';
import { row, select } from '../quest/form';

/** What the Sounds page gives the follow cam's rows to build with. */
interface Page {
  num(value: number, set: (v: number) => void): HTMLElement;
  edit(change: () => void): void;
  play(id: string): void;
  playButton(onClick: () => void): HTMLElement;
  heading(title: string, about: string): HTMLElement;
}

const MULTIPLIERS = ['wash', 'washTone', 'waves', 'wind', 'luff'] as const;

/** The follow cam's mix on the boat page (issue #555): the layer multipliers, creak and rattle. */
export function aboardRows(aboard: Aboard, effects: string[], page: Page): HTMLElement[] {
  const { num, edit, play, playButton } = page;
  const effect = (label: string, part: 'creak' | 'rattle') =>
    row(
      `${label} effect`,
      select(effects, aboard[part].effect, (v) => edit(() => (aboard[part].effect = v))),
      playButton(() => play(aboard[part].effect)),
    );
  return [
    page.heading(
      'In the follow cam',
      'Aboard, the mix eases with the camera: each number multiplies the sea camera’s layer (1 = unchanged). Tick “follow cam” in the listen panel to hear it. The rig groans when a gust lifts the wind by gustKn over its average (at most once in every seconds); the blocks rattle on a tack.',
    ),
    ...MULTIPLIERS.map((k) =>
      row(
        `aboard ${k}`,
        num(aboard[k], (v) => (aboard[k] = v)),
      ),
    ),
    effect('creak', 'creak'),
    row(
      'creak level',
      num(aboard.creak.level, (v) => (aboard.creak.level = v)),
    ),
    row(
      'creak gust kn',
      num(aboard.creak.gustKn, (v) => (aboard.creak.gustKn = v)),
    ),
    row(
      'creak every s',
      num(aboard.creak.every, (v) => (aboard.creak.every = v)),
    ),
    effect('rattle', 'rattle'),
    row(
      'rattle level',
      num(aboard.rattle.level, (v) => (aboard.rattle.level = v)),
    ),
  ];
}
