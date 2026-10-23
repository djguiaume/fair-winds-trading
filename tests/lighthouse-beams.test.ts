import { expect, it } from 'vitest';
import * as THREE from 'three';
import { PHASE1_MAP } from '../src/data/maps';
import { islandPoint } from '../src/sim/islandLayout';
import { LighthouseBeams } from '../src/render/lighthouseBeams';
import { designOf } from '../src/data/islands';
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

it('lights every lighthouse of the island files, and only once it is built', () => {
  const lighthouses = PHASE1_MAP.islands.flatMap((island) =>
    (designOf(island)?.props ?? []).filter((p) => p.type === 'lighthouse').map(() => island.id),
  );
  expect(lighthouses).toEqual(expect.arrayContaining(['saltmere', 'watchman-key', 'lantern-rock']));
  const beams = new LighthouseBeams(PHASE1_MAP.islands);
  expect(beams.root.children).toHaveLength(lighthouses.length);
  for (const beacon of beams.root.children) {
    expect(beacon.visible).toBe(true);
    expect(beacon.position.y).toBeGreaterThan(8);
  }
  // A lighthouse that only comes with a later town level stays dark until then.
  const saltmere = designOf(PHASE1_MAP.islands.find((i) => i.id === 'saltmere')!)!;
  const lighthouse = saltmere.props.find((p) => p.type === 'lighthouse')!;
  const from = lighthouse.from;
  lighthouse.from = 3;
  try {
    const later = new LighthouseBeams(PHASE1_MAP.islands, { saltmere: 2 });
    const index = lighthouses.indexOf('saltmere');
    expect(later.root.children[index]!.visible).toBe(false);
    later.setLevels({ saltmere: 3 });
    expect(later.root.children[index]!.visible).toBe(true);
    later.dispose();
  } finally {
    lighthouse.from = from;
  }
  beams.dispose();
});
