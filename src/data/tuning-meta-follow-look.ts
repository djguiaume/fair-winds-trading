import { num, type TuningMeta } from './tuning-meta-types';

/**
 * Sea effects first tuned from above, retuned for the low follow cam (issues #540, #541):
 * `graphics.json › windStreaks` and `› beams`.
 */
export const FOLLOW_LOOK_META: Readonly<Record<string, TuningMeta>> = {
  'graphics.windStreaks.halfWidth': num(
    'Streak half width',
    0.02,
    0.3,
    0.01,
    'units',
    'Half the width of a wind streak seen from the sea camera.',
  ),
  'graphics.windStreaks.lift': num(
    'Streak height',
    0,
    4,
    0.1,
    'units',
    'How high above the still sea the streaks lie, seen from the sea camera.',
  ),
  'graphics.windStreaks.chase.halfWidth': num(
    'Follow cam streak half width',
    0.01,
    0.2,
    0.005,
    'units',
    'Half the width of a streak in the follow cam: thin, so no streak reads as a bar.',
  ),
  'graphics.windStreaks.chase.lift': num(
    'Follow cam streak height',
    0,
    3,
    0.1,
    'units',
    'How high above the still sea the streaks lie in the follow cam; low, so they sit on the water.',
  ),
  'graphics.windStreaks.chase.fadeFrom': num(
    'Follow cam streaks hidden within',
    0,
    80,
    1,
    'units',
    'Streaks closer to the follow cam than this do not show at all.',
  ),
  'graphics.windStreaks.chase.fadeTo': num(
    'Follow cam streaks full from',
    1,
    150,
    1,
    'units',
    'Streaks farther from the follow cam than this show fully; in between they fade in.',
  ),
  'graphics.windStreaks.chase.alpha': num(
    'Follow cam streak strength',
    0,
    1.5,
    0.05,
    '×',
    'How strongly the streaks show in the follow cam against the sea camera.',
  ),
  'graphics.beams.radius': num(
    'Beam end radius',
    1,
    20,
    0.5,
    'units',
    'How wide a lighthouse beam spreads at its far end.',
  ),
  'graphics.beams.length': num(
    'Beam length',
    10,
    150,
    5,
    'units',
    'How far a lighthouse beam reaches before it has faded out.',
  ),
  'graphics.beams.opacity': num(
    'Beam brightness',
    0,
    1,
    0.01,
    undefined,
    'A beam’s brightness at the lamp at full night.',
  ),
  'graphics.beams.fade': num(
    'Beam fade',
    0.3,
    4,
    0.1,
    undefined,
    'How fast a beam fades away from the lamp: 1 evenly, higher sooner.',
  ),
  'graphics.beams.edge': num(
    'Beam edge softness',
    0,
    4,
    0.1,
    undefined,
    'How much a beam fades where its side is seen edge-on; 0 is a solid tube.',
  ),
};
