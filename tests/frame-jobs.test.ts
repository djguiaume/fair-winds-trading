import { describe, expect, it } from 'vitest';
import { FrameJobs } from '../src/render/frameJobs';
import { type Steps, finish } from '../src/sim/steps';

function* count(log: string[], name: string, n: number): Steps<void> {
  for (let i = 0; i < n; i++) {
    log.push(`${name}${i}`);
    yield;
  }
}

function* sum(n: number): Steps<number> {
  let total = 0;
  for (let i = 1; i <= n; i++) {
    total += i;
    yield;
  }
  return total;
}

/** A clock that moves `ms` each time it is read. */
const ticking = (ms: number) => {
  let t = 0;
  return () => (t += ms);
};

describe('work spread over frames (issue #516)', () => {
  it('finishes steps at once and returns their result', () => {
    expect(finish(sum(10))).toBe(55);
  });

  it('runs jobs in order within the frame budget, at least one step a frame', () => {
    const log: string[] = [];
    const jobs = new FrameJobs();
    jobs.add('a', count(log, 'a', 3));
    jobs.add('b', count(log, 'b', 2));
    jobs.run(0, ticking(1));
    expect(log).toEqual(['a0']);
    jobs.run(2, ticking(1));
    expect(log).toEqual(['a0', 'a1', 'a2']);
    expect(jobs.busy).toBe(true);
    jobs.run(100, ticking(1));
    expect(log).toEqual(['a0', 'a1', 'a2', 'b0', 'b1']);
    expect(jobs.busy).toBe(false);
  });

  it('replaces a waiting job asked again under its key, and drops a cancelled one', () => {
    const log: string[] = [];
    const jobs = new FrameJobs();
    jobs.add('town', count(log, 'old', 3));
    jobs.add('ground', count(log, 'g', 1));
    jobs.add('town', count(log, 'new', 2));
    jobs.cancel('ground');
    jobs.finishAll();
    expect(log).toEqual(['new0', 'new1']);
    expect(jobs.busy).toBe(false);
  });
});
