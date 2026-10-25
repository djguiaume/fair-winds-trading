// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { DIFFICULTIES } from '../src/sim/difficulty';
import html from '../index.html?raw';
import type { World } from '../src/sim/world';
import type { Input } from '../src/input/input';
import type { QuestBook } from '../src/sim/quests';

// Exercise real app wiring and native-dialog lifecycle without needing a WebGL renderer.
vi.mock('../src/render/view', () => ({
  GameView: class {
    harbours = {
      calda: { x: 152, y: 240 },
      saltmere: { x: 252, y: -134 },
      westholm: { x: -280, y: 40 },
      stonehaven: { x: -140, y: -270 },
    };
    resize() {}
    render() {}
    setQuality() {}
    setSettlementLevels() {}
    setHomeBuildings() {}
    setQuestsDone() {}
    setPennant() {}
    jumpToBoat() {}
    setFocus() {}
    setZoom() {}
    getZoom() {
      return 1;
    }
    project() {
      return { x: 300, y: 300, onScreen: true };
    }
  },
}));
afterEach(() => vi.unstubAllGlobals());

/**
 * New game in Settings (decision 0185): the tutorial seen on an earlier voyage is not offered
 * again, but the new voyage still starts with the prologue's story, without the coach.
 */
it.each(DIFFICULTIES)(
  'a new game on %s after the tutorial was seen starts at the prologue, without the coach',
  async (level) => {
    vi.resetModules();
    localStorage.clear();
    // The tutorial skipped on an earlier voyage of this browser.
    const { PHASE1_MAP } = await import('../src/data/maps');
    localStorage.setItem(
      `fwt.tutorial.v1.${PHASE1_MAP.name}`,
      JSON.stringify({ status: 'skipped' }),
    );
    document.body.innerHTML = html
      .split('<body>')[1]!
      .split('</body>')[0]!
      .replace(/<script[\s\S]*?<\/script>/g, '');
    window.history.replaceState(null, '', '/?debug');
    vi.stubGlobal('__BUILD_REVISION__', 'test');
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as WebGL2RenderingContext);
    await import('../src/main');
    const { world, quests } = (
      window as unknown as { fwt: { world: World; input: Input; quests: QuestBook } }
    ).fwt;
    expect(localStorage.getItem(`fwt.tutorial.v1.${world.map.name}`)).toContain('skipped');
    const offer = document.getElementById('tutorial-offer') as HTMLDialogElement;
    document.querySelector<HTMLButtonElement>('#menu-play')!.click();
    document.querySelector<HTMLButtonElement>(`.level-card[data-level="${level}"]`)!.click();
    document.querySelector<HTMLButtonElement>('#set-sail')!.click();
    expect(world.trade.difficulty).toBe(level);
    expect(offer.open).toBe(false);
    // Not beside Saltmere in free play: alone at sea at the prologue's spot, sails down.
    const start = world.map.prologue!.start;
    expect([world.boat.x, world.boat.y]).toEqual([start.x, start.y]);
    expect(world.boat.sailStep).toBe(0);
    expect(quests.progress('first-voyage')?.step).toBe('foghorn');
    expect(quests.isCoached('first-voyage')).toBe(false);
    // Rook's thanks waits for the rescue instead of paying the island on the first call.
    expect(quests.progress('rooks-thanks')).toBeUndefined();
    context.mockRestore();
  },
);
