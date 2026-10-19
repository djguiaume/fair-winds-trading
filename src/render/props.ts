import * as THREE from 'three';
import { mergeAll, paint, place, vertexColorMaterial } from './models/geometry';

/** Course buoy: striped float, flag, a pulsing ring and a tall faint beacon seen from afar. */
export class BuoyMarker {
  readonly root = new THREE.Group();
  private readonly float: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor() {
    const floatGeo = mergeAll([
      paint(place(new THREE.CylinderGeometry(0.9, 1.1, 1.0, 8), 0, 0.2, 0), '#e04a32'),
      paint(place(new THREE.CylinderGeometry(0.75, 0.9, 0.8, 8), 0, 1.1, 0), '#f6f1e4'),
      paint(place(new THREE.CylinderGeometry(0.55, 0.75, 0.7, 8), 0, 1.85, 0), '#e04a32'),
      paint(place(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5), 0, 3.6, 0), '#5b3a1e'),
      paint(place(new THREE.BoxGeometry(0.06, 0.9, 1.5), 0, 4.7, 0.75), '#f2c230'),
    ]);
    const floatMat = vertexColorMaterial();
    this.float = new THREE.Mesh(floatGeo, floatMat);
    this.float.castShadow = true;

    const ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#fff3c4',
      transparent: true,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.position.y = 0.5;

    const beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 40, 10, 1, true).translate(0, 20, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#ffe680',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);

    this.disposables.push(floatGeo, floatMat, ringGeo, ringMat, beamGeo, beamMat);
    this.root.add(this.float, this.ring, beam);
  }

  update(time: number, waterY: number, radius: number) {
    this.float.position.y = waterY;
    this.float.rotation.z = Math.sin(time * 1.3) * 0.08;
    const t = (time * 0.5) % 1;
    this.ring.scale.setScalar(radius * (0.35 + 0.65 * t));
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}

/** Soft dark ellipse under a boat: a cheap shadow that works on the custom ocean shader. */
export function createBlobShadow(width: number, length: number): THREE.Mesh {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,30,40,0.45)');
  g.addColorStop(1, 'rgba(0,30,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.renderOrder = 1;
  return mesh;
}
