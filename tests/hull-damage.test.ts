import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SHIP_FILES, shipDamageProblems } from '../src/data/ships';
import { TUNING } from '../src/data/tuning';
import { ImpactDebris } from '../src/render/impactDebris';
import { shipModel } from '../src/render/models/shipModels';
import { damageStage } from '../src/sim/hazards';

const triangles = (o: THREE.Object3D | undefined) => {
  const g = (o as THREE.Mesh).geometry;
  return (g.index?.count ?? g.getAttribute('position').count) / 3;
};

describe('visible hull damage (decision 0208)', () => {
  it('steps every quarter of the hull lost, from the tuning file', () => {
    expect([1, 0.8, 0.74, 0.5, 0.49, 0.25, 0.2, 0].map(damageStage)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
    const d = TUNING.seamanship.damage;
    expect(d.scuffedBelow).toBeGreaterThan(d.patchedBelow);
    expect(d.patchedBelow).toBeGreaterThan(d.tornBelow);
  });

  it('gives every ship file a damage block that passes the check', () => {
    for (const file of SHIP_FILES) {
      expect(file.model.damage, file.id).toBeDefined();
      expect(shipDamageProblems(file), file.id).toEqual([]);
    }
    const sloop = SHIP_FILES.find((f) => f.id === 'sloop')!;
    const bad = {
      ...sloop,
      model: { ...sloop.model, damage: { ...sloop.model.damage!, rail: { z: 0.9, side: 2 } } },
    };
    expect(shipDamageProblems(bad)).toHaveLength(2);
  });

  it('changes the model at each step, with no extra draw', () => {
    for (const file of SHIP_FILES) {
      const boats = ([0, 1, 2, 3] as const).map((damage) => shipModel(file.id, { damage }));
      const [sound, scuffed, patched, torn] = boats.map((b) => b.stats);
      // Scuffs add patches; the broken rail removes a stretch of gunwale.
      expect(scuffed!.triangles, file.id).toBeGreaterThan(sound!.triangles);
      expect(patched!.triangles, file.id).not.toBe(scuffed!.triangles);
      expect(scuffed!.meshes).toBe(sound!.meshes);
      expect(patched!.meshes).toBe(sound!.meshes);
      // Torn: holes in the main canvas and a list, still no extra draw.
      expect(torn!.meshes, file.id).toBe(sound!.meshes);
      const main = (b: (typeof boats)[number]) =>
        b.root.getObjectByName(
          file.model.squareMasts
            ? `${file.model.squareMasts[0]!.name}Courses`
            : (file.model.mainName ?? 'Mainsail'),
        );
      expect(triangles(main(boats[3]!)), file.id).toBeLessThan(triangles(main(boats[2]!)));
      for (const b of boats)
        b.update({ sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 });
      const list = (b: (typeof boats)[number]) => b.root.children[0]!.rotation.z;
      expect(list(boats[2]!)).toBe(0);
      expect(Math.abs(list(boats[3]!)), file.id).toBeCloseTo(
        (file.model.damage!.listDeg * Math.PI) / 180,
      );
    }
  });

  it('throws up a splash and planks that are gone again, in two instanced draws', () => {
    const debris = new ImpactDebris();
    debris.spawn(0, 0, 1, 0, 4, () => 0.5);
    const d = TUNING.seamanship.damage;
    expect(debris.active).toBe(d.planks + d.splash);
    debris.update(0.1, () => 0);
    expect(debris.planks.visible && debris.splash.visible).toBe(true);
    expect(debris.planks.count).toBe(d.planks);
    for (let t = 0; t < d.debrisSeconds + 1; t += 0.1) debris.update(0.1, () => 0);
    expect(debris.active).toBe(0);
    expect(debris.planks.visible || debris.splash.visible).toBe(false);
    debris.dispose();
  });
});
