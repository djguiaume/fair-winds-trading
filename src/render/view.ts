import * as THREE from 'three';
import { trueWindAngle } from '../sim/boat';
import { DEG, approach, bearingVector, clamp, wrapAngle } from '../sim/math';
import { polarFraction } from '../sim/ship';
import { windTo } from '../sim/wind';
import { WAYPOINT_RADIUS, type World, currentWaypoint } from '../sim/world';
import { KNOT_TO_UNITS } from '../sim/boat';
import { type BoatModel, buildIslands, createBoatModel } from './models';
import { Ocean, waveHeight } from './ocean';
import { PALETTE } from './palette';
import { BuoyMarker, createBlobShadow } from './props';
import { QUALITY, type QualityLevel, type QualityProfile } from './quality';
import { Wake } from './wake';
import { WindStreaks } from './windStreaks';

const CAMERA_PITCH = 58 * DEG;
const BASE_DISTANCE = 110;
const SUN_OFFSET = new THREE.Vector3(-30, 50, 20);

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
  private readonly islands: THREE.Object3D;
  private readonly boat: BoatModel;
  private readonly boatShadow = createBlobShadow(6.5, 14);
  private readonly wake = new Wake();
  private readonly buoy = new BuoyMarker();
  private ocean!: Ocean;
  private streaks!: WindStreaks;
  private profile!: QualityProfile;
  private readonly target = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
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
    this.scene.background = new THREE.Color(PALETTE.deepWater);
    this.scene.fog = new THREE.Fog(PALETTE.deepWater, 120, 220);
    this.scene.add(new THREE.HemisphereLight(PALETTE.sky, '#1a4d55', 1.5));
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

    this.islands = buildIslands(world.map, { shadows: true });
    this.boat = createBoatModel(world.ship.id);
    this.boat.root.rotation.order = 'YXZ';
    this.scene.add(this.islands, this.boat.root, this.boatShadow, this.wake.mesh, this.buoy.root);

    toScene(world.boat.x, world.boat.y, this.target);
    this.setQuality(level);
  }

  setQuality(level: QualityLevel) {
    const profile = QUALITY[level];
    if (this.ocean) {
      this.scene.remove(this.ocean.mesh);
      this.ocean.dispose();
    }
    if (this.streaks) {
      this.scene.remove(this.streaks.mesh);
      this.streaks.dispose();
    }
    this.ocean = new Ocean(this.world.map.islands, profile.oceanSegments, profile.fancyWater, 480);
    this.streaks = new WindStreaks(profile.windStreaks);
    this.scene.add(this.ocean.mesh, this.streaks.mesh);

    if (this.profile?.shadows !== profile.shadows) {
      this.renderer.shadowMap.enabled = profile.shadows;
      this.sun.castShadow = profile.shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((mat) => (mat.needsUpdate = true));
      });
    }
    this.boat.setLowDetail?.(level === 'low');
    this.profile = profile;
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.pixelRatioCap));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** 1 = default; larger = farther away. */
  setZoom(zoom: number) {
    this.zoom = clamp(zoom, 0.6, 1.7);
  }

  getZoom() {
    return this.zoom;
  }

  render(dt: number) {
    const { boat, wind, ship, time } = this.world;
    const dir = bearingVector(boat.heading);
    const pos = toScene(boat.x, boat.y, this.tmp);

    // Camera: tilted top-down, looking a little ahead of the boat; farther out in portrait.
    const ahead = boat.speedKn * 1.6;
    const tx = pos.x + dir.x * ahead;
    const tz = pos.z - dir.y * ahead;
    this.target.x = approach(this.target.x, tx, 2.5, dt);
    this.target.z = approach(this.target.z, tz, 2.5, dt);
    const aspect = this.width / this.height;
    const dist = BASE_DISTANCE * this.zoom * (aspect < 1 ? clamp(0.6 / aspect, 1, 1.15) : 1);
    this.camera.position.set(
      this.target.x,
      Math.sin(CAMERA_PITCH) * dist,
      this.target.z + Math.cos(CAMERA_PITCH) * dist,
    );
    this.camera.lookAt(this.target);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = dist * 1.3;
    fog.far = dist * 2.4;
    this.ocean.setFog(fog.near, fog.far);
    this.sun.position.copy(this.target).add(SUN_OFFSET);
    this.sun.target.position.copy(this.target);

    // Boat pose from the simulation.
    const twa = trueWindAngle(boat.heading, wind);
    const abs = Math.abs(twa);
    const lee = twa > 0 ? -1 : 1;
    const boomMag = (12 + clamp((abs / DEG - 45) / 135, 0, 1) * 68) * DEG;
    const luff = 1 - clamp((abs - ship.noGoAngle * 0.8) / (ship.noGoAngle * 0.3), 0, 1);
    const drive = polarFraction(ship, twa) * boat.sail * (wind.speedKn / 14);
    const heel = -lee * drive * clamp((180 - abs / DEG) / 120, 0, 1) * 11 * DEG;
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

    this.wake.update(dt, time, this.tmp.set(bx, 0, bz), dir.x, -dir.y, boat.speedKn);

    const to = bearingVector(windTo(wind));
    this.streaks.update(dt, this.target, to.x, -to.y, wind.speedKn * KNOT_TO_UNITS * 0.75);
    this.ocean.update(time, this.target);

    if (this.world.map.course.length) {
      const wp = currentWaypoint(this.world);
      toScene(wp.x, wp.y, this.buoy.root.position);
      this.buoy.update(time, waveHeight(wp.x, -wp.y, time), WAYPOINT_RADIUS);
    }

    this.renderer.render(this.scene, this.camera);
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
    this.ocean.dispose();
    this.streaks.dispose();
    this.wake.dispose();
    this.buoy.dispose();
    this.boat.dispose();
    this.renderer.dispose();
  }
}
