import { describe, expect, it } from 'vitest';
import CONFIG from '../src/data/perf-readout.json';
import { FrameStats } from '../src/perf/frameStats';

const config = { ...CONFIG, warmupSec: 1, maxFrames: 1000 };

describe('perf readout frame stats (decision 0148)', () => {
  it('skips the warm-up, then summarises frame times', () => {
    const stats = new FrameStats(config);
    for (let i = 0; i < 100; i++) stats.add(20); // 2 s, the first 1 s is warm-up
    expect(stats.summary()!.frames).toBe(50);
    for (let i = 0; i < 10; i++) stats.add(120);
    const s = stats.summary()!;
    expect(s.frames).toBe(60);
    expect(s.avgFps).toBeCloseTo((60 * 1000) / (50 * 20 + 10 * 120));
    expect(s.p50Ms).toBe(20);
    expect(s.worstMs).toBe(120);
    expect(s.lowFps).toBeCloseTo(1000 / 120);
    expect(s.slow).toBe(10);
    expect(s.hitches).toBe(10);
  });

  it('has no summary before any counted frame, and resets', () => {
    const stats = new FrameStats(config);
    expect(stats.summary()).toBeNull();
    for (let i = 0; i < 100; i++) stats.add(16);
    stats.reset();
    expect(stats.summary()).toBeNull();
  });

  it('keeps totals past the percentile window and ignores bad samples', () => {
    const stats = new FrameStats({ ...config, warmupSec: 0, maxFrames: 10 });
    stats.add(NaN);
    stats.add(-5);
    for (let i = 0; i < 25; i++) stats.add(i < 20 ? 100 : 10);
    const s = stats.summary()!;
    expect(s.frames).toBe(25);
    expect(s.worstMs).toBe(100);
    expect(s.p50Ms).toBe(100); // window holds the last 10: five 100s, five 10s
  });
});
