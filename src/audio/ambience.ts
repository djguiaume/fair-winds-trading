import type { LayerMix } from './seaBed';
import { noiseBuffer } from './sfx';

/**
 * The sea's constant sound (decision 0209): waves with a slow swell, the wind, her wash, the sails
 * luffing in irons and rain on deck, all filtered noise from one shared buffer. About twenty
 * nodes in all, built once, whatever the sea: a new sea only moves their levels and filters,
 * gliding over a few seconds, so crossing into another sea blends rather than cuts.
 */
export class Ambience {
  private readonly waves: GainNode;
  private readonly wavesFilter: BiquadFilterNode;
  private readonly wavesSoft: BiquadFilterNode;
  private readonly swell: OscillatorNode;
  private readonly wind: GainNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly wash: GainNode;
  private readonly luff: GainNode;
  private readonly luffRate: OscillatorNode;
  private readonly rain: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    luffTone: number,
    luffRate: number,
    rainTone: number,
    washTone: number,
  ) {
    // Two sources at different places in the buffer, so the wind is not the waves' twin.
    const sea = this.source(0);
    const air = this.source(0.9);

    // Waves: dull noise breathing with the swell (a slow sine on its gain, ±70 %). Two low-passes
    // in a row, so no hiss is left over the roar.
    this.wavesFilter = this.filter('lowpass', 500, 0.6);
    this.wavesSoft = this.filter('lowpass', 500, 0.5);
    const breathe = ctx.createGain();
    breathe.gain.value = 0.6;
    this.swell = ctx.createOscillator();
    this.swell.frequency.value = 1 / 7;
    const depth = ctx.createGain();
    depth.gain.value = 0.42;
    this.swell.connect(depth).connect(breathe.gain);
    this.waves = this.level(destination);
    sea.connect(this.wavesFilter).connect(this.wavesSoft).connect(breathe).connect(this.waves);

    // Wind: a band of noise, its gusts a slower wobble out of step with the swell.
    this.windFilter = this.filter('bandpass', 900, 0.9);
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
    sea.connect(this.filter('bandpass', washTone, 1.2)).connect(this.wash);

    // Luffing: the canvas flogging, a band of noise chopped by a fast square wave.
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    this.luffRate = ctx.createOscillator();
    this.luffRate.type = 'square';
    this.luffRate.frequency.value = luffRate;
    const chopDepth = ctx.createGain();
    chopDepth.gain.value = 0.5;
    this.luffRate.connect(chopDepth).connect(chop.gain);
    this.luff = this.level(destination);
    air
      .connect(this.filter('bandpass', luffTone, 1.6))
      .connect(chop)
      .connect(this.luff);

    // Rain on deck: fine high hiss.
    this.rain = this.level(destination);
    air.connect(this.filter('highpass', rainTone, 0.5)).connect(this.rain);

    for (const osc of [this.swell, gustOsc, this.luffRate]) osc.start();
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
