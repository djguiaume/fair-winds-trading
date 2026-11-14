import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { atLevel, type PropDef, questShown } from '../data/islands';
import { landmarkLamps } from './landmarkLamps';
import { TUNING } from '../data/tuning';

/** Beams by the lighthouse prop's variation: 0 Saltmere's opposing pair, 1 one, 2 three. */
const BEAMS = [2, 1, 3];

interface Beacon {
  group: THREE.Group;
  island: IslandDef;
  prop: PropDef;
}

/** A beam's cone, open at both ends, running from the lamp (x = 0) out along +x. */
function beamGeometry() {
  const { radius, length } = TUNING.graphics.beams;
  return new THREE.ConeGeometry(radius, length, 12, 1, true)
    .rotateZ(Math.PI / 2)
    .translate(length / 2, 0, 0);
}

/**
 * Light, not a solid, from any side (issue #541): brightest at the lamp and fading out along the
 * beam, faint where the cone's wall is seen edge-on, and gone into the fog instead of turning grey.
 * Additive, so the beams never need sorting against the sea or each other.
 */
function beamMaterial() {
  const { length, fade, edge } = TUNING.graphics.beams;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uColor: { value: new THREE.Color('#fff1c4') },
      uOpacity: { value: 0 },
      uLook: { value: new THREE.Vector3(1 / length, fade, edge) },
    },
    vertexShader: `uniform vec3 uLook;
      varying float vAlong;
      varying float vFacing;
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vAlong = clamp(position.x * uLook.x, 0.0, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor;
      uniform float uOpacity;
      uniform vec3 uLook;
      uniform float fogNear;
      uniform float fogFar;
      varying float vAlong;
      varying float vFacing;
      varying float vDepth;
      void main() {
        float along = pow(1.0 - vAlong, uLook.y);
        float facing = pow(vFacing, uLook.z);
        float clear = 1.0 - smoothstep(fogNear, fogFar, vDepth);
        gl_FragColor = vec4(uColor, uOpacity * along * facing * clear);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Sweeping beams on every lighthouse of the island files (decision 0121), sharing one
 * additive glow material (`graphics.json` › `beams`). A lighthouse that is not built yet at its island's level, or before
 * its quest is done (`after:<quest>`, decision 0130), is dark.
 */
export class LighthouseBeams {
  readonly root = new THREE.Group();
  private readonly beacons: Beacon[] = [];
  private readonly material = beamMaterial();
  private readonly geometry = beamGeometry();
  /** `levels`: town level by island id; others stand at level 1 with a dock, else at 4. */
  constructor(islands: readonly IslandDef[], levels: Record<string, number> = {}) {
    this.root.name = 'lighthouse-beams';
    for (const { position, island, prop } of landmarkLamps(islands, 'lighthouse')) {
      const group = new THREE.Group();
      group.position.copy(position);
      const beams = BEAMS[prop.variant ?? 0] ?? 2;
      for (let i = 0; i < beams; i++) {
        const angle = (i * Math.PI * 2) / beams;
        const beam = new THREE.Mesh(this.geometry, this.material);
        beam.rotation.y = angle;
        group.add(beam);
      }
      this.root.add(group);
      this.beacons.push({ group, island, prop });
    }
    this.setLevels(levels);
    this.update(0, 0);
  }
  private levels: Record<string, number> = {};
  private done: ReadonlySet<string> = new Set();
  private out: ReadonlySet<string> = new Set();
  /** Shows the beams of the lighthouses standing at each island's town level. */
  setLevels(levels: Record<string, number>) {
    this.levels = levels;
    for (const { group, island, prop } of this.beacons) {
      const level = levels[island.id] ?? (island.look?.dock ? 1 : 4);
      group.visible =
        !this.out.has(island.id) && atLevel(prop, level) && questShown(prop, this.done);
    }
  }
  /** Islands out of the sea for now (decision 0166): their lighthouses are dark. */
  setLandOut(out: ReadonlySet<string>) {
    this.out = new Set(out);
    this.setLevels(this.levels);
  }
  /** The quests done, for lighthouses that stand only after one (decision 0130). */
  setQuestsDone(done: ReadonlySet<string>) {
    this.done = new Set(done);
    this.setLevels(this.levels);
  }
  update(time: number, night: number) {
    this.root.visible = night > 0.05;
    this.material.uniforms.uOpacity!.value = TUNING.graphics.beams.opacity * night;
    for (const { group } of this.beacons) group.rotation.y = time * 0.22;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
