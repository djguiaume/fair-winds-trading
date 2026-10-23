/**
 * Difficulty levels on the Windward Ring (decision 0083). The 0046 balance simulation, run on each
 * level with the game's own knobs: start gold, the port's cut, order rewards, damage, repair price
 * and town growth all come from the difficulty tuning. Fair winds also sails in the steady trade
 * wind, so its legs are timed over a narrow wind range. Captain must stay the 0046 game.
 * Simulation and targets: `src/sim/balance.ts`, `src/data/balance-targets.json` (decision 0114).
 */
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { levelName, difficultyChecks, difficultyRun } from '../src/sim/balance';
import { DIFFICULTIES } from '../src/sim/difficulty';

const fmt = (m: number | undefined) => (m === undefined ? '-' : `${m.toFixed(1)} min`);

describe('difficulty levels (0083)', () => {
  const by = difficultyRun(PHASE1_MAP);
  console.log(
    'level | captain | 1st upgrade | cutter | cutter maxed | 1st town | repairs\n' +
      DIFFICULTIES.flatMap((level) =>
        (['sharp', 'relaxed'] as const).map((who) => {
          const p = by[level]![who];
          return [
            levelName(level),
            who,
            fmt(p.firstUpgrade),
            fmt(p.cutter),
            fmt(p.maxed),
            fmt(p.firstTown),
            `${Math.round(100 * p.repairs)} %`,
          ].join(' | ');
        }),
      ).join('\n'),
  );

  it.each(difficultyChecks(by).map((c) => [c.label, c] as const))('%s', (_, c) => {
    expect(c.ok, `${c.actual}, target ${c.target}`).toBe(true);
  });
});
