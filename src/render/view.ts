import * as THREE from 'three';
import { trueWindAngle } from '../sim/boat';
import { noGoAngle } from '../sim/ship';
import { DEG, approach, bearingVector, clamp, wrapAngle } from '../sim/math';
import { windTo } from '../sim/wind';
import { windStrength01 } from '../sim/windStrength';
import { type World, currentWaypoint } from '../sim/world';
import { townLevels } from '../sim/founding';
import { TUNING } from '../data/tuning';
import {
  type IslandModel,
  type BoatModel,
  type ShipUpgrades,
  type TownLevel,
  type UpgradeLevel,
  buildIslands,
  createBoatModel,
} from './models';
import { HEEL_FEEL, Heel, heelFactor } from './heel';
import { Ocean, ShoreTextureCache, waveHeight } from './ocean';
import { CalmWater } from './calmWater';
import { RoughWater } from './roughWater';
import { CurrentWater } from './currentWater';
import { ShallowsWater } from './shallowsWater';
import { PALETTE } from './palette';
import { BuoyMarker, EdgeBuoys, createBlobShadow } from './props';
import { renderPixelRatio, QUALITY, type QualityLevel, type QualityProfile } from './quality';
import { Wake } from './wake';
import { WindStreaks } from './windStreaks';
import { Rain, rainMayReachArea } from './rain';
import { Atmosphere, LAVA_BY_DAY, WINDOWS_AT_NIGHT, WINDOWS_BY_DAY } from './atmosphere';
import { LighthouseBeams } from './lighthouseBeams';
import { BeaconLights } from './beaconLights';
import { Lanterns } from './lanterns';
import { Castaway } from './castaway';
import { SeaMarks } from './seaMarks';
import { DriftingBergs } from './driftingBergs';
import type { SeaMarkDef } from '../sim/map';
import { QuestMarkers } from './questMarkers';
import type { StepMarker } from '../ui/questView';
import { daylightAt } from '../sim/daylight';
import { StormClouds } from './stormClouds';
import { Volcanoes } from './volcanoes';
import { stormRain } from '../sim/storms';
import { seaShape } from '../sim/seaEdge';
import { CLEAR, type ZoneVisual, mapZones, zoneField, zoneVisualAt } from '../sim/windZones';
import { smoothOutline } from '../sim/flowShapes';
import { designOf } from '../data/islands';
import {
  HARBOUR_VIEW,
  type HarbourLight,
  harbourLight,
  harbourLightTime,
  harbourPictureKey,
  harbourShot,
} from './harbourView';

/** Game time whose light is kept when day and night is off: early afternoon. */
const ALWAYS_DAY = 200;
const CAMERA_PITCH = 58 * DEG;
const BASE_DISTANCE = 110;

/** Sim (x east, y north) → three.js scene (x, 0, -y). */
function toScene(x: number, y: number, out = new THREE.Vector3()) {
  return out.set(x, 0, -y);
}

export interface ScreenPoint {
  /** Pixels from the top-left of the canvas. */
  x: number;
  y: number;
  onScreen: boolean;
}

/**
 * Everything three.js. Reads the World each frame and never writes to it (decision 0005).
 */
export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 1, 600);
  private readonly sun = new THREE.DirectionalLight(PALETTE.sun, 1.7);
  private readonly hemi = new THREE.HemisphereLight(PALETTE.sky, '#1a4d55', 1.5);
  /** Time of day and weather light (decisions 0067 and 0068). */
  private readonly atmosphere = new Atmosphere(this.scene, this.sun, this.hemi);
  private lanterns!: Lanterns;
  /** Day and night cycle on (decision 0068); off holds early afternoon. */
  dayNight = true;
  /** Someone waits on the prologue's wreck (decision 0127). */
  castawayWaiting = false;
  private readonly castaway: Castaway;
  /** Buoys and boats at sea, some only before or after a quest (decision 0130). */
  private readonly seaMarks: SeaMarks;
  private readonly bergs: DriftingBergs;
  /** The tracked quest step's places at sea (decision 0130). */
  private readonly questMarkers = new QuestMarkers();
  /** What the tracked step marks at sea; the game sets it once the quests run. */
  stepMarkers: () => { style: string; points: readonly StepMarker[] } | null = () => null;
  /** The running quests' own sea marks (decision 0164: the lessons' buoys). */
  questMarks: () => readonly SeaMarkDef[] = () => [];
  private readonly boatLantern = new THREE.Vector3();
  private readonly stormClouds = new StormClouds();
  /** Smoke over every crater, and eruptions (decision 0178). */
  private readonly volcanoes: Volcanoes;
  /** The Eruptions switch (Settings, decision 0178): off, volcanoes only smoke. */
  eruptions = true;
  private rain!: Rain;
  private islands: IslandModel;
  /** Town levels the islands were built at, 0 for a site not founded yet (decision 0157). */
  private levels: Record<string, TownLevel> = {};
  private boat: BoatModel;
  /** Ship class and upgrade levels the boat model was built for; rebuilt when they change. */
  private boatKey = '';
  private level: QualityLevel;
  private readonly heel = new Heel();
  /** How readily the current class leans (decision 0044). */
  private heelFactor = 1;
  private readonly boatShadow = createBlobShadow(6.5, 14);
  private readonly wake = new Wake();
  private readonly buoy = new BuoyMarker();
  private readonly lighthouseBeams: LighthouseBeams;
  private readonly beaconLights: BeaconLights;
  private readonly edgeBuoys: EdgeBuoys;
  private ocean!: Ocean;
  /** Darker current water with drifting crests (decision 0140). */
  private currentWater?: CurrentWater;
  private calmWater?: CalmWater;
  private roughWater?: RoughWater;
  private shallowsWater?: ShallowsWater;
  private readonly shores = new ShoreTextureCache();
  private streaks!: WindStreaks;
  private profile!: QualityProfile;
  /** Created only when selected; retain GPU programs/buffers for subsequent switches. */
  private readonly qualityEffects = new Map<
    QualityLevel,
    {
      ocean: Ocean;
      streaks: WindStreaks;
      rain: Rain;
    }
  >();
  private readonly target = new THREE.Vector3();
  /** A point the camera looks at instead of ahead of the boat (the home island, 0126). */
  private focus: { x: number; y: number } | null = null;
  private readonly tmp = new THREE.Vector3();
  /** The fog bank or ash cloud at the camera's target (decision 0169). */
  private readonly haze: ZoneVisual = { ...CLEAR };
  /** The veil over the screen inside a haze, its opacity and colour as last set. */
  private readonly veil: HTMLElement | null;
  private veilOpacity = -1;
  private veilColor = '';
  private zoom = 1;
  private width = 1;
  private height = 1;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly world: World,
    level: QualityLevel,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: level === 'high',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.veil = canvas.parentElement?.querySelector<HTMLElement>('#haze-veil') ?? null;
    this.scene.background = new THREE.Color(PALETTE.deepWater);
    this.scene.fog = new THREE.Fog(PALETTE.deepWater, 120, 220);
    this.scene.add(this.hemi);
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -70,
      right: 70,
      top: 70,
      bottom: -70,
      near: 1,
      far: 160,
    });
    this.scene.add(this.sun, this.sun.target);

    this.levels = townLevels(world.map, world.trade);
    this.islands = buildIslands(world.map, { shadows: true, levels: this.levels });
    this.lighthouseBeams = new LighthouseBeams(world.map.islands, this.islandLevels(this.levels));
    this.scene.add(this.lighthouseBeams.root);
    this.beaconLights = new BeaconLights(world.map.islands, this.islandLevels(this.levels));
    this.scene.add(this.beaconLights.points);
    this.volcanoes = new Volcanoes(this.islands.craters);
    this.level = level;
    this.boat = this.buildBoat();
    this.edgeBuoys = new EdgeBuoys(seaShape(world.map));
    this.castaway = new Castaway(world.map);
    this.seaMarks = new SeaMarks(world.map);
    this.bergs = new DriftingBergs(world.map);
    this.scene.add(
      this.bergs.root,
      this.castaway.root,
      this.seaMarks.root,
      this.questMarkers.root,
      this.islands,
      this.boat.root,
      this.boatShadow,
      this.wake.mesh,
      this.buoy.root,
      this.edgeBuoys.mesh,
      this.stormClouds.root,
      this.volcanoes.root,
    );

    toScene(world.boat.x, world.boat.y, this.target);
    this.buildLanterns();
    this.setQuality(level);
    this.currentWater = new CurrentWater(
      world.map.currents ?? [],
      this.shores.get(world.land.islands, world.land.terrain),
    );
    this.scene.add(this.currentWater.root);
    this.calmWater = new CalmWater(
      world.map.windZones ?? [],
      this.shores.get(world.land.islands, world.land.terrain),
    );
    this.scene.add(this.calmWater.root);
    this.roughWater = new RoughWater(
      world.map.windZones ?? [],
      this.shores.get(world.map.islands, world.map.terrain),
    );
    this.scene.add(this.roughWater.root);
    this.shallowsWater = new ShallowsWater(world.map.terrain);
    this.scene.add(this.shallowsWater.root);
    this.followLand();
  }

  /** The land version the scene shows (decision 0166). */
  private landVersion = -1;
  /**
   * Shows the islands and shapes standing now and hides those a quest has not raised yet or has
   * cleared (decision 0166). The sim swaps them only out of sight, so nothing pops in view.
   */
  private followLand() {
    const { land } = this.world;
    if (land.version === this.landVersion) return;
    const first = this.landVersion < 0;
    this.landVersion = land.version;
    if (first && !land.out.size) return;
    this.islands.setLandOut(land.out);
    this.lighthouseBeams.setLandOut(land.out);
    this.beaconLights.setLandOut(land.out);
    this.shallowsWater?.setLandOut(land.out);
    if (!first) {
      // The shore foam and tint around the land, and the harbour lanterns, follow it.
      this.setQuality(this.level);
      this.buildLanterns();
    }
  }

  /** Harbour lanterns (decision 0068): one on each pier head and a town glow a little inland. */
  private buildLanterns() {
    if (this.lanterns) {
      this.scene.remove(this.lanterns.points);
      this.lanterns.dispose();
    }
    const spots: THREE.Vector3[] = [];
    for (const port of this.world.map.ports) {
      // No light on an empty island not founded yet (decision 0157).
      if (this.levels[port.id] === 0) continue;
      const pier = this.harbours[port.id];
      const island = this.world.land.islands.find((i) => i.id === port.islandId);
      if (!pier || !island) continue;
      spots.push(toScene(pier.x, pier.y, new THREE.Vector3()).setY(4));
      const town = toScene(
        pier.x + (island.x - pier.x) * 0.35,
        pier.y + (island.y - pier.y) * 0.35,
        new THREE.Vector3(),
      );
      spots.push(town.setY(7));
    }
    this.lanterns = new Lanterns(spots);
    this.scene.add(this.lanterns.points);
  }

  /** Anchors exported while building the mesh; no duplicated generation or extra draw calls. */
  get harbours(): Record<string, { x: number; y: number }> {
    return this.islands.userData.harbours ?? {};
  }

  /** Class and upgrade levels of the ship being sailed, and a key that changes with them. */
  private activeBoat() {
    const { captain } = this.world.trade;
    const lv = captain.ships[captain.activeShip];
    const level = (n: number | undefined) => clamp(Math.round(n ?? 1), 1, 3) as UpgradeLevel;
    const upgrades: ShipUpgrades = {
      sails: level(lv?.sails),
      hold: level(lv?.hold),
      hull: level(lv?.hull),
    };
    const id = captain.activeShip;
    return { id, upgrades, key: `${id}:${upgrades.sails}${upgrades.hold}${upgrades.hull}` };
  }

  /** The model for the ship being sailed, with its upgrade levels visible (decision 0016). */
  private buildBoat(): BoatModel {
    const { id, upgrades, key } = this.activeBoat();
    this.boatKey = key;
    this.heelFactor = heelFactor(id);
    // Quality is a live toggle, not a permanent factory opt-out: Low → Medium must restore ropes.
    const boat = createBoatModel(id, { upgrades });
    boat.setLowDetail?.(this.level === 'low');
    boat.root.rotation.order = 'YXZ';
    return boat;
  }

  /** Rebuild the boat after a shipyard purchase or a ship change. */
  private refreshBoat() {
    if (this.activeBoat().key === this.boatKey) return;
    this.scene.remove(this.boat.root);
    this.boat.dispose();
    this.boat = this.buildBoat();
    this.wake.reset();
    this.scene.add(this.boat.root);
  }

  setQuality(level: QualityLevel) {
    this.level = level;
    this.wake.setQuality(level);
    const profile = QUALITY[level];
    if (this.ocean) this.scene.remove(this.ocean.mesh, this.streaks.mesh, this.rain.mesh);
    const shore = this.shores.get(this.world.land.islands, this.world.land.terrain);
    // ShoreTextureCache releases its previous bake on a live map edit. Rebind inactive
    // quality levels too, so returning to one never revives a disposed texture.
    for (const effects of this.qualityEffects.values()) effects.ocean.setShore(shore);
    this.currentWater?.setShore(shore);
    this.calmWater?.setShore(shore);
    this.roughWater?.setShore(shore);
    let effects = this.qualityEffects.get(level);
    if (!effects) {
      // Ocean shader source depends on fancyWater, not the grid resolution. Share the
      // existing material so High/Medium never release or relink the same program.
      const waterMaterial = [...this.qualityEffects.values()].find(
        (cached) => 'FANCY' in cached.ocean.mesh.material.defines === profile.fancyWater,
      )?.ocean.mesh.material;
      effects = {
        ocean: new Ocean(
          this.world.land.islands,
          profile.oceanSegments,
          profile.fancyWater,
          480,
          this.world.land.terrain,
          shore,
          waterMaterial,
        ),
        streaks: new WindStreaks(profile.windStreaks),
        rain: new Rain(profile.rainDrops),
      };
      this.qualityEffects.set(level, effects);
    }
    ({ ocean: this.ocean, streaks: this.streaks, rain: this.rain } = effects);
    this.scene.add(this.ocean.mesh, this.streaks.mesh, this.rain.mesh);

    if (this.profile?.shadows !== profile.shadows) {
      this.renderer.shadowMap.enabled = profile.shadows;
      this.sun.castShadow = profile.shadows;
      // Three tracks the changed shadow-light count and refreshes lit materials.
      // Forcing every unlit/custom material dirty creates unused shadow variants,
      // including an expensive water program whose shader never samples shadows.
    }
    this.boat.setLowDetail?.(level === 'low');
    this.profile = profile;
    this.resize(this.width, this.height);
  }

  /** Extra drawing-resolution factor, a `?perf` test aid only (decision 0148); 1 = normal. */
  renderScale = 1;

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(
      renderPixelRatio(width, height, window.devicePixelRatio || 1, this.profile) *
        this.renderScale,
    );
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** Grow only the islands whose port levels changed; anchors and harbour lights stay valid. */
  /** Look at a map point (moored at home: the island and its spots), or follow the boat (null). */
  setFocus(point: { x: number; y: number } | null, jump = false) {
    this.focus = point ? { ...point } : null;
    // At once, without the camera's easing (the screenshot tool's --look).
    if (point && jump) {
      this.target.x = point.x;
      this.target.z = -point.y;
    }
  }

  setHomeBuildings(byIsland: Record<string, Record<string, string>>) {
    this.townVersion++;
    this.islands.setHomeBuildings(byIsland);
    this.volcanoes.setCraters(this.islands.craters);
  }

  /** What stands before or after a quest (decision 0130): island props, sea marks, lights. */
  /** The camera over the boat at once, after a quest took her somewhere (decision 0164). */
  jumpToBoat() {
    const pos = toScene(this.world.boat.x, this.world.boat.y, this.tmp);
    this.target.x = pos.x;
    this.target.z = pos.z;
  }

  setQuestsDone(done: ReadonlySet<string>) {
    this.townVersion++;
    this.islands.setQuestsDone(done);
    this.volcanoes.setCraters(this.islands.craters);
    this.seaMarks.setQuestsDone(done);
    this.lighthouseBeams.setQuestsDone(done);
    this.beaconLights.setQuestsDone(done);
  }

  setSettlementLevels(levels: Record<string, TownLevel>) {
    const founded = Object.keys(levels).some((id) => this.levels[id] === 0 && levels[id] !== 0);
    this.levels = { ...levels };
    this.townVersion++;
    this.islands.setSettlementLevels(levels);
    this.volcanoes.setCraters(this.islands.craters);
    if (founded) this.buildLanterns();
    this.lighthouseBeams.setLevels(this.islandLevels(levels));
    this.beaconLights.setLevels(this.islandLevels(levels));
  }

  /** Town levels by port id, keyed by the port's island instead. */
  private islandLevels(levels: Record<string, TownLevel>) {
    const out: Record<string, TownLevel> = {};
    for (const port of this.world.map.ports)
      if (levels[port.id] !== undefined) out[port.islandId] = levels[port.id]!;
    return out;
  }

  /**
   * The veil over the screen (decision 0169): clear round the boat, the haze's colour toward the
   * edges. Touched only when its opacity or colour changes, so open sea costs nothing.
   */
  private updateVeil(haze: ZoneVisual) {
    if (!this.veil) return;
    const opacity = haze.kind ? Math.round(haze.haze * 50) / 50 : 0;
    if (opacity !== this.veilOpacity) {
      this.veilOpacity = opacity;
      this.veil.style.opacity = String(opacity);
    }
    if (opacity <= 0) return;
    const c = this.atmosphere.hazeColor;
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    // The look changes with the colour or the `?tune` panel's veil numbers.
    const key = `${rgb}|${JSON.stringify(TUNING.weather.sight)}`;
    if (key === this.veilColor) return;
    this.veilColor = key;
    const v = TUNING.weather.sight;
    this.veil.style.background =
      `radial-gradient(ellipse 70% 65% at 50% 52%, rgba(${rgb},0) ${v.veilClear * 100}%, ` +
      `rgba(${rgb},${v.veilMidAlpha}) ${v.veilMid * 100}%, rgba(${rgb},${v.veilEdgeAlpha}) 100%)`;
  }

  /**
   * A volcano erupts (decision 0178): a quest's `reward.erupt` waits for the boat to come in
   * sight; `now` starts it at once (the screenshot tool). False when the island has no crater.
   */
  erupt(island: string, now = false) {
    return this.volcanoes.erupt(island, now);
  }

  /** 1 = default; larger = farther away. */
  setZoom(zoom: number) {
    this.zoom = clamp(zoom, 0.6, 1.7);
  }

  getZoom() {
    return this.zoom;
  }

  render(dt: number) {
    this.followLand();
    const { boat, wind, ship, time } = this.world;
    this.castaway.update(this.castawayWaiting, time);
    const dir = bearingVector(boat.heading);
    const pos = toScene(boat.x, boat.y, this.tmp);

    // Camera: tilted top-down, looking a little ahead of the boat; farther out in portrait.
    const ahead = boat.speedKn * 1.6;
    const tx = this.focus ? this.focus.x : pos.x + dir.x * ahead;
    const tz = this.focus ? -this.focus.y : pos.z - dir.y * ahead;
    this.target.x = approach(this.target.x, tx, 2.5, dt);
    this.target.z = approach(this.target.z, tz, 2.5, dt);
    const aspect = this.width / this.height;
    // The field of view is vertical, so a tall phone sees a thin strip of sea: pull back until
    // portrait shows about as much water across as a landscape tablet (Guillaume, 2026-10-20).
    const dist = BASE_DISTANCE * this.zoom * (aspect < 1 ? clamp(0.85 / aspect, 1, 1.9) : 1);
    this.camera.position.set(
      this.target.x,
      Math.sin(CAMERA_PITCH) * dist,
      this.target.z + Math.cos(CAMERA_PITCH) * dist,
    );
    this.camera.lookAt(this.target);
    const fog = this.scene.fog as THREE.Fog;
    const day = daylightAt(this.dayNight ? time : ALWAYS_DAY);
    // Fog banks and ash clouds (decision 0169) are looked up where the camera looks, wind zones
    // switch or not: only their own Settings switch clears them.
    const zones = zoneField(mapZones(this.world.map), smoothOutline);
    const haze = zones
      ? zoneVisualAt(zones, this.target.x, -this.target.z, this.world.hazeOff, this.haze)
      : CLEAR;
    this.atmosphere.update(dt, day, this.world.weather, this.ocean, this.target, haze);
    const gloom = this.atmosphere.gloom;
    // Rain and the dark close in a little, never enough to hide the next island. The view range
    // is `weather.json` › `sight`, in camera distances (decision 0169).
    const sight = TUNING.weather.sight;
    fog.near = dist * (sight.near - sight.gloomNear * gloom - sight.nightNear * day.night);
    fog.far = dist * (sight.far - sight.gloomFar * gloom - sight.nightFar * day.night);
    // A haze closes in much more: its sight counts from the boat, about `dist` from the camera.
    if (haze.kind && haze.haze > 0) {
      fog.near += (Math.min(fog.near, dist + haze.kind.near) - fog.near) * haze.haze;
      fog.far += (Math.min(fog.far, dist + haze.kind.far) - fog.far) * haze.haze;
    }
    this.updateVeil(haze);
    this.ocean.setFog(fog.near, fog.far);
    // Nothing past the fog can show, so the camera stops there and three.js skips what lies beyond
    // (decision 0117). The sea at the top of the screen is about 1.3 x `dist` away, well inside
    // the nearest the fog ever gets (1.6 x), so the picture is unchanged.
    if (Math.abs(this.camera.far - fog.far) > 1) {
      this.camera.far = fog.far;
      this.camera.updateProjectionMatrix();
    }

    // Boat pose from the simulation.
    this.refreshBoat();
    const twa = trueWindAngle(boat.heading, wind);
    const abs = Math.abs(twa);
    const lee = twa > 0 ? -1 : 1;
    const boomMag = (12 + clamp((abs / DEG - 45) / 135, 0, 1) * 68) * DEG;
    const luff = 1 - clamp((abs - noGoAngle(ship) * 0.8) / (noGoAngle(ship) * 0.3), 0, 1);
    const heel = this.heel.update(
      {
        twa,
        noGoAngle: noGoAngle(ship),
        windKn: wind.speedKn,
        sail: boat.sail,
        luff,
        factor: this.heelFactor,
      },
      dt,
      HEEL_FEEL[this.level === 'low' ? 'smooth' : 'lively'],
    );
    const shake = boat.sinceBump < 0.4 ? Math.sin(time * 60) * (0.4 - boat.sinceBump) * 0.4 : 0;
    this.boat.update({
      sail: boat.sail,
      boomAngle: lee * boomMag * (1 - luff * 0.7),
      luff,
      heel: heel + shake,
      windRelative: wrapAngle(windTo(wind) - boat.heading),
      time,
    });
    const yaw = -boat.heading;
    const fx = pos.x + dir.x * 5;
    const fz = pos.z - dir.y * 5;
    const bx = pos.x - dir.x * 5;
    const bz = pos.z + dir.y * 5;
    const hFront = waveHeight(fx, fz, time);
    const hBack = waveHeight(bx, bz, time);
    this.boat.root.position.set(pos.x, (hFront + hBack) * 0.4, pos.z);
    this.boat.root.rotation.set(Math.atan2(hFront - hBack, 10) * 0.8, yaw, 0);
    this.boatShadow.position.set(pos.x + 1.8, 0.55, pos.z - 1);
    this.boatShadow.rotation.y = yaw;

    this.wake.update(dt, time, pos, dir.x, -dir.y, boat.speedKn, this.boat.wakeHull);

    const to = bearingVector(windTo(wind));
    this.streaks.update(
      dt,
      this.target,
      to.x,
      -to.y,
      wind.speedKn * TUNING.seamanship.boat.knotToUnits * 0.75,
      windStrength01(wind.speedKn),
    );
    const { weather } = this.world;
    this.stormClouds.update(weather.storms, time, this.world.boat);
    // Showers fall everywhere; a storm's downpour only under its cloud.
    const kn = wind.speedKn * TUNING.seamanship.boat.knotToUnits * 0.6;
    this.rain.update(
      dt,
      this.target,
      to.x * kn,
      -to.y * kn,
      (x, z) => {
        let r = weather.showers;
        for (const s of weather.storms) r = Math.max(r, stormRain(s, x, -z));
        return r;
      },
      rainMayReachArea(this.target, weather.showers, weather.storms),
    );
    // Masthead lantern (heels with the mast), else a lantern above the deck.
    const glow = Math.max(day.night, gloom * 0.5);
    const lantern = this.boat.lantern;
    if (lantern) {
      lantern.updateWorldMatrix(true, false);
      lantern.getWorldPosition(this.boatLantern);
    } else this.boatLantern.set(pos.x, 6, pos.z);
    this.lanterns.update(glow, this.boatLantern, time);
    this.lighthouseBeams.update(time, glow);
    this.beaconLights.update(time, glow);
    // Lit windows and street lamps in the towns.
    const windows = this.islands.userData.windows as THREE.MeshBasicMaterial | undefined;
    windows?.color.copy(WINDOWS_BY_DAY).lerp(WINDOWS_AT_NIGHT, glow);
    const lava = this.islands.userData.lava as THREE.MeshBasicMaterial | undefined;
    lava?.color.copy(LAVA_BY_DAY).lerp(WINDOWS_AT_NIGHT, glow);
    const erupting = this.volcanoes.update(dt, {
      target: this.target,
      cameraY: this.camera.position.y,
      night: day.night,
      eruptions: this.eruptions,
      out: this.world.land.out,
      windX: to.x,
      windZ: -to.y,
      windUnits: wind.speedKn * TUNING.seamanship.boat.knotToUnits,
    });
    // An eruption brightens the lava past its night glow (one shared material, decision 0178).
    lava?.color.multiplyScalar(1 + (TUNING.weather.volcano.eruptions.lavaGain - 1) * erupting);
    this.boat.setNightLighting?.(day.night);
    this.ocean.update(time, this.target);
    this.currentWater?.update(time, this.ocean, this.world.currentsOn);
    this.calmWater?.update(time, this.ocean, this.world.windZones);
    this.roughWater?.update(time, this.ocean, this.world.windZones);
    this.shallowsWater?.update(time, this.ocean);
    this.edgeBuoys.update(time, (x, z) => waveHeight(x, z, time), this.camera);
    this.seaMarks.setQuestMarks(this.questMarks());
    this.seaMarks.update(time, (x, z) => waveHeight(x, z, time));
    this.bergs.update(this.world.time, this.world.bergsOn, (x, z) => waveHeight(x, z, time));
    this.questMarkers.update(this.stepMarkers(), time, (x, z) => waveHeight(x, z, time));

    this.buoy.root.visible = Boolean(this.world.map.practiceCourse && !this.world.destination);
    if (this.buoy.root.visible) {
      const wp = currentWaypoint(this.world);
      toScene(wp.x, wp.y, this.buoy.root.position);
      this.buoy.update(
        time,
        waveHeight(wp.x, -wp.y, time),
        TUNING.seamanship.harbour.waypointRadius,
      );
    }

    this.renderer.render(this.scene, this.camera);
  }

  /** Bumped whenever a town's look may change: its pictures are taken again (decision 0211). */
  private townVersion = 0;
  private readonly pictures = new Map<string, string>();
  private picturesLook = '';
  private pictureCamera?: THREE.PerspectiveCamera;

  /**
   * The harbour screen's picture of a port (decision 0211): the real scene from a fixed camera off
   * its harbour, in the given light, with no fog, rain or storm, the sea's own tint kept. Taken once
   * and cached per port, light and town look, as a JPEG object URL; null if the port has no pier.
   */
  harbourPicture(
    portId: string,
    light: HarbourLight = harbourLight(daylightAt(this.dayNight ? this.world.time : ALWAYS_DAY)),
  ): string | null {
    const look = `${this.townVersion}/${this.landVersion}/${this.level}`;
    // A town or the land changed: every picture is old. The screen may still be loading one, so
    // they are let go a little later.
    if (this.picturesLook !== look) {
      const old = [...this.pictures.values()];
      setTimeout(() => old.forEach((url) => URL.revokeObjectURL(url)), 10_000);
      this.pictures.clear();
    }
    this.picturesLook = look;
    const key = harbourPictureKey(portId, light, look);
    const cached = this.pictures.get(key);
    if (cached) return cached;
    const port = this.world.map.ports.find((p) => p.id === portId);
    const island = port && this.world.land.islands.find((i) => i.id === port.islandId);
    const pier = this.harbours[portId];
    if (!port || !island || !pier) return null;
    const shot = harbourShot(island, pier, designOf(island)?.harbourView);
    const pic = HARBOUR_VIEW.picture;
    const w = Math.round(pic.width * pic.supersample);
    const h = Math.round(pic.height * pic.supersample);

    const camera = (this.pictureCamera ??= new THREE.PerspectiveCamera(pic.fovDeg, 1, 1, 2000));
    camera.fov = pic.fovDeg;
    camera.aspect = w / h;
    // The town sits right of the middle, clear of the name and the shade on the left.
    camera.setViewOffset(w, h, -pic.shift * w, 0, w, h);
    toScene(shot.from.x, shot.from.y, camera.position).setY(shot.fromHeight);
    const aim = toScene(shot.look.x, shot.look.y, new THREE.Vector3()).setY(shot.lookHeight);
    camera.lookAt(aim);

    // The light of that time of day, without the weather; the sea keeps its colour, not its fog.
    const time = harbourLightTime(light);
    const day = daylightAt(time);
    const zones = zoneField(mapZones(this.world.map), smoothOutline);
    const tint = zones ? zoneVisualAt(zones, aim.x, -aim.z, [], { ...CLEAR }) : { ...CLEAR };
    tint.haze = 0;
    tint.kind = null;
    const gloom = this.atmosphere.gloom;
    this.atmosphere.gloom = 0;
    this.atmosphere.update(0, day, this.world.weather, this.ocean, aim, tint);
    this.atmosphere.gloom = gloom;
    const fog = this.scene.fog as THREE.Fog;
    const { near, far } = fog;
    fog.near = 1e4;
    fog.far = 2e4;
    this.ocean.setFog(fog.near, fog.far);
    this.ocean.update(this.world.time, aim);
    const glow = day.night;
    this.lanterns.update(glow, this.boatLantern, time);
    this.lighthouseBeams.update(time, glow);
    this.beaconLights.update(time, glow);
    const windows = this.islands.userData.windows as THREE.MeshBasicMaterial | undefined;
    windows?.color.copy(WINDOWS_BY_DAY).lerp(WINDOWS_AT_NIGHT, glow);
    const lava = this.islands.userData.lava as THREE.MeshBasicMaterial | undefined;
    lava?.color.copy(LAVA_BY_DAY).lerp(WINDOWS_AT_NIGHT, glow);
    this.boat.setNightLighting?.(day.night);
    const hidden = [
      this.rain.mesh,
      this.streaks.mesh,
      this.stormClouds.root,
      this.questMarkers.root,
      this.buoy.root,
    ].filter((o) => o.visible);
    for (const o of hidden) o.visible = false;

    const target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const pixels = new Uint8Array(w * h * 4);
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, camera);
    this.renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels);
    this.renderer.setRenderTarget(null);
    target.dispose();
    for (const o of hidden) o.visible = true;
    fog.near = near;
    fog.far = far;
    this.ocean.setFog(near, far);

    // WebGL rows run bottom up; the supersampled picture is drawn down to its size, which smooths it.
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    const image = full.getContext('2d')!.createImageData(w, h);
    for (let row = 0; row < h; row++)
      image.data.set(pixels.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
    full.getContext('2d')!.putImageData(image, 0, 0);
    const out = document.createElement('canvas');
    out.width = pic.width;
    out.height = pic.height;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, pic.width, pic.height);
    // An object URL keeps the screen's markup short; the cache lets it go when the towns change.
    const data = atob(out.toDataURL('image/jpeg', pic.quality).split(',')[1]!);
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    this.pictures.set(key, url);
    return url;
  }

  /** Where a sim position lands on screen (for HUD markers). */
  project(x: number, y: number): ScreenPoint {
    const v = toScene(x, y, this.tmp).setY(2).project(this.camera);
    const behind = v.z > 1;
    return {
      x: ((v.x + 1) / 2) * this.width,
      y: ((1 - v.y) / 2) * this.height,
      onScreen: !behind && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
    };
  }

  dispose() {
    this.islands.dispose();
    this.lighthouseBeams.dispose();
    this.beaconLights.dispose();
    for (const effects of this.qualityEffects.values()) {
      effects.ocean.dispose();
      effects.streaks.dispose();
      effects.rain.dispose();
    }
    this.qualityEffects.clear();
    this.shores.dispose();
    this.stormClouds.dispose();
    this.volcanoes.dispose();
    this.lanterns.dispose();
    this.wake.dispose();
    this.currentWater?.dispose();
    this.bergs.dispose();
    this.calmWater?.dispose();
    this.roughWater?.dispose();
    this.shallowsWater?.dispose();
    this.buoy.dispose();
    this.edgeBuoys.dispose();
    this.seaMarks.dispose();
    this.questMarkers.dispose();
    this.boat.dispose();
    this.renderer.dispose();
  }
}
