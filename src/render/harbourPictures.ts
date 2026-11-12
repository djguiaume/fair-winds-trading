import * as THREE from 'three';
import { HARBOUR_VIEW, type HarbourShot } from './harbourView';
import { toScene } from './sceneSpace';

/**
 * The harbour screen's pictures taken so far (decision 0211), as JPEG object URLs keyed by port,
 * light and town look, and the camera they are taken with.
 */
export class HarbourPictures {
  private readonly urls = new Map<string, string>();
  private look = '';
  private camera?: THREE.PerspectiveCamera;

  /** The picture already taken; a new town or land `look` lets go of every one taken before. */
  cached(key: string, look: string): string | undefined {
    if (this.look !== look) {
      // The screen may still be loading one, so they are let go a little later.
      const old = [...this.urls.values()];
      setTimeout(() => old.forEach((url) => URL.revokeObjectURL(url)), 10_000);
      this.urls.clear();
      this.look = look;
    }
    return this.urls.get(key);
  }

  keep(key: string, url: string) {
    this.urls.set(key, url);
  }

  /** The camera placed for a shot, the scene point it looks at and the picture's size in pixels. */
  frame(shot: HarbourShot) {
    const pic = HARBOUR_VIEW.picture;
    const width = Math.round(pic.width * pic.supersample);
    const height = Math.round(pic.height * pic.supersample);
    const camera = (this.camera ??= new THREE.PerspectiveCamera(pic.fovDeg, 1, 1, 2000));
    camera.fov = pic.fovDeg;
    camera.aspect = width / height;
    // The town sits right of the middle, clear of the name and the shade on the left.
    camera.setViewOffset(width, height, -pic.shift * width, 0, width, height);
    toScene(shot.from.x, shot.from.y, camera.position).setY(shot.fromHeight);
    const aim = toScene(shot.look.x, shot.look.y, new THREE.Vector3()).setY(shot.lookHeight);
    camera.lookAt(aim);
    return { camera, aim, width, height };
  }
}
