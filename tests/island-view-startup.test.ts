// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { createWorld } from '../src/sim/world';
import { SLOOP } from '../src/sim/ship';
import { settlementLevels } from '../src/sim/settlement';
import { buildIslands } from '../src/render/models';
import { GameView } from '../src/render/view';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      shadowMap = {};
      setPixelRatio() {}
      setSize() {}
      dispose() {}
    },
  };
});
vi.mock('../src/render/models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/render/models')>();
  return { ...actual, buildIslands: vi.fn(actual.buildIslands) };
});

it('builds saved settlement levels once and keeps harbour lighting on level-up', () => {
  const world = createWorld(PHASE1_MAP, SLOOP);
  const port = world.map.ports[0]!;
  world.trade.settlements.byPort[port.id]!.level = 4;
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
  } as unknown as CanvasRenderingContext2D);
  const view = new GameView(document.createElement('canvas'), world, 'low');
  expect(buildIslands).toHaveBeenCalledExactlyOnceWith(world.map, {
    shadows: true,
    levels: settlementLevels(world.trade),
    look: 'v1',
    quality: 'low',
  });
  const model = vi.mocked(buildIslands).mock.results[0]!.value;
  const windows = model.userData.windows;
  const anchor = view.harbours[port.id];
  const lanterns = Reflect.get(view, 'lanterns');
  view.setSettlementLevels({ ...settlementLevels(world.trade), [port.id]: 3 });
  expect(buildIslands).toHaveBeenCalledTimes(1);
  expect(view.harbours[port.id]).toBe(anchor);
  expect(Reflect.get(view, 'lanterns')).toBe(lanterns);
  expect(model.userData.windows).toBe(windows);
  const dispose = vi.spyOn(model, 'dispose');
  view.dispose();
  expect(dispose).toHaveBeenCalledOnce();
  context.mockRestore();
});
