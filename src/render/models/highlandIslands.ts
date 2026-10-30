import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import type { IslandDef, MapDef } from '../../sim/map';
import { terrainSeed } from '../../sim/landmarks';
import { atLevel, designOf, designQuestIds } from '../../data/islands';
import { PROP_RECIPES } from '../../data/props';
import { islandLayout, islandPoint } from '../../sim/islandLayout';
import { ISLAND_SCALE } from '../../sim/islandUnits';
import { type Heightfield, islandHeightfield, terrainHeightfield } from '../../sim/heightfield';
import type { QualityLevel } from '../quality';
import type { TerrainLook } from '../terrainLook';
import { isGlowing, isMolten, mergeAll, vertexColorMaterial } from './geometry';
import type { Crater, IslandModel, IslandsBuilder } from './types';
import { featureGround, iceField } from './ground';
import {
  type FieldPalette,
  designPalette,
  featurePalette,
  fieldGround,
  fieldGroundTextures,
} from './fieldGround';
import {
  disposeFieldGround,
  fieldGroundMaterial,
  setFieldGroundQuality,
} from './fieldGroundShader';
import { islandParts, shownLevel } from './islandParts';
import { terrainProps } from './terrainProps';
import { type Stand, fieldStand, standHeight } from './townProps';
import { plantForest } from '../../sim/forest';
import { forestMeshes, setForestQuality } from './forest';
import { emptyClearings } from './forestPlan';
import type { TownLevel } from './towns';
import type { Parts } from './props';

/** Separate land batches keep camera and shadow culling local to each island. */
export class HighlandIslands extends THREE.Group implements IslandModel {
  private readonly land = vertexColorMaterial();
  private readonly glass = new THREE.MeshBasicMaterial({ vertexColors: true });
  /** Molten lava (decision 0171): glows like the windows, tinted orange by day. */
  private readonly lava = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly batches = new Map<string, THREE.Group>();
  /** Every volcano's crater in the scene (decision 0178), kept up as islands are rebuilt. */
  readonly craters: Crater[] = [];
  private levels: Record<string, TownLevel>;
  /** Island id → spot id → building id (decisions 0126, 0128). */
  private homeBuilt: Record<string, Record<string, string>> = {};
  /** The quests done, for props shown before or after one (decision 0130). */
  private questsDone: ReadonlySet<string> = new Set();

  /** The new look's height fields, by batch, to redraw their ground at another quality level. */
  private readonly fields = new Map<
    THREE.Group,
    { field: Heightfield; material: THREE.Material }
  >();
  private groundStep: number;
  private quality: QualityLevel;

  constructor(
    private readonly map: MapDef,
    private readonly shadows: boolean,
    levels = {} as Record<string, TownLevel>,
    /** `?look=v2` (decision 0222): the ground drawn from the shared height field. */
    private readonly look: TerrainLook = 'v1',
    quality: QualityLevel = 'high',
  ) {
    super();
    this.quality = quality;
    this.groundStep = TUNING.terrain.groundStep[quality];
    this.levels = { ...levels };
    this.userData.harbours = {};
    // Keep the model-sheet/night-lighting API: every window shares this tint material.
    this.userData.windows = this.glass;
    this.userData.lava = this.lava;
    for (const [index, island] of map.islands.entries()) {
      const group = this.buildIsland(island, index);
      this.batches.set(island.id, group);
      this.add(group);
    }
    // Collision terrain is independent of settlement growth and never rebuilt for a level-up.
    for (const feature of map.terrain ?? []) {
      // Shallows are water: ShallowsWater tints them at sea (decision 0152), nothing stands there.
      if (feature.kind === 'shallows' || feature.kind === 'bergs') continue;
      const seed = terrainSeed(map, feature);
      const field = this.look === 'v2' ? terrainHeightfield(feature, seed) : null;
      const parts =
        feature.kind === 'ice'
          ? iceField(feature, seed)
          : [...(field ? [] : featureGround(feature)), ...terrainProps(feature, seed)];
      const group = this.batch(parts);
      group.name = `terrain:${feature.id}`;
      if (field) this.addGround(group, field, featurePalette(feature));
      this.add(group);
    }
  }

  private mesh(parts: Parts, material: THREE.Material) {
    const geometry = mergeAll(parts);
    // Bounds include authored outlying props, piers and raised terrain, not just radius.
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = material === this.land && this.shadows;
    mesh.receiveShadow = material === this.land && this.shadows;
    return mesh;
  }

  private batch(parts: Parts) {
    const group = new THREE.Group();
    for (const [name, selected, material] of [
      ['terrain', parts.filter((g) => g.userData.islandTerrain), this.land],
      ['town', parts.filter((g) => !g.userData.islandTerrain && !isGlowing(g)), this.land],
      ['windows', parts.filter((g) => isGlowing(g) && !isMolten(g)), this.glass],
      ['lava', parts.filter(isMolten), this.lava],
    ] as const) {
      if (!selected.length) continue;
      const mesh = this.mesh(selected, material);
      mesh.name = name;
      group.add(mesh);
    }
    return group;
  }

  private buildIsland(island: IslandDef, index: number) {
    const port = this.map.ports.find((p) => p.islandId === island.id);
    const level = port ? this.levels[port.id] : undefined;
    const design = designOf(island);
    const field =
      this.look === 'v2' && design ? islandHeightfield(island, shownLevel(island, level)) : null;
    const stand = field ? fieldStand(island, field) : undefined;
    const clearings = field ? emptyClearings(island, design!, !!island.look?.dock) : undefined;
    const parts = islandParts(
      island,
      this.map,
      this.map.seed * 1000 + index,
      (point) => {
        if (!port) return;
        const harbours = this.userData.harbours as Record<string, { x: number; y: number }>;
        // HUD, chart and tutorial may retain both the record and individual points.
        if (harbours[port.id]) Object.assign(harbours[port.id]!, point);
        else harbours[port.id] = point;
      },
      level,
      this.homeBuilt[island.id],
      this.questsDone,
      stand,
      clearings,
    );
    this.findCraters(island.id, parts);
    this.findVents(island, port ? (level ?? 1) : 4, stand);
    const group = this.batch(parts);
    group.name = `island:${island.id}`;
    if (field) this.addGround(group, field, designPalette(design!.style));
    if (field && clearings) {
      const shown = shownLevel(island, level);
      const trees = plantForest({ island, design: design!, field, level: shown, clearings });
      if (trees.length) group.add(forestMeshes(trees, design!.style, this.land, this.quality));
    }
    return group;
  }

  /** The new look's ground of a batch, drawn from its height field at the quality's detail. */
  private addGround(group: THREE.Group, field: Heightfield, palette: FieldPalette) {
    // The colours live in a texture at the field's own grid: built once, whatever the quality.
    const material = fieldGroundMaterial(fieldGroundTextures(field, palette), this.quality);
    this.fields.set(group, { field, material });
    this.addGroundMesh(group, field, material);
  }

  private addGroundMesh(group: THREE.Group, field: Heightfield, material: THREE.Material) {
    const geometry = fieldGround(field, this.groundStep);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = this.shadows;
    mesh.name = 'ground';
    group.add(mesh);
  }

  /** Redraw the new look's ground at a quality level's detail; the field itself never changes. */
  setQuality(level: QualityLevel) {
    this.quality = level;
    for (const group of this.batches.values()) {
      const forest = group.getObjectByName('forest');
      if (forest) setForestQuality(forest, level);
    }
    for (const { material } of this.fields.values()) setFieldGroundQuality(material, level);
    const step = TUNING.terrain.groundStep[level];
    if (step === this.groundStep) return;
    this.groundStep = step;
    for (const [group, { field, material }] of this.fields) {
      const old = group.getObjectByName('ground') as THREE.Mesh;
      old.geometry.dispose();
      group.remove(old);
      this.addGroundMesh(group, field, material);
    }
  }

  /** Where each crater's pool sits in the scene, for the volcano smoke (decision 0178). */
  private findCraters(islandId: string, parts: Parts) {
    const craters = this.craters.filter((c) => c.island !== islandId);
    const box = new THREE.Box3();
    for (const g of parts) {
      if (!g.userData.crater) continue;
      g.computeBoundingBox();
      box.copy(g.boundingBox!);
      craters.push({
        island: islandId,
        x: (box.min.x + box.max.x) / 2,
        y: box.max.y,
        z: (box.min.z + box.max.z) / 2,
        r: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
        slope: (g.userData.crater as { slope: number }).slope,
      });
    }
    this.craters.splice(0, this.craters.length, ...craters);
  }

  /** The steam vent props of an island's file at its town level (decision 0181): small plumes. */
  private findVents(island: IslandDef, level: TownLevel, stand?: Stand) {
    const design = designOf(island);
    const R = island.radius / ISLAND_SCALE;
    const vents: Crater[] = [];
    for (const prop of design?.props ?? []) {
      const vent = PROP_RECIPES[prop.type]?.vent;
      if (!vent || !atLevel(prop, level)) continue;
      const p = islandPoint(island, prop.x, prop.z);
      const ground =
        prop.y !== undefined
          ? prop.y * R
          : (stand?.(prop.x, prop.z) ??
            standHeight(islandLayout(design!, level), prop.x, prop.z, R));
      const size = prop.size ?? 1;
      vents.push({
        island: island.id,
        x: p.x,
        y: (ground + vent.y * size) * ISLAND_SCALE,
        z: -p.y,
        r: 0.4 * size,
        slope: 0,
        vent: true,
      });
    }
    const others = this.craters.filter((c) => !(c.vent && c.island === island.id));
    this.craters.splice(0, this.craters.length, ...others, ...vents);
  }

  setSettlementLevels(levels: Record<string, TownLevel>) {
    const previous = this.levels;
    this.levels = { ...levels };
    for (const [index, island] of this.map.islands.entries()) {
      const port = this.map.ports.find((p) => p.islandId === island.id);
      if (!port || previous[port.id] === levels[port.id]) continue;
      const old = this.batches.get(island.id)!;
      const next = this.buildIsland(island, index);
      const oldTerrain = old.getObjectByName('terrain') as THREE.Mesh | undefined;
      const newTerrain = next.getObjectByName('terrain') as THREE.Mesh | undefined;
      // Most designed terrain is permanent; level-dependent authored quarry benches are not.
      if (oldTerrain && newTerrain && sameGeometry(oldTerrain.geometry, newTerrain.geometry)) {
        newTerrain.geometry.dispose();
        next.remove(newTerrain);
        old.remove(oldTerrain);
        next.add(oldTerrain);
      }
      this.replace(island, old, next);
    }
  }

  /** Redraw the islands whose buildings changed (decisions 0126, 0128). */
  setHomeBuildings(byIsland: Record<string, Record<string, string>>) {
    const previous = this.homeBuilt;
    this.homeBuilt = structuredClone(byIsland);
    for (const [index, island] of this.map.islands.entries()) {
      const was = JSON.stringify(previous[island.id] ?? {});
      if (was === JSON.stringify(byIsland[island.id] ?? {})) continue;
      this.rebuild(island, index);
    }
  }

  /** Redraw the islands whose props depend on a quest that has just been done or undone (0130). */
  setQuestsDone(done: ReadonlySet<string>) {
    const previous = this.questsDone;
    this.questsDone = new Set(done);
    for (const [index, island] of this.map.islands.entries()) {
      const design = designOf(island);
      const quests = new Set(design ? designQuestIds(design) : []);
      if (![...quests].some((q) => previous.has(q) !== done.has(q))) continue;
      this.rebuild(island, index);
    }
  }

  setLandOut(out: ReadonlySet<string>) {
    for (const child of this.children) {
      const id = /^(?:island|terrain):(.+)$/.exec(child.name)?.[1];
      if (id !== undefined) child.visible = !out.has(id);
    }
  }

  private rebuild(island: IslandDef, index: number) {
    this.replace(island, this.batches.get(island.id)!, this.buildIsland(island, index));
  }

  private replace(island: IslandDef, old: THREE.Group, next: THREE.Group) {
    next.visible = old.visible;
    this.remove(old);
    disposeGeometry(old);
    this.disposeGround(old);
    this.batches.set(island.id, next);
    this.add(next);
  }

  dispose() {
    disposeGeometry(this);
    this.land.dispose();
    this.glass.dispose();
    this.lava.dispose();
    for (const group of [...this.fields.keys()]) this.disposeGround(group);
    this.clear();
    this.batches.clear();
  }

  /** A batch's new-look ground material and its textures. */
  private disposeGround(group: THREE.Group) {
    const material = this.fields.get(group)?.material;
    if (material) disposeFieldGround(material);
    this.fields.delete(group);
  }
}

function disposeGeometry(root: THREE.Object3D) {
  root.traverse((object) => {
    // A forest's tree models are shared by every island: only its own instances go.
    if (object instanceof THREE.InstancedMesh) object.dispose();
    else if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}

/** Compare all vertex attributes: unchanged land retains its already-uploaded GPU geometry. */
function sameGeometry(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const names = Object.keys(a.attributes);
  return (
    names.length === Object.keys(b.attributes).length &&
    names.every((name) => {
      const first = a.attributes[name]!,
        second = b.attributes[name];
      return (
        second &&
        first.itemSize === second.itemSize &&
        first.array.length === second.array.length &&
        first.array.every((value, i) => value === second.array[i])
      );
    })
  );
}

export const buildHighlandIslands: IslandsBuilder = (map, { shadows, levels, look, quality }) =>
  new HighlandIslands(map, shadows, levels, look, quality);
