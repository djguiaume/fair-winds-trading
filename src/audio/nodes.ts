/**
 * The nodes the synthesised sounds are made from (decision 0045): a shared noise buffer, filters,
 * envelopes and tones, used by the effects of `sfx.ts` and the interface's of `uiSfx.ts`.
 */

export type Play = (
  ctx: BaseAudioContext,
  destination: AudioNode,
  level: number,
  pitch: number,
) => void;

/** Two seconds of white noise, made once per audio context and shared by every noisy sound. */
const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noises.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // A fixed little generator, so an offline render sounds the same every time.
    let s = 0x2545f491;
    for (let i = 0; i < data.length; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      data[i] = ((s >>> 0) / 0xffffffff) * 2 - 1;
    }
    noises.set(ctx, buffer);
  }
  return buffer;
}

/** A noise source from `t` to `end`, started at a random place in the buffer. */
export function noise(ctx: BaseAudioContext, t: number, end: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(t, Math.random() * 1.5);
  src.stop(end);
  return src;
}

export function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** A gain that rises to `level` in `attack` s and dies away by `end`. */
export function envelope(
  ctx: BaseAudioContext,
  t: number,
  level: number,
  attack: number,
  end: number,
) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  return g;
}

export function tone(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  t: number,
  end: number,
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.start(t);
  osc.stop(end);
  return osc;
}
