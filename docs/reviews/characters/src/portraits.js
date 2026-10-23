// Portrait proposals for the people of the arcs (decision 0120). Every face is drawn in code from a
// handful of parameters, the way characters.json could describe them: skin, hair, hat, beard,
// clothes, an item that says their trade, and the colour of their port. Three styles share the
// same parameters: A storybook, B low-poly facets, C cameo silhouette.
// The cast is the draft from docs/story/community-arcs.md (PR #101): placeholder names, not approved.

export const CAST = [
  {
    id: 'rook', name: 'Rook', role: 'Harbourmaster', port: 'Saltmere',
    skin: '#d9a07a', hair: '#d8d4cc', hairStyle: 'short', hat: 'cap', hatColor: '#1f3f5c',
    beard: true, clothes: '#24496b', apron: null, item: 'pipe', backdrop: '#5fb3c9',
  },
  {
    id: 'ines', name: 'Ines Calder', role: 'Shipwright', port: 'Port Calda',
    skin: '#a8714e', hair: '#c9c2b8', hairStyle: 'braid', hat: 'none', hatColor: null,
    beard: false, clothes: '#c9873f', apron: '#6b4a2e', item: 'pencil', backdrop: '#d8b26a',
  },
  {
    id: 'maren', name: 'Maren Holt', role: 'Miller and baker', port: 'Westholm',
    skin: '#f1c7a0', hair: '#8a4b2a', hairStyle: 'bun', hat: 'scarf', hatColor: '#d9534a',
    beard: false, clothes: '#e9dcc0', apron: '#ffffff', item: 'flour', backdrop: '#7fbf6a',
  },
  {
    id: 'ada', name: 'Ada Flint', role: 'Mason', port: 'Stonehaven',
    skin: '#e8b48f', hair: '#2e2420', hairStyle: 'short', hat: 'none', hatColor: null,
    beard: false, clothes: '#5f6f78', apron: null, item: 'chisel', backdrop: '#a7b3b8',
  },
  {
    id: 'ness', name: 'Old Ness', role: 'Pilot and keeper', port: 'Watchman Key',
    skin: '#e3b190', hair: '#f2f0ea', hairStyle: 'short', hat: 'souwester', hatColor: '#f2c230',
    beard: false, clothes: '#f2c230', apron: null, item: 'spyglass', backdrop: '#8fb8d8',
  },
];

const OUT = '#3a2618';

// ---------- small colour helpers ----------
function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(c, k) {
  const [r, g, b] = hex(c).map((v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

let uid = 0;

// ---------- A. Storybook: soft round shapes, warm outline, rosy cheeks ----------
function storybook(c, mood) {
  const id = `sb${uid++}`;
  const o = `stroke="${OUT}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const s = [];
  s.push(`<defs><clipPath id="${id}"><circle cx="100" cy="100" r="96"/></clipPath>
    <radialGradient id="${id}g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${shade(c.backdrop, 0.45)}"/><stop offset="1" stop-color="${shade(c.backdrop, -0.1)}"/></radialGradient></defs>`);
  s.push(`<g clip-path="url(#${id})"><rect width="200" height="200" fill="url(#${id}g)"/>`);
  // a hint of the home port behind: hill, roofs, water
  s.push(`<path d="M0 150 Q60 118 120 136 T200 128 V200 H0Z" fill="${shade(c.backdrop, -0.25)}" opacity=".7"/>`);
  s.push(`<path d="M146 128 l12 -12 l12 12 v14 h-24z M164 116 v-8 h5 v12" fill="${shade(c.backdrop, -0.4)}" opacity=".55"/>`);
  // shoulders and clothes
  s.push(`<path d="M22 210 Q26 150 100 146 Q174 150 178 210Z" fill="${c.clothes}" ${o}/>`);
  if (c.apron) s.push(`<path d="M70 210 Q72 168 100 166 Q128 168 130 210Z" fill="${c.apron}" ${o}/>`);
  s.push(`<path d="M86 136 h28 v18 q-14 10 -28 0z" fill="${shade(c.skin, -0.12)}" ${o}/>`);
  // hair behind the head
  if (c.hairStyle === 'braid') s.push(`<path d="M128 96 q22 30 8 70 q-6 12 -14 4 q10 -34 -6 -66z" fill="${c.hair}" ${o}/>`);
  if (c.hairStyle === 'bun' && c.hat !== 'scarf') s.push(`<circle cx="100" cy="42" r="16" fill="${c.hair}" ${o}/>`);
  // ears and head
  s.push(`<circle cx="62" cy="96" r="9" fill="${c.skin}" ${o}/><circle cx="138" cy="96" r="9" fill="${c.skin}" ${o}/>`);
  s.push(`<ellipse cx="100" cy="92" rx="38" ry="44" fill="${c.skin}" ${o}/>`);
  // hair on top
  if (c.hairStyle === 'short') s.push(`<path d="M63 88 q0 -38 37 -40 q37 2 37 40 q-8 -20 -37 -22 q-29 2 -37 22z" fill="${c.hair}" ${o}/>`);
  if (c.hairStyle === 'braid') s.push(`<path d="M62 92 q-2 -46 38 -46 q42 0 38 50 q-10 -30 -40 -30 q-20 0 -36 26z" fill="${c.hair}" ${o}/>`);
  if (c.hairStyle === 'bun' && c.hat !== 'scarf') s.push(`<path d="M62 90 q2 -42 38 -42 q36 0 38 42 q-14 -24 -38 -24 q-24 0 -38 24z" fill="${c.hair}" ${o}/>`);
  if (c.hairStyle === 'bald') s.push(`<path d="M62 100 q-2 -10 4 -18 M138 100 q2 -10 -4 -18" fill="none" stroke="${c.hair}" stroke-width="7" stroke-linecap="round"/>`);
  // face
  const brow = mood === 'worried' ? [[-6, 3], [6, -3]] : mood === 'pleased' ? [[-6, -2], [6, -2]] : [[-6, 0], [6, 0]];
  for (const [x, flip] of [[84, 1], [116, -1]]) {
    const [a, b] = flip === 1 ? brow : [[-brow[1][0], brow[1][1]], [-brow[0][0], brow[0][1]]];
    s.push(`<path d="M${x + a[0]} ${74 + a[1]} L${x + b[0]} ${74 + b[1]}" stroke="${shade(c.hair, -0.3)}" stroke-width="4" stroke-linecap="round"/>`);
    if (mood === 'pleased') s.push(`<path d="M${x - 6} 90 q6 -7 12 0" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>`);
    else s.push(`<ellipse cx="${x}" cy="88" rx="4.5" ry="5.5" fill="${OUT}"/><circle cx="${x + 1.5}" cy="86" r="1.6" fill="#fff"/>`);
  }
  s.push(`<circle cx="76" cy="104" r="7" fill="#e8796b" opacity=".45"/><circle cx="124" cy="104" r="7" fill="#e8796b" opacity=".45"/>`);
  s.push(`<path d="M100 92 q5 10 -2 13" fill="none" stroke="${shade(c.skin, -0.35)}" stroke-width="3" stroke-linecap="round"/>`);
  if (c.beard) {
    s.push(`<path d="M64 100 q4 44 36 46 q32 -2 36 -46 q-8 18 -20 16 q-16 -6 -32 0 q-12 2 -20 -16z" fill="${c.hair}" ${o}/>`);
  }
  const mouth = mood === 'pleased' ? 'M88 116 q12 12 24 0' : mood === 'worried' ? 'M89 120 q11 -7 22 0' : 'M90 117 q10 4 20 0';
  s.push(`<path d="${mouth}" fill="none" stroke="${c.beard ? '#5a2d1c' : OUT}" stroke-width="3.5" stroke-linecap="round"/>`);
  // hats
  if (c.hat === 'scarf') {
    s.push(`<path d="M58 92 q0 -50 42 -50 q42 0 42 50 q-12 -22 -42 -24 q-30 2 -42 24z" fill="${c.hatColor}" ${o}/>`);
    s.push(`<path d="M134 58 l20 -10 l-4 18 z" fill="${shade(c.hatColor, -0.15)}" ${o}/>`);
    for (const [x, y] of [[80, 56], [100, 50], [120, 56], [92, 64], [112, 64]]) s.push(`<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" opacity=".8"/>`);
  }
  if (c.hat === 'cap') {
    s.push(`<path d="M60 74 q4 -34 40 -34 q36 0 40 34z" fill="${c.hatColor}" ${o}/>`);
    s.push(`<path d="M56 76 q44 -12 88 0 q-4 8 -44 8 q-40 0 -44 -8z" fill="${shade(c.hatColor, -0.3)}" ${o}/>`);
    s.push(`<path d="M93 56 l7 -6 l7 6 l-7 6z" fill="#e8c46a" stroke="#8a6a1c" stroke-width="2"/>`);
  }
  if (c.hat === 'souwester') {
    s.push(`<path d="M44 70 q56 -16 112 0 q-6 10 -56 8 q-50 2 -56 -8z" fill="${shade(c.hatColor, -0.15)}" ${o}/>`);
    s.push(`<path d="M66 66 q2 -36 34 -36 q32 0 34 36z" fill="${c.hatColor}" ${o}/>`);
  }
  // trade item
  if (c.item === 'chisel') s.push(`<path d="M134 74 l22 -14 l4 5 l-22 14z" fill="#9aa4a8" ${o}/><path d="M152 62 l8 -5 l4 5 l-8 5z" fill="#6b3f22" ${o}/>`);
  if (c.item === 'spyglass') s.push(`<path d="M120 196 l50 -46 l10 10 l-50 46z" fill="#b5873a" ${o}/><path d="M166 154 l10 -9 l10 10 l-10 9z" fill="#e8c46a" ${o}/>`);
  if (c.item === 'flour') s.push(`<circle cx="118" cy="110" r="4" fill="#fff" opacity=".7"/><circle cx="74" cy="80" r="3" fill="#fff" opacity=".6"/><circle cx="60" cy="176" r="5" fill="#fff" opacity=".8"/>`);
  if (c.item === 'pipe') s.push(`<path d="M110 120 l18 6 q2 -10 10 -10 h6 v14 q-8 6 -16 2z" fill="#6b3f22" ${o}/>`);
  if (c.item === 'pencil') s.push(`<path d="M132 70 l22 -8 l3 6 l-22 8z" fill="#e8c46a" ${o}/>`);
  if (c.item === 'goggles') s.push(`<path d="M66 64 q34 -12 68 0" fill="none" stroke="#4b3a2a" stroke-width="7"/><circle cx="86" cy="60" r="9" fill="#9fd3e6" ${o}/><circle cx="114" cy="60" r="9" fill="#9fd3e6" ${o}/>`);
  s.push('</g>');
  return s.join('');
}

// ---------- B. Low-poly: the same shapes broken into flat-shaded facets ----------
function facets(points, color, light = [-0.6, -0.8]) {
  const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
  const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
  let s = '';
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    const len = Math.hypot(mx, my) || 1;
    const k = ((mx * light[0] + my * light[1]) / len) * 0.18;
    const f = shade(color, k);
    s += `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)} L${a[0]} ${a[1]} L${b[0]} ${b[1]}Z" fill="${f}" stroke="${f}" stroke-width=".6"/>`;
  }
  return s;
}
function lowpoly(c, mood) {
  const id = `lp${uid++}`;
  const s = [];
  s.push(`<defs><clipPath id="${id}"><path d="M100 4 L183 52 L183 148 L100 196 L17 148 L17 52Z"/></clipPath></defs><g clip-path="url(#${id})">`);
  s.push(`<rect width="200" height="200" fill="${shade(c.backdrop, 0.1)}"/>`);
  s.push(facets([[0, 150], [70, 128], [130, 140], [200, 124], [200, 200], [0, 200]], shade(c.backdrop, -0.2)));
  s.push(facets([[20, 210], [34, 160], [100, 146], [166, 160], [180, 210]], c.clothes));
  if (c.apron) s.push(facets([[70, 210], [76, 170], [124, 170], [130, 210]], c.apron));
  s.push(facets([[86, 134], [114, 134], [114, 154], [100, 160], [86, 154]], shade(c.skin, -0.12)));
  if (c.hairStyle === 'braid') s.push(facets([[128, 96], [146, 124], [140, 168], [124, 168], [130, 124]], c.hair));
  if (c.hairStyle === 'bun' && c.hat !== 'scarf') s.push(facets([[88, 40], [100, 26], [112, 40], [100, 52]], c.hair));
  s.push(facets([[54, 90], [62, 84], [68, 100], [60, 106]], c.skin));
  s.push(facets([[146, 90], [138, 84], [132, 100], [140, 106]], c.skin));
  const head = [[100, 46], [128, 54], [138, 80], [136, 108], [122, 128], [100, 136], [78, 128], [64, 108], [62, 80], [72, 54]];
  s.push(facets(head, c.skin));
  if (c.hairStyle === 'short') s.push(facets([[62, 86], [66, 58], [100, 44], [134, 58], [138, 86], [120, 66], [80, 66]], c.hair));
  if (c.hairStyle === 'braid' || (c.hairStyle === 'bun' && c.hat !== 'scarf')) s.push(facets([[62, 92], [64, 60], [100, 42], [136, 60], [138, 94], [118, 66], [84, 66]], c.hair));
  if (c.hairStyle === 'bald') s.push(facets([[62, 102], [64, 82], [70, 84], [68, 102]], c.hair) + facets([[138, 102], [136, 82], [130, 84], [132, 102]], c.hair));
  // Moods are drawn larger than in A so they still read at pin size.
  const browY = mood === 'worried' ? [77, 68] : mood === 'pleased' ? [70, 70] : [74, 74];
  for (const [x, d] of [[84, 1], [116, -1]]) {
    s.push(`<path d="M${x - 8 * d} ${browY[0]} L${x + 7 * d} ${browY[1]} L${x + 7 * d} ${browY[1] + 4.5} L${x - 8 * d} ${browY[0] + 4.5}Z" fill="${shade(c.hair, -0.35)}"/>`);
    if (mood === 'pleased') s.push(`<path d="M${x - 7} 91 L${x} 84 L${x + 7} 91" fill="none" stroke="#1c140e" stroke-width="4.5" stroke-linejoin="round"/>`);
    else s.push(`<path d="M${x} 82 L${x + 5} 88 L${x} 94 L${x - 5} 88Z" fill="#1c140e"/>`);
  }
  if (mood === 'pleased') s.push(`<path d="M68 104 L80 100 L78 110Z M132 104 L120 100 L122 110Z" fill="#e8796b" opacity=".7"/>`);
  s.push(facets([[100, 90], [106, 106], [96, 106]], shade(c.skin, -0.08)));
  if (c.beard) s.push(facets([[64, 100], [78, 116], [100, 112], [122, 116], [136, 100], [128, 132], [100, 146], [72, 132]], c.hair));
  const lip = c.beard ? '#4a2416' : '#1c140e';
  if (mood === 'pleased') s.push(`<path d="M85 114 L115 114 L107 125 L93 125Z" fill="${lip}"/><path d="M88 114 L112 114 L110 118 L90 118Z" fill="#fff"/>`);
  else s.push(`<path d="${mood === 'worried' ? 'M88 124 L100 116 L112 124' : 'M90 118 L110 118'}" fill="none" stroke="${lip}" stroke-width="4" stroke-linejoin="round"/>`);
  if (mood === 'worried') s.push(`<path d="M134 70 L139 80 L134 86 L129 80Z" fill="#9fd3e6"/>`);
  if (c.hat === 'scarf') {
    s.push(facets([[56, 94], [62, 62], [100, 40], [138, 62], [144, 94], [122, 68], [78, 68]], c.hatColor));
    s.push(facets([[134, 58], [156, 46], [150, 68]], shade(c.hatColor, -0.15)));
  }
  if (c.hat === 'cap') {
    s.push(facets([[60, 74], [70, 46], [100, 38], [130, 46], [140, 74]], c.hatColor));
    s.push(facets([[54, 76], [100, 66], [146, 76], [100, 86]], shade(c.hatColor, -0.3)));
    s.push(`<path d="M93 56 l7 -6 l7 6 l-7 6z" fill="#e8c46a"/>`);
  }
  if (c.hat === 'souwester') {
    s.push(facets([[44, 70], [100, 56], [156, 70], [100, 80]], shade(c.hatColor, -0.15)));
    s.push(facets([[66, 66], [74, 40], [100, 30], [126, 40], [134, 66]], c.hatColor));
  }
  if (c.item === 'chisel') s.push(facets([[134, 74], [156, 60], [160, 65], [138, 79]], '#9aa4a8'));
  if (c.item === 'spyglass') s.push(facets([[120, 196], [170, 150], [180, 160], [130, 206]], '#b5873a'));
  if (c.item === 'pipe') s.push(facets([[110, 122], [130, 126], [136, 116], [146, 116], [146, 130], [128, 132]], '#6b3f22'));
  if (c.item === 'pencil') s.push(facets([[132, 70], [154, 62], [157, 68], [135, 76]], '#e8c46a'));
  if (c.item === 'goggles') s.push(`<path d="M66 64 L134 64" stroke="#4b3a2a" stroke-width="7"/>` + facets([[78, 60], [86, 52], [94, 60], [86, 68]], '#9fd3e6') + facets([[106, 60], [114, 52], [122, 60], [114, 68]], '#9fd3e6'));
  if (c.item === 'flour') s.push(`<path d="M58 172 l6 -4 l4 6z M116 108 l5 -3 l2 5z" fill="#fff" opacity=".8"/>`);
  s.push('</g>');
  return s.join('');
}

// ---------- C. Cameo: a one-colour profile on parchment, like a chart vignette ----------
function cameo(c) {
  const ink = '#16384c';
  const id = `cm${uid++}`;
  const s = [];
  s.push(`<defs><clipPath id="${id}"><ellipse cx="100" cy="100" rx="88" ry="96"/></clipPath></defs>`);
  s.push(`<ellipse cx="100" cy="100" rx="88" ry="96" fill="#f3e6c4"/>`);
  s.push(`<ellipse cx="100" cy="100" rx="80" ry="88" fill="none" stroke="${ink}" stroke-width="1.5" opacity=".35"/>`);
  const g = [];
  // shoulders and neck
  g.push(`<path d="M34 196 Q38 156 84 150 L86 128 L112 128 L114 150 Q160 156 166 196Z"/>`);
  // head in profile, facing right
  g.push(`<path d="M70 70 Q72 38 106 38 Q134 40 138 66 Q140 76 138 82 L150 98 Q152 102 146 104 L142 106 Q146 110 140 114 Q144 120 138 124 Q136 136 120 136 L104 138 Q86 138 80 126 Q66 112 68 92Z"/>`);
  if (c.hairStyle === 'bun' && c.hat !== 'scarf') g.push(`<circle cx="70" cy="56" r="16"/>`);
  if (c.hairStyle === 'braid') g.push(`<path d="M74 82 q-18 30 -10 80 q4 8 10 0 q-6 -40 10 -74z"/>`);
  if (c.hat === 'scarf') g.push(`<path d="M64 92 Q58 34 106 32 Q140 34 142 66 L126 62 Q108 56 90 70Z"/><path d="M62 74 l-22 -6 l10 20z"/>`);
  if (c.hat === 'cap') g.push(`<path d="M68 64 Q72 30 108 30 Q138 32 140 60 L164 66 Q160 72 140 70 L68 70Z"/>`);
  if (c.beard) g.push(`<path d="M96 116 Q106 112 120 118 Q132 112 140 116 Q140 150 112 152 Q92 148 92 128Z"/>`);
  if (c.hat === 'souwester') g.push(`<path d="M66 68 Q70 32 106 32 Q136 34 140 62 L168 76 Q150 84 120 74 L60 80 Q48 78 66 68Z"/>`);
  if (c.item === 'chisel') g.push(`<path d="M96 60 l30 -14 l2 5 l-30 14z"/>`);
  if (c.item === 'spyglass') g.push(`<path d="M120 196 l46 -40 l8 9 l-46 40z"/>`);
  if (c.item === 'pipe') g.push(`<path d="M138 122 l20 4 q0 -10 8 -10 h6 v12 q-6 6 -14 2 l-20 -2z"/>`);
  if (c.item === 'pencil') g.push(`<path d="M96 58 l30 -14 l2 5 l-30 14z"/>`);
  if (c.item === 'goggles') g.push(`<path d="M74 60 Q104 48 136 58 l2 6 Q106 56 76 68Z"/><circle cx="132" cy="60" r="8"/>`);
  s.push(`<g fill="${ink}" clip-path="url(#${id})">${g.join('')}</g>`);
  // a small white eye notch and the trade mark at the bottom keep it readable
  s.push(`<path d="M124 82 l8 -1" stroke="#f3e6c4" stroke-width="2.5" stroke-linecap="round"/>`);
  s.push(`<ellipse cx="100" cy="100" rx="92" ry="98" fill="none" stroke="#e8c46a" stroke-width="7"/>`);
  return s.join('');
}

// Draw one portrait. `frame` adds the brass ring used in the UI (A round, B hexagon, C oval).
export function portrait(style, c, { mood = 'neutral', size = 120, frame = true } = {}) {
  let body;
  let ring = '';
  if (style === 'A') {
    body = storybook(c, mood);
    if (frame) ring = `<circle cx="100" cy="100" r="96" fill="none" stroke="#e8c46a" stroke-width="7"/><circle cx="100" cy="100" r="99.5" fill="none" stroke="#06141c" stroke-width="2"/>`;
  } else if (style === 'B') {
    body = lowpoly(c, mood);
    if (frame) ring = `<path d="M100 4 L183 52 L183 148 L100 196 L17 148 L17 52Z" fill="none" stroke="#e8c46a" stroke-width="7" stroke-linejoin="round"/>`;
  } else {
    body = cameo(c);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 204 204" width="${size}" height="${size}" style="display:block;flex:none">${body}${ring}</svg>`;
}
