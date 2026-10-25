// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import characterData from '../src/data/characters.json';
import { ISLAND_DESIGNS } from '../src/data/islands';
import { PHASE1_MAP, GAME_MAP } from '../src/data/maps';
import { applySteps } from '../src/editor/island/steps';
import en from '../src/i18n/en.json';
import fr from '../src/i18n/fr.json';
import {
  harbourAccent,
  harbourLight,
  harbourLightTime,
  harbourShot,
} from '../src/render/harbourView';
import { daylightAt } from '../src/sim/daylight';
import { islandPoint } from '../src/sim/islandLayout';
import { KEEPER_STATES, keeperArc, keeperState } from '../src/sim/keeper';
import { quickChecks } from '../src/sim/mapChecks';
import { SLOOP } from '../src/sim/ship';
import { homePort } from '../src/sim/shipyards';
import { createWorld } from '../src/sim/world';
import { TradePanel } from '../src/ui/tradePanel';
import { stepFromArgs } from '../tools/fw/island';
// @ts-expect-error plain JavaScript module without types
import { parseArgs } from '../tools/fw/lib.mjs';

const port = (id: string) => GAME_MAP.ports.find((p) => p.id === id)!;

describe('the harbour screen picture (decision 0211)', () => {
  it('takes the picture in the light of the time of day', () => {
    for (const light of ['day', 'golden', 'night'] as const)
      expect(harbourLight(daylightAt(harbourLightTime(light)))).toBe(light);
  });

  it('stands off the harbour pier by default and looks back at the town', () => {
    const island = PHASE1_MAP.islands.find((i) => i.id === 'saltmere')!;
    const pier = islandPoint(island, 0, 1);
    const shot = harbourShot(island, pier);
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x - island.x, p.y - island.y);
    expect(dist(shot.from)).toBeGreaterThan(dist(pier));
    expect(dist(shot.look)).toBeLessThan(dist(pier));
    expect(shot.fromHeight).toBeGreaterThan(shot.lookHeight);
  });

  it("follows an island file's harbourView, in the file's own coordinates", () => {
    const island = GAME_MAP.islands.find((i) => i.id === 'sunreach')!;
    const view = ISLAND_DESIGNS.sunreach!.harbourView!;
    const shot = harbourShot(island, { x: island.x, y: island.y }, view);
    expect(shot.from).toEqual(islandPoint(island, view.from![0], view.from![1]));
    expect(shot.fromHeight).toBeCloseTo(island.radius * view.height!);
  });

  it("colours the accent line with the port's signature, else its style's roof", () => {
    expect(harbourAccent(GAME_MAP, 'sunreach')).toBe('#2a8f6e');
    expect(harbourAccent(GAME_MAP, 'saltmere')).toBe('#3f74a8');
  });

  it('sets and clears the view with the island builder step and npm run island', () => {
    const design = structuredClone(ISLAND_DESIGNS.saltmere!);
    const step = stepFromArgs(
      'view',
      parseArgs(['--from', '0.2,2', '--look', '0,0.5', '--height', '0.4', '--accent', '#123456']),
      [],
    );
    applySteps(design, [step]);
    expect(design.harbourView).toEqual({
      from: [0.2, 2],
      look: [0, 0.5],
      height: 0.4,
      accent: '#123456',
    });
    applySteps(design, [stepFromArgs('view', parseArgs(['--accent', 'none']), [])]);
    expect(design.harbourView?.accent).toBeUndefined();
    applySteps(design, [{ do: 'view', clear: true }]);
    expect(design.harbourView).toBeUndefined();
  });
});

describe('the keeper on the harbour screen (decision 0211)', () => {
  const keepers = GAME_MAP.ports.filter((p) => p.keeper);

  it('has a keeper at every port but Abbey Head and Skerry, all known people', () => {
    expect(GAME_MAP.ports.filter((p) => !p.keeper && !p.site).map((p) => p.id)).toEqual(
      expect.arrayContaining(['abbey-head']),
    );
    for (const p of keepers)
      expect(
        characterData.characters.map((c) => c.id),
        p.id,
      ).toContain(p.keeper);
    expect(port('saltmere').keeper).toBe('rook');
    expect(port('palm-key').keeper).toBe('tam');
  });

  it('has lines in English and French for each state, under 90 characters', () => {
    for (const p of keepers) {
      const outpost = !keeperArc(p).length;
      for (const state of KEEPER_STATES) {
        if (outpost && (state === 'before' || state === 'running')) continue;
        const key = `keeper.${p.keeper}.${state}.1`;
        expect(en, key).toHaveProperty([key]);
        expect(fr, key).toHaveProperty([key]);
        expect((en as Record<string, string>)[key]!.length).toBeLessThan(90);
      }
    }
  });

  it("follows the port's arc: Kit's at Saltmere, Ness's own at Watchman Key", () => {
    expect(keeperArc(port('saltmere'))).toEqual(
      expect.arrayContaining(['saltmere-letter', 'saltmere-shoals']),
    );
    expect(keeperArc(port('watchman-key'))).toEqual(['watchman-passage']);
    const world = createWorld(GAME_MAP, SLOOP);
    const saltmere = port('saltmere');
    expect(keeperState(saltmere, world.trade)).toBe('before');
    world.trade.quests = { byId: { 'saltmere-letter': { step: 'done' } } } as never;
    expect(keeperState(saltmere, world.trade)).toBe('running');
    world.trade.quests = {
      byId: { 'saltmere-letter': { step: 'done' }, 'saltmere-shoals': { step: 'done' } },
    } as never;
    expect(keeperState(saltmere, world.trade)).toBe('done');
    expect(keeperState(saltmere, world.trade, true)).toBe('grew');
  });

  it('flags an unknown keeper in the map checks', () => {
    const map = structuredClone(PHASE1_MAP);
    map.ports[0]!.keeper = 'nobody';
    const links = quickChecks(map).find((c) => c.id === 'links')!;
    expect(links.ok).toBe(false);
    expect(links.message).toContain('unknown keeper');
  });

  it('shows the keeper, a line and the next growth under the Market rows', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.dockedAt = homePort(PHASE1_MAP).id;
    document.body.innerHTML = '<div id="panel" hidden></div>';
    const container = document.querySelector<HTMLElement>('#panel')!;
    const panel = new TradePanel(container, world);
    panel.harbourPicture = () => 'blob:picture';
    panel.open();
    const card = container.querySelector('.keeper-card')!;
    expect(card.textContent).toContain('Rook');
    expect(en).toHaveProperty(
      ['keeper.rook.before.1'],
      card.querySelector('.keeper-line')!.textContent,
    );
    expect(card.querySelector('.keeper-town')!.textContent).toContain('Next');
    expect(container.querySelector('.trade-header.has-view .port-view')).not.toBeNull();
    // The Quay with nobody on it shows the quay itself.
    panel.quay = { items: () => [], seen: () => {} } as never;
    panel.open('quay');
    expect(container.querySelector('.quay-empty .quay-view')).not.toBeNull();
  });
});
