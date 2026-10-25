// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { PAD, controlProblems, type PadButton, type PadFrame } from '../src/input/gamepad';
import { PadFocus, guardSoftDisabled, hintsFor, softDisable, startOf } from '../src/ui/padFocus';

const press = (button: PadButton, repeat = false) => ({ button, repeat });
const still = (axes: Partial<PadFrame['axes']> = {}): PadFrame => ({
  axes: { lx: 0, ly: 0, rx: 0, ry: 0, ...axes } as PadFrame['axes'],
  held: new Set(),
  presses: [],
});

/** A port screen in miniature: tabs, the lot row, a buy button and a greyed upgrade. */
function portScreen() {
  document.body.innerHTML = `
    <div id="screen">
      <nav><button class="tab-btn active" aria-pressed="true">Market</button><button class="tab-btn" aria-pressed="false">Shipyard</button>
        <span data-pad="steps"><button data-lot="1" aria-pressed="true">×1</button><button data-lot="5" aria-pressed="false">×5</button><button data-lot="10" aria-pressed="false">×10</button></span></nav>
      <button id="buy" class="brass">Buy</button>
      <button id="upgrade" disabled>Upgrade · need 150 more</button>
    </div>
    <div id="hints"></div>`;
  const root = document.getElementById('screen')!;
  const clicked: string[] = [];
  root.addEventListener('click', (e) =>
    clicked.push((e.target as HTMLElement).id || (e.target as HTMLElement).dataset.lot!),
  );
  for (const b of root.querySelectorAll<HTMLElement>('[data-lot]'))
    b.addEventListener('click', () => {
      for (const o of root.querySelectorAll('[data-lot]'))
        o.setAttribute('aria-pressed', String(o === b));
    });
  guardSoftDisabled(root);
  softDisable(root);
  const focus = new PadFocus(
    () => ({ root, back: () => clicked.push('back') }),
    document.getElementById('hints'),
  );
  focus.setUsing(true);
  return { root, clicked, focus };
}

describe('the port screen with a game controller (decision 0192)', () => {
  it('LT / RT, the right stick and the hints are in the controls file, checked', () => {
    expect(PAD.menu.actions.less).toEqual(['lt']);
    expect(PAD.menu.actions.more).toEqual(['rt']);
    expect(controlProblems()).toEqual([]);
    const bad = structuredClone(PAD);
    bad.menu.scrollY = 'nope' as never;
    bad.menu.hintsSeconds = -1;
    expect(controlProblems(bad)).toEqual([
      'menu.hintsSeconds must be 0 or more (0: always up)',
      'menu.scrollY: no axis "nope"',
    ]);
  });

  it('a greyed button can take the focus but a click on it does nothing', () => {
    const { root, clicked } = portScreen();
    const upgrade = root.querySelector<HTMLButtonElement>('#upgrade')!;
    expect(upgrade.disabled).toBe(false);
    expect(upgrade.getAttribute('aria-disabled')).toBe('true');
    upgrade.focus();
    expect(document.activeElement).toBe(upgrade);
    upgrade.click();
    expect(clicked).toEqual([]);
  });

  it('starts on the main button; A there buys, A on a greyed button does not', () => {
    const { root, clicked, focus } = portScreen();
    focus.frame(still(), 0);
    expect(document.activeElement?.id).toBe('buy');
    focus.press(press('a'), 'menu'); // the pad just took over: shows the focus only
    focus.press(press('a'), 'menu');
    expect(clicked).toEqual(['buy']);
    root.querySelector<HTMLElement>('#upgrade')!.focus();
    focus.press(press('a'), 'menu');
    expect(clicked).toEqual(['buy']);
  });

  it('RT and LT step the lot, held RT repeats, and it stops at the ends', () => {
    const { root, focus } = portScreen();
    focus.frame(still(), 0);
    const lot = () => root.querySelector('[data-lot][aria-pressed="true"]')!.textContent;
    focus.press(press('rt'), 'menu');
    expect(lot()).toBe('×5');
    focus.press(press('rt', true), 'menu');
    focus.press(press('rt'), 'menu');
    expect(lot()).toBe('×10');
    focus.press(press('lt'), 'menu');
    expect(lot()).toBe('×5');
    // The focus stays where it was.
    expect(document.activeElement?.id).toBe('buy');
  });

  it('LT / RT leave the chart alone (its zoom)', () => {
    const { root, focus } = portScreen();
    focus.frame(still(), 0);
    focus.press(press('rt'), 'chart');
    expect(root.querySelector('[data-lot][aria-pressed="true"]')!.textContent).toBe('×1');
  });

  it('the pill lists what works on the screen and stays up', () => {
    const { root, focus } = portScreen();
    expect(hintsFor(root, PAD.menu.actions).map((h) => [h.buttons.join(' '), h.label])).toEqual([
      ['a', 'pad.choose'],
      ['b', 'pad.back'],
      ['lb rb', 'pad.tabs'],
      ['lt rt', 'pad.amount'],
    ]);
    focus.frame(still(), 0);
    const hints = document.getElementById('hints')!;
    expect(hints.classList.contains('show')).toBe(true);
    expect(hints.querySelectorAll('[data-pad-key]')).toHaveLength(6);
    // A screen with no tabs and no lot: A and B only.
    root.querySelector('nav')!.remove();
    expect(hintsFor(root, PAD.menu.actions)).toHaveLength(2);
  });

  it('never starts on Set sail while anything else is there, greyed or not', () => {
    document.body.innerHTML = `<button id="up" aria-disabled="true">Upgrade</button><button id="sail" class="brass" data-pad-start="never">Set sail</button><button class="close-btn">✕</button>`;
    const all = [...document.querySelectorAll<HTMLElement>('button')];
    expect(startOf(all)?.id).toBe('up');
    expect(startOf(all.slice(1))?.id).toBe('sail');
  });
});
