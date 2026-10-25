/**
 * `?padlog` (decision 0201): what the browser hands the page from a controller, on screen. Edge
 * on Xbox mixes the Gamepad API, keys ("GamepadA", arrows) and pointer clicks, and differs from
 * any desktop browser a test can run, so a photo of this panel says what it really sent: each key,
 * pointer event, Gamepad API press, window focus change and where the focus went after it.
 */
export class PadLog {
  private lines: string[] = [];
  private readonly box: HTMLElement;
  private readonly t0 = performance.now();

  /** Call before the pad's poller listens, so this sees the events it stops. */
  constructor(private readonly max = 16) {
    this.box = document.createElement('pre');
    this.box.className = 'pad-log';
    this.box.setAttribute('aria-hidden', 'true');
    document.body.append(this.box);
    const on = (type: string, text: (e: Event) => string) =>
      window.addEventListener(type, (e) => this.add(text(e)), true);
    on(
      'keydown',
      (e) => `key ${(e as KeyboardEvent).key}${(e as KeyboardEvent).repeat ? ' (repeat)' : ''}`,
    );
    for (const type of ['pointerdown', 'click'])
      on(type, (e) => `${type}${e.isTrusted ? '' : ' (script)'} on ${name(e.target)}`);
    on('blur', (e) => (e.target === window ? 'window lost focus' : ''));
    on('focus', (e) => (e.target === window ? 'window got focus' : ''));
    document.addEventListener('visibilitychange', () =>
      this.add(`page ${document.visibilityState}`),
    );
  }

  /** A press the Gamepad API (or a key the poller took as the pad's) gave the game. */
  press(button: string, repeat: boolean) {
    if (!repeat) this.add(`pad ${button}`);
  }

  private add(text: string) {
    if (!text) return;
    const at = ((performance.now() - this.t0) / 1000).toFixed(2);
    // Where the focus is a moment later, once the game acted on the event.
    setTimeout(() => {
      this.lines.push(`${at} ${text} → focus ${name(document.activeElement)}`);
      this.lines = this.lines.slice(-this.max);
      this.box.textContent = this.lines.join('\n');
    }, 50);
  }
}

function name(el: EventTarget | null): string {
  if (!(el instanceof HTMLElement)) return el === window ? 'window' : '-';
  if (el === document.body) return 'body';
  return el.id
    ? `#${el.id}`
    : `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}`;
}
