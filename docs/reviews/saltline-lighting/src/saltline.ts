/**
 * Saltline-style lighting mockup (thread "Compare Saltline's look with our game", 2026-11-11).
 * Not game code: loaded into the running game by `npm run shots -- --quality ultra --script docs/reviews/saltline-lighting/src/run.js`.
 * Each part can be switched off with window.__saltline = { bloom, pcss, probe, gust }.
 */
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { LightProbeGenerator } from 'three/examples/jsm/lights/LightProbeGenerator.js';

interface Parts {
  bloom: boolean;
  pcss: boolean;
  probe: boolean;
  gust: boolean;
}

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---- PCSS: contact-hardening soft shadows on three's compare sampler ------------------------
// The map is a depth-compare texture, so the blocker distance is estimated from the share still
// shadowed when the receiver is moved toward the light (near blockers stop shadowing first).
const PCSS = /* glsl */ `
float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
  float shadow = 1.0;
  shadowCoord.xyz /= shadowCoord.w;
  shadowCoord.z += shadowBias;
  bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
  if ( inFrustum && shadowCoord.z <= 1.0 ) {
    vec2 texel = vec2( 1.0 ) / shadowMapSize;
    float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
    vec2 search = texel * shadowRadius * 4.0;
    float b0 = 0.0, b1 = 0.0, b2 = 0.0;
    for ( int i = 0; i < 8; i ++ ) {
      vec2 uv = shadowCoord.xy + vogelDiskSample( i, 8, phi ) * search;
      b0 += 1.0 - texture( shadowMap, vec3( uv, shadowCoord.z ) );
      b1 += 1.0 - texture( shadowMap, vec3( uv, shadowCoord.z - PCSS_NEAR ) );
      b2 += 1.0 - texture( shadowMap, vec3( uv, shadowCoord.z - PCSS_FAR ) );
    }
    if ( b0 < 0.5 ) return 1.0;
    // 0 = the blocker touches the receiver, 1 = it stands far above it.
    float far = clamp( 0.5 * ( b1 + b2 ) / b0, 0.0, 1.0 );
    float r = mix( 0.8, shadowRadius * 3.5, far ) ;
    float lit = 0.0;
    for ( int i = 0; i < 16; i ++ ) {
      vec2 uv = shadowCoord.xy + vogelDiskSample( i, 16, phi + 1.7 ) * texel * r;
      lit += texture( shadowMap, vec3( uv, shadowCoord.z ) );
    }
    shadow = lit / 16.0;
  }
  return mix( 1.0, shadow, shadowIntensity );
}
`;

function patchShadows(scene: THREE.Scene) {
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const start = chunk.indexOf('float getShadow( sampler2DShadow shadowMap');
  const end = chunk.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', start);
  if (start < 0 || end < 0) throw new Error('shadow chunk changed');
  // Depth of the shadow camera is ~ 160 m: 1.5 m and 6 m above the receiver.
  const defs = '#define PCSS_NEAR 0.0095\n#define PCSS_FAR 0.0375\n';
  (THREE.ShaderChunk as Any).shadowmap_pars_fragment =
    chunk.slice(0, start) + defs + PCSS + '\n\t' + chunk.slice(end);
  scene.traverse((o: Any) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) m.needsUpdate = true;
  });
}

// ---- Wind gusts on the sea (cat's paws): darker ruffled patches between bright calm slicks ----
const GUST_FUNCS = /* glsl */ `
uniform vec3 uGust;
float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y);
}
float gustAt(vec2 xz){
  vec2 w = normalize(uGust.xy);
  vec2 p = xz - w * uTime * 3.0;                 // patches run downwind
  vec2 q = vec2(dot(p, w), dot(p, vec2(-w.y, w.x)));
  q *= vec2(1.0 / 45.0, 1.0 / 25.0);             // stretched across the wind
  float n = gNoise(q) * 0.6 + gNoise(q * 2.3 + 7.1) * 0.3 + gNoise(q * 5.1 + 3.3) * 0.1;
  return smoothstep(0.42, 0.66, n);
}
`;

function patchSea(scene: THREE.Scene) {
  let patched = 0;
  scene.traverse((o: Any) => {
    const m = o.material as Any;
    if (!m || !m.isShaderMaterial || !m.fragmentShader?.includes('The sky mirrored at low angles'))
      return;
    if (m.userData.saltlineGust) return;
    const wind = m.uniforms.uSeaWind?.value as THREE.Vector4 | undefined;
    m.uniforms.uGust = { value: new THREE.Vector3(wind?.x ?? 1, wind?.y ?? 0.3, 1) };
    let fs: string = m.fragmentShader;
    fs = fs.replace('varying vec3 vWorld;', 'varying vec3 vWorld;\n' + GUST_FUNCS);
    fs = fs.replace(
      '  col *= light;',
      [
        '  float gust = gustAt(vWorld.xz) * uGust.z;',
        '  float sparkle = gNoise(vWorld.xz * 1.7 + uTime * vec2(2.1, -1.3));',
        '  col *= light;',
      ].join('\n'),
    );
    fs = fs.replace(
      'mirrored.a * uMirrorLook.z',
      'mirrored.a * mix(1.0, 0.35, gust) * uMirrorLook.z',
    );
    fs = fs.replace(
      '  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));',
      '  col *= mix(1.04, 0.86 + 0.06 * sparkle, gust);\n  col += vec3(0.07) * gust * smoothstep(0.82, 0.95, gNoise(vWorld.xz * vec2(2.6, 4.0) + uTime * vec2(1.3, -0.7)));\n  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));',
    );
    fs = fs.replace(
      'col = mix(col, uSkyLight, fresnel * uReflect);',
      'col = mix(col, uSkyLight, fresnel * uReflect * mix(1.1, 0.6, gust));',
    );
    m.fragmentShader = fs;
    m.needsUpdate = true;
    m.userData.saltlineGust = true;
    patched++;
  });
  return patched;
}

// ---- Sky light from the real sky and sea (a light probe), in place of most of the flat hemisphere ----
function skyProbe(view: Any) {
  const renderer: THREE.WebGLRenderer = view.renderer;
  const scene: THREE.Scene = view.scene;
  const hemi: THREE.HemisphereLight = view.hemi;
  const rt = new THREE.WebGLCubeRenderTarget(32, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(1, 1000, rt);
  const probe = new THREE.LightProbe();
  probe.intensity = 1;
  scene.add(probe);
  // The game sets the hemisphere's strength every frame: keep only a share of it.
  const KEEP = 0.35;
  let raw = hemi.intensity;
  Object.defineProperty(hemi, 'intensity', {
    get: () => raw * KEEP,
    set: (v: number) => (raw = v),
    configurable: true,
  });
  let busy = false;
  const update = async () => {
    if (busy) return;
    busy = true;
    const at = view.camera.position as THREE.Vector3;
    cube.position.set(at.x, Math.max(8, at.y * 0.4), at.z);
    probe.visible = false;
    cube.update(renderer, scene);
    probe.visible = true;
    const sh = await LightProbeGenerator.fromCubeRenderTarget(renderer, rt);
    busy = false;
    probe.sh.copy(sh.sh);
    // Same brightness as the share taken from the hemisphere (sideways normals, where both average
    // sky and ground): the probe changes the light's colour and direction, not its strength.
    const side = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
    const c = new THREE.Color();
    let got = 0;
    for (const n of side) { sh.sh.getIrradianceAt(n, c as Any); got += c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722; }
    got /= side.length;
    const want = c.copy(hemi.color).lerp(hemi.groundColor, 0.5);
    const wantLum = (want.r * 0.2126 + want.g * 0.7152 + want.b * 0.0722) * (1 - KEEP) * raw;
    probe.intensity = got > 1e-5 ? wantLum / got : 0;
  };
  return update;
}

export async function apply(fwt: Any) {
  const parts: Parts = { bloom: true, pcss: true, probe: true, gust: true, ...(window as Any).__saltline };
  const view = fwt.view;
  const ultra = view.ultra;
  if (!ultra) throw new Error('Ultra pipeline not loaded: use --quality ultra');
  if (parts.pcss) patchShadows(view.scene);
  if (parts.gust) patchSea(view.scene);
  if (parts.bloom) {
    const size = view.renderer.getDrawingBufferSize(new THREE.Vector2());
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.5, (window as Any).__saltline?.bloomThreshold ?? 1.05);
    const passes = ultra.composer.passes as Any[];
    passes.splice(2, 0, bloom); // after the scene and the occlusion, before the grade
  }
  let probeUpdate: (() => Promise<void>) | null = parts.probe ? skyProbe(view) : null;
  let frame = 0;
  const render = view.render.bind(view);
  view.render = (dt: number) => {
    if (probeUpdate && frame++ % 60 === 0) void probeUpdate();
    render(dt);
  };
  return parts;
}
