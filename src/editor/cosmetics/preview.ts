import { SHIP_FILES } from '../../data/ships';
import { type Catalogue, type Appearance, resolveAppearance } from '../../sim/cosmetics';
import { FLAGS } from '../../sim/regatta';
import { flagSvg } from '../regatta/doc';

/**
 * A flat side view of a boat wearing a look, as SVG: the hull in her class colours, the sail with
 * its pattern and emblem, the flag, the figurehead and the wake. A sketch to judge colours and
 * combinations while editing; the 3D boat is in the game and the model sheet. Shared by the
 * Cosmetics page and `npm run cosmetics -- shot`.
 */
export function lookSvg(cat: Catalogue, want: Partial<Appearance>, shipClass: string): string {
  const { look, problems } = resolveAppearance(cat, want, shipClass, FLAGS);
  const model = SHIP_FILES.find((s) => s.id === shipClass)?.model;
  const hull = model?.hullColor ?? '#9a5a2a';
  const band = look.hull.band ?? model?.bandColor ?? '#2f6f9f';
  const [c1 = band, c2 = '#f4f1e8'] = look.sail.pattern.colours;
  const sail = 'M100 12 L100 98 L38 98 Z';
  const bands =
    look.sail.pattern.kind === 'plain'
      ? ''
      : `<g clip-path="url(#sail)"><rect x="30" y="84" width="80" height="14" fill="${c1}"/><rect x="30" y="12" width="80" height="10" fill="${c1}"/><rect x="90" y="12" width="4" height="86" fill="${c2}"/></g>`;
  const logo = look.sail.logo
    ? `<g transform="translate(70 52) scale(1)" fill="${look.sail.logo.colour}"><svg width="22" height="22" viewBox="0 0 32 32">${innerOf(look.sail.logo.svg)}</svg></g>`
    : '';
  const flag = look.flag ? flagSvg(look.flag, 26).replace('<svg ', '<svg x="100" y="2" ') : '';
  const head = look.figurehead
    ? '<circle cx="164" cy="114" r="5" fill="#f2c230" stroke="#22252a"/>'
    : '';
  const strake = look.hull.strake
    ? `<rect x="36" y="118" width="124" height="3" fill="${look.hull.strake}"/>`
    : '';
  const wake = `<path d="M30 132 Q60 140 90 132 T150 132" fill="none" stroke="${look.wake.tint ?? '#ffffff'}" stroke-width="${look.wake.style === 'plain' ? 2 : 4}" stroke-dasharray="${look.wake.style === 'bubbles' ? '1 6' : look.wake.style === 'plain' ? '' : '10 4'}" stroke-linecap="round" opacity="0.8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="200" height="150" role="img" aria-label="${shipClass}${problems.length ? ': ' + problems.join('; ') : ''}"><defs><clipPath id="sail"><path d="${sail}"/></clipPath></defs><rect width="200" height="150" fill="#bfe3f0"/><path d="M0 128 H200 V150 H0 Z" fill="#6fb6d0"/>${wake}<path d="M34 106 H166 L156 128 H48 Z" fill="${hull}" stroke="#22252a"/><rect x="38" y="110" width="124" height="6" fill="${band}"/>${strake}<rect x="98" y="10" width="3" height="96" fill="#5a3d24"/><path d="${sail}" fill="${look.sail.cloth}" stroke="#22252a"/>${bands}${logo}${flag}${head}</svg>`;
}

/** The shapes inside an emblem's `<svg>`. */
const innerOf = (svg: string) =>
  svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
