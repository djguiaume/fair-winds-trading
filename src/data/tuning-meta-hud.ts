import { num, type TuningMeta } from './tuning-meta-types';

/** `hud.json`: the sea HUD's backings, idle fade and tape span (issue #441, decision 0268);
 * its sizes are theme tokens (`theme.json` › `hud`). */
export const HUD_META: Readonly<Record<string, TuningMeta>> = {
  'hud.idleFadeSec': num(
    'Idle fade after',
    1,
    30,
    0.5,
    's',
    'The status and the heading strip fade after this long without a change.',
  ),
  'hud.idleOpacity': num(
    'Faded opacity',
    0.3,
    1,
    0.05,
    '×',
    'How visible the faded status and heading strip stay (1 = no fade).',
  ),
  'hud.wakeTurnDeg': num(
    'Turn that wakes the strip',
    5,
    90,
    1,
    '°',
    'A turn this big since the strip last woke brings it back to full ink.',
  ),
  'hud.backingInk': num(
    'Instrument backing',
    0.2,
    0.8,
    0.05,
    '× ink',
    'The faint ink plate behind the wind compass and the speed instrument (art director: 40%).',
  ),
  'hud.noGoInk': num(
    'No-go wedge',
    0.3,
    0.8,
    0.05,
    '× ink',
    'The hatched no-go wedge on the wind compass (Guillaume: about 55%, never red).',
  ),
  'hud.tapeSpanDeg': num(
    'Heading tape span',
    30,
    120,
    5,
    '°',
    'How many degrees the heading tape shows on each side of the bow.',
  ),
  'hud.portSignSeaward': num(
    'Port sign seaward',
    0,
    40,
    1,
    'm',
    'Port signs stand this far out from the pier, away from the island, so they sit over water.',
  ),
  'hud.portSignChaseRange': num(
    'Port sign range, chase view',
    10,
    160,
    1,
    'm',
    'In the close chase view a port sign shows only this close to the harbour (or when moored).',
  ),
  'hud.portSignChaseMinY': num(
    'Port sign lowest foot, chase view',
    0,
    1,
    0.01,
    '× screen height',
    'In the close chase view a port sign stands no higher on screen than this, clear of the wind text.',
  ),
};
