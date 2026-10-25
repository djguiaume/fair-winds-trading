import characterData from '../data/characters.json';

/**
 * Portraits of the people of the community arcs (decisions 0120, 0124): low-poly faces drawn in
 * code as SVG from a few values per person in `src/data/characters.json`, framed by a brass
 * hexagon. Every part is a polygon broken into flat-shaded facets, like the 3D islands and ships.
 * No image files: a new person, or a new look for one (Rook soaked after the wreck), is data.
 */

export type Mood = 'neutral' | 'pleased' | 'worried';
export const MOODS: readonly Mood[] = ['neutral', 'pleased', 'worried'];

export type HairStyle = 'short' | 'braid' | 'bun' | 'bald';
export type Hat = 'none' | 'cap' | 'scarf' | 'souwester';
export type Item = 'none' | 'pipe' | 'pencil' | 'chisel' | 'flour' | 'spyglass' | 'net' | 'ledger';
export const HAIR_STYLES: readonly HairStyle[] = ['short', 'braid', 'bun', 'bald'];
export const HATS: readonly Hat[] = ['none', 'cap', 'scarf', 'souwester'];
export const ITEMS: readonly Item[] = [
  'none',
  'pipe',
  'pencil',
  'chisel',
  'flour',
  'spyglass',
  'net',
  'ledger',
];

/** How a person is drawn. Colours are `#rrggbb`. */
export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  hat?: Hat;
  hatColor?: string;
  /** A small diamond on a cap (the harbourmaster's brass badge). */
  badge?: string;
  beard?: boolean;
  clothes: string;
  /** White stripes across the clothes (a fisher's jumper). */
  stripes?: string;
  apron?: string;
  /** Brass buttons down the coat. */
  buttons?: string;
  /** Stone dust on the cheeks. */
  dust?: boolean;
  item?: Item;
  /** The colour behind them, from their port. */
  backdrop: string;
  /** Soaked: darker clothes, flat hair and drips. */
  wet?: boolean;
}

export interface Character {
  id: string;
  name: string;
  /** The name dock news uses (decision 0210), when not the first word of `name` ("Ness"). */
  short?: string;
  /** English role; the UI translates it when a key exists. */
  role: string;
  /** Id of their home port in the map. */
  port: string;
  look: Look;
  /** Named changes to the look, e.g. `soaked`. */
  looks?: Record<string, Partial<Look>>;
  /** Their babble voice, an id in `audio.json` › `voices` (decision 0132). */
  voice?: string;
}

export const CHARACTERS = characterData.characters as Character[];

export function character(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

/** A person's look, with a named variant (`soaked`) applied when they have it. */
export function lookOf(c: Character, variant?: string): Look {
  return variant && c.looks?.[variant] ? { ...c.look, ...c.looks[variant] } : c.look;
}

type Pt = readonly [number, number];

/** Lighter (k > 0) or darker (k < 0) by a fraction, staying a `#rrggbb` colour. */
export function shade(c: string, k: number): string {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** A polygon as a fan of triangles from its centre, each shaded by where it faces (light top left). */
function facets(points: readonly Pt[], color: string): string {
  const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
  const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
  let s = '';
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    const k = ((mx * -0.6 + my * -0.8) / (Math.hypot(mx, my) || 1)) * 0.18;
    const f = shade(color, k);
    s += `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)}L${a[0]} ${a[1]}L${b[0]} ${b[1]}Z" fill="${f}" stroke="${f}" stroke-width=".6"/>`;
  }
  return s;
}

const HEX = 'M100 4L183 52L183 148L100 196L17 148L17 52Z';
const INK = '#1c140e';

function face(l: Look, mood: Mood): string {
  const s: string[] = [];
  const hat = l.hat ?? 'none';
  const hair = l.wet ? shade(l.hair, -0.25) : l.hair;
  const clothes = l.wet ? shade(l.clothes, -0.3) : l.clothes;
  s.push(`<rect width="200" height="200" fill="${shade(l.backdrop, 0.1)}"/>`);
  s.push(
    facets(
      [
        [0, 150],
        [70, 128],
        [130, 140],
        [200, 124],
        [200, 200],
        [0, 200],
      ],
      shade(l.backdrop, -0.2),
    ),
  );
  // Shoulders and clothes.
  s.push(
    facets(
      [
        [20, 210],
        [34, 160],
        [100, 146],
        [166, 160],
        [180, 210],
      ],
      clothes,
    ),
  );
  if (l.stripes) {
    for (const y of [170, 186])
      s.push(
        `<path d="M26 ${y}L174 ${y}L176 ${y + 7}L24 ${y + 7}Z" fill="${l.stripes}" opacity=".85"/>`,
      );
  }
  if (l.buttons) {
    for (const y of [168, 184, 200])
      s.push(`<path d="M100 ${y - 4}L104 ${y}L100 ${y + 4}L96 ${y}Z" fill="${l.buttons}"/>`);
  }
  if (l.apron)
    s.push(
      facets(
        [
          [70, 210],
          [76, 170],
          [124, 170],
          [130, 210],
        ],
        l.apron,
      ),
    );
  s.push(
    facets(
      [
        [86, 134],
        [114, 134],
        [114, 154],
        [100, 160],
        [86, 154],
      ],
      shade(l.skin, -0.12),
    ),
  );
  // Hair behind the head.
  if (l.hairStyle === 'braid')
    s.push(
      facets(
        [
          [128, 96],
          [146, 124],
          [140, 168],
          [124, 168],
          [130, 124],
        ],
        hair,
      ),
    );
  if (l.hairStyle === 'bun' && hat !== 'scarf' && !l.wet)
    s.push(
      facets(
        [
          [88, 40],
          [100, 26],
          [112, 40],
          [100, 52],
        ],
        hair,
      ),
    );
  // Ears and head.
  s.push(
    facets(
      [
        [54, 90],
        [62, 84],
        [68, 100],
        [60, 106],
      ],
      l.skin,
    ),
  );
  s.push(
    facets(
      [
        [146, 90],
        [138, 84],
        [132, 100],
        [140, 106],
      ],
      l.skin,
    ),
  );
  s.push(
    facets(
      [
        [100, 46],
        [128, 54],
        [138, 80],
        [136, 108],
        [122, 128],
        [100, 136],
        [78, 128],
        [64, 108],
        [62, 80],
        [72, 54],
      ],
      l.skin,
    ),
  );
  // Hair on top; wet hair lies flat with strands on the forehead.
  if (l.wet && l.hairStyle !== 'bald') {
    s.push(
      facets(
        [
          [62, 84],
          [66, 56],
          [100, 46],
          [134, 56],
          [138, 84],
          [124, 70],
          [112, 78],
          [100, 68],
          [88, 78],
          [76, 70],
        ],
        hair,
      ),
    );
  } else if (l.hairStyle === 'short') {
    s.push(
      facets(
        [
          [62, 86],
          [66, 58],
          [100, 44],
          [134, 58],
          [138, 86],
          [120, 66],
          [80, 66],
        ],
        hair,
      ),
    );
  } else if (l.hairStyle === 'braid' || l.hairStyle === 'bun') {
    s.push(
      facets(
        [
          [62, 92],
          [64, 60],
          [100, 42],
          [136, 60],
          [138, 94],
          [118, 66],
          [84, 66],
        ],
        hair,
      ),
    );
  } else if (l.hairStyle === 'bald') {
    s.push(
      facets(
        [
          [62, 102],
          [64, 82],
          [70, 84],
          [68, 102],
        ],
        hair,
      ) +
        facets(
          [
            [138, 102],
            [136, 82],
            [130, 84],
            [132, 102],
          ],
          hair,
        ),
    );
  }
  // Brows, eyes and mouth: drawn large so a mood still reads on a 30 px chart pin.
  const browY: Pt = mood === 'worried' ? [77, 68] : mood === 'pleased' ? [70, 70] : [74, 74];
  for (const [x, d] of [
    [84, 1],
    [116, -1],
  ] as const) {
    s.push(
      `<path d="M${x - 8 * d} ${browY[0]}L${x + 7 * d} ${browY[1]}L${x + 7 * d} ${browY[1] + 4.5}L${x - 8 * d} ${browY[0] + 4.5}Z" fill="${shade(hair, -0.35)}"/>`,
    );
    if (mood === 'pleased')
      s.push(
        `<path d="M${x - 7} 91L${x} 84L${x + 7} 91" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`,
      );
    else s.push(`<path d="M${x} 82L${x + 5} 88L${x} 94L${x - 5} 88Z" fill="${INK}"/>`);
  }
  if (mood === 'pleased')
    s.push(
      `<path d="M68 104L80 100L78 110ZM132 104L120 100L122 110Z" fill="#e8796b" opacity=".7"/>`,
    );
  if (l.dust)
    s.push(
      `<path d="M70 108L76 104L78 110ZM124 112L130 106L132 114Z" fill="#cfd4d6" opacity=".9"/>`,
    );
  s.push(
    facets(
      [
        [100, 90],
        [106, 106],
        [96, 106],
      ],
      shade(l.skin, -0.08),
    ),
  );
  if (l.beard)
    s.push(
      facets(
        [
          [64, 100],
          [78, 116],
          [100, 112],
          [122, 116],
          [136, 100],
          [128, 132],
          [100, 146],
          [72, 132],
        ],
        hair,
      ),
    );
  const lip = l.beard ? '#4a2416' : INK;
  if (mood === 'pleased') {
    s.push(
      `<path d="M85 114L115 114L107 125L93 125Z" fill="${lip}"/><path d="M88 114L112 114L110 118L90 118Z" fill="#fff"/>`,
    );
  } else {
    const m = mood === 'worried' ? 'M88 124L100 116L112 124' : 'M90 118L110 118';
    s.push(`<path d="${m}" fill="none" stroke="${lip}" stroke-width="4" stroke-linejoin="round"/>`);
  }
  if (mood === 'worried' || l.wet)
    s.push(`<path d="M134 70L139 80L134 86L129 80Z" fill="#9fd3e6"/>`);
  if (l.wet)
    s.push(
      `<path d="M72 92L76 100L72 104L68 100ZM118 140L122 148L118 152L114 148ZM50 176L54 184L50 188L46 184Z" fill="#9fd3e6"/>`,
    );
  // Hats.
  const hc = l.hatColor ?? '#555555';
  if (hat === 'scarf') {
    s.push(
      facets(
        [
          [56, 94],
          [62, 62],
          [100, 40],
          [138, 62],
          [144, 94],
          [122, 68],
          [78, 68],
        ],
        hc,
      ),
    );
    s.push(
      facets(
        [
          [134, 58],
          [156, 46],
          [150, 68],
        ],
        shade(hc, -0.15),
      ),
    );
  } else if (hat === 'cap') {
    s.push(
      facets(
        [
          [60, 74],
          [70, 46],
          [100, 38],
          [130, 46],
          [140, 74],
        ],
        hc,
      ),
    );
    s.push(
      facets(
        [
          [54, 76],
          [100, 66],
          [146, 76],
          [100, 86],
        ],
        shade(hc, -0.3),
      ),
    );
    if (l.badge) s.push(`<path d="M93 56l7 -6l7 6l-7 6z" fill="${l.badge}"/>`);
  } else if (hat === 'souwester') {
    s.push(
      facets(
        [
          [44, 70],
          [100, 56],
          [156, 70],
          [100, 80],
        ],
        shade(hc, -0.15),
      ),
    );
    s.push(
      facets(
        [
          [66, 66],
          [74, 40],
          [100, 30],
          [126, 40],
          [134, 66],
        ],
        hc,
      ),
    );
  }
  // Their trade.
  const item = l.item ?? 'none';
  if (item === 'pipe')
    s.push(
      facets(
        [
          [110, 122],
          [130, 126],
          [136, 116],
          [146, 116],
          [146, 130],
          [128, 132],
        ],
        '#6b3f22',
      ),
    );
  if (item === 'pencil')
    s.push(
      facets(
        [
          [132, 70],
          [154, 62],
          [157, 68],
          [135, 76],
        ],
        '#e8c46a',
      ),
    );
  if (item === 'chisel')
    s.push(
      facets(
        [
          [134, 74],
          [156, 60],
          [160, 65],
          [138, 79],
        ],
        '#9aa4a8',
      ),
    );
  if (item === 'spyglass')
    s.push(
      facets(
        [
          [120, 196],
          [170, 150],
          [180, 160],
          [130, 206],
        ],
        '#b5873a',
      ),
    );
  if (item === 'flour')
    s.push(`<path d="M58 172l6 -4l4 6zM116 108l5 -3l2 5z" fill="#fff" opacity=".8"/>`);
  if (item === 'ledger') {
    s.push(
      facets(
        [
          [116, 154],
          [146, 148],
          [150, 168],
          [120, 174],
        ],
        '#7a3b22',
      ),
    );
    s.push(`<path d="M119 157L146 152L147 156L120 161Z" fill="#efe3c4"/>`);
  }
  if (item === 'net') {
    s.push(`<path d="M128 150L176 166L182 210L132 210Z" fill="#c9b27a" opacity=".55"/>`);
    s.push(
      `<path d="M136 156L140 210M150 158L156 210M164 162L170 210M130 170L178 182M132 186L180 196" stroke="#8a7346" stroke-width="2" fill="none"/>`,
    );
  }
  return s.join('');
}

/**
 * One portrait as an SVG string, `size` px square. Same person, look and mood give the same SVG,
 * so callers can cache it.
 */
export function portraitSvg(
  c: Character,
  opts: { mood?: Mood; variant?: string; size?: number } = {},
): string {
  const { mood = 'neutral', variant, size = 96 } = opts;
  return `<svg class="portrait" xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 204 204" width="${size}" height="${size}" role="img" aria-label="${c.name}"><defs><clipPath id="fw-portrait-hex"><path d="${HEX}"/></clipPath></defs><g clip-path="url(#fw-portrait-hex)">${face(lookOf(c, variant), mood)}</g><path d="${HEX}" fill="none" stroke="#e8c46a" stroke-width="7" stroke-linejoin="round"/></svg>`;
}
