import { TUNING } from '../data/tuning';
import { applyPerks } from './perks';
import { type WeatherKind, type LocalWeather, windAt } from './wind';
import type { World } from './world';

/**
 * The weather glass's forecast (decisions 0126, 0136): the sea wind where she is, the building's
 * number of seconds ahead (`windForecast` in `src/data/buildings.json`). The wind is worked out
 * from the clock and the map's seed, so the forecast is what will come, smoothed over a few
 * samples (`economy.json` › `home.forecastSmoothSec`) so a passing gust does not swing it. Island
 * shelter is left out: it says what the sea will do, as a glass would.
 */
export interface Forecast {
  /** Seconds ahead. */
  aheadSec: number;
  /** Compass bearing the wind will blow from, radians. */
  from: number;
  speedKn: number;
  kind: WeatherKind;
  /** 0..1: how hard a storm will hit here. */
  storm: number;
}

const SAMPLES = 5;

/** The forecast, or null without a weather glass on any of her islands. */
export function windForecast(world: World): Forecast | null {
  const aheadSec = applyPerks(world.trade.home, 'forecastSec', 0);
  if (aheadSec <= 0) return null;
  const cfg = world.windConfig ?? world.map.wind;
  const spread = TUNING.economy.home.forecastSmoothSec;
  let x = 0,
    y = 0,
    speed = 0,
    storm = 0;
  const at = world.time + aheadSec;
  const weather = {} as LocalWeather;
  let kind: WeatherKind = world.weather.kind;
  for (let i = 0; i < SAMPLES; i++) {
    const t = at + (SAMPLES > 1 ? (i / (SAMPLES - 1) - 0.5) * spread : 0);
    const w = windAt(cfg, t, world.map.seed, world.boat, weather);
    x += Math.sin(w.from);
    y += Math.cos(w.from);
    speed += w.speedKn;
    storm = Math.max(storm, weather.storm);
    if (i === (SAMPLES - 1) / 2) kind = weather.kind;
  }
  const from = Math.atan2(x, y);
  return {
    aheadSec,
    from: from < 0 ? from + 2 * Math.PI : from,
    speedKn: speed / SAMPLES,
    kind,
    storm,
  };
}
