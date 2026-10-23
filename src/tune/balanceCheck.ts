import type { TuneChanges } from '../data/tuningEdits';
import type { BalanceCheck } from '../sim/balance';
import type { Difficulty } from '../sim/difficulty';

/** What the balance worker sends back while it runs (decision 0114). */
export type BalanceMessage =
  | { id: number; kind: 'economy'; checks: BalanceCheck[] }
  | { id: number; kind: 'level'; level: Difficulty }
  | { id: number; kind: 'difficulty'; checks: BalanceCheck[] }
  | { id: number; kind: 'done'; ms: number }
  | { id: number; kind: 'error'; message: string };

export interface BalanceState {
  running: boolean;
  /** The 40-minute Captain game (decision 0046), first back (well under a second). */
  economy: BalanceCheck[] | null;
  /** Each difficulty level over two hours (decision 0083). */
  difficulty: BalanceCheck[] | null;
  /** The level being simulated now. */
  level: Difficulty | null;
  ms: number | null;
  error: string | null;
  /** How many edits the result is for. */
  changes: number;
}

/**
 * Runs the balance simulation in a worker, a moment after the last edit. A new edit stops a run
 * in progress (the worker is dropped) and starts again, so the result always matches the panel.
 */
export class BalanceRunner {
  state: BalanceState = {
    running: false,
    economy: null,
    difficulty: null,
    level: null,
    ms: null,
    error: null,
    changes: 0,
  };
  private worker: Worker | null = null;
  private timer = 0;
  private id = 0;

  constructor(private readonly onUpdate: (state: BalanceState) => void) {}

  /** Run on these edits after `delayMs` without a newer call. */
  schedule(changes: TuneChanges, delayMs = 700): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.run(changes), delayMs);
  }

  run(changes: TuneChanges): void {
    window.clearTimeout(this.timer);
    this.worker?.terminate();
    const id = ++this.id;
    if (typeof Worker === 'undefined') {
      this.state = { ...this.state, running: false, error: 'no Web Workers in this browser' };
      return this.onUpdate(this.state);
    }
    const worker = new Worker(new URL('./balance.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    this.state = {
      ...this.state,
      running: true,
      level: null,
      ms: null,
      error: null,
      changes: Object.keys(changes).length,
    };
    this.onUpdate(this.state);
    worker.addEventListener('message', (e: MessageEvent<BalanceMessage>) => {
      const m = e.data;
      if (m.id !== this.id) return;
      if (m.kind === 'economy') this.state = { ...this.state, economy: m.checks };
      else if (m.kind === 'level') this.state = { ...this.state, level: m.level };
      else if (m.kind === 'difficulty')
        this.state = { ...this.state, difficulty: m.checks, level: null };
      else {
        this.state =
          m.kind === 'done'
            ? { ...this.state, running: false, ms: m.ms }
            : { ...this.state, running: false, error: m.message };
        worker.terminate();
        if (this.worker === worker) this.worker = null;
      }
      this.onUpdate(this.state);
    });
    worker.addEventListener('error', (e) => {
      if (id !== this.id) return;
      this.state = { ...this.state, running: false, error: e.message || 'worker failed' };
      this.onUpdate(this.state);
    });
    worker.postMessage({ id, changes });
  }

  dispose(): void {
    window.clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
  }
}
