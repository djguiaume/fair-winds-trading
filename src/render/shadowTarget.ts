import * as THREE from 'three';

/**
 * A lean shadow map for a directional light, put in place of the one three.js would make.
 *
 * PCF shadows only sample the depth texture, but three.js also gives the map an RGBA colour
 * texture of the same size and a 24-bit depth: 128 MB at Ultra's 4096 px, which helped run the
 * Xbox's Edge out of graphics memory (decision 0246). This map keeps a one-byte colour channel
 * that nothing reads and a 16-bit depth, 48 MB at 4096 px. A 16-bit step (1/65536 of the shadow
 * range) is far finer than the shadow bias, so the shadows do not change.
 */
export function leanShadowMap(size: number, reversedDepth: boolean): THREE.WebGLRenderTarget {
  const map = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RedFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });
  // Set up as three.js's WebGLShadowMap does for PCFShadowMap, with a smaller depth type.
  const depth = new THREE.DepthTexture(size, size, THREE.UnsignedShortType);
  depth.name = 'leanShadowMap';
  depth.format = THREE.DepthFormat;
  depth.compareFunction = reversedDepth ? THREE.GreaterEqualCompare : THREE.LessEqualCompare;
  depth.minFilter = THREE.LinearFilter;
  depth.magFilter = THREE.LinearFilter;
  map.depthTexture = depth;
  return map;
}
