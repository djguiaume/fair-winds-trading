import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHIP_FILES, shipLookProblems } from '../src/data/ships';
import {
  BOAT_LOOK,
  canvasColour,
  resolveBoatLook,
  sailRow,
  sailRowEdges,
  strakeColour,
} from '../src/render/models/boatLook';
import { figureheadParts } from '../src/render/models/figurehead';
import { createShipModel } from '../src/render/models/shipModels';
import type { BoatModelOptions, UpgradeLevel } from '../src/render/models/types';

const CLASS = { bandColor: '#c0533a', sailBandColor: '#2a64a6' };
const all = (n: UpgradeLevel) => ({ sails: n, hold: n, hull: n });

/** Every vertex colour of a boat's meshes, by mesh name, as hex. */
function colours(id: string, options: BoatModelOptions) {
  const model = createShipModel(id, options);
  const out = new Map<string, Set<string>>();
  const c = new THREE.Color();
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const attr = mesh.isMesh ? mesh.geometry.getAttribute('color') : undefined;
    if (!attr) return;
    const set = out.get(mesh.name) ?? new Set<string>();
    for (let i = 0; i < attr.count; i++)
      set.add(`#${c.fromBufferAttribute(attr, i).getHexString()}`);
    out.set(mesh.name, set);
  });
  model.dispose();
  return out;
}

const hex = (s: string) => `#${new THREE.Color(s).getHexString()}`;
const sails = (map: Map<string, Set<string>>) =>
  new Set([...map].filter(([n]) => /sail|Jib|Courses|Mizzen/.test(n)).flatMap(([, s]) => [...s]));
const hull = (map: Map<string, Set<string>>, id: string) => {
  const name = SHIP_FILES.find((f) => f.id === id)!.name;
  return map.get(`${name}Hull`)!;
};

describe('sail bands (decision 0259, variant B)', () => {
  it('adds a foot band at sails 2 and head band and stripe at sails 3', () => {
    const rows = (level: number, nv: number) =>
      Array.from({ length: nv }, (_, j) => sailRow(level, j, nv));
    expect(rows(1, 6)).toEqual(Array(6).fill('canvas'));
    expect(rows(2, 6)).toEqual(['band', 'canvas', 'canvas', 'canvas', 'canvas', 'canvas']);
    expect(rows(3, 6)).toEqual(['band', 'canvas', 'stripe', 'stripe', 'canvas', 'band']);
  });

  it('keeps canvas between the bands on short square courses', () => {
    expect([0, 1, 2, 3].map((j) => sailRow(3, j, 4))).toEqual(['band', 'canvas', 'canvas', 'band']);
  });

  it('shows the class band on the sails from sails 2 only, on every class', () => {
    for (const file of SHIP_FILES) {
      const band = hex(file.model.sailBandColor);
      expect(sails(colours(file.id, { upgrades: all(1) })).has(band), file.id).toBe(false);
      expect(sails(colours(file.id, { upgrades: all(2) })).has(band), file.id).toBe(true);
    }
  });

  it('gives every sail vertex a glow, lower on the bands', () => {
    const model = createShipModel('indiaman', { upgrades: all(3) });
    const glows = new Set<number>();
    model.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const material = mesh.material as THREE.Material | undefined;
      if (material?.customProgramCacheKey() !== 'sail-canvas-glow-marks') return;
      const glow = mesh.geometry.getAttribute('glow');
      expect(glow?.count, mesh.name).toBe(mesh.geometry.getAttribute('position').count);
      for (let i = 0; i < glow.count; i++) glows.add(Math.round(glow.getX(i) * 100) / 100);
    });
    expect([...glows].sort()).toEqual([BOAT_LOOK.sails.bandGlow, 1]);
    model.dispose();
  });

  it('paints a chosen cloth and pattern colours in the same places', () => {
    const look = { sailCloth: '#e8d0d0', sailBand: '#602080', sailStripe: '#208060' };
    const got = sails(colours('cutter', { upgrades: all(3), look }));
    for (const c of Object.values(look)) expect(got.has(hex(c)), c).toBe(true);
    expect(got.has(hex('#2a64a6'))).toBe(false);
  });
});

describe('hull strakes and copper', () => {
  it('goes bare, class band, then band and copper, with no strake on the stock look', () => {
    const look = resolveBoatLook(CLASS);
    expect([1, 2, 3].map((h) => strakeColour(look, h))).toEqual([null, null, null]);
    const band = hex(SHIP_FILES.find((f) => f.id === 'sloop')!.model.bandColor);
    const copper = hex(BOAT_LOOK.hull.copper);
    const at = (n: UpgradeLevel) => hull(colours('sloop', { upgrades: all(n) }), 'sloop');
    expect([band, copper].map((c) => at(1).has(c))).toEqual([false, false]);
    expect([band, copper].map((c) => at(2).has(c))).toEqual([true, false]);
    expect([band, copper].map((c) => at(3).has(c))).toEqual([true, true]);
  });

  it('takes a chosen band and strake at every hull level from 2, keeping copper at 3', () => {
    const look = { hullBand: '#203040', hullStrake: '#d0d0d0' };
    for (const n of [2, 3] as const) {
      const h = hull(colours('fluyt', { upgrades: all(n), look }), 'fluyt');
      expect(h.has(hex(look.hullBand)) && h.has(hex(look.hullStrake)), `hull ${n}`).toBe(true);
      expect(h.has(hex(BOAT_LOOK.hull.copper)), `hull ${n}`).toBe(n === 3);
    }
  });
});

describe('sail row depths', () => {
  it('deepens the foot band from sails 2 and keeps the rows in order', () => {
    const even = sailRowEdges(1, 6);
    expect(even.map((v) => Math.round(v * 6 * 1000) / 1000)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const banded = sailRowEdges(2, 6);
    expect(banded[0]).toBe(0);
    expect(banded[6]).toBe(1);
    expect(banded[1]! / (banded[2]! - banded[1]!)).toBeCloseTo(BOAT_LOOK.sails.footBand);
  });
});

describe('stock look and ship files', () => {
  it('fills every channel from the class, the stripe from the band', () => {
    expect(resolveBoatLook(CLASS)).toEqual({
      sailCloth: null,
      sailBand: '#2a64a6',
      sailStripe: '#2a64a6',
      hullBand: '#c0533a',
      hullStrake: null,
      figurehead: null,
      sailPattern: null,
      sailLogo: null,
    });
    const look = resolveBoatLook(CLASS);
    expect([1, 2, 3].map((n) => canvasColour(look, n, false))).toEqual(
      Object.values(BOAT_LOOK.sails.canvas),
    );
    expect(canvasColour(look, 3, true)).toBe(BOAT_LOOK.sails.canvas['1']);
  });

  it('has valid class colours and a figurehead mount in every ship file', () => {
    for (const file of SHIP_FILES) {
      expect(shipLookProblems(file), file.id).toEqual([]);
      expect(file.model.figureheadMount, file.id).toBeDefined();
    }
    const bad = structuredClone(SHIP_FILES[0]!);
    bad.model.sailBandColor = 'blue';
    bad.model.figureheadMount = { size: 0, drop: -1 };
    expect(shipLookProblems(bad)).toHaveLength(4);
  });

  it('refuses a mount that is not the catalogue share of her length', () => {
    const odd = structuredClone(SHIP_FILES[0]!);
    odd.model.figureheadMount = { size: odd.hull.length * 0.1, drop: 0.05 };
    expect(shipLookProblems(odd).join()).toContain('figurehead.share');
  });
});

describe('figurehead mounts', () => {
  const triangles = (id: string, options: BoatModelOptions) => {
    const model = createShipModel(id, options);
    const count = model.root.children.length;
    let tris = 0;
    model.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.name.endsWith('Hull'))
        tris += m.geometry.getAttribute('position').count / 3;
    });
    model.dispose();
    return { tris, count };
  };

  it('merges the figurehead into the hull mesh, so it moves with her for no draw call', () => {
    for (const file of SHIP_FILES) {
      const plain = triangles(file.id, {});
      const carved = triangles(file.id, { look: { figurehead: { recipe: 'beacon', size: 0.1 } } });
      expect(carved.tris, file.id).toBeGreaterThan(plain.tris);
      expect(carved.count, file.id).toBe(plain.count);
    }
  });

  it('scales any recipe so its longest side reach is the mount size times the item size', () => {
    for (const recipe of ['beacon', 'barn']) {
      const parts = figureheadParts(
        { recipe, size: 0.5 },
        { size: 1.2, drop: 0 },
        new THREE.Vector3(),
      );
      const box = new THREE.Box3();
      for (const g of parts) box.union(g.computeBoundingBox() ?? g.boundingBox!);
      const reach = box.getSize(new THREE.Vector3());
      expect(Math.max(reach.y, reach.z), recipe).toBeCloseTo(0.6);
    }
  });

  it('shows none for an unknown recipe', () => {
    const plain = triangles('sloop', {});
    expect(triangles('sloop', { look: { figurehead: { recipe: 'no-such', size: 1 } } })).toEqual(
      plain,
    );
  });
});
