import { num, toggle, type TuningMeta } from './tuning-meta-types';

/**
 * `graphics.json › reflection`: the sea's planar reflections of the boats, the islands and the
 * drawn sky (issue #285, decision 0290). The look is shared; each level that mirrors
 * (`quality.*.mirror`) has its own cost knobs under `levels`.
 */
export const REFLECTION_META: Readonly<Record<string, TuningMeta>> = {
  'graphics.reflection.strength': num(
    'Reflection strength',
    0,
    1,
    0.05,
    undefined,
    'How much of a reflected boat or island shows on the water where the sky reflection is weak (a steep view).',
  ),
  'graphics.reflection.nightStrength': num(
    'Night strength',
    0,
    1.5,
    0.05,
    '×',
    'The strength at full night against the day’s: lanterns and lit windows read well in a darker sea.',
  ),
  'graphics.reflection.distortion': num(
    'Wave distortion',
    0,
    0.3,
    0.01,
    undefined,
    'How far the waves’ slopes push the reflection about; 0 is a flat mirror.',
  ),
  'graphics.reflection.levels.*.resolution': num(
    'Reflection resolution',
    0.1,
    1,
    0.05,
    '×',
    'Share of the screen resolution the reflection is drawn at; the fill rate it costs grows with its square.',
  ),
  'graphics.reflection.levels.*.everyFrames': num(
    'Redraw every',
    1,
    4,
    1,
    'frames',
    '1 redraws the reflection each frame; 2 every other frame (the boats lag half a frame behind).',
  ),
  'graphics.reflection.levels.*.range': num(
    'Island range',
    40,
    400,
    10,
    'units',
    'Islands farther than this from where the camera looks are left out of the reflection.',
  ),
  'graphics.reflection.levels.*.islands': toggle(
    'Islands reflected',
    'Off: only the boats and the sky are mirrored, which costs fewer draw calls.',
  ),
};
