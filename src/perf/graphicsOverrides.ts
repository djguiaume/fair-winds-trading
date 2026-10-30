import switches from '../data/graphics-switches.json';
import { terrainLook } from '../render/terrainLook';
import type { QualityLevel } from '../render/quality';
import type { Settings } from '../ui/settings';

const LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
const NAMES: Record<string, string> = switches;

function parse(search: string) {
  const params = new URLSearchParams(search);
  const quality = params.get('quality') as QualityLevel | null;
  const off = (params.get('off') ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name, i, all) => name in NAMES && all.indexOf(name) === i);
  return { quality: quality && LEVELS.includes(quality) ? quality : null, off };
}

/**
 * Device-test switches (issue #377): `quality=low|medium|high|ultra` picks a level without the
 * menu, `off=ao,msaa,...` turns Ultra's parts off one at a time to read what each pass costs
 * (names in `src/data/graphics-switches.json`). Applied to the settings in memory; returns true when
 * anything was set, so the caller does not save them. Unknown names are ignored.
 */
export function applyGraphicsOverrides(
  search: string,
  settings: Pick<Settings, 'quality' | 'effects'>,
): boolean {
  const { quality, off } = parse(search);
  if (quality) settings.quality = quality;
  for (const name of off) settings.effects = { ...settings.effects, [NAMES[name]!]: false };
  return quality !== null || off.length > 0;
}

/** The words for a pasted report: the look, the forced level and the switches that were off. */
export function describeOverrides(search: string): string {
  const { quality, off } = parse(search);
  return [
    `look ${terrainLook(search)}`,
    quality ? `quality forced ${quality}` : '',
    off.length ? `off ${off.join(',')}` : 'all effects on',
  ]
    .filter(Boolean)
    .join(' · ');
}
