import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { QUALITY } from '../src/render/quality';
import { mergeAll, paint } from '../src/render/models/geometry';
import { buildProp } from '../src/render/models/propRecipe';
import { surfaceOfPart, unknownSurfaces } from '../src/render/models/surfaceNames';
import { plankedHull } from '../src/render/models/boatSurfaces';
import { withSurface, withSurfaceDetail } from '../src/render/surfaceDetail';
import { SURFACE_KINDS, surfaceKindNumber } from '../src/render/surfaceGlsl';
import { TUNING } from '../src/data/tuning';

const box = () => paint(new THREE.BoxGeometry(1, 1, 1), '#aa8855');

describe('surface patterns (issue #572)', () => {
  it('every pattern palette.json names exists', () => {
    expect(unknownSurfaces()).toEqual([]);
  });

  it('a part takes its colour name’s pattern, its style’s, or its own', () => {
    const stone = { surfaces: { walls: 'stone', roofs: 'slate' } };
    expect(surfaceOfPart({ color: 'walls[variant]' }, undefined)).toBe('plaster');
    expect(surfaceOfPart({ color: 'walls[variant]' }, stone)).toBe('stone');
    expect(surfaceOfPart({ color: { leanTo: 'roofs[1]' } }, stone)).toBe('slate');
    expect(surfaceOfPart({ color: 'plank' }, undefined)).toBe('planks');
    expect(surfaceOfPart({ color: 'plank', surface: 'none' }, undefined)).toBeUndefined();
    expect(surfaceOfPart({ color: '#ffffff' }, undefined)).toBeUndefined();
  });

  it('a recipe house carries walls, roofs and planks', () => {
    const parts = buildProp('beach-house-rich', {
      R: 10,
      style: 'fish',
      variant: 1,
      shape: 0,
      size: 1,
    });
    const kinds = new Set(parts.map((g) => g.userData.surface));
    expect(kinds).toContain('plaster');
    expect(kinds.has('tiles') || kinds.has('thatch')).toBe(true);
    expect(kinds).toContain('planks');
  });

  it('merging bakes each part’s pattern per vertex, plain parts as 0', () => {
    const merged = mergeAll([withSurface(box(), 'stone'), box()]);
    const kinds = Array.from(merged.attributes.surface!.array);
    expect(kinds.slice(0, 36).every((k) => k === surfaceKindNumber('stone'))).toBe(true);
    expect(kinds.slice(36).every((k) => k === 0)).toBe(true);
  });

  it('parts without any pattern merge as before, without the attribute', () => {
    expect(mergeAll([box(), box()]).attributes.surface).toBeUndefined();
  });

  it('a planked hull keeps its colours and is planks', () => {
    const hull = plankedHull(box());
    expect(hull.userData.surface).toBe('planks');
    expect(hull.attributes.color).toBeDefined();
  });

  it('patterned materials never share a program with plain ones', () => {
    const plain = new THREE.MeshLambertMaterial();
    const land = withSurfaceDetail(new THREE.MeshLambertMaterial());
    const sail = withSurfaceDetail(new THREE.MeshLambertMaterial(), 'canvas');
    const keys = [plain, land, sail].map((m) => m.customProgramCacheKey());
    expect(new Set(keys).size).toBe(3);
  });

  it('no patterns on Ultra-low and Low; soft edges on High and Ultra only', () => {
    expect(QUALITY.ultralow.surfacePatterns || QUALITY.low.surfacePatterns).toBe(false);
    expect(QUALITY.medium.surfacePatterns && QUALITY.high.surfacePatterns).toBe(true);
    expect(QUALITY.ultra.surfacePatterns).toBe(true);
    expect(QUALITY.medium.softEdges).toBe(false);
    expect(QUALITY.high.softEdges && QUALITY.ultra.softEdges).toBe(true);
  });

  it('every pattern has its numbers, and fades out before the top view’s distance', () => {
    const data = TUNING.graphics.surface;
    for (const kind of SURFACE_KINDS) expect(data.patterns[kind].size).toBeGreaterThan(0);
    expect(data.fadeTo).toBeLessThanOrEqual(TUNING.camera.distance * TUNING.camera.zoomMin + 5);
  });
});
