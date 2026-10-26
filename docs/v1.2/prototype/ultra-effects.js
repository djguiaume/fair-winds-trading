(async () => {
  const mode = window.__fx || 'full';
  const mod = await import('/src/render/view.ts');
  const View = mod.GameView;
  const view = await new Promise((res) => {
    const orig = View.prototype.render;
    View.prototype.render = function (dt) { View.prototype.render = orig; res(this); return orig.call(this, dt); };
  });
  const r = view.renderer, scene = view.scene, sun = view.sun;
  window.__view = view;
  view.scene.traverse((o) => { if (o.isMesh && o.castShadow) o.userData.land = true; });
  // look up the THREE the app uses via the renderer's module: constants are plain numbers

  const tgt = view.target;
  let last = null;
  const lowView = (c) => {
    if (last && c.position.equals(last)) return;
    const off = c.position.clone().sub(tgt); const d = off.length() * 1.15;
    const flat = Math.hypot(off.x, off.z) || 1; const el = 0.62; // ~35 degrees
    c.position.set(tgt.x + off.x / flat * Math.cos(el) * d, tgt.y + Math.sin(el) * d, tgt.z + off.z / flat * Math.cos(el) * d);
    c.lookAt(tgt.x, tgt.y, tgt.z - 0); c.far = 900; c.updateProjectionMatrix(); last = c.position.clone();
    scene.fog.near = d * 1.5; scene.fog.far = d * 5; view.ocean?.setFog?.(scene.fog.near, scene.fog.far);
  };
  const lowSun = () => { if (mode === 'cam') return; { const o = view.camera.position.clone().sub(tgt); o.y = 0; o.normalize(); const a = 1.1; const x = o.x * Math.cos(a) - o.z * Math.sin(a), z = o.x * Math.sin(a) + o.z * Math.cos(a); sun.position.set(tgt.x + x * 70, tgt.y + 55, tgt.z + z * 70); } sun.target.position.copy(tgt); sun.target.updateMatrixWorld(); };
  const origR = r.render.bind(r);
  r.render = (s, c) => { if (s === scene && c === view.camera) { lowView(c); lowSun(); } return origR(s, c); };
  if (mode === 'cam') { await new Promise((res) => setTimeout(res, 1500)); return; }
  const C = { ACES: 4, AGX: 6, PCFSoft: 2 };
  r.toneMapping = 7; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true; r.shadowMap.type = C.PCFSoft;
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.map?.dispose(); sun.shadow.map = null;
  sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, far: 400 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) {
      const m = o.material; const mats = Array.isArray(m) ? m : [m];
      const lit = mats.some((x) => x && (x.isMeshLambertMaterial || x.isMeshStandardMaterial || x.isMeshPhongMaterial));
      if (lit) { o.castShadow = true; o.receiveShadow = true; }
      mats.forEach((x) => x && (x.needsUpdate = true));
    }
  });
  if (mode !== 'tone') {
    const { EffectComposer } = await import('/node_modules/three/examples/jsm/postprocessing/EffectComposer.js');
    const { RenderPass } = await import('/node_modules/three/examples/jsm/postprocessing/RenderPass.js');
    const { GTAOPass } = await import('/node_modules/three/examples/jsm/postprocessing/GTAOPass.js');
    const { OutputPass } = await import('/node_modules/three/examples/jsm/postprocessing/OutputPass.js');
    const { ShaderPass } = await import('/node_modules/three/examples/jsm/postprocessing/ShaderPass.js');
    const { HorizontalTiltShiftShader } = await import('/node_modules/three/examples/jsm/shaders/HorizontalTiltShiftShader.js');
    const { VerticalTiltShiftShader } = await import('/node_modules/three/examples/jsm/shaders/VerticalTiltShiftShader.js');
    const w = r.domElement.width, h = r.domElement.height;
    const composer = new EffectComposer(r);
    composer.setPixelRatio(1); composer.setSize(w, h);
    const orig = r.render.bind(r);
    let inside = false;
    const camRef = { cam: null };
    const rp = new RenderPass(scene, view.camera); composer.addPass(rp);
    const ao = new GTAOPass(scene, view.camera, w, h);
    ao.updateGtaoMaterial({ radius: 2.5, distanceExponent: 1.5, thickness: 3, scale: 1.8, samples: 16 });
    ao.blendIntensity = 1.0;
    const ov = ao._overrideVisibility.bind(ao);
    ao._overrideVisibility = function () {
      ov();
      scene.traverse((o) => {
        const m = o.material;
        if (o.isMesh && o.visible && m && (m.isShaderMaterial || m.transparent || m.isMeshBasicMaterial)) { o.visible = false; this._visibilityCache.push(o); }
      });
    };
    composer.addPass(ao);
    if (mode === 'full') {
      const hs = new ShaderPass(HorizontalTiltShiftShader); hs.uniforms.h.value = 1.0 / w; hs.uniforms.r.value = 0.45;
      const vs = new ShaderPass(VerticalTiltShiftShader); vs.uniforms.v.value = 1.0 / h; vs.uniforms.r.value = 0.45;
      composer.addPass(hs); composer.addPass(vs);
    }
    composer.addPass(new OutputPass());
    r.render = (s, c) => {
      if (inside || s !== scene || c !== view.camera) return orig(s, c);
      window.__preRender?.(c, orig);
      inside = true; rp.camera = c; ao.camera = c;
      try { composer.render(); } finally { inside = false; }
    };
  }
  await new Promise((res) => setTimeout(res, 1500));
})()
