import { num, toggle, type TuningMeta } from './tuning-meta-types';

/** `graphics.json › quality` and `auto`: the quality levels and Auto's step down (decision 0247). */
export const QUALITY_META: Readonly<Record<string, TuningMeta>> = {
  'graphics.quality.*.maxRenderPixels': num(
    'Most pixels drawn',
    100_000,
    4_000_000,
    50_000,
    'px',
    'Largest 3D picture the level draws; a bigger screen draws fewer pixels, scaled up. Weak tablets are limited by how many pixels they shade (decisions 0240, 0247).',
  ),
  'graphics.quality.*.pixelRatioCap': num(
    'Pixel ratio cap',
    0.5,
    2,
    0.05,
    '×',
    'Most screen pixels per CSS pixel the level draws.',
  ),
  'graphics.quality.*.oceanSegments': num(
    'Ocean grid',
    24,
    200,
    4,
    'cells',
    'Cells per side of the sea grid; Ultra-low reads the shore at its points, so it needs a fine one.',
  ),
  'graphics.quality.*.windStreaks': num(
    'Wind streaks',
    0,
    120,
    1,
    undefined,
    'Wind streaks drawn.',
  ),
  'graphics.quality.*.rainDrops': num('Rain drops', 0, 500, 10, undefined, 'Rain streaks drawn.'),
  'graphics.quality.*.shadows': toggle('Shadows', 'Real shadow map for island props.'),
  'graphics.quality.*.antialias': toggle(
    'Antialiasing',
    'Multisampled canvas: costs a weak tablet a lot. Ultra multisamples its own target instead (decision 0246).',
  ),
  'graphics.quality.*.fancyWater': toggle('Moving foam', 'Moving foam and ripples on the sea.'),
  'graphics.quality.*.chartFogBlur': toggle(
    'Blurred chart fog',
    'Soft fog-of-war edge on the chart.',
  ),
  'graphics.quality.*.waterReflection': toggle('Sky reflection', 'Sky reflection and sun glint.'),
  'graphics.quality.*.ultra': toggle(
    'Ultra pipeline',
    'Tone mapping, soft shadows, occlusion and haze (decision 0221).',
  ),
  'graphics.quality.*.plain': toggle(
    'Plain water and ground',
    'No per-pixel lighting: shore and depth read per vertex, ground without noise (decision 0247).',
  ),
  'graphics.quality.*.lowDetail': toggle(
    'Low detail boats',
    'Simple rig, calm heel and short bow waves.',
  ),
  'graphics.auto.minFps': num(
    'Auto: frame budget',
    20,
    60,
    1,
    'fps',
    'Auto drops one level when the frames run slower than this, down to Ultra-low.',
  ),
  'graphics.auto.windowSec': num(
    'Auto: measured over',
    0.5,
    5,
    0.1,
    's',
    'Frames are averaged over this long before Auto decides.',
  ),
  'graphics.auto.firstSec': num(
    'Auto: first wait',
    0,
    10,
    0.5,
    's',
    'No drop before this long after the start, while the first islands build.',
  ),
  'graphics.auto.cooldownSec': num(
    'Auto: wait between drops',
    1,
    20,
    0.5,
    's',
    'Time a new level gets to settle before Auto may drop again.',
  ),
};
