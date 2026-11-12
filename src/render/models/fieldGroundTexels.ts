import * as THREE from 'three';

/** A field's RGBA bytes as a texture, filtered and mipmapped or crisp. */
export function dataTexture(
  data: Uint8Array,
  w: number,
  h: number,
  colorSpace: THREE.ColorSpace,
  filtered: boolean,
) {
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.colorSpace = colorSpace;
  texture.magFilter = filtered ? THREE.LinearFilter : THREE.NearestFilter;
  texture.minFilter = filtered ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  texture.generateMipmaps = filtered;
  texture.needsUpdate = true;
  return texture;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Each ground's cliff colours as a row, repeated to the least common width of all rows, so the
 * shader picks band `b` of any ground at column `b mod width` without knowing its count.
 */
export function sidesTexture(sides: readonly (readonly string[])[]) {
  const width = sides.reduce((w, list) => (w * list.length) / gcd(w, list.length), 1);
  const data = new Uint8Array(width * sides.length * 4);
  sides.forEach((list, g) => {
    for (let b = 0; b < width; b++) {
      const hex = new THREE.Color(list[b % list.length]).getHex();
      data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], (g * width + b) * 4);
    }
  });
  return dataTexture(data, width, sides.length, THREE.SRGBColorSpace, false);
}
