import { type ButtonVariant, button } from './button';
import { el } from './dom';
import { panelClasses } from './panel';

/**
 * The one dialog (decision 0269): a modal on torn paper with a title, a text or any body, and
 * its choices as buttons, in the order given. `ask` opens it and resolves with the chosen
 * value, or with `cancel` on Esc, B (padFocus.ts sends the dialog `cancel`) or any other close.
 */
export interface DialogChoice<T> {
  label: string;
  value: T;
  variant?: ButtonVariant;
}

export interface DialogOptions<T> {
  title: string;
  text?: string;
  body?: Node;
  choices: readonly DialogChoice<T>[];
  cancel: T;
}

let dialogs = 0;

export class Dialog<T> {
  readonly root: HTMLDialogElement;
  private result: T;
  private pending: ((value: T) => void) | null = null;

  constructor(private readonly o: DialogOptions<T>) {
    this.result = o.cancel;
    this.root = el('dialog', `ui-dialog ${panelClasses('torn')}`);
    const title = el('h2', 'ui-dialog-title', o.title);
    title.id = `ui-dialog-${++dialogs}`;
    this.root.setAttribute('aria-labelledby', title.id);
    this.root.append(title);
    if (o.text) this.root.append(el('p', 'ui-dialog-text', o.text));
    if (o.body) this.root.append(o.body);
    const actions = el('div', 'ui-dialog-actions');
    for (const c of o.choices)
      actions.append(
        button({
          label: c.label,
          variant: c.variant,
          onPress: () => {
            this.result = c.value;
            this.root.close();
          },
        }),
      );
    this.root.append(actions);
    this.root.addEventListener('close', () => {
      const done = this.pending;
      this.pending = null;
      done?.(this.result);
    });
  }

  /** The choices' buttons, in focus order. */
  get buttons(): HTMLButtonElement[] {
    return [...this.root.querySelectorAll<HTMLButtonElement>('.ui-dialog-actions .ui-btn')];
  }

  /** Opens the dialog over the page and waits for a choice. */
  ask(host: HTMLElement = document.body): Promise<T> {
    if (!this.root.isConnected) host.append(this.root);
    this.result = this.o.cancel;
    if (!this.root.open) this.root.showModal();
    const buttons = this.buttons;
    (buttons.find((b) => b.dataset.padMain !== undefined) ?? buttons[0])?.focus();
    return new Promise((resolve) => (this.pending = resolve));
  }
}
