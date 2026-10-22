import { expect, it } from 'vitest';
import * as THREE from 'three';
import { PHASE1_MAP } from '../src/data/maps';
import { islandPoint } from '../src/sim/islandLayout';
import { LighthouseBeams } from '../src/render/lighthouseBeams';
it('anchors opposing rotating beams at the lighthouse lantern and fades them out by day', () => {
  const beams = new LighthouseBeams(PHASE1_MAP.islands),
    island = PHASE1_MAP.islands.find((i) => i.look?.profile === 'fish')!;
  const p = islandPoint(island, 1.95, -0.65),
    beacon = beams.root.children[0]!;
  expect(beams.root.visible).toBe(false);
  expect(beacon.position.x).toBeCloseTo(p.x);
  expect(beacon.position.z).toBeCloseTo(-p.y);
  expect(beacon.children).toHaveLength(2);
  expect(Math.abs(beacon.children[0]!.rotation.y - beacon.children[1]!.rotation.y)).toBeCloseTo(
    Math.PI,
  );
  beams.update(10, 1);
  expect(beams.root.visible).toBe(true);
  const angle = beacon.rotation.y;
  beams.update(11, 1);
  expect(beacon.rotation.y).toBeGreaterThan(angle);
  expect(((beacon.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).depthWrite).toBe(
    false,
  );
  beams.update(12, 0);
  expect(beams.root.visible).toBe(false);
  beams.dispose();
});
