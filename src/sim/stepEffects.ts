import audio from '../data/audio.json';
import type { MapDef } from './map';
import { DEG, wrapPositive } from './math';
import type { Wind } from './wind';

/*
 * What a step does to the sea while it runs (decision 0139), the same data for the tutorial's
 * lessons and every quest's steps: a held breeze, and a sound that calls the captain towards the
 * step's place. A quest step counts while its quest is the tracked one.
 */

/** A light, steady breeze instead of the sea's wind; the direction defaults to the map's. */
export interface StepWind {
  speedKn: number;
  fromDeg?: number;
}

/**
 * An effect of `audio.json` › `effects` played every `everySec` seconds while the step runs, the
 * first at once. The line `toast.<effect>` (if any) says it in words, with `{dir}` the direction
 * of the step's place, for a muted phone.
 */
export interface StepSound {
  effect: string;
  everySec: number;
}

/**
 * Where the boat is taken when the step begins (decision 0164): the sailing lessons start on
 * Rook's course wherever the captain was. Sails down, off the pier, no course set.
 */
export interface StepMove {
  x: number;
  y: number;
  /** 0 = north, clockwise. */
  headingDeg?: number;
}

/** The step fields of this file. */
export interface StepEffects {
  wind?: StepWind;
  sound?: StepSound;
  moveTo?: StepMove;
  /**
   * A music track of `audio.json` › `music` played over the sea's own while the step runs, such as
   * the regatta's (decision 0209). It takes over at the next tune.
   */
  music?: string;
}

/** The breeze a step holds on this map, or null. */
export function heldWind(wind: StepWind | undefined, map: MapDef): Wind | null {
  if (!wind) return null;
  return { from: wrapPositive((wind.fromDeg ?? map.wind.fromDeg) * DEG), speedKn: wind.speedKn };
}

/** Problems with a step's `wind` and `sound`, for the quest checks. */
export function checkStepEffects(step: StepEffects, where: string): string[] {
  const out: string[] = [];
  const { wind, sound, moveTo, music } = step;
  if (music !== undefined && !(music in audio.music))
    out.push(`${where} › music: no track "${music}" in audio.json`);
  if (wind !== undefined) {
    if (!(typeof wind.speedKn === 'number' && wind.speedKn > 0 && wind.speedKn <= 40))
      out.push(`${where} › wind: speedKn between 0 and 40`);
    if (wind.fromDeg !== undefined && !Number.isFinite(wind.fromDeg))
      out.push(`${where} › wind: fromDeg is a number of degrees`);
  }
  if (
    moveTo !== undefined &&
    !(
      Number.isFinite(moveTo?.x) &&
      Number.isFinite(moveTo?.y) &&
      (moveTo.headingDeg === undefined || Number.isFinite(moveTo.headingDeg))
    )
  )
    out.push(`${where} › moveTo: x and y in map units, headingDeg in degrees`);
  if (sound !== undefined) {
    if (!(sound.effect in audio.effects))
      out.push(`${where} › sound: no effect "${sound.effect}" in audio.json`);
    if (!(typeof sound.everySec === 'number' && sound.everySec >= 2))
      out.push(`${where} › sound: everySec of 2 or more`);
  }
  return out;
}
