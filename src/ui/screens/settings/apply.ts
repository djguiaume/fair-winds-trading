import type { World } from '../../../sim/world';
import { hazeSwitches } from '../../../sim/windZones';
import { type GraphicsView, applyGraphics } from '../../graphicsSettings';
import type { Settings } from '../../settings';

/** What the settings drive while the game runs. */
export interface SettingsTargets {
  world: World;
  view: GraphicsView & {
    dayNight: boolean;
    eruptions: boolean;
    wakeStyles: boolean;
  };
  hud: { quiet: boolean; compassOff: boolean };
  /** The camera's and the sea motion's own flags (cameraControls.ts). */
  camera: { sync(): void };
  /** The pad's button names: a brand, or null to follow the pad in use. */
  padGlyphs: (brand: string | null) => void;
}

/**
 * The one place the settings reach the game: every switch writes `settings`, then this pushes
 * all of it to the world, the view and the HUD. Cheap to call after any change.
 */
export class SettingsApplier {
  private waves: boolean | null | undefined;
  private padBrand: string | null | undefined;

  constructor(private readonly to: SettingsTargets) {}

  apply(s: Settings) {
    const { world, view, hud } = this.to;
    view.dayNight = s.dayNight;
    view.eruptions = s.eruptions;
    view.wakeStyles = s.wakeStyles;
    hud.quiet = s.quietHud;
    hud.compassOff = !s.windCompass;
    applyGraphics(view, s);
    if (s.waves !== this.waves) view.setWaves((this.waves = s.waves));
    world.dynamicWeather = s.weather;
    world.storms = s.storms;
    world.windZones = s.windZones;
    world.stormBelt = s.stormBelt;
    world.currentsOn = s.currents;
    world.bergsOn = s.bergs;
    world.seaDragOn = s.seaDrag;
    world.steadyWind = s.steadyWind;
    if (s.ships && !world.traffic.on) world.traffic.fresh = true;
    world.traffic.on = s.ships;
    world.hazeOff = hazeSwitches().filter((id) => s.haze[id] === false);
    this.to.camera.sync();
    if (s.padGlyphs !== this.padBrand) this.to.padGlyphs((this.padBrand = s.padGlyphs));
  }
}
