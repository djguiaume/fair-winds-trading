import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOGUE } from '../src/data/cosmetics';
import { RULES } from '../src/sim/cosmetics';
import { emblemTriangles } from '../src/render/models/emblem';
import {
  canvasPatches,
  clothUv,
  contrast,
  mainsailMarks,
  numberMark,
} from '../src/render/models/sailMarks';
import { cloth } from '../src/render/models/sailCloth';
import { resolveBoatLook } from '../src/render/models/boatLook';
import { createBoatModel } from '../src/render/models';
import type { RefinedBoat } from '../src/render/models/refinedBoat';
import { SHIP_FILES } from '../src/data/ships';

// Issue #418: logos and racing numbers are painted on the cloth itself, no floating ends.

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** A gaff mainsail as refinedBoat.ts lays it: tack, clew, throat, peak. */
const GAFF = [V(0, 0, 0), V(0, 0, -4), V(0, 3, 0), V(0, 4.5, -2.6)] as const;
const BELLY = 0.32;
const look = resolveBoatLook({ bandColor: '#2f6f9f', sailBandColor: '#2f6f9f' });

const area = (t: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < t.length; i += 6)
    sum +=
      ((t[i + 2]! - t[i]!) * (t[i + 5]! - t[i + 1]!) -
        (t[i + 3]! - t[i + 1]!) * (t[i + 4]! - t[i]!)) /
      2;
  return sum;
};

describe('emblems', () => {
  it('fills every shipped logo within the triangle budget, counter-clockwise, in its unit box', () => {
    const logos = Object.entries(SHIPPED_CATALOGUE.logos);
    expect(logos.length).toBe(12);
    for (const [id, svg] of logos) {
      const t = emblemTriangles(svg);
      expect(t.length / 6, id).toBeGreaterThan(0);
      expect(t.length / 6, id).toBeLessThanOrEqual(RULES.maxTriangles['sail-logo']);
      for (let i = 0; i < t.length; i += 6)
        expect(area(t.subarray(i, i + 6)), id).toBeGreaterThanOrEqual(0);
      for (const v of t) expect(Math.abs(v), id).toBeLessThanOrEqual(0.5 + 1e-6);
    }
  });

  it('reads a path with a hole, curves and transforms', () => {
    const ring = emblemTriangles(
      '<svg viewBox="0 0 10 10"><path d="M0 0 H10 V10 H0 Z M3 3 V7 H7 V3 Z"/></svg>',
    );
    // A 10 square minus a 4 square, in units of the 10-wide box.
    expect(area(ring)).toBeCloseTo(0.84, 5);
    const turned = emblemTriangles(
      '<svg viewBox="0 0 10 10"><g transform="rotate(90 5 5)"><rect x="0" y="4" width="10" height="2"/></g></svg>',
    );
    const xs = [...turned].filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.2, 5);
    const curve = emblemTriangles('<svg viewBox="0 0 10 10"><path d="M0 10 Q5 0 10 10 Z"/></svg>');
    expect(curve.length / 6).toBeGreaterThan(1);
  });
});

describe('racing numbers', () => {
  it('draws two triangles a stroke, centred', () => {
    const t = numberMark('K 7');
    expect(t.length / 6).toBe(10);
    const xs = [...t].filter((_, i) => i % 2 === 0);
    expect(Math.abs(Math.min(...xs) + Math.max(...xs))).toBeLessThan(0.05);
  });

  it('hides the logo while racing', () => {
    const svg = SHIPPED_CATALOGUE.logos.anchor!;
    const worn = { ...look, sailLogo: { svg, colour: '#1f4e79' } };
    expect(mainsailMarks(worn)).toHaveLength(1);
    expect(mainsailMarks(worn, 'FW 1')[0]!.colour).not.toBe('#1f4e79');
  });
});

describe('marks on the cloth', () => {
  it('finds the cloth point under a flat sail point', () => {
    for (const [u, v] of [
      [0.2, 0.3],
      [0.5, 0.7],
      [0.9, 0.95],
    ] as const) {
      const [a, b, c, d] = GAFF;
      const y = (a.y * (1 - u) + b.y * u) * (1 - v) + (c.y * (1 - u) + d.y * u) * v;
      const z = (a.z * (1 - u) + b.z * u) * (1 - v) + (c.z * (1 - u) + d.z * u) * v;
      const [gu, gv] = clothUv(GAFF, y, z);
      expect(gu).toBeCloseTo(u, 5);
      expect(gv).toBeCloseTo(v, 5);
    }
  });

  it('lays every mark corner on the bellied cloth, once readable from each side', () => {
    const worn = { ...look, sailLogo: { svg: SHIPPED_CATALOGUE.logos.anchor!, colour: '#1f4e79' } };
    const marks = mainsailMarks(worn);
    const plain = cloth(...GAFF, 2, BELLY, look);
    const g = cloth(...GAFF, 2, BELLY, look, 6, 6, { marks });
    const markAttr = g.getAttribute('mark');
    const pos = g.getAttribute('position');
    const sides = new Set<number>();
    let painted = 0;
    for (let i = 0; i < pos.count; i++) {
      const side = markAttr.getX(i);
      if (side === 0) continue;
      sides.add(Math.sign(side));
      // Lifted by its layer (1) plus the sag of its flat triangles under the belly.
      expect(Math.abs(side)).toBeGreaterThanOrEqual(1);
      painted++;
      // The cloth's own x at this point's (u, v): the mark sits on it, not in front or behind.
      const [u, v] = clothUv(GAFF, pos.getY(i), pos.getZ(i));
      expect(pos.getX(i)).toBeCloseTo(-BELLY * Math.sin(Math.PI * u) * Math.sin(Math.PI * v), 5);
    }
    expect([...sides].sort()).toEqual([-1, 1]);
    expect(painted).toBe((2 * marks[0]!.tris.length) / 2);
    expect(pos.count - plain.getAttribute('position').count).toBe(painted);
  });

  it('leaves a mark out over a torn panel', () => {
    const marks = mainsailMarks(look, 'FW 1');
    const whole = cloth(...GAFF, 2, BELLY, look, 6, 6, { marks });
    const torn = cloth(...GAFF, 2, BELLY, look, 6, 6, { marks, tears: [{ u: 0.5, v: 0.45 }] });
    const count = (g: THREE.BufferGeometry) =>
      [...(g.getAttribute('mark').array as Float32Array)].filter((m) => m !== 0).length;
    expect(count(torn)).toBeLessThan(count(whole));
  });
});

describe('a canvas patch behind a low-contrast logo', () => {
  const navy = { ...look, sailLogo: { svg: SHIPPED_CATALOGUE.logos.gull!, colour: '#1f4e79' } };
  const marks = mainsailMarks(navy);
  const canvas = '#f4f1e8';
  const diamond = { kind: 'diamond', colours: ['#2f6f9f', '#9cc7e4'] };

  it('keeps plain canvas panels behind a logo the pattern would swallow', () => {
    const [box] = canvasPatches(marks, diamond, canvas, 6, 6);
    expect(box![0]).toBeLessThan(marks[0]!.u);
    expect(box![1]).toBeGreaterThan(marks[0]!.u);
    // Sewn from the cloth's own panels: the same triangles, the pattern's colour gone there.
    const bare = cloth(...GAFF, 3, BELLY, { ...look, sailPattern: diamond });
    const backed = cloth(...GAFF, 3, BELLY, { ...look, sailPattern: diamond }, 6, 6, { marks });
    const painted = (g: THREE.BufferGeometry) => {
      const [c, mark] = [g.getAttribute('color'), g.getAttribute('mark')];
      const cloth = Array.from({ length: c.count }, (_, i) => i).filter((i) => !mark?.getX(i));
      return cloth.filter(
        (i) => new THREE.Color().fromBufferAttribute(c, i).getHexString() === '2f6f9f',
      ).length;
    };
    expect(painted(backed)).toBeLessThan(painted(bare));
  });

  it('leaves a bare logo on a plain sail or a pattern that contrasts', () => {
    expect(canvasPatches(marks, null, canvas, 6, 6)).toEqual([]);
    const pale = { kind: 'diamond', colours: ['#f4f1e8', '#e6dcc4'] };
    expect(canvasPatches(marks, pale, canvas, 6, 6)).toEqual([]);
  });

  it('measures contrast as a ratio from 1 to 21', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#2f6f9f', '#2f6f9f')).toBe(1);
  });
});

describe('the look budget (issue #418)', () => {
  it('adds no mesh on any class, and at most a logo copy a side in triangles', () => {
    const svg = SHIPPED_CATALOGUE.logos['four-winds']!;
    // A navy logo on the navy diamond: its canvas patch is sewn from the cloth's own panels.
    const logoTris = emblemTriangles(svg).length / 6;
    const worn = {
      sailLogo: { svg, colour: '#1f4e79' },
      sailPattern: { kind: 'diamond', colours: ['#2f6f9f', '#9cc7e4'] },
    };
    for (const ship of SHIP_FILES.map((s) => s.id)) {
      const upgrades = { sails: 3, hold: 3, hull: 3 } as const;
      const stock = createBoatModel(ship, { upgrades }) as RefinedBoat;
      const dressed = createBoatModel(ship, { upgrades, look: worn }) as RefinedBoat;
      expect(dressed.stats.meshes, ship).toBe(stock.stats.meshes);
      expect(dressed.stats.triangles - stock.stats.triangles, ship).toBe(2 * logoTris);
      stock.dispose();
      dressed.dispose();
    }
  });
});
