// Shared builders for the art-style mockups: boats and islands in three styles.
// A = chunky toy, B = faceted classic, C = toon outlined. Procedural, mockup-only code.
import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

let seed = 11;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const reseed = (s) => { seed = s; };

// ---------- styles ----------
const toonRamp = (() => { const d = new Uint8Array([90, 170, 255]); const t = new T.DataTexture(d, 3, 1, T.RedFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();

// Every style uses the same sea (Guillaume picked the islands-A water for all).
export const SEA = { water: '#1f8d98', bg: '#1d7480', ground: '#1a5560' };

export const STYLES = {
  A: { name: 'Chunky toy', isl: 'sandbar', mastK: .9, fewSq: true, flag: 1.5, L: .85, B: 1.3, H: 1.55, sheer: .55, belly: .55, stripe: true, rig: false, outline: false,
    water: '#1f8d98', bg: '#1d7480', sky: '#e8fbff', ground: '#1a5560', sun: '#fff0d0', sunI: 1.7, hemiI: 1.15,
    hull: ['#a8622c', '#8f4f22', '#b5733a', '#7d4520', '#93582b'], band: ['#2f6f9f', '#c0533a', '#e0b13a', '#3f8f5a', '#7a4fa0'],
    sail: '#fbf6e8', deck: '#d9a866', mast: '#5b3a1e' },
  B: { name: 'Faceted classic', isl: 'highland', trim: true, L: 1.12, B: .88, H: .95, sheer: .3, belly: .12, stripe: false, rig: true, outline: false,
    water: '#256f86', bg: '#1f5f73', sky: '#dfeef5', ground: '#203f4a', sun: '#fff6e8', sunI: 1.5, hemiI: 1.0,
    hull: ['#7a5432', '#6c4a2c', '#82593a', '#5e4128', '#71502f'], band: ['#3b3b3b', '#3b3b3b', '#2e3a46', '#3b3b3b', '#2e3a46'],
    sail: '#e9e1cc', deck: '#b8925f', mast: '#4a3220' },
  C: { name: 'Toon outlined', isl: 'toon', L: 1, B: 1.12, H: 1.25, sheer: .45, belly: .4, stripe: true, rig: false, outline: true,
    water: '#2bb3c0', bg: '#27a6b4', sky: '#ffffff', ground: '#4a8f9a', sun: '#ffffff', sunI: 1.9, hemiI: 1.25,
    hull: ['#c2723a', '#b0602e', '#cf8244', '#a65a2a', '#bb6c36'], band: ['#3a8fe0', '#ff5a4a', '#ffc93a', '#41c47a', '#a46bf0'],
    sail: '#ffffff', deck: '#f0c27a', mast: '#6b3f1e' },
  // Round 2: between A and B.
  D: { name: 'Storybook classic', isl: 'sandbar', mastK: .95, flag: 1.3, L: 1, B: 1.05, H: 1.2, sheer: .45, belly: .35, stripe: true, rig: true, outline: false,
    sky: '#e8fbff', sun: '#fff0d0', sunI: 1.7, hemiI: 1.15,
    hull: ['#9a5a2a', '#8a4f24', '#a5683a', '#7a4420', '#8d552a'], band: ['#2f6f9f', '#c0533a', '#e0b13a', '#3f8f5a', '#7a4fa0'],
    sail: '#fbf6e8', deck: '#d4a466', mast: '#5b3a1e' },
  E: { name: 'Painted merchant', isl: 'sandbar', flag: 1.2, L: 1.1, B: .92, H: 1.0, sheer: .35, belly: .25, stripe: true, rig: true, outline: false,
    sky: '#e8fbff', sun: '#fff0d0', sunI: 1.7, hemiI: 1.15,
    hull: ['#2f5f8f', '#3f7f55', '#a8443a', '#c8902f', '#3a3a46'], band: ['#efe6cf', '#efe6cf', '#efe6cf', '#efe6cf', '#efe6cf'],
    sail: '#f3ecd9', deck: '#c99a5f', mast: '#4a3220' },
  F: { name: 'Dark wood and gold', isl: 'sandbar', mastK: .95, fewSq: true, flag: 1.5, L: .9, B: 1.25, H: 1.6, sheer: .75, belly: .45, stripe: true, rig: false, outline: false,
    sky: '#e8fbff', sun: '#fff0d0', sunI: 1.75, hemiI: 1.2,
    hull: ['#6b3e1e', '#5e3519', '#734322', '#552f16', '#62391b'], band: ['#d9a441', '#d9a441', '#d9a441', '#d9a441', '#d9a441'],
    sail: '#efe2c4', deck: '#b07a45', mast: '#3e2614' },
  // Island-only style: B's highland shapes, lighter colours, A's shallows glow.
  BL: { name: 'Bright highlands', isl: 'highlandLight', mastK: .9, fewSq: true, flag: 1.5, L: .85, B: 1.3, H: 1.55, sheer: .55, belly: .55, stripe: true, rig: false, outline: false,
    sky: '#e8fbff', sun: '#fff0d0', sunI: 1.7, hemiI: 1.15,
    hull: ['#a8622c', '#8f4f22', '#b5733a', '#7d4520', '#93582b'], band: ['#2f6f9f', '#c0533a', '#e0b13a', '#3f8f5a', '#7a4fa0'],
    sail: '#fbf6e8', deck: '#d9a866', mast: '#5b3a1e' },
};

export function mat(st, color, o = {}) {
  if (st.outline) return new T.MeshToonMaterial({ color, gradientMap: toonRamp, ...o });
  return new T.MeshLambertMaterial({ color, flatShading: true, ...o });
}

const outlineMat = new T.ShaderMaterial({
  uniforms: { w: { value: .05 } }, side: T.BackSide,
  vertexShader: 'uniform float w;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vec3 n=normalize(normalMatrix*normal);mv.xyz+=n*w*(-mv.z)*.012;gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'void main(){gl_FragColor=vec4(.11,.09,.13,1.);}',
});
const edgeMat = new T.LineBasicMaterial({ color: '#1c1720' });

// Adds ink outlines to every mesh of a group (toon style only).
export function ink(st, g) {
  if (!st.outline) return g;
  const ms = []; g.traverse(o => { if (o.isMesh && !o.userData.noInk) ms.push(o); });
  for (const m of ms) {
    if (m.userData.sail) { m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, 30), edgeMat)); continue; }
    let geo = m.geometry.clone(); geo.deleteAttribute('normal'); if (geo.attributes.uv) geo.deleteAttribute('uv'); geo.clearGroups();
    geo = mergeVertices(geo, 1e-3); geo.computeVertexNormals();
    const o = new T.Mesh(geo, outlineMat); o.userData.noInk = true; m.add(o);
  }
  return g;
}

// ---------- geometry helpers ----------
export function blobShape(R, n = 14, jit = .25, sx = 1, sz = 1) {
  const s = new T.Shape();
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, r = R * (1 + (rnd() - .5) * jit);
    const x = Math.cos(a) * r * sx, y = Math.sin(a) * r * sz;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath(); return s;
}
// Extruded shape lying on the water plane, from y=0 to y=h, top scaled by k.
export function slab(shape, h, k = 1, seg = 1) {
  const g = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4, steps: seg });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h, f = 1 + (k - 1) * t; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
  g.computeVertexNormals(); return g;
}

// Bilinear sail patch with belly displacement; corners a(foot fwd) b(foot aft) c(head fwd) d(head aft).
function sailGeo(a, b, c, d, belly, dir, nu = 6, nv = 6) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    const p = new T.Vector3().addScaledVector(a, (1 - u) * (1 - v)).addScaledVector(b, u * (1 - v)).addScaledVector(c, (1 - u) * v).addScaledVector(d, u * v);
    p.addScaledVector(dir, belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1 + .05)));
    pos.push(p.x, p.y, p.z); uv.push(u, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = j * (nu + 1) + i; idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

function stripeTex(base, stripe, kind) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 64, 64);
  if (kind === 'patch') { x.fillStyle = '#b8a27a'; x.fillRect(8, 30, 16, 14); x.fillRect(38, 10, 14, 12); x.fillStyle = '#a89068'; x.fillRect(30, 44, 18, 10); x.fillRect(14, 6, 10, 9); }
  if (kind === 'stripe') { x.fillStyle = stripe; x.fillRect(0, 22, 64, 18); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; return t;
}

// ---------- boats ----------
// Ship classes (bow is +Z). Rig: 'fa' fore-and-aft, 'sq' square.
export const CLASSES = {
  sloop:    { L: 5.0, B: 1.9, H: .9, masts: [{ z: .5, h: 5.2, rig: 'fa', top: 1 }], jibs: 1, castle: 0, ci: 0 },
  cutter:   { L: 6.2, B: 2.1, H: 1.0, masts: [{ z: .2, h: 6.4, rig: 'fa', top: 1 }], jibs: 2, castle: 0, ci: 1 },
  schooner: { L: 8.2, B: 2.3, H: 1.1, masts: [{ z: 1.6, h: 6.4, rig: 'fa' }, { z: -1.4, h: 7.4, rig: 'fa', top: 1 }], jibs: 2, castle: 0, ci: 2 },
  brig:     { L: 9.4, B: 2.9, H: 1.4, masts: [{ z: 2.0, h: 8.0, rig: 'sq', n: 3 }, { z: -1.6, h: 8.6, rig: 'sq', n: 3 }], jibs: 2, castle: 1, ci: 3 },
  fluyt:    { L: 11.5, B: 3.5, H: 1.8, masts: [{ z: 3.2, h: 8.6, rig: 'sq', n: 3 }, { z: 0, h: 9.6, rig: 'sq', n: 3 }, { z: -3.3, h: 6.8, rig: 'fa' }], jibs: 1, castle: 2, ci: 4 },
};

function hullGeo(L, B, H, sheer, bx = .5, bz = .82) {
  const s = new T.Shape();
  s.moveTo(0, L / 2); s.quadraticCurveTo(B * .55, L * .22, B / 2, -L * .08); s.lineTo(B * .38, -L / 2); s.lineTo(-B * .38, -L / 2); s.lineTo(-B / 2, -L * .08); s.quadraticCurveTo(-B * .55, L * .22, 0, L / 2);
  const g = new T.ExtrudeGeometry(s, { depth: H, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(Math.PI / 2); // shape y -> z (bow +Z), extrusion goes down to y=-H
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i), t = -y / H; // 0 at deck, 1 at keel
    const sh = sheer * (z / (L / 2)) ** 2 * (1 - t * .6);
    p.setX(i, p.getX(i) * (1 - t * (1 - bx))); p.setZ(i, z * (1 - t * (1 - bz))); p.setY(i, y + sh);
  }
  g.computeVertexNormals(); return g;
}

// upg: { sails:1-3, hold:1-3, hull:1-3 }
export function boat(st, clsName, upg = { sails: 2, hold: 2, hull: 2 }, trim = .45) {
  const c = CLASSES[clsName], g = new T.Group();
  const L = c.L * st.L, B = c.B * st.B, H = c.H * st.H, sheer = st.sheer * (L / 5) ** .5;
  const hullC = st.hull[c.ci], bandC = st.band[c.ci];
  const deckM = mat(st, st.deck), hullM = mat(st, hullC);
  const hull = new T.Mesh(hullGeo(L, B, H, sheer), [deckM, hullM]); hull.position.y = H * .55; g.add(hull);
  const deckY = H * .55;
  // painted band and copper sheathing
  if (upg.hull >= 2 && (st.stripe || st.trim)) {
    const bg = hullGeo(L * 1.015, B * 1.03, H * .28, sheer, .97, .985); bg.groups = bg.groups.filter(q => q.materialIndex === 1);
    const band = new T.Mesh(bg, [null, mat(st, bandC)]); band.position.y = deckY + .02; g.add(band);
  }
  if (upg.hull >= 3) {
    const cg = hullGeo(L * .93, B * .82, H * .35, sheer * .4, .7, .9); cg.groups = cg.groups.filter(q => q.materialIndex === 1);
    const cu = new T.Mesh(cg, [null, mat(st, '#c8743c', st.outline ? {} : { emissive: '#3a1a08' })]); cu.position.y = deckY - H * .42; g.add(cu);
  }
  // castles (raised stern decks)
  if (c.castle) {
    const ch = .4 * c.castle * st.H, cw = B * .78, cl = L * (.22 + .05 * c.castle);
    const box = new T.Mesh(slab(new T.Shape([new T.Vector2(-cw / 2, 0), new T.Vector2(cw / 2, 0), new T.Vector2(cw * .42, cl), new T.Vector2(-cw * .42, cl)]), ch, .95), mat(st, hullC));
    box.rotation.y = Math.PI; box.position.set(0, deckY + sheer * .7, -L / 2 + cl + .05); g.add(box);
    const top = new T.Mesh(new T.BoxGeometry(cw * .84, .06, cl * .9), deckM); top.position.set(0, deckY + sheer * .7 + ch, -L / 2 + cl / 2 + .1); g.add(top);
    if (st.stripe && upg.hull >= 2) { const b = new T.Mesh(new T.BoxGeometry(cw * 1.02, ch * .25, .08), mat(st, bandC)); b.position.set(0, deckY + sheer * .7 + ch * .7, -L / 2 + .02); g.add(b); }
    // stern windows
    for (let i = -1; i <= 1; i++) { const w = new T.Mesh(new T.BoxGeometry(.28, .22, .05), mat(st, '#ffd774', { emissive: '#7a5a10' })); w.position.set(i * cw * .25, deckY + sheer * .7 + ch * .45, -L / 2 - .02); g.add(w); }
  }
  // cargo on deck (hold upgrades)
  const crateM = mat(st, '#c4914e'), barrelM = mat(st, '#8a5a30');
  const nCr = [2, 4, 7][upg.hold - 1] + c.ci;
  for (let i = 0; i < nCr; i++) {
    const s = .42 * Math.min(1.6, st.H), maxCol = Math.max(1, Math.floor(L * .42 / (s * 1.08))), per = maxCol * 2;
    const layer = Math.floor(i / per), row = i % 2, col = Math.floor((i % per) / 2);
    const isBarrel = upg.hold >= 2 && i % 3 === 2;
    const m = isBarrel ? new T.Mesh(new T.CylinderGeometry(s * .45, s * .45, s * .8, 7), barrelM) : new T.Mesh(new T.BoxGeometry(s, s * .85, s), crateM);
    const z = -L * .08 - col * s * 1.08 + (c.masts.length > 1 ? L * .05 : 0);
    m.position.set((row - .5) * s * 1.1, deckY + sheer * (z / (L / 2)) ** 2 + s * .42 + layer * s * .85, z); m.rotation.y = (rnd() - .5) * .3; g.add(m);
  }
  // masts and sails
  const sailBase = st.sail, sailKind = upg.sails === 1 ? 'patch' : upg.sails === 3 ? 'stripe' : 'plain';
  const sailTex = stripeTex(upg.sails === 1 ? '#d9c9a2' : sailBase, bandC, sailKind);
  const sailM = (st.outline ? new T.MeshToonMaterial({ map: sailTex, gradientMap: toonRamp, side: T.DoubleSide })
    : new T.MeshLambertMaterial({ map: sailTex, side: T.DoubleSide, flatShading: true, emissive: '#ffffff', emissiveIntensity: .12 }));
  const mastM = mat(st, st.mast);
  const extraTop = upg.sails >= 3;
  let foremostTop = null;
  c.masts.forEach((m, mi) => {
    const mz = m.z * st.L, mh = m.h * (st.mastK || 1);
    const base = deckY + sheer * (mz / (L / 2)) ** 2;
    const mast = new T.Mesh(new T.CylinderGeometry(.07 * st.B, .11 * st.B, mh, 6), mastM); mast.position.set(0, base + mh / 2, mz); g.add(mast);
    const piv = new T.Group(); piv.position.set(0, 0, mz); g.add(piv);
    const add = (geo, rot) => { const s = new T.Mesh(geo, sailM); s.userData.sail = true; const pv = new T.Group(); pv.rotation.y = rot; pv.add(s); piv.add(pv); return pv; };
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const bel = st.belly * (B / 2);
    if (m.rig === 'fa') {
      const foot = base + .7, head = base + mh * (m.top && !extraTop ? .78 : .8), aft = Math.min(L * .55, mh * .62);
      add(sailGeo(V(0, foot, 0), V(0, foot, -aft), V(0, head, 0), V(0, head - mh * .12, -aft * .8), bel, V(1, 0, 0)), trim);
      const boom = new T.Mesh(new T.CylinderGeometry(.05, .05, aft, 5), mastM); boom.rotation.x = Math.PI / 2; boom.position.set(0, foot - .05, -aft / 2);
      const bp = new T.Group(); bp.rotation.y = trim; bp.add(boom); piv.add(bp);
      if (m.top && extraTop) add(sailGeo(V(0, head + .1, 0), V(0, head + .1, -aft * .5), V(0, base + mh - .1, 0), V(0, base + mh - .15, -.05), bel * .5, V(1, 0, 0)), trim);
    } else {
      const n = m.n + (extraTop ? 0 : -1) + (st.fewSq ? -1 : 0), span = (mh - 1) / m.n;
      for (let k = 0; k < Math.max(2, n); k++) {
        const y0 = base + 1 + k * span, y1 = y0 + span * .92, w = B * (st.fewSq ? 1.15 : 1.05) * (1 - k * .14);
        const yard = new T.Mesh(new T.CylinderGeometry(.05, .05, w * 1.1, 5), mastM); yard.rotation.z = Math.PI / 2; yard.position.y = y1;
        const yp = new T.Group(); yp.rotation.y = trim * .6; yp.add(yard); piv.add(yp);
        add(sailGeo(V(-w / 2, y0, 0), V(w / 2, y0, 0), V(-w / 2 * .9, y1, 0), V(w / 2 * .9, y1, 0), st.belly * .6 + .12, V(0, 0, 1)), trim * .6);
      }
    }
    // flag
    const fl = new T.Mesh(new T.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -.5, 0), V(0, -.25, -1)]), new T.MeshBasicMaterial({ color: mi === 0 ? bandC : '#ffffff', side: T.DoubleSide }));
    fl.scale.setScalar(st.flag || 1); fl.position.set(0, base + mh + .1, mz); fl.userData.noInk = true; g.add(fl);
    if (!foremostTop) foremostTop = { y: base + mh * .82, z: mz };
  });
  // jibs to the bowsprit
  const bowY = deckY + sheer, bowZ = L / 2;
  const sprit = new T.Mesh(new T.CylinderGeometry(.05, .07, L * .25, 5), mastM); sprit.rotation.x = Math.PI / 2 - .25; sprit.position.set(0, bowY + .15, bowZ + L * .1); g.add(sprit);
  const nj = c.jibs + (upg.sails >= 2 ? 1 : 0) - (clsName === 'sloop' && upg.sails < 2 ? 0 : 0);
  for (let j = 0; j < Math.min(nj, 3); j++) {
    const tipZ = bowZ + L * (.04 + j * .08), tipY = bowY + .2 + j * .03, hz = foremostTop.z, hy = foremostTop.y - j * .5;
    const geo = sailGeo(new T.Vector3(0, tipY, tipZ), new T.Vector3(0, deckY + sheer * .55 + .6, tipZ - (tipZ - hz) * .55), new T.Vector3(0, hy, hz + .15), new T.Vector3(0, hy, hz + .15), st.belly * B * .3, new T.Vector3(1, 0, 0), 4, 4);
    const s = new T.Mesh(geo, sailM); s.userData.sail = true; s.rotation.y = trim * .25; g.add(s);
  }
  // rigging lines (classic style)
  if (st.rig) {
    const pts = [];
    for (const m of c.masts) {
      const mz = m.z * st.L, top = deckY + sheer * (mz / (L / 2)) ** 2 + m.h;
      for (const sx of [-1, 1]) for (const dz of [-.4, 0, .4]) pts.push(0, top * .92, mz, sx * B * .5, deckY + .1, mz + dz);
    }
    pts.push(0, foremostTop.y + .7, foremostTop.z, 0, bowY + .3, bowZ + L * .2);
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    g.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: '#2d2218', transparent: true, opacity: .7 })));
  }
  if (upg.sails >= 3 && !st.rig) { // stern lantern
    const ln = new T.Mesh(new T.OctahedronGeometry(.18), new T.MeshBasicMaterial({ color: '#ffd774' })); ln.position.set(0, deckY + sheer + .9 + c.castle * .6, -L / 2 + .2); g.add(ln);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  ink(st, g);
  g.userData.L = L;
  return g;
}

export function wake(scene, b, x, z, rot, s = 1) {
  const L = b.userData.L;
  const m = new T.Mesh(new T.PlaneGeometry(L * .3, L * 1.2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#e6fbff', transparent: true, opacity: .32, depthWrite: false }));
  m.position.set(x - Math.sin(rot) * L * .95 * s, .06, z - Math.cos(rot) * L * .95 * s); m.rotation.y = rot; m.scale.setScalar(s); scene.add(m);
  if (s < 0) { const f = new T.Mesh(new T.RingGeometry(L * .32, L * .42, 16, 1, 0, Math.PI).rotateX(-Math.PI / 2), m.material);
  f.position.set(x + Math.sin(rot) * L * .3 * s, .07, z + Math.cos(rot) * L * .3 * s); f.rotation.y = rot + Math.PI; f.scale.set(s, s, s * 1.6); scene.add(f); }
}

// ---------- scene ----------
export function makeScene(st, canvas, w = 1280, h = 720) {
  const r = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); r.setSize(w, h, false);
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.outputColorSpace = T.SRGBColorSpace;
  const s = new T.Scene(); s.background = new T.Color(SEA.bg); s.fog = new T.Fog(SEA.bg, 90, 190);
  s.add(new T.HemisphereLight(st.sky, SEA.ground, st.hemiI));
  const sun = new T.DirectionalLight(st.sun, st.sunI); sun.position.set(-30, 55, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 200 }); sun.shadow.bias = -.0005; s.add(sun);
  const wg = new T.PlaneGeometry(260, 200, 80, 60); wg.rotateX(-Math.PI / 2); const p = wg.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, (rnd() - .5) * (st.outline ? 0 : .12)); wg.computeVertexNormals();
  const water = new T.Mesh(wg, st.outline ? new T.MeshToonMaterial({ color: SEA.water, gradientMap: toonRamp }) : new T.MeshLambertMaterial({ color: SEA.water, flatShading: true }));
  water.position.y = -.1; water.receiveShadow = true; s.add(water);
  return { r, s, sun };
}

export function label(cam, v, html, cls = 'label') {
  cam.updateMatrixWorld(); const q = v.clone().project(cam); const d = document.createElement('div'); d.className = cls;
  d.style.left = (q.x + 1) / 2 * innerWidth + 'px'; d.style.top = (1 - q.y) / 2 * innerHeight + 'px'; d.innerHTML = html;
  document.getElementById('labels').appendChild(d);
}

// ---------- islands ----------
function glowTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(.55, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

function kit(st, isl) {
  const K = {};
  if (isl === 'sandbar') {
    K.tree = () => { // palm
      const t = new T.Group(); const trunk = mat(st, '#9a6a3a'), leaf = mat(st, '#4caf50');
      let y = 0, x = 0; for (let i = 0; i < 4; i++) { const sgm = new T.Mesh(new T.CylinderGeometry(.11, .15, .55, 5), trunk); x += .07; sgm.position.set(x, y + .27, 0); sgm.rotation.z = -.15 * i; t.add(sgm); y += .52; }
      for (let i = 0; i < 6; i++) { const f = new T.Mesh(new T.ConeGeometry(.22, 1.3, 3), leaf); f.scale.z = .3; f.rotation.z = Math.PI / 2 + .5; f.position.set(.6, 0, 0); const pv = new T.Group(); pv.position.set(x, y, 0); pv.rotation.y = i / 6 * 6.28; pv.add(f); t.add(pv); }
      return t;
    };
    K.house = (i) => { const h = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(1.1, 1, 1), mat(st, ['#fff3dc', '#ffd9b0', '#d9f0f5', '#ffe9e0'][i % 4])); b.position.y = .5; h.add(b);
      const rf = new T.Mesh(new T.ConeGeometry(.92, .75, 4), mat(st, ['#d9553a', '#2f7fbf', '#e0a030', '#3f9f6a'][i % 4])); rf.position.y = 1.35; rf.rotation.y = Math.PI / 4; h.add(rf); return h; };
    K.sand = '#f2d9a0'; K.grass = '#7cc04f'; K.rock = '#8a8580'; K.rock2 = '#a39d94'; K.field = ['#e8c547', '#c9d65a', '#e2b53e'];
  } else if (isl === 'highland' || isl === 'highlandLight') {
    const lt = isl === 'highlandLight';
    K.tree = () => { const t = new T.Group(); const tr = new T.Mesh(new T.CylinderGeometry(.08, .12, .6, 5), mat(st, '#5a3d24')); tr.position.y = .3; t.add(tr);
      const sc = .8 + rnd() * .5; for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.ConeGeometry(.65 - i * .16, .9, 6), mat(st, (lt ? ['#3f8f45', '#4aa04f', '#38833f'] : ['#2f5f3a', '#356b40', '#2a5434'])[i])); c.position.y = .75 + i * .45; t.add(c); } t.scale.setScalar(sc); return t; };
    K.house = (i) => { const h = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(1.2, .9, .9), mat(st, (lt ? ['#f4ede0', '#ece2cf', '#f8f3ea'] : ['#cfc6b4', '#bdb3a1', '#d8d0bf'])[i % 3])); b.position.y = .45; h.add(b);
      const rf = new T.Mesh(new T.CylinderGeometry(0, .75, .6, 4, 1), mat(st, (lt ? ['#c8603e', '#3f74a8', '#c8603e'] : ['#4a4f58', '#6b4a3a', '#4a4f58'])[i % 3])); rf.scale.set(1.15, 1, .85); rf.rotation.y = Math.PI / 4; rf.position.y = 1.2; h.add(rf);
      const ch = new T.Mesh(new T.BoxGeometry(.18, .5, .18), mat(st, '#8a8174')); ch.position.set(.35, 1.3, 0); h.add(ch); return h; };
    if (lt) { K.sand = '#f2d9a0'; K.grass = '#7cc04f'; K.rock = '#c2ad8c'; K.rock2 = '#d6c4a4'; K.field = ['#e8c547', '#c9d65a', '#e2b53e']; }
    else { K.sand = '#d9c49a'; K.grass = '#5f8f45'; K.rock = '#6f6a63'; K.rock2 = '#857d70'; K.field = ['#c9a94a', '#a8a84a', '#b89a40']; }
  } else {
    K.tree = () => { const t = new T.Group(); const tr = new T.Mesh(new T.CylinderGeometry(.12, .16, .8, 6), mat(st, '#8a5530')); tr.position.y = .4; t.add(tr);
      const c = ['#3fbf5a', '#5ad16a', '#36a94e'][Math.floor(rnd() * 3)];
      for (let i = 0; i < 3; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(.45 + rnd() * .2, 1), mat(st, c)); b.position.set((rnd() - .5) * .5, 1.0 + i * .25, (rnd() - .5) * .5); t.add(b); } return t; };
    K.house = (i) => { const h = new T.Group(); const b = new T.Mesh(new T.CylinderGeometry(.6, .65, 1, 8), mat(st, ['#fff6e6', '#ffe0c2', '#e2f6ff'][i % 3])); b.position.y = .5; h.add(b);
      const rf = new T.Mesh(new T.ConeGeometry(.85, .9, 8), mat(st, ['#ff6a4a', '#3a8fe0', '#ffc93a'][i % 3])); rf.position.y = 1.45; h.add(rf); return h; };
    K.sand = '#ffe2a0'; K.grass = '#6ad35a'; K.rock = '#9a8fa8'; K.rock2 = '#b4a9c2'; K.field = ['#ffd84a', '#ffe680', '#f5c43a'];
  }
  return K;
}

// type: 'port' (fish), 'timber', 'grain', 'stone'
export function island(st, scene, x, z, R, type, s = 7, isl = st.isl) {
  reseed(s);
  const K = kit(st, isl), g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
  let top, dome = null; // height of the walkable top (dome: height by distance, toon hills)
  const sx = 1 + (rnd() - .5) * .3, sz = 1 + (rnd() - .5) * .3;
  if (isl === 'sandbar' || isl === 'highlandLight') {
    const glow = new T.Mesh(new T.CircleGeometry(R * 2.1, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: glowTex('rgba(150,240,225,.95)', 'rgba(120,230,220,0)'), transparent: true, depthWrite: false }));
    glow.scale.set(sx, 1, sz); glow.position.y = .1; g.add(glow);
  }
  if (isl === 'sandbar') {
    const sand = new T.Mesh(slab(blobShape(R, 16, .22, sx, sz), 1.0, .88), mat(st, K.sand)); sand.position.y = -.4; g.add(sand);
    const gr = new T.Mesh(slab(blobShape(R * .7, 12, .25, sx, sz), .7, .9), mat(st, K.grass)); gr.position.y = .5; g.add(gr);
    top = 1.2;
  } else if (isl !== 'toon') {
    const beach = new T.Mesh(slab(blobShape(R * 1.05, 14, .45, sx, sz), .6, .9), mat(st, K.sand)); beach.position.y = -.3; g.add(beach);
    const layers = type === 'stone' ? 5 : type === 'grain' ? 2 : 3; let y = .2;
    for (let i = 0; i < layers; i++) { const h = 1.2 + rnd() * .6; const l = new T.Mesh(slab(blobShape(R * (.9 - i * .15), 11, .3, sx, sz), h, .9), mat(st, i % 2 ? K.rock2 : K.rock)); l.position.set((rnd() - .5) * R * .1, y, (rnd() - .5) * R * .1); g.add(l); y += h; }
    const cap = new T.Mesh(slab(blobShape(R * (.92 - layers * .15), 11, .2, sx, sz), .25, .95), mat(st, K.grass)); cap.position.y = y; g.add(cap);
    top = y + .25;
  } else {
    const foam = new T.Mesh(new T.RingGeometry(R * 1.15, R * 1.3, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffffff' })); foam.scale.set(sx, 1, sz); foam.position.y = .02; foam.userData.noInk = true; g.add(foam);
    const shallow = new T.Mesh(new T.CircleGeometry(R * 1.15, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#7fe3e0' })); shallow.scale.set(sx, 1, sz); shallow.position.y = .01; shallow.userData.noInk = true; g.add(shallow);
    const sand = new T.Mesh(new T.CylinderGeometry(R * .95, R, .8, 24), mat(st, K.sand)); sand.scale.set(sx, 1, sz); sand.position.y = .1; g.add(sand);
    const hy = type === 'grain' ? .12 : .28; const hill = new T.Mesh(new T.SphereGeometry(R * .75, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(st, K.grass)); hill.scale.set(sx, hy, sz); hill.position.y = .5; g.add(hill);
    top = .5 + R * .75 * hy * .75; dome = (d) => .5 + R * .75 * hy * Math.sqrt(Math.max(0, 1 - (d / (R * .75)) ** 2));
  }
  const r0 = R * .5;
  const at = (o, a, d, yOff = 0) => { o.position.set(Math.cos(a) * d * sx, (dome ? dome(d) - .05 : top) + yOff, Math.sin(a) * d * sz); g.add(o); return o; };
  const dock = () => { const d = new T.Mesh(new T.BoxGeometry(.9, .2, R * .8), mat(st, '#9b6b3d')); d.position.set(R * .1, .45, R * 1.05 * sz); g.add(d);
    for (const k of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(.08, .08, 1), mat(st, '#6b4a2a')); p.position.set(R * .1 + k * .4, 0, R * 1.3 * sz); g.add(p); } };
  if (type === 'port') {
    for (let i = 0; i < 6; i++) at(K.house(i), -2.2 + i * .45, r0 * (.7 + (i % 2) * .5)).rotation.y = rnd() * 3;
    for (let i = 0; i < 3; i++) at(K.tree(), 1.2 + i * .7, r0 * 1.1);
    dock(); // fish racks
    for (let i = 0; i < 2; i++) { const rk = new T.Mesh(new T.BoxGeometry(1.2, .5, .1), mat(st, '#b08a5a')); rk.position.set(-R * .5 + i * 1.5, .7, R * .8 * sz); g.add(rk); }
  } else if (type === 'timber') {
    for (let i = 0; i < 16; i++) at(K.tree(), rnd() * 6.28, rnd() * R * .62).rotation.y = rnd() * 3;
    const logs = new T.Group(); for (let i = 0; i < 5; i++) { const l = new T.Mesh(new T.CylinderGeometry(.18, .18, 1.6, 6), mat(st, '#a8703c')); l.rotation.z = Math.PI / 2; l.position.set(0, .18 + Math.floor(i / 3) * .3, (i % 3) * .37 - .37 + Math.floor(i / 3) * .18); logs.add(l); }
    at(logs, 1.4, R * .55); at(K.house(1), 1.9, R * .5);
  } else if (type === 'grain') {
    for (let i = 0; i < 4; i++) { const f = new T.Mesh(new T.BoxGeometry(R * .32, .12, R * .5), mat(st, K.field[i % 3])); at(f, 0, 0, .05).position.x += (i - 1.5) * R * .34; f.position.z -= R * .1;
      if (isl !== 'sandbar') for (let k = 0; k < 3; k++) { const ln = new T.Mesh(new T.BoxGeometry(R * .3, .05, .06), mat(st, '#8f7a30')); ln.position.set(f.position.x, top + .13, f.position.z + (k - 1) * R * .14); g.add(ln); } }
    const mill = new T.Group(); const tw = new T.Mesh(new T.CylinderGeometry(.45, .65, 2.2, 8), mat(st, isl === 'highland' ? '#cfc6b4' : '#fff3dc')); tw.position.y = 1.1; mill.add(tw);
    const cap = new T.Mesh(new T.ConeGeometry(.6, .7, 8), mat(st, isl === 'toon' ? '#ff6a4a' : '#8a4a2a')); cap.position.y = 2.55; mill.add(cap);
    for (let k = 0; k < 4; k++) { const bl = new T.Mesh(new T.BoxGeometry(.25, 1.8, .05), mat(st, '#f4ead2')); bl.position.y = .9; const pv = new T.Group(); pv.position.set(0, 2.2, .55); pv.rotation.z = k * Math.PI / 2 + .4; pv.add(bl); mill.add(pv); }
    at(mill, 2.4, R * .5); at(K.house(2), 3.2, R * .55); at(K.tree(), 4.2, R * .6); at(K.tree(), 4.6, R * .5);
  } else if (type === 'stone') {
    for (let i = 0; i < 3; i++) { const rk = new T.Mesh(new T.DodecahedronGeometry(R * (.28 - i * .06), isl === 'toon' ? 1 : 0), mat(st, i % 2 ? K.rock2 : K.rock)); rk.scale.y = 1.3; at(rk, i * 2.1, R * .3 * i, R * .12); }
    for (let i = 0; i < 3; i++) at(K.tree(), 3 + i * .5, R * .6);
    const cart = new T.Mesh(new T.BoxGeometry(.8, .4, .6), mat(st, '#8a6a4a')); at(cart, 4.6, R * .45, .2);
  }
  g.traverse(o => { if (o.isMesh && !o.userData.noInk) { o.castShadow = true; o.receiveShadow = true; } });
  ink(st, g);
  return { g, top };
}
