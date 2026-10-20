import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBoatModel } from '../src/render/models';
import { Wake, WAKE_DETAIL } from '../src/render/wake';
import type { QualityLevel } from '../src/render/quality';

const hull = { length: 11, beam: 4.4 };
const centre = new THREE.Vector3();

function sail(wake: Wake, level: QualityLevel) {
  wake.setQuality(level);
  for (let i = 0; i < 360; i++) {
    // Tight curved track exercises independent world-space trail orientations.
    const angle = i / 120;
    centre.set(Math.sin(angle) * 30, 0, Math.cos(angle) * 30);
    wake.update(1 / 60, i / 60, centre, Math.cos(angle), -Math.sin(angle), 7, hull);
  }
}

describe('tablet wake', () => {
  it('keeps fixed GPU buffers, bounded geometry and distinct budgets at every quality', () => {
    const wake = new Wake();
    const positions = wake.mesh.geometry.getAttribute('position');
    const counts: number[] = [];
    for (const level of ['low', 'medium', 'high'] as const) {
      wake.reset();
      sail(wake, level);
      expect(wake.mesh.geometry.getAttribute('position')).toBe(positions);
      const count = wake.mesh.geometry.drawRange.count;
      expect(count).toBeLessThanOrEqual((WAKE_DETAIL[level].points * 3 + 12) * 6);
      counts.push(count);
      expect([...positions.array].every(Number.isFinite)).toBe(true);
    }
    expect(counts[0]).toBeLessThan(counts[1]!);
    expect(counts[1]).toBeLessThan(counts[2]!);
    wake.dispose();
  });

  it('fades completely after stopping and clears discontinuous positions', () => {
    const wake = new Wake();
    sail(wake, 'high');
    for (let i = 0; i < 240; i++) wake.update(1 / 60, 6 + i / 60, centre, 0, -1, 0, hull);
    expect(wake.mesh.visible).toBe(false);
    expect(wake.mesh.geometry.drawRange.count).toBe(72); // invisible bow geometry only
    sail(wake, 'high');
    centre.set(1000, 0, 1000);
    wake.update(1 / 60, 10, centre, 0, -1, 7, hull);
    expect(wake.mesh.geometry.drawRange.count).toBe(72); // no bridge to old trail
    wake.reset();
    expect(wake.mesh.geometry.drawRange.count).toBe(0);
    wake.dispose();
  });

  it('uses the actual model footprint for every ship, independent of upgrades', () => {
    for (const id of ['sloop', 'cutter', 'schooner', 'clipper', 'hoy', 'fluyt', 'indiaman']) {
      const stock = createBoatModel(id);
      const upgraded = createBoatModel(id, { upgrades: { sails: 3, hold: 3, hull: 3 } });
      expect(stock.wakeHull.length).toBeGreaterThan(stock.wakeHull.beam);
      expect(upgraded.wakeHull).toEqual(stock.wakeHull);
      if (id === 'indiaman') expect(stock.wakeHull.length).toBeGreaterThan(28);
      stock.dispose();
      upgraded.dispose();
    }
  });
});
