import type * as THREE from 'three';

/**
 * Shaders made ready before they are drawn (issue #516): the first frame that draws a new
 * material waits for its program, a stall of a few hundred milliseconds on a phone. `warm`
 * compiles every material of the scene, hidden ones too (the night's lights, the other weathers),
 * where the browser can off the main thread (`KHR_parallel_shader_compile`); the view draws
 * nothing while it runs, so the last picture stays up instead of the game freezing.
 */
export class ShaderWarmUp {
  private pending = 0;

  /** True while a compile runs: the view keeps its last picture. */
  get holding(): boolean {
    return this.pending > 0;
  }

  async warm(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.pending++;
    try {
      await renderer.compileAsync(scene, camera);
    } finally {
      this.pending--;
    }
  }
}
