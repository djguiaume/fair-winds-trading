import { type Play, envelope, filter, noise, tone } from './nodes';

/**
 * The interface's sounds (decision 0274), synthesised like the rest and named by `synth` in
 * `audio.json`: presses, a coin tick, the ink stamp, an arrival chime and the title's sting. All
 * are a handful of nodes for well under a second (the sting, two); `pitch` shifts each as it does
 * for the effects of `sfx.ts`.
 */

/** A note that rings and dies: `peak` at `at`, gone `ring` seconds later. */
function note(
  ctx: BaseAudioContext,
  destination: AudioNode,
  freq: number,
  at: number,
  ring: number,
  peak: number,
  type: OscillatorType = 'sine',
) {
  const g = envelope(ctx, at, peak, 0.006, at + ring);
  tone(ctx, type, freq, at, at + ring + 0.05)
    .connect(g)
    .connect(destination);
}

/** A button pressed: a dry wooden tap. */
export const playPress: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.01;
  note(ctx, destination, 240 * pitch, t, 0.07, level * 0.5, 'triangle');
  const g = envelope(ctx, t, level * 0.25, 0.002, t + 0.04);
  noise(ctx, t, t + 0.05)
    .connect(filter(ctx, 'bandpass', 1800 * pitch, 1.2))
    .connect(g)
    .connect(destination);
};

/** A choice made: two notes rising a fifth. */
export const playConfirm: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.01;
  note(ctx, destination, 523 * pitch, t, 0.12, level * 0.4);
  note(ctx, destination, 784 * pitch, t + 0.07, 0.2, level * 0.4);
};

/** A step back: two notes falling. */
export const playBack: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.01;
  note(ctx, destination, 523 * pitch, t, 0.1, level * 0.35);
  note(ctx, destination, 392 * pitch, t + 0.06, 0.16, level * 0.35);
};

/** A tab changed: one light pip. */
export const playTab: Play = (ctx, destination, level, pitch = 1) => {
  note(ctx, destination, 880 * pitch, ctx.currentTime + 0.01, 0.07, level * 0.35, 'triangle');
};

/** Not allowed: two low dull pulses. */
export const playError: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.01;
  const low = filter(ctx, 'lowpass', 700, 0.7);
  low.connect(destination);
  for (const at of [0, 0.11]) note(ctx, low, 165 * pitch, t + at, 0.09, level * 0.5, 'square');
};

/** A coin counted: a bright two-partial ding. */
export const playCoin: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.01;
  note(ctx, destination, 1760 * pitch, t, 0.13, level * 0.3);
  note(ctx, destination, 2637 * pitch, t + 0.045, 0.2, level * 0.25);
};

/** An ink stamp pressed on paper: a low thump and a papery slap. */
export const playStamp: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.01;
  const thump = ctx.createOscillator();
  thump.frequency.setValueAtTime(130 * pitch, t);
  thump.frequency.exponentialRampToValueAtTime(55 * pitch, t + 0.12);
  thump.start(t);
  thump.stop(t + 0.2);
  thump.connect(envelope(ctx, t, level * 0.8, 0.003, t + 0.18)).connect(destination);
  const slap = envelope(ctx, t, level * 0.35, 0.002, t + 0.08);
  noise(ctx, t, t + 0.1)
    .connect(filter(ctx, 'lowpass', 1400 * pitch, 0.7))
    .connect(slap)
    .connect(destination);
};

/** A port in sight: a soft chime, a fifth apart. */
export const playChime: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.02;
  note(ctx, destination, 659 * pitch, t, 0.9, level * 0.3);
  note(ctx, destination, 988 * pitch, t + 0.16, 1.3, level * 0.26);
};

/** The title's first sting: a bell strike under a rising open chord, about two seconds. */
export const playSting: Play = (ctx, destination, level, pitch = 1) => {
  const t = ctx.currentTime + 0.03;
  for (const [ratio, share, life] of [
    [1, 1, 2.2],
    [2.76, 0.4, 1.2],
  ] as const)
    note(ctx, destination, 392 * ratio * pitch, t, life, level * 0.4 * share);
  [293.7, 440, 587.3].forEach((f, i) => {
    const at = t + 0.25 + i * 0.22;
    const g = envelope(ctx, at, level * 0.22, 0.25, at + 1.6);
    tone(ctx, 'triangle', f * pitch, at, at + 1.7)
      .connect(g)
      .connect(destination);
  });
};

/** The interface's effects, by the name `audio.json` gives them in `synth`. */
export const UI_SYNTHS = {
  press: playPress,
  confirm: playConfirm,
  back: playBack,
  tab: playTab,
  error: playError,
  coin: playCoin,
  stamp: playStamp,
  chime: playChime,
  sting: playSting,
} satisfies Record<string, Play>;
