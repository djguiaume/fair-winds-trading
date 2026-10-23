import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { atLevel, type PropDef } from '../data/islands';
import { landmarkLamps } from './landmarkLamps';

/** Beams by the lighthouse prop's variation: 0 Saltmere's opposing pair, 1 one, 2 three. */
const BEAMS = [2, 1, 3];

interface Beacon {
  group: THREE.Group;
  island: IslandDef;
  prop: PropDef;
}

/**
 * Two opposing beams on every lighthouse of the island files (decision 0119), sharing one
 * translucent unlit material. A lighthouse that is not built yet at its island's level is dark.
 */
export class LighthouseBeams {
  readonly root = new THREE.Group();
  private readonly beacons: Beacon[] = [];
  private readonly material = new THREE.MeshBasicMaterial({
    color: '#fff1c4',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  private readonly geometry = new THREE.ConeGeometry(7, 70, 12, 1, true)
    .rotateZ(Math.PI / 2)
    .translate(35, 0, 0);
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
  /** Shows the beams of the lighthouses standing at each island's town level. */
  setLevels(levels: Record<string, number>) {
    for (const { group, island, prop } of this.beacons) {
      const level = levels[island.id] ?? (island.look?.dock ? 1 : 4);
      group.visible = atLevel(prop, level);
    }
  }
  update(time: number, night: number) {
    this.root.visible = night > 0.05;
    this.material.opacity = 0.12 * night;
    for (const { group } of this.beacons) group.rotation.y = time * 0.22;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
