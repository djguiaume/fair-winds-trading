import { num, type TuningMeta } from './tuning-meta-types';

/** `ui.json`: how long the UI's moments last and where the arrival banner shows (decision 0274). */
export const UI_META: Readonly<Record<string, TuningMeta>> = {
  'ui.arrivalRadius': num(
    'Arrival banner range',
    20,
    120,
    1,
    'units',
    "The banner shows when the boat comes this close to a port's centre, never on the shoreline.",
  ),
  'ui.arrivalRearm': num(
    'Arrival banner re-arm',
    30,
    240,
    1,
    'units',
    'After the banner, the boat must sail this far from the port before it shows again.',
  ),
  'ui.arrivalMs': num('Arrival banner time', 800, 6000, 100, 'ms', 'How long the banner stays.'),
  'ui.stampMs': num('Quest stamp time', 200, 1500, 50, 'ms', 'How long the ink stamp takes.'),
  'ui.tradeRollMs': num('Gold roll time', 100, 1500, 50, 'ms', 'A buy or sale rolls the gold.'),
  'ui.countdownFrom': num(
    'Horn countdown starts',
    3,
    30,
    1,
    's',
    'The race banner counts from here to the horn ("Horn in 10").',
  ),
  'ui.duskFadeMs': num(
    'Dusk fade',
    0,
    30000,
    500,
    'ms',
    'The paper cross-fades to the night paper over this time.',
  ),
};
