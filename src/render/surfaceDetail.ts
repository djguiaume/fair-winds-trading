import * as THREE from 'three';
import { TUNING } from '../data/tuning';
import { WORLD_FROM_EYE, chainCompile } from './materialChain';
import { SURFACE_KINDS, type SurfaceKind, surfaceFragment, surfaceKindNumber } from './surfaceGlsl';

/**
 * Soft surface patterns near the camera (issue #572): planks on hulls, decks and quays, stone and
 * plaster on walls, tiles, slate or thatch on roofs, seams on sails. One shared patch of the
 * Lambert materials, no image file: the pattern comes from the model's position, shifts only the
 * face colour's lightness and fades out between `graphics.json › surface.fadeFrom` and `fadeTo`
 * from the camera when looked down on (the top view, which stays as clean as before) and between
 * `levelFadeFrom` and `levelFadeTo` when seen level (the follow cam, where towns stand farther).
 * A part's pattern is baked per vertex as `surface` from `userData.surface` when its parts merge
 * (`mergeAll`); a sail takes one for the whole material. The levels without `surfacePatterns` set the strength to 0.
 */

const ATTRIBUTE = 'surface';

const SURFACE = {
  /**
   * Strength (0 off), and 1 where the frame is drawn without tone mapping: there a sunlit white
   * wall is past full white, so the pattern works on the colour as shown, or it would vanish.
   */
  uSurface: { value: new THREE.Vector2(0, 1) },
  /** Fade start and end (world units from the camera) seen from above, then seen level. */
  uSurfaceFade: { value: new THREE.Vector4(40, 70, 50, 130) },
  /** Per kind: size in world units, lightness contrast. */
  uSurfaceKinds: { value: SURFACE_KINDS.map(() => new THREE.Vector4(1, 0, 0, 0)) },
};

/** 1 where the level draws boat hulls round between their strakes (`boatSurfaces.ts`). */
export const SMOOTH_HULLS = { value: 0 };

/** Marks a part's pattern; `mergeAll` bakes it into the merged mesh. Returns the part. */
export function withSurface(geometry: THREE.BufferGeometry, kind: SurfaceKind | undefined) {
  if (kind) geometry.userData.surface = kind;
  return geometry;
}

/**
 * Before merging: if any part has a pattern, every part gets the `surface` attribute (0 = plain),
 * since parts merge only when they carry the same attributes.
 */
export function bakeSurfaces(parts: readonly THREE.BufferGeometry[]) {
  if (!parts.some((g) => g.userData.surface || g.attributes[ATTRIBUTE])) return;
  for (const g of parts) {
    if (g.attributes[ATTRIBUTE]) continue;
    const kind = surfaceKindNumber(g.userData.surface as SurfaceKind | undefined);
    const count = g.attributes.position!.count;
    g.setAttribute(ATTRIBUTE, new THREE.BufferAttribute(new Float32Array(count).fill(kind), 1));
  }
}

/**
 * Adds the patterns to a Lambert material. With `kind` the whole material takes that pattern
 * (a sail's canvas), else each vertex its baked `surface` (none without the attribute).
 */
export function withSurfaceDetail<M extends THREE.MeshLambertMaterial>(
  material: M,
  kind?: SurfaceKind,
): M {
  const fixed = kind ? `${surfaceKindNumber(kind)}.0` : null;
  return chainCompile(material, `surface${fixed ?? ''}`, (shader) => {
    Object.assign(shader.uniforms, SURFACE);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${fixed ? '' : `attribute float ${ATTRIBUTE};`}
varying vec3 vSurfacePos;
varying float vSurfaceKind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSurfaceKind = ${fixed ?? ATTRIBUTE};
// The model's own axes in world units, so a boat's planks sail with her.
vSurfacePos = transformed * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${surfaceFragment(SURFACE_KINDS.length)}`)
      .replace(
        '#include <opaque_fragment>',
        `{
  int surfaceKind = int(vSurfaceKind + 0.5);
  // Looked down on (the top view) the patterns go sooner than seen level (the follow cam).
  float above = smoothstep(0.35, 0.6, -normalize(${WORLD_FROM_EYE}).y);
  vec2 fade = mix(uSurfaceFade.zw, uSurfaceFade.xy, above);
  float near = 1.0 - smoothstep(fade.x, fade.y, length(vViewPosition));
  vec3 faceNormal = normalize(cross(dFdx(vSurfacePos), dFdy(vSurfacePos)));
  if (surfaceKind > 0 && uSurface.x * near > 0.0) {
    vec3 shown = uSurface.y > 0.5 ? min(outgoingLight, vec3(1.0)) : outgoingLight;
    outgoingLight = shown * (1.0 + surfaceShift(surfaceKind, vSurfacePos, faceNormal) * uSurface.x * near);
  }
}
#include <opaque_fragment>`,
      );
  });
}

/**
 * This frame's patterns: the data's on the levels with `surfacePatterns`, else none; boat hulls
 * shaded round on the levels with `softEdges`; `toneMapped` on Ultra's pipeline.
 */
export function setSurfaceDetail(patterns: boolean, soft: boolean, toneMapped: boolean) {
  const data = TUNING.graphics.surface;
  const strength = patterns ? data.strength : 0;
  SURFACE.uSurface.value.set(strength, toneMapped ? 0 : 1);
  SURFACE.uSurfaceFade.value.set(data.fadeFrom, data.fadeTo, data.levelFadeFrom, data.levelFadeTo);
  SURFACE_KINDS.forEach((kind, i) => {
    const p = data.patterns[kind];
    SURFACE.uSurfaceKinds.value[i]!.set(p.size, p.contrast, 0, 0);
  });
  SMOOTH_HULLS.value = soft && data.smoothHulls ? 1 : 0;
}
