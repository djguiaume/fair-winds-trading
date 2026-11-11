import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { TUNING } from '../data/tuning';
import { BloomBrightShader, BloomDownShader, BloomUpShader } from './bloomShader';

/** Width and height of each picture of the chain: half the one before, the first half the screen. */
export function bloomSizes(width: number, height: number, levels: number): [number, number][] {
  const sizes: [number, number][] = [];
  for (let level = 1; level <= levels; level++)
    sizes.push([
      Math.max(1, Math.round(width / 2 ** level)),
      Math.max(1, Math.round(height / 2 ** level)),
    ]);
  return sizes;
}

/**
 * Ultra's glow round lit windows, lanterns and the moon (decision 0299). What is brighter than
 * the threshold is blurred through a chain of small pictures, the first at half the screen, and
 * the grade pass adds the result: no full-size picture is kept (about 10 MB at 4K). Numbers in
 * `graphics.json › ultra.bloom`.
 */
export class UltraBloom {
  private targets: THREE.WebGLRenderTarget[] = [];
  private readonly bright = material('UltraBloomBright', BloomBrightShader);
  private readonly down = material('UltraBloomDown', BloomDownShader);
  private readonly up = material('UltraBloomUp', BloomUpShader);
  private readonly quad = new FullScreenQuad(this.bright);
  private width = 1;
  private height = 1;

  constructor() {
    this.up.blending = THREE.CustomBlending;
    this.up.blendSrc = this.up.blendDst = THREE.OneFactor;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.release();
  }

  /**
   * Work the glow out from the scene's picture. Returns its texture and what the grade
   * multiplies it by; `night` 0..1 lowers the threshold so lit windows pass in the dark.
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.WebGLRenderTarget, night: number) {
    const bloom = TUNING.graphics.ultra.bloom;
    const targets = this.chain(bloom.levels);
    const autoClear = renderer.autoClear;
    // Every pass covers its whole picture, and the way up adds onto what the way down left.
    renderer.autoClear = false;
    const bright = this.bright.uniforms;
    bright.uThreshold!.value = bloom.threshold + (bloom.nightThreshold - bloom.threshold) * night;
    bright.uKnee!.value = bloom.knee;
    this.pass(renderer, this.bright, scene, targets[0]!);
    for (let i = 1; i < targets.length; i++)
      this.pass(renderer, this.down, targets[i - 1]!, targets[i]!);
    this.up.uniforms.uSpread!.value = bloom.radius;
    for (let i = targets.length - 1; i > 0; i--)
      this.pass(renderer, this.up, targets[i]!, targets[i - 1]!);
    renderer.autoClear = autoClear;
    return {
      texture: targets[0]!.texture,
      weight: bloom.strength,
    };
  }

  private pass(
    renderer: THREE.WebGLRenderer,
    shader: THREE.ShaderMaterial,
    from: THREE.WebGLRenderTarget,
    to: THREE.WebGLRenderTarget,
  ) {
    shader.uniforms.tSource!.value = from.texture;
    (shader.uniforms.uTexel!.value as THREE.Vector2).set(1 / from.width, 1 / from.height);
    this.quad.material = shader;
    renderer.setRenderTarget(to);
    this.quad.render(renderer);
  }

  /** The chain's pictures, made when first needed or when the level count changes. */
  private chain(levels: number): THREE.WebGLRenderTarget[] {
    if (this.targets.length === levels) return this.targets;
    this.release();
    this.targets = bloomSizes(this.width, this.height, levels).map(
      ([width, height]) =>
        new THREE.WebGLRenderTarget(width, height, {
          type: THREE.HalfFloatType,
          depthBuffer: false,
        }),
    );
    return this.targets;
  }

  /** Give the pictures back: the bloom is switched off, or the screen changed size. */
  release() {
    for (const target of this.targets) target.dispose();
    this.targets = [];
  }

  dispose() {
    this.release();
    this.bright.dispose();
    this.down.dispose();
    this.up.dispose();
    this.quad.dispose();
  }
}

function material(name: string, shader: typeof BloomBrightShader | typeof BloomDownShader) {
  return new THREE.ShaderMaterial({
    name,
    uniforms: THREE.UniformsUtils.clone(shader.uniforms),
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
}
