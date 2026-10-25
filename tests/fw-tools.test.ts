import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { ISLAND_DESIGNS } from '../src/data/islands';
import { checkAll } from '../tools/fw/check';
import { renderChart } from '../tools/fw/chart';
import { loadSea } from '../tools/fw/seas';
import { levelTable } from '../tools/fw/balance';
import { DIFFICULTIES } from '../src/sim/difficulty';
// @ts-expect-error plain JavaScript module without types
import { parseArgs } from '../tools/fw/lib.mjs';
// @ts-expect-error plain JavaScript module without types
import { nextFree } from '../tools/fw/adr.mjs';
import { normalise, planShots, seedStorage, shotPath } from '../tools/fw/shots.mjs';
import { problemsOf, questDoc, questPlay } from '../tools/fw/quest';

describe('command-line tools for agents (decision 0153)', () => {
  it('reads --name value, --name=value, flags and positional arguments', () => {
    expect(
      parseArgs(['new', 'A title', '--only', 'seas,quests', '--fast', '--map=a.json']),
    ).toEqual({
      _: ['new', 'A title'],
      only: 'seas,quests',
      fast: true,
      map: 'a.json',
    });
  });

  it('gives the number after the highest one taken', () => {
    expect(
      nextFree(
        new Map([
          [1, 'main'],
          [153, 'branch'],
          [12, 'main'],
        ]),
      ),
    ).toBe(154);
  });

  it('passes the shipped content with the editors’ checks', () => {
    const { problems, counted } = checkAll({ routes: 'none', seas: { ring: PHASE1_MAP } });
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(Object.keys(counted)).toEqual(['seas', 'islands', 'quests', 'perks']);
  }, 60000);

  it('reports a broken sea and an unknown island file', () => {
    const map = structuredClone(PHASE1_SOURCE);
    map.ports[0]!.islandId = 'nowhere';
    const { problems } = checkAll({
      only: ['seas', 'islands'],
      routes: 'none',
      seas: { broken: prepareMap(map) },
      islands: ['atlantis', Object.keys(ISLAND_DESIGNS)[0]!],
    });
    expect(problems.map((p) => `${p.area} ${p.where}`)).toContain('seas broken links');
    expect(problems).toContainEqual(
      expect.objectContaining({ area: 'islands', where: 'atlantis', severity: 'error' }),
    );
  });

  it('prints one balance line per difficulty level', () => {
    const run = {
      sharp: { cutter: 9.4, repairs: 0 },
      relaxed: { firstUpgrade: 5, cutter: 20.6, repairs: 0.01 },
      legs: { median: 64, slow: 130 },
    };
    const rows = levelTable(Object.fromEntries(DIFFICULTIES.map((l) => [l, run])));
    expect(rows).toHaveLength(DIFFICULTIES.length + 1);
    expect(rows[1]).toContain('64 s (130 s)');
    expect(rows[1]).toContain('5.0 / 20.6 / never min / 1 %');
  });

  it('draws a labelled chart of a sea with an overlay and a sailed route', () => {
    const { map, prepared } = loadSea('phase4');
    const out = renderChart({
      map,
      prepared,
      view: [-500, -800, 300, 0],
      routes: [['start', 'sunreach']],
      overlay: {
        title: 'Test chart',
        islands: [{ x: 0, y: -600, radius: 20, name: 'Proposed Isle' }],
        lines: [
          {
            points: [
              [0, 0],
              [0, -600],
            ],
            style: 'long',
            arrow: true,
          },
        ],
        labels: [{ at: [100, -100], text: 'A & B', note: 'note' }],
      },
    });
    expect(out.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    for (const text of ['Sunreach', 'Proposed Isle', 'A &amp; B', 'Test chart', 'long way'])
      expect(out.svg).toContain(text);
    expect(out.svg).not.toContain('data-hit');
    expect(out.routes[0]!.seconds).toBeGreaterThan(0);
    expect(out.counted.marks).toBeGreaterThan(0);
  }, 60000);
});

describe('npm run shots and npm run quest (decision 0153)', () => {
  it('reads a shot from the command line, with the game’s defaults', () => {
    const shot = planShots({
      _: [],
      at: '150,-30',
      zoom: '1.5',
      night: true,
      sizes: 'desktop,portrait',
    })[0]!;
    expect(shot).toMatchObject({
      sea: 'ring',
      at: [150, -30],
      heading: null,
      sail: 2,
      zoom: 1.5,
      night: true,
      zones: true,
      storms: false,
      sizes: ['desktop', 'portrait'],
      name: 'ring-150_-30-night',
    });
    expect(shotPath(shot)).toBe('/?debug=');
    expect(JSON.parse(seedStorage(shot)['fwt.settings.v1']!)).toMatchObject({
      dayNight: true,
      weather: false,
      language: 'en',
      seenHelp: true,
    });
  });

  it('plays a dev sea or a map file, and refuses what cannot be shot', () => {
    expect(shotPath(normalise({ sea: 'phase4' }))).toBe('/?debug=&map=phase4');
    const file = normalise({ sea: 'src/data/phase1-map.json', 'no-zones': true });
    expect(shotPath(file)).toBe('/?debug=&map=edited');
    expect(file.zones).toBe(false);
    expect(seedStorage(file)['fwt.editor.map.v1']).toContain('"boundsRadius"');
    expect(() => normalise({ sizes: 'tv' })).toThrow(/unknown size/);
    expect(() => normalise({ at: '1,2', port: 'saltmere' })).toThrow(/pick one/);
    // Towns at a level, an empty island founded first (decision 0157).
    expect(normalise({ town: 'palm-key:1,calda:4' }).towns).toEqual([
      ['palm-key', 1],
      ['calda', 4],
    ]);
    expect(() => normalise({ town: 'palm-key' })).toThrow(/id:level/);
    expect(shotPath(normalise({ url: './?map=edited&quest=q&step=s&port=p' }))).toBe(
      '/?map=edited&quest=q&step=s&port=p&debug=',
    );
  });

  it('checks one quest and gives its play-from-step link', () => {
    const doc = questDoc();
    expect(problemsOf(doc, PHASE1_MAP, ['saltmere-shoals'])).toEqual([]);
    const broken = questDoc();
    broken.quests.find((q) => q.id === 'saltmere-shoals')!.port = 'atlantis';
    expect(problemsOf(broken, PHASE1_MAP, ['saltmere-shoals'])).toContainEqual(
      expect.stringMatching(/^quest saltmere-shoals: no port "atlantis"/),
    );
    expect(problemsOf(broken, PHASE1_MAP, ['calda-slipway'])).toEqual([]);
    const play = questPlay(doc, PHASE1_MAP, 'saltmere-shoals', { step: '2' });
    expect(play).toMatchObject({ step: 'channel', start: { port: 'saltmere' } });
    expect(typeof play !== 'string' && play.path).toBe(
      './?map=edited&quest=saltmere-shoals&step=channel&port=saltmere',
    );
    expect(questPlay(doc, PHASE1_MAP, 'saltmere-shoals', { step: '9' })).toMatch(/has no step 9/);
    expect(
      questPlay(doc, PHASE1_MAP, 'saltmere-shoals', { step: 'channel', sea: true }),
    ).toMatchObject({ start: { headingDeg: expect.any(Number) } });
  });
});

describe('npm run sea and shots --editor (decision 0161)', () => {
  it('turns a command line into the sea editor’s step', async () => {
    const { seaStepFromArgs } = await import('../tools/fw/sea');
    expect(
      seaStepFromArgs(
        parseArgs(['add', 'shallows', '--sea', 'south', '--at', '10,-600', '--max-draft', '1.2']),
      ),
    ).toEqual({
      do: 'add',
      what: 'shallows',
      sea: 'south',
      at: [10, -600],
      outline: undefined,
      path: undefined,
      island: undefined,
      fields: { maxDraft: 1.2 },
    });
    expect(
      seaStepFromArgs(parseArgs(['add', 'mark', '--at', '1,2', '--type', 'light', '--name', '7'])),
    ).toMatchObject({ fields: { type: 'light', name: '7' } });
    expect(seaStepFromArgs(parseArgs(['set', 'grown', '--radius', '1000']))).toEqual({
      do: 'set',
      what: 'grown',
      fields: { boundsRadius: 1000, chartedRadius: undefined, sectors: undefined },
    });
    expect(
      seaStepFromArgs(parseArgs(['set', 'grown', '--sector', 'east=45,135;west=none'])),
    ).toMatchObject({ fields: { sectors: { east: [45, 135], west: null } } });
    expect(
      seaStepFromArgs(parseArgs(['move', 'shape', 'wreck-reef', '--turn', '20'])),
    ).toMatchObject({ do: 'move', id: 'wreck-reef', turn: 20 });
    expect(seaStepFromArgs(parseArgs(['move', 'island', 'palm-key', '--to-sea', 'north']))).toEqual(
      {
        do: 'move',
        what: 'island',
        id: 'palm-key',
        at: undefined,
        by: undefined,
        turn: undefined,
        toSea: 'north',
      },
    );
    expect(seaStepFromArgs(parseArgs(['list']))).toBeNull();
    expect(() => seaStepFromArgs(parseArgs(['bogus']))).toThrow('unknown command');
  });

  it('shoots the map editor on a sea, with a selection', () => {
    const shot = normalise({ editor: 'phase4', select: 'area:sugar-bar' });
    expect(shotPath(shot)).toBe('/editor.html?debug&sea=phase4');
    expect(shot.name).toBe('editor-phase4-area-sugar-bar');
    expect(shotPath(normalise({ editor: true }))).toBe('/editor.html?debug');
    expect(() => normalise({ editor: 'north' })).toThrow('--editor ring|phase4');
  });
});
