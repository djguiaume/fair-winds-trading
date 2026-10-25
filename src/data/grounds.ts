import { PALETTE } from './props';

/**
 * Ground materials as data: `palette.json` › `grounds`. An island file names a ground for each
 * raised ground, ramp and peak (`grass`, `rock`, `snow`…); the island's style may swap a name for
 * its own (`styles.ice.grounds`: `grass` → `snow`), so an ice island's grass cap is snow without
 * touching the file, while a file can still name any ground outright. The beach is the ground
 * named `sand`, swapped the same way (`shingle`, black sand).
 */
export interface GroundLook {
  /** Its name in the island builder. */
  name: string;
  /** Flat tops, ramps and slopes: a palette colour name or `#rrggbb`, or a list picked per face. */
  top: string | string[];
  /** Cliff faces. */
  side: string | string[];
  /** A peak's cone; left out, `top`. */
  peak?: string | string[];
  /** A peak's faces higher than this share of its height get `cap` (a snow line). */
  capAbove?: number;
  cap?: string | string[];
  /**
   * A colour that shines at night (lava cracks): read through `groundColors`, drawn by the
   * thread that gives the ground its cracks.
   */
  glow?: string;
  /** Small dark rocks scattered over its flat tops (decision 0171: moss over old lava). */
  specks?: string;
  /** Woods may grow on it (default true). */
  trees?: boolean;
  /** A beach: what a style's `sand` may become. */
  beach?: boolean;
}

export interface StyleLook {
  walls: string[];
  roofs: string[];
  /** Grounds this style swaps: `{ "grass": "snow" }`. */
  grounds?: Record<string, string>;
  /** How wide its beach is, in island-radius units (decision 0170: the ice style's is narrow). */
  beachWidth?: number;
  /** Palette colours this style overrides for its props and paths (`path`, `pine`…). */
  colors?: Record<string, string | string[]>;
}

export const GROUNDS = (PALETTE as unknown as { grounds: Record<string, GroundLook> }).grounds;
export const STYLES = PALETTE.styles as Record<string, StyleLook>;

/** Every ground id, in the palette's order (the builder's list). */
export const GROUND_IDS = Object.keys(GROUNDS);
/** Every island style id (the builder's list). */
export const STYLE_IDS = Object.keys(STYLES);

/** The ground a file's name stands for on an island of this style. */
export function groundId(material: string, style: string): string {
  return STYLES[style]?.grounds?.[material] ?? material;
}

/** A palette colour name (or `#rrggbb`) as seen on an island of this style. */
export function styleColor(name: string, style: string): string | string[] {
  if (name.startsWith('#')) return name;
  const c = STYLES[style]?.colors?.[name] ?? PALETTE.colors[name];
  if (c === undefined) throw new Error(`Unknown colour "${name}"`);
  return c;
}

/** A colour, or a list of them, resolved to `#rrggbb` values. */
function hexes(c: string | string[], style: string): string[] {
  return (Array.isArray(c) ? c : [c]).flatMap((n) => {
    const v = styleColor(n, style);
    return Array.isArray(v) ? v : [v];
  });
}

export interface GroundColors {
  id: string;
  top: string[];
  side: string[];
  peak: string[];
  cap?: string[];
  capAbove?: number;
  glow?: string;
  specks?: string;
  trees: boolean;
}

/** A ground's colours on an island of this style: what the models paint. */
export function groundColors(material: string, style: string): GroundColors {
  const id = groundId(material, style);
  const g = GROUNDS[id];
  if (!g) throw new Error(`Unknown ground "${id}"`);
  return {
    id,
    top: hexes(g.top, style),
    side: hexes(g.side, style),
    peak: hexes(g.peak ?? g.top, style),
    cap: g.cap ? hexes(g.cap, style) : undefined,
    capAbove: g.capAbove,
    glow: g.glow ? hexes(g.glow, style)[0] : undefined,
    specks: g.specks ? hexes(g.specks, style)[0] : undefined,
    trees: g.trees ?? true,
  };
}
