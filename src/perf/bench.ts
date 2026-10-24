import CONFIG from '../data/benchmark.json';
import { bearingTo } from '../sim/math';

/**
 * The `?bench` device benchmark (decision 0154): the boat follows a fixed route at a fixed speed,
 * once per pass (each pass at its own drawing resolution), so every run on every device measures
 * the same sailing. Plain TypeScript: the game moves the boat to `pose` each frame.
 */
export interface BenchPass {
  label: string;
  /** Drawing-resolution factor for this pass (1 = the quality level's normal). */
  scale: number;
}

export interface BenchConfig {
  speedKn: number;
  /** The bow points at the route this many seconds ahead, which rounds the corners. */
  lookAheadSec: number;
  /** Game time each pass starts from, so wind, weather and daylight repeat. */
  startTime: number;
  passes: BenchPass[];
  route: [number, number][];
}

export interface BenchPose {
  x: number;
  y: number;
  /** Compass heading, radians (0 = north, clockwise). */
  heading: number;
}

/** A polyline walked by distance. */
export class BenchRoute {
  private readonly cumulative: number[] = [0];
  readonly length: number;

  constructor(private readonly points: [number, number][]) {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!;
      const [bx, by] = points[i]!;
      this.cumulative.push(this.cumulative[i - 1]! + Math.hypot(bx - ax, by - ay));
    }
    this.length = this.cumulative[this.cumulative.length - 1]!;
  }

  at(distance: number): { x: number; y: number } {
    const d = Math.min(Math.max(0, distance), this.length);
    let i = 1;
    while (i < this.points.length - 1 && this.cumulative[i]! < d) i++;
    const [ax, ay] = this.points[i - 1]!;
    const [bx, by] = this.points[i]!;
    const span = this.cumulative[i]! - this.cumulative[i - 1]! || 1;
    const f = (d - this.cumulative[i - 1]!) / span;
    return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f };
  }
}

export interface BenchStep {
  pose: BenchPose;
  pass: number;
  /** True on the first frame of a pass (set its resolution, reset its numbers). */
  passStarted: boolean;
  /** Seconds left in the current pass. */
  left: number;
  done: boolean;
}

export class Bench {
  readonly route: BenchRoute;
  /** Seconds one pass takes. */
  readonly passSec: number;
  private pass = -1;
  private time = 0;

  /** `unitsPerKnot`: world units travelled per second at one knot. */
  constructor(
    readonly config: BenchConfig,
    private readonly unitsPerKnot: number,
  ) {
    this.route = new BenchRoute(config.route);
    this.passSec = this.route.length / (config.speedKn * unitsPerKnot);
  }

  /** Advance by `sec` of real time; the first call starts pass 0. */
  step(sec: number): BenchStep {
    let passStarted = false;
    if (this.pass < 0) {
      this.pass = 0;
      passStarted = true;
    } else {
      this.time += sec;
      if (this.time >= this.passSec && this.pass < this.config.passes.length) {
        this.pass++;
        this.time = 0;
        passStarted = this.pass < this.config.passes.length;
      }
    }
    const done = this.pass >= this.config.passes.length;
    const speed = this.config.speedKn * this.unitsPerKnot;
    const d = done ? this.route.length : this.time * speed;
    const here = this.route.at(d);
    // Near the end the look-ahead runs out: keep the last leg's direction.
    const ahead = this.route.at(d + this.config.lookAheadSec * speed);
    const [from, to] =
      Math.hypot(ahead.x - here.x, ahead.y - here.y) > 0.5
        ? [here, ahead]
        : [this.route.at(d - 1), here];
    return {
      pose: { x: here.x, y: here.y, heading: bearingTo(from, to) },
      pass: Math.min(this.pass, this.config.passes.length - 1),
      passStarted,
      left: done ? 0 : this.passSec - this.time,
      done,
    };
  }
}

/** The shipped benchmark (`src/data/benchmark.json`). */
export const BENCHMARK: BenchConfig = CONFIG as unknown as BenchConfig;
