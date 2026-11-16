import type * as THREE from 'three';

/**
 * GLSL: a built-in material's fragment, world space, from the eye (the view matrix's rotation is
 * orthonormal, so multiplying on the left undoes it).
 */
export const WORLD_FROM_EYE = '(vec4(-vViewPosition, 0.0) * viewMatrix).xyz';

type Shader = THREE.WebGLProgramParametersWithUniforms;

/**
 * Adds a patch to a built-in material's shader after any it already has, and a word to its
 * program's cache key so patched and plain materials never share a program.
 */
export function chainCompile<M extends THREE.Material>(
  material: M,
  word: string,
  patch: (shader: Shader) => void,
): M {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    patch(shader);
  };
  material.customProgramCacheKey = () => `${key}+${word}`;
  return material;
}
