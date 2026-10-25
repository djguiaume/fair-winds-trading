import type { PortDef } from './map';
import { QUESTS, type QuestDef } from './quests';
import { type HasSettlements, questsDone, questsRunning } from './settlement';

/**
 * The keeper of a port (decision 0211): the person on the harbour screen, with a line for how
 * their port is doing. Who keeps which port is the port's `keeper` in the map and sea files; the
 * lines are `keeper.<person>.<state>.<n>` texts in the language files.
 */
export type KeeperState = 'before' | 'running' | 'done' | 'grew';
export const KEEPER_STATES: readonly KeeperState[] = ['before', 'running', 'done', 'grew'];

/**
 * The port's arc: the quests set at the port, else the keeper's own (Watchman Key's Ness). A port
 * with neither, an outpost, counts as done from its founding.
 */
export function keeperArc(port: PortDef, quests: readonly QuestDef[] = QUESTS): string[] {
  const here = quests.filter((q) => q.port === port.id);
  const own = here.length ? here : quests.filter((q) => port.keeper && q.giver === port.keeper);
  return own.map((q) => q.id);
}

/**
 * How the port is doing, for its keeper's line: `grew` once after the town grew a level, else
 * `done` when every quest of its arc is done, `running` once one started, `before` until then.
 */
export function keeperState(
  port: PortDef,
  state: HasSettlements,
  grew = false,
  quests: readonly QuestDef[] = QUESTS,
): KeeperState {
  if (grew) return 'grew';
  const arc = keeperArc(port, quests);
  const done = questsDone(state);
  if (arc.every((id) => done.has(id))) return 'done';
  const running = questsRunning(state);
  return arc.some((id) => done.has(id) || running.has(id)) ? 'running' : 'before';
}
