import * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';

/**
 * A ship's thin rope lines in one buffer: the standing rigging (stays and shrouds) written once,
 * then the running rigging (lifts and sheets) rewritten in place each frame, in ship-local
 * coordinates, without allocating.
 */
export class BoatRigging {
  readonly lines: THREE.LineSegments;
  private readonly position: THREE.BufferAttribute;
  private readonly runningOffset: number;
  private cursor = 0;

  /** `standing`: each fixed line's two ends; `running`: how many lines move each frame. */
  constructor(standing: ReadonlyArray<readonly [THREE.Vector3, THREE.Vector3]>, running: number) {
    const ends = new Float32Array((standing.length + running) * 6);
    standing.forEach(([a, b], i) => {
      a.toArray(ends, i * 6);
      b.toArray(ends, i * 6 + 3);
    });
    this.runningOffset = standing.length * 2;
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(ends, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.position);
    const material = new THREE.LineBasicMaterial({
      color: ST.rigging,
      transparent: true,
      opacity: 0.7,
    });
    this.lines = new THREE.LineSegments(geometry, material);
    this.lines.name = 'Rigging';
    this.lines.frustumCulled = false; // tiny mutable line buffer; the endpoints move during tacks
  }

  /** Starts writing the running lines from the first. */
  begin() {
    this.cursor = this.runningOffset;
  }

  /** The next running line end. */
  put(p: THREE.Vector3) {
    this.position.setXYZ(this.cursor++, p.x, p.y, p.z);
  }

  /** The running lines are written: upload them. */
  end() {
    this.position.needsUpdate = true;
  }

  dispose() {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}
