/**
 * Short synthesised sound effects, made on the spot like the music (decision 0045), so they add
 * nothing to the download. Every effect takes a `pitch` (1 = as written) from its line in
 * `audio.json`, so one bell rings at every port in its own voice (decision 0209).
 *
 * Budget for the old tablet: an effect is a handful of nodes for a second or two, started and
 * stopped on the audio clock; the noise is one buffer per context, shared.
 */

type Play = (ctx: BaseAudioContext, destination: AudioNode, level: number, pitch: number) => void;

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
function noise(ctx: BaseAudioContext, t: number, end: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(t, Math.random() * 1.5);
  src.stop(end);
  return src;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** A gain that rises to `level` in `attack` s and dies away by `end`. */
function envelope(ctx: BaseAudioContext, t: number, level: number, attack: number, end: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  return g;
}

function tone(ctx: BaseAudioContext, type: OscillatorType, freq: number, t: number, end: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.start(t);
  osc.stop(end);
  return osc;
}

/**
 * A wooden creak for a hull pressed too hard (decision 0078): a buzzy low tone through a narrow
 * band-pass that wobbles, like a mast working in its step. About half a second long. Pitched down
 * it is the north's far-off ice, kept wooden rather than eerie (decision 0209).
 */
export const playCreak: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70 * pitch, t);
  osc.frequency.linearRampToValueAtTime(95 * pitch, t + 0.25);
  osc.frequency.linearRampToValueAtTime(62 * pitch, t + 0.55);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 9;
  band.frequency.setValueAtTime(520 * pitch, t);
  band.frequency.linearRampToValueAtTime(760 * pitch, t + 0.3);
  band.frequency.linearRampToValueAtTime(480 * pitch, t + 0.55);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.06);
  gain.gain.setValueAtTime(level * 0.8, t + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  osc.connect(band).connect(gain).connect(destination);
  osc.start(t);
  osc.stop(t + 0.62);
};

/**
 * A foghorn far off (decision 0127): two low reedy tones a fifth apart, swelling and fading over
 * about two and a half seconds, through a low-pass so it sounds distant. Pitched at G3 and D4 with
 * the reed's overtones let through (decision 0139): a phone speaker plays almost nothing below
 * 200 Hz, so the first, lower horn was silent on phones.
 */
export const playFoghorn: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 1400;
  low.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.5);
  gain.gain.setValueAtTime(level * 0.85, t + 1.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  low.connect(gain).connect(destination);
  for (const [freq, share] of [
    [196 * pitch, 1],
    [294 * pitch, 0.55],
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
};

/**
 * A harbour bell rung twice: a few inharmonic partials of a cast bell, the high ones dying first.
 * `pitch` gives each port its own bell, big towns lower, outposts a handbell (decision 0209).
 */
export const playBell: Play = (ctx, destination, level, pitch = 1) => {
  const base = 520 * pitch;
  // Small bells ring shorter.
  const ring = Math.min(3.2, 2.4 / Math.sqrt(pitch));
  for (const strike of [0, 0.85]) {
    const t = ctx.currentTime + 0.02 + strike;
    for (const [ratio, share, life] of [
      [1, 1, 1],
      [2, 0.5, 0.7],
      [2.76, 0.35, 0.5],
      [5.4, 0.15, 0.25],
    ] as const) {
      const g = envelope(ctx, t, level * share * 0.45, 0.004, t + ring * life);
      tone(ctx, 'sine', base * ratio, t, t + ring * life + 0.05)
        .connect(g)
        .connect(destination);
    }
  }
};

/** The sail snapping across as she tacks or gybes: three quick claps of canvas. */
export const playFlap: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const band = filter(ctx, 'bandpass', 650 * pitch, 1.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  for (const [at, k] of [
    [0, 1],
    [0.11, 0.7],
    [0.24, 0.45],
  ] as const) {
    g.gain.linearRampToValueAtTime(level * k, t + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.09);
  }
  noise(ctx, t, t + 0.4)
    .connect(band)
    .connect(g)
    .connect(destination);
};

/** A hull striking: a low drop in pitch with a dull knock of wood on it (decision 0209). */
export const playThud: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const osc = tone(ctx, 'sine', 95 * pitch, t, t + 0.6);
  osc.frequency.exponentialRampToValueAtTime(38 * pitch, t + 0.35);
  osc.connect(envelope(ctx, t, level, 0.005, t + 0.55)).connect(destination);
  const knock = filter(ctx, 'lowpass', 420 * pitch, 1.5);
  noise(ctx, t, t + 0.3)
    .connect(knock)
    .connect(envelope(ctx, t, level * 0.8, 0.003, t + 0.25))
    .connect(destination);
};

/** The regatta's start horn: a bright two-reed blast, a second and a bit. */
export const playHorn: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const low = filter(ctx, 'lowpass', 2600, 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level * 0.5, t + 0.04);
  g.gain.setValueAtTime(level * 0.45, t + 1.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
  low.connect(g).connect(destination);
  for (const f of [440 * pitch, 554 * pitch]) tone(ctx, 'square', f, t, t + 1.4).connect(low);
};

/** The committee boat's gun at the start and finish: a crack, then the bang rolling away. */
export const playGun: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(2200 * pitch, t);
  low.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.5);
  noise(ctx, t, t + 1.2)
    .connect(low)
    .connect(envelope(ctx, t, level, 0.002, t + 1.1))
    .connect(destination);
  const thump = tone(ctx, 'sine', 70 * pitch, t, t + 0.4);
  thump.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  thump.connect(envelope(ctx, t, level * 0.8, 0.002, t + 0.35)).connect(destination);
};

/**
 * A gull's cry, "kee-ow" two to four times. Higher `pitch` is a tern or a kittiwake (decision
 * 0208): a reedy tone through a nasal band, gliding down.
 */
export const playGull: Play = (ctx, destination, level, pitch = 1) => {
  const cries = 2 + Math.floor(Math.random() * 3);
  for (let k = 0; k < cries; k++) {
    const t = ctx.currentTime + 0.02 + k * (0.32 + Math.random() * 0.08);
    const f = 1250 * pitch * (1 - k * 0.04);
    const osc = tone(ctx, 'sawtooth', f, t, t + 0.3);
    osc.frequency.linearRampToValueAtTime(f * 1.15, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.26);
    const band = filter(ctx, 'bandpass', 1900 * pitch, 3);
    osc
      .connect(band)
      .connect(envelope(ctx, t, level * (1 - k * 0.15), 0.03, t + 0.28))
      .connect(destination);
  }
};

/** An eider's soft "ah-ooo", rising then sinking: the north's ducks near Rimewick. */
export const playCoo: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const osc = tone(ctx, 'triangle', 290 * pitch, t, t + 0.8);
  osc.frequency.linearRampToValueAtTime(420 * pitch, t + 0.35);
  osc.frequency.linearRampToValueAtTime(330 * pitch, t + 0.7);
  osc
    .connect(filter(ctx, 'lowpass', 1200, 0.7))
    .connect(envelope(ctx, t, level, 0.12, t + 0.75))
    .connect(destination);
};

/** A glacier calving far off: a hollow knock of ice, then the ice going in with a soft wash. */
export const playCrack: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  for (const [at, f] of [
    [0, 880],
    [0.09, 660],
  ] as const) {
    tone(ctx, 'sine', f * pitch, t + at, t + at + 0.2)
      .connect(envelope(ctx, t + at, level * 0.5, 0.002, t + at + 0.15))
      .connect(destination);
  }
  const fall = t + 0.4;
  noise(ctx, fall, fall + 2.2)
    .connect(filter(ctx, 'lowpass', 260 * pitch, 0.7))
    .connect(envelope(ctx, fall, level * 0.8, 0.4, fall + 2.1))
    .connect(destination);
};

/**
 * A low roll: a volcano waking (tied to its eruption, decision 0178) or, pitched up, thunder in a
 * storm. A soft timpani roll under a little dull noise, storybook rather than a recording, and
 * short: never a sustained drone (art bible rule 3).
 */
export const playRumble: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  // Up to the low mids: a phone speaker plays next to nothing under 200 Hz (decision 0139).
  const hits = 9;
  for (let k = 0; k < hits; k++) {
    const at = t + k * 0.16 + Math.random() * 0.04;
    const swell = Math.sin((Math.PI * (k + 1)) / (hits + 1));
    const f = (110 + Math.random() * 12) * pitch;
    const drum = tone(ctx, 'triangle', f, at, at + 0.7);
    drum.frequency.exponentialRampToValueAtTime(f * 0.8, at + 0.5);
    drum
      .connect(filter(ctx, 'lowpass', 600 * pitch, 0.7))
      .connect(envelope(ctx, at, level * 0.55 * swell, 0.01, at + 0.6))
      .connect(destination);
  }
  noise(ctx, t, t + 2.2)
    .connect(filter(ctx, 'lowpass', 220 * pitch, 0.7))
    .connect(envelope(ctx, t, level * 0.35, 0.5, t + 2.1))
    .connect(destination);
};

/** Lava meeting the sea at a vent: a soft hiss with bubbles popping in it, each a little rising blip. */
export const playHiss: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  noise(ctx, t, t + 1.9)
    .connect(filter(ctx, 'bandpass', 1800 * pitch, 1.5))
    .connect(envelope(ctx, t, level * 0.35, 0.2, t + 1.8))
    .connect(destination);
  for (let k = 0; k < 10; k++) {
    const at = t + 0.15 + k * 0.13 + Math.random() * 0.06;
    const f = (320 + Math.random() * 260) * pitch;
    const blip = tone(ctx, 'sine', f, at, at + 0.1);
    blip.frequency.exponentialRampToValueAtTime(f * 1.8, at + 0.07);
    blip.connect(envelope(ctx, at, level * 0.5, 0.005, at + 0.08)).connect(destination);
  }
};

/** One wave breaking on a reef or a beach: the wash rises, brightens and draws back. */
export const playSurf: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(300 * pitch, t);
  low.frequency.linearRampToValueAtTime(900 * pitch, t + 0.7);
  low.frequency.linearRampToValueAtTime(400 * pitch, t + 2.2);
  noise(ctx, t, t + 2.4)
    .connect(low)
    .connect(envelope(ctx, t, level, 0.6, t + 2.3))
    .connect(destination);
};

/** Palm fronds rustling in a gust ashore. */
export const playRustle: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  for (let k = 0; k < 7; k++)
    g.gain.linearRampToValueAtTime(level * (0.4 + Math.random() * 0.6), t + 0.15 + k * 0.22);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
  noise(ctx, t, t + 2.1)
    .connect(filter(ctx, 'bandpass', 2600 * pitch, 2))
    .connect(g)
    .connect(destination);
};

/** A sheep on the turf: a bleat with a quick shake in it. */
export const playBleat: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const osc = tone(ctx, 'sawtooth', 360 * pitch, t, t + 0.7);
  osc.frequency.linearRampToValueAtTime(330 * pitch, t + 0.6);
  const shake = tone(ctx, 'sine', 7, t, t + 0.7);
  const depth = ctx.createGain();
  depth.gain.value = 22 * pitch;
  shake.connect(depth).connect(osc.frequency);
  osc
    .connect(filter(ctx, 'bandpass', 950, 2))
    .connect(envelope(ctx, t, level, 0.05, t + 0.65))
    .connect(destination);
};

/** The effects made in code, by the name `audio.json` gives them in `synth`. */
export const SYNTHS = {
  creak: playCreak,
  foghorn: playFoghorn,
  bell: playBell,
  flap: playFlap,
  thud: playThud,
  horn: playHorn,
  gun: playGun,
  gull: playGull,
  coo: playCoo,
  crack: playCrack,
  rumble: playRumble,
  hiss: playHiss,
  surf: playSurf,
  rustle: playRustle,
  bleat: playBleat,
} satisfies Record<string, Play>;
