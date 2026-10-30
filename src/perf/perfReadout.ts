import type { WebGLRenderer } from 'three';
import './perf.css';
import CONFIG from '../data/perf-readout.json';
import { FrameStats, type FrameSummary, type PerfReadoutConfig } from './frameStats';

/** What the game reports each frame; the readout only reads it. */
export interface PerfFrameInput {
  /** Raw time since the previous frame, in ms. */
  ms: number;
  /** True while the sea is on screen and the voyage runs (not the title, chart or pauses). */
  counting: boolean;
  level: string;
  qualitySetting: string;
  renderer: WebGLRenderer;
}

interface PerfFrame extends Omit<PerfFrameInput, 'renderer'> {
  drawCalls: number;
  triangles: number;
  canvas: { width: number; height: number; pixelRatio: number };
  /** Whether the drawing context multisamples (Ultra multisamples its own targets instead). */
  antialias: boolean;
}

export interface PerfContext {
  version: string;
  sea: string;
  /** `?bench` only: what was run, for the report's benchmark heading. */
  bench?: string;
  /** Hazard switches as they are now, for the report (e.g. "currents on"). */
  switches: () => string;
}

const fixed = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '-');

function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function passLine(p: { label: string; summary: FrameSummary | null }) {
  const s = p.summary;
  return s
    ? `${p.label}: ${fixed(s.avgFps)} fps · 1% ${fixed(s.lowFps)} · worst ${fixed(s.worstMs)} ms`
    : `${p.label}: -`;
}

/**
 * The `?perf` readout (decision 0148): live FPS plus a running summary of the voyage (average,
 * 1 % low, frame-time percentiles, slow frames, hitches, quality drops), and a Copy button that
 * puts the whole report on the clipboard to paste back. Loaded only with `?perf`.
 */
export class PerfReadout {
  private readonly stats: FrameStats;
  private readonly box: HTMLElement;
  private readonly body: HTMLElement;
  private readonly copy: HTMLButtonElement;
  private sinceRefresh = 0;
  private liveMs = 0;
  private liveFrames = 0;
  private liveFps = 0;
  private lastLevel = '';
  private drops: string[] = [];
  private last: PerfFrame | null = null;
  /** `?bench` (decision 0154): finished passes, the running one, and a status line. */
  private passes: {
    label: string;
    summary: FrameSummary | null;
    drops: number;
    canvas: string;
  }[] = [];
  private passLabel: string | null = null;
  private benchLine = '';

  constructor(
    private readonly context: PerfContext,
    private readonly config: PerfReadoutConfig = CONFIG,
  ) {
    this.stats = new FrameStats(config);
    this.box = document.createElement('div');
    this.box.className = 'perf-readout';
    this.box.innerHTML =
      '<div class="perf-body"></div><div class="perf-actions">' +
      '<button type="button" data-act="copy">Copy</button>' +
      '<button type="button" data-act="reset">Reset</button>' +
      '<button type="button" data-act="fold" aria-label="Fold">–</button></div>';
    this.body = this.box.querySelector('.perf-body')!;
    this.copy = this.box.querySelector('[data-act="copy"]')!;
    this.copy.addEventListener('click', () => void this.copyReport());
    this.box.querySelector('[data-act="reset"]')!.addEventListener('click', () => this.reset());
    this.box
      .querySelector('[data-act="fold"]')!
      .addEventListener('click', () => this.box.classList.toggle('folded'));
    document.body.append(this.box);
  }

  frame({ renderer, ...rest }: PerfFrameInput) {
    const { calls, triangles } = renderer.info.render;
    const { width, height } = renderer.domElement;
    const f: PerfFrame = {
      ...rest,
      drawCalls: calls,
      triangles,
      canvas: { width, height, pixelRatio: renderer.getPixelRatio() },
      antialias: renderer.getContextAttributes()?.antialias ?? false,
    };
    this.last = f;
    if (this.lastLevel && f.level !== this.lastLevel) {
      this.drops.push(
        `${this.lastLevel}→${f.level} at ${clock(this.stats.summary()?.seconds ?? 0)}`,
      );
    }
    this.lastLevel = f.level;
    if (f.counting) this.stats.add(f.ms);
    this.liveMs += f.ms;
    this.liveFrames++;
    this.sinceRefresh += f.ms / 1000;
    if (this.sinceRefresh < this.config.refreshSec) return;
    this.liveFps = (this.liveFrames * 1000) / this.liveMs;
    this.liveMs = 0;
    this.liveFrames = 0;
    this.sinceRefresh = 0;
    this.draw();
  }

  reset() {
    this.stats.reset();
    this.drops = [];
    this.draw();
  }

  /** A benchmark pass begins: the previous one's numbers are kept, the running ones restart. */
  startPass(label: string) {
    this.endPass();
    this.passLabel = label;
    this.stats.reset();
    this.drops = [];
  }

  /** The benchmark is over: keep the last pass and show the results until Copy. */
  finishBench() {
    this.endPass();
    this.benchLine = 'Benchmark done · press Copy';
    this.box.classList.remove('folded');
    this.box.classList.add('done');
    this.draw();
  }

  setBenchLine(text: string) {
    this.benchLine = text;
  }

  private endPass() {
    if (this.passLabel === null) return;
    this.passes.push({
      label: this.passLabel,
      summary: this.stats.summary(),
      drops: this.drops.length,
      canvas: this.last
        ? `${this.last.canvas.width}×${this.last.canvas.height} ${this.last.level}`
        : '?',
    });
    this.passLabel = null;
  }

  private draw() {
    const f = this.last;
    if (!f) return;
    const s = this.stats.summary();
    if (this.passes.length && this.passLabel === null) {
      this.body.textContent = [this.benchLine, ...this.passes.map(passLine)].join('\n');
      return;
    }
    const lines = [
      this.benchLine,
      `${fixed(this.liveFps)} fps now · ${f.level}${f.qualitySetting === 'auto' ? ' (auto)' : ''}`,
      s
        ? `avg ${fixed(s.avgFps)} · 1% low ${fixed(s.lowFps)} · ${clock(s.seconds)}`
        : `warming up (${this.config.warmupSec} s of sailing)…`,
      s ? `ms p50 ${fixed(s.p50Ms)} · p95 ${fixed(s.p95Ms)} · worst ${fixed(s.worstMs)}` : '',
      s ? `slow ${s.slow} · hitches ${s.hitches} · drops ${this.drops.length}` : '',
      `${f.drawCalls} draws · ${fixed(f.triangles / 1000)}k tris`,
    ];
    this.body.textContent = lines.filter(Boolean).join('\n');
  }

  /** The text to paste back: one block, every number labelled. */
  report(summary: FrameSummary | null = this.stats.summary()): string {
    const f = this.last;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const c = this.config;
    const lines = [
      `Fair Winds perf v${this.context.version} · ${this.context.sea}`,
      `Device: ${navigator.userAgent}`,
      `Cores ${navigator.hardwareConcurrency ?? '?'} · memory ${nav.deviceMemory ?? '?'} GB · screen ${screen.width}×${screen.height} @${fixed(devicePixelRatio, 2)}`,
      f
        ? `Canvas ${f.canvas.width}×${f.canvas.height} @${fixed(f.canvas.pixelRatio, 2)} · antialias ${f.antialias ? 'on' : 'off'} · quality ${f.qualitySetting} → ${f.level} · ${f.drawCalls} draws · ${f.triangles} tris`
        : 'No frame yet',
      `Switches: ${this.context.switches()}`,
    ];
    if (this.passes.length) {
      const c2 = this.config;
      lines.push(
        `Benchmark ${this.context.bench ?? ''}`.trim(),
        ...this.passes.map(
          (p) =>
            `${p.label} (${p.canvas}): ` +
            (p.summary
              ? `avg ${fixed(p.summary.avgFps, 1)} · 1% low ${fixed(p.summary.lowFps, 1)} · p50 ${fixed(p.summary.p50Ms, 1)} · p95 ${fixed(p.summary.p95Ms, 1)} · worst ${fixed(p.summary.worstMs, 1)} ms · slow ${p.summary.slow}/${p.summary.frames} · hitches ${p.summary.hitches} · drops ${p.drops}`
              : 'no frames counted'),
        ),
        `(first ${c2.warmupSec} s of each pass skipped; slow ≥${c2.slowFrameMs} ms, hitches ≥${c2.hitchFrameMs} ms)`,
      );
      return lines.join('\n');
    }
    if (summary) {
      lines.push(
        `Sailed ${clock(summary.seconds)} (${summary.frames} frames, first ${c.warmupSec} s skipped)`,
        `FPS avg ${fixed(summary.avgFps, 1)} · 1% low ${fixed(summary.lowFps, 1)}`,
        `Frame ms p50 ${fixed(summary.p50Ms, 1)} · p95 ${fixed(summary.p95Ms, 1)} · p99 ${fixed(summary.p99Ms, 1)} · worst ${fixed(summary.worstMs, 1)}`,
        `Slow ≥${c.slowFrameMs} ms: ${summary.slow} · hitches ≥${c.hitchFrameMs} ms: ${summary.hitches}`,
      );
    } else lines.push('Not enough sailing yet');
    lines.push(`Quality drops: ${this.drops.length ? this.drops.join(', ') : 'none'}`);
    return lines.join('\n');
  }

  private async copyReport() {
    const text = this.report();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Older tablets without clipboard access: show the text so it can be selected by hand.
      window.prompt('Perf report', text);
    }
    this.copy.textContent = ok ? 'Copied' : 'Copy';
    setTimeout(() => (this.copy.textContent = 'Copy'), 1500);
  }
}
