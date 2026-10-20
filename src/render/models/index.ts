/**
 * The one place that chooses which boat and island models the game uses. To try a new art
 * style, write a factory that satisfies ./types.ts (procedural or glTF) and point these at it.
 * Current look (decision 0016): D storybook boats and B2 bright highland islands, built in code.
 */
import { buildHighlandIslands } from './highlandIslands';
import { createStorybookBoat } from './storybookBoat';
import type { BoatModelFactory, IslandsBuilder } from './types';

export const createBoatModel: BoatModelFactory = createStorybookBoat;
export const buildIslands: IslandsBuilder = buildHighlandIslands;
export type { BoatModel, BoatModelOptions, BoatPose, ShipUpgrades, UpgradeLevel } from './types';
export type { TownLevel } from './towns';
export { STOCK_UPGRADES } from './types';
