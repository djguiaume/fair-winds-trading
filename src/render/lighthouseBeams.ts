import * as THREE from 'three';
import type { IslandDef } from '../sim/map';
import { atLevel, type PropDef, questShown } from '../data/islands';
import { landmarkLamps } from './landmarkLamps';

/** Beams by the lighthouse prop's variation: 0 Saltmere's opposing pair, 1 one, 2 three. */
const BEAMS = [2, 1, 3];

interface Beacon {
  group: THREE.Group;
  island: IslandDef;
  prop: PropDef;
}

/**
 * Sweeping beams on every lighthouse of the island files (decision 0121), sharing one
 * translucent unlit material. A lighthouse that is not built yet at its island's level, or before
 * its quest is done (`after:<quest>`, decision 0130), is dark.
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
    this.material.opacity = 0.12 * night;
    for (const { group } of this.beacons) group.rotation.y = time * 0.22;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
