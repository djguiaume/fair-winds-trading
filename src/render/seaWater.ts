import * as THREE from 'three';
import palette from '../data/palette.json';
import grown from '../data/seas/grown.json';
import { SEA_SECTORS } from '../data/grownMap';
import { DEG } from '../sim/math';
import { bearingOf, sectorSpan, type Sector } from '../sim/seaSectors';
import { TUNING } from '../data/tuning';

/** A sea's water by depth (issue #274): the coast band, the mid water and the deep water. */
export interface WaterRamp {
  shallow: THREE.Color;
  mid: THREE.Color;
  deep: THREE.Color;
}

/** The ring's own sea id, as in the sea files. */
export const RING_SEA = 'ring';

const ramp = (colors: { shallow: string; mid: string; deep: string }): WaterRamp => ({
  shallow: new THREE.Color(colors.shallow),
  mid: new THREE.Color(colors.mid),
  deep: new THREE.Color(colors.deep),
});

/** Every sea's day colours, `palette.json › water`, by sea id. */
export const SEA_RAMPS: Readonly<Record<string, WaterRamp>> = Object.fromEntries(
  Object.entries(palette.water).map(([id, colors]) => [id, ramp(colors)]),
);

/** The outer seas with their sector and colours, and a weight per sea reused every frame. */
const SECTOR_RAMPS = Object.entries(SEA_SECTORS).flatMap(([id, sector]) =>
  SEA_RAMPS[id] ? [{ sector, ramp: SEA_RAMPS[id] }] : [],
);
const weights = new Float32Array(SECTOR_RAMPS.length);

export const newRamp = (): WaterRamp => ({
  shallow: new THREE.Color(),
  mid: new THREE.Color(),
  deep: new THREE.Color(),
});

const smoothstep = (a: number, b: number, x: number) => {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How far a point lies inside a sector of the outer ring, in map units: positive inside, negative
 * outside, measured square to the nearest edge (a sector's edges run out from the middle).
 */
function intoSector(r: number, bearing: number, sector: Sector): number {
  const span = sectorSpan(sector);
  const off = (((bearing - sector[0]) % 360) + 360) % 360;
  const toEdge = off <= span ? Math.min(off, span - off) : -Math.min(off - span, 360 - off);
  return r * Math.sin(Math.max(-90, Math.min(90, toEdge)) * DEG);
}

function addScaled(out: WaterRamp, from: WaterRamp, weight: number) {
  out.shallow.r += from.shallow.r * weight;
  out.shallow.g += from.shallow.g * weight;
  out.shallow.b += from.shallow.b * weight;
  out.mid.r += from.mid.r * weight;
  out.mid.g += from.mid.g * weight;
  out.mid.b += from.mid.b * weight;
  out.deep.r += from.deep.r * weight;
  out.deep.g += from.deep.g * weight;
  out.deep.b += from.deep.b * weight;
}

/**
 * The water colours at a map point: its sea's, blended with the next sea's over `seaBlend` units
 * centred on the border (art bible §8), as the old sea tints did. Writes into `out`, no allocation.
 */
export function seaRampAt(
  x: number,
  y: number,
  out: WaterRamp,
  blend = TUNING.graphics.water.depth.seaBlend,
  ringRadius = grown.chartedRadius,
): WaterRamp {
  out.shallow.setRGB(0, 0, 0);
  out.mid.setRGB(0, 0, 0);
  out.deep.setRGB(0, 0, 0);
  const r = Math.hypot(x, y);
  const outer = smoothstep(ringRadius - blend / 2, ringRadius + blend / 2, r);
  let ring = 1 - outer;
  if (outer > 0) {
    const bearing = bearingOf(x, y);
    let total = 0;
    for (let k = 0; k < SECTOR_RAMPS.length; k++) {
      const into = intoSector(r, bearing, SECTOR_RAMPS[k]!.sector);
      total += weights[k] = smoothstep(-blend / 2, blend / 2, into);
    }
    // Open water no sea claims keeps the ring's colours.
    if (total <= 0) ring = 1;
    else
      for (let k = 0; k < SECTOR_RAMPS.length; k++)
        addScaled(out, SECTOR_RAMPS[k]!.ramp, (outer * weights[k]!) / total);
  }
  if (ring > 0) addScaled(out, SEA_RAMPS[RING_SEA]!, ring);
  return out;
}
