/**
 * The logo as markup from the sprite symbols (index.html): `title` is the stacked lockup for the
 * title screen, `small` the one-line lockup for headers. `scene` draws it light with an ink halo
 * for the 3D scene; the default is ink on paper.
 */
export type LogoSize = 'title' | 'small';
export type LogoSurface = 'paper' | 'scene';

const use = (cls: string, id: string) =>
  `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}" /></svg>`;

export function logo(size: LogoSize = 'title', surface: LogoSurface = 'paper'): string {
  const small = size === 'small';
  const cls = ['logo', small ? 'logo-small' : '', surface === 'scene' ? 'logo-scene' : '']
    .filter(Boolean)
    .join(' ');
  const parts = [use('logo-rose', small ? 'logo-sm' : 'logo'), use('logo-word', 'wordmark')];
  if (!small) parts.push(use('logo-band', 'banderole'));
  return `<div class="${cls}" role="img" aria-label="Fair Winds Trading Company">${parts.join('')}</div>`;
}
