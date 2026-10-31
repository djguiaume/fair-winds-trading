import { num, type TuningMeta } from './tuning-meta-types';

/**
 * `waves.json › drag` (issue #284, decision 0256): how much the waves slow a ship, the same on
 * every level. A share of her flat-water speed, never a boost, never sideways; the polars, the
 * no-go zone, the rudder and docking are untouched. Settings › Waves slow the boat turns it off.
 */
export const SEA_DRAG_META: Readonly<Record<string, TuningMeta>> = {
  'waves.drag.perUnit': num(
    'Drag per wave height',
    0,
    0.2,
    0.005,
    '/u',
    'Share of her speed a small hull loses head on to 1 unit of weighted wave height (swell plus chop below).',
  ),
  'waves.drag.swell': num(
    'Swell weight',
    0,
    2,
    0.05,
    '×',
    "How much the swell's height counts toward the drag.",
  ),
  'waves.drag.chop': num(
    'Chop weight',
    0,
    2,
    0.05,
    '×',
    "How much the chop's height counts toward the drag (short seas stop her less than you'd think).",
  ),
  'waves.drag.head': num(
    'Head sea',
    0,
    1,
    0.05,
    '×',
    'Share of the drag with her bow straight into the waves.',
  ),
  'waves.drag.beam': num(
    'Beam sea',
    0,
    1,
    0.05,
    '×',
    'Share of the drag with the waves on her side, and in a confused sea from every way.',
  ),
  'waves.drag.following': num(
    'Following sea',
    0,
    1,
    0.05,
    '×',
    'Share of the drag with the waves from dead astern. Never a boost: there is no surfing.',
  ),
  'waves.drag.small.radius': num(
    'Small hull',
    1,
    12,
    0.1,
    'u',
    'Hull radius (the ship file) of a small ship, that feels the full drag share below.',
  ),
  'waves.drag.small.share': num(
    'Small hull share',
    0,
    1.5,
    0.05,
    '×',
    'Share of the drag a small ship (and anything smaller) feels.',
  ),
  'waves.drag.big.radius': num(
    'Big hull',
    1,
    15,
    0.1,
    'u',
    'Hull radius of a big ship, that feels the big share; ships in between by size.',
  ),
  'waves.drag.big.share': num(
    'Big hull share',
    0,
    1.5,
    0.05,
    '×',
    'Share of the drag a big ship (and anything bigger) feels.',
  ),
  'waves.drag.max': num(
    'Most drag',
    0,
    0.3,
    0.01,
    undefined,
    'The most of her speed the sea can take, in any storm, on any level.',
  ),
  'waves.drag.sampleSec': num(
    'Sea read every',
    0.1,
    5,
    0.1,
    's',
    'How often each ship reads the sea around her for the drag.',
  ),
  'waves.drag.hudAt': num(
    'Shown from',
    0,
    0.2,
    0.005,
    undefined,
    'The HUD names the waves by the wind (Waves −4%) once they take this share of her speed.',
  ),
};
