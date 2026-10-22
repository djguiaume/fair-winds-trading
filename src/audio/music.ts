/**
 * In-game background music player (decision 0045). Composes tune after tune of the Fair Winds
 * theme and schedules them a little ahead on a Web Audio clock.
 *
 * - Browsers only allow sound after a tap or key press, so `unlock()` is called from the first
 *   one; until then nothing is created.
 * - Volume 0 suspends the audio context, so muted music costs nothing.
 * - The game suspends it too while the tab is hidden (battery on phones).
 */
import { composeTune, EIGHTHS_PER_BAR, type Tune } from './composer';
import { createBand, playNote, type Band } from './synth';
import { playCreak } from './sfx';

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
    this.band = createBand(this.ctx);
    this.band.out.gain.value = this.level;
    this.barTime = this.ctx.currentTime + 0.3;
    this.apply();
  }

  /**
   * The hull creaks when she is pressed too hard (decision 0078). Effects share the sound slider
   * with the music for now, so muted music means a silent creak too.
   */
  creak(): void {
    const { ctx } = this;
    if (!ctx || !this.audible || ctx.state !== 'running') return;
    playCreak(ctx, ctx.destination, 1.6 * this.level);
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
    const { ctx, band } = this;
    if (!ctx || !band) return;
    while (this.barTime < ctx.currentTime + LOOKAHEAD) {
      if (!this.tune || this.bar * EIGHTHS_PER_BAR >= this.tune.length) {
        this.tune = composeTune(this.seed++);
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
