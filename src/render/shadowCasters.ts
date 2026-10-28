import * as THREE from 'three';

/** Quest marks, sea marks and other boats build meshes as they appear: look again this often. */
const RESCAN_SEC = 2;

type Material = THREE.Material | THREE.Material[];

function some(material: Material, test: (m: THREE.Material) => boolean) {
  return Array.isArray(material) ? material.some(test) : test(material);
}

const isLit = (m: THREE.Material) =>
  m instanceof THREE.MeshLambertMaterial ||
  m instanceof THREE.MeshStandardMaterial ||
  m instanceof THREE.MeshPhongMaterial;
const isSeeThrough = (m: THREE.Material) => m.transparent;

/** What a mesh cast and received before Ultra turned its shadows on. */
interface Before {
  cast: boolean;
  receive: boolean;
}

/**
 * On Ultra every lit, solid mesh casts and receives shadows (decision 0221); the other levels
 * keep only the island ground's. Scans the scene when told it changed and every few seconds, never
 * each frame, and puts every mesh back as it was when Ultra or its shadows are switched off.
 * Also lists the meshes the occlusion must not see: the sea, glows and see-through things.
 */
export class ShadowCasters {
  /** Unlit or see-through meshes, kept out of the occlusion's normal pass. */
  readonly unlit: THREE.Object3D[] = [];
  private dirty = true;
  private sinceScan = 0;
  private casting = false;

  markDirty() {
    this.dirty = true;
  }

  update(dt: number, scene: THREE.Scene, cast: boolean) {
    this.sinceScan += dt;
    if (!this.dirty && this.sinceScan < RESCAN_SEC && cast === this.casting) return;
    if (this.casting && !cast) this.restore(scene);
    this.scan(scene, cast);
  }

  private scan(scene: THREE.Scene, cast: boolean) {
    this.dirty = false;
    this.sinceScan = 0;
    this.casting = cast;
    this.unlit.length = 0;
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = o.material as Material;
      if (!some(material, isLit) || some(material, isSeeThrough)) {
        this.unlit.push(o);
        return;
      }
      if (!cast || o.userData.ultraShadow) return;
      o.userData.ultraShadow = { cast: o.castShadow, receive: o.receiveShadow } satisfies Before;
      o.castShadow = true;
      o.receiveShadow = true;
    });
  }

  /** Every mesh back to its own shadow flags. */
  restore(scene: THREE.Scene) {
    this.casting = false;
    this.dirty = true;
    scene.traverse((o) => {
      const before = o.userData.ultraShadow as Before | undefined;
      if (!before) return;
      o.castShadow = before.cast;
      o.receiveShadow = before.receive;
      delete o.userData.ultraShadow;
    });
  }
}
