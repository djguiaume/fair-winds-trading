import switches from '../data/graphics-switches.json';
import { terrainLook } from '../render/terrainLook';
import { QUALITY_LEVELS, type QualityLevel } from '../render/quality';
import type { Settings } from '../ui/settings';

const NAMES: Record<string, string> = switches;
/** The switches that are a Settings row of their own, not one of Ultra's effects. */
const OWN_SWITCHES = ['seaLife', 'townFolk'] as const;
type OwnSwitch = (typeof OWN_SWITCHES)[number];

function parse(search: string) {
  const params = new URLSearchParams(search);
  const quality = params.get('quality') as QualityLevel | null;
  const off = (params.get('off') ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name, i, all) => name in NAMES && all.indexOf(name) === i);
  return { quality: quality && QUALITY_LEVELS.includes(quality) ? quality : null, off };
}

/**
 * Device-test switches (issue #377): `quality=ultralow|low|medium|high|ultra` picks a level without the
 * menu, `off=ao,msaa,...` turns Ultra's parts off one at a time to read what each pass costs
 * (names in `src/data/graphics-switches.json`; `life` is Settings › Sea life, issue #476, `folk`
 * Settings › Town folk, issue #477). Applied to the settings in memory; returns true when anything
 * was set, so the caller does not save them. Unknown names are ignored.
 */
export function applyGraphicsOverrides(
  search: string,
  settings: Pick<Settings, 'quality' | 'effects' | OwnSwitch>,
): boolean {
  const { quality, off } = parse(search);
  if (quality) settings.quality = quality;
  for (const name of off) {
    const key = NAMES[name]!;
    if (OWN_SWITCHES.includes(key as OwnSwitch)) settings[key as OwnSwitch] = false;
    else settings.effects = { ...settings.effects, [key]: false };
  }
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
