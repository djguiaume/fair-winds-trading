import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  HAIR_STYLES,
  HATS,
  ITEMS,
  MOODS,
  character,
  lookOf,
  portraitSvg,
} from '../src/ui/portraits';
import { grownMap } from '../src/data/grownMap';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';

// Decision 0124: the people of the arcs are data in characters.json, drawn in code.
describe('characters.json', () => {
  const colour = /^#[0-9a-f]{6}$/;

  it('gives every person a unique id, a name, a role and a home port on the map', () => {
    // People of the Phase 4 seas live on the grown sea (decision 0155).
    const ports = new Set(prepareMap(grownMap(PHASE1_SOURCE)).ports.map((p) => p.id));
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    for (const c of CHARACTERS) {
      expect(c.name.length, c.id).toBeGreaterThan(0);
      expect(c.role.length, c.id).toBeGreaterThan(0);
      expect(ports.has(c.port), `${c.id} lives in ${c.port}`).toBe(true);
    }
  });

  it('uses only known parts and #rrggbb colours, in every look', () => {
    for (const c of CHARACTERS) {
      for (const variant of [undefined, ...Object.keys(c.looks ?? {})]) {
        const l = lookOf(c, variant);
        expect(HAIR_STYLES).toContain(l.hairStyle);
        expect(HATS).toContain(l.hat ?? 'none');
        expect(ITEMS).toContain(l.item ?? 'none');
        for (const key of [
          'skin',
          'hair',
          'clothes',
          'backdrop',
          'hatColor',
          'badge',
          'apron',
          'stripes',
        ] as const) {
          if (l[key] !== undefined) expect(l[key], `${c.id}.${key}`).toMatch(colour);
        }
      }
    }
  });
});

describe('portraitSvg', () => {
  it('draws every person in every mood without missing values', () => {
    for (const c of CHARACTERS) {
      for (const mood of MOODS) {
        const svg = portraitSvg(c, { mood, size: 40 });
        expect(svg).toMatch(/^<svg[^>]* width="40" height="40"/);
        expect(svg).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('is the same for the same input, and moods and looks change it', () => {
    const rook = character('rook')!;
    expect(portraitSvg(rook)).toBe(portraitSvg(rook));
    expect(portraitSvg(rook, { mood: 'pleased' })).not.toBe(portraitSvg(rook));
    const soaked = portraitSvg(rook, { variant: 'soaked' });
    expect(soaked).not.toBe(portraitSvg(rook));
    // Soaked after the wreck: no cap, no pipe.
    expect(lookOf(rook, 'soaked').hat).toBe('none');
    expect(lookOf(rook, 'soaked').item).toBe('none');
    // An unknown look falls back to the usual one.
    expect(portraitSvg(rook, { variant: 'nope' })).toBe(portraitSvg(rook));
  });
});
