import { TUNING } from '../../data/tuning';
import { goodName, goodSome, t, tOptional, townLevelName } from '../../i18n';
import { keeperState } from '../../sim/keeper';
import {
  MAX_SETTLEMENT_LEVEL,
  growthProgress,
  portNow,
  portTownGate,
  settlementLevel,
  topLevel,
} from '../../sim/settlement';
import { homePort, isDiscovered } from '../../sim/shipyards';
import { findPort } from '../../sim/trade';
import type { World } from '../../sim/world';
import { icon } from '../icons';

/**
 * The harbour keeper and the town (decisions 0059, 0065, 0211): the keeper's line for this
 * docking, and how the town grows, for the footer and the Quay's town card.
 */
export class KeeperLines {
  /** Each port's town level when she last docked there, and her visits. */
  private readonly seenLevels: Record<string, number> = {};
  private readonly visits: Record<string, number> = {};
  /** This docking's line, kept while the screen redraws. */
  private picked: { port: string; key: string } | null = null;

  constructor(private readonly world: World) {}

  /**
   * Picks the line for this docking: `grew` once after the town grew a level, else how the
   * port's arc stands; the lines of a state take turns from one visit to the next.
   */
  dock() {
    const { trade, map } = this.world;
    const port = trade.dockedAt ? findPort(map, trade.dockedAt) : null;
    this.picked = null;
    if (!port) return;
    const level = settlementLevel(trade, port.id);
    const grew = this.seenLevels[port.id] !== undefined && level > this.seenLevels[port.id]!;
    this.seenLevels[port.id] = level;
    const visit = (this.visits[port.id] = (this.visits[port.id] ?? 0) + 1);
    if (!port.keeper) return;
    const lines = (state: string) => {
      const out: string[] = [];
      for (let n = 1; tOptional(`keeper.${port.keeper}.${state}.${n}`) !== undefined; n++)
        out.push(`keeper.${port.keeper}.${state}.${n}`);
      return out;
    };
    // An outpost has no `before` or `running` lines: it speaks as done.
    let options = lines(keeperState(port, trade, grew));
    if (!options.length) options = lines('done');
    if (options.length)
      this.picked = { port: port.id, key: options[(visit - 1) % options.length]! };
  }

  /** What the keeper says at `portId` this docking, if anything. */
  line(portId: string): string | undefined {
    return this.picked?.port === portId ? tOptional(this.picked.key) : undefined;
  }
}

export interface TownWords {
  /** "Village · 40%", or the rare goods it waits for (decision 0065). */
  level: string;
  /** 0..1 toward the next level; 1 when fully grown. */
  progress: number;
  /** "Next: Town, makes smoked fish". */
  next: string;
  /** Why it grows, or what it lacks, for the card's title. */
  hint: string;
}

/** The town's size, growth and next level (decisions 0059, 0065), or null for no town. */
export function townWords(world: World, portId: string): TownWords | null {
  const { trade, map } = world;
  const port = findPort(map, portId);
  const s = trade.settlements.byPort[portId];
  if (!port || !s) return null;
  const level = townLevelName(s.level);
  const pct = Math.round(growthProgress(trade, portId) * 100);
  const top = s.level >= topLevel(port);
  let words = t(
    s.sinceSupply > TUNING.economy.towns.stallSeconds && s.growth > 0
      ? 'settlement.stalling'
      : 'settlement.growing',
    { level, pct },
  );
  let hint = t('settlement.hint', { name: port.name });
  const gate = s.level === MAX_SETTLEMENT_LEVEL - 1 ? portTownGate(map, trade, portId) : null;
  if (gate) {
    const goods = gate.goods.map((g) => icon(g)).join('');
    words = t('settlement.rare', { level, pct, have: gate.have, need: gate.need, goods });
    const source = map.ports.find((p) =>
      Object.values(portNow(p, trade).levelProduces ?? {})
        .flat()
        .some((g) => g && gate.goods.includes(g)),
    );
    hint = t('settlement.rareHint', {
      name: port.name,
      need: gate.need,
      goods: gate.goods.map(goodName).join(', '),
      source: source && isDiscovered(trade, source.id) ? source.name : t('settlement.farIsland'),
    });
  }
  return {
    level: top ? level : words,
    progress: top ? 1 : pct / 100,
    next: top ? t('trade.keeperTop', { level }) : nextLevelWords(world, portId, s.level + 1),
    hint,
  };
}

/** What the town turns into at `nextLevel`: a new good, the home yard's next upgrade, or its name. */
function nextLevelWords(world: World, portId: string, nextLevel: number): string {
  const { trade, map } = world;
  const port = findPort(map, portId)!;
  const name = townLevelName(nextLevel);
  const makes = portNow(port, trade).levelProduces?.[String(nextLevel) as '2'] ?? [];
  if (makes.length)
    return t('trade.keeperNextMakes', {
      level: name,
      goods: makes.map((g) => `${icon(g)} ${goodSome(g)}`).join(', '),
    });
  const upgrade = Object.entries(TUNING.upgrades.homePortLevel).find(
    ([, at]) => at === nextLevel,
  )?.[0];
  if (upgrade && port.id === homePort(map).id)
    return t('trade.keeperNextShipyard', { level: name, n: upgrade });
  return t('trade.keeperNext', { level: name });
}
