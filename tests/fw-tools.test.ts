import { describe, expect, it } from 'vitest';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import { ISLAND_DESIGNS } from '../src/data/islands';
import { checkAll } from '../tools/fw/check';
// @ts-expect-error plain JavaScript module without types
import { parseArgs } from '../tools/fw/lib.mjs';
// @ts-expect-error plain JavaScript module without types
import { nextFree } from '../tools/fw/adr.mjs';

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
});
