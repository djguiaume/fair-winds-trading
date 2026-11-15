/**
 * The drawn sky of the low views (issue #470): the fog's colour at the horizon (the same air as the
 * sea camera's, issue #573), the sky's own colour above a thin haze line, then a bluer zenith, the sun or moon disc and its glow, stars at night, and the low-poly clouds, all in one
 * draw. The dome is only a direction: it is drawn at the far plane round the camera, behind
 * everything, and only where nothing else was drawn (the depth test), so the sea costs it nothing.
 */

export const SKY_VERTEX = /* glsl */ `
attribute float aShade;
uniform float uCloudTurn;
varying vec3 vDir;
varying float vShade;

void main() {
  // The clouds drift round the horizon; the dome and its stars stay put.
  float turn = aShade < 0.0 ? 0.0 : uCloudTurn;
  float c = cos(turn);
  float s = sin(turn);
  vec3 dir = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
  vDir = dir;
  vShade = aShade;
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * dir, 1.0);
  gl_Position = clip.xyww;
}
`;

export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uSkyline;
uniform vec3 uZenith;
// 1 / sine of the haze line's height: the fog's colour gives way to the sky's below it.
uniform float uHazeLine;
// x: 1 / sine of the gradient's height, y: its curve, z: bands (0 = smooth), w: how much shows.
uniform vec4 uGradient;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
// x: disc radius, y: glow strength, z: glow radius (radians), w: disc strength.
uniform vec4 uSun;
// x: share of the sky with a star, y: their brightness now.
uniform vec2 uStars;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
// x: opacity, y: haze toward the horizon.
uniform vec2 uCloud;
varying vec3 vDir;
varying float vShade;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

vec3 gradient(vec3 dir) {
  float t = pow(clamp(dir.y * uGradient.x, 0.0, 1.0), uGradient.y);
  if (uGradient.z > 0.5) t = floor(t * uGradient.z + 0.0001) / uGradient.z;
  vec3 sky = mix(uSkyline, uZenith, t);
  return mix(uHorizon, sky, smoothstep(0.0, 1.0, dir.y * uHazeLine));
}

float stars(vec3 dir) {
  vec3 p = dir * 90.0;
  vec3 cell = floor(p);
  float on = step(1.0 - uStars.x, hash(cell));
  float spot = 1.0 - smoothstep(0.08, 0.22, length(fract(p) - 0.5));
  return on * spot * (0.4 + 0.6 * hash(cell + 7.0)) * smoothstep(0.0, 0.03, dir.y);
}

void main() {
  vec3 dir = normalize(vDir);
  vec3 col = gradient(dir);
  float above = smoothstep(-0.003, 0.003, dir.y);
  // The chord to the sun is its angle for small angles, and keeps its precision on phones.
  float apart = length(dir - uSunDir);
  float disc = (1.0 - smoothstep(uSun.x * 0.85, uSun.x, apart)) * above;
  col += uSunColor * uSun.y * exp(-apart * apart / (uSun.z * uSun.z)) * above;
  if (uStars.y > 0.0) col += uStars.y * stars(dir) * (1.0 - disc);
  col = mix(col, uSunColor, disc * uSun.w);
  if (vShade >= 0.0) {
    vec3 cloud = mix(uCloudShade, uCloudLit, vShade);
    cloud = mix(cloud, uHorizon, uCloud.y * (1.0 - smoothstep(0.0, 0.1, dir.y)));
    col = mix(col, cloud, uCloud.x);
  }
  gl_FragColor = vec4(mix(uHorizon, col, uGradient.w), 1.0);
  #include <colorspace_fragment>
}
`;
