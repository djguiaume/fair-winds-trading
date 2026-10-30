import { shoreShader } from './shoreTexture';
import { seabedShader } from './seabedTexture';
import { seaFoamFunctions, seaFoamShader } from './seaFoam';

/**
 * The ocean's colours (`ocean.ts`): flat shaded, by the seabed's depth or the classic shallow
 * tint, shore foam, and on High and Ultra the sky's reflection and the sun's glint.
 */
export const oceanFragmentShader = /* glsl */ `
uniform float uTime;
#ifndef VERTEX_SHORES
${shoreShader}
#ifdef DEPTH
${seabedShader}
#endif
#endif
#ifdef VERTEX_SHORES
varying float vShoreDistance;
#ifdef DEPTH
varying float vDepth;
#endif
#endif
#ifdef DEPTH
// The mid colour's place on the depth (0..1), the crest lightening and the facet shading.
uniform vec3 uDepthLook;
#endif
uniform vec3 uSunDir;
uniform vec3 uWater;
uniform vec3 uWaterLight;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
#ifdef REFLECT
uniform vec3 uSkyLight;
uniform vec3 uSunColor;
uniform float uReflect;
uniform float uFresnelPower;
uniform float uGlint;
uniform float uGlintSharpness;
// Glint fades out between these view heights (sines of the angle above the sea), and peaks at w.
uniform vec3 uGlintFade;
#endif
#if defined(REFLECT) || defined(DEPTH)
// Soft shore foam: full strength out to x, fading over y, opacity z, outer line w.
uniform vec4 uFoamLook;
#endif
#ifdef COAST
// The sea now (x: how rough, y: how wide the shore foam grows, z: surf, w: whitecaps), and per
// vertex how high a crest stands, the surf and the swell's share (oceanWaves.ts).
uniform vec4 uSeaFoam;
// The foam's share in this light: all of it by day, waves.json › foam.night at night.
uniform float uFoamNight;
// The way the swell runs (scene x, z), how much the shore ring breaks up, the whitest foam.
uniform vec4 uSeaWind;
uniform float uFoamBreakup;
uniform vec3 uFoamCap;
varying vec3 vSea;
${seaFoamFunctions}
#endif
varying vec3 vWorld;
varying float vHeight;
varying float vFogDepth;

void main() {
#ifdef PLAIN
  // Ultra-low (decision 0247): no facets; the waves show in the crest colour alone.
  float light = 1.0;
#else
  // Flat shading: one normal per triangle from screen-space derivatives.
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  float light = 0.62 + 0.5 * max(dot(n, uSunDir), 0.0);
#endif

  // Distance to the nearest beach, for the foam line.
#ifdef VERTEX_SHORES
  float d = vShoreDistance;
#else
  float d = shoreDistance(vWorld.xz);
#endif
#ifdef DEPTH
  // Coloured by the seabed's depth (issue #274): shallow → mid → deep (uWaterLight, uWater).
#ifdef VERTEX_SHORES
  float dep = vDepth;
#else
  float dep = seabedDepth(vWorld.xz);
#endif
  vec3 col = mix(uShallow, uWaterLight, clamp(dep / uDepthLook.x, 0.0, 1.0));
  col = mix(col, uWater, clamp((dep - uDepthLook.x) / (1.0 - uDepthLook.x), 0.0, 1.0));
  col *= 1.0 + uDepthLook.y * (smoothstep(-0.35, 0.45, vHeight) - 0.5);
  light = mix(1.0, light, uDepthLook.z);
#else
  vec3 col = mix(uWater, uWaterLight, smoothstep(-0.35, 0.45, vHeight));
  col = mix(col, uShallow, (1.0 - smoothstep(0.0, 14.0, d)) * 0.85);
#endif
#ifdef FANCY
  float ripple = sin(vWorld.x * 0.45 + uTime * 1.3) * sin(vWorld.z * 0.5 - uTime * 1.7);
#else
  float ripple = 0.0;
#endif
#if defined(REFLECT) || defined(DEPTH)
  // A wide band that fades softly into the sea, and a faint line further out that comes and goes.
#if defined(COAST) && !defined(PLAIN)
  ${seaFoamShader}
#else
  float soft = 1.0 - smoothstep(uFoamLook.x, uFoamLook.x + uFoamLook.y, d + 0.5 * ripple);
  float beyond = d - uFoamLook.x - uFoamLook.y - 1.0 - 0.8 * sin(uTime * 0.9 + d * 0.4);
  float line = (1.0 - smoothstep(0.0, 1.2, abs(beyond))) * uFoamLook.w;
  col = mix(col, uFoam, clamp(soft * soft * uFoamLook.z + line, 0.0, 1.0));
#endif
#elif defined(FANCY)
  float foam = 1.0 - smoothstep(0.8, 2.6, d + 0.7 * ripple + 0.6 * sin(uTime * 1.4 + d * 0.6));
  col = mix(col, uFoam, foam * 0.8);
#else
  float foam = 1.0 - smoothstep(0.8, 2.6, d);
  col = mix(col, uFoam, foam * 0.8);
#endif

  col *= light;
#ifdef REFLECT
  // The sky mirrored at low angles (Fresnel), and the sun or moon sparkling on the facets.
  vec3 toEye = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(n, toEye), 0.0), uFresnelPower);
  col = mix(col, uSkyLight, fresnel * uReflect);
  // A glint belongs to a low view: looking down at a high sun it would blow out half the screen.
  float glint = pow(max(dot(n, normalize(uSunDir + toEye)), 0.0), uGlintSharpness);
  glint *= 1.0 - smoothstep(uGlintFade.x, uGlintFade.y, toEye.y);
  col += uSunColor * min(glint * uGlint, uGlintFade.z);
#endif
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
