import * as THREE from 'three';

/**
 * The GLSL of Ultra's bloom (decision 0299): a chain of ever smaller pictures of what is brighter
 * than a threshold, blurred on the way down and added back together on the way up. The widest
 * taps are Jimenez's 13-tap downsample and a 3x3 tent upsample: no shimmer on a moving lantern.
 */
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Thirteen taps as five overlapping boxes: the centre box weighs half, the corners an eighth. */
const BOXES = /* glsl */ `
uniform sampler2D tSource;
uniform vec2 uTexel;
varying vec2 vUv;

vec3 tap(float x, float y) {
  return max(texture2D(tSource, vUv + vec2(x, y) * uTexel).rgb, 0.0);
}

#define BOXES \
  vec3 a = tap(-2.0, 2.0), b = tap(0.0, 2.0), c = tap(2.0, 2.0); \
  vec3 d = tap(-2.0, 0.0), e = tap(0.0, 0.0), f = tap(2.0, 0.0); \
  vec3 g = tap(-2.0, -2.0), h = tap(0.0, -2.0), i = tap(2.0, -2.0); \
  vec3 j = tap(-1.0, 1.0), k = tap(1.0, 1.0), l = tap(-1.0, -1.0), m = tap(1.0, -1.0); \
  vec3 centre = (j + k + l + m) * 0.25; \
  vec3 topLeft = (a + b + d + e) * 0.25, topRight = (b + c + e + f) * 0.25; \
  vec3 lowLeft = (d + e + g + h) * 0.25, lowRight = (e + f + h + i) * 0.25;
`;

/**
 * The scene to the first, half-size picture: only what is brighter than `uThreshold` passes,
 * eased in over `uKnee` either side of it so a glow has no hard edge. Each box counts less the brighter it is
 * (Karis), so one very bright far lantern does not flicker as the boat moves.
 */
export const BloomBrightShader = {
  uniforms: {
    tSource: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 1 },
    uKnee: { value: 0.1 },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
${BOXES}
uniform float uThreshold;
uniform float uKnee;

float peak(vec3 v) {
  return max(v.r, max(v.g, v.b));
}

vec4 calm(vec3 v, float share) {
  float w = share / (1.0 + peak(v));
  return vec4(v * w, w);
}

void main() {
  BOXES
  vec4 sum = calm(centre, 0.5) + calm(topLeft, 0.125) + calm(topRight, 0.125)
    + calm(lowLeft, 0.125) + calm(lowRight, 0.125);
  vec3 colour = sum.rgb / sum.a;
  float pass = smoothstep(uThreshold - uKnee, uThreshold + uKnee, peak(colour));
  gl_FragColor = vec4(colour * pass, 1.0);
}`,
};

/** One picture to the next, half its size. */
export const BloomDownShader = {
  uniforms: {
    tSource: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2() },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
${BOXES}
void main() {
  BOXES
  gl_FragColor = vec4(centre * 0.5 + (topLeft + topRight + lowLeft + lowRight) * 0.125, 1.0);
}`,
};

/** A smaller picture added onto the next bigger one (additive blending), `uSpread` of it. */
export const BloomUpShader = {
  uniforms: {
    tSource: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2() },
    uSpread: { value: 0.5 },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tSource;
uniform vec2 uTexel;
uniform float uSpread;
varying vec2 vUv;

vec3 tap(float x, float y) {
  return texture2D(tSource, vUv + vec2(x, y) * uTexel).rgb;
}

void main() {
  vec3 tent = tap(0.0, 0.0) * 4.0
    + (tap(-1.0, 0.0) + tap(1.0, 0.0) + tap(0.0, -1.0) + tap(0.0, 1.0)) * 2.0
    + tap(-1.0, -1.0) + tap(1.0, -1.0) + tap(-1.0, 1.0) + tap(1.0, 1.0);
  gl_FragColor = vec4(tent * (uSpread / 16.0), 1.0);
}`,
};
