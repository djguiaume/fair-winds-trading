// Static mockup of the "Boat looks" screen (#299): two layouts, ?v=a (tabs, garage) or ?v=b
// (slot list, wardrobe). The boat is the real game model with the real catalogue; the rest is
// throwaway HTML. Not game code: the build lives in src/ui once a layout is chosen.
import * as THREE from 'three';
import { createBoatModel } from '/src/render/models';
import { SHIPPED_CATALOGUE } from '/src/data/cosmetics';
import { resolveAppearance, flagOf } from '/src/sim/cosmetics';
import { FLAGS } from '/src/sim/regatta';
import { flagSvg } from '/src/editor/regatta/doc';
import { figureheadCard } from '/src/editor/cosmetics/preview';
import { setLanguage, t } from '/src/i18n';

const params = new URLSearchParams(location.search);
const V = params.get('v') ?? 'a';
const phone = innerWidth < 700;
setLanguage(params.get('lang') ?? 'en');
const fr = params.get('lang') === 'fr';
const W = (en, f) => (fr ? f : en);

const cat = SHIPPED_CATALOGUE;
const ship = 'schooner';
const upgrades = { sails: 2, hold: 1, hull: 2 };
/** What the captain has on now, and the earned unlocks of a mid-game voyage. */
const applied = {
  sailColour: 'canvas',
  sailPattern: 'bands-navy',
  sailLogo: 'anchor',
  hullColour: 'navy-trim',
  figurehead: null,
  flag: 'signal-blue',
  wake: 'plain',
};
const done = new Set(['saltmere-shoals', 'westholm-mill', 'regatta-ring']);
const unlocked = (i) =>
  i.unlock.kind === 'free' || done.has(i.unlock.quest ?? i.unlock.regatta ?? i.unlock.milestone);
const howToEarn = (i) => {
  const u = i.unlock;
  const how = u.quest
    ? t(`quest.${u.quest}.name`)
    : u.regatta
      ? t(`regatta.series.${u.regatta}`)
      : u.milestone;
  return W(`Earn it: ${how}`, `À gagner : ${how}`);
};

// Layout A tries on lavender canvas; layout B tries on the Sun figurehead, still locked.
const tryOn = V === 'a' ? { sailColour: 'lavender' } : { figurehead: 'sun' };
const preview = { ...applied, ...tryOn };
const slotOf = { sailColour: 'sail-colour', sailPattern: 'sail-pattern', sailLogo: 'sail-logo', hullColour: 'hull-colour', figurehead: 'figurehead', flag: 'flag', wake: 'wake' };
const focusSlot = Object.keys(tryOn)[0];
const items = (slot) => cat.items.filter((i) => i.slot === slot);
const nameOf = (slot, id) => {
  if (id === null) return W('None', 'Aucun');
  const i = items(slotOf[slot]).find((x) => x.id === id);
  return i ? i.name[fr ? 'fr' : 'en'] : id;
};

// --- Tiles: one small picture per item, the same in both layouts ---------------------------
const SAIL = 'M30 4 L30 52 L6 52 Z';
const cloth = (id) => cat.items.find((i) => i.slot === 'sail-colour' && i.id === id)?.cloth;
function thumb(i) {
  const c = cloth(preview.sailColour);
  switch (i.slot) {
    case 'sail-colour':
      return `<span class="swatch" style="background:${i.cloth}"></span>`;
    case 'sail-pattern': {
      const [a = c, b = c] = i.colours;
      const bands = i.pattern === 'plain' ? '' : `<g clip-path="url(#s${i.id})"><rect x="0" y="44" width="40" height="8" fill="${a}"/><rect x="0" y="4" width="40" height="6" fill="${a}"/><rect x="0" y="25" width="40" height="4" fill="${b}"/></g>`;
      return `<svg viewBox="0 0 36 56" class="pic"><defs><clipPath id="s${i.id}"><path d="${SAIL}"/></clipPath></defs><path d="${SAIL}" fill="${c}" stroke="#4a3320"/>${bands}</svg>`;
    }
    case 'sail-logo': {
      const inner = cat.logos[i.id].replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      return `<svg viewBox="0 0 32 32" class="pic logo" style="background:${c}"><g fill="${i.colour}">${inner}</g></svg>`;
    }
    case 'hull-colour': {
      const band = i.band ?? '#2f6f9f';
      return `<svg viewBox="0 0 56 32" class="pic"><path d="M2 8 H54 L46 28 H10 Z" fill="#9a5a2a" stroke="#4a3320"/><rect x="4" y="10" width="48" height="5" fill="${band}"/>${i.strake ? `<rect x="6" y="16" width="44" height="2.5" fill="${i.strake}"/>` : ''}</svg>`;
    }
    case 'figurehead':
      return figureheadCard(i.recipe, i.size).replace('<svg ', '<svg class="pic" ').replace('viewBox="0 0 80 56"', 'viewBox="20 12 40 40"');
    case 'flag': {
      const f = flagOf(i, FLAGS);
      return f ? flagSvg(f, 46).replace('<svg ', '<svg class="pic flag" ') : '';
    }
    case 'wake': {
      const dash = i.style === 'bubbles' ? '1 5' : i.style === 'plain' ? '' : i.style === 'fine-foam' ? '5 3' : '9 4';
      return `<svg viewBox="0 0 56 32" class="pic" style="background:#3f8fa8"><path d="M4 10 Q28 18 52 10 M4 22 Q28 14 52 22" fill="none" stroke="${i.tint ?? '#f6f9fb'}" stroke-width="${i.style === 'plain' ? 2 : 3.5}" stroke-dasharray="${dash}" stroke-linecap="round"/></svg>`;
    }
  }
  return '';
}
const NONE = `<span class="none-pic">∅</span>`;
const LOCK = `<svg class="lock" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke-width="2"/></svg>`;
function tile(slot, i) {
  const id = i ? i.id : null;
  const on = preview[slot] === id;
  const used = applied[slot] === id;
  const locked = i && !unlocked(i);
  return `<button class="tile ${on ? 'on' : ''} ${locked ? 'locked' : ''}" aria-pressed="${on}">
    ${i ? thumb(i) : NONE}${locked ? LOCK : ''}${used ? `<span class="used-dot" title="In use"></span>` : ''}
    <span class="tile-name">${i ? i.name[fr ? 'fr' : 'en'] : W('None', 'Aucun')}</span></button>`;
}
function grid(slot) {
  const list = items(slotOf[slot]);
  const optional = applied[slot] === null || ['sailLogo', 'figurehead', 'flag'].includes(slot);
  return `<div class="grid ${slot}">${optional ? tile(slot, null) : ''}${list.map((i) => tile(slot, i)).join('')}</div>`;
}
/** The strip under the grid: the tried-on item, how to get it, and the one action. */
function detail(slot) {
  const id = preview[slot];
  const i = items(slotOf[slot]).find((x) => x.id === id);
  const locked = i && !unlocked(i);
  const used = applied[slot] === id;
  const action = used
    ? `<span class="badge in-use">${W('In use', 'Utilisé')}</span>`
    : locked
      ? `<button class="d-btn" disabled>${W('Use', 'Utiliser')}</button>`
      : `<button class="d-btn brass">${W('Use', 'Utiliser')}</button>`;
  const note = locked
    ? `<span class="earn">${LOCK}${howToEarn(i)}</span>`
    : `<span class="muted">${i?.unlock.kind === 'earned' ? W('Earned', 'Gagné') : W('Free', 'Gratuit')} · ${W('was', 'avant')} ${nameOf(slot, applied[slot])}</span>`;
  return `<div class="detail"><div><b>${nameOf(slot, id)}</b>${note}</div>${action}</div>`;
}

const compare = `<div class="compare" role="group"><button>${W('Stock', 'D’origine')}</button><button class="on">${W('Yours', 'Le vôtre')}</button><button>${W('All upgrades', 'Tout amélioré')}</button></div>`;
const viewBtns = `<div class="view-btns"><button class="round" title="Turn">⟲</button><button class="round" title="Day / night">☾</button><button class="round" title="Turn">⟳</button></div>`;
const ships = `<div class="ships">${['sloop', 'cutter', 'schooner']
  .map((s) => `<button class="${s === ship ? 'on' : ''}">${t(`ship.${s}`)}</button>`)
  .join('')}</div>`;
const shipLine = `<div class="ship-line"><b>${t('ship.schooner')}</b><span>${W('Sails 2 · Hold 1 · Hull 2', 'Voiles 2 · Cale 1 · Coque 2')}</span></div>`;
const close = `<button class="close-btn round">✕</button>`;

// --- Layout A: tabs over a grid, Forza garage -------------------------------------------------
function layoutA() {
  const tabs = [
    ['sails', W('Sails', 'Voiles')],
    ['hull', W('Hull', 'Coque')],
    ['figurehead', W('Figurehead', 'Figure de proue')],
    ['flag', W('Flag', 'Pavillon')],
    ['wake', W('Wake', 'Sillage')],
  ];
  const sub = [W('Colours', 'Couleurs'), W('Patterns', 'Motifs'), W('Logos', 'Emblèmes')];
  return `<div class="screen a">
    <header class="bar"><h1>${W('Boat looks', 'Apparence du bateau')}</h1>${ships}${close}</header>
    <main><section class="stage">${shipLine}<canvas id="boat"></canvas>${compare}${viewBtns}</section>
      <aside class="panel on-paper">
        <nav class="tabs">${tabs.map(([k, l]) => `<button class="${k === 'sails' ? 'on' : ''}">${l}</button>`).join('')}</nav>
        <nav class="sub">${sub.map((l, k) => `<button class="${k === 0 ? 'on' : ''}">${l}</button>`).join('')}</nav>
        ${grid('sailColour')}${detail('sailColour')}
      </aside></main>
    <footer class="bar"><button class="d-btn">${W('Back to stock', 'Tout d’origine')}</button><span class="hint">${W('Tap to try on. Use keeps it; leaving puts back what you had.', 'Touchez pour essayer. Utiliser le garde ; en sortant, rien ne change.')}</span><button class="d-btn sail">${W('Done', 'Terminé')}</button></footer>
  </div>`;
}

// --- Layout B: slot list beside the boat, Z-A wardrobe ----------------------------------------
function layoutB() {
  const rows = [
    ['sailColour', W('Sail colour', 'Couleur des voiles')],
    ['sailPattern', W('Pattern', 'Motif')],
    ['sailLogo', W('Logo', 'Emblème')],
    ['hullColour', W('Hull', 'Coque')],
    ['figurehead', W('Figurehead', 'Figure de proue')],
    ['flag', W('Flag', 'Pavillon')],
    ['wake', W('Wake', 'Sillage')],
  ];
  const row = ([k, l]) => {
    const i = items(slotOf[k]).find((x) => x.id === preview[k]);
    return `<button class="slot ${k === focusSlot ? 'on' : ''}"><span class="slot-pic">${i ? thumb(i) : NONE}</span><span class="slot-text"><small>${l}</small><b>${nameOf(k, preview[k])}</b></span>${preview[k] !== applied[k] ? '<span class="changed">●</span>' : ''}</button>`;
  };
  return `<div class="screen b">
    <aside class="slots on-paper"><h1>${W('Boat looks', 'Apparence du bateau')}</h1>${ships}<div class="slot-list">${rows.map(row).join('')}</div>
      <button class="d-btn">${W('Back to stock', 'Tout d’origine')}</button></aside>
    <section class="stage">${shipLine}<canvas id="boat"></canvas>${compare}${viewBtns}</section>
    <aside class="items on-paper"><h2>${W('Figurehead', 'Figure de proue')}</h2>${grid(focusSlot)}${detail(focusSlot)}</aside>
    ${close}
  </div>`;
}

document.getElementById('app').innerHTML = V === 'a' ? layoutA() : layoutB();
document.body.classList.toggle('phone', phone);
document.querySelector('.slot.on')?.scrollIntoView({ inline: 'center' });

// --- The boat: the game model on a slow turntable, locked to the waterline ------------------
const { look } = resolveAppearance(cat, preview, ship, FLAGS);
const boatLook = {
  sailCloth: look.sail.cloth,
  ...(look.sail.pattern.colours[0] ? { sailBand: look.sail.pattern.colours[0] } : {}),
  ...(look.sail.pattern.colours[1] ? { sailStripe: look.sail.pattern.colours[1] } : {}),
  ...(look.hull.band ? { hullBand: look.hull.band } : {}),
  ...(look.hull.strake ? { hullStrake: look.hull.strake } : {}),
  figurehead: look.figurehead ? { recipe: look.figurehead.recipe, size: look.figurehead.size } : null,
};
const canvas = document.getElementById('boat');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const { width, height } = canvas.getBoundingClientRect();
renderer.setSize(width, height, false);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#cfe9f2', '#1a4d55', 1.6));
const sun = new THREE.DirectionalLight('#fff3dc', 1.8);
sun.position.set(-20, 40, 25);
scene.add(sun);
const boat = createBoatModel(ship, { upgrades, damage: 0, look: boatLook, flag: look.flag ?? undefined });
boat.update({ sail: 1, boomAngle: -0.35, luff: 0, heel: 0, windRelative: Math.PI * 0.75, time: 2 });
boat.root.rotation.y = (V === 'a' ? -125 : -150) * (Math.PI / 180);
scene.add(boat.root);
const water = new THREE.Mesh(
  new THREE.CircleGeometry(16, 48),
  new THREE.MeshBasicMaterial({ color: '#3f8fa8', transparent: true, opacity: 0.9 }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.02;
scene.add(water);
const camera = new THREE.PerspectiveCamera(28, width / height, 1, 400);
const dist = 46 * Math.max(1, 1 / (width / height));
camera.position.set(0, dist * 0.42, dist);
camera.lookAt(0, 7, 0);
renderer.render(scene, camera);
document.title = 'done';
