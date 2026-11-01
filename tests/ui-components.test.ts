// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Dialog,
  TabBar,
  Toaster,
  button,
  card,
  listRow,
  panel,
  panelClasses,
  screenHeader,
} from '../src/ui/components';
import { reachable, startOf } from '../src/ui/padFocus';

// The v1.5 components (decision 0269): variants, the pad's focus order and night paper.
afterEach(() => {
  document.body.replaceChildren();
});

const ids = (els: HTMLElement[]) => els.map((e) => e.textContent?.trim());

describe('button', () => {
  it('has one paint per variant; the pad starts on primary, never on danger', () => {
    const main = button({ label: 'Set sail', variant: 'primary' });
    const plain = button({ label: 'Later' });
    const danger = button({ label: 'New game', variant: 'danger' });
    expect(main.className).toBe('ui-btn ui-btn--primary ui-pressable');
    expect(plain.classList.contains('ui-btn--plain')).toBe(true);
    expect(main.type).toBe('button');
    document.body.append(danger, plain, main);
    expect(startOf(reachable(document.body))).toBe(main);
    main.remove();
    expect(startOf(reachable(document.body))).toBe(plain);
  });

  it('stays reachable but does nothing when soft-disabled', () => {
    const press = vi.fn();
    const b = button({ label: 'Buy', disabled: true, onPress: press });
    b.click();
    expect(press).not.toHaveBeenCalled();
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(b.disabled).toBe(false);
  });
});

describe('tab bar', () => {
  const tabs = [
    { id: 'market', label: 'Market' },
    { id: 'shipyard', label: 'Shipyard' },
    { id: 'quay', label: 'Quay' },
  ];

  it('puts the tabs between the LB and RB glyphs, in order', () => {
    const bar = new TabBar({ tabs });
    const kids = [...bar.root.children] as HTMLElement[];
    expect(kids[0]!.dataset.padKey).toBe('lb');
    expect(kids.at(-1)!.dataset.padKey).toBe('rb');
    const tabEls = [...bar.root.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(ids(tabEls)).toEqual(['Market', 'Shipyard', 'Quay']);
    expect(tabEls.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });

  it('steps round the ends and says which tab it picked', () => {
    const picked: string[] = [];
    const bar = new TabBar({ tabs, selected: 'quay', onSelect: (id) => picked.push(id) });
    bar.step(1);
    expect(bar.selected).toBe('market');
    bar.step(-1);
    bar.root.querySelector<HTMLElement>('[data-tab="shipyard"]')!.click();
    bar.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(picked).toEqual(['market', 'quay', 'shipyard', 'quay']);
  });
});

describe('card and list row', () => {
  it('is a button the pad can reach only when it does something', () => {
    const press = vi.fn();
    const pick = card({
      title: 'Captain',
      text: 'The standard voyage',
      onPress: press,
      selected: true,
    });
    const info = card({ title: 'Note' });
    expect(pick.tagName).toBe('BUTTON');
    expect(info.tagName).toBe('ARTICLE');
    expect(pick.getAttribute('aria-pressed')).toBe('true');
    pick.click();
    expect(press).toHaveBeenCalledOnce();
    const row = listRow({ label: 'Fish', detail: 'From Saltmere', value: '12', onPress: press });
    const still = listRow({ label: 'Hold' });
    document.body.append(row, still, info);
    expect(reachable(document.body)).toEqual([row]);
    expect(row.querySelector('.ui-row-value')!.textContent).toBe('12');
  });
});

describe('panel', () => {
  it('has the torn edge by default and follows the night unless told', () => {
    expect(panelClasses()).toBe('ui-panel ui-panel--torn');
    expect(panelClasses('plain', 'night')).toBe('ui-panel ui-panel--plain ui-panel--night');
    const p = panel({ night: 'day', tag: 'aside' }, document.createTextNode('x'));
    expect(p.tagName).toBe('ASIDE');
    expect(p.className).toBe('ui-panel ui-panel--torn ui-panel--day');
    expect(p.textContent).toBe('x');
  });
});

describe('screen header', () => {
  it('puts back before the title and close after; the pad does not start there', () => {
    const exit = vi.fn();
    const back = screenHeader({ title: 'Settings', onExit: exit, legend: true });
    const close = screenHeader({ title: 'Port', exit: 'close', onExit: exit });
    expect(back.root.firstElementChild).toBe(back.exit);
    expect(close.root.lastElementChild).toBe(close.exit);
    expect(back.legend?.className).toBe('ui-header-legend');
    expect(close.legend).toBeNull();
    back.exit!.click();
    expect(exit).toHaveBeenCalledOnce();
    const main = button({ label: 'OK', variant: 'plain' });
    document.body.append(back.root, main);
    expect(startOf(reachable(document.body))).toBe(main);
  });
});

describe('dialog', () => {
  it('keeps the choices in order, focuses the main one and resolves with it', async () => {
    const d = new Dialog({
      title: 'Abandon the voyage?',
      text: 'Your cargo stays in port.',
      cancel: 'keep',
      choices: [
        { label: 'Keep sailing', value: 'keep' },
        { label: 'Abandon', value: 'abandon', variant: 'danger' },
        { label: 'Save first', value: 'save', variant: 'primary' },
      ],
    });
    const answer = d.ask();
    expect(ids(d.buttons)).toEqual(['Keep sailing', 'Abandon', 'Save first']);
    expect(document.activeElement).toBe(d.buttons[2]);
    d.buttons[1]!.click();
    await expect(answer).resolves.toBe('abandon');
  });

  it('resolves with cancel when Esc or B closes it', async () => {
    const d = new Dialog({
      title: 'Leave?',
      cancel: null,
      choices: [{ label: 'Leave', value: 1 }],
    });
    const answer = d.ask();
    d.root.close();
    await expect(answer).resolves.toBeNull();
  });
});

describe('toast', () => {
  it('shows one line at a time, in order, and the same line twice once', () => {
    const timers: (() => void)[] = [];
    const toaster = new Toaster({ set: (run) => timers.push(run) });
    toaster.show('Sold 4 fish');
    toaster.show('Sold 4 fish');
    toaster.show('Storm ahead', { kind: 'bad' });
    expect(toaster.current).toBe('Sold 4 fish');
    expect(toaster.queued).toBe(1);
    timers.shift()!(); // its time is up: it sinks
    expect(toaster.root.querySelector<HTMLElement>('.ui-toast')!.dataset.leave).toBe('');
    timers.shift()!(); // gone: the next one rises
    expect(toaster.current).toBe('Storm ahead');
    expect(toaster.root.querySelector<HTMLElement>('.ui-toast')!.dataset.kind).toBe('bad');
    timers.shift()!();
    timers.shift()!();
    expect(toaster.current).toBeNull();
    expect(toaster.root.querySelector<HTMLElement>('.ui-toast')!.hidden).toBe(true);
  });
});
