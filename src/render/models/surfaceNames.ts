import { PALETTE, type RecipePart } from '../../data/props';
import { SURFACE_KINDS, type SurfaceKind } from '../surfaceGlsl';

/**
 * Which surface pattern a prop part takes (issue #572), from its colour's name: `palette.json ›
 * surfaces` (`plank` → planks, `walls` → plaster, `roofs` → tiles), which an island style may
 * change (`styles.stone.surfaces`: stone walls, slate roofs). A part's own `surface` wins; "none"
 * keeps it plain. Hex colours have no name and stay plain.
 */
export function surfaceOfPart(
  part: Pick<RecipePart, 'color' | 'surface'>,
  style: { surfaces?: Record<string, string> } | undefined,
): SurfaceKind | undefined {
  const named = part.surface ?? kindOfName(colourName(part.color), style);
  return isSurfaceKind(named) ? named : undefined;
}

export const isSurfaceKind = (name: string | undefined): name is SurfaceKind =>
  (SURFACE_KINDS as readonly string[]).includes(name ?? '');

/** Every name `palette.json › surfaces` and the styles map that is not a pattern, for the checks. */
export function unknownSurfaces(): string[] {
  const maps = [
    ['surfaces', PALETTE.surfaces],
    ...Object.entries(PALETTE.styles).map(([id, s]) => [`styles.${id}.surfaces`, s.surfaces ?? {}]),
  ] as const;
  return maps.flatMap(([where, map]) =>
    Object.entries(map)
      .filter(([, kind]) => !isSurfaceKind(kind))
      .map(([name, kind]) => `${where}.${name}: "${kind}" is not a pattern`),
  );
}

function kindOfName(name: string | undefined, style?: { surfaces?: Record<string, string> }) {
  if (!name) return undefined;
  return style?.surfaces?.[name] ?? PALETTE.surfaces[name];
}

/** The palette name a colour is written with (`walls[variant]` → walls; a lean-to its roof's). */
function colourName(color: RecipePart['color']): string | undefined {
  if (color === undefined) return undefined;
  if (typeof color === 'object') {
    if ('leanTo' in color) return colourName(color.leanTo);
    if ('of' in color) return colourName(color.of[0]);
    return undefined;
  }
  return /^(\w+)/.exec(color)?.[1];
}
