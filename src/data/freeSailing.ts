import type { FreePreset, FreeRules } from '../sim/freeSailing';
import rulesFile from './free-sailing/rules.json';

/**
 * The Free Sailing presets as the game ships them (decision 0266): every
 * `src/data/free-sailing/<id>.json` but `rules.json` is a preset. Adding a file adds the preset;
 * the setup lists them through the day, by their hour.
 */
const presetFiles = import.meta.glob<FreePreset>(['./free-sailing/*.json', '!**/rules.json'], {
  eager: true,
  import: 'default',
});

export const sortPresets = (presets: FreePreset[]) =>
  [...presets].sort((a, b) => a.hour - b.hour || a.id.localeCompare(b.id));

export const FREE_PRESETS: FreePreset[] = sortPresets(Object.values(presetFiles));

export const FREE_RULES: FreeRules = rulesFile;
