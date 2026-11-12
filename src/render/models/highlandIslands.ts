import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import type { IslandDef, MapDef } from '../../sim/map';
import { terrainSeed } from '../../sim/landmarks';
import { designOf, designQuestIds } from '../../data/islands';
import { type Heightfield, islandHeightfieldSteps } from '../../sim/heightfield';
import { terrainHeightfield } from '../../sim/terrainField';
import { QUALITY, type QualityLevel } from '../quality';
import { setGroundCover } from './fieldGroundCover';
import { houseLod, setRichHouses } from './houseDetail';
import type { TerrainLook } from '../terrainLook';
import { isGlowing, isMolten, mergeAll, vertexColorMaterial } from './geometry';
import type { Crater, IslandModel, IslandsBuilder } from './types';
import { featureGround, iceField } from './ground';
import {
  type FieldGroundTextures,
  designPalette,
  featurePalette,
  fieldGround,
  fieldGroundTextures,
  fieldGroundTexturesSteps,
} from './fieldGround';
import {
  disposeFieldGround,
  fieldGroundMaterial,
  setFieldGroundQuality,
} from './fieldGroundShader';
import { islandPartsSteps, shownLevel } from './islandParts';
import { terrainProps } from './terrainProps';
import { fieldStand } from './townProps';
import { plantForest } from '../../sim/forest';
import { forestMeshes, setForestQuality } from './forest';
import { emptyClearings } from './forestPlan';
import type { TownLevel } from './towns';
import type { Parts } from './props';
import { islandVents, partCraters } from './islandCraters';
import { type Steps, finish } from '../../sim/steps';
import { FrameJobs } from '../frameJobs';

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
  /** Islands rebuilt a few steps a frame (issue #516); `update` runs them. */
  private readonly jobs = new FrameJobs();
  /** Called when a rebuild run by `update` has put its island in the scene. */
  onRebuilt?: () => void;

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
    setGroundCover({ quality });
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
      if (field) this.addGround(group, field, fieldGroundTextures(field, featurePalette(feature)));
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
      [
        'town',
        parts.filter((g) => !g.userData.islandTerrain && !isGlowing(g) && !g.userData.house),
        this.land,
      ],
      ['windows', parts.filter((g) => isGlowing(g) && !isMolten(g)), this.glass],
      ['lava', parts.filter(isMolten), this.lava],
    ] as const) {
      if (!selected.length) continue;
      const mesh = this.mesh(selected, material);
      mesh.name = name;
      group.add(mesh);
    }
    const [plain, rich] = (['plain', 'rich'] as const).map((kind) =>
      parts.filter((g) => g.userData.house === kind),
    );
    if (rich?.length)
      group.add(
        houseLod(
          this.mesh(plain!, this.land),
          this.mesh(rich, this.land),
          QUALITY[this.quality].richHouses,
        ),
      );
    return group;
  }

  private buildIsland(island: IslandDef, index: number) {
    return finish(this.buildIslandSteps(island, index));
  }

  /** One island's batch, in steps; it joins the model's ground and craters at its last step. */
  private *buildIslandSteps(island: IslandDef, index: number): Steps<THREE.Group> {
    const port = this.map.ports.find((p) => p.islandId === island.id);
    const level = port ? this.levels[port.id] : undefined;
    const design = designOf(island);
    const shown = shownLevel(island, level);
    const field =
      this.look === 'v2' && design ? yield* islandHeightfieldSteps(island, shown) : null;
    yield;
    const stand = field ? fieldStand(island, field) : undefined;
    const clearings = field ? emptyClearings(island, design!, !!island.look?.dock) : undefined;
    const parts = yield* islandPartsSteps(
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
    yield;
    // The colours live in a texture at the field's own grid: built once, whatever the quality.
    const textures = field
      ? yield* fieldGroundTexturesSteps(field, designPalette(design!.style))
      : null;
    yield;
    const trees =
      field && clearings
        ? plantForest({ island, design: design!, field, level: shown, clearings })
        : [];
    yield;
    const group = this.batch(parts);
    group.name = `island:${island.id}`;
    yield;
    if (trees.length) group.add(forestMeshes(trees, design!.style, this.land, this.quality));
    yield;
    // The last step joins the model: its craters, and its ground for the quality changes.
    const others = this.craters.filter((c) => c.island !== island.id);
    const own = [
      ...partCraters(island.id, parts),
      ...islandVents(island, port ? (level ?? 1) : 4, stand),
    ];
    this.craters.splice(0, this.craters.length, ...others, ...own);
    if (field && textures) this.addGround(group, field, textures);
    return group;
  }

  /** The new look's ground of a batch, drawn from its height field at the quality's detail. */
  private addGround(group: THREE.Group, field: Heightfield, textures: FieldGroundTextures) {
    const material = fieldGroundMaterial(textures, this.quality);
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

  /** An island's rich houses and woods at the current quality level. */
  private showQuality(group: THREE.Group) {
    const houses = group.getObjectByName('houses');
    if (houses) setRichHouses(houses as THREE.LOD, QUALITY[this.quality].richHouses);
    const forest = group.getObjectByName('forest');
    if (forest) setForestQuality(forest, this.quality);
  }

  /** The ground at a level's detail (its field never changes); `spread`: a batch a step (#516). */
  setQuality(level: QualityLevel, spread = false) {
    this.quality = level;
    setGroundCover({ quality: level });
    for (const group of this.batches.values()) this.showQuality(group);
    for (const { material } of this.fields.values()) setFieldGroundQuality(material, level);
    const step = TUNING.terrain.groundStep[level];
    if (step === this.groundStep) return;
    this.groundStep = step;
    if (spread) this.jobs.add('ground', this.redrawGround());
    else {
      this.jobs.cancel('ground');
      finish(this.redrawGround());
    }
  }

  /** Every batch's ground mesh at the current detail, a batch a step. */
  private *redrawGround(): Steps<void> {
    for (const [group, { field, material }] of [...this.fields]) {
      // Rebuilt or gone since: its ground is already drawn at this detail, or needs none.
      if (!this.fields.has(group)) continue;
      const old = group.getObjectByName('ground') as THREE.Mesh;
      old.geometry.dispose();
      group.remove(old);
      this.addGroundMesh(group, field, material);
      yield;
    }
  }

  /**
   * Redraw the towns whose level changed. With `spread` (a town growing in play) each island is
   * rebuilt a few steps a frame by `update` and swapped in when done; else at once.
   */
  setSettlementLevels(levels: Record<string, TownLevel>, spread = false) {
    const previous = this.levels;
    this.levels = { ...levels };
    this.redraw(spread, (island) => {
      const port = this.map.ports.find((p) => p.islandId === island.id);
      return !!port && previous[port.id] !== levels[port.id];
    });
  }

  /** Runs the waiting rebuilds for up to `budgetMs` (issue #516). */
  update(budgetMs: number) {
    this.jobs.run(budgetMs);
  }

  /** Finishes every waiting rebuild now. */
  finishBuilds() {
    this.jobs.finishAll();
  }

  get building(): boolean {
    return this.jobs.busy;
  }

  /** Redraw the islands whose buildings changed (decisions 0126, 0128). */
  setHomeBuildings(byIsland: Record<string, Record<string, string>>, spread = false) {
    const previous = this.homeBuilt;
    this.homeBuilt = structuredClone(byIsland);
    const looks = (built: Record<string, Record<string, string>>, id: string) =>
      JSON.stringify(built[id] ?? {});
    this.redraw(spread, ({ id }) => looks(previous, id) !== looks(byIsland, id));
  }

  /** Redraw the islands whose props depend on a quest that has just been done or undone (0130). */
  setQuestsDone(done: ReadonlySet<string>, spread = false) {
    const previous = this.questsDone;
    this.questsDone = new Set(done);
    this.redraw(spread, (island) => {
      const design = designOf(island);
      return (design ? designQuestIds(design) : []).some((q) => previous.has(q) !== done.has(q));
    });
  }

  setLandOut(out: ReadonlySet<string>) {
    for (const child of this.children) {
      const id = /^(?:island|terrain):(.+)$/.exec(child.name)?.[1];
      if (id !== undefined) child.visible = !out.has(id);
    }
  }

  /** Rebuilds the islands `changed` picks: a few steps a frame with `spread`, else at once. */
  private redraw(spread: boolean, changed: (island: IslandDef) => boolean) {
    for (const [index, island] of this.map.islands.entries()) {
      if (!changed(island)) continue;
      if (spread) this.jobs.add(island.id, this.rebuildSteps(island, index, true));
      else {
        this.jobs.cancel(island.id);
        finish(this.rebuildSteps(island, index, false));
      }
    }
  }

  /** Builds the island again and swaps it in, keeping its terrain mesh when that is unchanged. */
  private *rebuildSteps(island: IslandDef, index: number, spread: boolean): Steps<void> {
    const next = yield* this.buildIslandSteps(island, index);
    const old = this.batches.get(island.id)!;
    const oldTerrain = old.getObjectByName('terrain') as THREE.Mesh | undefined;
    const newTerrain = next.getObjectByName('terrain') as THREE.Mesh | undefined;
    // Most designed terrain is permanent; level-dependent authored quarry benches are not.
    if (oldTerrain && newTerrain && sameGeometry(oldTerrain.geometry, newTerrain.geometry)) {
      newTerrain.geometry.dispose();
      next.remove(newTerrain);
      old.remove(oldTerrain);
      next.add(oldTerrain);
    }
    // A quality change while it was building: its houses and woods follow the level now.
    this.showQuality(next);
    this.replace(island, old, next);
    if (spread) this.onRebuilt?.();
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
