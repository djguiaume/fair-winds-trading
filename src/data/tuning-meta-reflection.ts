import { num, toggle, type TuningMeta } from './tuning-meta-types';

/** The levels that have cost knobs (`graphics.json › reflection.levels`). */
const LEVELS = ['ultra', 'high'] as const;

/** One level's knobs, keyed without the level. */
const LEVEL_META: Readonly<Record<string, TuningMeta>> = {
  resolution: num(
    'Reflection resolution',
    0.1,
    1,
    0.05,
    '×',
    'Share of the screen resolution the reflection is drawn at; the fill rate it costs grows with its square.',
  ),
  everyFrames: num(
    'Redraw every',
    1,
    4,
    1,
    'frames',
    '1 redraws the reflection each frame; 2 every other frame (the boats lag half a frame behind).',
  ),
  range: num(
    'Island range',
    40,
    400,
    10,
    'units',
    'Islands farther than this from where the camera looks are left out of the reflection.',
  ),
  islands: toggle(
    'Islands reflected',
    'Off: only the boats and the sky are mirrored, which costs fewer draw calls.',
  ),
};

/**
 * `graphics.json › reflection`: the sea's planar reflections of the boats, the islands and the
 * drawn sky (issue #285, decision 0292). The look is shared; each level that mirrors
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
  'graphics.reflection.soften.across': num(
    'Blur across',
    0,
    4,
    0.25,
    'texels',
    'How far the reflection is softened sideways, against the stair steps of its smaller texture.',
  ),
  'graphics.reflection.soften.down': num(
    'Stretch down',
    0,
    10,
    0.5,
    'texels',
    'How far the reflection is drawn out up and down, as on real water; a lit window becomes a streak.',
  ),
  'graphics.reflection.soften.ripple': num(
    'Ripple sway',
    0,
    0.02,
    0.001,
    undefined,
    'How far small ripples sway the reflection, even on a calm quay; 0 lets flat water turn to glass.',
  ),
  'graphics.reflection.soften.dim': num(
    'Reflected light',
    0.3,
    1,
    0.05,
    '×',
    'How much of a reflected thing’s light the water sends back: below 1, a reflection is dimmer than what it shows.',
  ),
  ...Object.fromEntries(
    LEVELS.flatMap((level) =>
      Object.entries(LEVEL_META).map(([key, meta]) => [
        `graphics.reflection.levels.${level}.${key}`,
        meta,
      ]),
    ),
  ),
};
