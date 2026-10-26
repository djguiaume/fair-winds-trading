(async () => {
  for (let i = 0; i < 50 && !window.__view; i++) await new Promise((r) => setTimeout(r, 100));
  const view = window.__view; const scene = view.scene;
  const THREE = await import('/node_modules/three/build/three.module.js');
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hh = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hh(xi, zi), b = hh(xi + 1, zi), c = hh(xi, zi + 1), d = hh(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.15;
  const blur = (arr, w, h, sigma) => { const r = Math.ceil(sigma * 2.5), k = []; let ks = 0;
    for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); ks += v; } k.forEach((v, i) => (k[i] = v / ks));
    const tmp = new Float32Array(arr.length), out = new Float32Array(arr.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) { const xx = Math.min(w - 1, Math.max(0, x + i)); s += arr[y * w + xx] * k[i + r]; } tmp[y * w + x] = s; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) { const yy = Math.min(h - 1, Math.max(0, y + i)); s += tmp[yy * w + x] * k[i + r]; } out[y * w + x] = s; }
    return out; };
  scene.updateMatrixWorld(true);
  const terrains = [], blockers = [];
  scene.traverse((o) => { if (!o.isMesh) return; if (o.name === 'terrain') terrains.push(o); else if (o.name === 'town' || o.name === 'windows') blockers.push(o); });
  const tgt = view.target.clone();
  const south = window.__biome === 'tropic';
  // town occupancy
  const occ = new Set(); const oc = 2.0; const v = new THREE.Vector3();
  for (const m of blockers) { const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 2) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); occ.add(`${Math.floor(v.x / oc)},${Math.floor(v.z / oc)}`); } }
  const nearTown = (x, z, r = 1) => { const cx = Math.floor(x / oc), cz = Math.floor(z / oc);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (occ.has(`${cx + dx},${cz + dz}`)) return true; return false; };
  // big coarse seabed map for water depth
  const W2 = 400, C2 = 2.5, ox2 = tgt.x - (W2 * C2) / 2, oz2 = tgt.z - (W2 * C2) / 2;
  const sea = new Float32Array(W2 * W2).fill(-9);
  const landMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const C = 0.8; const cols = { sand: new THREE.Color('#ead9a6'), wet: new THREE.Color('#cdbf92'), g1: new THREE.Color('#93c45a'), g2: new THREE.Color('#7fb24c'), g3: new THREE.Color('#b2cf6c'), earth: new THREE.Color('#cbb894'), rock: new THREE.Color('#c2ae8c') };
  const forest = [];
  for (const m of terrains) {
    const g = m.geometry; const pos = g.attributes.position, idx = g.index;
    g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(m.matrixWorld);
    if (Math.hypot((bb.min.x + bb.max.x) / 2 - tgt.x, (bb.min.z + bb.max.z) / 2 - tgt.z) > 520) continue;
    const pad = 18, x0 = bb.min.x - pad, z0 = bb.min.z - pad; const w = Math.ceil((bb.max.x - bb.min.x + 2 * pad) / C), h = Math.ceil((bb.max.z - bb.min.z + 2 * pad) / C);
    if (w * h > 900000) continue;
    const H = new Float32Array(w * h).fill(-3.5); const solid = new Uint8Array(w * h);
    const tri = idx ? idx.count / 3 : pos.count / 3; const vi = (t, k) => idx ? idx.getX(t * 3 + k) : t * 3 + k;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (let t = 0; t < tri; t++) {
      A.fromBufferAttribute(pos, vi(t, 0)).applyMatrix4(m.matrixWorld); B.fromBufferAttribute(pos, vi(t, 1)).applyMatrix4(m.matrixWorld); Cc.fromBufferAttribute(pos, vi(t, 2)).applyMatrix4(m.matrixWorld);
      const minx = Math.max(0, Math.floor((Math.min(A.x, B.x, Cc.x) - x0) / C)), maxx = Math.min(w - 1, Math.ceil((Math.max(A.x, B.x, Cc.x) - x0) / C));
      const minz = Math.max(0, Math.floor((Math.min(A.z, B.z, Cc.z) - z0) / C)), maxz = Math.min(h - 1, Math.ceil((Math.max(A.z, B.z, Cc.z) - z0) / C));
      const d = (B.z - Cc.z) * (A.x - Cc.x) + (Cc.x - B.x) * (A.z - Cc.z); if (Math.abs(d) < 1e-9) continue;
      for (let zz = minz; zz <= maxz; zz++) for (let xx = minx; xx <= maxx; xx++) {
        const px = x0 + xx * C, pz = z0 + zz * C;
        const l1 = ((B.z - Cc.z) * (px - Cc.x) + (Cc.x - B.x) * (pz - Cc.z)) / d, l2 = ((Cc.z - A.z) * (px - Cc.x) + (A.x - Cc.x) * (pz - Cc.z)) / d, l3 = 1 - l1 - l2;
        if (l1 < -0.01 || l2 < -0.01 || l3 < -0.01) continue;
        const y = l1 * A.y + l2 * B.y + l3 * Cc.y; const i = zz * w + xx; if (y > H[i] || !solid[i]) { H[i] = solid[i] ? Math.max(H[i], y) : y; solid[i] = 1; } } }
    // smooth: rounded tiers, sloping shores; add gentle noise relief
    let S = blur(H, w, h, 2.4);
    for (let i = 0; i < S.length; i++) { const x = x0 + (i % w) * C, z = z0 + Math.floor(i / w) * C; if (S[i] > 0.3) S[i] += (fbm(x * 0.05, z * 0.05) - 0.5) * 1.6 * Math.min(1, S[i] / 3); }
    // keep town ground at its tier height so houses sit
    for (let i = 0; i < S.length; i++) { const x = x0 + (i % w) * C, z = z0 + Math.floor(i / w) * C; if (solid[i] && nearTown(x, z, 1)) S[i] = H[i] * 0.85 + S[i] * 0.15; }
    S = blur(S, w, h, 0.9);
    const geo = new THREE.PlaneGeometry((w - 1) * C, (h - 1) * C, w - 1, h - 1); geo.rotateX(-Math.PI / 2);
    const gp = geo.attributes.position; const colA = new Float32Array(gp.count * 3);
    for (let i = 0; i < gp.count; i++) { const xx = i % w, zz = Math.floor(i / w); gp.setXYZ(i, x0 + xx * C, S[zz * w + xx], z0 + zz * C); }
    geo.computeVertexNormals(); const nor = geo.attributes.normal; const c = new THREE.Color();
    for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i), ny = nor.getY(i);
      const n1 = fbm(x * 0.03, z * 0.03), n2 = fbm(x * 0.12 + 5, z * 0.12);
      if (y < 0.55 + n2 * 0.4) c.copy(y < 0.1 ? cols.wet : cols.sand);
      else { c.copy(cols.g2).lerp(cols.g1, n1).lerp(cols.g3, Math.max(0, n2 - 0.55) * 1.6);
        if (south) c.lerp(new THREE.Color('#6fbf4a'), 0.25);
        if (y < 1.1) c.lerp(cols.sand, (1.1 - y) / 0.55);
        const steep = 1 - ny; if (steep > 0.18) c.lerp(n2 > 0.5 ? cols.earth : cols.rock, Math.min(1, (steep - 0.18) * 3.2)); }
      colA.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
    const mesh = new THREE.Mesh(geo, landMat); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    m.visible = false;
    for (let i = 0; i < S.length; i++) { const x = x0 + (i % w) * C, z = z0 + Math.floor(i / w) * C; const gx = Math.floor((x - ox2) / C2), gz = Math.floor((z - oz2) / C2);
      if (gx >= 0 && gz >= 0 && gx < W2 && gz < W2) { const j = gz * W2 + gx; sea[j] = Math.max(sea[j], S[i]); } }
    // forest spots
    for (let k = 0; k < (w * h) / 2.6; k++) { const xx = 1 + Math.floor(rnd() * (w - 2)), zz = 1 + Math.floor(rnd() * (h - 2)); const y = S[zz * w + xx]; if (y < 1.4) continue;
      const vi2 = zz * w + xx; if (nor.getY(vi2) < 0.8) continue; const x = x0 + xx * C, z = z0 + zz * C;
      const cl = fbm(x * 0.035 + 7, z * 0.035 + 3); if (cl < 0.43 || nearTown(x, z, 1)) continue; if (Math.hypot(x - tgt.x, z - tgt.z) > 480) continue;
      forest.push([x, y, z, cl]); } }
  // trees: broadleaf + pines, dense
  const crown = new THREE.IcosahedronGeometry(1, 1); crown.scale(1, 1.1, 1); crown.translate(0, 2.6, 0);
  const pine = new THREE.ConeGeometry(0.95, 3.2, 7); pine.translate(0, 2.7, 0);
  const trunk = new THREE.CylinderGeometry(0.14, 0.2, 1.6, 5); trunk.translate(0, 0.8, 0);
  const leafMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const pineShare = south ? 0.1 : 0.6;
  const isPine = forest.map(() => rnd() < pineShare);
  const nP = isPine.filter(Boolean).length, nB = forest.length - nP;
  const crowns = new THREE.InstancedMesh(crown, leafMat, nB), pines = new THREE.InstancedMesh(pine, leafMat, nP), trunks = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: '#6b4a2c' }), forest.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sv = new THREE.Vector3(), P = new THREE.Vector3(), cc = new THREE.Color();
  const greens = ['#3b8a37', '#4a9a3b', '#2f7a33', '#57a644', '#2a6a30'], pg = ['#245c2c', '#2c6a32', '#1f5228', '#33733a'];
  let ib = 0, ip = 0;
  forest.forEach(([x, y, z], i) => { const s = 0.8 + rnd() * 0.8; Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.3); P.set(x, y - 0.15, z);
    Sv.set(s, s * (0.9 + rnd() * 0.35), s); M.compose(P, Q, Sv); trunks.setMatrixAt(i, M);
    if (isPine[i]) { pines.setMatrixAt(ip, M); cc.set(pg[Math.floor(rnd() * pg.length)]); pines.setColorAt(ip++, cc); }
    else { crowns.setMatrixAt(ib, M); cc.set(greens[Math.floor(rnd() * greens.length)]); crowns.setColorAt(ib++, cc); } });
  for (const im of [crowns, pines, trunks]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im); }
  // water: blue with depth from the smoothed seabed, soft shore, Fresnel sky, glint
  const SB = blur(sea, W2, W2, 3.0); const data = new Uint8Array(W2 * W2 * 4);
  for (let i = 0; i < SB.length; i++) { const val = Math.max(0, Math.min(255, Math.round(((SB[i] + 9) / 12) * 255))); data[i * 4] = val; data[i * 4 + 3] = 255; }
  const depthTex = new THREE.DataTexture(data, W2, W2, THREE.RGBAFormat); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
  const ocean = view.ocean.mesh, om = ocean.material;
  Object.assign(om.uniforms, { tDepth: { value: depthTex }, uDepthBox: { value: new THREE.Vector4(ox2, oz2, W2 * C2, W2 * C2) },
    uDeepB: { value: new THREE.Color(south ? '#1f6e9a' : '#2a679c') }, uMidB: { value: new THREE.Color(south ? '#3f9fbf' : '#4f8fc4') }, uShoreB: { value: new THREE.Color(south ? '#7cc9cf' : '#86b9d6') }, uSky: { value: new THREE.Color('#d6e8f0') } });
  let fs = om.fragmentShader;
  fs = fs.replace('void main() {', 'uniform sampler2D tDepth;\nuniform vec4 uDepthBox;\nuniform vec3 uDeepB;\nuniform vec3 uMidB;\nuniform vec3 uShoreB;\nuniform vec3 uSky;\nvoid main() {');
  fs = fs.replace('vec3 col = mix(uWater, uWaterLight, smoothstep(-0.35, 0.45, vHeight));', `vec2 duv = (vWorld.xz - uDepthBox.xy) / uDepthBox.zw;
  float bed = (all(greaterThan(duv, vec2(0.0))) && all(lessThan(duv, vec2(1.0)))) ? texture2D(tDepth, duv).r * 12.0 - 9.0 : -9.0;
  float dep = clamp(-bed / 8.5, 0.0, 1.0);
  vec3 col = mix(uShoreB, uMidB, smoothstep(0.0, 0.35, dep));
  col = mix(col, uDeepB, smoothstep(0.35, 1.0, dep));
  col *= 0.97 + 0.06 * smoothstep(-0.35, 0.45, vHeight);`);
  fs = fs.replace('col = mix(col, uShallow, (1.0 - smoothstep(0.0, 14.0, d)) * 0.85);', '');
  fs = fs.replace('col = mix(col, uFoam, foam * 0.8);', 'col = mix(col, uFoam, foam * 0.35 * (1.0 - smoothstep(0.0, 0.25, dep)));');
  fs = fs.replace('col *= light;', `col *= mix(1.0, light, 0.35);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 sn = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.7));
  float fres = pow(1.0 - max(dot(sn, V), 0.0), 4.0);
  col = mix(col, uSky, clamp(fres * 0.7, 0.0, 0.45));
  col += vec3(1.0, 0.96, 0.88) * pow(max(dot(reflect(-uSunDir, sn), V), 0.0), 160.0) * 0.5;`);
  om.fragmentShader = fs; om.needsUpdate = true;
  // haze and sky
  const haze = new THREE.Color('#cfe1ea');
  window.__preRender = () => { scene.fog.color.copy(haze); if (scene.background?.isColor) scene.background.copy(haze); om.uniforms.uFogColor.value.copy(haze); };
  await new Promise((r) => setTimeout(r, 3000));
})()
