import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resetTuning, TUNING } from '../src/data/tuning';
import { SHIP_FILES } from '../src/data/ships';
import { bellyFor, handsAboard } from '../src/render/models/boatCloseUp';
import { shipModel } from '../src/render/models/shipModels';
import type { BoatPose } from '../src/render/models/types';
import { DEG } from '../src/sim/math';

// Issue #553: the player's boat up close carries her crew and a working tiller; every other
// boat (traffic, previews, the far view) is the model it was.
const POSE: BoatPose = { sail: 1, boomAngle: 0.3, luff: 0, heel: 0, windRelative: 0, time: 0 };
const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('the boat up close', () => {
  it('adds a crew and a tiller only to the close-up model', () => {
    const plain = shipModel('sloop');
    const near = shipModel('sloop', { closeUp: true });
    expect(plain.root.getObjectByName('Crew')).toBeUndefined();
    expect(near.root.getObjectByName('Crew')).toBeDefined();
    expect(near.root.getObjectByName('Tiller')).toBeDefined();
    // The tiller left the hull mesh for its own: the far model is otherwise the same.
    expect(near.stats.meshes).toBe(plain.stats.meshes + 2);
    plain.dispose();
    near.dispose();
  });

  it('keeps every ship inside its close-up triangle budget', () => {
    // docs/art/boat-up-close.md: crew, tiller and coils cost at most 900 triangles a ship.
    for (const file of SHIP_FILES) {
      const plain = shipModel(file.id, { upgrades: { sails: 3, hold: 3, hull: 3 } });
      const near = shipModel(file.id, { upgrades: { sails: 3, hold: 3, hull: 3 }, closeUp: true });
      expect(near.stats.triangles - plain.stats.triangles, file.id).toBeLessThanOrEqual(900);
      plain.dispose();
      near.dispose();
    }
  });

  it('hides the crew when far or on Low, and shows it near', () => {
    const boat = shipModel('sloop', { closeUp: true });
    const crew = boat.root.getObjectByName('Crew')!;
    boat.setCloseUp(false);
    expect(crew.visible).toBe(false);
    boat.setCloseUp(true);
    expect(crew.visible).toBe(true);
    boat.setLowDetail(true);
    boat.setCloseUp(true);
    expect(crew.visible).toBe(false);
    boat.dispose();
  });

  it('turns the tiller to port to turn her to starboard', () => {
    const boat = shipModel('sloop', { closeUp: true });
    const tiller = boat.root.getObjectByName('Tiller')!;
    const end = () => {
      boat.root.updateWorldMatrix(true, true);
      return tiller.localToWorld(new THREE.Vector3(0, 0, 0.6));
    };
    boat.update({ ...POSE, rudder: 0 });
    const centre = end();
    boat.update({ ...POSE, rudder: 1 });
    // The model's bow faces -Z, so port is -X.
    expect(end().x).toBeLessThan(centre.x - 0.5);
    boat.dispose();
  });

  it('walks the crew to the weather side in a tack and leans them out', () => {
    const boat = shipModel('sloop', { closeUp: true });
    const crew = boat.root.getObjectByName('Crew')!;
    // Boom to starboard (+): the wind is over her port side, so the crew sits to port (-X).
    boat.update({ ...POSE, boomAngle: 0.3, heel: -0.2, time: 0 });
    const before = world(crew).x;
    expect(before).toBeLessThan(0);
    // She tacks: half way across after half the crossing time, all the way after it.
    const cross = TUNING.graphics.closeUp.crossSeconds;
    for (let t = 0; t <= cross * 0.5; t += 0.05) boat.update({ ...POSE, boomAngle: -0.3, time: t });
    expect(Math.abs(world(crew).x)).toBeLessThan(Math.abs(before) * 0.5);
    for (let t = cross * 0.5; t <= cross * 1.2; t += 0.05)
      boat.update({ ...POSE, boomAngle: -0.3, heel: 0.2, time: t });
    expect(world(crew).x).toBeGreaterThan(0);
    // Leaning out to windward (+X) against her heel to port: they stand straighter than her mast.
    const up = crew
      .localToWorld(new THREE.Vector3(0, 1, 0))
      .sub(world(crew))
      .normalize();
    expect(up.x).toBeGreaterThan(-Math.sin(0.2) * 0.5);
    boat.dispose();
  });

  it('carries the hands each class is given, and option B adds one to every ship', () => {
    const hands = TUNING.graphics.closeUp.hands as Record<string, number>;
    expect(Object.keys(hands).sort()).toEqual(SHIP_FILES.map((f) => f.id).sort());
    expect(handsAboard('sloop')).toBe(0);
    expect(handsAboard('indiaman')).toBe(2);
    TUNING.graphics.closeUp.extraHands = 1;
    expect(handsAboard('sloop')).toBe(1);
    resetTuning();
  });

  it('stands the sails flatter close-hauled than running', () => {
    expect(bellyFor(12 * DEG)).toBeCloseTo(TUNING.graphics.closeUp.bellyCloseHauled);
    expect(bellyFor(-80 * DEG)).toBeCloseTo(TUNING.graphics.closeUp.bellyRunning);
    expect(bellyFor(45 * DEG)).toBeGreaterThan(bellyFor(20 * DEG));
  });
});
