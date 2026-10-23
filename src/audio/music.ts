/**
 * In-game background music player (decision 0045). Plays the `sea` track of `src/data/audio.json`
 * (decision 0113): a theme is composed tune after tune and scheduled a little ahead on a Web Audio
 * clock; a recorded file loops. Effects come from the same list.
 *
 * - Browsers only allow sound after a tap or key press, so `unlock()` is called from the first
 *   one; until then nothing is created.
 * - Volume 0 suspends the audio context, so muted music costs nothing.
 * - The game suspends it too while the tab is hidden (battery on phones).
 */
import { composeTune, EIGHTHS_PER_BAR, type Theme, type Tune } from './composer';
import { createBand, playNote, type Band } from './synth';
import { playCreak, playFoghorn } from './sfx';
import { EFFECTS, MUSIC, THEMES, soundUrl, type MusicTrack, type SoundEffect } from './catalog';

/** Recorded files, decoded once per audio context. */
const buffers = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer | null>>>();
function loadSound(ctx: BaseAudioContext, file: string): Promise<AudioBuffer | null> {
  let byFile = buffers.get(ctx);
  if (!byFile) buffers.set(ctx, (byFile = new Map()));
  let buffer = byFile.get(file);
  if (!buffer) {
    buffer = fetch(soundUrl(file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null); // A missing file is silence, never a broken game.
    byFile.set(file, buffer);
  }
  return buffer;
}

/** How far ahead notes are scheduled, and how often the scheduler wakes. */
const LOOKAHEAD = 1.5;
const TICK_MS = 250;
/** Overall level at volume 1: background music sits under the game. */
const MAX_GAIN = 0.55;

export class Music {
  private ctx: AudioContext | null = null;
  private band: Band | null = null;
  private timer = 0;
  private tune: Tune | null = null;
  private bar = 0;
  private barTime = 0;
  private hidden = false;
  private readonly track: MusicTrack | undefined = MUSIC.sea;
  private readonly theme: Theme | undefined =
    this.track && 'theme' in this.track ? THEMES[this.track.theme] : undefined;

  constructor(
    private volume: number,
    private seed = Math.floor(Math.random() * 2 ** 31),
  ) {}

  /** Create the audio graph; call from a user gesture. Safe to call again. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.audible) void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.band = createBand(this.ctx, this.ctx.destination, this.theme?.echo);
    this.band.out.gain.value = this.level;
    this.barTime = this.ctx.currentTime + 0.3;
    if (this.track && 'file' in this.track) void this.loop(this.ctx, this.band, this.track);
    for (const effect of Object.values(EFFECTS))
      if ('file' in effect) void loadSound(this.ctx, effect.file);
    this.apply();
  }

  /** A recorded track: loop it on the band's master volume. */
  private async loop(ctx: AudioContext, band: Band, track: { file: string; volume?: number }) {
    const buffer = await loadSound(ctx, track.file);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = track.volume ?? 1;
    source.connect(gain).connect(band.out);
    source.start();
  }

  /** Play an effect of the sound list at `level` (before its own volume). */
  private effect(effect: SoundEffect | undefined, level: number) {
    const { ctx } = this;
    if (!ctx || !effect) return;
    const volume = level * (effect.volume ?? 1);
    if ('synth' in effect) {
      if (effect.synth === 'creak') playCreak(ctx, ctx.destination, volume);
      if (effect.synth === 'foghorn') playFoghorn(ctx, ctx.destination, volume);
      return;
    }
    void loadSound(ctx, effect.file).then((buffer) => {
      if (!buffer || ctx.state !== 'running') return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(ctx.destination);
      source.start();
    });
  }

  /**
   * The hull creaks when she is pressed too hard (decision 0078). Effects share the sound slider
   * with the music for now, so muted music means a silent creak too.
   */
  creak(): void {
    const { ctx } = this;
    if (!ctx || !this.audible || ctx.state !== 'running') return;
    this.effect(EFFECTS.creak, this.level);
  }

  /** A foghorn far off, for the prologue (decision 0127). */
  foghorn(): void {
    const { ctx } = this;
    if (!ctx || !this.audible || ctx.state !== 'running') return;
    this.effect(EFFECTS.foghorn, this.level);
  }

  /** 0..1, from the settings slider. */
  setVolume(volume: number): void {
    this.volume = volume;
    if (this.band && this.ctx) {
      this.band.out.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.05);
    }
    this.apply();
  }

  /** Pause while the page is hidden. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.apply();
  }

  private get level() {
    // Perceived loudness is roughly logarithmic: square the slider for an even feel.
    return MAX_GAIN * this.volume * this.volume;
  }

  private get audible() {
    return this.volume > 0 && !this.hidden;
  }

  private apply() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.audible) {
      if (ctx.state === 'suspended') void ctx.resume();
      if (!this.timer) {
        // Don't try to catch up on bars missed while suspended.
        this.barTime = Math.max(this.barTime, ctx.currentTime + 0.1);
        this.timer = window.setInterval(() => this.schedule(), TICK_MS);
        this.schedule();
      }
    } else {
      if (this.timer) window.clearInterval(this.timer);
      this.timer = 0;
      if (ctx.state === 'running') void ctx.suspend();
    }
  }

  private schedule() {
    const { ctx, band, theme } = this;
    if (!ctx || !band || !theme) return;
    while (this.barTime < ctx.currentTime + LOOKAHEAD) {
      if (!this.tune || this.bar * EIGHTHS_PER_BAR >= this.tune.length) {
        this.tune = composeTune(this.seed++, theme);
        this.bar = 0;
      }
      const tune = this.tune;
      const from = this.bar * EIGHTHS_PER_BAR;
      const to = from + EIGHTHS_PER_BAR;
      for (const note of tune.notes) {
        if (note.at < from || note.at >= to) continue;
        const time = this.barTime + (note.at - from) * tune.eighth;
        playNote(band, note, time, note.len * tune.eighth);
      }
      this.bar++;
      this.barTime += EIGHTHS_PER_BAR * tune.eighth;
    }
  }
}
