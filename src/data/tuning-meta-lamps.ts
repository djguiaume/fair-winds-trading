import { num, type TuningMeta } from './tuning-meta-types';

/** `graphics.json › lamps`: the glow round every night lamp (issue #543). */
export const LAMPS_META: Readonly<Record<string, TuningMeta>> = {
  'graphics.lamps.core': num(
    'Lamp core',
    0,
    0.3,
    0.01,
    undefined,
    'Radius of a night lamp’s solid bright core, as a share of its glow (issue #543).',
  ),
  'graphics.lamps.falloff': num(
    'Lamp falloff',
    0.05,
    0.5,
    0.01,
    undefined,
    'How far a lamp’s glow reaches past its core before it fades; larger is a wider halo.',
  ),
  'graphics.lamps.peak': num(
    'Lamp glow strength',
    0.2,
    1,
    0.05,
    undefined,
    'Brightness of the glow just outside the core; kept below 1 so lamps never clip to white.',
  ),
  'graphics.lamps.lanternSize': num(
    'Lantern glow size',
    4,
    30,
    0.5,
    'units',
    'Size of the pier, town and boat lantern glows (the masthead lantern too).',
  ),
  'graphics.lamps.beaconSize': num(
    'Beacon glow size',
    6,
    40,
    0.5,
    'units',
    'Size of the flashing beacon and lit landmark glows.',
  ),
};
