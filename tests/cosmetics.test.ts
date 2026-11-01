import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  addItem,
  bundleText,
  catalogueFiles,
  cosmeticsProblems,
  find,
  importBundle,
  removeItem,
  setField,
  shippedCosmeticsDoc,
} from '../src/editor/cosmetics/doc';
import { lookSvg } from '../src/editor/cosmetics/preview';
import { logoProblems, logoTriangles, sailColourProblem } from '../src/sim/cosmeticChecks';
import { type FlagItem, resolveAppearance, stockAppearance } from '../src/sim/cosmetics';
import { FLAGS } from '../src/sim/regatta';
import { SHIP_FILES } from '../src/data/ships';

// Decision 0261: boat cosmetics are data, one file per item, one set of checks for everyone.
const problemsAfter = (change: (d: ReturnType<typeof shippedCosmeticsDoc>) => void) => {
  const doc = shippedCosmeticsDoc();
  change(doc);
  return cosmeticsProblems(doc);
};

describe('the shipped catalogue', () => {
  it('passes every check', () => {
    expect(cosmeticsProblems(shippedCosmeticsDoc())).toEqual([]);
  });

  it('is written byte for byte as the editor and the command write it', () => {
    for (const { path, text } of catalogueFiles(shippedCosmeticsDoc()))
      expect(readFileSync(`src/data/cosmetics/${path}`, 'utf8'), path).toBe(text);
  });

  it('gives the storyteller’s twelve emblems, four free', () => {
    const logos = shippedCosmeticsDoc().items.filter((i) => i.slot === 'sail-logo');
    expect(logos).toHaveLength(12);
    expect(logos.filter((l) => l.unlock.kind === 'free').map((l) => l.id)).toEqual(
      expect.arrayContaining(['anchor', 'gull', 'wave', 'knot']),
    );
  });
});

describe('resolving a look', () => {
  const cat = shippedCosmeticsDoc();
  it('the stock look is the class’s own', () => {
    const { look, problems } = resolveAppearance(cat, {}, 'sloop', FLAGS);
    expect(problems).toEqual([]);
    expect(look.hull).toEqual({ band: null, strake: null });
    expect(look.sail.pattern).toEqual({ kind: 'plain', colours: [] });
    expect(look.sail.logo).toBeNull();
    expect(look.figurehead).toBeNull();
    expect(look.flag).toBeNull();
  });

  it('turns ids into values on every ship class', () => {
    const want = {
      sailColour: 'sky',
      sailPattern: 'bands-navy',
      sailLogo: 'gull',
      hullColour: 'gold-trim',
      figurehead: 'sun',
      flag: 'signal-blue',
      wake: 'foam',
    };
    for (const ship of SHIP_FILES) {
      const { look, problems } = resolveAppearance(cat, want, ship.id, FLAGS);
      expect(problems, ship.id).toEqual([]);
      expect(look.sail.cloth).toBe('#a9d4ee');
      expect(look.sail.logo?.svg).toContain('<polygon');
      expect(look.figurehead?.recipe).toBe('figurehead-sun');
      expect(look.flag?.bands).toEqual(['#2f6f9f', '#f4f1e8']);
      expect(lookSvg(cat, want, ship.id)).toContain('<svg');
    }
  });

  it('falls back to stock for an unknown or unfit id and says so', () => {
    const doc = shippedCosmeticsDoc();
    (find(doc, 'sail-colour', 'sky') as { classes?: string[] }).classes = ['cutter'];
    const { look, problems } = resolveAppearance(
      doc,
      { sailColour: 'sky', sailLogo: 'nope' },
      'sloop',
      FLAGS,
    );
    expect(look.sail.cloth).toBe('#fbf6e8');
    expect(look.sail.logo).toBeNull();
    expect(problems).toEqual([
      'sail-colour: "sky" does not fit sloop',
      'sail-logo: no item "nope"',
    ]);
  });

  it('a regatta pennant resolves to the flag of flags.json', () => {
    const { look } = resolveAppearance(cat, { flag: 'pennant-club' }, 'sloop', FLAGS);
    expect(look.flag?.id).toBe('pennant-club');
  });

  it('every slot has a stock item that is free', () => {
    expect(Object.keys(stockAppearance())).toHaveLength(7);
  });
});

describe('the checks refuse', () => {
  it('a dark or red sail, and an off-list pattern or wake', () => {
    expect(sailColourProblem('#334455')).toMatch(/too dark/);
    expect(sailColourProblem('#f2a0a0')).toMatch(/red/);
    expect(sailColourProblem('#a9d4ee')).toBeNull();
    expect(
      problemsAfter((d) => setField(find(d, 'sail-colour', 'sky')!, 'cloth', '#222222')),
    ).toHaveLength(1);
    expect(
      problemsAfter((d) => setField(find(d, 'sail-pattern', 'bands-navy')!, 'pattern', 'plaid'))[0],
    ).toMatch(/not one of/);
    expect(problemsAfter((d) => setField(find(d, 'wake', 'foam')!, 'style', 'fire'))[0]).toMatch(
      /not one of/,
    );
  });

  it('malformed values, ids and missing names', () => {
    expect(
      problemsAfter((d) =>
        setField(find(d, 'sail-pattern', 'bands-navy')!, 'colours', '#2f6f9f'),
      )[0],
    ).toMatch(/takes 2 colours/);
    expect(
      problemsAfter((d) => setField(find(d, 'hull-colour', 'navy-trim')!, 'band', 'blue'))[0],
    ).toMatch(/not #rrggbb/);
    expect(problemsAfter((d) => void addItem(d, 'wake', 'Bad Id')).join()).toMatch(/lower case/);
    expect(problemsAfter((d) => setField(find(d, 'wake', 'foam')!, 'name.fr', ''))[0]).toMatch(
      /needs en and fr/,
    );
  });

  it('classes that do not exist, quests and series that do not exist', () => {
    expect(
      problemsAfter((d) => setField(find(d, 'sail-colour', 'sky')!, 'classes', 'sloop,galleon'))[0],
    ).toMatch(/no ship class "galleon"/);
    expect(
      problemsAfter((d) => setField(find(d, 'sail-logo', 'sun')!, 'unlock.quest', 'nowhere'))[0],
    ).toMatch(/no quest/);
    expect(
      problemsAfter((d) => setField(find(d, 'wake', 'foam')!, 'unlock.regatta', 'regatta-x')),
    ).toHaveLength(1);
  });

  it('a logo that is not flat shapes, or too many triangles, or has no SVG', () => {
    expect(
      logoProblems('<svg viewBox="0 0 1 1"><text>x</text><image href="a.png"/></svg>').join(),
    ).toMatch(/<text> is not allowed/);
    const many = `<svg viewBox="0 0 1 1"><polygon points="${Array.from({ length: 45 }, (_, i) => `${i},0`).join(' ')}"/></svg>`;
    expect(logoTriangles(many)).toBe(43);
    expect(problemsAfter((d) => (d.logos.anchor = many))[0]).toMatch(/at most 40/);
    expect(problemsAfter((d) => delete d.logos.gull)[0]).toMatch(/no gull.svg/);
  });

  it('a figurehead without a recipe, over the triangle budget, or on no mount', () => {
    expect(
      problemsAfter((d) => setField(find(d, 'figurehead', 'sun')!, 'recipe', 'missing'))[0],
    ).toMatch(/no prop recipe/);
    expect(problemsAfter((d) => setField(find(d, 'figurehead', 'sun')!, 'tris', '90'))[0]).toMatch(
      /tris must be/,
    );
    expect(
      problemsAfter((d) => setField(find(d, 'figurehead', 'sun')!, 'mount', 'beam'))[0],
    ).toMatch(/mount/);
  });

  it('a personal flag that copies a regatta prize or Kestrel’s burgee', () => {
    const copy = (flag: string) =>
      problemsAfter((d) => {
        const club = FLAGS.find((f) => f.id === flag)!;
        const item = addItem(d, 'flag', 'fake') as FlagItem;
        item.own = {
          shape: club.shape,
          bands: [...club.bands],
          length: club.length,
          height: club.height,
        };
      });
    expect(copy('pennant-club').join()).toMatch(/looks exactly like the flag "pennant-club"/);
    expect(copy('kestrel').join()).toMatch(/Kestrel/);
  });

  it('a pennant that is free, recoloured or Kestrel’s', () => {
    expect(
      problemsAfter((d) => setField(find(d, 'flag', 'pennant-club')!, 'unlock.kind', 'free'))[0],
    ).toMatch(/earned by that series/);
    expect(
      problemsAfter((d) => setField(find(d, 'flag', 'pennant-club')!, 'ref', 'kestrel'))[0],
    ).toMatch(/Kestrel's burgee stays hers/);
  });

  it('a stock item that is missing or earned', () => {
    expect(problemsAfter((d) => void removeItem(d, 'wake', 'plain'))[0]).toMatch(
      /stock item.*missing/,
    );
    expect(
      problemsAfter((d) => setField(find(d, 'wake', 'plain')!, 'unlock.kind', 'earned'))[0],
    ).toBeDefined();
  });

  it('a set that names an item that is not there', () => {
    expect(
      problemsAfter((d) => setField(find(d, 'set', 'sailing-club')!, 'items.sail-logo', 'nope'))[0],
    ).toMatch(/no item "nope"/);
  });
});

describe('authoring parity', () => {
  it('a new item of every slot passes the checks when it is given what it needs', () => {
    const doc = shippedCosmeticsDoc();
    for (const slot of [
      'sail-colour',
      'sail-pattern',
      'sail-logo',
      'hull-colour',
      'wake',
      'flag',
      'set',
    ] as const)
      expect(typeof addItem(doc, slot, 'fresh')).toBe('object');
    expect(cosmeticsProblems(doc)).toEqual([]);
    expect(addItem(doc, 'wake', 'fresh')).toMatch(/already exists/);
  });

  it('export then import gives the same catalogue', () => {
    const doc = shippedCosmeticsDoc();
    const text = bundleText(doc);
    const again = shippedCosmeticsDoc();
    removeItem(again, 'sail-logo', 'gull');
    expect(importBundle(again, text)).toBeNull();
    expect(bundleText(again).length).toBe(text.length);
    expect(cosmeticsProblems(again)).toEqual([]);
    expect(importBundle(again, '{"nope":1}')).toMatch(/not a cosmetics bundle/);
  });

  it('set edits the way the page does: numbers, lists, clearing', () => {
    const doc = shippedCosmeticsDoc();
    const flag = find(doc, 'flag', 'signal-blue') as FlagItem;
    expect(setField(flag, 'own.length', 'long')).toMatch(/a number/);
    expect(setField(flag, 'own.bands', '#2f6f9f,#f4f1e8,#2f6f9f')).toBeNull();
    expect(flag.own!.bands).toHaveLength(3);
    expect(setField(find(doc, 'sail-colour', 'sky')!, 'id', 'x')).toMatch(/cannot change/);
    expect(setField(find(doc, 'wake', 'foam')!, 'tint', '#ffffff')).toBeNull();
    expect(setField(find(doc, 'wake', 'foam')!, 'tint', '-')).toBeNull();
  });
});
