import { describe, expect, it, vi } from 'vitest';
import { ISLAND_DESIGNS } from '../src/data/islands';
import { islandCoasts } from '../src/sim/islandLayout';
import type { IslandDef, TerrainDef } from '../src/sim/map';
import { Ocean, ShoreTextureCache } from '../src/render/ocean';
import { QUALITY } from '../src/render/quality';
import { GameView } from '../src/render/view';
import * as THREE from 'three';

const island = (): IslandDef => ({
  id: 'editable',
  x: 0,
  y: 0,
  radius: 12,
  look: { design: 'calda' },
});

describe('view-owned shoreline bake', () => {
  it('shares one bake across all quality profiles and equal replacement map objects', () => {
    const cache = new ShoreTextureCache();
    const islands = [island()];
    const shore = cache.get(islands);
    const disposed = vi.spyOn(shore.texture, 'dispose');
    for (const profile of Object.values(QUALITY)) {
      const same = cache.get(structuredClone(islands));
      expect(same).toBe(shore);
      const ocean = new Ocean(islands, profile.oceanSegments, profile.fancyWater, 480, [], same);
      expect(ocean.mesh.material.uniforms.uShoreMap!.value).toBe(shore.texture);
      expect(ocean.mesh.material.uniforms.uShoreBounds!.value).toBe(shore.bounds);
      ocean.dispose();
      ocean.dispose();
    }
    expect(disposed).not.toHaveBeenCalled();
    cache.dispose();
    cache.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('invalidates placement, scale, rotation and island-array edits, disposing only the replaced bake', () => {
    const cache = new ShoreTextureCache();
    const islands = [island()];
    const changes = [
      () => islands[0]!.x++,
      () => islands[0]!.y++,
      () => islands[0]!.radius++,
      () => {
        islands[0]!.look!.harbourBearing = 0.5;
      },
      () => islands.push({ id: 'generated', x: 50, y: 30, radius: 4 }),
      () => {
        islands[1]!.radius++;
      },
      () => {
        islands.pop();
      },
    ];
    let previous = cache.get(islands);
    for (const change of changes) {
      const disposed = vi.spyOn(previous.texture, 'dispose');
      change();
      const next = cache.get(islands);
      expect(next).not.toBe(previous);
      expect(disposed).toHaveBeenCalledTimes(1);
      previous = next;
    }
    cache.dispose();
  });

  it('reads live authored coasts even when the simulation coast cache already contains the island', () => {
    const cache = new ShoreTextureCache();
    const islands = [island()];
    islandCoasts(islands[0]!);
    const before = cache.get(islands);
    const point = ISLAND_DESIGNS.calda!.coasts[0]![0]!;
    const original = point[0];
    try {
      point[0] -= 0.5;
      const after = cache.get(islands);
      expect(after).not.toBe(before);
      expect(after.texture.image.data).not.toEqual(before.texture.image.data);
    } finally {
      point[0] = original;
      cache.dispose();
    }
  });

  it('tracks in-place terrain outline edits and replacement arrays', () => {
    const cache = new ShoreTextureCache();
    const terrain: TerrainDef[] = [
      {
        id: 'bank',
        kind: 'sandbank',
        outline: [
          [0, 0],
          [8, 0],
          [0, 8],
        ],
      },
    ];
    const first = cache.get([], terrain);
    expect(cache.get([], structuredClone(terrain))).toBe(first);
    terrain[0]!.outline[0]![0]--;
    expect(cache.get([], terrain)).not.toBe(first);
    const second = cache.get([], terrain);
    terrain.push({
      id: 'reef',
      kind: 'reef',
      outline: [
        [20, 0],
        [24, 0],
        [20, 4],
      ],
    });
    expect(cache.get([], terrain)).not.toBe(second);
    cache.dispose();
  });

  it('standalone oceans own their bake and release resources once', () => {
    const ocean = new Ocean([island()], 8, false);
    const texture = vi.spyOn(ocean.mesh.material.uniforms.uShoreMap!.value, 'dispose');
    const geometry = vi.spyOn(ocean.mesh.geometry, 'dispose');
    const material = vi.spyOn(ocean.mesh.material, 'dispose');
    ocean.dispose();
    ocean.dispose();
    expect(texture).toHaveBeenCalledTimes(1);
    expect(geometry).toHaveBeenCalledTimes(1);
    expect(material).toHaveBeenCalledTimes(1);
  });
});

it('GameView quality changes reuse its cache and refresh edited map contents', () => {
  const cache = new ShoreTextureCache();
  const map = { islands: [island()], terrain: [] };
  // Exercise the real quality rebuild method without requiring a WebGL context.
  const view: GameView = Object.assign(Object.create(GameView.prototype), {
    shores: cache,
    qualityEffects: new Map(),
    // The land standing (decision 0166) is the map's, so an edit to it reaches the shores.
    world: { map, land: map },
    wake: { setQuality: vi.fn() },
    boat: { setLowDetail: vi.fn() },
    scene: new THREE.Scene(),
    sun: new THREE.DirectionalLight(),
    renderer: { shadowMap: { enabled: false }, dispose: vi.fn() },
    resize: vi.fn(),
  });
  const water = () => (view as unknown as { ocean: Ocean }).ocean;
  view.setQuality('low');
  const low = water();
  const effects = (
    view as unknown as {
      qualityEffects: Map<
        string,
        { ocean: Ocean; streaks: { dispose(): void }; rain: { dispose(): void } }
      >;
    }
  ).qualityEffects;
  const first = water().mesh.material.uniforms.uShoreMap!.value;
  const dispose = vi.spyOn(first, 'dispose');
  map.islands = structuredClone(map.islands);
  view.setQuality('medium');
  const medium = water();
  expect(water().mesh.material.uniforms.uShoreMap!.value).toBe(first);
  view.setQuality('high');
  const high = water();
  expect(high.mesh.material).toBe(medium.mesh.material);
  expect(low.mesh.material === high.mesh.material).toBe(false);
  expect(water().mesh.material.uniforms.uShoreMap!.value).toBe(first);
  expect(dispose).not.toHaveBeenCalled();
  const lowDisposed = vi.spyOn(low, 'dispose');
  const material = new THREE.MeshStandardMaterial();
  const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const mesh2 = new THREE.Mesh(mesh1.geometry, material);
  const scene = (view as unknown as { scene: THREE.Scene }).scene;
  scene.add(mesh1, mesh2);
  const version = material.version;
  view.setQuality('low');
  expect(material.version).toBe(version); // Three tracks shadow-light changes itself.
  expect(water()).toBe(low);
  view.setQuality('medium');
  expect(water()).toBe(medium);
  view.setQuality('high');
  expect(water()).toBe(high);
  expect(lowDisposed).not.toHaveBeenCalled();
  expect(effects.size).toBe(Object.keys(QUALITY).length);
  // Edit while High is active, then request the same level: all inactive oceans rebind too.
  map.islands[0]!.x++;
  view.setQuality('high');
  for (const effect of effects.values()) {
    expect(effect.ocean.mesh.material.uniforms.uShoreMap!.value === first).toBe(false);
  }
  view.setQuality('low');
  expect(water().mesh.material.uniforms.uShoreMap!.value === first).toBe(false);
  expect(dispose).toHaveBeenCalledTimes(1);
  const resourceDisposals = [...effects.values()].flatMap((effect) => [
    vi.spyOn(effect.ocean.mesh.geometry, 'dispose'),
    vi.spyOn(effect.ocean.mesh.material, 'dispose'),
    vi.spyOn(effect.streaks, 'dispose'),
    vi.spyOn(effect.rain, 'dispose'),
  ]);
  for (const key of [
    'islands',
    'lighthouseBeams',
    'beaconLights',
    'stormClouds',
    'volcanoes',
    'lanterns',
    'wake',
    'debris',
    'buoy',
    'edgeBuoys',
    'seaMarks',
    'questMarkers',
    'boat',
    'bergs',
  ]) {
    Object.assign(view, { [key]: { dispose: vi.fn() } });
  }
  view.dispose();
  expect(effects.size).toBe(0);
  for (const disposed of resourceDisposals) expect(disposed).toHaveBeenCalledTimes(1);
  expect(lowDisposed).toHaveBeenCalledTimes(1);
  mesh1.geometry.dispose();
  material.dispose();
}, 30_000);
