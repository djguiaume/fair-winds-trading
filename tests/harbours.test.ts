// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { buildHighlandIslands, islandParts } from '../src/render/models/highlandIslands';
import { SLOOP, CUTTER } from '../src/sim/ship';
import { DOCK_RANGE, tryDock } from '../src/sim/trade';
import { createWorld, stepWorld } from '../src/sim/world';
import { PortLabels } from '../src/ui/portLabels';
import { TradePanel } from '../src/ui/tradePanel';

const mesh = buildHighlandIslands(PHASE1_MAP, { shadows: false }) as THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material
>;
const harbours = mesh.userData.harbours as Record<string, { x: number; y: number }>;
afterAll(() => {
  mesh.geometry.dispose();
  mesh.material.dispose();
});

function approach(portId: string, extra = 4) {
  const point = harbours[portId]!;
  const port = PHASE1_MAP.ports.find((p) => p.id === portId)!;
  const island = PHASE1_MAP.islands.find((i) => i.id === port.islandId)!;
  const dx = point.x - island.x,
    dy = point.y - island.y;
  const length = Math.hypot(dx, dy);
  return { x: point.x + (dx / length) * extra, y: point.y + (dy / length) * extra };
}

describe('visible harbour approaches', () => {
  it('exports the exact rendered pier head for each trading island', () => {
    expect(Object.keys(harbours)).toHaveLength(4);
    const wood = new THREE.Color('#9b6b3d');
    for (const port of PHASE1_MAP.ports) {
      const index = PHASE1_MAP.islands.findIndex((i) => i.id === port.islandId);
      const island = PHASE1_MAP.islands[index]!;
      const parts = islandParts(island, PHASE1_MAP, PHASE1_MAP.seed * 1000 + index);
      const pier = parts.find(
        (g) =>
          Math.abs(g.attributes.color!.getX(0) - wood.r) < 1e-6 &&
          Math.abs(g.attributes.color!.getY(0) - wood.g) < 1e-6 &&
          Math.abs(g.attributes.color!.getZ(0) - wood.b) < 1e-6,
      )!;
      expect(pier).toBeDefined();
      const pos = pier.attributes.position!;
      const vertices = new Map<string, { x: number; y: number }>();
      for (let i = 0; i < pos.count; i++)
        if (pos.getY(i) > 1) {
          const x = pos.getX(i),
            y = -pos.getZ(i);
          vertices.set(`${x},${y}`, { x, y });
        }
      const ends = [...vertices.values()]
        .sort(
          (a, b) =>
            Math.hypot(b.x - island.x, b.y - island.y) - Math.hypot(a.x - island.x, a.y - island.y),
        )
        .slice(0, 2);
      expect(harbours[port.id]!.x).toBeCloseTo((ends[0]!.x + ends[1]!.x) / 2, 4);
      expect(harbours[port.id]!.y).toBeCloseTo((ends[0]!.y + ends[1]!.y) / 2, 4);
      parts.forEach((g) => g.dispose());
    }
  });

  for (const ship of [SLOOP, CUTTER]) {
    for (const port of PHASE1_MAP.ports) {
      it(`${ship.name} can stop beyond ${port.name}'s pier and open trading`, () => {
        const world = createWorld(PHASE1_MAP, ship);
        Object.assign(world.boat, approach(port.id), { speedKn: 0, sailStep: 0 });
        document.body.innerHTML = '<div id="trade" hidden></div>';
        const panel = new TradePanel(document.querySelector('#trade')!, world);
        const events = stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60);
        expect(events).toContainEqual({ type: 'docked', portId: port.id });
        if (events.some((e) => e.type === 'docked')) panel.open();
        expect(panel.isOpen).toBe(true);
        expect(document.querySelector('#tp-tab-market')).not.toBeNull();
        expect(document.querySelector('#trade')!.textContent).toContain(port.name);
        expect(world.trade.dockedAt).toBe(port.id);
      });
    }
  }

  it('lets a stopped boat explicitly dock but rejects a fast or distant approach', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const port = PHASE1_MAP.ports[0]!;
    Object.assign(world.boat, approach(port.id), { speedKn: 6 });
    expect(tryDock(world.trade, world.map, world.boat, port.id)).toBe(false);
    Object.assign(world.boat, approach(port.id, DOCK_RANGE + 20), { speedKn: 0 });
    expect(tryDock(world.trade, world.map, world.boat, port.id)).toBe(false);
    expect(world.trade.dockedAt).toBeNull();
    Object.assign(world.boat, approach(port.id), { speedKn: 0 });
    expect(tryDock(world.trade, world.map, world.boat, port.id)).toBe(true);
    expect(world.trade.dockedAt).toBe(port.id);
  });

  it('places an anchor/name at the pier even when the island centre is off screen, with an actionable docking cue', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const port = PHASE1_MAP.ports[0]!;
    Object.assign(world.boat, approach(port.id), { speedKn: 3 });
    document.body.innerHTML = '<div id="labels"></div>';
    const layer = document.querySelector<HTMLElement>('#labels')!;
    const labels = new PortLabels(layer, world, harbours);
    labels.update((x, y) => ({
      x: 123,
      y: 234,
      onScreen: x === harbours[port.id]!.x && y === harbours[port.id]!.y,
    }));
    const marker = layer.querySelector<HTMLButtonElement>(`[data-port-id="${port.id}"]`)!;
    expect(marker.hidden).toBe(false);
    expect(marker.textContent).toContain('⚓');
    expect(marker.textContent).toContain(port.name);
    expect(marker.textContent).toContain('Slow down to dock');
    world.boat.speedKn = 0;
    labels.update(() => ({ x: 123, y: 234, onScreen: true }));
    expect(marker.textContent).toContain('Tap to dock & trade');
    labels.onPortClick = (id) => {
      if (tryDock(world.trade, world.map, world.boat, id)) world.trade.dockedAt = id;
    };
    marker.click();
    expect(world.trade.dockedAt).toBe(port.id);
    labels.update(() => ({ x: 123, y: 234, onScreen: true }));
    expect(marker.textContent).toContain('Docked · Tap to trade');
  });
});
