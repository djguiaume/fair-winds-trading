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
