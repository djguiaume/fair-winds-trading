/**
 * The drawn sky of the low views (issues #470, #552): the fog's colour at the horizon (the same air
 * as the sea camera's, issue #573), the sky's own colour above a haze line that changes with the
 * hour, then a bluer zenith; the sun or moon disc, larger when low, with its glow and a warm band
 * along the horizon under it; stars at night; storms off the bow as dark bands with rain under
 * them; and two layers of soft low-poly clouds, all in one draw. The dome is only a direction: it is
 * drawn at the far plane round the camera, behind everything, and only where nothing else was
 * drawn (the depth test), so the sea costs it nothing.
 */

export const SKY_VERTEX = /* glsl */ `
attribute float aShade;
// x: in from the soft rim (0 … 1), y: rank (shown under the layer's amount), z: layer (0 low, 1 high).
attribute vec3 aCloud;
// Turn round the horizon of the low clouds (x) and the high streaks (y).
uniform vec2 uCloudTurn;
// x, y: share of the low clouds and of the streaks the weather shows.
uniform vec3 uCloudAmount;
varying vec3 vDir;
varying float vShade;
varying vec3 vCloud;

void main() {
  vShade = aShade;
  float show = 1.0;
  float turn = 0.0;
  if (aShade >= 0.0) {
    bool high = aCloud.z > 0.5;
    turn = high ? uCloudTurn.y : uCloudTurn.x;
    show = smoothstep(aCloud.y, aCloud.y + 0.08, high ? uCloudAmount.y : uCloudAmount.x);
  }
  vCloud = vec3(aCloud.x, show, aCloud.z);
  // The clouds drift round the horizon; the dome and its stars stay put.
  float c = cos(turn);
  float s = sin(turn);
  vec3 dir = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
  vDir = dir;
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * dir, 1.0);
  // A cloud the weather hides folds to nothing, so it costs no pixels.
  gl_Position = show > 0.0 ? clip.xyww : vec4(0.0);
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
// x: the warm band along the horizon under a low sun, y: its half width round the horizon (chord).
uniform vec2 uSunHorizon;
// Toward the sun, flat, scaled by how low it stands: lights the clouds' sun side.
uniform vec2 uSunFlat;
// x: share of the sky with a star, y: their brightness now.
uniform vec2 uStars;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
// x: opacity, y: haze toward the horizon, z: softness of the rims, w: warmth on the sun side.
uniform vec4 uCloud;
uniform vec3 uCloudAmount;
// Per storm: toward it (x, z flat), half width (radians), strength.
uniform vec4 uSquall[2];
// Each storm's cloud top (radians).
uniform vec2 uSquallTop;
uniform vec3 uSquallColor;
// x: rain under the band, y: rain shafts per radian of width.
uniform vec2 uSquallRain;
varying vec3 vDir;
varying float vShade;
varying vec3 vCloud;

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

// A storm off the bow: a dark cloud wall with a lumpy top and, under its base, streaked rain
// down to the sea's far edge. Returns how much of it covers this direction (x), how much lighter
// it is here (y: 1 between the rain shafts) and the height up its cloud (z: 0 base … 1 top).
vec3 squall(vec3 dir, vec2 flatDir, vec4 s, float top) {
  float across = length(flatDir - s.xy);
  float side = 1.0 - smoothstep(s.z * 0.75, s.z, across);
  float u = (flatDir.x * s.y - flatDir.y * s.x) / s.z;
  float lump = top * (0.85 + 0.15 * sin(u * 7.0 + 1.3) * sin(u * 3.1 + 0.4)) * (1.0 - 0.25 * u * u);
  float base = lump * 0.4;
  float wall = 1.0 - smoothstep(lump * 0.85, lump, dir.y);
  float rain = 1.0 - smoothstep(base * 0.6, base, dir.y);
  float shafts = 0.5 + 0.5 * sin(u * uSquallRain.y * s.z + dir.y * 25.0);
  float body = wall * mix(1.0, uSquallRain.x, rain);
  // The camera stands above the sea, so the sea's far edge is a few degrees under the true
  // horizon: the rain reaches down to it.
  float foot = smoothstep(-0.1, -0.03, dir.y);
  float up = clamp((dir.y - base) / max(lump - base, 1e-3), 0.0, 1.0);
  return vec3(s.w * side * body * foot, rain * (1.0 - shafts), up);
}

void main() {
  vec3 dir = normalize(vDir);
  vec2 flatDir = normalize(dir.xz + vec2(1e-5, 0.0));
  vec3 col = gradient(dir);
  float above = smoothstep(-0.003, 0.003, dir.y);
  // The chord to the sun is its angle for small angles, and keeps its precision on phones.
  float apart = length(dir - uSunDir);
  float disc = (1.0 - smoothstep(uSun.x * 0.85, uSun.x, apart)) * above;
  col += uSunColor * uSun.y * exp(-apart * apart / (uSun.z * uSun.z)) * above;
  if (uSunHorizon.x > 0.0) {
    float around = length(flatDir - normalize(uSunDir.xz + vec2(1e-5, 0.0))) / uSunHorizon.y;
    col += uSunColor * uSunHorizon.x * exp(-around * around) * exp(-max(dir.y, 0.0) * 14.0) * above;
  }
  if (uStars.y > 0.0) col += uStars.y * stars(dir) * (1.0 - disc);
  col = mix(col, uSunColor, disc * uSun.w);
  float alpha = 1.0;
  if (vShade >= 0.0) {
    float sunSide = max(dot(flatDir, uSunFlat), 0.0) * uCloud.w;
    bool high = vCloud.z > 0.5;
    vec3 cloud = high
      ? mix(uCloudLit, uSunColor, 0.25 + sunSide)
      : mix(mix(uCloudShade, uCloudLit, vShade), uSunColor, sunSide * vShade);
    cloud = mix(cloud, uHorizon, uCloud.y * (1.0 - smoothstep(0.0, 0.1, dir.y)));
    float rim = high ? smoothstep(0.0, 1.0, vCloud.x) : smoothstep(0.0, uCloud.z, vCloud.x);
    col = cloud;
    alpha = rim * vCloud.y * (high ? uCloudAmount.z : uCloud.x);
  }
  vec3 storm = vec3(0.0);
  if (uSquall[0].w > 0.0) storm = squall(dir, flatDir, uSquall[0], uSquallTop.x);
  if (uSquall[1].w > 0.0) {
    vec3 next = squall(dir, flatDir, uSquall[1], uSquallTop.y);
    if (next.x > storm.x) storm = next;
  }
  if (storm.x > 0.0) {
    // The cloud is darkest at its base and catches the light up top; between the rain shafts
    // the sky behind shows a little.
    vec3 grey = uSquallColor * mix(0.8, 1.35, storm.z);
    col = mix(col, mix(grey, uHorizon, 0.35 * storm.y), storm.x);
  }
  gl_FragColor = vec4(mix(uHorizon, col, uGradient.w), alpha);
  #include <colorspace_fragment>
}
`;
