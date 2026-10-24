import type { QuestBook } from '../sim/quests';

/*
 * The quest test bar (decision 0142): while a quest is played from one of its steps (opened from
 * the quest builder), a strip at the top says which quest and step run, with Restart step, Skip
 * step and back to the editor. Editor-only English, like the map editor: players never see it.
 */
export class QuestTestBar {
  readonly el = document.createElement('div');
  private readonly label = document.createElement('span');
  onRestart: () => void = () => {};
  onSkip: () => void = () => {};

  constructor(
    private readonly quests: QuestBook,
    private readonly questId: string,
  ) {
    this.el.className = 'quest-test-bar';
    this.el.setAttribute('role', 'status');
    const button = (text: string, title: string, act: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', act);
      return b;
    };
    const back = document.createElement('a');
    back.href = './editor.html';
    back.textContent = '✕ Editor';
    back.title = 'Back to the quest builder';
    this.el.append(
      this.label,
      button('↺ Restart', 'Play this step again from its start', () => this.onRestart()),
      button('⏭ Skip step', 'Count this step as done (a choice takes its first option)', () =>
        this.onSkip(),
      ),
      back,
    );
    document.body.append(this.el);
  }

  /** The tested quest now: its step and where in the quest it is, or that it is done. */
  update() {
    const quest = this.quests.quests.find((q) => q.id === this.questId);
    const step = this.quests.progress(this.questId)?.step;
    const no = quest ? quest.steps.findIndex((s) => s.id === step) : -1;
    this.label.textContent = !quest
      ? `Quest test · no quest "${this.questId}" on this map`
      : this.quests.isDone(quest.id)
        ? `Quest test · ${quest.name} · finished`
        : `Quest test · ${quest.name} · ${step} (${no + 1}/${quest.steps.length})`;
  }
}
