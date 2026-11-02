/*
 * The little pictures of the help screen and the sailing tips: pen drawings in the theme's ink,
 * with sage for the line to sail and a hatch for the no-go zone, as on the wind compass. Colours
 * come from the classes in help.css, so they follow the day and night paper.
 */

const HATCH =
  '<defs><pattern id="art-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" class="art-line art-thin"/></pattern></defs>';

const BOAT = 'M-14 0C-6-7 8-7 14-4V4C8 7-6 7-14 0z';

const svg = (box: string, body: string) =>
  `<svg class="help-art" viewBox="${box}" aria-hidden="true">${body}</svg>`;

/** The no-go wedge hatched, the fast bands sage, the wind coming down on the boat. */
const wind = () =>
  svg(
    '-60 -50 120 100',
    `${HATCH}<circle r="40" class="art-line art-thin"/>
     <path d="M0 0L-21-34A40 40 0 0 1 21-34z" fill="url(#art-hatch)" class="art-line art-thin"/>
     <path d="M-37.6-13.7A40 40 0 0 0-13.7 37.6M37.6-13.7A40 40 0 0 1 13.7 37.6" class="art-sage"/>
     <path d="M0-48V-22M-6-28L0-20 6-28" class="art-line"/>
     <path d="${BOAT}" class="art-paper"/>`,
  );

const tack = () =>
  svg(
    '0 0 200 130',
    `<path d="M25 10V40M45 10V40M20 34L25 42 30 34M40 34L45 42 50 34" class="art-line art-thin"/>
     <path d="M130 118L80 90 130 62 80 34 108 16" class="art-sage"/>
     <circle cx="112" cy="13" r="6" class="art-ink-fill"/>
     <path d="M126 106L140 126 124 120 118 124z" class="art-paper"/>`,
  );

const trade = () =>
  svg(
    '0 0 200 100',
    `<g class="art-icon"><use href="#i-fish" x="10" y="26" width="48" height="48"/>
     <use href="#i-coin" x="142" y="28" width="44" height="44"/></g>
     <path d="M66 50H128M122 42L134 50 122 58" class="art-line art-dash"/>`,
  );

const strong = () =>
  svg(
    '0 0 200 110',
    `<path d="M14 30H58M8 48H62M18 66H54M52 22L64 30 52 38M56 40L68 48 56 56" class="art-line art-thin"/>
     <g transform="rotate(24 112 88)"><path d="M112 12V86L150 86z" class="art-paper"/>
     <path d="M84 88H146L136 100H94z" class="art-paper"/></g>
     <rect x="158" y="80" width="14" height="14" rx="2" class="art-paper" transform="rotate(18 165 87)"/>
     <path d="M150 104C162 98 176 98 190 104" class="art-line art-thin"/>
     <rect x="24" y="86" width="40" height="16" rx="8" class="art-ink-fill"/>`,
  );

/** The four cards of the help screen, in order. */
export const HELP_ART = { wind, tack, trade, strong } as const;

/** The sailing tips' picture: the wind down the page, the boat's zigzag up it. */
export function tackDiagram(title: string, desc: string, windWord: string, zigzag: string): string {
  return `<svg class="help-diagram" viewBox="0 0 260 160" role="img" aria-label="${title}. ${desc}">
    <defs><marker id="tack-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" class="art-ink-fill"/></marker></defs>
    <path d="M30 18V56M55 18V56M80 18V56" class="art-line" marker-end="url(#tack-arrow)"/>
    <text x="25" y="78" class="art-text">${windWord}</text>
    <path d="M162 144L102 104 162 64 114 30" class="art-sage" marker-end="url(#tack-arrow)"/>
    <circle cx="114" cy="20" r="5" class="art-ink-fill"/>
    <path d="M160 137L169 151 157 147 152 151z" class="art-paper"/>
    <text x="184" y="103" class="art-text">${zigzag}</text></svg>`;
}
