/**
 * Ultra has to prove itself on each device before it is trusted (decision 0244). On the Xbox,
 * Ultra once blanked the sea and took the browser's graphics down with it, so the page had no
 * chance to step down. The trial writes "running" before Ultra draws, and "ok" after a stretch of
 * frames; a page that finds "running" at start (the last Ultra run died) or "failed" (the
 * graphics were lost on Ultra) keeps the game at High on this device.
 */
export type TrialState = 'running' | 'ok' | 'failed';

const KEY = 'fwt.ultraTrial';

type TrialStorage = Pick<Storage, 'getItem' | 'setItem'>;

export class UltraTrial {
  private state: TrialState | null;
  private onUltra = 0;

  constructor(
    private readonly storage: TrialStorage | null,
    /** Seconds of frames on Ultra before it counts as working (`graphics.ultra.trialSeconds`). */
    private readonly proveSeconds: number,
  ) {
    const saved = read(storage);
    this.state = saved;
    if (saved === 'running') this.write('failed');
  }

  /** Ultra broke the graphics here before: Auto and the Settings stop at High. */
  get failed() {
    return this.state === 'failed';
  }

  /** A frame drawn on Ultra; call it every frame Ultra is on. */
  tick(dt: number) {
    if (this.failed || this.state === 'ok') return;
    if (this.state !== 'running') this.write('running');
    this.onUltra += dt;
    if (this.onUltra >= this.proveSeconds) this.write('ok');
  }

  /** Ultra left before it proved itself: not its fault, try again next time. */
  stop() {
    this.onUltra = 0;
    if (this.state === 'running') this.write(null);
  }

  /** The graphics were lost while Ultra was on. */
  fail() {
    this.write('failed');
  }

  private write(state: TrialState | null) {
    this.state = state;
    try {
      this.storage?.setItem(KEY, state ?? '');
    } catch {
      // Storage full or blocked: the trial only lasts this page.
    }
  }
}

function read(storage: TrialStorage | null): TrialState | null {
  try {
    const v = storage?.getItem(KEY);
    return v === 'running' || v === 'ok' || v === 'failed' ? v : null;
  } catch {
    return null;
  }
}
