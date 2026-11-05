import { FAR_GOODS, type GoodId, isGood } from './goods';
import type { MapDef, PortDef } from './map';
import { isVarRef, resolvePort } from './questLibrary';
import type { QuestDef } from './quests';
import { MAX_SETTLEMENT_LEVEL, portProduces, portWants } from './settlement';

/**
 * Problems with a standing order (decision 0214): offered at a port of its own, never a main quest
 * or a lesson; each step one ask, with no way on but the end of the round; a step paid like a help
 * order (`order`) lands a good its port wants there, or a far good made in another port (a
 * cross-sea ask, #360: Sigrun wants Juno's tea).
 */
export function checkRepeat(q: QuestDef, map: MapDef, at: string): string[] {
  const out: string[] = [];
  if (!q.offer) out.push(`${at}: a standing order is offered (offer: true)`);
  if (q.main || q.lesson) out.push(`${at}: a standing order is not a main quest or a lesson`);
  if (!q.port || isVarRef(q.port) || !resolvePort(map, q.port))
    out.push(`${at}: a standing order needs its port`);
  if (q.reward !== undefined) out.push(`${at}: a standing order pays on its steps, not the quest`);
  for (const s of q.steps ?? []) {
    const where = `${at} › ${s.id}`;
    if (s.next !== undefined || s.choose !== undefined || s.unless !== undefined)
      out.push(`${where}: a standing order's step is one ask (no next, choose or unless)`);
    if (s.reward?.order === undefined) continue;
    const g = s.goal;
    const port = resolvePort(map, typeof g?.place === 'string' ? g.place : undefined);
    if (g?.is !== 'landed' || !port || !isGood(g.good) || typeof g.qty !== 'number') {
      out.push(`${where} › reward.order: the goal lands a good at a port (landed)`);
      continue;
    }
    const town = map.ports.find((p) => p.id === port);
    if (town && !asksFor(map, town, g.good))
      out.push(`${where}: ${town.id} never wants ${g.good}, and it is no far good made elsewhere`);
  }
  return out;
}

/**
 * Whether a standing order at `town` may ask for `good`: one it buys at some level once a port makes
 * it, or a far good made at another port (a cross-sea ask, #360).
 */
function asksFor(map: MapDef, town: PortDef, good: GoodId): boolean {
  const made = new Set(map.ports.flatMap((p) => portProduces(p, MAX_SETTLEMENT_LEVEL)));
  if (portWants(town, MAX_SETTLEMENT_LEVEL, made).includes(good)) return true;
  const elsewhere = map.ports.some(
    (p) => p !== town && portProduces(p, MAX_SETTLEMENT_LEVEL).includes(good),
  );
  return FAR_GOODS.includes(good) && elsewhere;
}
