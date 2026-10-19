/**
 * The one place that chooses which boat and island models the game uses. To try a new art
 * style, write a factory that satisfies ./types.ts (procedural or glTF) and point these at it.
 */
import { createPlaceholderBoat } from './placeholderBoat';
import { buildPlaceholderIslands } from './placeholderIslands';
import type { BoatModelFactory, IslandsBuilder } from './types';

export const createBoatModel: BoatModelFactory = createPlaceholderBoat;
export const buildIslands: IslandsBuilder = buildPlaceholderIslands;
export type { BoatModel, BoatPose } from './types';
