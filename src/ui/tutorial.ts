import { TUTORIAL_STEPS, type Tutorial } from '../sim/tutorial';

type Surface = 'sea' | 'chart' | 'market' | null;

/** One reusable card: only the active surface receives it, with no timers or animation. */
export class TutorialCard {
  private surface: Surface = null;
  private collapsed = false;
  private readonly card = document.createElement('aside');
  private signature = '';
  onChart: () => void = () => {};
  onMarket: () => void = () => {};
  onTips: () => void = () => {};
  constructor(private readonly tutorial: Tutorial) {
    this.card.className = 'tutorial-card';
    this.card.setAttribute('aria-label', 'Optional sailing tutorial');
  }
  setSurface(surface: Surface) {
    this.surface = surface;
    this.render();
  }
  render() {
    const host = this.surface ? document.getElementById(`tutorial-${this.surface}`) : null;
    this.card.hidden = !host || (!this.tutorial.isActive && !this.tutorial.finishedNotice);
    if (!host) return;
    if (this.card.parentElement !== host) host.append(this.card);
    if (this.card.hidden) {
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
    const lesson = tutorial.lesson;
    const signature = JSON.stringify([tutorial.status, tutorial.step, lesson, this.collapsed]);
    if (signature === this.signature) return;
    this.signature = signature;
    const focusedId = this.card.contains(document.activeElement)
      ? document.activeElement?.id
      : null;
    this.card.replaceChildren();
    const header = document.createElement('div');
    header.className = 'tutorial-card-header';
    const title = document.createElement('h3');
    title.setAttribute('role', 'status');
    const step = TUTORIAL_STEPS.indexOf(tutorial.step) + 1;
    title.textContent = tutorial.finishedNotice
      ? 'First delivery complete!'
      : `${step}/${TUTORIAL_STEPS.length} · ${lesson.title}`;
    header.append(title);
    this.card.append(header);
    const button = (host: HTMLElement, id: string, label: string, action: () => void) => {
      const b = document.createElement('button');
      b.id = id;
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', action);
      host.append(b);
      return b;
    };
    button(header, 'tutorial-collapse', this.collapsed ? 'Show' : 'Hide', () => {
      this.collapsed = !this.collapsed;
      this.render();
    }).setAttribute('aria-expanded', String(!this.collapsed));
    if (!this.collapsed) {
      const copy = document.createElement('p');
      copy.textContent = tutorial.finishedNotice
        ? 'You can now explore, compare prices and save for upgrades. Free sailing has no assigned circuit. Replay the tutorial from Menu anytime.'
        : lesson.copy;
      this.card.append(copy);
      const actions = document.createElement('div');
      actions.className = 'tutorial-actions';
      this.card.append(actions);
      if (tutorial.finishedNotice)
        button(actions, 'tutorial-finish', 'Free sailing', () => tutorial.dismissFinished());
      else {
        if (lesson.action && !(lesson.action === 'chart' && this.surface === 'chart')) {
          const label = { chart: 'Open map', market: 'Open market', tips: 'Show tacking tips' }[
            lesson.action
          ];
          button(actions, 'tutorial-action', label, () => {
            if (lesson.action === 'chart') this.onChart();
            else if (lesson.action === 'market') this.onMarket();
            else this.onTips();
          });
        }
        if (lesson.continueText)
          button(actions, 'tutorial-continue', lesson.continueText, () =>
            tutorial.continueLesson(),
          );
        button(actions, 'tutorial-skip', 'Skip tutorial', () => tutorial.skip());
      }
    }
    // Keep keyboard focus inside the card when a lesson replaces its current action.
    if (focusedId)
      (
        this.card.querySelector<HTMLElement>(`#${focusedId}`) ??
        this.card.querySelector<HTMLElement>('button')
      )?.focus({ preventScroll: true });
  }
}
