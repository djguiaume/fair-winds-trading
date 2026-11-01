import { SHIP_FILES } from '../../data/ships';
import { PROP_RECIPES, type RecipePart } from '../../data/props';
import { type Catalogue, type Appearance, RULES, resolveAppearance } from '../../sim/cosmetics';
import { FLAGS } from '../../sim/regatta';
import { emblemShapes, flagSvg } from '../../ui/lookPictures';

/**
 * A flat side view of a boat wearing a look, as SVG: the hull in her class colours, the sail with
 * its pattern and emblem, the flag, the figurehead and the wake. A sketch to judge colours and
 * combinations while editing; the 3D boat is in the game and the model sheet. Shared by the
 * Cosmetics page and `npm run cosmetics -- shot`.
 */
const SAIL = 'M100 12 L100 98 L26 98 L46 40 Z';
const SAIL_FOOT = 74;
const SAIL_HEIGHT = 86;

export function lookSvg(cat: Catalogue, want: Partial<Appearance>, shipClass: string): string {
  const { look, problems } = resolveAppearance(cat, want, shipClass, FLAGS);
  const model = SHIP_FILES.find((s) => s.id === shipClass)?.model;
  const hull = model?.hullColor ?? '#9a5a2a';
  const band = look.hull.band ?? model?.bandColor ?? '#2f6f9f';
  const [c1 = band, c2 = '#f4f1e8'] = look.sail.pattern.colours;
  const bands =
    look.sail.pattern.kind === 'plain'
      ? ''
      : `<g clip-path="url(#sail)"><rect x="20" y="84" width="90" height="14" fill="${c1}"/><rect x="20" y="12" width="90" height="10" fill="${c1}"/><rect x="90" y="12" width="4" height="86" fill="${c2}"/></g>`;
  const logo = look.sail.logo ? emblem(look.sail.logo.svg, look.sail.logo.colour) : '';
  const flag = look.flag ? flagSvg(look.flag, 26).replace('<svg ', '<svg x="100" y="2" ') : '';
  const head = look.figurehead ? figureheadSvg(look.figurehead.recipe, look.figurehead.size) : '';
  const strake = look.hull.strake
    ? `<rect x="36" y="118" width="124" height="3" fill="${look.hull.strake}"/>`
    : '';
  const wake = `<path d="M30 132 Q60 140 90 132 T150 132" fill="none" stroke="${look.wake.tint ?? '#ffffff'}" stroke-width="${look.wake.style === 'plain' ? 2 : 4}" stroke-dasharray="${look.wake.style === 'bubbles' ? '1 6' : look.wake.style === 'plain' ? '' : '10 4'}" stroke-linecap="round" opacity="0.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="200" height="150" role="img" aria-label="${shipClass}${problems.length ? ': ' + problems.join('; ') : ''}"><defs><clipPath id="sail"><path d="${SAIL}"/></clipPath></defs><rect width="200" height="150" fill="#bfe3f0"/><path d="M0 128 H200 V150 H0 Z" fill="#6fb6d0"/>${wake}<path d="M34 106 H166 L156 128 H48 Z" fill="${hull}" stroke="#22252a"/><rect x="38" y="110" width="124" height="6" fill="${band}"/>${strake}${head}<rect x="98" y="10" width="3" height="96" fill="#5a3d24"/><path d="${SAIL}" fill="${look.sail.cloth}" stroke="#22252a"/>${bands}${logo}${flag}</svg>`;
}

/** The emblem at the size and place `rules.json` gives: a share of the sail's width, centred, upper third. */
function emblem(svg: string, colour: string): string {
  const size = RULES.emblem.width * SAIL_FOOT;
  const y = 12 + RULES.emblem.centreV * SAIL_HEIGHT - size / 2;
  return `<g fill="${colour}"><svg x="${(100 - 4 - size).toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" viewBox="0 0 32 32">${emblemShapes(svg)}</svg></g>`;
}

const n = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);
const HULL_PX = 132;

interface Piece {
  svg: string;
  /** Where it reaches along the bow (z) and up (y), in recipe units. */
  box: [number, number, number, number];
}

/** The way a part's long axis points after its turns: along y (up), z (the bow) or x (across). */
function axisOf(p: RecipePart): 'x' | 'y' | 'z' {
  for (const [op, a] of p.ops ?? []) {
    if (op === 'turnX' && Math.abs(n(a)) > 1) return 'z';
    if (op === 'turnZ' && Math.abs(n(a)) > 1) return 'x';
  }
  return 'y';
}

/** One recipe part seen from the side (bow to the right, z across and y up). */
function sidePiece(p: RecipePart): Piece | null {
  const y = n(p.at?.[1]);
  const z = n(p.at?.[2]);
  const scale = (p.ops ?? []).find((o) => o[0] === 'scale');
  const [, sy, sz] = scale
    ? scale.length === 4
      ? [n(scale[1], 1), n(scale[2], 1), n(scale[3], 1)]
      : [n(scale[1], 1), n(scale[1], 1), n(scale[1], 1)]
    : [1, 1, 1];
  const color = typeof p.color === 'string' ? p.color : '#999999';
  const axis = axisOf(p);
  let w: number;
  let h: number;
  let kind: 'rect' | 'tri' | 'disc' = 'rect';
  if (p.box) [w, h] = [n(p.box[2]) * sz, n(p.box[1]) * sy];
  else if (p.cyl || p.cone) {
    const [r, len] = p.cyl
      ? [Math.max(n(p.cyl[0]), n(p.cyl[1])), n(p.cyl[2])]
      : [n(p.cone![0]), n(p.cone![1])];
    [w, h] =
      axis === 'z'
        ? [len * sz, r * 2 * sy]
        : axis === 'x'
          ? [r * 2 * sz, r * 2 * sy]
          : [r * 2 * sz, len * sy];
    if (p.cone) kind = axis === 'z' ? 'tri' : 'tri';
    if (p.cyl && axis === 'x') kind = 'disc';
  } else {
    const ball = p.ico ?? p.dodeca ?? p.sphere;
    if (!ball) return null;
    [w, h, kind] = [n(ball[0]) * 2 * sz, n(ball[0]) * 2 * sy, 'disc'];
  }
  const [x0, x1, y0, y1] = [z - w / 2, z + w / 2, y - h / 2, y + h / 2];
  const at = `cx="${z}" cy="${-y}"`;
  const svg =
    kind === 'disc'
      ? `<ellipse ${at} rx="${w / 2}" ry="${h / 2}" fill="${color}"/>`
      : kind === 'tri'
        ? axis === 'z'
          ? `<polygon points="${x0},${-y1} ${x0},${-y0} ${x1},${-y}" fill="${color}"/>`
          : `<polygon points="${x0},${-y0} ${x1},${-y0} ${z},${-y1}" fill="${color}"/>`
        : `<rect x="${x0}" y="${-y1}" width="${w}" height="${h}" fill="${color}"/>`;
  return { svg, box: [x0, x1, y0, y1] };
}

/**
 * A figurehead's prop recipe as a side silhouette: its longest reach is `rules.json` ›
 * `figurehead.share` of the hull's length times the item's `size`, so every carving reads at the
 * bow whatever its recipe's own units. Seated on the stem, leaning forward and up.
 */
export function figureheadSvg(
  recipe: string,
  size = 1,
  hullPx = HULL_PX,
  bow: [number, number] = [166, 108],
): string {
  const pieces = (PROP_RECIPES[recipe]?.parts ?? [])
    .map(sidePiece)
    .filter((q): q is Piece => q !== null);
  if (!pieces.length) return '';
  const [x0, x1, y0, y1] = [0, 1, 2, 3].map((k) =>
    k % 2 ? Math.max(...pieces.map((q) => q.box[k]!)) : Math.min(...pieces.map((q) => q.box[k]!)),
  ) as [number, number, number, number];
  const scale = (RULES.figurehead.share * hullPx * size) / Math.max(x1 - x0, y1 - y0);
  const dx = bow[0] - ((x0 + x1) / 2) * scale;
  const dy = bow[1] + y0 * scale;
  return `<g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)}) scale(${scale.toFixed(2)})">${pieces.map((q) => q.svg).join('')}</g>`;
}

/** A figurehead on its own, large, for its card in the editor. */
export function figureheadCard(recipe: string, size = 1): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 56" width="160" height="112" role="img" aria-label="${recipe}"><rect width="80" height="56" fill="#bfe3f0"/>${figureheadSvg(recipe, size, 330, [40, 50])}</svg>`;
}
