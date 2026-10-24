import { PHASE1_MAP } from '../data/maps';
import { type TuneChanges, applyChanges } from '../data/tuningEdits';
import { difficultyChecks, difficultyRun, economyChecks, economyRun } from '../sim/balance';
import type { BalanceMessage } from './balanceCheck';

/*
 * The balance check of the `?tune` panel (decision 0114): the simulation of
 * `tests/economy-balance.test.ts` and `tests/difficulty-balance.test.ts`, run here on the edited
 * values so the panel stays smooth. The worker has its own copy of `TUNING`: it starts from the
 * shipped files and applies the panel's edit set. It always uses the Windward Ring, the map the
 * targets were set on, sailed in each level's own wind and currents (decision 0149).
 */
const scope = self as unknown as Worker;
const post = (m: BalanceMessage) => scope.postMessage(m);

scope.addEventListener('message', (event: MessageEvent<{ id: number; changes: TuneChanges }>) => {
  const { id, changes } = event.data;
  const started = performance.now();
  try {
    applyChanges(changes);
    post({ id, kind: 'economy', checks: economyChecks(economyRun(PHASE1_MAP)) });
    const levels = difficultyRun(PHASE1_MAP, (level) => post({ id, kind: 'level', level }));
    post({ id, kind: 'difficulty', checks: difficultyChecks(levels) });
    post({ id, kind: 'done', ms: performance.now() - started });
  } catch (e) {
    post({ id, kind: 'error', message: e instanceof Error ? e.message : String(e) });
  }
});
