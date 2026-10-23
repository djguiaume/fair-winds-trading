import { t } from '../i18n';
import { type CoachTarget, TUTORIAL_STEPS, type Tutorial } from '../sim/tutorial';

type Surface = 'sea' | 'chart' | 'market' | null;
type Side = 'top' | 'bottom' | 'left' | 'right' | 'none';

/**
 * The element a lesson points at on the open surface (decision 0061). Selectors only, so the
 * sea HUD, chart and port screen keep their own markup; null leaves the bubble unpinned. Which
 * target each step uses is its `coach` entry in `src/data/quests/first-voyage.json` (decision 0113).
 */
function lessonTarget(tutorial: Tutorial, surface: Surface): string | null {
  if (!surface) return null;
  const port = tutorial.pointerPort;
  const good = tutorial.pointerGood;
  const target: CoachTarget | undefined = tutorial.def.coach[surface];
  switch (target) {
    case 'chart-button':
      return '#chart-btn';
    case 'sail-lever':
      return '#sail-lever';
    case 'wind-compass':
      return '#wind-compass';
    case 'dock-button':
      return '#dock-btn';
    case 'close-chart':
      return '#close-chart';
    case 'port-marker':
      return port ? `.port-marker[data-port-id="${port}"]` : null;
    case 'chart-port':
      return port ? `[data-chart-target="${port}"]` : null;
    case 'buy-button':
      return good ? `[data-action="buy"][data-good="${good}"]` : null;
    case 'sell-button':
      return good ? `[data-action="sell"][data-good="${good}"]` : null;
    default:
      return null;
  }
}

/** On screen and drawn: hidden, folded or scrolled-away targets leave the bubble unpinned. */
function visibleRect(el: Element | null): DOMRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return null;
  return r;
}

const GAP = 14;
const PAD = 6;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Coach marks: one small bubble and a brass ring on the element to tap, moved into whichever
 * surface is open (sea, chart or port). No timers: the game calls `place()` at HUD rate and it
 * only writes to the DOM when a target moves.
 */
export class TutorialCoach {
  private surface: Surface = null;
  private collapsed = false;
  private readonly card = document.createElement('aside');
  private readonly ring = document.createElement('div');
  private readonly arrow = document.createElement('span');
  private signature = '';
  private placement = '';
  private target: string | null = null;
  /** Whether the bubble was built pinned to a visible target. */
  private pinned = false;
  onChart: () => void = () => {};
  onMarket: () => void = () => {};
  onTips: () => void = () => {};
  constructor(private readonly tutorial: Tutorial) {
    this.card.className = 'coach tutorial-card';
    this.card.setAttribute('aria-label', t('tutorial.cardLabel'));
    this.ring.className = 'coach-ring';
    this.ring.setAttribute('aria-hidden', 'true');
    this.arrow.className = 'coach-arrow';
  }
  setSurface(surface: Surface) {
    this.surface = surface;
    this.render();
  }
  render() {
    const host = this.surface ? document.getElementById(`tutorial-${this.surface}`) : null;
    const show = Boolean(host) && (this.tutorial.isActive || this.tutorial.finishedNotice);
    this.card.hidden = !show;
    if (!host) {
      this.ring.hidden = true;
      return;
    }
    if (this.card.parentElement !== host) host.append(this.ring, this.card);
    if (!show) {
      this.ring.hidden = true;
      if (this.card.contains(document.activeElement)) {
        document
          .getElementById(
            this.surface === 'market'
              ? 'tp-close'
              : this.surface === 'chart'
                ? 'close-chart'
                : 'menu-btn',
          )
          ?.focus({ preventScroll: true });
      }
      return;
    }
    const { tutorial } = this;
    const finished = tutorial.finishedNotice;
    this.target = finished || this.collapsed ? null : lessonTarget(tutorial, this.surface);
    const targetFound = Boolean(
      visibleRect(this.target ? document.querySelector(this.target) : null),
    );
    const lesson = tutorial.lesson;
    const signature = JSON.stringify([
      tutorial.status,
      tutorial.step,
      lesson,
      this.collapsed,
      this.surface,
      targetFound,
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.pinned = targetFound;
      this.build(targetFound);
    }
    this.placement = '';
    this.place();
  }

  private build(targetFound: boolean) {
    const { tutorial } = this;
    const lesson = tutorial.lesson;
    const finished = tutorial.finishedNotice;
    const focusedId = this.card.contains(document.activeElement)
      ? document.activeElement?.id
      : null;
    this.card.replaceChildren(this.arrow);
    const button = (
      host: HTMLElement,
      id: string,
      label: string,
      kind: string,
      action: () => void,
    ) => {
      const b = document.createElement('button');
      b.id = id;
      b.type = 'button';
      b.className = kind;
      b.textContent = label;
      b.addEventListener('click', action);
      host.append(b);
      return b;
    };

    const head = document.createElement('div');
    head.className = 'coach-head';
    const step = TUTORIAL_STEPS.indexOf(tutorial.step);
    const dots = document.createElement('span');
    dots.className = 'coach-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      const dot = document.createElement('i');
      if (finished || i < step) dot.className = 'done';
      else if (i === step) dot.className = 'now';
      dots.append(dot);
    }
    const title = document.createElement('h3');
    title.setAttribute('role', 'status');
    title.textContent = finished
      ? t('tutorial.complete')
      : `${step + 1}/${TUTORIAL_STEPS.length} · ${lesson.title}`;
    head.append(dots, title);
    this.card.append(head);
    if (!finished)
      button(
        head,
        'tutorial-collapse',
        this.collapsed ? t('tutorial.show') : t('tutorial.hide'),
        'coach-text-btn',
        () => {
          this.collapsed = !this.collapsed;
          this.render();
        },
      ).setAttribute('aria-expanded', String(!this.collapsed));
    if (this.collapsed) return this.refocus(focusedId);

    const copy = document.createElement('p');
    copy.textContent = finished ? t('tutorial.completeCopy') : lesson.copy;
    this.card.append(copy);
    const actions = document.createElement('div');
    actions.className = 'coach-actions';
    this.card.append(actions);
    if (finished) {
      button(actions, 'tutorial-finish', t('tutorial.free'), 'd-btn brass', () =>
        tutorial.dismissFinished(),
      );
      return this.refocus(focusedId);
    }
    if (lesson.continueText)
      button(actions, 'tutorial-continue', lesson.continueText, 'd-btn brass', () =>
        tutorial.continueLesson(),
      );
    // The ring already shows what to tap; a button only when nothing is pinned, or for tips.
    const offSurface = lesson.action === 'chart' && this.surface === 'chart';
    if (lesson.action && !offSurface && (lesson.action === 'tips' || !targetFound)) {
      const label = {
        chart: t('tutorial.openMap'),
        market: t('tutorial.openMarket'),
        tips: t('tutorial.showTips'),
      }[lesson.action];
      button(actions, 'tutorial-action', label, 'd-btn', () => {
        if (lesson.action === 'chart') this.onChart();
        else if (lesson.action === 'market') this.onMarket();
        else this.onTips();
      });
    }
    const skip = button(actions, 'tutorial-skip', t('tutorial.skip'), 'coach-text-btn', () =>
      tutorial.skip(),
    );
    skip.style.marginLeft = 'auto';
    skip.insertAdjacentHTML(
      'beforeend',
      '<svg class="icon" aria-hidden="true"><use href="#i-close" /></svg>',
    );
    this.refocus(focusedId);
  }

  // Keep keyboard focus inside the bubble when a lesson replaces its current button.
  private refocus(focusedId: string | null | undefined) {
    if (focusedId)
      (
        this.card.querySelector<HTMLElement>(`#${focusedId}`) ??
        this.card.querySelector<HTMLElement>('button')
      )?.focus({ preventScroll: true });
  }

  /** Puts the ring on the target and the bubble beside it; cheap when nothing moved. */
  place() {
    if (this.card.hidden) return;
    const r = visibleRect(this.target ? document.querySelector(this.target) : null);
    // A target that came on or went off screen changes the bubble's buttons: rebuild.
    if (Boolean(r) !== this.pinned) return this.render();
    const W = innerWidth;
    const H = innerHeight;
    const key = r
      ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)},${W},${H}`
      : `none,${W},${H}`;
    if (key === this.placement) return;
    this.placement = key;
    const box = this.card.getBoundingClientRect();
    let side: Side = 'none';
    let x = (W - box.width) / 2;
    let y = this.surface === 'market' ? H - box.height - 90 : 64;
    this.ring.hidden = !r;
    if (r) {
      const ring = {
        left: r.left - PAD,
        top: r.top - PAD,
        right: r.right + PAD,
        bottom: r.bottom + PAD,
      };
      Object.assign(this.ring.style, {
        left: `${ring.left}px`,
        top: `${ring.top}px`,
        width: `${ring.right - ring.left}px`,
        height: `${ring.bottom - ring.top}px`,
      });
      const fits: Record<Exclude<Side, 'none'>, boolean> = {
        top: ring.top - GAP - box.height > 8,
        bottom: ring.bottom + GAP + box.height < H - 8,
        left: ring.left - GAP - box.width > 8,
        right: ring.right + GAP + box.width < W - 8,
      };
      // Beside tall controls on the edges (sail lever, compass), above or below the rest.
      const tall = r.height > r.width * 1.3 || r.right > W - 60;
      const order: Side[] = tall
        ? ['left', 'right', 'bottom', 'top']
        : ['top', 'bottom', 'right', 'left'];
      side = order.find((s) => s !== 'none' && fits[s]) ?? 'none';
      const cx = (ring.left + ring.right) / 2;
      const cy = (ring.top + ring.bottom) / 2;
      if (side === 'top' || side === 'bottom') {
        x = clamp(cx - box.width / 2, 10, W - box.width - 10);
        y = side === 'top' ? ring.top - GAP - box.height : ring.bottom + GAP;
        this.arrow.style.left = `${clamp(cx - x - 7, 12, box.width - 26)}px`;
        this.arrow.style.top = '';
      } else if (side === 'left' || side === 'right') {
        y = clamp(cy - box.height / 2, 10, H - box.height - 10);
        x = side === 'left' ? ring.left - GAP - box.width : ring.right + GAP;
        this.arrow.style.top = `${clamp(cy - y - 7, 12, box.height - 26)}px`;
        this.arrow.style.left = '';
      }
    }
    this.card.dataset.side = side;
    this.card.style.left = `${Math.round(clamp(x, 8, W - box.width - 8))}px`;
    this.card.style.top = `${Math.round(clamp(y, 8, H - box.height - 8))}px`;
  }
}
