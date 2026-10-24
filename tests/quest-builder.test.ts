import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatJson, formatQuestJson } from '../src/data/jsonFormat';
import { PHASE1_MAP } from '../src/data/maps';
import {
  type QuestDoc,
  addPlace,
  checkPlaces,
  checkText,
  conditionWords,
  exportFiles,
  mergeText,
  newCondition,
  newQuest,
  renameQuest,
  setText,
  stepPlaces,
  storyColumns,
  textOf,
} from '../src/editor/quest/doc';
import { clearAt } from '../src/sim/mapChecks';
import { CONDITIONS, CONDITION_ABOUT, checkCondition } from '../src/sim/questLibrary';
import { QUESTS, type QuestDef, checkQuests } from '../src/sim/quests';

/** The quest builder's document (decision 0142). */

const raw = Object.fromEntries(
  readdirSync('src/data/quests').map((f) => [
    f.replace(/\.json$/, ''),
    readFileSync(`src/data/quests/${f}`, 'utf8'),
  ]),
);
const shipped = (): QuestDoc => ({
  quests: structuredClone(QUESTS) as QuestDef[],
  text: { en: {}, fr: {} },
});
const shoals = (doc: QuestDoc) => doc.quests.find((q) => q.id === 'saltmere-shoals')!;

describe('quest builder (decision 0142)', () => {
  it('writes every shipped quest file back byte for byte', () => {
    for (const [id, text] of Object.entries(raw)) {
      const value: unknown = JSON.parse(text);
      // A file whose objects were broken open keeps the plain format, the rest keep objects inline.
      const out = formatJson(value) === text ? formatJson(value) : formatQuestJson(value);
      expect(out, id).toBe(text);
    }
  });

  it('exports nothing when nothing changed, and only the changed files', () => {
    const doc = shipped();
    expect(exportFiles(doc, raw)).toEqual([]);
    shoals(doc).steps[0]!.reward = { gold: 120 };
    setText(doc, 'fr', 'quest.saltmere-shoals.gulls.title', 'Cherchez les mouettes');
    const files = exportFiles(doc, raw);
    expect(files.map((f) => f.path)).toEqual([
      'src/data/quests/saltmere-shoals.json',
      'src/i18n/fr.json',
    ]);
    const quest = files[0]!.text;
    expect(quest).toBe(
      raw['saltmere-shoals']!.replace('"reward": { "gold": 100 }', '"reward": { "gold": 120 }'),
    );
    const fr = readFileSync('src/i18n/fr.json', 'utf8');
    expect(files[1]!.text).toBe(
      fr.replace('"Trouvez les mouettes qui plongent"', '"Cherchez les mouettes"'),
    );
  });

  it('puts new text after its quest’s keys, and drops an edit set back to the shipped text', () => {
    const merged = Object.keys(mergeText('en', { 'quest.saltmere-shoals.extra.title': 'More' }));
    const at = merged.indexOf('quest.saltmere-shoals.extra.title');
    expect(merged[at - 1]).toBe('quest.saltmere-shoals.done.copy');
    const doc = shipped();
    setText(doc, 'en', 'quest.saltmere-shoals.name', 'Changed');
    expect(textOf(doc, 'en', 'quest.saltmere-shoals.name')).toBe('Changed');
    setText(doc, 'en', 'quest.saltmere-shoals.name', 'Where the shoals went');
    expect(doc.text.en).toEqual({});
  });

  it('finds a step’s places at sea and adds one', () => {
    const doc = shipped();
    const [gulls, channel] = shoals(doc).steps;
    const places = stepPlaces(channel!, PHASE1_MAP);
    expect(places.map((p) => [p.kind, p.no, p.ordered])).toEqual([
      ['point', 1, true],
      ['point', 2, true],
      ['point', 3, true],
    ]);
    expect(places[1]!.path).toEqual(['goal', 'points', 1]);
    expect(addPlace(gulls!, 150.04, 20)).toEqual(['goal', 'points', 3]);
    expect(stepPlaces(gulls!, PHASE1_MAP)[3]).toMatchObject({ x: 150, y: 20, within: 10 });
    const calda = doc.quests.find((q) => q.id === 'calda-slipway')!;
    expect(stepPlaces(calda.steps[1]!, PHASE1_MAP)).toMatchObject([
      { kind: 'spot', path: ['goal', 'from'], radiusPath: ['goal', 'from', 'within'] },
    ]);
  });

  it('the shipped quests pass the builder’s text and place checks', () => {
    const doc = shipped();
    expect(checkText(doc)).toEqual([]);
    expect(checkPlaces(doc, PHASE1_MAP, (x, y) => clearAt(PHASE1_MAP, x, y, 0))).toEqual([]);
    setText(doc, 'fr', 'quest.saltmere-shoals.catch.title', 'Portez la pêche');
    expect(checkText(doc).join()).toContain('the {…} differ');
  });

  it('words, story columns and renames', () => {
    const doc = shipped();
    expect(conditionWords(shoals(doc).steps[1]!.goal)).toBe(
      'reach 3 places · in order · within 10',
    );
    // The tutorial is a quest like the others (decision 0151).
    const columns = storyColumns(doc.quests);
    expect(columns[0]).toEqual(['first-voyage']);
    expect(columns[1]).toEqual(['rooks-thanks']);
    expect(columns[2]).toHaveLength(4);
    expect(columns[3]).toEqual(['fair-winds']);
    const q = newQuest(doc, PHASE1_MAP);
    doc.quests.push(q);
    setText(doc, 'en', `${q.text}.name`, 'A test');
    doc.quests[0]!.start = { is: 'quest-done', quest: q.id };
    renameQuest(doc, q.id, 'renamed');
    expect(q.id).toBe('renamed');
    expect(doc.quests[0]!.start).toEqual({ is: 'quest-done', quest: 'renamed' });
    expect(doc.text.en).toEqual({ 'quest.renamed.name': 'A test' });
  });

  it('every condition kind has words for the kind picker, and a new one checks clean', () => {
    const scope = {
      map: PHASE1_MAP,
      quests: new Map([['first-voyage', []]]),
      vars: {},
      steps: new Map<string, string[]>(),
      items: [],
    };
    for (const kind of Object.keys(CONDITIONS)) {
      expect(CONDITION_ABOUT[kind], kind).toBeTruthy();
      // Kinds naming a step, option or item need the author to pick one first.
      if (['quest-at', 'chose', 'carried'].includes(kind)) continue;
      const c = newCondition(kind, PHASE1_MAP, ['first-voyage']);
      expect(checkCondition(c, scope, kind !== 'asked', kind), kind).toEqual([]);
    }
  });

  it('a new quest from the builder passes the engine’s checks', () => {
    const doc = shipped();
    doc.quests.push(newQuest(doc, PHASE1_MAP));
    expect(checkQuests(doc.quests, PHASE1_MAP)).toEqual([]);
  });
});
