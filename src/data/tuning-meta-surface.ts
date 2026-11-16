import { num, toggle, type TuningMeta } from './tuning-meta-types';
import { SURFACE_KINDS } from '../render/surfaceGlsl';

/** One pattern's size and contrast (`graphics.json` › `surface.patterns`). */
const pattern = (kind: string): Record<string, TuningMeta> => ({
  [`graphics.surface.patterns.${kind}.size`]: num(
    `Pattern ${kind}: size`,
    0.05,
    3,
    0.01,
    'units',
    `One ${kind} row (a plank, a course, a seam spacing) in world units; a hand is about 0.1.`,
  ),
  [`graphics.surface.patterns.${kind}.contrast`]: num(
    `Pattern ${kind}: contrast`,
    0,
    0.25,
    0.01,
    undefined,
    'How far the pattern shifts the face colour lighter or darker (0.06 = ±6 %); never a new hue.',
  ),
});

/**
 * `graphics.json` › `surface` (issue #572): soft procedural patterns near the camera, and the
 * boats' hulls shaded round between their strakes.
 */
export const SURFACE_META: Readonly<Record<string, TuningMeta>> = {
  'graphics.quality.*.surfacePatterns': toggle(
    'Surface patterns',
    'Planks, stone, plaster, tiles and sail seams on what is near the camera (issue #572).',
  ),
  'graphics.quality.*.softEdges': toggle(
    'Soft edges',
    'Boat hulls shade round between their strakes instead of in flat facets (issue #572).',
  ),
  'graphics.surface.strength': num(
    'Surface patterns: strength',
    0,
    2,
    0.05,
    undefined,
    'Scales every pattern at once: 0 none, 1 as each pattern sets.',
  ),
  'graphics.surface.fadeFrom': num(
    'Surface patterns: fade from',
    5,
    200,
    1,
    'units',
    'Looked down on (the top view), patterns start to fade at this distance from the camera.',
  ),
  'graphics.surface.fadeTo': num(
    'Surface patterns: gone at',
    10,
    300,
    1,
    'units',
    'Looked down on, patterns are gone at this distance, so the top view stays as clean as before.',
  ),
  'graphics.surface.levelFadeFrom': num(
    'Surface patterns: fade from, seen level',
    5,
    300,
    1,
    'units',
    'Seen level (the follow cam), patterns start to fade at this distance; towns stand farther there.',
  ),
  'graphics.surface.levelFadeTo': num(
    'Surface patterns: gone at, seen level',
    10,
    400,
    1,
    'units',
    'Seen level, patterns are gone at this distance.',
  ),
  'graphics.surface.smoothHulls': toggle(
    'Smooth hulls',
    'On the levels with Soft edges, hulls shade round between their strakes; the rail and keel stay crisp.',
  ),
  'graphics.surface.hullCreaseDeg': num(
    'Smooth hulls: crease',
    0,
    90,
    1,
    'deg',
    'Faces of a hull closer than this angle blend; sharper edges stay crisp.',
  ),
  ...Object.assign({}, ...SURFACE_KINDS.map(pattern)),
};
