import { t, weatherName } from '../../i18n';
import { windForecast } from '../../sim/forecast';
import { USUAL_WEATHER } from '../../sim/wind';
import type { World } from '../../sim/world';
import { compassPoint, setHidden, setText } from './parts';

/** A wind zone's name for the HUD, its id when it has none. */
export function zoneName(world: World, id: string): string {
  return world.map.windZones?.find((z) => z.id === id)?.name ?? id;
}

/**
 * The small lines under the breeze (decisions 0067, 0136, 0167): the weather when it is not a
 * plain breeze, the weather glass's forecast and the storm belt near the boat. Storms and squalls
 * read in the storm amber, which the Stormbreak keeps (issue #441).
 */
export class WindLines {
  private sinceForecast = Infinity;

  constructor(
    private readonly weather: HTMLElement,
    private readonly forecast: HTMLElement,
    private readonly belt: HTMLElement,
  ) {}

  /** About eight times a second. */
  show(world: World, dt: number) {
    const kind = world.weather.storm > 0.15 ? 'storm' : world.weather.kind;
    setHidden(this.weather, kind === USUAL_WEATHER);
    if (this.weather.dataset.kind !== kind) {
      this.weather.dataset.kind = kind;
      this.weather.textContent = weatherName(kind);
    }
    this.showForecast(world, dt);
    this.showBelt(world);
  }

  /** The weather glass, twice a second. */
  private showForecast(world: World, dt: number) {
    this.sinceForecast += dt;
    if (this.sinceForecast < 0.5) return;
    this.sinceForecast = 0;
    const f = windForecast(world);
    setHidden(this.forecast, !f);
    if (!f) return;
    const minutes = f.aheadSec % 60 === 0;
    const time = t(minutes ? 'unit.minutes' : 'unit.seconds', {
      n: minutes ? f.aheadSec / 60 : Math.round(f.aheadSec),
    });
    const storm = f.storm > 0.15;
    const weather = storm ? 'storm' : f.kind;
    const extra = weather === USUAL_WEATHER ? '' : ` · ${weatherName(weather)}`;
    this.forecast.toggleAttribute('data-storm', storm);
    setText(
      this.forecast,
      t('hud.forecast', { time, dir: compassPoint(f.from), kn: f.speedKn.toFixed(0), extra }),
    );
  }

  /** Squalls or a lull in the belt, and for how long: about a minute, tens of seconds near. */
  private showBelt(world: World) {
    const belt = world.belt;
    setHidden(this.belt, !belt);
    if (!belt) return;
    const s = belt.changeSec;
    const time =
      s >= 90
        ? t('unit.minutes', { n: Math.round(s / 60) })
        : t('unit.seconds', { n: Math.max(10, Math.round(s / 10) * 10) });
    this.belt.toggleAttribute('data-squalls', belt.squalls);
    // Keep "30 s" and "2 min" on one line.
    setText(
      this.belt,
      t(belt.squalls ? 'hud.beltSqualls' : 'hud.beltLull', {
        name: zoneName(world, belt.zone),
        time: time.replace(' ', ' '),
      }),
    );
  }
}
