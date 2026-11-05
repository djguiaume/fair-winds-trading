import * as THREE from 'three';
import type { MirrorFrame, MirrorRoots, SeaMirror } from './seaMirror';
import type { Ocean } from './ocean';
import type { QualityLevel } from './quality';
import { QUALITY } from './quality';

/**
 * The view's side of the sea mirror (decision 0292): fetches `seaMirror.ts` once, the first time
 * a level with `mirror` is picked (phones never do, so they never download it), and feeds it each
 * frame.
 */
export class ViewMirror {
  private mirror?: SeaMirror;
  private loading = false;
  private readonly frame: MirrorFrame = {
    level: 'high',
    target: new THREE.Vector3(),
    night: 0,
    on: false,
  };

  /** `roots`: what the mirror draws, read once it is loaded (the view builds them first). */
  constructor(private readonly roots: () => MirrorRoots) {}

  load(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (this.mirror || this.loading) return;
    this.loading = true;
    void import('./seaMirror').then(({ SeaMirror }) => {
      this.mirror = new SeaMirror(renderer, scene, camera, this.roots());
    });
  }

  /** Before the scene is drawn: the mirror texture for this frame, handed to the water. */
  render(
    dt: number,
    ocean: Ocean,
    level: QualityLevel,
    target: THREE.Vector3,
    night: number,
    on: boolean,
  ) {
    const mirror = this.mirror;
    if (!mirror) return;
    const frame = this.frame;
    frame.level = level;
    frame.target.copy(target);
    frame.night = night;
    frame.on = on && QUALITY[level].mirror;
    mirror.render(dt, frame);
    ocean.setMirror(mirror.target.texture, mirror.textureMatrix, mirror.strength(frame));
  }

  dispose() {
    this.mirror?.dispose();
  }
}
