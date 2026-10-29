import { WOODS_HINTS, WOODS_TOOLS, type WoodsBrush } from './groves';

/** The island builder's ground and lane tools: their ids, hints and buttons (decision 0105). */
export type ShapeTool =
  | 'plateau'
  | 'mountain'
  | 'lake'
  | 'ramp'
  | WoodsBrush
  | 'lane'
  | 'path'
  | 'stairs'
  | 'river'
  | 'lava';

/** What the hint line says while a tool is out. */
export const TOOL_HINTS: Record<ShapeTool, string> = {
  plateau: 'Click the island to add raised ground there · Esc cancels',
  mountain: 'Click the island to add a mountain · Esc cancels',
  lake: 'Click the island to add the lake · Esc cancels',
  ramp: 'Click the foot of the ramp, then its bends, then its top; click the top again or press Enter · Esc cancels',
  ...WOODS_HINTS,
  lane: 'Click to add bends; click the last point again or press Enter to finish · Esc cancels',
  path: 'Click to add bends; click the last point again or press Enter to finish · Esc cancels',
  stairs: 'Click the foot and the top of a cliff (and any bends); Enter finishes · Esc cancels',
  river:
    'Click the source, then bends down to the mouth (past the coast it falls into the sea); Enter finishes · Esc cancels',
  lava: 'Click the source, then bends down to the mouth (past the coast it steams in the sea); Enter finishes · Esc cancels',
};

/** The tool buttons by tab: [group, id, icon, "Name: what it does"]. */
export const TOOLS: Record<'ground' | 'lanes', [string, string | ShapeTool, string, string][]> = {
  ground: [
    ['Ground', 'coast', '🏝️', 'Coast: Drag a point, or a ring on an edge to add one'],
    ['Ground', 'plateau', '⛰️', 'Raised ground: A plateau or terrace, with cliff or slope edges'],
    ['Ground', 'mountain', '🗻', 'Mountain: A rocky peak'],
    ['Ground', 'lake', '💧', 'Lake: Inland water, kept clear of homes'],
    [
      'Ground',
      'ramp',
      '↗️',
      'Ramp: Draw its path; it climbs evenly from its start to its end height',
    ],
    ...WOODS_TOOLS,
  ],
  lanes: [
    ['Lanes', 'lane', '〰️', 'Lane: Shows near the homes standing at each level'],
    ['Lanes', 'path', '┈', 'Path: Always shown'],
    ['Lanes', 'stairs', '🪜', 'Stairs: Climb a cliff between two ground levels'],
    ['Rivers', 'river', '🏞️', 'River: Water down the land, falls at cliffs and into the sea'],
    ['Rivers', 'lava', '🌋', 'Lava river: Glows at night, steams where it meets the sea'],
  ],
};
