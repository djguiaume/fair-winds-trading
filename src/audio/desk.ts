import { Ambience } from './ambience';
import { THEMES, type AudioData } from './catalog';
import { composeTune, EIGHTHS_PER_BAR } from './composer';
import { CallClock, layerMix, type PlaceDistances, type SoundsHere } from './seaBed';
import { SYNTHS } from './sfx';
import { createBand, playNote } from './synth';
import { createRng } from '../sim/rng';

/*
 * The sound desk (decision 0209): plays and records any sound of an `audio.json`, the shipped one
 * or an edited copy, with the game's own synthesisers, sea beds and composer. The editors' Sounds
 * page plays it live; `npm run sound` renders it offline in Chromium to a file.
 */

/** Level of everything at full volume, as the game's sliders at 100 % (`music.ts`). */
const FULL = 0.55;

/** Play effect `id` of `data` now on `ctx`; false when there is no such synthesised effect. */
export function playEffect(
  ctx: BaseAudioContext,
  destination: AudioNode,
  data: AudioData,
  id: string,
  level = 1,
  pitch = 1,
): boolean {
  const effect = data.effects[id];
  if (!effect || !('synth' in effect)) return false;
  const play = SYNTHS[effect.synth];
  if (!play) return false;
  play(ctx, destination, FULL * level * (effect.volume ?? 1), pitch * (effect.pitch ?? 1));
  return true;
}

/** What a sea is played with on the desk: the boat's state and which places are near. */
export interface DeskSea {
  here: SoundsHere;
  /** Every call's place counts as right here (true), or none does. */
  near: boolean;
  storm: boolean;
}

export const DESK_SEA: DeskSea = {
  here: { windKn: 12, speedKn: 5, luffing: false, rain: 0, docked: false, calm: 1 },
  near: true,
  storm: false,
};

function deskPlaces(sea: DeskSea): PlaceDistances {
  const d = sea.near ? 0 : Infinity;
  return {
    island: () => d,
    bergs: d,
    vents: d,
    reefs: d,
    storm: sea.storm,
    raining: sea.here.rain > 0.2,
  };
}

/**
 * A sea bed playing live on `ctx` until stopped: the layers, and the calls every quarter second
 * as in the game. `update` changes the boat's state or the data while it plays.
 */
export class LiveSea {
  private readonly ambience: Ambience;
  private readonly out: GainNode;
  private readonly clock = new CallClock(createRng(9));
  private timer = 0;

  constructor(
    private readonly ctx: AudioContext,
    private data: AudioData,
    private sea: string,
    private state: DeskSea = DESK_SEA,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = FULL;
    this.out.connect(ctx.destination);
    const { luff, rain, wash } = data.boat;
    this.ambience = new Ambience(ctx, this.out, luff, rain.tone, wash.tone);
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 250);
  }

  update(data: AudioData, sea: string, state: DeskSea) {
    Object.assign(this, { data, sea, state });
  }

  private tick() {
    const bed = this.data.seas[this.sea];
    if (!bed) return;
    this.ambience.set(layerMix(bed, this.data.boat, this.state.here), 0.4);
    for (const call of this.clock.step(0.25, this.sea, bed, deskPlaces(this.state)))
      playEffect(this.ctx, this.out, this.data, call.effect, call.level);
  }

  stop() {
    window.clearInterval(this.timer);
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(() => this.out.disconnect(), 1500);
  }
}

/** One render of the desk, for `npm run sound`. */
export type RenderJob =
  | { kind: 'effect'; id: string; pitch?: number; secs?: number }
  | { kind: 'sea'; sea: string; secs: number; state?: DeskSea }
  | { kind: 'music'; track: string; secs: number; seed?: number }
  /** A sea with its theme over it, at the game's default volumes: what a player hears. */
  | { kind: 'mix'; sea: string; secs: number; state?: DeskSea; seed?: number };

/** The Settings defaults (`settings.ts`): Sounds 70 %, Music 60 %, squared as the game does. */
const DEFAULT_SOUNDS = 0.7 * 0.7;
const DEFAULT_MUSIC = 0.6 * 0.6;

const RATE = 44100;

/** Renders a job offline with the game's code; the samples, mono. */
export async function renderJob(data: AudioData, job: RenderJob): Promise<Float32Array> {
  const secs = job.kind === 'effect' ? (job.secs ?? 4) : job.secs;
  const ctx = new OfflineAudioContext(1, Math.round(RATE * secs), RATE);
  if (job.kind === 'effect') {
    if (!playEffect(ctx, ctx.destination, data, job.id, 1, job.pitch ?? 1))
      throw new Error(`no synthesised effect "${job.id}"`);
  } else if (job.kind === 'sea') {
    renderSea(ctx, data, job.sea, job.state ?? DESK_SEA, secs, FULL);
  } else if (job.kind === 'music') {
    renderMusic(ctx, data, job.track, secs, job.seed ?? 1, FULL * DEFAULT_MUSIC);
  } else {
    const track = data.seas[job.sea]?.music ?? 'sea';
    renderSea(ctx, data, job.sea, job.state ?? DESK_SEA, secs, FULL * DEFAULT_SOUNDS);
    renderMusic(ctx, data, track, secs, job.seed ?? 1, FULL * DEFAULT_MUSIC);
  }
  const buffer = await ctx.startRendering();
  return buffer.getChannelData(0);
}

/** A sea's bed and its calls on an offline context, at `level`. */
function renderSea(
  ctx: OfflineAudioContext,
  data: AudioData,
  sea: string,
  state: DeskSea,
  secs: number,
  level: number,
) {
  const bed = data.seas[sea];
  if (!bed) throw new Error(`no sea bed "${sea}"`);
  const out = ctx.createGain();
  out.gain.value = level;
  out.connect(ctx.destination);
  const { luff, rain, wash } = data.boat;
  const ambience = new Ambience(ctx, out, luff, rain.tone, wash.tone);
  ambience.set(layerMix(bed, data.boat, state.here), 0.01);
  // The calls as the game times them: the render stops every quarter second to hear them.
  const clock = new CallClock(createRng(9));
  for (let t = 0.25; t < secs - 3; t += 0.25)
    void ctx.suspend(t).then(() => {
      for (const call of clock.step(0.25, sea, bed, deskPlaces(state)))
        playEffect(ctx, out, data, call.effect, call.level);
      void ctx.resume();
    });
}

/** A music track's tunes on an offline context, at `level` before the track's own volume. */
function renderMusic(
  ctx: OfflineAudioContext,
  data: AudioData,
  id: string,
  secs: number,
  seed: number,
  level: number,
) {
  const track = data.music[id];
  const theme = track && 'theme' in track ? THEMES[track.theme] : undefined;
  if (!theme) throw new Error(`no theme for music "${id}"`);
  const band = createBand(ctx, ctx.destination, theme.echo);
  band.out.gain.value = level * (track?.volume ?? 1);
  for (let at = 0.3; at < secs;) {
    const tune = composeTune(seed++, theme);
    for (const note of tune.notes)
      if (at + note.at * tune.eighth < secs)
        playNote(band, note, at + note.at * tune.eighth, note.len * tune.eighth);
    at += Math.max(EIGHTHS_PER_BAR, tune.length) * tune.eighth;
  }
}

/** 16-bit mono WAV of samples at the desk's rate. */
export function wavBytes(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  return bytes;
}

/** The loudest sample, to say when a render clips or is near silent. */
export function peak(samples: Float32Array): number {
  let p = 0;
  for (const s of samples) p = Math.max(p, Math.abs(s));
  return p;
}
