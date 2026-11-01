// The one-sheet of the game's identity for reviews: logo on paper and on the scene, icons at 16, 24
// and 32 px, type. Built from the live sprite in index.html, so it shows what the game uses.
const PAPER = '#efe6d1';
const INK = '#23303a';

const lockups = (cover) => `
  <section class="row">
    <div class="card paper"><h3>Title size, paper</h3>${LOGO('title', '')}</div>
    <div class="card scene" style="background-image:url(${cover})"><h3>Title size, scene</h3>${LOGO('title', ' logo-scene')}</div>
  </section>
  <section class="row">
    <div class="card paper"><h3>Small, paper</h3>${LOGO('small', '')}</div>
    <div class="card scene" style="background-image:url(${cover})"><h3>Small, scene</h3>${LOGO('small', ' logo-scene')}</div>
    <div class="card paper"><h3>Header, 20 px rose</h3><span class="tiny">${LOGO('small', '')}</span></div>
  </section>`;

const LOGO = (size, extra) => {
  const small = size === 'small';
  const sym = (cls, id) => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
  return `<div class="logo${small ? ' logo-small' : ''}${extra}">${sym('logo-rose', small ? 'logo-sm' : 'logo')}${sym('logo-word', 'wordmark')}${small ? '' : sym('logo-band', 'banderole')}</div>`;
};

const iconRow = (ids, color, bg) =>
  `<div class="icons" style="background:${bg};color:${color}">${ids
    .map(
      (id) =>
        `<figure><span>${[16, 24, 32].map((s) => `<svg width="${s}" height="${s}"><use href="#i-${id}"/></svg>`).join('')}</span><figcaption>${id}</figcaption></figure>`,
    )
    .join('')}</div>`;

const type = () => `
  <section class="row"><div class="card paper type">
    <p class="t1">Fair Winds, Port Calda, Saltmere</p>
    <p class="t2">IM Fell English: titles, the wordmark and port names. <i>Italic for the banderole and taglines.</i></p>
    <p class="u4">Alegreya Sans 700: Continue, Buy, Sell</p>
    <p class="u5">Alegreya Sans 500: Your sloop, 6.4 kn, beam reach, 14 gold</p>
    <p class="u4 n">0123456789 · 38° · 12 kn · 1 240 gold</p>
  </div></section>`;

export function sheetHtml({ ids, cover }) {
  const goods = ids.filter((i) => /^(fish|grain|timber|stone)$/.test(i));
  const others = ids.filter((i) => !goods.includes(i));
  return `<style>
    .icon-sprite { position: absolute; width: 0; height: 0; }
    body { background: #d8cdb2; font: 500 14px 'Alegreya Sans', sans-serif; color: ${INK}; padding: 24px; width: 1232px; }
    .row { display: flex; gap: 16px; margin-bottom: 16px; }
    .card { flex: 1; padding: 18px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; gap: 12px; min-height: 120px; justify-content: center; }
    .card h3 { margin: 0; align-self: flex-start; font: 700 13px 'Alegreya Sans'; opacity: .8; }
    .paper { background: ${PAPER}; } .scene { background-size: cover; background-position: 70% 60%; min-height: 300px; } .scene h3 { color: #f2f4ef; text-shadow: 0 0 2px ${INK}, 0 0 2px ${INK}; }
    .icons { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 14px; border-radius: 6px; margin-bottom: 16px; }
    .icons figure { margin: 0; width: 96px; text-align: center; } .icons span { display: flex; gap: 6px; justify-content: center; align-items: center; height: 36px; }
    .icons figcaption { font-size: 11px; opacity: .8; margin-top: 4px; }
    .type p { margin: 0; align-self: flex-start; } .t1 { font: 400 56px 'IM Fell English'; } .t2 { font: 400 24px 'IM Fell English'; } .u4 { font: 700 26px 'Alegreya Sans'; } .u5 { font: 500 18px 'Alegreya Sans'; } .n { font-variant-numeric: lining-nums tabular-nums; }
    .tiny .logo-rose { width: 20px; height: 20px; } .tiny .logo-word { width: 88px; }
  </style>
  ${lockups(cover)}
  ${iconRow(goods, INK, PAPER)}
  ${iconRow(others, INK, PAPER)}
  ${iconRow(ids, '#efe6d1', INK)}
  ${type()}`;
}
