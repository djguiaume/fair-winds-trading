import { SHIPPED_CATALOGUE } from '../../data/cosmetics';
import { isUnlocked } from '../../sim/cosmeticUnlocks';
import { daylightAt } from '../../sim/daylight';
import { damageStage, hullCondition } from '../../sim/hazards';
import type { QuestBook } from '../../sim/quests';
import { pennantFor } from '../../sim/regatta';
import { setShipLook, shipLook } from '../../sim/shipLooks';
import type { World } from '../../sim/world';
import type { QualityLevel } from '../../render/quality';
import type { UpgradeLevel } from '../../render/models';
import { type BoatLooksHost, type OwnedShip, BoatLooksScreen } from './screen';

/** What of the game the screen needs: the voyage, its quests, Settings and the save. */
interface LooksGame {
  world: World;
  quests: QuestBook;
  settings: { dayNight: boolean };
  autosave: () => void;
}

/**
 * The Boat looks screen for the game (#299), opened by the Shipyard's button in the port screen.
 * It sees the captain's ships, their saved looks (decision 0263), the voyage's unlocks and the
 * game's light; `use` saves through `setShipLook` (all or nothing), then autosaves.
 */
export function boatLooksIn(
  port: HTMLElement,
  game: LooksGame,
  quality: () => QualityLevel,
): BoatLooksScreen {
  const screen = new BoatLooksScreen(gameLooksHost(game, quality));
  port.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#tp-boat-looks')) screen.open();
  });
  return screen;
}

function gameLooksHost(game: LooksGame, quality: () => QualityLevel): BoatLooksHost {
  const { world, quests } = game;
  const progress = () => ({
    questDone: (id: string) => quests.isDone(id),
    seriesWon: quests.won,
  });
  const level = (n: number | undefined) =>
    Math.min(3, Math.max(1, Math.round(n ?? 1))) as UpgradeLevel;
  return {
    catalogue: SHIPPED_CATALOGUE,
    ships: (): OwnedShip[] => {
      const { captain } = world.trade;
      const ids = [
        captain.activeShip,
        ...Object.keys(captain.ships).filter((id) => id !== captain.activeShip),
      ];
      return ids.map((id) => {
        const lv = captain.ships[id];
        return {
          id,
          upgrades: { sails: level(lv?.sails), hold: level(lv?.hold), hull: level(lv?.hull) },
          damage: id === captain.activeShip ? damageStage(hullCondition(world.trade)) : 0,
        };
      });
    },
    look: (shipId) => shipLook(world.trade.captain, shipId),
    use: (shipId, look) => {
      const p = progress();
      const ok = setShipLook(world.trade.captain, SHIPPED_CATALOGUE, shipId, look, (item) =>
        isUnlocked(item, p),
      );
      if (ok) game.autosave();
      return ok;
    },
    progress,
    autoFlag: () => pennantFor(quests.won),
    quality,
    night: () => game.settings.dayNight && daylightAt(world.time).night >= 0.5,
  };
}
