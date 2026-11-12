import { num, type TuningMeta } from './tuning-meta-types';

/**
 * Work the game spreads over frames so none stalls (issue #516): a grown town's rebuild, a new
 * level's ground, and the other boats' water grids.
 */
export const SMOOTHNESS_META: Readonly<Record<string, TuningMeta>> = {
  'graphics.builds.msPerFrame': num(
    'Builds: time a frame',
    1,
    16,
    0.5,
    'ms',
    "How long each frame may spend rebuilding a grown town or a new level's ground: less keeps frames smooth, more shows the change sooner.",
  ),
  'seamanship.traffic.gridCellsPerStep': num(
    'Grid cells a step',
    50,
    5000,
    50,
    'cells',
    "How many cells of a fleet's water grid the helms fill each step: fewer keep frames smooth, more find the way by water sooner.",
  ),
};
