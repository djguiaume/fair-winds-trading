import { clamp } from './math';

/**
 * Day and night (decision 0068). One game day lasts 12 minutes: a long day, a short golden dusk, a
 * blue night that stays easy to sail in, and a quick dawn. A new voyage starts in the morning.
 * A pure function of game time like the weather, so a resumed voyage is at the same hour.
 */

/** Seconds of play per game day. */
export const DAY_SECONDS = 720;

/** Where each part of the day ends, in seconds from 7 o'clock in the morning. */
export const DAY_END = 420;
export const DUSK_END = 480;
export const NIGHT_END = 660;

export interface Daylight {
  /** Clock time 0..24, for a clock or a sun/moon icon. */
  hour: number;
  /** 0 = full day … 1 = full night. */
  night: number;
  /** 0..1: low warm sun around dusk and dawn. */
  warm: number;
  /** Compass bearing (radians) the light comes from: the sun by day, the moon by night. */
  lightBearing: number;
  /** 0..1 height of that light above the horizon. */
  lightHeight: number;
}

const smooth = (k: number) => {
  const x = clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Clock hours at the start of each segment (day, dusk, night, dawn) and at the end of the day. */
const SEGMENTS: [start: number, end: number, fromHour: number, toHour: number][] = [
  [0, DAY_END, 7, 19],
  [DAY_END, DUSK_END, 19, 21],
  [DUSK_END, NIGHT_END, 21, 29],
  [NIGHT_END, DAY_SECONDS, 29, 31],
];

export function daylightAt(t: number): Daylight {
  const s = ((t % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  const [a, b, h0, h1] = SEGMENTS.find(([, end]) => s < end) ?? SEGMENTS[SEGMENTS.length - 1]!;
  const hour = (h0 + ((s - a) / (b - a)) * (h1 - h0)) % 24;
  // Night falls through the dusk and lifts through the dawn.
  const night =
    s < DAY_END
      ? 0
      : s < DUSK_END
        ? smooth((s - DAY_END) / (DUSK_END - DAY_END))
        : s < NIGHT_END
          ? 1
          : 1 - smooth((s - NIGHT_END) / (DAY_SECONDS - NIGHT_END));
  // Warm light builds through the last hour of day, peaks as the sun sets, and comes back at dawn.
  const warm =
    s < DAY_END - 60
      ? Math.max(0, 1 - s / 50) * 0.6
      : s < DAY_END
        ? smooth((s - (DAY_END - 60)) / 60)
        : s < DUSK_END
          ? 1 - smooth((s - DAY_END) / (DUSK_END - DAY_END))
          : s < NIGHT_END
            ? 0
            : smooth((s - NIGHT_END) / (DAY_SECONDS - NIGHT_END)) * 0.6;
  // The sun rises in the east at 6 and sets in the west at 18 (northern summer, low in the south);
  // the moon takes the same path through the night.
  const arc = (((hour - 6 + 24) % 12) / 12) * Math.PI;
  return {
    hour,
    night,
    warm,
    lightBearing: Math.PI / 2 + arc,
    lightHeight: Math.max(0.15, Math.sin(arc)),
  };
}
