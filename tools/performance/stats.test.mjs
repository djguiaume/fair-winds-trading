import { describe, it } from 'node:test';
import { deepStrictEqual } from 'node:assert';
import { summarize } from './stats.mjs';

describe('performance report distributions', () => {
  it('retains rare spikes and excludes unavailable values', () => {
    const result = summarize([...Array(99).fill(16), 200, NaN, Infinity]);
    deepStrictEqual(result, { count: 100, min: 16, median: 16, p95: 16, p99: 16, max: 200 });
  });
  it('does not invent timings when a run collected no frames', () => {
    deepStrictEqual(summarize([]), {
      count: 0,
      min: null,
      median: null,
      p95: null,
      p99: null,
      max: null,
    });
  });
});
