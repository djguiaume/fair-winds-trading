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

// --- Sounds built from what makes the real one (Guillaume's second listen, 2026-10-25) --------

/** A soft saturator, so low sounds grow overtones a phone speaker can play (decision 0139). */
function warm(ctx: BaseAudioContext, amount = 2.5): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  shaper.curve = curve;
  return shaper;
}

/**
 * Stick-slip friction, what a creak really is: a train of tiny clicks whose rate glides (wood
 * grabbing and slipping), rung through the body's resonances. `rate` is clicks a second at the
 * start, middle and end; `bodies` the resonances in Hz.
 */
function stickSlip(
  ctx: BaseAudioContext,
  destination: AudioNode,
  level: number,
  secs: number,
  rate: [number, number, number],
  bodies: number[],
  q: number,
) {
  const t = ctx.currentTime + 0.02;
  const n = Math.round(ctx.sampleRate * secs);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let at = 0;
  while (at < n) {
    const k = at / n;
    const r =
      k < 0.5
        ? rate[0] + (rate[1] - rate[0]) * k * 2
        : rate[1] + (rate[2] - rate[1]) * (k - 0.5) * 2;
    // Louder in the middle of the creak, each click a little different.
    const amp = Math.sin(Math.PI * k) ** 0.6 * (0.6 + Math.random() * 0.4);
    data[at] = amp;
    if (at + 1 < n) data[at + 1] = -amp * 0.6;
    at += Math.max(2, Math.round((ctx.sampleRate / r) * (0.85 + Math.random() * 0.3)));
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const out = ctx.createGain();
  out.gain.value = level * 18;
  out.connect(destination);
  for (const f of bodies) src.connect(filter(ctx, 'bandpass', f, q)).connect(out);
  src.start(t);
}

/**
 * A wooden creak for a hull pressed too hard (decision 0078): the mast working in its step, rising
 * then easing (stick-slip).
 */
export const playCreak: Play = (ctx, destination, level, pitch = 1) =>
  stickSlip(
    ctx,
    destination,
    level,
    0.7,
    [35 * pitch, 90 * pitch, 50 * pitch],
    [420 * pitch, 980 * pitch, 1900 * pitch],
    6,
  );

/** Sea ice: a long slow groan of floes pressing (very slow stick-slip, low, ringing). */
export const playIceGroan: Play = (ctx, destination, level, pitch = 1) =>
  stickSlip(
    ctx,
    destination,
    level,
    1.6,
    [8 * pitch, 18 * pitch, 6 * pitch],
    [180 * pitch, 520 * pitch, 1300 * pitch],
    12,
  );

/** Sea ice: far-off ice cracking: a few sharp snaps that ring, like a frozen lake singing. */
export const playIcePing: Play = (ctx, destination, level, pitch = 1) => {
  const snaps = 3 + Math.floor(Math.random() * 3);
  for (let k = 0; k < snaps; k++) {
    const t = ctx.currentTime + 0.02 + k * (0.12 + Math.random() * 0.25);
    // The snap: a click of noise; the ring: a falling, metallic chirp ("pew") as in lake ice.
    noise(ctx, t, t + 0.03)
      .connect(filter(ctx, 'highpass', 2500, 0.7))
      .connect(envelope(ctx, t, level * 0.6, 0.001, t + 0.025))
      .connect(destination);
    const f = (2400 + Math.random() * 1200) * pitch;
    const chirp = tone(ctx, 'sine', f, t, t + 0.45);
    chirp.frequency.exponentialRampToValueAtTime(f * 0.18, t + 0.4);
    chirp.connect(envelope(ctx, t, level * 0.35, 0.002, t + 0.4)).connect(destination);
  }
};

/** Formant filters for a voiced sound: parallel band-passes at a vowel's resonances. */
function vowel(
  ctx: BaseAudioContext,
  input: AudioNode,
  out: AudioNode,
  formants: [number, number, number][],
) {
  for (const [f, q, gain] of formants) {
    const g = ctx.createGain();
    g.gain.value = gain;
    input
      .connect(filter(ctx, 'bandpass', f, q))
      .connect(g)
      .connect(out);
  }
}

/** The north's ducks near Rimewick: a "quack quack": short nasal buzzes with a falling pitch. */
export const playQuack: Play = (ctx, destination, level, pitch = 1) => {
  const quacks = 2 + Math.floor(Math.random() * 2);
  for (let k = 0; k < quacks; k++) {
    const t = ctx.currentTime + 0.02 + k * 0.26;
    const f = 300 * pitch * (1 - k * 0.05);
    const osc = tone(ctx, 'sawtooth', f, t, t + 0.2);
    osc.frequency.linearRampToValueAtTime(f * 1.08, t + 0.03);
    osc.frequency.exponentialRampToValueAtTime(f * 0.78, t + 0.17);
    const env = envelope(ctx, t, level * 1.6, 0.012, t + 0.18);
    vowel(ctx, osc, env, [
      [900 * pitch, 6, 1],
      [1600 * pitch, 8, 0.8],
      [2700 * pitch, 8, 0.4],
    ]);
    env.connect(destination);
  }
};

/** A sheep on Fogwatch's turf, "baa-aa": a buzzy voice through an "a" vowel, its loudness shaking 7 times a second. */
export const playBaa: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const end = t + 0.95;
  const osc = tone(ctx, 'sawtooth', 190 * pitch, t, end);
  osc.frequency.linearRampToValueAtTime(215 * pitch, t + 0.12);
  osc.frequency.linearRampToValueAtTime(175 * pitch, t + 0.9);
  const shake = ctx.createGain();
  shake.gain.value = 0.6;
  const lfo = tone(ctx, 'sine', 7.5, t, end);
  const depth = ctx.createGain();
  depth.gain.value = 0.4;
  lfo.connect(depth).connect(shake.gain);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  // The "b": a closed mouth opening.
  env.gain.linearRampToValueAtTime(level * 1.4, t + 0.09);
  env.gain.setValueAtTime(level * 1.4, t + 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.92);
  const open = filter(ctx, 'lowpass', 400, 0.7);
  open.frequency.setValueAtTime(400, t);
  open.frequency.linearRampToValueAtTime(4000, t + 0.1);
  osc.connect(open).connect(shake);
  vowel(ctx, shake, env, [
    [750 * pitch, 5, 1],
    [1250 * pitch, 6, 0.7],
    [2600 * pitch, 8, 0.35],
  ]);
  env.connect(destination);
};

/** Ragged loudness: random steps every `step` seconds, for rolling thunder and earth rumble. */
function ragged(g: GainNode, t: number, secs: number, step: number, level: number, decay: number) {
  g.gain.setValueAtTime(0, t);
  for (let at = 0; at < secs; at += step * (0.6 + Math.random() * 0.8)) {
    const fade = Math.exp(-at / decay);
    g.gain.linearRampToValueAtTime(level * fade * (0.35 + Math.random() * 0.65), t + at);
  }
  g.gain.linearRampToValueAtTime(0, t + secs);
}

/** A volcano erupting (decision 0178): a deep boom from the cone, then the earth rolling, warmed so phones hear it. */
export const playBoom: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const shaper = warm(ctx, 3);
  const out = ctx.createGain();
  out.gain.value = 0.8;
  shaper.connect(out).connect(destination);
  const thump = tone(ctx, 'sine', 70 * pitch, t, t + 1.4);
  thump.frequency.exponentialRampToValueAtTime(32 * pitch, t + 1.2);
  thump.connect(envelope(ctx, t, level * 1.2, 0.01, t + 1.3)).connect(shaper);
  const roll = ctx.createGain();
  ragged(roll, t + 0.1, 3.4, 0.07, level * 0.9, 1.6);
  noise(ctx, t, t + 3.6)
    .connect(filter(ctx, 'lowpass', 180 * pitch, 0.9))
    .connect(roll)
    .connect(shaper);
};

/** Thunder in a storm: no crack, only a long low roll a few miles off. */
export const playThunder: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  const shaper = warm(ctx, 2.5);
  shaper.connect(destination);
  const roll = ctx.createGain();
  ragged(roll, t, 4.5, 0.12, level, 2);
  const swell = ctx.createGain();
  swell.gain.setValueAtTime(0.3, t);
  swell.gain.linearRampToValueAtTime(1, t + 0.8);
  swell.gain.linearRampToValueAtTime(0.2, t + 4.5);
  noise(ctx, t, t + 4.6)
    .connect(filter(ctx, 'lowpass', 260 * pitch, 0.8))
    .connect(roll)
    .connect(swell)
    .connect(shaper);
};

/** A glacier calving, heard far off across the water: one long splitting groan, then a distant boom and wash. */
export const playCalving: Play = (ctx, destination, level, pitch = 1) => {
  stickSlip(
    ctx,
    destination,
    level * 0.8,
    0.9,
    [15 * pitch, 40 * pitch, 70 * pitch],
    [250 * pitch, 700 * pitch, 1500 * pitch],
    9,
  );
  const fall = ctx.currentTime + 1.1;
  const shaper = warm(ctx, 3);
  shaper.connect(destination);
  const roll = ctx.createGain();
  ragged(roll, fall, 2.6, 0.08, level, 1.2);
  noise(ctx, fall, fall + 2.7)
    .connect(filter(ctx, 'lowpass', 400 * pitch, 0.8))
    .connect(roll)
    .connect(shaper);
};

/** The effects made in code, by the name `audio.json` gives them in `synth`. */
export const SYNTHS = {
  creak: playCreak,
  foghorn: playFoghorn,
  bell: playBell,
  flap: playFlap,
  thud: playThud,
  horn: playHorn,
  gull: playGull,
  quack: playQuack,
  'ice-groan': playIceGroan,
  'ice-ping': playIcePing,
  calving: playCalving,
  boom: playBoom,
  thunder: playThunder,
  hiss: playHiss,
  surf: playSurf,
  rustle: playRustle,
  baa: playBaa,
} satisfies Record<string, Play>;
