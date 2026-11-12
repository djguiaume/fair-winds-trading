import type { Steps } from '../sim/steps';

/**
 * Builds the game runs a little each frame (issue #516), so a town's growth or a new level's
 * bakes never stall the sea. One job runs at a time, in the order asked; a job asked again under
 * the same key (a town that grows twice) replaces the one still waiting.
 */
export class FrameJobs {
  private readonly jobs: { key: string; steps: Steps<void> }[] = [];

  add(key: string, steps: Steps<void>) {
    this.cancel(key);
    this.jobs.push({ key, steps });
  }

  /** Drops a job not yet done (its result would be stale). */
  cancel(key: string) {
    const at = this.jobs.findIndex((job) => job.key === key);
    if (at >= 0) this.jobs.splice(at, 1);
  }

  get busy(): boolean {
    return this.jobs.length > 0;
  }

  /** Runs steps until `budgetMs` is spent (at least one step while a job waits). */
  run(budgetMs: number, now: () => number = () => performance.now()) {
    const end = now() + budgetMs;
    while (this.jobs.length) {
      const job = this.jobs[0]!;
      if (job.steps.next().done) this.jobs.shift();
      if (now() >= end) return;
    }
  }

  /** Runs every job to its end now (the tools' screenshots, a voyage loading). */
  finishAll() {
    while (this.jobs.length) {
      const job = this.jobs.shift()!;
      while (!job.steps.next().done);
    }
  }
}
