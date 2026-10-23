import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { type Voyage, economyChecks, economyRun } from '../src/sim/balance';

/**
 * Phase 1 balance on the Windward Ring (decision 0046). The simulation lives in
 * `src/sim/balance.ts` (decision 0114), so the `?tune` panel runs the same one on edited values;
 * the targets are in `src/data/balance-targets.json` and docs/economy.md.
 */

function report(name: string, v: Voyage) {
  const income = v.marketGold + v.contractGold;
  console.log(
    `${name}: ${v.legs} legs, ${income} gold earned (${Math.round((100 * v.contractGold) / income)} % orders), repairs ${v.repairGold}\n  ` +
      v.boughtAt.map(([n, m]) => `${m.toFixed(1)} min ${n}`).join(', ') +
      '\n  levels: ' +
      Object.entries(v.levels)
        .map(([n, m]) => `${m.toFixed(1)} min ${n}`)
        .join(', '),
  );
}

describe('economy balance (0046)', () => {
  const run = economyRun(PHASE1_MAP);
  report('sharp captain', run.sharp);
  report('sharp, market only', run.sharpMarket);
  report('relaxed captain', run.relaxed);

  it.each(economyChecks(run).map((c) => [c.label, c] as const))('%s', (_, c) => {
    expect(c.ok, `${c.actual}, target ${c.target}`).toBe(true);
  });
});
