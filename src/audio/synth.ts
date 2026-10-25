/**
 * Plays composed notes on three cheap Web Audio instruments: flute, pad and bass (decision
 * 0045). Works on any BaseAudioContext, so the same code plays live in the game and renders
 * offline to a file.
 *
 * Budget for old phones: every note is one oscillator with a gain envelope; the filters, the
 * flute's vibrato and the echo are shared, built once.
 */
import { midiToHz, THEME, type Note } from './composer';

export interface Band {
  ctx: BaseAudioContext;
  /** Master volume (the player's music setting). */
  out: GainNode;
  pad: AudioNode;
  bass: AudioNode;
  flute: AudioNode;
  vibrato: AudioNode;
  /** The flute's echo send: each sea's theme sets its own (decision 0209). */
  echo: GainNode;
}

/** Build the shared mixing desk: one filtered bus per instrument, an echo on the flute. */
export function createBand(
  ctx: BaseAudioContext,
  destination: AudioNode = ctx.destination,
  echo = THEME.echo,
): Band {
  const out = ctx.createGain();
  out.connect(destination);

  // Soft master limiter so stacked notes never clip.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(out);

  const bus = (gain: number, cutoff: number) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    filter.connect(g).connect(comp);
    return filter;
  };

  const flute = bus(0.32, 3200);
  // A light echo, like playing on deck with the sea around: delay with filtered feedback.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.36;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  const wet = ctx.createGain();
  wet.gain.value = echo;
  flute.connect(delay).connect(tone).connect(feedback).connect(delay);
  tone.connect(wet).connect(comp);

  const vibratoOsc = ctx.createOscillator();
  vibratoOsc.frequency.value = 5.2;
  const vibrato = ctx.createGain();
  vibrato.gain.value = 9; // cents
  vibratoOsc.connect(vibrato);
  vibratoOsc.start();

  return { ctx, out, pad: bus(0.1, 900), bass: bus(0.3, 500), flute, vibrato, echo: wet };
}

/** Schedule one note, starting `time` seconds on the context clock, `secs` long. */
export function playNote(band: Band, note: Note, time: number, secs: number) {
  const { ctx } = band;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiToHz(note.midi);
  const env = ctx.createGain();
  env.gain.value = 0;
  osc.connect(env);
  const g = env.gain;
  let end = time + secs;

  switch (note.voice) {
    case 'pad': {
      const attack = Math.min(0.9, secs * 0.4);
      g.setValueAtTime(0, time);
      g.linearRampToValueAtTime(note.vel, time + attack);
      g.setValueAtTime(note.vel, end);
      g.linearRampToValueAtTime(0, end + 0.9);
      end += 0.9;
      env.connect(band.pad);
      break;
    }
    case 'bass':
      g.setValueAtTime(0, time);
      g.linearRampToValueAtTime(note.vel, time + 0.02);
      g.exponentialRampToValueAtTime(note.vel * 0.5, time + Math.max(0.05, secs * 0.8));
      g.linearRampToValueAtTime(0, end + 0.12);
      end += 0.12;
      env.connect(band.bass);
      break;
    case 'melody':
      band.vibrato.connect(osc.detune);
      g.setValueAtTime(0, time);
      g.linearRampToValueAtTime(note.vel, time + 0.06);
      g.linearRampToValueAtTime(note.vel * 0.8, time + Math.max(0.07, secs * 0.6));
      g.linearRampToValueAtTime(0, end + 0.1);
      end += 0.1;
      env.connect(band.flute);
      break;
  }

  osc.start(time);
  osc.stop(end + 0.05);
  // Unhook the note once done, vibrato link included, so live play doesn't pile them up.
  osc.onended = () => {
    env.disconnect();
    if (note.voice === 'melody') band.vibrato.disconnect(osc.detune);
  };
}
