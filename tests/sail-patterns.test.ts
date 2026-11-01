import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RULES } from '../src/sim/cosmetics';
import { panelPaint, patternPaint } from '../src/render/models/sailPatterns';
import { cloth } from '../src/render/models/sailCloth';
import { boatLookOf, resolveBoatLook } from '../src/render/models/boatLook';
import { applyWakeStyle, wakeStyleUniforms } from '../src/render/wakeStyle';
import { resolveAppearance } from '../src/sim/cosmetics';
import { SHIPPED_CATALOGUE } from '../src/data/cosmetics';
import { FLAGS } from '../src/sim/regatta';

// Issue #418: at least six patterns, painted on the cloth's panels for no extra triangle; the
// upgrade foot and head bands keep their rows; wake styles are uniforms only.

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SAIL = [V(0, 0, 0), V(0, 0, -4), V(0, 3, 0), V(0, 4.5, -2.6)] as const;
const KINDS = Object.keys(RULES.patterns).filter((k) => k !== 'plain' && k !== 'bands');
const colours = (g: THREE.BufferGeometry) => {
  const c = g.getAttribute('color');
  return new Set(
    Array.from({ length: c.count }, (_, i) =>
      new THREE.Color().fromBufferAttribute(c, i).getHexString(),
    ),
  );
};

describe('sail patterns', () => {
  it('offers at least six patterns and a shipped item for each', () => {
    expect(KINDS.length + 1).toBeGreaterThanOrEqual(6);
    for (const kind of [...KINDS, 'bands'])
      expect(
        SHIPPED_CATALOGUE.items.some((i) => i.slot === 'sail-pattern' && i.pattern === kind),
        kind,
      ).toBe(true);
  });

  it('paints some panels, but not all, on the big sails and the square courses', () => {
    for (const kind of KINDS)
      for (const [nu, nv] of [
        [6, 6],
        [5, 4],
      ] as const) {
        const painted = [];
        for (let i = 0; i < nu; i++)
          for (let j = 0; j < nv; j++) painted.push(...panelPaint(kind, i, j, nu, nv).paint);
        expect(
          painted.some((p) => p >= 0),
          `${kind} ${nu}x${nv}`,
        ).toBe(true);
        expect(
          painted.some((p) => p < 0),
          `${kind} ${nu}x${nv}`,
        ).toBe(true);
      }
  });

  it('splits a panel along a slanted edge', () => {
    // The chevron's left arm climbs one panel per panel: its edge runs corner to corner.
    expect(patternPaint('chevron', 0.9, 1.1)).not.toBe(patternPaint('chevron', 0.1, 1.9));
    expect(panelPaint('chevron', 0, 1).split).toBe('ac');
  });

  it('costs no triangle and keeps the foot and head bands at sails 3', () => {
    const plain = resolveBoatLook({ bandColor: '#2f6f9f', sailBandColor: '#2f6f9f' });
    const base = cloth(...SAIL, 3, 0.3, plain);
    for (const kind of KINDS) {
      const look = {
        ...plain,
        sailBand: '#123456',
        sailPattern: { kind, colours: ['#2f6f9f', '#123456'] },
      };
      const g = cloth(...SAIL, 3, 0.3, look);
      expect(g.getAttribute('position').count, kind).toBe(base.getAttribute('position').count);
      expect(colours(g).has('123456'), kind).toBe(true);
      expect(colours(g).has('2f6f9f'), kind).toBe(true);
    }
  });

  it('maps a catalogue look onto the model channels', () => {
    const { look } = resolveAppearance(
      SHIPPED_CATALOGUE,
      { sailPattern: 'chevron-plum', sailLogo: 'gull' },
      'sloop',
      FLAGS,
    );
    const ch = boatLookOf(look);
    expect(ch.sailPattern?.kind).toBe('chevron');
    expect(ch.sailBand).toBe(ch.sailPattern?.colours[1]);
    expect(ch.sailLogo?.svg).toContain('<svg');
    // The stock canvas leaves each sails level its own canvas.
    expect(ch.sailCloth).toBeUndefined();
  });
});

describe('wake styles', () => {
  it('draw patterns and sparkle on High only, a tint on every level', () => {
    const material = new THREE.ShaderMaterial({ uniforms: wakeStyleUniforms() });
    const u = material.uniforms;
    applyWakeStyle(material, { style: 'bubbles', tint: '#88ccff' }, 'low');
    expect(u.uStyle!.value.x).toBe(0);
    expect(u.uStyle!.value.w).toBe(0);
    expect(u.uTintMix!.value).toBeGreaterThan(0);
    applyWakeStyle(material, { style: 'bubbles', tint: null }, 'high');
    expect(u.uStyle!.value.x).toBeGreaterThan(0);
    expect(u.uTintMix!.value).toBe(0);
    applyWakeStyle(material, null, 'high');
    expect(u.uStyle!.value.toArray()).toEqual([0, 1, 0, 0]);
  });

  it('has a look for every wake style the catalogue allows', async () => {
    const { default: file } = await import('../src/data/boat-look.json');
    for (const style of RULES.wakeStyles) expect(file.wakes, style).toHaveProperty(style);
  });
});
