import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { HighlandIslands } from '../src/render/models/highlandIslands';
import type { TownLevel } from '../src/render/models/towns';

/** Every vertex position of the model, sorted: the same land whatever the batch order. */
function positions(root: THREE.Object3D) {
  const all: string[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = (o.geometry as THREE.BufferGeometry).attributes.position!;
    for (let i = 0; i < p.count; i++) all.push(`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`);
  });
  return all.sort();
}

const allLevels = (level: TownLevel) =>
  Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, level]));

describe('island rebuilds spread over frames (issue #516)', () => {
  it('keeps the old town up while it builds, then swaps in the same town as at once', () => {
    const levels = allLevels(1);
    const port = PHASE1_MAP.ports.find((p) => p.islandId === 'calda')!;
    const grown = { ...levels, [port.id]: 3 as const };
    const model = new HighlandIslands(PHASE1_MAP, true, levels);
    const rebuilt = vi.fn();
    model.onRebuilt = rebuilt;
    const old = model.getObjectByName('island:calda');
    model.setSettlementLevels(grown, true);
    expect(model.building).toBe(true);
    model.update(0);
    expect(model.getObjectByName('island:calda')).toBe(old);
    expect(rebuilt).not.toHaveBeenCalled();
    model.finishBuilds();
    expect(model.building).toBe(false);
    expect(model.getObjectByName('island:calda')).not.toBe(old);
    expect(rebuilt).toHaveBeenCalledOnce();

    const atOnce = new HighlandIslands(PHASE1_MAP, true, grown);
    expect(positions(model)).toEqual(positions(atOnce));
    model.dispose();
    atOnce.dispose();
  });

  it('redraws the ground at a new quality a batch a step, as at once', () => {
    const spread = new HighlandIslands(PHASE1_MAP, true, allLevels(2), 'v2');
    const atOnce = new HighlandIslands(PHASE1_MAP, true, allLevels(2), 'v2');
    spread.setQuality('low', true);
    atOnce.setQuality('low');
    expect(spread.building).toBe(true);
    expect(positions(spread)).not.toEqual(positions(atOnce));
    spread.finishBuilds();
    expect(positions(spread)).toEqual(positions(atOnce));
    spread.dispose();
    atOnce.dispose();
  });
});
