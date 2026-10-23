import * as THREE from 'three';
import type { StepMarker } from '../ui/questView';

/** At most this many places at once: a reach step has at most 30 points (the quest checks). */
const MAX_MARKERS = 30;
/** Gulls over a `gulls` spot. */
const GULLS = 4;

interface Slot {
  root: THREE.Group;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
  gulls: THREE.Mesh[];
}

/**
 * The tracked step's places at sea (decision 0130): a ring on the water as wide as the place,
 * pulsing on the one to make for, with a faint beam seen from afar; places passed are hidden.
 * `gulls` adds a small flock wheeling and diving over the spot (Kit's shoals).
 */
export class QuestMarkers {
  readonly root = new THREE.Group();
  private readonly slots: Slot[] = [];
  private readonly ringGeometry = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
  private readonly beamGeometry = new THREE.CylinderGeometry(0.9, 0.9, 36, 10, 1, true).translate(
    0,
    18,
    0,
  );
  // Two thin wings in a shallow V, seen from above and from the side.
  private readonly gullGeometry = new THREE.BufferGeometry().setFromPoints(
    [
      [-1.1, 0.25, 0.1],
      [0, 0, -0.25],
      [0, 0, 0.3],
      [1.1, 0.25, 0.1],
      [0, 0, 0.3],
      [0, 0, -0.25],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: '#fff3c4',
    transparent: true,
    depthWrite: false,
  });
  private readonly nextMaterial = this.ringMaterial.clone();
  private readonly beamMaterial = new THREE.MeshBasicMaterial({
    color: '#ffe680',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly gullMaterial = new THREE.MeshBasicMaterial({
    color: '#fbfaf4',
    side: THREE.DoubleSide,
  });

  constructor() {
    this.root.name = 'quest-markers';
    this.gullGeometry.computeVertexNormals();
  }

  private slot(i: number): Slot {
    while (this.slots.length <= i) {
      const root = new THREE.Group();
      const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
      const beam = new THREE.Mesh(this.beamGeometry, this.beamMaterial);
      const gulls = Array.from({ length: GULLS }, () => {
        const gull = new THREE.Mesh(this.gullGeometry, this.gullMaterial);
        gull.scale.setScalar(1.2);
        return gull;
      });
      root.add(ring, beam, ...gulls);
      this.root.add(root);
      this.slots.push({ root, ring, beam, gulls });
    }
    return this.slots[i]!;
  }

  /** Draw `points` in `style` (`ring` or `gulls`); none hides them all. */
  update(
    marked: { style: string; points: readonly StepMarker[] } | null,
    time: number,
    waterY: (x: number, z: number) => number,
  ) {
    const points = (marked?.points ?? []).filter((p) => !p.reached).slice(0, MAX_MARKERS);
    const pulse = (time * 0.5) % 1;
    this.nextMaterial.opacity = 0.35 + 0.5 * (1 - pulse);
    this.ringMaterial.opacity = 0.35;
    points.forEach((p, i) => {
      const s = this.slot(i);
      s.root.visible = true;
      s.root.position.set(p.x, 0, -p.y);
      s.ring.position.y = waterY(p.x, -p.y) + 0.4;
      s.ring.material = p.next ? this.nextMaterial : this.ringMaterial;
      s.ring.scale.setScalar(Math.max(2, p.within) * (p.next ? 0.92 + 0.08 * pulse : 1));
      s.beam.visible = p.next;
      const gulls = marked?.style === 'gulls';
      s.gulls.forEach((gull, k) => {
        gull.visible = gulls;
        if (!gulls) return;
        // Wheeling round the spot, now and then folding down towards the water.
        const a = time * (0.6 + 0.07 * k) + (k * Math.PI * 2) / GULLS + i;
        const r = Math.max(2, p.within) * (0.35 + 0.15 * Math.sin(time * 0.7 + k));
        const dive = Math.max(0, Math.sin(time * 0.9 + k * 1.9 + i)) ** 6;
        gull.position.set(
          Math.cos(a) * r,
          7 + 1.5 * Math.sin(time + k) - 5.5 * dive,
          Math.sin(a) * r,
        );
        gull.rotation.set(0.25 + 1.1 * dive, -a, 0.35 * Math.sin(time * 6 + k));
      });
    });
    for (let i = points.length; i < this.slots.length; i++) this.slots[i]!.root.visible = false;
  }

  dispose() {
    for (const d of [
      this.ringGeometry,
      this.beamGeometry,
      this.gullGeometry,
      this.ringMaterial,
      this.nextMaterial,
      this.beamMaterial,
      this.gullMaterial,
    ])
      d.dispose();
  }
}
