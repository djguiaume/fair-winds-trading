/*
 * The quest engine's code library (decision 0125), like ship parts: the kinds of condition a quest
 * file can use as a start or a step goal, and the kinds of reward it can pay. A quest made from
 * these kinds is a file; a new kind is code once, here, with its check.
 *
 * Some conditions keep numbers while their step runs (goods handed over, markers reached, a run's
 * clock): their `slots`. The numbers are saved with the voyage, so a step goes on where it was.
 *
 * Where each part lives: `conditionBasics.ts` (the condition, its context, its parameters),
 * `questConditions.ts` (every kind and how a goal keeps its numbers), the families
 * `conditionsVoyage.ts`, `conditionsCargo.ts` and `conditionsSailing.ts`, the checks in
 * `conditionChecks.ts`, and the rewards in `questRewards.ts`.
 */

export * from './conditionBasics';
export * from './questConditions';
export * from './conditionChecks';
export {
  RACE_FINISHED,
  RACE_GOING,
  RACE_HORN,
  RUN_GOING,
  RUN_MADE,
  RUN_READY,
  parFor,
} from './conditionsSailing';

/**
 * Each condition kind in a few words, for the quest builder's kind picker (decision 0142). The
 * builder's fields come from `params` above, so a new kind shows there once it has its line here.
 */
export const CONDITION_ABOUT: Record<string, string> = {
  always: 'at once',
  all: 'all of several conditions',
  any: 'any one of several conditions',
  not: 'a condition does not hold',
  'quest-done': 'a quest is finished',
  'quest-at': 'a quest has reached a step',
  chose: 'an option was picked in a quest',
  asked: 'the game asks for it (the tutorial)',
  docked: 'alongside a port',
  course: 'a course set on the chart',
  screen: 'the chart or the market is open',
  discovered: 'a port is on the chart',
  'town-level': 'a town has grown to a level',
  standing: 'standing with a shipwright',
  'orders-done': 'orders completed',
  gold: 'gold in hand',
  'has-cargo': 'goods in the hold',
  built: 'a building stands on an island',
  moored: 'moored at an island’s pier',
  'owns-ship': 'owns a ship',
  'series-won': 'a regatta series is won (every race at the winning medal)',
  delivered: 'hand over goods at a port',
  landed: 'land goods from the hold at a port or a spot (founding goods)',
  bought: 'buy goods at a port',
  'sails-practised': 'lower and raise the sails, steer, get under way',
  carried: 'carry quest cargo from one place to another',
  'point-of-sail': 'sail on a point of sail for a while (in irons, close-hauled, reaching…)',
  tacked: 'tack: turn the bow across the wind',
  reach: 'sail to places at sea',
  timed: 'a run against the clock',
  raced: 'a race: a start line, numbered marks in order, a finish line (decision 0217)',
};
