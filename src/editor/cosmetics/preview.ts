import { SHIP_FILES } from '../../data/ships';
import { PROP_RECIPES, type RecipePart } from '../../data/props';
import { type Catalogue, type Appearance, RULES, resolveAppearance } from '../../sim/cosmetics';
import { FLAGS } from '../../sim/regatta';
import { flagSvg } from '../regatta/doc';

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
  return `<g fill="${colour}"><svg x="${(100 - 4 - size).toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" viewBox="0 0 32 32">${innerOf(svg)}</svg></g>`;
}

/** The shapes inside an emblem's `<svg>`. */
const innerOf = (svg: string) =>
  svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const PX = 36;
const n = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);

/** One recipe part seen from the front: its box, cylinder or cone as a flat shape, a ball as a disc. */
function partShape(p: RecipePart): string {
  const [x = 0, y = 0] = p.at ?? [];
  const scale = (p.ops ?? []).find((o) => o[0] === 'scale');
  const [sx, sy] = [n(scale?.[1], 1), n(scale?.[scale?.length === 4 ? 2 : 1], 1)];
  const color = typeof p.color === 'string' ? p.color : '#999999';
  const cx = n(x) * PX;
  const cy = -n(y) * PX;
  const shape = (w: number, h: number, kind: 'rect' | 'tri' | 'disc') => {
    const [W, H] = [w * PX * sx, h * PX * sy];
    if (kind === 'disc')
      return `<ellipse cx="${cx}" cy="${cy}" rx="${W / 2}" ry="${H / 2}" fill="${color}"/>`;
    if (kind === 'tri')
      return `<polygon points="${cx - W / 2},${cy + H / 2} ${cx + W / 2},${cy + H / 2} ${cx},${cy - H / 2}" fill="${color}"/>`;
    return `<rect x="${cx - W / 2}" y="${cy - H / 2}" width="${W}" height="${H}" fill="${color}"/>`;
  };
  if (p.box) return shape(n(p.box[0]), n(p.box[1]), 'rect');
  if (p.cyl) return shape(n(p.cyl[0]) * 2, n(p.cyl[2]), 'rect');
  if (p.cone) return shape(n(p.cone[0]) * 2, n(p.cone[1]), 'tri');
  const ball = p.ico ?? p.dodeca ?? p.sphere;
  return ball ? shape(n(ball[0]) * 2, n(ball[0]) * 2, 'disc') : '';
}

/** A figurehead's prop recipe as a front-view silhouette, standing on the bow at its size. */
export function figureheadSvg(recipe: string, size = 1): string {
  const parts = PROP_RECIPES[recipe]?.parts ?? [];
  return `<g transform="translate(166 108) scale(${size * 0.6})">${parts.map(partShape).join('')}</g>`;
}

/** A figurehead on its own, for its card in the editor. */
export function figureheadCard(recipe: string, size = 1): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -50 80 56" width="160" height="112" role="img" aria-label="${recipe}"><rect x="-40" y="-50" width="80" height="56" fill="#bfe3f0"/><g transform="scale(${size})">${(PROP_RECIPES[recipe]?.parts ?? []).map(partShape).join('')}</g></svg>`;
}
