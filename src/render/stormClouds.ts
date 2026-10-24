import * as THREE from 'three';
import type { Storm } from '../sim/storms';

/** Discs drawn at once: the storms nearest the boat (a storm belt's train has several, 0167). */
const MAX_STORMS = 5;
/** Sides of a rain curtain: few, and thin, for the tablet's fill rate (art director, 0167). */
const CURTAIN_SIDES = 8;
/** Height of a rain curtain above the water, map units. */
const CURTAIN_HEIGHT = 34;

const curtainVertex = /* glsl */ `
varying vec2 vUv;
varying float vFogDepth;
varying float vFacing;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  // How squarely the camera sees this side: the sides seen edge-on fade, so the tube's corners
  // never draw a hard outline and the curtain reads as a soft column.
  vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`;

// Grey-blue streaks falling fast, densest low down, fading out at the top and into the fog.
const curtainFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec2 vUv;
varying float vFogDepth;
varying float vFacing;
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  float column = floor(vUv.x * 90.0);
  float fall = fract(vUv.y * 1.6 + uTime * (1.8 + hash(column) * 0.8) + hash(column + 3.0));
  float streak = smoothstep(0.55, 1.0, fall) * (0.45 + 0.55 * hash(column + 7.0));
  float height = (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.0, 0.08, vUv.y);
  float alpha = uOpacity * (0.35 + 0.65 * streak) * height * smoothstep(0.1, 0.7, vFacing);
  vec3 col = mix(uColor, uFogColor, smoothstep(uFogNear, uFogFar, vFogDepth) * 0.7);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

interface Cell {
  disc: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  curtain: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
}

/**
 * The shadow a storm cloud throws on the sea (decision 0067): a dark disc with a soft edge at the
 * storm's position, so a storm can be seen coming before its rain arrives. A storm belt's squalls
 * (0167) add a thin rain curtain round the core, so a train reads as dark columns marching in;
 * the curtains are left out on Low quality, where the disc alone must read. A few cheap meshes,
 * no textures.
 */
export class StormClouds {
  readonly root = new THREE.Group();
  private readonly cells: Cell[] = [];
  private readonly picked: Storm[] = [];
  /** Rain curtains drawn (off on Low quality). */
  curtains = true;

  constructor() {
    // Concentric rings so the alpha can stay dark across the core and fade over the outer part.
    const geometry = new THREE.RingGeometry(0.001, 1, 36, 10);
    geometry.rotateX(-Math.PI / 2);
    // Alpha per vertex: dark in the middle, fading to nothing at the rim.
    const pos = geometry.attributes.position!;
    const colors = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const fade = 1 - Math.min(1, Math.max(0, (r - 0.7) / 0.3));
      colors.set([0.0, 0.02, 0.05, 0.6 * fade * fade * (3 - 2 * fade)], i * 4);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    // An open six-sided tube of unit radius and height, standing on the water.
    const tube = new THREE.CylinderGeometry(1, 1, 1, CURTAIN_SIDES, 1, true);
    tube.translate(0, 0.5, 0);
    for (let i = 0; i < MAX_STORMS; i++) {
      // Each storm its own material: their strengths differ.
      const disc = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
      );
      disc.renderOrder = 1;
      disc.visible = false;
      const curtain = new THREE.Mesh(
        tube,
        new THREE.ShaderMaterial({
          vertexShader: curtainVertex,
          fragmentShader: curtainFragment,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0 },
            uColor: { value: new THREE.Color('#8fa0aa') },
            uFogColor: { value: new THREE.Color() },
            uFogNear: { value: 120 },
            uFogFar: { value: 210 },
          },
        }),
      );
      curtain.renderOrder = 2;
      curtain.visible = false;
      this.cells.push({ disc, curtain });
      this.root.add(disc, curtain);
    }
  }

  /** Once a frame: the storms nearest `near` (the boat), and the scene's fog for the curtains. */
  update(
    storms: readonly Storm[],
    time: number,
    near?: { x: number; y: number },
    fog?: THREE.Fog | THREE.FogExp2 | null,
  ) {
    const list = this.picked;
    list.length = 0;
    for (const s of storms) if (s.intensity > 0.02) list.push(s);
    if (near && list.length > MAX_STORMS)
      list.sort(
        (a, b) =>
          Math.hypot(a.x - near.x, a.y - near.y) -
          a.radius -
          Math.hypot(b.x - near.x, b.y - near.y) +
          b.radius,
      );
    this.cells.forEach(({ disc, curtain }, i) => {
      const s = list[i];
      disc.visible = Boolean(s);
      curtain.visible = Boolean(s?.squall) && this.curtains;
      if (!s) return;
      disc.position.set(s.x, 1.2, -s.y);
      disc.scale.setScalar(s.radius * (0.95 + 0.05 * Math.sin(time * 0.3 + i)));
      disc.rotation.y = time * 0.05;
      disc.material.opacity = Math.min(1, s.intensity * 1.2);
      if (!curtain.visible) return;
      curtain.position.set(s.x, 0.5, -s.y);
      curtain.scale.set(s.radius * 0.62, CURTAIN_HEIGHT, s.radius * 0.62);
      curtain.rotation.y = i * 0.7 + time * 0.03;
      const u = curtain.material.uniforms;
      u.uTime!.value = time;
      u.uOpacity!.value = 0.25 * Math.min(1, s.intensity * 1.3);
      if (fog instanceof THREE.Fog) {
        (u.uFogColor!.value as THREE.Color).copy(fog.color);
        u.uFogNear!.value = fog.near;
        u.uFogFar!.value = fog.far;
      }
    });
  }

  dispose() {
    this.cells[0]?.disc.geometry.dispose();
    this.cells[0]?.curtain.geometry.dispose();
    for (const { disc, curtain } of this.cells) {
      disc.material.dispose();
      curtain.material.dispose();
    }
  }
}
