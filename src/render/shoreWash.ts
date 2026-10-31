import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { WAVE_BANDS, type SeaState } from '../sim/seaState';
import type { WaveField } from '../sim/waves';

/**
 * The surf at the shore and its wash up the beach (issue #397). Near land the swell turns to meet
 * the shore and breaks in thin lines parallel to it that travel in, a crisp front and a faded
 * tail (the ocean's fragment, `seaFoam.ts`); each line that lands runs up the sand as a thin foam
 * edge over a sheen of water and slides back, leaving a darker, cooler wet band (the ground's
 * fragment, `fieldGroundGlsl.ts`). Both read one surf phase, so the wash lands with its line, out
 * of phase along the shore with the swell's own crests. Stronger on open and windward coasts and
 * in a storm, nothing in a closed harbour, none at all where the ocean doesn't draw per pixel
 * (Low, Ultra-low) or the waves are off. Numbers: `waves.json` › `surf`, `wash`.
 */

/**
 * Shared by the ocean's and every island ground's material (the same uniform objects), written
 * once a frame by `ShoreWash.write`. `uWash.x` 0 turns everything off.
 */
export const SHORE_WASH_UNIFORMS = {
  // The surf phase now (radians), the swell's wavenumber (scene x, z), the along-shore wobble.
  uSurf: { value: new THREE.Vector4() },
  // Line spacing, how far out the lines start, crisp front and faded tail (units).
  uSurfLines: { value: new THREE.Vector4(1, 0, 1, 1) },
  // Line strength, share broken by gaps, the wobble's scale (per unit).
  uSurfLook: { value: new THREE.Vector3() },
  // On and how strong (0..1), reach up the sand (units), share of a cycle it rises, edge width.
  uWash: { value: new THREE.Vector4() },
  // Foam, wet darkening, sheen, highest ground it can reach.
  uWashLook: { value: new THREE.Vector4() },
  // Exposure (bake green) where a coast starts to open and is fully open, the lee's share, how
  // far round the ground looks for open water (units). The ocean's vertex reads it too.
  uWashOpen: { value: new THREE.Vector4(0, 1, 1, 3) },
  uWashBake: { value: null as THREE.Texture | null },
  uWashBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
  // The foam's share in this light, its colour (never whiter than `foam.cap`), the wet tint and
  // the sheen's colour.
  uWashNight: { value: 1 },
  uWashFoam: { value: new THREE.Color() },
  uWashWet: { value: new THREE.Color() },
  uWashSheen: { value: new THREE.Color() },
  // How much foam lace the running sheet carries behind its edge.
  uWashLace: { value: 0 },
};

/** How strong the surf is on a coast this open (the bake's exposure), thinner in the lee. */
export const surfOpenShader = /* glsl */ `
uniform vec4 uWashOpen;
float surfOpen(float exposure, float windward) {
  return smoothstep(uWashOpen.x, uWashOpen.y, exposure) * mix(uWashOpen.z, 1.0, windward);
}
`;

/** Top level, in both shaders: the uniforms and `surfPhase(p)`, radians at the shore now. */
export const surfFunctions = /* glsl */ `
uniform vec4 uSurf;
uniform vec4 uSurfLines;
uniform vec3 uSurfLook;
uniform vec4 uWash;
${surfOpenShader}
float surfHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float surfNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(surfHash(i), surfHash(i + vec2(1.0, 0.0)), f.x),
             mix(surfHash(i + vec2(0.0, 1.0)), surfHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// The swell's own phase along the shore, wobbled so neighbouring stretches never land together.
float surfPhase(vec2 p) {
  return uSurf.x + dot(uSurf.yz, p) + uSurf.w * surfNoise(p * uSurfLook.z);
}
`;

/**
 * The ocean's breaking lines at `d` units from the shore (0..1): a line every `spacing` units
 * travelling in, the zone 1 to 2 lines wide, each line broken by its own gaps. Medium and up.
 */
export const surfLinesShader = /* glsl */ `
float surfLines(vec2 p, float d) {
  float zone = uSurfLines.y;
  if (uWash.x <= 0.0 || d > zone) return 0.0;
  float cycles = surfPhase(p) / 6.2832 + d / uSurfLines.x;
  float s = fract(cycles);
  float aa = 1.5 * fwidth(d);
  float front = 1.0 - smoothstep(0.0, max(uSurfLines.z, aa), (1.0 - s) * uSurfLines.x);
  float tail = 1.0 - smoothstep(0.0, uSurfLines.w, s * uSurfLines.x);
  float zoneFade = (1.0 - smoothstep(zone - 0.6 * uSurfLines.x, zone, d)) * smoothstep(0.3, 1.5, d);
  float which = floor(cycles + 0.5);
  float gaps = smoothstep(uSurfLook.y - 0.12, uSurfLook.y + 0.12,
    surfNoise(p * 0.16 + vec2(which * 3.7, which * 1.9)));
  return max(front, tail * tail) * zoneFade * gaps * uSurfLook.x;
}
`;

/**
 * The ground's side: `groundWash(colour, p, height, up, steep)` washes the swell up the sand at
 * scene point `p` (`height` above the sea, `up` the ground normal's y, `steep` its cliff share).
 */
export const groundWashShader = /* glsl */ `
uniform vec4 uWashLook;
uniform sampler2D uWashBake;
uniform vec4 uWashBounds;
uniform float uWashNight;
uniform vec3 uWashFoam;
uniform vec3 uWashWet;
uniform vec3 uWashSheen;
uniform float uWashLace;

float washExposure(vec2 p) {
  vec2 uv = (p - uWashBounds.xy) / uWashBounds.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
  return texture2D(uWashBake, uv).g;
}

// How open the sea off this beach lies (0 in a closed harbour), thinner in the swell's lee.
float washOpen(vec2 p) {
  float r = uWashOpen.w;
  float open = max(max(washExposure(p + vec2(r, 0.0)), washExposure(p - vec2(r, 0.0))),
                   max(washExposure(p + vec2(0.0, r)), washExposure(p - vec2(0.0, r))));
  vec2 from = -normalize(uSurf.yz + vec2(1e-6));
  float windward = smoothstep(uWashOpen.x, uWashOpen.y, washExposure(p + from * 2.0 * r));
  return surfOpen(open, windward);
}

vec3 groundWash(vec3 colour, vec2 p, float height, float up, float steep) {
  if (uWash.x <= 0.0 || height > uWashLook.w || height < -0.5) return colour;
  float strength = uWash.x * washOpen(p);
  if (strength <= 0.01) return colour;
  // Units up the sand from the water's edge, from the ground's slope.
  float tanSlope = sqrt(max(1.0 - up * up, 0.0)) / max(up, 0.1);
  float x = max(height, 0.0) / max(tanSlope, 0.02);
  float reach = uWash.y * (0.5 + 0.5 * strength);
  // The cycle: runs up fast, slides back slower.
  float s = fract(surfPhase(p) / 6.2832);
  float rising = s < uWash.z ? 1.0 : 0.0;
  float t = rising > 0.5 ? s / uWash.z : (s - uWash.z) / (1.0 - uWash.z);
  float run = rising > 0.5 ? 1.0 - (1.0 - t) * (1.0 - t) : (1.0 - t) * (1.0 - t);
  float front = reach * run;
  float sand = 1.0 - steep;
  float aa = fwidth(x);
  // The running sheet of water, and the wet band to the highest reach behind it, its inner edge
  // soft and breathing with the wash: darker, cooler sand, a faint sheen under the sheet.
  float sheet = (1.0 - smoothstep(front - aa, front + aa, x)) * step(0.02, front);
  float wetTop = reach * (0.8 + 0.2 * run);
  float wet = max(1.0 - smoothstep(0.55 * wetTop, wetTop, x), sheet);
  colour = mix(colour, colour * uWashWet, wet * sand * strength * uWashLook.y);
  colour = mix(colour, uWashSheen, sheet * sand * strength * uWashLook.z);
  // A crisp foam edge on the sheet's front and a lace of foam just behind it, fading as the
  // wash slides back.
  float behind = (front - x) / max(front, 0.05);
  float grain = surfNoise(p * 2.3 + uSurf.x * 0.4);
  float lace = (1.0 - smoothstep(0.0, 0.7, behind)) * smoothstep(0.45, 0.75, grain) * uWashLace;
  float line = 1.0 - smoothstep(0.0, max(uWash.w, aa), front - x);
  float fading = mix(0.3, 1.0, rising + (1.0 - rising) * (1.0 - t));
  float foam = sheet * max(line * (0.75 + 0.25 * grain), lace) * fading;
  return mix(colour, uWashFoam, foam * strength * uWashLook.x * uWashNight);
}
`;

const smooth01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const lerp = (range: readonly number[], t: number) => range[0]! + (range[1]! - range[0]!) * t;
/** 0 to 1 as `x` goes across `range`, smoothly. */
const across = (range: readonly number[], x: number) =>
  smooth01((x - range[0]!) / Math.max(1e-6, range[1]! - range[0]!));

/** The land's bake as the ocean binds it: exposure in green. */
interface Bake {
  value: THREE.Texture | null;
}

/**
 * The surf's clock and its frame's numbers. The phase runs at the period of the sea now, so a
 * building storm quickens the breakers without a jump.
 */
export class ShoreWash {
  private phase = 0;
  private time = Number.NaN;

  /**
   * The frame's surf and wash for `sea` and its `field` at world `time`. `on`: the ocean draws per
   * pixel with the coast's calm (Medium and up, waves on). `night`: the foam's share in this light.
   */
  write(
    sea: SeaState,
    field: WaveField,
    time: number,
    on: boolean,
    night: number,
    bake: { map: Bake; bounds: { value: THREE.Vector4 } },
  ): void {
    const u = SHORE_WASH_UNIFORMS;
    const { surf, wash, foam } = TUNING.waves;
    const rough = Math.min(1, (sea.swell.height + sea.chop.height) / foam.roughAt);
    const strength = on ? across(surf.from, rough) : 0;
    u.uWash.value.x = strength;
    if (strength <= 0) return;
    const stormy = across(surf.storm, sea.swell.height);
    const period = lerp(surf.period, stormy);
    const dt = Math.min(0.5, Math.max(0, time - this.time));
    this.time = time;
    if (Number.isFinite(dt))
      this.phase = (this.phase + (2 * Math.PI * dt) / period) % (2 * Math.PI);
    const [kx, kz] = swellWavenumber(field);
    u.uSurf.value.set(this.phase, kx, kz, surf.wobble * 2 * Math.PI);
    // The lines show beyond the shore ring (as wide as the ocean draws it now) and fade into it.
    const water = TUNING.graphics.water;
    const ring = water.foamInner + water.foamWidth * (1 + foam.widen * rough);
    const zone = ring + surf.spacing * lerp(surf.lines, stormy);
    u.uSurfLines.value.set(surf.spacing, zone, surf.front, surf.tail);
    u.uSurfLook.value.set(surf.strength, surf.gaps, surf.wobbleScale);
    u.uWash.value.set(strength, lerp(wash.reach, stormy), wash.rise, wash.edge);
    u.uWashLook.value.set(wash.foam, wash.wet, wash.sheen, wash.top);
    u.uWashOpen.value.set(surf.open[0]!, surf.open[1]!, foam.lee, wash.look);
    u.uWashBake.value = bake.map.value;
    u.uWashBounds.value.copy(bake.bounds.value);
    u.uWashNight.value = night;
    u.uWashFoam.value.set(foam.cap);
    u.uWashWet.value.set(wash.wetTint);
    u.uWashSheen.value.set(wash.sheenColour);
    u.uWashLace.value = wash.lace;
  }
}

/** Nothing at the shore: the waves are off, or this level doesn't draw them per pixel. */
export function shoreWashOff() {
  SHORE_WASH_UNIFORMS.uWash.value.x = 0;
}

const SWELL = WAVE_BANDS.indexOf('swell');

/** The largest swell component's wavenumber in scene space (x, z = -sim y), or zero. */
function swellWavenumber(field: WaveField): [number, number] {
  let best = -1;
  for (let i = 0; i < field.count; i++)
    if (field.band[i] === SWELL && (best < 0 || field.amp[i]! > field.amp[best]!)) best = i;
  return best < 0 ? [0, 0] : [field.kx[best]!, -field.ky[best]!];
}
