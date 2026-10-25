// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import * as trade from '../src/sim/trade';
import { SLOOP } from '../src/sim/ship';
import { createWorld, setPortDestination } from '../src/sim/world';
import { PortLabels, type PortMarkerMode } from '../src/ui/portLabels';

afterEach(() => vi.restoreAllMocks());

describe('bounded port label queries', () => {
  for (const mode of ['approach', 'objective', 'all'] as const) {
    it(`uses a finite cutoff for distant discovered ports in ${mode} mode`, () => {
      const world = createWorld(PHASE1_MAP, SLOOP);
      world.trade.dockedAt = null;
      Object.assign(world.boat, { x: 100000, y: 100000 });
      const layer = document.createElement('div');
      const labels = new PortLabels(layer, world);
      labels.mode = mode;
      const query = vi.spyOn(trade, 'distanceToPort');
      labels.update(() => ({ x: 0, y: 0, onScreen: true }));
      expect(query).toHaveBeenCalled();
      for (const call of query.mock.calls) expect(call[5]).toBe(mode === 'all' ? 160 : 100);
      expect(query.mock.results.every((result) => result.value === Infinity)).toBe(true);
    });
  }

  it('keeps distant objectives and docked ports visible with their correct cues', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const port = world.map.ports[0]!;
    Object.assign(world.boat, { x: 100000, y: 100000 });
    world.trade.dockedAt = null;
    setPortDestination(world, port.id);
    const layer = document.createElement('div');
    const labels = new PortLabels(layer, world);
    labels.mode = 'objective';
    const project = () => ({ x: 0, y: 0, onScreen: true });
    labels.update(project);
    const marker = layer.querySelector<HTMLElement>(`[data-port-id="${port.id}"]`)!;
    expect(marker.hidden).toBe(false);
    expect(labels.dockShown(port.id)).toBe(false);
    expect(marker.querySelector('.port-marker-cue')!.textContent).toBe('Trading harbour');
    world.trade.dockedAt = port.id;
    labels.mode = 'approach';
    labels.update(project);
    expect(marker.hidden).toBe(false);
    expect(labels.dockShown(port.id)).toBe(true);
    expect(marker.querySelector('.port-marker-dock-text')!.textContent).toBe('Trade');
  });

  for (const [mode, kidMode, range] of [
    ['approach', false, 100],
    ['objective', false, 100],
    ['all', false, 160],
    ['all', true, 100],
  ] as const) {
    it(`preserves the ${range}-unit visibility boundary for ${mode}, kid mode ${kidMode}`, () => {
      const world = createWorld(PHASE1_MAP, SLOOP);
      const port = world.map.ports[0]!;
      world.trade.dockedAt = null;
      world.destination = null;
      const layer = document.createElement('div');
      const labels = new PortLabels(layer, world);
      labels.mode = mode as PortMarkerMode;
      labels.isKidMode = kidMode;
      const query = vi.spyOn(trade, 'distanceToPort');
      const marker = layer.querySelector<HTMLElement>(`[data-port-id="${port.id}"]`)!;
      for (const gap of [range, range + 0.001]) {
        query.mockReturnValue(gap);
        labels.update(() => ({ x: 0, y: 0, onScreen: true }));
        expect(marker.hidden).toBe(gap > range);
        expect(query.mock.lastCall![5]).toBe(range);
      }
    });
  }
});
