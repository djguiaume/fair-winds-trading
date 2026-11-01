import { TUNING } from '../data/tuning';
import { clamp } from './math';

/**
 * Day and night (decision 0068). One game day lasts 12 minutes: a long day, a short golden dusk, a
 * blue night that stays easy to sail in, and a quick dawn. A new voyage starts in the morning.
 * A pure function of game time like the weather, so a resumed voyage is at the same hour.
 */

/*
 * `src/data/tuning/weather.json` › `daylight` (decision 0094): `daySeconds` of play per game day,
 * and where each part of the day ends (`dayEnd`, `duskEnd`, `nightEnd`), in seconds from 7 o'clock
 * in the morning.
 */

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

/** Clock hours at the start of each part of the day (day, dusk, night, dawn) and at its end. */
function daySegments(): [start: number, end: number, fromHour: number, toHour: number][] {
  const { daySeconds, dayEnd, duskEnd, nightEnd } = TUNING.weather.daylight;
  return [
    [0, dayEnd, 7, 19],
    [dayEnd, duskEnd, 19, 21],
    [duskEnd, nightEnd, 21, 29],
    [nightEnd, daySeconds, 29, 31],
  ];
}

/** Seconds into a game day at a clock hour (0..24): `daylightAt`'s hour read backwards. */
export function secondsAtHour(hour: number): number {
  const h = hour < 7 ? hour + 24 : hour;
  const [a, b, h0, h1] = daySegments().find(([, , , to]) => h < to) ?? daySegments()[3]!;
  return a + ((h - h0) / (h1 - h0)) * (b - a);
}

export function daylightAt(t: number): Daylight {
  const {
    daySeconds: DAY_SECONDS,
    dayEnd: DAY_END,
    duskEnd: DUSK_END,
    nightEnd: NIGHT_END,
  } = TUNING.weather.daylight;
  const SEGMENTS = daySegments();
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

/** Game time whose light is kept when day and night is off: early afternoon. */
const ALWAYS_DAY = 200;

/** The light the player sees: the real time of day, or early afternoon with day and night off. */
export const shownDaylightAt = (dayNight: boolean, t: number): Daylight =>
  daylightAt(dayNight ? t : ALWAYS_DAY);
