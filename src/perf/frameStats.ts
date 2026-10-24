/**
 * Frame-time summary for the `?perf` readout (decision 0148): the numbers a tester reads off a
 * real device. Plain TypeScript so the maths is tested without a browser.
 */
export interface PerfReadoutConfig {
  /** How often the readout redraws, in seconds. */
  refreshSec: number;
  /** Frames in the first seconds of play are left out (islands and towns still building). */
  warmupSec: number;
  /** A frame at least this long counts as slow (below 20 fps). */
  slowFrameMs: number;
  /** A frame at least this long counts as a hitch, a visible stutter. */
  hitchFrameMs: number;
  /** Frames kept for percentiles; older ones roll off (30 minutes at 60 fps). */
  maxFrames: number;
}

export interface FrameSummary {
  frames: number;
  /** Seconds of counted play. */
  seconds: number;
  avgFps: number;
  /** 1000 / the 99th percentile frame time: the frame rate of the worst 1 %. */
  lowFps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
  slow: number;
  hitches: number;
}

export class FrameStats {
  private frames: number[] = [];
  private next = 0;
  private warm = 0;
  private total = 0;
  private sumMs = 0;
  private worst = 0;
  private slow = 0;
  private hitches = 0;

  constructor(private readonly config: PerfReadoutConfig) {}

  /** One frame interval in milliseconds (unclamped, unlike the simulation's dt). */
  add(ms: number) {
    if (!(ms > 0) || !Number.isFinite(ms)) return;
    if (this.warm < this.config.warmupSec * 1000) {
      this.warm += ms;
      return;
    }
    if (this.frames.length < this.config.maxFrames) this.frames.push(ms);
    else this.frames[this.next] = ms;
    this.next = (this.next + 1) % this.config.maxFrames;
    this.total++;
    this.sumMs += ms;
    this.worst = Math.max(this.worst, ms);
    if (ms >= this.config.slowFrameMs) this.slow++;
    if (ms >= this.config.hitchFrameMs) this.hitches++;
  }

  reset() {
    this.frames = [];
    this.next = 0;
    this.warm = 0;
    this.total = 0;
    this.sumMs = 0;
    this.worst = 0;
    this.slow = 0;
    this.hitches = 0;
  }

  /** Null until the warm-up is over and a frame has been counted. */
  summary(): FrameSummary | null {
    if (!this.total) return null;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
    const p99 = at(0.99);
    return {
      frames: this.total,
      seconds: this.sumMs / 1000,
      avgFps: (this.total * 1000) / this.sumMs,
      lowFps: 1000 / p99,
      p50Ms: at(0.5),
      p95Ms: at(0.95),
      p99Ms: p99,
      worstMs: this.worst,
      slow: this.slow,
      hitches: this.hitches,
    };
  }
}
