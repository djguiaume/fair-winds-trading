import * as THREE from 'three';

/**
 * The sun's shadows on the sea (issue #550): the boat, quays and cliffs shade the water on High
 * and Ultra, read from the same shadow map the land uses. The ocean shader (`oceanShader.ts`)
 * darkens the water's own colour and hides the sun's glint in the shade; the sky's reflection
 * stays, as on real water. Its strength is `graphics.json` › `shadows.sea`.
 */

/** The uniforms of a sea that takes shadows (the levels with `REFLECT`). */
export const seaShadowUniforms = () => ({
  /** The light's shadow depth (the lean map's depth texture), compared per tap. */
  uSeaShadowMap: { value: null as THREE.Texture | null },
  /** World → shadow map (three.js's own `shadow.matrix`, kept current by its shadow pass). */
  uSeaShadowMatrix: { value: new THREE.Matrix4() },
  /** x: how dark the shade is (0 = no shadows), y: one tap's step (texture units), z: bias. */
  uSeaShadowLook: { value: new THREE.Vector3() },
});

/** Top level: `seaSunLit`, 1 in the sun, 0 in full shade, 5 taps for a soft edge. */
export const seaShadowFunctions = /* glsl */ `
uniform sampler2DShadow uSeaShadowMap;
uniform mat4 uSeaShadowMatrix;
uniform vec3 uSeaShadowLook;
float seaSunLit(vec3 world) {
  if (uSeaShadowLook.x <= 0.0) return 1.0;
  vec4 at = uSeaShadowMatrix * vec4(world, 1.0);
  vec3 c = at.xyz / at.w;
  if (any(lessThan(c, vec3(0.0))) || any(greaterThan(c, vec3(1.0)))) return 1.0;
  float z = c.z + uSeaShadowLook.z;
  float s = uSeaShadowLook.y;
  return 0.2 * (texture(uSeaShadowMap, vec3(c.xy, z))
              + texture(uSeaShadowMap, vec3(c.xy + vec2(s, 0.0), z))
              + texture(uSeaShadowMap, vec3(c.xy - vec2(s, 0.0), z))
              + texture(uSeaShadowMap, vec3(c.xy + vec2(0.0, s), z))
              + texture(uSeaShadowMap, vec3(c.xy - vec2(0.0, s), z)));
}
`;

type SeaShadowUniforms = ReturnType<typeof seaShadowUniforms>;

/**
 * Points the sea at the light's shadow map this frame; `shade` 0 turns the sea's shadows off
 * (no shadows drawn, or before the first shadow pass made the map).
 */
export function writeSeaShadow(
  uniforms: Partial<SeaShadowUniforms>,
  shadow: THREE.DirectionalLightShadow,
  shade: number,
  spread: number,
) {
  if (!uniforms.uSeaShadowLook) return;
  const depth = shadow.map?.depthTexture ?? null;
  uniforms.uSeaShadowMap!.value = depth;
  uniforms.uSeaShadowMatrix!.value = shadow.matrix;
  uniforms.uSeaShadowLook.value.set(depth ? shade : 0, spread / shadow.mapSize.x, shadow.bias);
}
