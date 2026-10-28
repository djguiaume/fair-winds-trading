import * as THREE from 'three';

/**
 * Ultra's last pass before the screen (decision 0221): the horizon haze, then the tone mapping.
 * The curve is three's Khronos PBR Neutral, with its toe (the black-level offset that saturates
 * dark colours) scaled by `uToe`: full by day, eased off at night so moonlit grass stays a muted
 * green instead of turning emerald. Works in linear colour; the output pass converts to sRGB.
 */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uHazeColor: { value: new THREE.Color() },
    uHazeStart: { value: 0.75 },
    uHazeStrength: { value: 0 },
    /** 0 leaves the colours as they are (the Settings switch off). */
    uToneMap: { value: 1 },
    uExposure: { value: 1 },
    uToe: { value: 1 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uHazeColor;
uniform float uHazeStart;
uniform float uHazeStrength;
uniform float uToneMap;
uniform float uExposure;
uniform float uToe;
varying vec2 vUv;

vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  color *= uExposure;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset * uToe;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  // The top of the picture is the farthest sea: it fades toward a pale sky.
  vec3 col = mix(c.rgb, uHazeColor, smoothstep(uHazeStart, 1.0, vUv.y) * uHazeStrength);
  gl_FragColor = vec4(uToneMap > 0.5 ? neutral(col) : col, c.a);
}`,
};
