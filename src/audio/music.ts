/**
 * In-game background music player (decision 0045), and the game's sounds. Plays the tracks of
 * `src/data/audio.json` (decision 0113): a theme is composed tune after tune and scheduled a little
 * ahead on a Web Audio clock; a recorded file loops. Each sea picks its own theme, which takes over
 * at the next tune (decision 0209). Effects and the sea's bed come from the same list and have
 * their own Sounds volume.
 *
 * - Browsers only allow sound after a tap or key press, so `unlock()` is called from the first
 *   one; until then nothing is created.
 * - Music, sounds and voices all at 0 suspend the audio context, so silence costs nothing.
 * - The game suspends it too while the tab is hidden (battery on phones).
 */
import { composeTune, EIGHTHS_PER_BAR, type Theme, type Tune } from './composer';
import { createBand, playNote, type Band } from './synth';
import { SYNTHS } from './sfx';
import { Ambience } from './ambience';
import { CallClock, layerMix, type PlaceDistances, type SoundsHere } from './seaBed';
import { createRng } from '../sim/rng';
import { babblePlan, MAX_SECONDS, playBabble, playClip, voiceFiles, voiceFor } from './babble';
import {
  BOAT_SOUNDS,
  EFFECTS,
  MUSIC,
  RING,
  SEA_BEDS,
  THEMES,
  VOICES,
  soundUrl,
  type MusicTrack,
  type SoundEffect,
} from './catalog';

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
  /** The theme the next tune is composed in: the sea's, or a step's (the regatta's). */
  private theme: Theme | undefined =
    this.track && 'theme' in this.track ? THEMES[this.track.theme] : undefined;
  /** The music track the sea asks for, and one a quest step holds over it (decision 0209). */
  private seaTrack = 'sea';
  private heldTrack: string | null = null;

  /** People's babble on the cards (decision 0132): its own switch and volume in Settings. */
  private voiceVolume = 0;

  /** Effects and the sea's bed (decision 0209): the Sounds volume in Settings. */
  private soundVolume = 0;
  private sounds: GainNode | null = null;
  private ambience: Ambience | null = null;
  private readonly calls = new CallClock(createRng(Math.floor(Math.random() * 2 ** 31)));

  constructor(
    private volume: number,
    private seed = Math.floor(Math.random() * 2 ** 31),
  ) {}

  /** Create the audio graph; call from a user gesture. Safe to call again. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.awake) void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.band = createBand(this.ctx, this.ctx.destination, this.theme?.echo);
    this.band.out.gain.value = this.level;
    this.sounds = this.ctx.createGain();
    this.sounds.gain.value = this.soundLevel;
    this.sounds.connect(this.ctx.destination);
    const { luff, rain, wash } = BOAT_SOUNDS;
    this.ambience = new Ambience(this.ctx, this.sounds, luff, rain.tone, wash.tone);
    this.barTime = this.ctx.currentTime + 0.3;
    if (this.track && 'file' in this.track) void this.loop(this.ctx, this.band, this.track);
    for (const effect of Object.values(EFFECTS))
      if ('file' in effect) void loadSound(this.ctx, effect.file);
    for (const voice of Object.values(VOICES))
      for (const file of voiceFiles(voice)) void loadSound(this.ctx, file);
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

  /** Play an effect of the sound list at `level` (before its own volume), `pitch` times its own. */
  private effect(effect: SoundEffect | undefined, level: number, pitch = 1) {
    const { ctx, sounds } = this;
    if (!ctx || !sounds || !effect) return;
    const volume = level * (effect.volume ?? 1);
    if ('synth' in effect) {
      SYNTHS[effect.synth]?.(ctx, sounds, volume, pitch * (effect.pitch ?? 1));
      return;
    }
    void loadSound(ctx, effect.file).then((buffer) => {
      if (!buffer || ctx.state !== 'running') return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(sounds);
      source.start();
    });
  }

  /** The hull creaks when she is pressed too hard (decision 0078). */
  creak(): void {
    this.effectNamed('creak');
  }

  /**
   * An effect of the sound list by name: a step's `sound`, such as the prologue's foghorn (0139),
   * or a game event's (decision 0209). `level` 0 to 1 for a far one, `pitch` for a port's bell.
   */
  effectNamed(id: string, level = 1, pitch = 1): void {
    const { ctx } = this;
    if (!ctx || !this.soundsOn || ctx.state !== 'running') return;
    this.effect(EFFECTS[id], level, pitch);
  }

  /**
   * The sea where the boat is (decision 0209), a few times a second: the bed of `sea` glides in,
   * its calls come when due, and its theme takes the next tune.
   */
  sea(dt: number, sea: string, here: SoundsHere, where: PlaceDistances): void {
    const bed = SEA_BEDS[sea] ?? SEA_BEDS[RING];
    if (!bed) return;
    this.seaTrack = bed.music ?? 'sea';
    this.pickTheme();
    const { ctx, ambience } = this;
    if (!ctx || !ambience || !this.soundsOn || ctx.state !== 'running') return;
    ambience.set(layerMix(bed, BOAT_SOUNDS, here));
    for (const call of this.calls.step(dt, sea, bed, where))
      this.effectNamed(call.effect, call.level);
  }

  /** A track a quest step holds while it runs (the regatta's, decision 0209); null lets it go. */
  holdTrack(id: string | null): void {
    this.heldTrack = id && MUSIC[id] ? id : null;
    this.pickTheme();
  }

  /** The theme of the held track, else the sea's; a recorded track keeps the base one. */
  private pickTheme() {
    const track = MUSIC[this.heldTrack ?? this.seaTrack] ?? this.track;
    if (track && 'theme' in track && THEMES[track.theme]) this.theme = THEMES[track.theme];
  }

  /** 0 (off) to 1, from Settings › Sounds. */
  setSoundVolume(volume: number): void {
    this.soundVolume = volume;
    if (this.sounds && this.ctx)
      this.sounds.gain.setTargetAtTime(this.soundLevel, this.ctx.currentTime, 0.05);
    this.apply();
  }

  /**
   * A person speaks as their card opens (decision 0132): a burble of about one syllable per word
   * of the card's ask (`words`), in their voice from `audio.json` › `voices`, changed for the card's mood.
   */
  speak(voiceId: string | undefined, words: number, mood?: string): void {
    const { ctx } = this;
    const base = voiceId ? VOICES[voiceId] : undefined;
    if (!ctx || !base || this.hidden || this.voiceVolume <= 0) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const voice = voiceFor(base, mood);
    const level = MAX_GAIN * this.voiceVolume * this.voiceVolume * (voice.volume ?? 1);
    if ('synth' in voice) {
      const plan = babblePlan(voice, words, Math.floor(Math.random() * 2 ** 31));
      playBabble(ctx, ctx.destination, level, plan);
      return;
    }
    const files = voiceFiles(voice);
    const file = files[Math.floor(Math.random() * files.length)];
    if (!file) return;
    // About as long as the generated voice would talk for the same line.
    const secs = Math.min(MAX_SECONDS, 0.25 + 0.16 * Math.max(2, words));
    void loadSound(ctx, file).then((buffer) => {
      if (buffer && ctx.state === 'running') playClip(ctx, ctx.destination, level, buffer, secs);
    });
  }

  /** 0 (voices off) to 1, from Settings › Voices. */
  setVoiceVolume(volume: number): void {
    this.voiceVolume = volume;
    this.apply();
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

  private get soundLevel() {
    return MAX_GAIN * this.soundVolume * this.soundVolume;
  }

  private get audible() {
    return this.volume > 0 && !this.hidden;
  }

  private get soundsOn() {
    return this.soundVolume > 0 && !this.hidden;
  }

  /** Anything to hear: the music, the sounds or the voices. */
  private get awake() {
    return !this.hidden && (this.volume > 0 || this.soundVolume > 0 || this.voiceVolume > 0);
  }

  private apply() {
    const ctx = this.ctx;
    if (!ctx) return;
    // Sounds and voices keep the context awake with the music muted; tunes need music on.
    if (this.awake && ctx.state === 'suspended') void ctx.resume();
    if (this.audible) {
      if (!this.timer) {
        // Don't try to catch up on bars missed while suspended.
        this.barTime = Math.max(this.barTime, ctx.currentTime + 0.1);
        this.timer = window.setInterval(() => this.schedule(), TICK_MS);
        this.schedule();
      }
    } else {
      if (this.timer) window.clearInterval(this.timer);
      this.timer = 0;
      if (ctx.state === 'running' && !this.awake) void ctx.suspend();
    }
  }

  private schedule() {
    const { ctx, band, theme } = this;
    if (!ctx || !band || !theme) return;
    while (this.barTime < ctx.currentTime + LOOKAHEAD) {
      if (!this.tune || this.bar * EIGHTHS_PER_BAR >= this.tune.length) {
        this.tune = composeTune(this.seed++, theme);
        this.bar = 0;
        band.echo.gain.setTargetAtTime(theme.echo, this.barTime, 1);
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
