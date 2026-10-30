import graphics from '../data/tuning/graphics.json';
import type { GraphicsEffects } from '../render/ultraPipeline';
import type { QualityLevel } from '../render/quality';

const LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

export interface GraphicsOverrides {
  /** `quality=ultra`: the level to draw at, whatever Settings or auto say (issue #377). */
  quality: QualityLevel | null;
  /** `off=ao,msaa`: the effects to leave out, by their `urlSwitches` names, in the order given. */
  off: (keyof GraphicsEffects)[];
}

const NAMES = graphics.urlSwitches as Record<string, keyof GraphicsEffects>;

/**
 * Device-test switches (issue #377): `quality=low|medium|high|ultra` picks a level without the
 * menu, `off=` turns Ultra's parts off one at a time to read what each pass costs. With neither
 * set the game is unchanged. Unknown names are ignored.
 */
export function graphicsOverrides(search: string): GraphicsOverrides {
  const params = new URLSearchParams(search);
  const quality = params.get('quality') as QualityLevel | null;
  const off = (params.get('off') ?? '')
    .split(',')
    .map((name) => NAMES[name.trim().toLowerCase()])
    .filter(
      (effect, i, all): effect is keyof GraphicsEffects => !!effect && all.indexOf(effect) === i,
    );
  return { quality: quality && LEVELS.includes(quality) ? quality : null, off };
}

/** The words for a pasted report: the look, and the switches that were forced. */
export function describeOverrides(look: string, o: GraphicsOverrides): string {
  const names = Object.entries(NAMES);
  const off = o.off.map((effect) => names.find(([, e]) => e === effect)![0]);
  return [
    `look ${look}`,
    o.quality ? `quality forced ${o.quality}` : '',
    off.length ? `off ${off.join(',')}` : 'all effects on',
  ]
    .filter(Boolean)
    .join(' · ');
}
