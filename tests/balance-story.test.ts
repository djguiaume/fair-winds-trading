import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { grownMap } from '../src/data/grownMap';
import { sailVoyage } from '../src/sim/balance';
import { questVisits, storyChapters } from '../src/sim/balanceStory';
import { QUESTS } from '../src/sim/quests';

const grown = prepareMap(grownMap(PHASE1_SOURCE));

describe('the balance bots play the grown sea in story order (decision 0195)', () => {
  it('reads the chapters from the quest files, and the ring has none', () => {
    expect(storyChapters(PHASE1_MAP)).toEqual([]);
    const chapters = storyChapters(grown);
    expect(chapters.map((c) => c.sea)).toEqual(['south', 'west', 'north', 'east']);
    const south = chapters[0]!.beats;
    expect(south.map((b) => b.quest)).toEqual([
      'watchman-passage',
      'sunreach-tea',
      'outpost-south',
    ]);
    expect(south[0]!.charts).toEqual(['coral-line', 'sunreach-waters']);
    expect(south[2]!.found).toEqual(['palm-key']);
    expect(south.every((b) => b.gold > 0)).toBe(true);
  });

  it('times a quest by the places its steps send her to', () => {
    const outpost = QUESTS.find((q) => q.id === 'outpost-south')!;
    const [start, supplies, settler] = questVisits(outpost);
    expect(start).toEqual([]);
    expect(supplies).toEqual([
      { maker: 'timber' },
      { x: 487, y: -738, within: 10 },
      { maker: 'planks' },
      { x: 487, y: -738, within: 10 },
    ]);
    expect(settler).toEqual([{ port: 'watchman-key' }, { x: 487, y: -738, within: 10 }]);
    const ness = QUESTS.find((q) => q.id === 'watchman-passage')!;
    expect(questVisits(ness)[0]).toEqual([{ port: 'watchman-key' }]);
  });

  it('opens the seas only through the story, after the cutter', () => {
    const plain = sailVoyage({
      map: grown,
      contracts: true,
      relaxed: false,
      minutes: 60,
      level: 'fair',
    });
    expect(plain.opened).toEqual({});
    expect(Object.keys(plain.routes).every((r) => !/sunreach|palm-key/.test(r))).toBe(true);
    const v = sailVoyage({
      map: grown,
      contracts: true,
      relaxed: false,
      minutes: 150,
      level: 'fair',
      seed: 1,
      story: true,
    });
    expect(v.opened.south).toBeGreaterThanOrEqual(v.bought.cutter!);
    expect(v.questsDone['outpost-south']).toBeGreaterThan(v.questsDone['watchman-passage']!);
    expect(v.storyGold).toBeGreaterThan(0);
    expect(v.farGold).toBeGreaterThan(0);
  });
});
