import { describe, expect, it } from 'vitest';
import { setTextVariant, t } from '../src/i18n';
import { WayOfPlaying, firstWay, wayOfEvent } from '../src/input/wayOfPlaying';
import { lineKeys, textKeys } from '../src/editor/quest/doc';
import type { QuestDef } from '../src/sim/quests';

describe('texts per way of playing (decision 0184)', () => {
  it('reads the version for touch, keys or pad, else the default', () => {
    const sell = (v: Parameters<typeof setTextVariant>[0]) => {
      setTextVariant(v);
      return t('lesson.sell.copy', { cargo: 'fish' });
    };
    expect(sell(null)).toBe('Sell fish here, or use Sell all.');
    expect(sell('touch')).toBe('Sell fish here, or tap Sell all.');
    expect(sell('keys')).toBe('Sell fish here, or click Sell all.');
    expect(sell('pad')).toBe('Sell fish here, or press X to sell all.');
    // A line with no versions reads the same for everyone.
    setTextVariant('touch');
    expect(t('lesson.wind.title')).toBe('Let the wind help');
    setTextVariant(null);
  });

  it('tells the way of playing from the last input', () => {
    expect(wayOfEvent({ type: 'pointerdown', pointerType: 'touch' })).toBe('touch');
    expect(wayOfEvent({ type: 'pointerdown', pointerType: 'pen' })).toBe('touch');
    expect(wayOfEvent({ type: 'pointerdown', pointerType: 'mouse' })).toBe('keys');
    expect(wayOfEvent({ type: 'keydown', key: 'm' })).toBe('keys');
    expect(wayOfEvent({ type: 'keydown', key: 'GamepadA' })).toBeNull(); // Edge's pad key
    const media = (coarse: boolean, fine: boolean) => (q: string) =>
      q.includes('any-pointer') ? fine : coarse;
    expect(firstWay(media(true, false))).toBe('touch'); // a phone
    expect(firstWay(media(true, true))).toBe('keys'); // a laptop with a touch screen
    expect(firstWay(media(false, true))).toBe('keys');
  });

  it('follows touch, mouse and the pad, and ignores the pad’s own clicks', () => {
    const listeners: Record<string, ((e: unknown) => void)[]> = {};
    const target = {
      addEventListener: (type: string, fn: (e: unknown) => void) =>
        (listeners[type] ??= []).push(fn),
    } as unknown as Window;
    let padHeld = false;
    const way = new WayOfPlaying(target, 'keys', () => padHeld);
    const seen: string[] = [];
    way.onChange = (w) => seen.push(w);
    const fire = (type: string, e: object) => listeners[type]?.forEach((fn) => fn({ type, ...e }));
    fire('pointerdown', { pointerType: 'touch' });
    way.setPad(true);
    padHeld = true;
    fire('pointerdown', { pointerType: 'mouse' }); // Edge's pointer mode: A clicks too
    expect(way.way).toBe('pad');
    padHeld = false;
    way.setPad(false);
    fire('keydown', { key: 'ArrowUp' });
    expect(seen).toEqual(['touch', 'pad', 'touch', 'keys']);
  });

  it('gives the quest builder a default and three versions for each speech', () => {
    const q = {
      id: 'x',
      text: 'quest.x',
      steps: [{ id: 'a' }],
    } as unknown as QuestDef;
    const speech = textKeys(q).find((l) => l.key === 'quest.x.a.copy')!;
    expect(lineKeys(speech).map((k) => k.key)).toEqual([
      'quest.x.a.copy',
      'quest.x.a.copy@touch',
      'quest.x.a.copy@keys',
      'quest.x.a.copy@pad',
    ]);
    const ask = textKeys(q).find((l) => l.key === 'quest.x.a.title')!;
    expect(lineKeys(ask)).toHaveLength(1);
  });
});
