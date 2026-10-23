import { describe, expect, it } from 'vitest';
import { SHIP_FILES, shipClassOf, type ShipFile } from '../src/data/ships';
import { SHIPPED_TUNING } from '../src/data/tuning';
import { RefinedBoat } from '../src/render/models/refinedBoat';
import { rigOf, shipModel } from '../src/render/models/shipModels';
import { SHIP_PARTS } from '../src/render/models/shipParts';
import { HULL_DIMENSIONS, HULL_SHAPES } from '../src/sim/hullShape';
import { HEEL_FACTOR } from '../src/sim/heel';
import { SHIP_IDS } from '../src/sim/ship';

const files = import.meta.glob<ShipFile>('../src/data/ships/*.json', {
  eager: true,
  import: 'default',
});

describe('ship files (decision 0109)', () => {
  it('loads one file per ship, named by id, in shipyard order', () => {
    for (const [path, file] of Object.entries(files)) expect(path).toMatch(`/${file.id}.json`);
    expect(SHIP_IDS).toEqual([
      'sloop',
      'cutter',
      'schooner',
      'clipper',
      'hoy',
      'fluyt',
      'indiaman',
    ]);
    const tiers = SHIP_FILES.map((f) => `${f.line}:${f.tier}`);
    expect(new Set(tiers).size).toBe(tiers.length);
  });

  it('feeds the sim, harbours and heel from the same file', () => {
    for (const file of SHIP_FILES) {
      expect(SHIPPED_TUNING.ships[file.id]).toEqual(shipClassOf(file));
      expect(HULL_DIMENSIONS[file.id]).toEqual({ length: file.hull.length, beam: file.hull.beam });
      expect(HULL_SHAPES[file.id]!.rings).toBe(file.hull.rings);
      expect(HEEL_FACTOR[file.id]).toBe(file.sailing.heel);
      for (const part of file.model.parts ?? []) expect(SHIP_PARTS, file.id).toHaveProperty([part]);
    }
  });

  it('builds a new ship from a copied file with no code', () => {
    const cutter = SHIP_FILES.find((f) => f.id === 'cutter')!;
    const ketch: ShipFile = {
      ...cutter,
      id: 'ketch',
      name: 'Ketch',
      model: { ...cutter.model, hullColor: '#334455', parts: ['leeboards'] },
    };
    const boat = new RefinedBoat(rigOf(ketch));
    expect(boat.root.getObjectByName('KetchHull')).toBeTruthy();
    expect(boat.stats.triangles).toBeGreaterThan(shipModel('cutter').stats.triangles);
    expect(shipClassOf(ketch)).toMatchObject({ id: 'ketch', price: cutter.unlock.price });
    expect(() => rigOf({ ...ketch, model: { ...ketch.model, parts: ['paddle-wheel'] } })).toThrow(
      /paddle-wheel/,
    );
  });
});
