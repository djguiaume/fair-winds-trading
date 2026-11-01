// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { buildHighlandIslands } from '../src/render/models/highlandIslands';
import { islandParts } from '../src/render/models/islandParts';
import { SLOOP, SHIP_CLASSES } from '../src/sim/ship';
import { tryDock } from '../src/sim/trade';
import { createWorld, stepWorld } from '../src/sim/world';
import { PortLabels } from '../src/ui/portLabels';
import { TradePanel } from '../src/ui/tradePanel';
import { TUNING } from '../src/data/tuning';

// Tuning values moved to src/data/tuning (decision 0094).
const DOCK_RANGE = TUNING.seamanship.harbour.dockRange;

const mesh = buildHighlandIslands(PHASE1_MAP, { shadows: false });
const harbours = mesh.userData.harbours as Record<string, { x: number; y: number }>;
afterAll(() => {
  mesh.dispose();
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
    expect(Object.keys(harbours)).toHaveLength(PHASE1_MAP.ports.length);
    const wood = new THREE.Color('#9b6b3d');
    for (const port of PHASE1_MAP.ports) {
      const index = PHASE1_MAP.islands.findIndex((i) => i.id === port.islandId);
      const island = PHASE1_MAP.islands[index]!;
      const parts = islandParts(island, PHASE1_MAP, PHASE1_MAP.seed * 1000 + index, undefined, 2);
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

  for (const ship of Object.values(SHIP_CLASSES)) {
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

  for (const ship of Object.values(SHIP_CLASSES))
    for (const port of PHASE1_MAP.ports) {
      it(`${ship.name}: lowering sails near ${port.name} brings the boat to a dead stop and docks it`, () => {
        const world = createWorld(PHASE1_MAP, ship);
        const p = approach(port.id, 2);
        const island = PHASE1_MAP.islands.find((i) => i.id === port.islandId)!;
        // Drifting past the pier at a slow 2.5 kn, sails lowered.
        const tangent = Math.atan2(-(p.y - island.y), p.x - island.x);
        Object.assign(world.boat, p, { heading: tangent, speedKn: 2.5, sail: 0, sailStep: 0 });
        const events = [];
        for (let t = 0; t < 4; t += 1 / 60)
          events.push(...stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60));
        expect(events).toContainEqual({ type: 'docked', portId: port.id });
        expect(world.boat.speedKn).toBe(0);
        const moored = { x: world.boat.x, y: world.boat.y };
        for (let t = 0; t < 20; t += 1 / 60) stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60);
        expect(Math.hypot(world.boat.x - moored.x, world.boat.y - moored.y)).toBeLessThan(0.5);
        expect(world.trade.dockedAt).toBe(port.id);
      });
    }

  it('does not save a fast arrival: lowering sails at the last moment still crashes', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const pier = world.piers[0]!;
    const island = PHASE1_MAP.islands.find((i) => i.id === pier.islandId)!;
    // Straight at the island from the end of the pier, 8 kn, sails just dropped.
    const dx = pier.x1 - island.x,
      dy = pier.y1 - island.y,
      l = Math.hypot(dx, dy);
    const side = { x: -dy / l, y: dx / l };
    const start = { x: pier.x1 + side.x * 8, y: pier.y1 + side.y * 8 };
    const heading = Math.atan2(island.x - start.x, island.y - start.y);
    Object.assign(world.boat, start, { heading, speedKn: 8, sail: 0, sailStep: 0 });
    const events = [];
    for (let t = 0; t < 3; t += 1 / 60)
      events.push(...stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60));
    expect(events.some((e) => e.type === 'crash')).toBe(true);
    expect(world.trade.captain.hullDamage.sloop ?? 0).toBeGreaterThan(5);
  });

  it('still drifts with the wind with sails down in open water', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    Object.assign(world.boat, { x: 0, y: 0, speedKn: 0, sail: 0, sailStep: 0 });
    for (let t = 0; t < 10; t += 1 / 60) stepWorld(world, { steer: 0, sailStep: 0 }, 1 / 60);
    expect(world.trade.dockedAt).toBeNull();
    expect(Math.hypot(world.boat.x, world.boat.y)).toBeGreaterThan(1);
  });

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
      // Only the sign's foot, a little out from the pier over the water (issue #441), is on screen.
      onScreen:
        Math.hypot(x - harbours[port.id]!.x, y - harbours[port.id]!.y) <=
        TUNING.hud.portSignSeaward + 1e-6,
    }));
    const marker = layer.querySelector<HTMLButtonElement>(`[data-port-id="${port.id}"]`)!;
    expect(marker.hidden).toBe(false);
    const dock = marker.querySelector<HTMLElement>('.port-marker-dock')!;
    const cue = marker.querySelector<HTMLElement>('.port-marker-cue')!;
    expect(marker.querySelector('use[href="#i-anchor"]')).not.toBeNull();
    expect(marker.textContent).toContain(port.name);
    expect(cue.textContent).toBe('Lower sails to dock');
    expect(dock.hidden).toBe(true);
    world.boat.speedKn = 0;
    labels.update(() => ({ x: 123, y: 234, onScreen: true }));
    expect(cue.hidden).toBe(true);
    expect(dock.hidden).toBe(false);
    expect(dock.querySelector('.port-marker-dock-text')!.textContent).toBe('Dock');
    labels.onPortClick = (id) => {
      if (tryDock(world.trade, world.map, world.boat, id)) world.trade.dockedAt = id;
    };
    marker.click();
    expect(world.trade.dockedAt).toBe(port.id);
    labels.update(() => ({ x: 123, y: 234, onScreen: true }));
    expect(dock.querySelector('.port-marker-dock-text')!.textContent).toBe('Trade');
    // The pad's A shows on Trade once moored (decision 0199).
    expect((dock.querySelector('.dock-glyph') as HTMLElement).hidden).toBe(false);
    expect(marker.getAttribute('aria-label')).toContain('Docked · Tap to trade');
  });
});
