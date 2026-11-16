import { num, type TuningMeta } from './tuning-meta-types';

/** `weather.json › daylight`: where the moon's arc starts and ends (issues #550, #620). */
export const DAYLIGHT_META: Readonly<Record<string, TuningMeta>> = {
  'weather.daylight.moonRise': num(
    'Moonrise',
    20,
    23,
    0.25,
    'h',
    'Clock hour the moon rises in the east; the twilight light swings round to it from the west.',
  ),
  'weather.daylight.moonSet': num(
    'Moonset',
    3,
    5.75,
    0.25,
    'h',
    'Clock hour the moon sets in the west; the light swings round to the sunrise in the east.',
  ),
};
