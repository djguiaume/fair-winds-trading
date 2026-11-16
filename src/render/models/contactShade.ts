import * as THREE from 'three';
import { TUNING } from '../../data/tuning';

/**
 * Contact shade (issue #550): houses, trees, quays and fences darken toward the ground they stand
 * on, so they sit in the scene instead of on it. Baked once per vertex as `contact` (1 at the foot,
 * 0 from `shadows.contact.height` up) when a prop is built; the land material darkens by it times
 * one shared strength, which is 0 below High or with Settings › Shadows off. No extra pass.
 */

const ATTRIBUTE = 'contact';

/** The strength every land material reads; written once a frame (`setContactShade`). */
const CONTACT_SHADE = { value: 0 };

/** Bakes the foot shade into a prop's parts, in model space (y 0 = the ground), before placing. */
export function bakeContact(parts: readonly THREE.BufferGeometry[], scale = 1) {
  const height = TUNING.graphics.shadows.contact.height;
  for (const g of parts) {
    const position = g.attributes.position!;
    const contact = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++)
      contact[i] = Math.min(1, Math.max(0, 1 - (position.getY(i) * scale) / height));
    g.setAttribute(ATTRIBUTE, new THREE.BufferAttribute(contact, 1));
  }
}

/**
 * Parts merge only when all or none carry the shade: `keep` gives the ones without it none (0),
 * else the shade is dropped from all (windows and lava draw unlit).
 */
export function matchContact(parts: readonly THREE.BufferGeometry[], keep: boolean) {
  for (const g of parts) {
    if (!keep) g.deleteAttribute(ATTRIBUTE);
    else if (!g.attributes[ATTRIBUTE])
      g.setAttribute(
        ATTRIBUTE,
        new THREE.BufferAttribute(new Float32Array(g.attributes.position!.count), 1),
      );
  }
}

/** A Lambert land material that darkens by the baked shade; meshes without it are untouched. */
export function withContactShade<M extends THREE.MeshLambertMaterial>(material: M): M {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uContactShade = CONTACT_SHADE;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute float ${ATTRIBUTE};\nuniform float uContactShade;`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>\n\tvColor.rgb *= 1.0 - uContactShade * ${ATTRIBUTE};`,
      );
  };
  material.customProgramCacheKey = () => 'contactShade';
  return material;
}

/** This frame's strength: the data's when the level draws shadows, else none. */
export function setContactShade(drawn: boolean) {
  CONTACT_SHADE.value = drawn ? TUNING.graphics.shadows.contact.shade : 0;
}
