import type { BoatSounds, LuffStyle } from './catalog';
import type { LayerMix } from './seaBed';
import { noiseBuffer } from './sfx';

/**
 * The sea's constant sound (decision 0209): waves with a slow swell, the wind, her wash, the sails
 * luffing in irons and rain on deck, all filtered noise from one shared buffer. About twenty
 * nodes in all, built once, whatever the sea: a new sea only moves their levels and filters,
 * gliding over a few seconds, so crossing into another sea blends rather than cuts.
 */
/** Per luffing style, the trim that makes them equally loud at the same level. */
const LUFF_TRIM: Record<LuffStyle, number> = {
  chop: 1,
  flutter: 0.82,
  slat: 2.3,
  thrum: 0.84,
  flog: 0.6,
  billow: 1.12,
};

export class Ambience {
  private readonly waves: GainNode;
  private readonly wavesFilter: BiquadFilterNode;
  private readonly wavesSoft: BiquadFilterNode;
  private readonly swell: OscillatorNode;
  private readonly wind: GainNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly wash: GainNode;
  private readonly luff: GainNode;
  private readonly rain: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    luff: BoatSounds['luff'],
    rainTone: number,
    washTone: number,
  ) {
    // Two sources at different places in the buffer, so the wind is not the waves' twin.
    const sea = this.source(0);
    const air = this.source(0.9);

    // Waves: dull noise lapping with the swell. Storybook rather than a recording (Guillaume,
    // 2026-10-25): two low-passes in a row so no hiss is left, and each swell a lap, quick to
    // come and slow to go (a soft sawtooth of three harmonics on the gain), not a steady roar.
    this.wavesFilter = this.filter('lowpass', 500, 0.6);
    this.wavesSoft = this.filter('lowpass', 500, 0.5);
    const breathe = ctx.createGain();
    breathe.gain.value = 0.5;
    this.swell = ctx.createOscillator();
    this.swell.setPeriodicWave(
      ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.5, 0.33])),
    );
    this.swell.frequency.value = 1 / 7;
    const depth = ctx.createGain();
    depth.gain.value = -0.45;
    this.swell.connect(depth).connect(breathe.gain);
    this.waves = this.level(destination);
    sea.connect(this.wavesFilter).connect(this.wavesSoft).connect(breathe).connect(this.waves);

    // Wind: a narrow band of noise, a soft whistle more than a roar; its gusts a slower wobble out
    // of step with the swell.
    this.windFilter = this.filter('bandpass', 900, 3);
    const gusts = ctx.createGain();
    gusts.gain.value = 0.75;
    const gustOsc = ctx.createOscillator();
    gustOsc.frequency.value = 0.13;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.25;
    gustOsc.connect(gustDepth).connect(gusts.gain);
    this.wind = this.level(destination);
    air.connect(this.windFilter).connect(gusts).connect(this.wind);

    // Her wash along the hull: brighter noise, following her speed.
    this.wash = this.level(destination);
    sea.connect(this.filter('bandpass', washTone, 2.5)).connect(this.wash);

    // Luffing: the canvas shaking in irons, in the data's `style`.
    this.luff = this.level(destination);
    const luffOscs = this.luffing(air, luff, this.luff);

    // Rain on deck: a soft patter, a band of noise ticking unevenly (two fast wobbles out of step).
    const patter = ctx.createGain();
    patter.gain.value = 0.5;
    const drops = [11, 17.3].map((hz) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      const d = ctx.createGain();
      d.gain.value = 0.25;
      osc.connect(d).connect(patter.gain);
      return osc;
    });
    this.rain = this.level(destination);
    air
      .connect(this.filter('bandpass', rainTone, 1.5))
      .connect(patter)
      .connect(this.rain);

    for (const osc of [this.swell, gustOsc, ...luffOscs, ...drops]) osc.start();
  }

  /**
   * The sails luffing (Guillaume, 2026-10-25: the first was "a bit weird", five more to choose
   * from), fed by the air's noise into `out`; the oscillators to start.
   */
  private luffing(air: AudioNode, luff: BoatSounds['luff'], level: AudioNode): OscillatorNode[] {
    const { ctx } = this;
    const { tone, rate } = luff;
    const osc = (hz: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz;
      return o;
    };
    /** A gain whose level is `base` moved by each oscillator times its depth. */
    const moved = (base: number, mods: [OscillatorNode, number][]) => {
      const g = ctx.createGain();
      g.gain.value = base;
      for (const [o, depth] of mods) {
        const d = ctx.createGain();
        d.gain.value = depth;
        o.connect(d).connect(g.gain);
      }
      return g;
    };
    const style = luff.style ?? 'chop';
    // Each style trimmed to sound as loud as the others at the same `level` (measured, EBU R128).
    const out = ctx.createGain();
    out.gain.value = LUFF_TRIM[style];
    out.connect(level);
    switch (style) {
      case 'flutter': {
        // A soft rustle: a wide band of noise breathing smoothly `rate` times a second.
        const o = osc(rate);
        air
          .connect(this.filter('bandpass', tone, 0.9))
          .connect(moved(0.5, [[o, 0.45]]))
          .connect(out);
        return [o];
      }
      case 'slat': {
        // Heavy canvas slatting unevenly: three slow wobbles out of step, duller noise.
        const os = [0.35, 0.53, 0.81].map((k) => osc(rate * k));
        air
          .connect(this.filter('lowpass', tone * 0.7, 0.8))
          .connect(
            moved(
              0.45,
              os.map((o) => [o, 0.22] as [OscillatorNode, number]),
            ),
          )
          .connect(out);
        return os;
      }
      case 'thrum': {
        // Storybook: a soft "brrr" like the music's instruments, a buzzy tone trembling at `rate`,
        // with a breath of noise over it.
        const buzz = osc(tone / 4, 'triangle');
        const o = osc(rate);
        const body = moved(0.5, [[o, 0.5]]);
        buzz.connect(this.filter('lowpass', tone * 1.4, 0.7)).connect(body);
        const breath = ctx.createGain();
        breath.gain.value = 0.6;
        air
          .connect(this.filter('bandpass', tone, 1.2))
          .connect(breath)
          .connect(body);
        const level = ctx.createGain();
        level.gain.value = 0.35;
        body.connect(level).connect(out);
        return [buzz, o];
      }
      case 'flog': {
        // The leech cracking: sharp snaps of bright noise about three times a second over a soft
        // flutter, as a sail does flogging in a breeze.
        const pulses = ctx.createOscillator();
        pulses.setPeriodicWave(
          ctx.createPeriodicWave(new Float32Array(13).fill(1), new Float32Array(13)),
        );
        pulses.frequency.value = rate / 3;
        const snap = ctx.createGain();
        snap.gain.value = 0;
        const depth = ctx.createGain();
        depth.gain.value = 0.9;
        pulses.connect(depth).connect(snap.gain);
        air
          .connect(this.filter('highpass', tone * 1.6, 0.7))
          .connect(snap)
          .connect(out);
        const o = osc(rate);
        air
          .connect(this.filter('bandpass', tone, 1.2))
          .connect(moved(0.25, [[o, 0.2]]))
          .connect(out);
        return [pulses, o];
      }
      case 'billow': {
        // The sail filling and spilling: a whoosh whose band sweeps up and down slowly, with a
        // light flutter in it.
        const band = this.filter('bandpass', tone, 2);
        const sweep = osc(rate / 6);
        const sweepDepth = ctx.createGain();
        sweepDepth.gain.value = tone * 0.45;
        sweep.connect(sweepDepth).connect(band.frequency);
        const o = osc(rate);
        air
          .connect(band)
          .connect(moved(0.6, [[o, 0.25]]))
          .connect(out);
        return [sweep, o];
      }
      default: {
        // Chop: a band of noise chopped by a fast square wave.
        const o = osc(rate, 'square');
        air
          .connect(this.filter('bandpass', tone, 1.6))
          .connect(moved(0.5, [[o, 0.5]]))
          .connect(out);
        return [o];
      }
    }
  }

  private source(offset: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    src.loop = true;
    src.start(0, offset);
    return src;
  }

  private filter(type: BiquadFilterType, freq: number, q: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private level(destination: AudioNode) {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(destination);
    return g;
  }

  /**
   * Glide every layer to `mix`. `glide` is the time constant in seconds: slow for the sea and the
   * wind, quick for the luffing so it starts as she points up.
   */
  set(mix: LayerMix, glide = 1.5) {
    const t = this.ctx.currentTime;
    const to = (p: AudioParam, v: number, k = glide) => p.setTargetAtTime(v, t, k);
    to(this.waves.gain, mix.waves);
    to(this.wavesFilter.frequency, mix.wavesTone);
    to(this.wavesSoft.frequency, mix.wavesTone);
    to(this.swell.frequency, mix.swellHz);
    to(this.wind.gain, mix.wind);
    to(this.windFilter.frequency, mix.windTone);
    to(this.wash.gain, mix.wash, 0.6);
    to(this.luff.gain, mix.luff, 0.15);
    to(this.rain.gain, mix.rain, 2);
  }
}
