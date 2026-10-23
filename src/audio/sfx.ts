/**
 * Short synthesised sound effects, made on the spot like the music (decision 0045), so they add
 * nothing to the download.
 */

/**
 * A wooden creak for a hull pressed too hard (decision 0078): a buzzy low tone through a narrow
 * band-pass that wobbles, like a mast working in its step. About half a second long.
 */
export function playCreak(ctx: BaseAudioContext, destination: AudioNode, level: number) {
  const t = ctx.currentTime + 0.02;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.linearRampToValueAtTime(95, t + 0.25);
  osc.frequency.linearRampToValueAtTime(62, t + 0.55);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 9;
  band.frequency.setValueAtTime(520, t);
  band.frequency.linearRampToValueAtTime(760, t + 0.3);
  band.frequency.linearRampToValueAtTime(480, t + 0.55);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.06);
  gain.gain.setValueAtTime(level * 0.8, t + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  osc.connect(band).connect(gain).connect(destination);
  osc.start(t);
  osc.stop(t + 0.62);
}

/**
 * A foghorn far off (decision 0127): two low reedy tones a fifth apart, swelling and fading over
 * about two and a half seconds, through a low-pass so it sounds distant.
 */
export function playFoghorn(ctx: BaseAudioContext, destination: AudioNode, level: number) {
  const t = ctx.currentTime + 0.02;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 420;
  low.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.5);
  gain.gain.setValueAtTime(level * 0.85, t + 1.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  low.connect(gain).connect(destination);
  for (const [freq, share] of [
    [98, 1],
    [147, 0.55],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.97, t);
    osc.frequency.linearRampToValueAtTime(freq, t + 0.4);
    const part = ctx.createGain();
    part.gain.value = share * 0.5;
    osc.connect(part).connect(low);
    osc.start(t);
    osc.stop(t + 2.7);
  }
}
