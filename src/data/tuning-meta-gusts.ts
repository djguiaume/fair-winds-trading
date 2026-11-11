import { num, type TuningMeta } from './tuning-meta-types';

/**
 * `waves.json` › `gusts` (issue #498, decision 0295): the wind's gusts on the sea, soft darker
 * patches that run downwind with lighter slicks between. Colour only; drawn with the waves on, on
 * the levels with `graphics.quality.*.gusts`. The art bible keeps a patch within about 8% of the
 * water's colour, never white.
 */
export const GUSTS_META: Readonly<Record<string, TuningMeta>> = {
  'waves.gusts.length': num('Gust length', 10, 150, 1, 'u', 'Size of a patch along the wind.'),
  'waves.gusts.width': num('Gust width', 10, 150, 1, 'u', 'Size of a patch across the wind.'),
  'waves.gusts.speedPerKn': num(
    'Gust speed',
    0,
    1,
    0.05,
    'u/s per kn',
    'How fast the patches run downwind for each knot of wind.',
  ),
  'waves.gusts.wind': num(
    'Gusts from',
    0,
    30,
    0.5,
    'kn',
    'Wind where the gusts start to show (a flat calm has none), and where they are full.',
  ),
  'waves.gusts.cover': num(
    'Gust cover',
    0,
    1,
    0.02,
    undefined,
    'Noise levels a patch fades in between: lower = more of the sea ruffled; closer together = a harder edge.',
  ),
  'waves.gusts.darken': num(
    'Gust darkening',
    0,
    0.1,
    0.005,
    undefined,
    'How much darker the water is inside a patch (share of its colour); with the ruffle, at most about 8%.',
  ),
  'waves.gusts.slick': num(
    'Slick lightening',
    0,
    0.06,
    0.005,
    undefined,
    'How much lighter the calm water between the patches is.',
  ),
  'waves.gusts.ruffle': num(
    'Gust ruffle',
    0,
    0.04,
    0.005,
    undefined,
    'Fine light and dark flecks inside a patch (never white); they fade out toward the horizon.',
  ),
  'waves.gusts.reflect': num(
    'Sky kept in a gust',
    0,
    1,
    0.05,
    undefined,
    "Share of the sky's reflection left inside a patch: ruffled water breaks it up.",
  ),
  'waves.gusts.mirror': num(
    'Mirror kept in a gust',
    0,
    1,
    0.05,
    undefined,
    'Share of the mirrored boats and islands left inside a patch.',
  ),
  'waves.gusts.night': num(
    'Gusts at night',
    0,
    1,
    0.05,
    undefined,
    'Share of the gusts kept at night (the art bible asks for half).',
  ),
};
