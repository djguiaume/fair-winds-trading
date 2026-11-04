import * as THREE from 'three';
import type { Daylight } from '../sim/daylight';
import { TUNING } from '../data/tuning';
import { blendLooks, type LookSet } from './lookBlend';

/** The drawn sky's two colours (issue #470): just above the sea, and higher up. */
export interface SkyLook {
  horizon: THREE.Color;
  zenith: THREE.Color;
}

const blankSky = (): SkyLook => ({ horizon: new THREE.Color(), zenith: new THREE.Color() });

function mixSky(out: SkyLook, a: SkyLook, b: SkyLook, k: number): SkyLook {
  out.horizon.copy(a.horizon).lerp(b.horizon, k);
  out.zenith.copy(a.zenith).lerp(b.zenith, k);
  return out;
}

/**
 * A `#rrggbb` colour from the tuning files, parsed again only when the text changes, so a `?tune`
 * edit shows at once without parsing (and allocating) every frame.
 */
class DataColor {
  readonly color = new THREE.Color();
  private text = '';

  read(text: string): THREE.Color {
    if (text !== this.text) {
      this.text = text;
      this.color.set(text);
    }
    return this.color;
  }
}

type SkyData = typeof TUNING.graphics.sky.looks.day;

/** One sky look read from `graphics.json` › `sky` › `looks`. */
class DataSky {
  private readonly horizon = new DataColor();
  private readonly zenith = new DataColor();
  readonly look: SkyLook = { horizon: this.horizon.color, zenith: this.zenith.color };

  read(data: SkyData): SkyLook {
    this.horizon.read(data.horizon);
    this.zenith.read(data.zenith);
    return this.look;
  }
}

/** The light (sun or moon) direction, scene space (y up), from a compass bearing and a 0..1 height. */
export function lightDirection(out: THREE.Vector3, bearing: number, height: number): THREE.Vector3 {
  return out.set(Math.sin(bearing), height * 1.6, -Math.cos(bearing)).normalize();
}

/**
 * The low views' sky for the light of now: the four looks of `graphics.json` › `sky` blended as the
 * atmosphere blends its own, and what the chase camera's sea mirrors.
 */
export class SkyColors {
  /** The sky look of this hour and weather, before any fog bank. */
  readonly look = blankSky();
  private readonly storm = blankSky();
  private readonly sources: LookSet<DataSky> = {
    day: new DataSky(),
    golden: new DataSky(),
    night: new DataSky(),
    storm: new DataSky(),
  };
  private readonly looks: LookSet<SkyLook> = {
    day: this.sources.day.look,
    golden: this.sources.golden.look,
    night: this.sources.night.look,
    storm: this.sources.storm.look,
  };

  update(day: Readonly<Daylight>, gloom: number): SkyLook {
    const data = TUNING.graphics.sky.looks;
    this.sources.day.read(data.day);
    this.sources.golden.read(data.golden);
    this.sources.night.read(data.night);
    this.sources.storm.read(data.storm);
    return blendLooks(mixSky, this.look, this.storm, this.looks, day, gloom);
  }

  /**
   * The sky the sea mirrors at `low` (0 = sea camera … 1 = chase camera), written into `out` from
   * the sea camera's `skyLight`, and the reflection's strength against the shipped one. Night and
   * storms keep their own reflection (issue #469): only a clear day turns bluer.
   */
  reflection(out: THREE.Color, skyLight: THREE.Color, low: number, night: number, gloom: number) {
    const sky = TUNING.graphics.sky;
    const k = low * (1 - night) * (1 - gloom);
    const { horizon, zenith } = this.look;
    out.copy(horizon).lerp(zenith, sky.reflectZenith);
    out.lerp(skyLight, 1 - k);
    return 1 - (1 - sky.reflection) * k;
  }
}
