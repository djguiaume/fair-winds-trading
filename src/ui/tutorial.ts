import { t } from '../i18n';
import type { QuestBook } from '../sim/quests';
import { type LessonModel, lessonDone, lessonFor } from './questView';

/** Button glyphs on the bubble, shown only while the pad is the last input (decision 0183). */
const PAD_A = '<i class="pad-key a pad-only" aria-hidden="true">A</i>';
const PAD_Y = '<i class="pad-key y pad-only" aria-hidden="true">Y</i>';

type Surface = 'sea' | 'chart' | 'market' | null;
type Side = 'top' | 'bottom' | 'left' | 'right' | 'none';

/** The tutorial: the quest the title menu and the first-voyage offer start (decision 0151). */
export const TUTORIAL_QUEST = 'first-voyage';
/** The sailing lessons: Rook's course, replayable from the title menu (decision 0164). */
export const LESSONS_QUEST = 'sailing-lessons';

/**
 * The element a lesson points at on the open surface (decision 0061). Selectors only, so the
 * sea HUD, chart and port screen keep their own markup; null leaves the bubble unpinned. Which
 * target each step uses is its `coach` entry in the lesson's quest file (decision 0151).
 */
function lessonTarget(lesson: LessonModel, surface: Surface): string | null {
  if (!surface) return null;
  const { port, good } = lesson;
  const target = lesson.targets[surface];
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
 * Whether the tutorial was offered on this map's voyages before (decision 0025): a fresh voyage
 * offers it only while it is `unseen`; `skipped` and `completed` are remembered across voyages.
 * Kept in the browser like a setting; the lesson's progress is the voyage's (decision 0151).
 */
export class TutorialChoice {
  status: 'unseen' | 'skipped' | 'completed' = 'unseen';
  readonly key: string;
  constructor(
    mapName: string,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  ) {
    this.key = `fwt.tutorial.v1.${mapName}`;
    try {
      const raw = JSON.parse(storage?.getItem(this.key) ?? 'null') as { status?: string } | null;
      // An `active` status is from before 0151, when the lesson kept its progress here: like an
      // unfinished lesson then, a fresh voyage offers the tutorial again.
      if (raw?.status === 'skipped' || raw?.status === 'completed') this.status = raw.status;
    } catch {
      /* Private storage or malformed state: offer it again. */
    }
  }
  /**
   * A lesson under way in the browser's storage from before decision 0151: its step and picks, to
   * move into the voyage's quest progress once.
   */
  legacy(): { step: string; vars: Record<string, string> } | null {
    try {
      const raw = JSON.parse(this.storage?.getItem(this.key) ?? 'null') as Record<
        string,
        unknown
      > | null;
      if (raw?.status !== 'active' || typeof raw.step !== 'string') return null;
      const vars: Record<string, string> = {};
      for (const [from, to] of [
        ['origin', 'origin'],
        ['delivery', 'delivery'],
        ['good', 'cargo'],
      ] as const)
        if (typeof raw[from] === 'string') vars[to] = raw[from] as string;
      return { step: raw.step, vars };
    } catch {
      return null;
    }
  }
  shouldOffer(resumedVoyage: boolean) {
    return !resumedVoyage && this.status === 'unseen';
  }
  set(status: 'skipped' | 'completed') {
    this.status = status;
    try {
      this.storage?.setItem(this.key, JSON.stringify({ status }));
    } catch {
      /* optional */
    }
  }
}

/**
 * Coach marks: one small bubble and a brass ring on the element to tap, moved into whichever
 * surface is open (sea, chart or port). No timers: the game calls `place()` at HUD rate and it
 * only writes to the DOM when a target moves. It shows the running lesson of the quest book
 * (decision 0151), and a finished lesson's last bubble until it is dismissed.
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
  /** A button of the lesson's step ("Continue") was pressed. */
  onOption: (quest: string, option: string) => void = () => {};
  /** Skip: the lesson stops. */
  onSkip: (quest: string) => void = () => {};
  /** A lesson that finished: its last bubble shows until "Sail freely". */
  finished: string | null = null;
  constructor(
    private readonly book: QuestBook,
    private readonly harbours: Record<string, { x: number; y: number }>,
  ) {
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
  private get lesson(): LessonModel | null {
    return lessonFor(this.book, this.harbours);
  }
  render() {
    const host = this.surface ? document.getElementById(`tutorial-${this.surface}`) : null;
    const lesson = this.lesson;
    const show = Boolean(host) && (lesson !== null || this.finished !== null);
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
    const finished = !lesson;
    this.target = !lesson || this.collapsed ? null : lessonTarget(lesson, this.surface);
    const targetFound = Boolean(
      visibleRect(this.target ? document.querySelector(this.target) : null),
    );
    const signature = JSON.stringify([
      finished && this.finished,
      lesson,
      this.collapsed,
      this.surface,
      targetFound,
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.pinned = targetFound;
      this.build(lesson, targetFound);
    }
    this.placement = '';
    this.place();
  }

  private build(lesson: LessonModel | null, targetFound: boolean) {
    const done = lesson ? null : lessonDone(this.book, this.finished ?? '');
    const finished = done !== null;
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
    // A step off the main line (a way back) keeps the dots of the last one passed.
    const step = (lesson?.stepNo ?? 0) - 1;
    const steps = lesson?.steps ?? 0;
    const dots = document.createElement('span');
    dots.className = 'coach-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < steps; i++) {
      const dot = document.createElement('i');
      if (finished || i < step) dot.className = 'done';
      else if (i === step) dot.className = 'now';
      dots.append(dot);
    }
    const title = document.createElement('h3');
    title.setAttribute('role', 'status');
    title.textContent = done
      ? done.title
      : step >= 0
        ? `${step + 1}/${steps} · ${lesson!.title}`
        : lesson!.title;
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
    copy.textContent = done ? done.copy : lesson!.copy;
    this.card.append(copy);
    const actions = document.createElement('div');
    actions.className = 'coach-actions';
    this.card.append(actions);
    if (done) {
      button(actions, 'tutorial-finish', t('tutorial.free'), 'd-btn brass', () => {
        this.finished = null;
        this.render();
      }).insertAdjacentHTML('afterbegin', PAD_A);
      return this.refocus(focusedId);
    }
    lesson = lesson!;
    const quest = lesson.quest;
    // The step's options: the first keeps the id the tests and the focus know ("Continue").
    lesson.options.forEach((o, i) => {
      const b = button(
        actions,
        i ? `tutorial-option-${o.id}` : 'tutorial-continue',
        o.title,
        'd-btn brass',
        () => this.onOption(quest, o.id),
      );
      if (!i) b.insertAdjacentHTML('afterbegin', PAD_A);
    });
    // The ring already shows what to tap; a button only when nothing is pinned, or for tips.
    const offSurface = lesson.action === 'chart' && this.surface === 'chart';
    if (lesson.action && !offSurface && (lesson.action === 'tips' || !targetFound)) {
      const label = {
        chart: t('tutorial.openMap'),
        market: t('tutorial.openMarket'),
        tips: t('tutorial.showTips'),
      }[lesson.action];
      const action = lesson.action;
      const go = button(actions, 'tutorial-action', label, 'd-btn', () => {
        if (action === 'chart') this.onChart();
        else if (action === 'market') this.onMarket();
        else this.onTips();
      });
      if (!lesson.options.length) go.insertAdjacentHTML('afterbegin', PAD_A);
    }
    const skip = button(actions, 'tutorial-skip', t('tutorial.skip'), 'coach-text-btn', () =>
      this.onSkip(quest),
    );
    skip.insertAdjacentHTML('afterbegin', PAD_Y);
    skip.style.marginLeft = 'auto';
    skip.insertAdjacentHTML(
      'beforeend',
      '<svg class="icon" aria-hidden="true"><use href="#i-close" /></svg>',
    );
    this.refocus(focusedId);
  }

  /**
   * A game controller at sea (decision 0183), where the pad steers and the bubble is not a menu:
   * A presses the bubble's main button (Continue, the step's action, Sail freely), Y skips the
   * lesson. True when the bubble took the press.
   */
  padPress(kind: 'main' | 'skip'): boolean {
    if (this.card.hidden || !this.card.isConnected) return false;
    const ids =
      kind === 'skip'
        ? ['tutorial-skip']
        : ['tutorial-continue', 'tutorial-finish', 'tutorial-action'];
    for (const id of ids) {
      const b = this.card.querySelector<HTMLButtonElement>(`#${id}`);
      if (b && !b.disabled) {
        b.click();
        return true;
      }
    }
    return false;
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
