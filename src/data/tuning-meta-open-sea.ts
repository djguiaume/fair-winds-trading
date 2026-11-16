import { num, type TuningMeta } from './tuning-meta-types';

/**
 * `waves.json` › `clouds` and the swell's lines (issue #546): life on the open sea seen from above.
 * Cloud shadows are colour only, drawn with the waves on, on Medium and up; none at night or under
 * a full overcast.
 */
export const OPEN_SEA_META: Readonly<Record<string, TuningMeta>> = {
  'waves.clouds.size': num('Cloud size', 50, 800, 10, 'u', 'How wide a cloud shadow is.'),
  'waves.clouds.cover': num(
    'Cloud cover',
    0,
    1,
    0.01,
    undefined,
    'Noise levels a shadow fades in between: lower = more of the sea in shade; closer together = a harder edge.',
  ),
  'waves.clouds.shade': num(
    'Cloud shade',
    0,
    0.4,
    0.01,
    undefined,
    "How much darker the sea is under a cloud, in full sun with the sky full of clouds (it follows the sky's low cloud amount).",
  ),
  'waves.clouds.gloomGone': num(
    'Gone in gloom',
    0.1,
    1,
    0.05,
    undefined,
    'Overcast where the shadows are gone: the sun is hidden, so nothing casts them.',
  ),
  'waves.clouds.speed': num('Cloud drift', 0, 10, 0.1, 'u/s', 'How fast they drift in a calm.'),
  'waves.clouds.speedPerKn': num(
    'Cloud speed',
    0,
    2,
    0.05,
    'u/s per kn',
    'How much faster they drift downwind for each knot of wind.',
  ),
  'waves.look.swellTone': num(
    'Swell lines',
    0,
    1,
    0.05,
    undefined,
    "How much darker the swell's troughs are than its crests: the long lines seen from above.",
  ),
};
