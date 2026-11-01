import { SHIPPED_CATALOGUE } from '../data/cosmetics';
import { damageStage, hullCondition } from '../sim/hazards';
import { clamp } from '../sim/math';
import { type FlagDef, shipPennant } from '../sim/regatta';
import { cleanLook, lookOf } from '../sim/shipLooks';
import type { TradeState } from '../sim/trade';
import BOAT_LOOK_FILE from '../data/boat-look.json';
import { wearFromSearch, wornLook, type WornLook } from './boatAppearance';
import { type BoatModel, type ShipUpgrades, type UpgradeLevel, createBoatModel } from './models';

const level = (n: number | undefined) => clamp(Math.round(n ?? 1), 1, 3) as UpgradeLevel;

/**
 * What the player's boat shows, and when it must be rebuilt: her class and upgrade levels
 * (decision 0016), damage step (0208), the pennant won (0217), her look (decision 0263, issue
 * #418) and the racing number while a race runs (the number hides the logo). `stale` compares
 * plain values each frame without allocating; `build` makes the model.
 */
export class PlayerBoat {
  private id = '';
  private levels = -1;
  private damage = -1;
  private flag: FlagDef | undefined;
  private racing = false;
  private lookRef: unknown = null;
  /** `?wear=` item ids for screenshots: they replace the stored look while set. */
  private readonly wear = wearFromSearch(typeof location === 'undefined' ? '' : location.search);
  /** The look the boat was last built with: its wake style and chosen flag. */
  worn: WornLook | null = null;

  /** True when the sailed ship's model no longer matches what was last built. */
  stale(trade: TradeState, pennant: FlagDef | undefined, racing: boolean): boolean {
    const { captain } = trade;
    const id = captain.activeShip;
    const lv = captain.ships[id];
    return (
      id !== this.id ||
      level(lv?.sails) * 100 + level(lv?.hold) * 10 + level(lv?.hull) !== this.levels ||
      damageStage(hullCondition(trade)) !== this.damage ||
      (pennant ?? shipPennant(id)) !== this.flag ||
      racing !== this.racing ||
      captain.looks?.[id] !== this.lookRef
    );
  }

  /** Whether the last build was another ship class (a new ship starts a fresh wake). */
  isShip(id: string) {
    return id === this.id;
  }

  build(trade: TradeState, pennant: FlagDef | undefined, racing: boolean): BoatModel {
    const { captain } = trade;
    const id = captain.activeShip;
    const lv = captain.ships[id];
    const upgrades: ShipUpgrades = {
      sails: level(lv?.sails),
      hold: level(lv?.hold),
      hull: level(lv?.hull),
    };
    this.id = id;
    this.levels = upgrades.sails * 100 + upgrades.hold * 10 + upgrades.hull;
    this.damage = damageStage(hullCondition(trade));
    this.flag = pennant ?? shipPennant(id);
    this.racing = racing;
    this.lookRef = captain.looks?.[id];
    const stored = lookOf(captain.looks, id);
    const wear = { ...stored, ...cleanLook(SHIPPED_CATALOGUE, this.wear, id) };
    this.worn = wornLook(wear, id);
    // A flag the captain chose flies over the pennant won.
    const flag = this.worn.flag ?? this.flag;
    return createBoatModel(id, {
      upgrades,
      damage: this.damage as 0 | 1 | 2 | 3,
      look: this.worn.look,
      ...(flag ? { flag } : {}),
      ...(racing ? { sailNumber: BOAT_LOOK_FILE.marks.player } : {}),
    });
  }
}
